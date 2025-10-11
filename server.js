import express from 'express';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import cookie from 'cookie';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Your Supabase configuration
const supabaseUrl = 'https://lulmjbdvwcuzpqirsfzg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bG1qYmR2d2N1enBxaXJzZnpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA1OTUxMCwiZXhwIjoyMDc1NjM1NTEwfQ.1e4CjoUwPKrirbvm535li8Ns52lLvoryPpBTZvUSkUk';
const supabase = createClient(supabaseUrl, supabaseKey);

const PREMIUM_PRODUCT_IDS = [2860];

// Admin credentials
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'marymelashouse.5';
const AUTH_SECRET = process.env.AUTH_SECRET || 'nl4WEU1YgLPzt7vO9Vih5RS3G6NXB0McueaHxQKpF8fk2drDJyqwCAmIjsToZb';

// Simple authentication middleware
const requireAuth = (req, res, next) => {
  try {
    const authCookie = req.cookies?.admin_auth;
    if (authCookie) {
      const [username, token] = authCookie.split(':');
      const expectedToken = crypto.createHash('sha256').update(username + AUTH_SECRET).digest('hex');
      
      if (token === expectedToken && username === ADMIN_USERNAME) {
        req.user = { username };
        return next();
      }
    }
  } catch (error) {
    console.log('Auth error:', error);
  }
  
  console.log('Not authenticated, redirecting to login');
  res.redirect('/api/admin/login');
};

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin?.includes('vercel.app') || origin?.includes('localhost')) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Parse cookies middleware
app.use((req, res, next) => {
  req.cookies = cookie.parse(req.headers.cookie || '');
  next();
});

// Root route
app.get('/', (req, res) => {
  res.redirect('/api/admin/login');
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', service: 'WooCommerce-Supabase Bridge' });
});

