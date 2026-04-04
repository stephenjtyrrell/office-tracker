require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const PgSession = require('connect-pg-simple')(session);
const { pool, initDatabase } = require('./database');
const { getWorkingDays, formatDate, getIrishPublicHolidays } = require('./calendar');

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Debug logging helper - only log in non-production environments
const debugLog = (...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

// Validate required environment variables
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = ['SESSION_SECRET', 'DATABASE_URL'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missing.length > 0) {
    console.error(`ERROR: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (process.env.SESSION_SECRET === 'your-secret-key') {
    console.error('ERROR: SESSION_SECRET must be changed from default value in production');
    process.exit(1);
  }
}

// Clean up expired password reset tokens every hour
function startTokenCleanupJob() {
  setInterval(async () => {
    try {
      const result = await pool.query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()');
      if (result.rowCount > 0) {
        debugLog(`[CLEANUP] Removed ${result.rowCount} expired password reset tokens`);
      }
    } catch (error) {
      console.error('Token cleanup error:', error);
    }
  }, 60 * 60 * 1000);
}

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
  // Development mode - use a relaxed CSP instead of disabling it entirely
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "http://localhost:*", "https://localhost:*"],
        styleSrc: ["'self'", "'unsafe-inline'", "http://localhost:*", "https://localhost:*"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws://localhost:*", "wss://localhost:*", "http://localhost:*", "https://localhost:*"],
      },
    },
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
  store: new PgSession({
    pool,
    createTableIfMissing: true,
    ttl: 24 * 60 * 60
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Apply API rate limiting to all API routes
app.use('/api', apiLimiter);

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

function getMonthStartDate(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
}

function getNextMonthStartDate(year, monthIndex) {
  const nextMonthIndex = (monthIndex + 1) % 12;
  const nextYear = monthIndex === 11 ? year + 1 : year;
  return `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-01`;
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
    debugLog('[REGISTER] Registering user:', email);

    // Check if user exists
    const existingUserResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUserResult.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    debugLog('[REGISTER] Password hashed, length:', hashedPassword.length);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id',
      [email, hashedPassword, name]
    );
    const userId = result.rows[0].id;
    debugLog('[REGISTER] User inserted with ID:', userId);

    req.session.userId = userId;
    res.json({ message: 'Registration successful', userId });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.password) {
      console.error('[LOGIN] User has no password hash:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.error('[LOGIN] Password mismatch for:', email);
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
app.get('/api/user', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [req.session.userId]);
  res.json(result.rows[0]);
});

// Get app version
app.get('/api/version', (req, res) => {
  try {
    const version = fs.readFileSync(path.join(__dirname, 'VERSION'), 'utf8').trim();
    res.json({ version });
  } catch (error) {
    res.json({ version: 'unknown' });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      error: 'Database connection failed' 
    });
  }
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
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];
    if (!user) {
      // Don't reveal if email exists for security
      return res.json({ message: 'If email exists, reset token has been sent' });
    }

    // Generate token (valid for 1 hour)
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Store token
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    res.json({ message: 'Reset token generated', token });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Failed to process request' });
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
    debugLog('[PASSWORD RESET CONFIRM] Received token length:', token?.length);
    debugLog('[PASSWORD RESET CONFIRM] Token preview:', token?.substring(0, 10) + '...');

    const resetRecordResult = await pool.query(
      'SELECT id, user_id, expires_at FROM password_reset_tokens WHERE token = $1',
      [token]
    );
    const resetRecord = resetRecordResult.rows[0];

    debugLog('[PASSWORD RESET CONFIRM] Found record:', !!resetRecord);
    
    if (!resetRecord) {
      // Check how many tokens exist
      const tokenCountResult = await pool.query('SELECT COUNT(*) as count FROM password_reset_tokens');
      debugLog('[PASSWORD RESET CONFIRM] Total tokens in DB:', tokenCountResult.rows[0].count);
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    debugLog('[PASSWORD RESET CONFIRM] Token expires at:', resetRecord.expires_at, 'Current time:', new Date().toISOString());

    if (new Date(resetRecord.expires_at) < new Date()) {
      debugLog('[PASSWORD RESET CONFIRM] Token expired');
      await pool.query('DELETE FROM password_reset_tokens WHERE id = $1', [resetRecord.id]);
      return res.status(400).json({ error: 'Token has expired' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password and delete token
    const updateResult = await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, resetRecord.user_id]
    );
    debugLog('[PASSWORD RESET CONFIRM] Update result:', updateResult.rowCount, 'rows updated for user:', resetRecord.user_id);

    await pool.query('DELETE FROM password_reset_tokens WHERE id = $1', [resetRecord.id]);

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Password reset confirm error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ===== Office Days Routes =====

// Get month summary
app.get('/api/summary/:year/:month', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month) - 1; // JS months are 0-indexed
    const userId = req.session.userId;

    debugLog(`[SUMMARY] Loading for userId: ${userId}, year: ${year}, month: ${month + 1}`);

    // Get working days for the month
    const workingDays = getWorkingDays(year, month);
    const totalWorkingDays = workingDays.length;
    const requiredOfficeDays = Math.ceil(totalWorkingDays * 0.5);

    // Get annual leave days for this month
    const monthStart = getMonthStartDate(year, month);
    const nextMonthStart = getNextMonthStartDate(year, month);

    const annualLeaveDaysResult = await pool.query(
      'SELECT date FROM annual_leave WHERE user_id = $1 AND date >= $2 AND date < $3 ORDER BY date',
      [userId, monthStart, nextMonthStart]
    );
    const annualLeaveDays = annualLeaveDaysResult.rows;

    // Get office days for this month
    const officeDaysResult = await pool.query(
      'SELECT date FROM office_days WHERE user_id = $1 AND date >= $2 AND date < $3 ORDER BY date',
      [userId, monthStart, nextMonthStart]
    );
    const officeDays = officeDaysResult.rows;

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

    debugLog(`[SUMMARY] Success: days=${totalWorkingDays}, leave=${annualLeaveDays.length}, office=${officeDaysCount}`);

    res.json({
      year,
      month: month + 1,
      totalWorkingDays,
      annualLeaveDays: annualLeaveDays.length,
      actualWorkingDays,
      requiredOfficeDays: adjustedRequiredDays,
      officeDaysCompleted: officeDaysCount,
      balance,
      officeDates: officeDays.map(d => formatDate(new Date(d.date))),
      annualLeaveDates: annualLeaveDays.map(d => formatDate(new Date(d.date))),
      publicHolidayDates
    });
  } catch (error) {
    console.error('[SUMMARY] Error:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

// Log office day
app.post('/api/office-day', requireAuth, async (req, res) => {
  try {
    const { date } = req.body;
    const userId = req.session.userId;

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    await pool.query(
      'INSERT INTO office_days (user_id, date) VALUES ($1, $2) ON CONFLICT (user_id, date) DO NOTHING',
      [userId, date]
    );
    res.json({ message: 'Office day logged' });
  } catch (error) {
    console.error('Office day error:', error);
    res.status(500).json({ error: 'Failed to log office day' });
  }
});

// Remove office day
app.delete('/api/office-day/:date', requireAuth, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.session.userId;

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    await pool.query('DELETE FROM office_days WHERE user_id = $1 AND date = $2', [userId, date]);
    res.json({ message: 'Office day removed' });
  } catch (error) {
    console.error('Delete office day error:', error);
    res.status(500).json({ error: 'Failed to remove office day' });
  }
});

// ===== Annual Leave Routes =====

// Add annual leave
app.post('/api/annual-leave', requireAuth, async (req, res) => {
  try {
    const { date } = req.body;
    const userId = req.session.userId;

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    await pool.query(
      'INSERT INTO annual_leave (user_id, date) VALUES ($1, $2) ON CONFLICT (user_id, date) DO NOTHING',
      [userId, date]
    );
    res.json({ message: 'Annual leave added' });
  } catch (error) {
    console.error('Annual leave error:', error);
    res.status(500).json({ error: 'Failed to add annual leave' });
  }
});

// Remove annual leave
app.delete('/api/annual-leave/:date', requireAuth, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.session.userId;

    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    await pool.query('DELETE FROM annual_leave WHERE user_id = $1 AND date = $2', [userId, date]);
    res.json({ message: 'Annual leave removed' });
  } catch (error) {
    console.error('Delete annual leave error:', error);
    res.status(500).json({ error: 'Failed to remove annual leave' });
  }
});

// Start server
async function startServer() {
  await initDatabase();
  startTokenCleanupJob();

  app.listen(PORT, () => {
    debugLog(`Server running on http://localhost:${PORT}`);
  });
}

// Only start server if not in test environment and this is the main module
if (process.env.NODE_ENV !== 'test' && require.main === module) {
  startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

// Export for testing
module.exports = app;
