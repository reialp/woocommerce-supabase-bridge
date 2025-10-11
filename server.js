import express from 'express';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import session from 'express-session';
import MemoryStore from 'memorystore';

const app = express();
app.use(express.json());

// Session middleware for Vercel serverless environment
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: new (MemoryStore(session))({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  cookie: {
    secure: true, // Required for Vercel
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'none', // Required for cross-origin
    httpOnly: true
  }
}));

// Your Supabase configuration
const supabaseUrl = 'https://lulmjbdvwcuzpqirsfzg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bG1qYmR2d2N1enBxaXJzZnpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA1OTUxMCwiZXhwIjoyMDc1NjM1NTEwfQ.1e4CjoUwPKrirbvm535li8Ns52lLvoryPpBTZvUSkUk';
const supabase = createClient(supabaseUrl, supabaseKey);

const PREMIUM_PRODUCT_IDS = [2860];

// Admin credentials - Using plain text password
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'marymelashouse.5';

// CORS middleware for all routes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow specific origins or all in development
  const allowedOrigins = [
    'https://woocommerce-supabase-bridge.vercel.app',
    'http://localhost:3000'
  ];
  
  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept, Authorization, X-Requested-With');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  console.log('Session check:', {
    isAuthenticated: req.session.isAuthenticated,
    sessionId: req.sessionID,
    session: req.session
  });
  
  if (req.session.isAuthenticated) {
    next();
  } else {
    console.log('Not authenticated, redirecting to login');
    // For API calls, return JSON error; for browser, redirect
    if (req.headers['content-type']?.includes('application/json')) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
    } else {
      res.redirect('/api/admin/login');
    }
  }
};

