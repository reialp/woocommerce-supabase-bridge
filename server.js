import express from 'express';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import bcrypt from 'bcryptjs';
import session from 'express-session';

const app = express();

// 🚨 CRITICAL FIX: Add trust proxy for Vercel deployment
app.set('trust proxy', 1);

app.use(express.json());

// Session middleware for admin authentication - UPDATED for Vercel
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
  resave: false, // Changed to false - better for production
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Dynamic based on environment
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Dynamic sameSite
    httpOnly: true // Added for security
  },
  proxy: true // Required for Vercel
}));

// Your Supabase configuration
const supabaseUrl = 'https://lulmjbdvwcuzpqirsfzg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bG1qYmR2d2N1enBxaXJzZnpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA1OTUxMCwiZXhwIjoyMDc1NjM1NTEwfQ.1e4CjoUwPKrirbvm535li8Ns52lLvoryPpBTZvUSkUk';
const supabase = createClient(supabaseUrl, supabaseKey);

const PREMIUM_PRODUCT_IDS = [2860];

// Admin credentials - Use environment variables only
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2a$10$8V/7.9qg5s6d4r3e2w1y0u7i8o9p0a1s2d3f4g5h6j7k8l9m0n1o2p3';

// Enhanced middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  console.log('🔐 Session check:', { 
    isAuthenticated: req.session.isAuthenticated,
    username: req.session.username,
    sessionId: req.sessionID 
  });
  
  if (req.session.isAuthenticated && req.session.username) {
    next();
  } else {
    console.log('❌ Not authenticated, redirecting to login');
    res.redirect('/api/admin/login');
  }
};