// Login page (same as before - keep your working login code)
app.get('/api/admin/login', (req, res) => {
  // Check if already authenticated
  try {
    const authCookie = req.cookies?.admin_auth;
    if (authCookie) {
      const [username, token] = authCookie.split(':');
      const expectedToken = crypto.createHash('sha256').update(username + AUTH_SECRET).digest('hex');
      
      if (token === expectedToken && username === ADMIN_USERNAME) {
        return res.redirect('/api/admin/dashboard');
      }
    }
  } catch (error) {
    // Continue to login page
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
                  <input type="text" id="username" name="username" required autocomplete="username" value="admin">
              </div>
              <div class="form-group">
                  <label for="password">Password</label>
                  <input type="password" id="password" name="password" required autocomplete="current-password" value="marymelashouse.5">
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
                      credentials: 'include'
                  });
                  
                  const result = await response.json();
                  
                  if (result.success) {
                      console.log('Login successful, redirecting to dashboard');
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
      </script>
  </body>
  </html>
  `;
  
  res.send(html);
});

// Login endpoint (same as before)
app.post('/api/admin/login', express.json(), async (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt for username:', username);
  
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' });
  }

  try {
    // Check credentials
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // Create auth token
      const authToken = crypto.createHash('sha256').update(username + AUTH_SECRET).digest('hex');
      const authCookie = `${username}:${authToken}`;
      
      // Set cookie
      res.setHeader('Set-Cookie', cookie.serialize('admin_auth', authCookie, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60, // 24 hours
        path: '/'
      }));
      
      console.log('Login successful');
      res.json({ 
        success: true, 
        message: 'Login successful'
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

// Logout endpoint
app.post('/api/admin/logout', (req, res) => {
  console.log('Logout requested');
  // Clear the cookie
  res.setHeader('Set-Cookie', cookie.serialize('admin_auth', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 0,
    path: '/'
  }));
  res.json({ success: true, message: 'Logged out successfully' });
});

// FIXED: Enhanced subscription functions with better error handling
async function extendSubscription(userId, days = 30) {
  try {
    console.log(`Extending subscription for ${userId} by ${days} days`);
    
    const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('user_scripts')
      .update({
        premium_expires_at: newExpiry,
        is_premium: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error('Supabase extend error:', error);
      return { success: false, error: error.message };
    }

    console.log('Subscription extended successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Extend subscription error:', error);
    return { success: false, error: error.message };
  }
}

async function revokePremium(userId) {
  try {
    console.log(`Revoking premium access for ${userId}`);
    
    const { data, error } = await supabase
      .from('user_scripts')
      .update({
        is_premium: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error('Supabase revoke error:', error);
      return { success: false, error: error.message };
    }

    console.log('Premium access revoked successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Revoke premium error:', error);
    return { success: false, error: error.message };
  }
}

// FIXED: Admin action endpoints with proper error handling
app.post('/api/admin/extend-subscription', requireAuth, async (req, res) => {
  try {
    const { userId, days } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const result = await extendSubscription(userId, days);
    
    if (result.success) {
      res.json({ success: true, message: `Subscription extended by ${days} days` });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Extend subscription endpoint error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/api/admin/revoke-premium', requireAuth, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const result = await revokePremium(userId);
    
    if (result.success) {
      res.json({ success: true, message: 'Premium access revoked' });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Revoke premium endpoint error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Function to get user email from Auth
async function getUserEmail(userId) {
  try {
    const { data: authUser, error } = await supabase.auth.admin.getUserById(userId);
    if (!error && authUser && authUser.user) {
      return authUser.user.email;
    }
    return 'Email not found';
  } catch (error) {
    console.error('Error fetching email:', error);
    return 'Error fetching email';
  }
}

// FIXED: Dashboard route with better error handling
app.get('/api/admin/dashboard', requireAuth, async (req, res) => {
  try {
    console.log('Loading dashboard for user:', req.user.username);
    
    // Get premium users data with better error handling
    const { data: premiumUsers, error } = await supabase
      .from('user_scripts')
      .select('*')
      .eq('is_premium', true)
      .order('premium_expires_at', { ascending: true });

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    // Calculate stats
    const now = new Date();
    const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    const expiringSoon = premiumUsers?.filter(user => {
      if (!user.premium_expires_at) return false;
      const expires = new Date(user.premium_expires_at);
      return expires > now && expires < soon;
    }) || [];

    const expiredButActive = premiumUsers?.filter(user => {
      if (!user.premium_expires_at) return false;
      const expires = new Date(user.premium_expires_at);
      return expires < now;
    }) || [];

    // Get emails for all users with error handling
    const usersWithEmails = await Promise.all(
      (premiumUsers || []).map(async (user) => {
        try {
          const email = await getUserEmail(user.user_id);
          return { ...user, email };
        } catch (error) {
          console.error(`Error getting email for user ${user.user_id}:`, error);
          return { ...user, email: 'Error fetching email' };
        }
      })
    );

    // Generate HTML with enhanced JavaScript for better reactivity
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
                padding: 40px;
                border-radius: 15px;
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
                border: 2px solid #ffffff;
                transition: all 0.3s ease;
                cursor: pointer;
            }
            .stat-card:hover {
                transform: translateY(-5px);
            }
            .stat-number {
                font-size: 3em;
                font-weight: 800;
                margin-bottom: 10px;
                color: #ffffff;
            }
            .users-table {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 15px;
                overflow: hidden;
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
            }
            td {
                padding: 18px 15px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                color: #e2e8f0;
            }
            .status {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 600;
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
            }
            .btn-extend:hover {
                background: #e2e8f0;
                transform: translateY(-2px);
            }
            .btn-revoke {
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
                border: 1px solid #ffffff;
            }
            .btn-revoke:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-2px);
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
                transition: all 0.3s ease;
            }
            .notification.success {
                background: #22543d;
                color: #68d391;
                opacity: 1;
                border: 2px solid #38a169;
            }
            .notification.error {
                background: #742a2a;
                color: #fc8181;
                opacity: 1;
                border: 2px solid #e53e3e;
            }
            .warning-text {
                color: #ff6b6b;
                font-weight: 700;
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
                    <span>Welcome, ${req.user.username}</span>
                    <button class="btn-logout" onclick="logout()">Logout</button>
                </div>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">${premiumUsers?.length || 0}</div>
                    <div>Total Premium Users</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${expiringSoon.length}</div>
                    <div>Expiring Soon (7 days)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${expiredButActive.length}</div>
                    <div>Expired But Active</div>
                </div>
            </div>
            
            <div class="users-table">
                <table>
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
                        ${userRows || '<tr><td colspan="5" style="text-align: center; padding: 40px;">No premium users found</td></tr>'}
                    </tbody>
                </table>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #a0aec0;">
                Last updated: ${new Date().toLocaleString()} | 
                <a href="#" onclick="location.reload()" style="color: #ffffff;">Refresh</a>
            </div>
        </div>

        <div id="notification" class="notification"></div>

        <script>
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
                        credentials: 'include',
                        body: JSON.stringify({ userId, days })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        showNotification('Subscription extended by ' + days + ' days!');
                        // Refresh after 1 second to show updated data
                        setTimeout(() => location.reload(), 1000);
                    } else {
                        showNotification('Error: ' + result.error, 'error');
                    }
                } catch (error) {
                    showNotification('Network error: ' + error.message, 'error');
                }
            }

            async function revokePremium(userId) {
                if (!confirm('Revoke premium access for this user?')) return;
                
                try {
                    const response = await fetch('/api/admin/revoke-premium', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ userId })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        showNotification('Premium access revoked!');
                        // Refresh after 1 second to show updated data
                        setTimeout(() => location.reload(), 1000);
                    } else {
                        showNotification('Error: ' + result.error, 'error');
                    }
                } catch (error) {
                    showNotification('Network error: ' + error.message, 'error');
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
        </script>
    </body>
    </html>
    `;

    res.send(html);
    
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send(`
      <h1>Error loading dashboard</h1>
      <p>Please try again later.</p>
      <a href="/api/admin/dashboard">Retry</a>
    `);
  }
});

// Keep your existing webhook and other endpoints
app.post('/api/webhook', async (req, res) => {
  console.log('Webhook received from WooCommerce');
  // ... your existing webhook code
});

// Handle 404
app.use('*', (req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else {
    res.redirect('/api/admin/login');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
