-- ============================================
-- LIBRARY SEAT MANAGEMENT - DATABASE SETUP
-- Run this file in MySQL/phpMyAdmin
-- ============================================

-- Step 1: Create database
CREATE DATABASE IF NOT EXISTS library_db;
USE library_db;

-- ============================================
-- TABLE: students
-- Yahan sab students ka data hoga
-- ============================================
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  roll_number VARCHAR(50) UNIQUE NOT NULL,
  barcode VARCHAR(100) UNIQUE NOT NULL,  -- College ID card ka barcode value
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLE: seats
-- 400 seats ka status
-- ============================================
CREATE TABLE IF NOT EXISTS seats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  seat_id VARCHAR(10) UNIQUE NOT NULL,     -- e.g. A1, A2, B100
  is_occupied TINYINT(1) DEFAULT 0,        -- 0 = free, 1 = occupied
  current_student_id INT DEFAULT NULL,
  FOREIGN KEY (current_student_id) REFERENCES students(id) ON DELETE SET NULL
);

-- ============================================
-- TABLE: sessions
-- Entry/Exit records — poori history
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  seat_id VARCHAR(10) NOT NULL,
  entry_time DATETIME NOT NULL,
  exit_time DATETIME DEFAULT NULL,         -- NULL means still inside
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ============================================
-- INSERT: 400 Seats (A1-A200, B1-B200)
-- ============================================
INSERT IGNORE INTO seats (seat_id) VALUES
-- Section A (200 seats)
('A1'),('A2'),('A3'),('A4'),('A5'),('A6'),('A7'),('A8'),('A9'),('A10'),
('A11'),('A12'),('A13'),('A14'),('A15'),('A16'),('A17'),('A18'),('A19'),('A20'),
('A21'),('A22'),('A23'),('A24'),('A25'),('A26'),('A27'),('A28'),('A29'),('A30'),
('A31'),('A32'),('A33'),('A34'),('A35'),('A36'),('A37'),('A38'),('A39'),('A40'),
('A41'),('A42'),('A43'),('A44'),('A45'),('A46'),('A47'),('A48'),('A49'),('A50'),
('A51'),('A52'),('A53'),('A54'),('A55'),('A56'),('A57'),('A58'),('A59'),('A60'),
('A61'),('A62'),('A63'),('A64'),('A65'),('A66'),('A67'),('A68'),('A69'),('A70'),
('A71'),('A72'),('A73'),('A74'),('A75'),('A76'),('A77'),('A78'),('A79'),('A80'),
('A81'),('A82'),('A83'),('A84'),('A85'),('A86'),('A87'),('A88'),('A89'),('A90'),
('A91'),('A92'),('A93'),('A94'),('A95'),('A96'),('A97'),('A98'),('A99'),('A100'),
('A101'),('A102'),('A103'),('A104'),('A105'),('A106'),('A107'),('A108'),('A109'),('A110'),
('A111'),('A112'),('A113'),('A114'),('A115'),('A116'),('A117'),('A118'),('A119'),('A120'),
('A121'),('A122'),('A123'),('A124'),('A125'),('A126'),('A127'),('A128'),('A129'),('A130'),
('A131'),('A132'),('A133'),('A134'),('A135'),('A136'),('A137'),('A138'),('A139'),('A140'),
('A141'),('A142'),('A143'),('A144'),('A145'),('A146'),('A147'),('A148'),('A149'),('A150'),
('A151'),('A152'),('A153'),('A154'),('A155'),('A156'),('A157'),('A158'),('A159'),('A160'),
('A161'),('A162'),('A163'),('A164'),('A165'),('A166'),('A167'),('A168'),('A169'),('A170'),
('A171'),('A172'),('A173'),('A174'),('A175'),('A176'),('A177'),('A178'),('A179'),('A180'),
('A181'),('A182'),('A183'),('A184'),('A185'),('A186'),('A187'),('A188'),('A189'),('A190'),
('A191'),('A192'),('A193'),('A194'),('A195'),('A196'),('A197'),('A198'),('A199'),('A200'),
-- Section B (200 seats)
('B1'),('B2'),('B3'),('B4'),('B5'),('B6'),('B7'),('B8'),('B9'),('B10'),
('B11'),('B12'),('B13'),('B14'),('B15'),('B16'),('B17'),('B18'),('B19'),('B20'),
('B21'),('B22'),('B23'),('B24'),('B25'),('B26'),('B27'),('B28'),('B29'),('B30'),
('B31'),('B32'),('B33'),('B34'),('B35'),('B36'),('B37'),('B38'),('B39'),('B40'),
('B41'),('B42'),('B43'),('B44'),('B45'),('B46'),('B47'),('B48'),('B49'),('B50'),
('B51'),('B52'),('B53'),('B54'),('B55'),('B56'),('B57'),('B58'),('B59'),('B60'),
('B61'),('B62'),('B63'),('B64'),('B65'),('B66'),('B67'),('B68'),('B69'),('B70'),
('B71'),('B72'),('B73'),('B74'),('B75'),('B76'),('B77'),('B78'),('B79'),('B80'),
('B81'),('B82'),('B83'),('B84'),('B85'),('B86'),('B87'),('B88'),('B89'),('B90'),
('B91'),('B92'),('B93'),('B94'),('B95'),('B96'),('B97'),('B98'),('B99'),('B100'),
('B101'),('B102'),('B103'),('B104'),('B105'),('B106'),('B107'),('B108'),('B109'),('B110'),
('B111'),('B112'),('B113'),('B114'),('B115'),('B116'),('B117'),('B118'),('B119'),('B120'),
('B121'),('B122'),('B123'),('B124'),('B125'),('B126'),('B127'),('B128'),('B129'),('B130'),
('B131'),('B132'),('B133'),('B134'),('B135'),('B136'),('B137'),('B138'),('B139'),('B140'),
('B141'),('B142'),('B143'),('B144'),('B145'),('B146'),('B147'),('B148'),('B149'),('B150'),
('B151'),('B152'),('B153'),('B154'),('B155'),('B156'),('B157'),('B158'),('B159'),('B160'),
('B161'),('B162'),('B163'),('B164'),('B165'),('B166'),('B167'),('B168'),('B169'),('B170'),
('B171'),('B172'),('B173'),('B174'),('B175'),('B176'),('B177'),('B178'),('B179'),('B180'),
('B181'),('B182'),('B183'),('B184'),('B185'),('B186'),('B187'),('B188'),('B189'),('B190'),
('B191'),('B192'),('B193'),('B194'),('B195'),('B196'),('B197'),('B198'),('B199'),('B200');

-- ============================================
-- INSERT: Sample Students (for testing)
-- Baad mein apne college ke students add karna
-- ============================================
INSERT IGNORE INTO students (name, roll_number, barcode) VALUES
('Test Student 1', 'CS2021001', 'CS2021001'),
('Test Student 2', 'CS2021002', 'CS2021002'),
('Test Student 3', 'CS2021003', 'CS2021003');

-- ============================================
-- USEFUL QUERIES (for admin use)
-- ============================================

-- Dekho kaun andar hai abhi:
-- SELECT s.name, s.roll_number, se.seat_id, se.entry_time
-- FROM sessions se JOIN students s ON se.student_id = s.id
-- WHERE se.exit_time IS NULL;

-- Aaj ki poori activity:
-- SELECT s.name, se.seat_id, se.entry_time, se.exit_time
-- FROM sessions se JOIN students s ON se.student_id = s.id
-- WHERE DATE(se.entry_time) = CURDATE()
-- ORDER BY se.entry_time DESC;
