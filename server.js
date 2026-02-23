// ============================================
// LIBRARY SEAT MANAGEMENT - SERVER
// Node.js + Express + Socket.io + MySQL
// ============================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); 
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/library-screen.html');
});// Serve HTML files

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// ============================================
// DATABASE CONNECTION
// ============================================
const dbConfig = {
  host: process.env.MYSQLHOST || 'localhost',
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || '',
  database: process.env.MYSQLDATABASE || 'library_db',
  port: process.env.MYSQLPORT || 3306
};

let db;

async function connectDB() {
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('✅ MySQL Connected!');
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    console.log('Retrying in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
}

// ============================================
// SOCKET.IO — Real-time events
// ============================================
io.on('connection', async (socket) => {
  console.log(`🔌 Screen connected: ${socket.id}`);

  // Send all seat statuses when a screen connects
  try {
    const [rows] = await db.query('SELECT * FROM seats');
    const seatMap = {};
    rows.forEach(row => {
      seatMap[row.seat_id] = {
        occupied: row.is_occupied === 1,
        studentId: row.current_student_id
      };
    });
    socket.emit('all-seats', seatMap);
  } catch (err) {
    console.error('Error fetching seats:', err.message);
  }

  // ============================================
  // VERIFY STUDENT BARCODE
  // ============================================
  socket.on('verify-student', async ({ barcode }) => {
    try {
      // Find student by barcode (roll number on ID card)
      const [students] = await db.query(
        'SELECT * FROM students WHERE barcode = ? OR roll_number = ?',
        [barcode, barcode]
      );

      if (students.length === 0) {
        socket.emit('error-msg', { msg: 'Student not found! Please contact admin.' });
        return;
      }

      const student = students[0];

      // Check if student is already inside
      const [sessions] = await db.query(
        'SELECT * FROM sessions WHERE student_id = ? AND exit_time IS NULL',
        [student.id]
      );

      const isInside = sessions.length > 0;

      if (isInside) {
        // Student has a seat — prepare for exit
        const session = sessions[0];
        student.seat_id = session.seat_id;
      }

      socket.emit('student-verified', { student, isInside });

    } catch (err) {
      console.error('verify-student error:', err.message);
      socket.emit('error-msg', { msg: 'Server error. Try again.' });
    }
  });

  // ============================================
  // BOOK A SEAT
  // ============================================
  socket.on('book-seat', async ({ studentId, seatId }) => {
    try {
      // Check if seat is still free (race condition protection)
      const [seatRows] = await db.query(
        'SELECT * FROM seats WHERE seat_id = ? AND is_occupied = 0',
        [seatId]
      );

      if (seatRows.length === 0) {
        socket.emit('error-msg', { msg: `Seat ${seatId} just got taken! Choose another.` });
        return;
      }

      // Mark seat as occupied
      await db.query(
        'UPDATE seats SET is_occupied = 1, current_student_id = ? WHERE seat_id = ?',
        [studentId, seatId]
      );

      // Create session record
      await db.query(
        'INSERT INTO sessions (student_id, seat_id, entry_time) VALUES (?, ?, NOW())',
        [studentId, seatId]
      );

      // Broadcast seat update to ALL connected screens
      io.emit('seat-update', {
        seatId,
        occupied: true,
        studentId
      });

      console.log(`✅ Seat ${seatId} booked by student ${studentId}`);

    } catch (err) {
      console.error('book-seat error:', err.message);
    }
  });

  // ============================================
  // STUDENT EXIT — Release seat
  // ============================================
  socket.on('student-exit', async ({ studentId }) => {
    try {
      // Find active session
      const [sessions] = await db.query(
        'SELECT * FROM sessions WHERE student_id = ? AND exit_time IS NULL',
        [studentId]
      );

      if (sessions.length === 0) return;

      const session = sessions[0];
      const seatId = session.seat_id;

      // Update session with exit time
      await db.query(
        'UPDATE sessions SET exit_time = NOW() WHERE id = ?',
        [session.id]
      );

      // Free the seat
      await db.query(
        'UPDATE seats SET is_occupied = 0, current_student_id = NULL WHERE seat_id = ?',
        [seatId]
      );

      // Broadcast to all screens
      io.emit('seat-update', {
        seatId,
        occupied: false,
        studentId: null
      });

      console.log(`🚪 Seat ${seatId} released by student ${studentId}`);

    } catch (err) {
      console.error('student-exit error:', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Screen disconnected: ${socket.id}`);
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = 3000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀 Library Server running!`);
    console.log(`📺 Open in browser: http://localhost:${PORT}/library-screen.html`);
    console.log(`💡 For other screens on same WiFi use your computer's IP address`);
  });
});