// Admin login page
app.get('/api/admin/login', (req, res) => {
  console.log('🔐 Login page accessed - session status:', req.session.isAuthenticated);
  
  if (req.session.isAuthenticated) {
    console.log('✅ Already authenticated, redirecting to dashboard');
    return res.redirect('/api/admin/dashboard');
  }

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
      <title>Admin Login - Inkwell Dashboard</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
              font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; 
              background: #0a1128;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
          }
          .login-container {
              background: rgba(13, 17, 40, 0.95);
              backdrop-filter: blur(10px);
              padding: 40px;
              border-radius: 15px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.3);
              border: 1px solid rgba(255, 255, 255, 0.2);
              width: 100%;
              max-width: 400px;
          }
          .logo {
              text-align: center;
              margin-bottom: 30px;
          }
          .logo h1 {
              color: #ffffff;
              font-size: 2em;
              margin-bottom: 10px;
          }
          .logo p {
              color: #a0aec0;
              font-size: 1em;
          }
          .form-group {
              margin-bottom: 20px;
          }
          label {
              display: block;
              margin-bottom: 8px;
              color: #e2e8f0;
              font-weight: 600;
          }
          input[type="text"],
          input[type="password"] {
              width: 100%;
              padding: 12px 16px;
              border: 2px solid #2d3748;
              border-radius: 8px;
              font-size: 1em;
              background: #1a202c;
              color: white;
              transition: all 0.3s ease;
          }
          input[type="text"]:focus,
          input[type="password"]:focus {
              outline: none;
              border-color: #ffffff;
              box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
          }
          .btn-login {
              width: 100%;
              padding: 12px;
              background: #ffffff;
              color: #0a1128;
              border: none;
              border-radius: 8px;
              font-size: 1em;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
              position: relative;
          }
          .btn-login:disabled {
              opacity: 0.7;
              cursor: not-allowed;
          }
          .btn-login:hover:not(:disabled) {
              background: #e2e8f0;
              transform: translateY(-2px);
              box-shadow: 0 8px 20px rgba(255, 255, 255, 0.2);
          }
          .loading-spinner {
              display: none;
              width: 20px;
              height: 20px;
              border: 2px solid transparent;
              border-top: 2px solid #0a1128;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 0 auto;
          }
          .btn-login.loading .loading-spinner {
              display: block;
          }
          .btn-login.loading .btn-text {
              display: none;
          }
          .error-message {
              background: #742a2a;
              color: #fc8181;
              padding: 12px;
              border-radius: 8px;
              margin-bottom: 20px;
              border: 1px solid #e53e3e;
              display: none;
          }
          .success-message {
              background: #22543d;
              color: #68d391;
              padding: 12px;
              border-radius: 8px;
              margin-bottom: 20px;
              border: 1px solid #38a169;
              display: none;
          }
          @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
          }
      </style>
  </head>
  <body>
      <div class="login-container">
          <div class="logo">
              <h1>Inkwell</h1>
              <p>Admin Dashboard Login</p>
          </div>
          
          <div id="errorMessage" class="error-message"></div>
          <div id="successMessage" class="success-message"></div>
          
          <form id="loginForm">
              <div class="form-group">
                  <label for="username">Username</label>
                  <input type="text" id="username" name="username" required>
              </div>
              <div class="form-group">
                  <label for="password">Password</label>
                  <input type="password" id="password" name="password" required>
              </div>
              <button type="submit" class="btn-login" id="loginButton">
                  <span class="btn-text">Login</span>
                  <div class="loading-spinner"></div>
              </button>
          </form>
      </div>

      <script>
          document.getElementById('loginForm').addEventListener('submit', async (e) => {
              e.preventDefault();
              
              const username = document.getElementById('username').value;
              const password = document.getElementById('password').value;
              const errorMessage = document.getElementById('errorMessage');
              const successMessage = document.getElementById('successMessage');
              const loginButton = document.getElementById('loginButton');
              
              // Show loading state
              loginButton.disabled = true;
              loginButton.classList.add('loading');
              errorMessage.style.display = 'none';
              successMessage.style.display = 'none';
              
              try {
                  console.log('🔐 Attempting login for:', username);
                  
                  const response = await fetch('/api/admin/login', {
                      method: 'POST',
                      headers: {
                          'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ username, password }),
                      credentials: 'include' // Important for cookies
                  });
                  
                  const result = await response.json();
                  console.log('🔐 Login response:', result);
                  
                  if (result.success) {
                      successMessage.textContent = 'Login successful! Redirecting...';
                      successMessage.style.display = 'block';
                      console.log('✅ Login successful, redirecting to dashboard...');
                      
                      // Wait a moment to show success message then redirect
                      setTimeout(() => {
                          window.location.href = '/api/admin/dashboard';
                      }, 1000);
                  } else {
                      errorMessage.textContent = result.error || 'Login failed';
                      errorMessage.style.display = 'block';
                      console.error('❌ Login failed:', result.error);
                  }
              } catch (error) {
                  errorMessage.textContent = 'Network error. Please try again.';
                  errorMessage.style.display = 'block';
                  console.error('❌ Network error:', error);
              } finally {
                  loginButton.disabled = false;
                  loginButton.classList.remove('loading');
              }
          });
      </script>
  </body>
  </html>
  `;
  
  res.send(html);
});

// Enhanced admin login endpoint with better error handling
app.post('/api/admin/login', express.json(), async (req, res) => {
  const { username, password } = req.body;
  
  console.log('🔐 Login attempt received:', { username, hasPassword: !!password });
  console.log('🔐 Session at start:', req.sessionID);
  
  try {
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    // Verify credentials using bcrypt comparison :cite[2]:cite[7]
    const isAuthenticated = username === ADMIN_USERNAME && await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    
    if (isAuthenticated) {
      req.session.isAuthenticated = true;
      req.session.username = username;
      req.session.loginTime = new Date().toISOString();
      
      console.log('✅ Credentials valid, setting session for user:', username);
      
      // Save session explicitly
      req.session.save((err) => {
        if (err) {
          console.error('❌ Session save error:', err);
          return res.status(500).json({ success: false, error: 'Session error' });
        }
        console.log('✅ Session saved successfully for user:', username);
        console.log('🔐 Session after save:', req.session);
        res.json({ success: true, message: 'Login successful' });
      });
    } else {
      console.log('❌ Invalid credentials attempt for user:', username);
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ success: false, error: 'Login error' });
  }
});

// Session check endpoint for debugging
app.get('/api/admin/session-status', (req, res) => {
  res.json({
    isAuthenticated: req.session.isAuthenticated,
    username: req.session.username,
    sessionId: req.sessionID,
    loginTime: req.session.loginTime
  });
});

// [Keep all your existing functions and routes below exactly as they were]
// Admin logout, getUserByEmail, checkExpiredSubscriptions, getUserEmail, 
// extendSubscription, revokePremium, webhook, dashboard, etc.

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  console.log('🔐 Logout requested for user:', req.session.username);
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ Logout error:', err);
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    console.log('✅ Logout successful');
    res.json({ success: true });
  });
});

// Keep all your existing functions exactly as they were:
// getUserByEmail, checkExpiredSubscriptions, getUserEmail, 
// extendSubscription, revokePremium, webhook, dashboard routes, etc.

// Your existing functions remain unchanged below this line
// ... [ALL YOUR EXISTING FUNCTIONS AND ROUTES] ...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎉 Server running on http://localhost:${PORT}`);
  console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/api/webhook`);
  console.log(`📊 Expiration check: http://localhost:${PORT}/api/check-expirations`);
  console.log(`👨‍💼 Admin dashboard: http://localhost:${PORT}/api/admin/dashboard`);
  console.log(`🔐 Admin login: http://localhost:${PORT}/api/admin/login`);
  console.log(`🔍 Session check: http://localhost:${PORT}/api/admin/session-status`);
  console.log(`\n✅ Enhanced session configuration applied:`);
  console.log(`   ✅ Trust proxy enabled for Vercel`);
  console.log(`   ✅ Dynamic secure cookies (production: true, development: false)`);
  console.log(`   ✅ Enhanced error handling and debugging`);
});

export default app;
