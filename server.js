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
});

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
    await createTables(); // Auto create tables if not exist
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    console.log('Retrying in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
}

// ============================================
// AUTO CREATE TABLES (agar exist na karein)
// ============================================
async function createTables() {
  try {
    // Students table
    await db.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        roll_number VARCHAR(50) UNIQUE NOT NULL,
        barcode VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seats table
    await db.query(`
      CREATE TABLE IF NOT EXISTS seats (
        seat_id VARCHAR(10) PRIMARY KEY,
        is_occupied TINYINT(1) DEFAULT 0,
        current_student_id INT DEFAULT NULL
      )
    `);

    // Sessions table (student entry/exit logs)
    await db.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        seat_id VARCHAR(10) NOT NULL,
        entry_time DATETIME DEFAULT NOW(),
        exit_time DATETIME DEFAULT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id)
      )
    `);

    // Visitors table — YEH MISSING THA!
    await db.query(`
      CREATE TABLE IF NOT EXISTS visitors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        mobile VARCHAR(10) NOT NULL,
        email VARCHAR(100) DEFAULT NULL,
        purpose VARCHAR(50) DEFAULT NULL,
        entry_time DATETIME DEFAULT NOW(),
        visit_date VARCHAR(20) DEFAULT NULL,
        visit_time VARCHAR(20) DEFAULT NULL
      )
    `);

    console.log('✅ All tables ready!');

    // Seats seed karo agar empty hain
    const [existing] = await db.query('SELECT COUNT(*) as cnt FROM seats');
    if (existing[0].cnt === 0) {
      console.log('⏳ Seating seats table...');
      const values = [];
      ['A', 'B'].forEach(sec => {
        for (let i = 1; i <= 200; i++) {
          values.push([`${sec}${i}`, 0, null]);
        }
      });
      await db.query(
        'INSERT INTO seats (seat_id, is_occupied, current_student_id) VALUES ?',
        [values]
      );
      console.log('✅ 400 seats initialized!');
    }

  } catch (err) {
    console.error('❌ Table creation error:', err.message);
  }
}

// ============================================
// SOCKET.IO — Real-time events
// ============================================
io.on('connection', async (socket) => {
  console.log(`🔌 Screen connected: ${socket.id}`);

  // Send all seat statuses on connect
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
      const [students] = await db.query(
        'SELECT * FROM students WHERE barcode = ? OR roll_number = ?',
        [barcode, barcode]
      );

      if (students.length === 0) {
        socket.emit('error-msg', { msg: 'Student not found! Please contact admin.' });
        return;
      }

      const student = students[0];

      const [sessions] = await db.query(
        'SELECT * FROM sessions WHERE student_id = ? AND exit_time IS NULL',
        [student.id]
      );

      const isInside = sessions.length > 0;
      if (isInside) {
        student.seat_id = sessions[0].seat_id;
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
      const [seatRows] = await db.query(
        'SELECT * FROM seats WHERE seat_id = ? AND is_occupied = 0',
        [seatId]
      );

      if (seatRows.length === 0) {
        socket.emit('error-msg', { msg: `Seat ${seatId} just got taken! Choose another.` });
        return;
      }

      await db.query(
        'UPDATE seats SET is_occupied = 1, current_student_id = ? WHERE seat_id = ?',
        [studentId, seatId]
      );

      await db.query(
        'INSERT INTO sessions (student_id, seat_id, entry_time) VALUES (?, ?, NOW())',
        [studentId, seatId]
      );

      // Student name bhi bhejo taaki admin tooltip mein dikh sake
      const [students] = await db.query('SELECT name FROM students WHERE id = ?', [studentId]);
      const studentName = students[0]?.name || '';

      io.emit('seat-update', {
        seatId,
        occupied: true,
        studentId,
        studentName
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
      const [sessions] = await db.query(
        'SELECT * FROM sessions WHERE student_id = ? AND exit_time IS NULL',
        [studentId]
      );

      if (sessions.length === 0) return;

      const session = sessions[0];
      const seatId = session.seat_id;

      await db.query(
        'UPDATE sessions SET exit_time = NOW() WHERE id = ?',
        [session.id]
      );

      await db.query(
        'UPDATE seats SET is_occupied = 0, current_student_id = NULL WHERE seat_id = ?',
        [seatId]
      );

      io.emit('seat-update', {
        seatId,
        occupied: false,
        studentId: null,
        studentName: null
      });

      console.log(`🚪 Seat ${seatId} released by student ${studentId}`);

    } catch (err) {
      console.error('student-exit error:', err.message);
    }
  });

  // ============================================
  // VISITOR ENTRY — YEH MISSING THA!
  // ============================================
  socket.on('visitor-entry', async (data) => {
    try {
      const { name, mobile, email, purpose, visit_date, visit_time } = data;

      await db.query(
        `INSERT INTO visitors (name, mobile, email, purpose, entry_time, visit_date, visit_time)
         VALUES (?, ?, ?, ?, NOW(), ?, ?)`,
        [name, mobile, email || null, purpose || null, visit_date || null, visit_time || null]
      );

      socket.emit('visitor-saved', { success: true });
      console.log(`👤 Visitor registered: ${name} (${mobile})`);

    } catch (err) {
      console.error('visitor-entry error:', err.message);
      socket.emit('visitor-saved', { success: false });
    }
  });

  // ============================================
  // GET STUDENT LOGS — YEH MISSING THA!
  // ============================================
  socket.on('get-student-logs', async ({ filter } = {}) => {
    try {
      let whereClause = '';
      if (filter === 'today')   whereClause = 'WHERE DATE(s.entry_time) = CURDATE()';
      if (filter === 'week')    whereClause = 'WHERE s.entry_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
      if (filter === 'month')   whereClause = 'WHERE s.entry_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
      // filter === 'all' or undefined = no filter

      const [logs] = await db.query(`
        SELECT
          s.id, st.name, st.roll_number, s.seat_id,
          s.entry_time, s.exit_time,
          DATE_FORMAT(s.entry_time, '%d %b %Y') AS entry_date,
          DATE_FORMAT(s.entry_time, '%h:%i %p') AS entry_time_fmt,
          DATE_FORMAT(s.exit_time,  '%d %b %Y') AS exit_date,
          DATE_FORMAT(s.exit_time,  '%h:%i %p') AS exit_time_fmt,
          TIMEDIFF(COALESCE(s.exit_time, NOW()), s.entry_time) AS duration
        FROM sessions s
        JOIN students st ON s.student_id = st.id
        ${whereClause}
        ORDER BY s.entry_time DESC
        LIMIT 500
      `);

      socket.emit('student-logs', logs);
      console.log(`📋 Sent ${logs.length} student logs [filter: ${filter || 'all'}]`);

    } catch (err) {
      console.error('get-student-logs error:', err.message);
      socket.emit('student-logs', []);
    }
  });

  socket.on('get-visitor-logs', async ({ filter } = {}) => {
    try {
      let whereClause = '';
      if (filter === 'today')   whereClause = 'WHERE DATE(entry_time) = CURDATE()';
      if (filter === 'week')    whereClause = 'WHERE entry_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
      if (filter === 'month')   whereClause = 'WHERE entry_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)';

      const [logs] = await db.query(`
        SELECT
          id, name, mobile, email, purpose, entry_time,
          DATE_FORMAT(entry_time, '%h:%i %p') AS time,
          DATE_FORMAT(entry_time, '%d %b %Y') AS date
        FROM visitors
        ${whereClause}
        ORDER BY entry_time DESC
        LIMIT 500
      `);

      socket.emit('visitor-logs', logs);
      console.log(`📋 Sent ${logs.length} visitor logs [filter: ${filter || 'all'}]`);

    } catch (err) {
      console.error('get-visitor-logs error:', err.message);
      socket.emit('visitor-logs', []);
    }
  });

  // ============================================
  // ADMIN RELEASE SEAT — YEH BHI MISSING THA!
  // ============================================
  socket.on('admin-release-seat', async ({ seatId }) => {
    try {
      // Active session band karo
      const [sessions] = await db.query(
        'SELECT * FROM sessions WHERE seat_id = ? AND exit_time IS NULL',
        [seatId]
      );

      if (sessions.length > 0) {
        await db.query(
          'UPDATE sessions SET exit_time = NOW() WHERE id = ?',
          [sessions[0].id]
        );
      }

      // Seat free karo
      await db.query(
        'UPDATE seats SET is_occupied = 0, current_student_id = NULL WHERE seat_id = ?',
        [seatId]
      );

      // Sab screens ko update bhejo
      io.emit('seat-update', {
        seatId,
        occupied: false,
        studentId: null,
        studentName: null
      });

      console.log(`🔓 Seat ${seatId} manually released by admin`);

    } catch (err) {
      console.error('admin-release-seat error:', err.message);
    }
  });

  // ============================================
  // DISCONNECT
  // ============================================
  socket.on('disconnect', () => {
    console.log(`🔴 Screen disconnected: ${socket.id}`);
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀 Library Server running!`);
    console.log(`📺 Kiosk screen  : http://localhost:${PORT}/library-screen.html`);
    console.log(`👁  Public view   : http://localhost:${PORT}/public-view.html`);
    console.log(`\n💡 Same WiFi pe doosri screen ke liye apna IP use karo`);
    console.log(`   Example: http://192.168.1.x:${PORT}/library-screen.html\n`);
  });
});