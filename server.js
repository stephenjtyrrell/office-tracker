require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const SqliteStore = require('better-sqlite3-session-store')(session);
const { db, initDatabase } = require('./database');
const { getWorkingDays, formatDate, getIrishPublicHolidays } = require('./calendar');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initDatabase();

// Security headers - relaxed for local development
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));
} else {
  // Development mode - disable CSP for local testing
  app.use(helmet({
    contentSecurityPolicy: false,
  }));
}

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  store: new SqliteStore({
    client: db,
    expired: {
      clear: true,
      intervalMs: 900000 // 15 minutes
    }
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// ===== Utility Functions =====

function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString + 'T00:00:00');
  return date instanceof Date && !isNaN(date);
}

// ===== Authentication Routes =====

// Register
app.post('/api/register', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password, name } = req.body;

    // Check if user exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(email, hashedPassword, name);

    req.session.userId = result.lastInsertRowid;
    res.json({ message: 'Registration successful', userId: result.lastInsertRowid });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Regenerate session to prevent fixation attacks
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    req.session.userId = user.id;
    res.json({ message: 'Login successful', userId: user.id, name: user.name });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout successful' });
});

// Get current user
app.get('/api/user', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.session.userId);
  res.json(user);
});

// ===== Password Reset Routes =====

// Utility function to generate reset token
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Request password reset
app.post('/api/password-reset/request', authLimiter, [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    const { email } = req.body;
    
    // Check if user exists
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!user) {
      // Don't reveal if email exists for security
      return res.json({ message: 'If email exists, reset token has been sent' });
    }

    // Generate token (valid for 1 hour)
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Store token
    db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)')
      .run(user.id, token, expiresAt);

    res.json({ message: 'Reset token generated', token });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Validate reset token
app.post('/api/password-reset/validate', [
  body('token').notEmpty().withMessage('Token required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { token } = req.body;

    const resetRecord = db.prepare(
      'SELECT id, user_id, expires_at FROM password_reset_tokens WHERE token = ?'
    ).get(token);

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      // Delete expired token
      db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(resetRecord.id);
      return res.status(400).json({ error: 'Token has expired' });
    }

    res.json({ message: 'Token is valid', userId: resetRecord.user_id });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ error: 'Failed to validate token' });
  }
});

// Reset password with token
app.post('/api/password-reset/confirm', [
  body('token').notEmpty().withMessage('Token required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { token, password } = req.body;

    const resetRecord = db.prepare(
      'SELECT id, user_id, expires_at FROM password_reset_tokens WHERE token = ?'
    ).get(token);

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(resetRecord.id);
      return res.status(400).json({ error: 'Token has expired' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password and delete token
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, resetRecord.user_id);
    db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(resetRecord.id);

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Password reset confirm error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ===== Office Days Routes =====

// Get month summary
app.get('/api/summary/:year/:month', requireAuth, (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month) - 1; // JS months are 0-indexed
    const userId = req.session.userId;

    console.log(`[SUMMARY] Loading for userId: ${userId}, year: ${year}, month: ${month + 1}`);

    // Get working days for the month
    const workingDays = getWorkingDays(year, month);
    const totalWorkingDays = workingDays.length;
    const requiredOfficeDays = Math.ceil(totalWorkingDays * 0.5);

    // Get annual leave days for this month
    const annualLeaveDays = db.prepare(`
      SELECT date FROM annual_leave 
      WHERE user_id = ? AND date LIKE ?
    `).all(userId, `${year}-${String(month + 1).padStart(2, '0')}%`);

    // Get office days for this month
    const officeDays = db.prepare(`
      SELECT date FROM office_days 
      WHERE user_id = ? AND date LIKE ?
    `).all(userId, `${year}-${String(month + 1).padStart(2, '0')}%`);

    // Calculate working days excluding annual leave
    const annualLeaveDates = new Set(annualLeaveDays.map(d => d.date));
    const actualWorkingDays = totalWorkingDays - annualLeaveDays.length;
    const adjustedRequiredDays = Math.ceil(actualWorkingDays * 0.5);

    const officeDaysCount = officeDays.length;
    const balance = officeDaysCount - adjustedRequiredDays;

    // Get public holidays for this month
    const publicHolidays = getIrishPublicHolidays(year);
    const publicHolidayDates = publicHolidays
      .filter(holiday => holiday.getMonth() === month)
      .map(holiday => formatDate(holiday));

    console.log(`[SUMMARY] Success: days=${totalWorkingDays}, leave=${annualLeaveDays.length}, office=${officeDaysCount}`);

    res.json({
      year,
      month: month + 1,
      totalWorkingDays,
      annualLeaveDays: annualLeaveDays.length,
      actualWorkingDays,
      requiredOfficeDays: adjustedRequiredDays,
      officeDaysCompleted: officeDaysCount,
      balance,
      officeDates: officeDays.map(d => d.date),
      annualLeaveDates: annualLeaveDays.map(d => d.date),
      publicHolidayDates
    });
  } catch (error) {
    console.error('[SUMMARY] Error:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

// Log office day
app.post('/api/office-day', requireAuth, apiLimiter, (req, res) => {
  try {
    const { date } = req.body;
    const userId = req.session.userId;

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    db.prepare('INSERT OR IGNORE INTO office_days (user_id, date) VALUES (?, ?)').run(userId, date);
    res.json({ message: 'Office day logged' });
  } catch (error) {
    console.error('Office day error:', error);
    res.status(500).json({ error: 'Failed to log office day' });
  }
});

// Remove office day
app.delete('/api/office-day/:date', requireAuth, apiLimiter, (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.session.userId;

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    db.prepare('DELETE FROM office_days WHERE user_id = ? AND date = ?').run(userId, date);
    res.json({ message: 'Office day removed' });
  } catch (error) {
    console.error('Delete office day error:', error);
    res.status(500).json({ error: 'Failed to remove office day' });
  }
});

// ===== Annual Leave Routes =====

// Add annual leave
app.post('/api/annual-leave', requireAuth, apiLimiter, (req, res) => {
  try {
    const { date } = req.body;
    const userId = req.session.userId;

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    db.prepare('INSERT OR IGNORE INTO annual_leave (user_id, date) VALUES (?, ?)').run(userId, date);
    res.json({ message: 'Annual leave added' });
  } catch (error) {
    console.error('Annual leave error:', error);
    res.status(500).json({ error: 'Failed to add annual leave' });
  }
});

// Remove annual leave
app.delete('/api/annual-leave/:date', requireAuth, apiLimiter, (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.session.userId;

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    db.prepare('DELETE FROM annual_leave WHERE user_id = ? AND date = ?').run(userId, date);
    res.json({ message: 'Annual leave removed' });
  } catch (error) {
    console.error('Delete annual leave error:', error);
    res.status(500).json({ error: 'Failed to remove annual leave' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
