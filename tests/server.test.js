const request = require('supertest');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Mock database before requiring server
jest.mock('../database', () => ({
  pool: {
    query: jest.fn()
  },
  initDatabase: jest.fn()
}));

// Mock rate limiter to avoid 429 errors in tests
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req, res, next) => next());
});

const { pool } = require('../database');
const app = require('../server');

describe('Server API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/register', () => {
      it('should register a new user with valid credentials', async () => {
        pool.query.mockImplementation((query) => {
          if (query.includes('SELECT id FROM users WHERE email')) {
            return Promise.resolve({ rows: [] }); // No existing user
          }
          if (query.includes('INSERT INTO users')) {
            return Promise.resolve({ rows: [{ id: 1 }] });
          }
        });

        const response = await request(app)
          .post('/api/register')
          .send({
            email: 'newuser@example.com',
            password: 'SecurePassword123',
            name: 'New User'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Registration successful');
        expect(response.body).toHaveProperty('userId');
      });

      it('should reject registration with invalid email', async () => {
        const response = await request(app)
          .post('/api/register')
          .send({
            email: 'not-an-email',
            password: 'SecurePassword123',
            name: 'New User'
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });

      it('should reject registration with weak password', async () => {
        const response = await request(app)
          .post('/api/register')
          .send({
            email: 'user@example.com',
            password: 'weak',
            name: 'New User'
          });

        expect(response.status).toBe(400);
      });

      it('should reject registration with existing email', async () => {
        pool.query.mockImplementation((query) => {
          if (query.includes('SELECT id FROM users WHERE email')) {
            return Promise.resolve({ rows: [{ id: 1 }] }); // User exists
          }
        });

        const response = await request(app)
          .post('/api/register')
          .send({
            email: 'existing@example.com',
            password: 'SecurePassword123',
            name: 'New User'
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Email already registered');
      });

      it('should reject registration with missing name', async () => {
        const response = await request(app)
          .post('/api/register')
          .send({
            email: 'user@example.com',
            password: 'SecurePassword123'
          });

        expect(response.status).toBe(400);
      });
    });

    describe('POST /api/login', () => {
      it('should login with valid credentials', async () => {
        const hashedPassword = await bcrypt.hash('SecurePassword123', 10);
        
        pool.query.mockResolvedValue({
          rows: [{
            id: 1,
            email: 'user@example.com',
            password: hashedPassword,
            name: 'Test User'
          }]
        });

        const response = await request(app)
          .post('/api/login')
          .send({
            email: 'user@example.com',
            password: 'SecurePassword123'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Login successful');
      });

      it('should reject login with invalid email', async () => {
        pool.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .post('/api/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'SecurePassword123'
          });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'Invalid credentials');
      });

      it('should reject login with wrong password', async () => {
        const hashedPassword = await bcrypt.hash('CorrectPassword123', 10);
        
        pool.query.mockResolvedValue({
          rows: [{
            id: 1,
            email: 'user@example.com',
            password: hashedPassword,
            name: 'Test User'
          }]
        });

        const response = await request(app)
          .post('/api/login')
          .send({
            email: 'user@example.com',
            password: 'WrongPassword123'
          });

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/logout', () => {
      it('should logout successfully', async () => {
        const response = await request(app)
          .post('/api/logout');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Logout successful');
      });
    });

    describe('GET /api/user', () => {
      it('should return unauthorized without session', async () => {
        const response = await request(app)
          .get('/api/user');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Health Check Endpoint', () => {
    describe('GET /api/health', () => {
      it('should return healthy status when database is accessible', async () => {
        pool.query.mockResolvedValue({ rows: [[1]] });

        const response = await request(app)
          .get('/api/health');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'healthy');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('uptime');
      });

      it('should return unhealthy status when database is inaccessible', async () => {
        pool.query.mockRejectedValue(new Error('Database connection failed'));

        const response = await request(app)
          .get('/api/health');

        expect(response.status).toBe(503);
        expect(response.body).toHaveProperty('status', 'unhealthy');
      });
    });
  });

  describe('Password Reset Endpoints', () => {
    describe('POST /api/password-reset/request', () => {
      it('should generate reset token for valid email', async () => {
        pool.query.mockImplementation((query) => {
          if (query.includes('SELECT id FROM users WHERE email')) {
            return Promise.resolve({ rows: [{ id: 1 }] });
          }
          if (query.includes('INSERT INTO password_reset_tokens')) {
            return Promise.resolve({ rows: [{ id: 1 }] });
          }
        });

        const response = await request(app)
          .post('/api/password-reset/request')
          .send({ email: 'user@example.com' });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message');
      });

      it('should not reveal if email exists (security)', async () => {
        pool.query.mockResolvedValue({ rows: [] }); // No user found

        const response = await request(app)
          .post('/api/password-reset/request')
          .send({ email: 'nonexistent@example.com' });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('If email exists');
      });

      it('should reject invalid email format', async () => {
        const response = await request(app)
          .post('/api/password-reset/request')
          .send({ email: 'not-an-email' });

        expect(response.status).toBe(400);
      });
    });

    describe('POST /api/password-reset/confirm', () => {
      it('should reset password with valid token', async () => {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const futureTime = new Date(Date.now() + 3600000).toISOString();

        pool.query.mockImplementation((query) => {
          if (query.includes('SELECT id, user_id, expires_at FROM password_reset_tokens')) {
            return Promise.resolve({
              rows: [{
                id: 1,
                user_id: 1,
                expires_at: futureTime
              }]
            });
          }
          if (query.includes('UPDATE users SET password')) {
            return Promise.resolve({ rowCount: 1 });
          }
          if (query.includes('DELETE FROM password_reset_tokens')) {
            return Promise.resolve({ rowCount: 1 });
          }
        });

        const response = await request(app)
          .post('/api/password-reset/confirm')
          .send({
            token: resetToken,
            password: 'NewSecurePassword123'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Password reset successful');
      });

      it('should reject expired token', async () => {
        const expiredTime = new Date(Date.now() - 3600000).toISOString();

        pool.query.mockImplementation((query) => {
          if (query.includes('SELECT id, user_id, expires_at FROM password_reset_tokens')) {
            return Promise.resolve({
              rows: [{
                id: 1,
                user_id: 1,
                expires_at: expiredTime
              }]
            });
          }
          if (query.includes('DELETE FROM password_reset_tokens')) {
            return Promise.resolve({ rowCount: 1 });
          }
        });

        const response = await request(app)
          .post('/api/password-reset/confirm')
          .send({
            token: 'expired-token',
            password: 'NewSecurePassword123'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('expired');
      });

      it('should reject weak password', async () => {
        const response = await request(app)
          .post('/api/password-reset/confirm')
          .send({
            token: 'some-token',
            password: 'weak'
          });

        expect(response.status).toBe(400);
      });
    });
  });
});

describe('Server API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/register', () => {
      it('should register a new user with valid credentials', async () => {
        pool.query.mockImplementation((query) => {
          if (query.includes('SELECT id FROM users WHERE email')) {
            return Promise.resolve({ rows: [] }); // No existing user
          }
          if (query.includes('INSERT INTO users')) {
            return Promise.resolve({ rows: [{ id: 1 }] });
          }
        });

        const response = await request(app)
          .post('/api/register')
          .send({
            email: 'newuser@example.com',
            password: 'SecurePassword123',
            name: 'New User'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Registration successful');
        expect(response.body).toHaveProperty('userId');
      });

      it('should reject registration with invalid email', async () => {
        const response = await request(app)
          .post('/api/register')
          .send({
            email: 'not-an-email',
            password: 'SecurePassword123',
            name: 'New User'
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });

      it('should reject registration with weak password', async () => {
        const response = await request(app)
          .post('/api/register')
          .send({
            email: 'user@example.com',
            password: 'weak',
            name: 'New User'
          });

        expect(response.status).toBe(400);
      });

      it('should reject registration with existing email', async () => {
        pool.query.mockImplementation((query) => {
          if (query.includes('SELECT id FROM users WHERE email')) {
            return Promise.resolve({ rows: [{ id: 1 }] }); // User exists
          }
        });

        const response = await request(app)
          .post('/api/register')
          .send({
            email: 'existing@example.com',
            password: 'SecurePassword123',
            name: 'New User'
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Email already registered');
      });

      it('should reject registration with missing name', async () => {
        const response = await request(app)
          .post('/api/register')
          .send({
            email: 'user@example.com',
            password: 'SecurePassword123'
          });

        expect(response.status).toBe(400);
      });
    });

    describe('POST /api/login', () => {
      it('should login with valid credentials', async () => {
        const hashedPassword = await bcrypt.hash('SecurePassword123', 10);
        
        pool.query.mockResolvedValue({
          rows: [{
            id: 1,
            email: 'user@example.com',
            password: hashedPassword,
            name: 'Test User'
          }]
        });

        const response = await request(app)
          .post('/api/login')
          .send({
            email: 'user@example.com',
            password: 'SecurePassword123'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Login successful');
      });

      it('should reject login with invalid email', async () => {
        pool.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .post('/api/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'SecurePassword123'
          });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'Invalid credentials');
      });

      it('should reject login with wrong password', async () => {
        const hashedPassword = await bcrypt.hash('CorrectPassword123', 10);
        
        pool.query.mockResolvedValue({
          rows: [{
            id: 1,
            email: 'user@example.com',
            password: hashedPassword,
            name: 'Test User'
          }]
        });

        const response = await request(app)
          .post('/api/login')
          .send({
            email: 'user@example.com',
            password: 'WrongPassword123'
          });

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/logout', () => {
      it('should logout successfully', async () => {
        const response = await request(app)
          .post('/api/logout');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Logout successful');
      });
    });

    describe('GET /api/user', () => {
      it('should return unauthorized without session', async () => {
        const response = await request(app)
          .get('/api/user');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Health Check Endpoint', () => {
    describe('GET /api/health', () => {
      it('should return healthy status when database is accessible', async () => {
        pool.query.mockResolvedValue({ rows: [[1]] });

        const response = await request(app)
          .get('/api/health');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'healthy');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('uptime');
      });

      it('should return unhealthy status when database is inaccessible', async () => {
        pool.query.mockRejectedValue(new Error('Database connection failed'));

        const response = await request(app)
          .get('/api/health');

        expect(response.status).toBe(503);
        expect(response.body).toHaveProperty('status', 'unhealthy');
      });
    });
  });

  describe('Password Reset Endpoints', () => {
    describe('POST /api/password-reset/request', () => {
      it('should generate reset token for valid email', async () => {
        pool.query.mockImplementation((query) => {
          if (query.includes('SELECT id FROM users WHERE email')) {
            return Promise.resolve({ rows: [{ id: 1 }] });
          }
          if (query.includes('INSERT INTO password_reset_tokens')) {
            return Promise.resolve({ rows: [{ id: 1 }] });
          }
        });

        const response = await request(app)
          .post('/api/password-reset/request')
          .send({ email: 'user@example.com' });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message');
      });

      it('should not reveal if email exists (security)', async () => {
        pool.query.mockResolvedValue({ rows: [] }); // No user found

        const response = await request(app)
          .post('/api/password-reset/request')
          .send({ email: 'nonexistent@example.com' });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('If email exists');
      });

      it('should reject invalid email format', async () => {
        const response = await request(app)
          .post('/api/password-reset/request')
          .send({ email: 'not-an-email' });

        expect(response.status).toBe(400);
      });
    });

    describe('POST /api/password-reset/confirm', () => {
      it('should reset password with valid token', async () => {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const futureTime = new Date(Date.now() + 3600000).toISOString();

        pool.query.mockImplementation((query) => {
          if (query.includes('SELECT id, user_id, expires_at FROM password_reset_tokens')) {
            return Promise.resolve({
              rows: [{
                id: 1,
                user_id: 1,
                expires_at: futureTime
              }]
            });
          }
          if (query.includes('UPDATE users SET password')) {
            return Promise.resolve({ rowCount: 1 });
          }
          if (query.includes('DELETE FROM password_reset_tokens')) {
            return Promise.resolve({ rowCount: 1 });
          }
        });

        const response = await request(app)
          .post('/api/password-reset/confirm')
          .send({
            token: resetToken,
            password: 'NewSecurePassword123'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Password reset successful');
      });

      it('should reject expired token', async () => {
        const expiredTime = new Date(Date.now() - 3600000).toISOString();

        pool.query.mockImplementation((query) => {
          if (query.includes('SELECT id, user_id, expires_at FROM password_reset_tokens')) {
            return Promise.resolve({
              rows: [{
                id: 1,
                user_id: 1,
                expires_at: expiredTime
              }]
            });
          }
          if (query.includes('DELETE FROM password_reset_tokens')) {
            return Promise.resolve({ rowCount: 1 });
          }
        });

        const response = await request(app)
          .post('/api/password-reset/confirm')
          .send({
            token: 'expired-token',
            password: 'NewSecurePassword123'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('expired');
      });

      it('should reject weak password', async () => {
        const response = await request(app)
          .post('/api/password-reset/confirm')
          .send({
            token: 'some-token',
            password: 'weak'
          });

        expect(response.status).toBe(400);
      });
    });
  });
});