// Admin login page
app.get('/api/admin/login', (req, res) => {
  console.log('Login page accessed, session:', {
    sessionId: req.sessionID,
    isAuthenticated: req.session.isAuthenticated
  });
  
  if (req.session.isAuthenticated) {
    console.log('Already authenticated, redirecting to dashboard');
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
          }
          .btn-login:hover {
              background: #e2e8f0;
              transform: translateY(-2px);
              box-shadow: 0 8px 20px rgba(255, 255, 255, 0.2);
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
          .loading {
              display: none;
              text-align: center;
              color: #a0aec0;
              margin-top: 10px;
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
          <div id="loading" class="loading">Logging in...</div>
          
          <form id="loginForm">
              <div class="form-group">
                  <label for="username">Username</label>
                  <input type="text" id="username" name="username" required autocomplete="username">
              </div>
              <div class="form-group">
                  <label for="password">Password</label>
                  <input type="password" id="password" name="password" required autocomplete="current-password">
              </div>
              <button type="submit" class="btn-login" id="loginButton">Login</button>
          </form>
      </div>

      <script>
          document.getElementById('loginForm').addEventListener('submit', async (e) => {
              e.preventDefault();
              
              const username = document.getElementById('username').value;
              const password = document.getElementById('password').value;
              const errorMessage = document.getElementById('errorMessage');
              const loading = document.getElementById('loading');
              const loginButton = document.getElementById('loginButton');
              
              // Show loading, hide error
              errorMessage.style.display = 'none';
              loading.style.display = 'block';
              loginButton.disabled = true;
              
              try {
                  const response = await fetch('/api/admin/login', {
                      method: 'POST',
                      headers: {
                          'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ username, password }),
                      credentials: 'include' // Important for cookies
                  });
                  
                  const result = await response.json();
                  
                  if (result.success) {
                      console.log('Login successful, redirecting to dashboard');
                      // Force a hard redirect to ensure cookies are sent
                      window.location.href = '/api/admin/dashboard';
                  } else {
                      errorMessage.textContent = result.error || 'Login failed';
                      errorMessage.style.display = 'block';
                  }
              } catch (error) {
                  console.error('Login error:', error);
                  errorMessage.textContent = 'Network error. Please try again.';
                  errorMessage.style.display = 'block';
              } finally {
                  loading.style.display = 'none';
                  loginButton.disabled = false;
              }
          });

          console.log('Login page loaded');
      </script>
  </body>
  </html>
  `;
  
  res.send(html);
});

// Admin login endpoint
app.post('/api/admin/login', express.json(), async (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt for username:', username);
  console.log('Session ID:', req.sessionID);
  
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' });
  }

  try {
    // Check credentials with plain text comparison
    const isUsernameValid = username === ADMIN_USERNAME;
    const isPasswordValid = password === ADMIN_PASSWORD;
    
    if (isUsernameValid && isPasswordValid) {
      // Set session data
      req.session.isAuthenticated = true;
      req.session.username = username;
      req.session.loginTime = new Date().toISOString();
      
      console.log('Credentials valid, setting session. Session ID:', req.sessionID);
      
      // Save session and then respond
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ success: false, error: 'Session error' });
        }
        console.log('Session saved successfully, user authenticated');
        
        // Set cookie headers explicitly for Vercel
        res.setHeader('Set-Cookie', req.session.cookie.serialize('connect.sid', req.sessionID));
        
        res.json({ 
          success: true, 
          message: 'Login successful',
          sessionId: req.sessionID 
        });
      });
    } else {
      console.log('Invalid credentials attempt');
      res.status(401).json({ success: false, error: 'Invalid username or password' });
    }
  } catch (error) {
    console.error('Login processing error:', error);
    res.status(500).json({ success: false, error: 'Login processing error' });
  }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  console.log('Logout requested for session:', req.sessionID);
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    // Clear cookie
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Function to get user by email using Admin API
async function getUserByEmail(email) {
  try {
    console.log('Searching for user in Auth:', email);
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) throw new Error(`Auth API returned ${response.status}`);
    const data = await response.json();
    console.log('Auth API response received');
    return data;
  } catch (error) {
    console.error('Error in getUserByEmail:', error);
    throw error;
  }
}

// Function to check and revert expired premium users
async function checkExpiredSubscriptions() {
  try {
    const now = new Date().toISOString();
    console.log('Checking for expired premium subscriptions...');
    
    const { data: expiredUsers, error } = await supabase
      .from('user_scripts')
      .select('user_id')
      .eq('is_premium', true)
      .lt('premium_expires_at', now);

    if (error) {
      console.error('Error checking expired users:', error);
      return;
    }

    if (expiredUsers && expiredUsers.length > 0) {
      console.log(`Found ${expiredUsers.length} expired subscriptions to revert`);
      
      const userIds = expiredUsers.map(user => user.user_id);
      const { error: updateError } = await supabase
        .from('user_scripts')
        .update({ is_premium: false })
        .in('user_id', userIds);

      if (updateError) {
        console.error('Error reverting expired users:', updateError);
      } else {
        console.log(`Successfully reverted ${userIds.length} users to non-premium`);
      }
    } else {
      console.log('No expired subscriptions found');
    }
  } catch (error) {
    console.error('Error in checkExpiredSubscriptions:', error);
  }
}

// Function to get user email from Auth
async function getUserEmail(userId) {
  try {
    const { data: authUser, error } = await supabase.auth.admin.getUserById(userId);
    if (!error && authUser) {
      return authUser.user.email;
    }
    return 'Email not found';
  } catch (error) {
    return 'Error fetching email';
  }
}

// Function to manually extend subscription
async function extendSubscription(userId, days = 30) {
  try {
    const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('user_scripts')
      .update({
        premium_expires_at: newExpiry,
        is_premium: true
      })
      .eq('user_id', userId);

    return { success: !error, error };
  } catch (error) {
    return { success: false, error };
  }
}

// Function to revoke premium access
async function revokePremium(userId) {
  try {
    const { error } = await supabase
      .from('user_scripts')
      .update({
        is_premium: false
      })
      .eq('user_id', userId);

    return { success: !error, error };
  } catch (error) {
    return { success: false, error };
  }
}

// Webhook endpoint
app.post('/api/webhook', async (req, res) => {
  console.log('Webhook received from WooCommerce');
  
  try {
    const orderData = req.body;
    const customerEmail = orderData.billing?.email;
    const orderStatus = orderData.status;
    
    console.log(`Processing order #${orderData.id} for ${customerEmail}, status: ${orderStatus}`);

    const hasPremiumProduct = orderData.line_items?.some(item => 
      PREMIUM_PRODUCT_IDS.includes(item.product_id)
    );

    if (hasPremiumProduct && (orderStatus === 'completed' || orderStatus === 'processing')) {
      console.log('Premium product found - upgrading user');
      
      const authData = await getUserByEmail(customerEmail);
      if (!authData.users || authData.users.length === 0) {
        console.error('User not found in Auth:', customerEmail);
        return res.status(404).json({ error: 'User not found' });
      }

      const authUser = authData.users[0];
      console.log('Found auth user:', authUser.id);

      const { error: scriptError } = await supabase
        .from('user_scripts')
        .update({
          is_premium: true,
          premium_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('user_id', authUser.id);

      if (scriptError) {
        console.error('Supabase update error:', scriptError);
        throw scriptError;
      }

      console.log('Successfully upgraded user to premium for 30 days:', customerEmail);
      res.status(200).json({ success: true, message: 'User upgraded to premium for 30 days' });
      
    } else {
      console.log('No action needed');
      res.status(200).json({ success: true, message: 'No action needed' });
    }

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// New endpoint to manually check expirations
app.post('/api/check-expirations', requireAuth, async (req, res) => {
  console.log('Manual expiration check requested');
  await checkExpiredSubscriptions();
  res.json({ success: true, message: 'Expiration check completed' });
});

// Admin action endpoints
app.post('/api/admin/extend-subscription', requireAuth, async (req, res) => {
  try {
    const { userId, days } = req.body;
    console.log(`Extending subscription for ${userId} by ${days} days`);
    
    const result = await extendSubscription(userId, days);
    
    if (result.success) {
      res.json({ success: true, message: `Subscription extended by ${days} days` });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Extend subscription error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/api/admin/revoke-premium', requireAuth, async (req, res) => {
  try {
    const { userId } = req.body;
    console.log(`Revoking premium access for ${userId}`);
    
    const result = await revokePremium(userId);
    
    if (result.success) {
      res.json({ success: true, message: 'Premium access revoked' });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Revoke premium error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Enhanced HTML Admin Dashboard
app.get('/api/admin/dashboard', requireAuth, async (req, res) => {
  try {
    console.log('Admin: Generating enhanced dashboard HTML. Session:', {
      sessionId: req.sessionID,
      username: req.session.username
    });
    
    // Get premium users data
    const { data: premiumUsers, error } = await supabase
      .from('user_scripts')
      .select('*')
      .eq('is_premium', true)
      .order('premium_expires_at', { ascending: true });

    if (error) throw error;

    // Calculate stats
    const now = new Date();
    const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    const expiringSoon = premiumUsers.filter(user => {
      const expires = new Date(user.premium_expires_at);
      return expires > now && expires < soon;
    });

    const expiredButActive = premiumUsers.filter(user => {
      const expires = new Date(user.premium_expires_at);
      return expires < now;
    });

    // Get emails for all users
    const usersWithEmails = await Promise.all(
      premiumUsers.map(async (user) => {
        const email = await getUserEmail(user.user_id);
        return { ...user, email };
      })
    );

    // Generate enhanced HTML
    const userRows = usersWithEmails.map(user => {
      const expires = new Date(user.premium_expires_at);
      const daysRemaining = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
      const status = daysRemaining > 0 ? 'Active' : 'Expired';
      const statusClass = daysRemaining > 0 ? (daysRemaining <= 7 ? 'warning' : 'active') : 'expired';
      const statusIcon = daysRemaining > 0 ? (daysRemaining <= 7 ? '!' : '✓') : '✗';
      
      return `
        <tr class="${statusClass}" data-user-id="${user.user_id}" data-days-remaining="${daysRemaining}">
          <td>
            <div class="user-info">
              <div class="user-id">${user.user_id.substring(0, 12)}...</div>
              <div class="user-email">${user.email}</div>
            </div>
          </td>
          <td><div class="date">${expires.toLocaleDateString()}</div></td>
          <td><div class="days ${daysRemaining <= 7 ? 'warning-text' : ''}">${daysRemaining} days</div></td>
          <td><div class="status ${statusClass}">${statusIcon} ${status}</div></td>
          <td>
            <div class="actions">
              <button class="btn-extend" onclick="extendSubscription('${user.user_id}', 30)" title="Extend 30 days">
                +30d
              </button>
              <button class="btn-extend" onclick="extendSubscription('${user.user_id}', 7)" title="Extend 7 days">
                +7d
              </button>
              <button class="btn-revoke" onclick="revokePremium('${user.user_id}')" title="Revoke Premium">
                Revoke
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Inkwell Premium Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; 
                background: #0a1128;
                min-height: 100vh;
                padding: 20px;
                color: white;
            }
            .dashboard {
                max-width: 1400px;
                margin: 0 auto;
                background: rgba(13, 17, 40, 0.95);
                backdrop-filter: blur(10px);
                padding: 40px;
                border-radius: 15px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 40px;
                flex-wrap: wrap;
                gap: 20px;
            }
            .header-content h1 {
                color: #ffffff;
                font-size: 2.5em;
                margin-bottom: 10px;
            }
            .header-content p {
                color: #a0aec0;
                font-size: 1.1em;
            }
            .user-info {
                display: flex;
                align-items: center;
                gap: 15px;
                color: #ffffff;
            }
            .btn-logout {
                padding: 10px 20px;
                background: #ffffff;
                color: #0a1128;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            .btn-logout:hover {
                background: #e2e8f0;
                transform: translateY(-2px);
            }
            .controls {
                display: flex;
                gap: 15px;
                margin-bottom: 30px;
                flex-wrap: wrap;
            }
            .search-box {
                flex: 1;
                min-width: 300px;
                padding: 12px 20px;
                border: 2px solid #ffffff;
                border-radius: 10px;
                font-size: 1em;
                transition: all 0.3s ease;
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }
            .search-box:focus {
                outline: none;
                border-color: #ffffff;
                box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.2);
            }
            .search-box::placeholder {
                color: #a0aec0;
            }
            .filter-buttons {
                display: flex;
                gap: 10px;
            }
            .filter-btn {
                padding: 12px 20px;
                border: 2px solid #ffffff;
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-weight: 600;
            }
            .filter-btn:hover, .filter-btn.active {
                background: #ffffff;
                color: #0a1128;
                border-color: #ffffff;
            }
            .stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 25px;
                margin-bottom: 40px;
            }
            .stat-card {
                background: rgba(255, 255, 255, 0.1);
                padding: 30px 25px;
                border-radius: 15px;
                text-align: center;
                box-shadow: 0 8px 25px rgba(0,0,0,0.3);
                border: 2px solid #ffffff;
                transition: all 0.3s ease;
                cursor: pointer;
            }
            .stat-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 15px 35px rgba(255, 255, 255, 0.2);
                border-color: #ffffff;
            }
            .stat-number {
                font-size: 3em;
                font-weight: 800;
                margin-bottom: 10px;
                color: #ffffff;
            }
            .stat-label {
                color: #a0aec0;
                font-size: 1em;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .users-table {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 15px;
                overflow: hidden;
                box-shadow: 0 8px 25px rgba(0,0,0,0.3);
                border: 2px solid #ffffff;
                overflow-x: auto;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                min-width: 800px;
            }
            th {
                background: linear-gradient(135deg, #ffffff, #f0f0f0);
                color: #0a1128;
                padding: 20px 15px;
                text-align: left;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-size: 0.9em;
                border-bottom: 2px solid #ffffff;
            }
            td {
                padding: 18px 15px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                color: #e2e8f0;
            }
            tr:last-child td {
                border-bottom: none;
            }
            tr:hover {
                background: rgba(255, 255, 255, 0.05);
            }
            .user-info {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .user-id {
                font-family: 'Monaco', 'Consolas', monospace;
                font-size: 0.9em;
                color: #ffffff;
                font-weight: 600;
            }
            .user-email {
                font-size: 0.8em;
                color: #a0aec0;
            }
            .date {
                color: #e2e8f0;
                font-weight: 500;
            }
            .days {
                font-weight: 600;
                font-size: 1.1em;
                color: #e2e8f0;
            }
            .warning-text {
                color: #ff6b6b;
                animation: pulse 2s infinite;
                font-weight: 700;
            }
            .status {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 600;
                font-size: 0.9em;
            }
            .status.active {
                background: rgba(104, 211, 145, 0.2);
                color: #68d391;
                border: 1px solid #68d391;
            }
            .status.warning {
                background: rgba(246, 224, 94, 0.2);
                color: #f6e05e;
                border: 1px solid #f6e05e;
            }
            .status.expired {
                background: rgba(252, 129, 129, 0.2);
                color: #fc8181;
                border: 1px solid #fc8181;
            }
            .actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            .btn-extend, .btn-revoke {
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.8em;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            .btn-extend {
                background: #ffffff;
                color: #0a1128;
                border: 1px solid #ffffff;
            }
            .btn-extend:hover {
                background: #e2e8f0;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(255, 255, 255, 0.4);
            }
            .btn-revoke {
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
                border: 1px solid #ffffff;
            }
            .btn-revoke:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
            }
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 25px;
                border-radius: 10px;
                color: white;
                font-weight: 600;
                z-index: 1000;
                opacity: 0;
                transform: translateX(100px);
                transition: all 0.3s ease;
            }
            .notification.success {
                background: #22543d;
                color: #68d391;
                opacity: 1;
                transform: translateX(0);
                border: 2px solid #38a169;
            }
            .notification.error {
                background: #742a2a;
                color: #fc8181;
                opacity: 1;
                transform: translateX(0);
                border: 2px solid #e53e3e;
            }
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.7; }
                100% { opacity: 1; }
            }
            .last-updated {
                text-align: center;
                margin-top: 30px;
                color: #a0aec0;
                font-size: 0.9em;
            }
            .last-updated a {
                color: #ffffff;
                text-decoration: none;
                font-weight: 600;
            }
            .last-updated a:hover {
                color: #e2e8f0;
                text-decoration: underline;
            }
            @media (max-width: 768px) {
                body { padding: 10px; }
                .dashboard { padding: 20px; }
                .header { flex-direction: column; text-align: center; }
                .header h1 { font-size: 2em; }
                .stat-number { font-size: 2.5em; }
                th, td { padding: 12px 8px; }
                .controls { flex-direction: column; }
                .search-box { min-width: auto; }
            }
        </style>
    </head>
    <body>
        <div class="dashboard">
            <div class="header">
                <div class="header-content">
                    <h1>Inkwell Premium Dashboard</h1>
                    <p>Manage and monitor your premium subscribers</p>
                </div>
                <div class="user-info">
                    <span>Welcome, ${req.session.username}</span>
                    <button class="btn-logout" onclick="logout()">Logout</button>
                </div>
            </div>
            
            <div class="controls">
                <input type="text" id="searchInput" class="search-box" placeholder="Search by user ID or email..." onkeyup="filterTable()">
                <div class="filter-buttons">
                    <button class="filter-btn active" onclick="filterTable('all')">All</button>
                    <button class="filter-btn" onclick="filterTable('active')">Active</button>
                    <button class="filter-btn" onclick="filterTable('warning')">Expiring Soon</button>
                    <button class="filter-btn" onclick="filterTable('expired')">Expired</button>
                </div>
            </div>
            
            <div class="stats">
                <div class="stat-card" onclick="filterTable('all')">
                    <div class="stat-number">${premiumUsers.length}</div>
                    <div class="stat-label">Total Premium Users</div>
                </div>
                <div class="stat-card" onclick="filterTable('warning')">
                    <div class="stat-number">${expiringSoon.length}</div>
                    <div class="stat-label">Expiring Soon (7 days)</div>
                </div>
                <div class="stat-card" onclick="filterTable('expired')">
                    <div class="stat-number">${expiredButActive.length}</div>
                    <div class="stat-label">Expired But Active</div>
                </div>
            </div>
            
            <div class="users-table">
                <table id="usersTable">
                    <thead>
                        <tr>
                            <th>User Info</th>
                            <th>Expires On</th>
                            <th>Days Left</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${userRows}
                    </tbody>
                </table>
            </div>
            
            <div class="last-updated">
                Last updated: ${now.toLocaleString()} | 
                <a href="#" onclick="location.reload()">Refresh</a> | 
                <a href="/api/check-expirations" target="_blank">Check Expirations</a>
            </div>
        </div>

        <div id="notification" class="notification"></div>

        <script>
            function filterTable(filter = 'all') {
                const searchTerm = document.getElementById('searchInput').value.toLowerCase();
                const rows = document.querySelectorAll('#usersTable tbody tr');
                const filterButtons = document.querySelectorAll('.filter-btn');
                
                filterButtons.forEach(btn => btn.classList.remove('active'));
                event?.target.classList.add('active');
                
                rows.forEach(row => {
                    const userId = row.getAttribute('data-user-id').toLowerCase();
                    const daysRemaining = parseInt(row.getAttribute('data-days-remaining'));
                    const email = row.querySelector('.user-email').textContent.toLowerCase();
                    const text = userId + ' ' + email;
                    
                    let statusMatch = true;
                    if (filter === 'active') statusMatch = daysRemaining > 7;
                    else if (filter === 'warning') statusMatch = daysRemaining <= 7 && daysRemaining > 0;
                    else if (filter === 'expired') statusMatch = daysRemaining <= 0;
                    
                    const searchMatch = text.includes(searchTerm);
                    
                    row.style.display = (statusMatch && searchMatch) ? '' : 'none';
                });
            }

            function showNotification(message, type = 'success') {
                const notification = document.getElementById('notification');
                notification.textContent = message;
                notification.className = 'notification ' + type;
                
                setTimeout(() => {
                    notification.className = 'notification';
                }, 3000);
            }

            async function extendSubscription(userId, days) {
                if (!confirm('Extend subscription for ' + days + ' days?')) return;
                
                try {
                    const response = await fetch('/api/admin/extend-subscription', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, days }),
                        credentials: 'include'
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        showNotification('Subscription extended by ' + days + ' days!');
                        setTimeout(() => location.reload(), 1000);
                    } else {
                        showNotification('Error: ' + result.error, 'error');
                    }
                } catch (error) {
                    showNotification('Network error', 'error');
                }
            }

            async function revokePremium(userId) {
                if (!confirm('Revoke premium access for this user?')) return;
                
                try {
                    const response = await fetch('/api/admin/revoke-premium', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId }),
                        credentials: 'include'
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        showNotification('Premium access revoked!');
                        setTimeout(() => location.reload(), 1000);
                    } else {
                        showNotification('Error: ' + result.error, 'error');
                    }
                } catch (error) {
                    showNotification('Network error', 'error');
                }
            }

            async function logout() {
                try {
                    const response = await fetch('/api/admin/logout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include'
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        window.location.href = '/api/admin/login';
                    } else {
                        showNotification('Logout failed', 'error');
                    }
                } catch (error) {
                    showNotification('Network error', 'error');
                }
            }

            document.getElementById('searchInput').addEventListener('input', filterTable);
        </script>
    </body>
    </html>
    `;

    res.send(html);
    
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('<h1>Error loading dashboard</h1><p>Please try again later.</p>');
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', service: 'WooCommerce-Supabase Bridge' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Webhook endpoint: http://localhost:3000/api/webhook`);
  console.log(`Expiration check: http://localhost:3000/api/check-expirations`);
  console.log(`Admin dashboard: http://localhost:3000/api/admin/dashboard`);
  console.log(`Admin login: http://localhost:3000/api/admin/login`);
});
