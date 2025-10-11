import express from 'express';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';

const app = express();
app.use(express.json());

// Your Supabase configuration
const supabaseUrl = 'https://lulmjbdvwcuzpqirsfzg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bG1qYmR2d2N1enBxaXJzZnpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA1OTUxMCwiZXhwIjoyMDc1NjM1NTEwfQ.1e4CjoUwPKrirbvm535li8Ns52lLvoryPpBTZvUSkUk';
const supabase = createClient(supabaseUrl, supabaseKey);

const PREMIUM_PRODUCT_IDS = [2860];

// Admin credentials - Using plain text password
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'marymelashouse.5';
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production';

// CORS middleware for all routes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  const allowedOrigins = [
    'https://woocommerce-supabase-bridge.vercel.app',
    'https://woocommerce-supabase-bridge-*.vercel.app',
    'http://localhost:3000'
  ];
  
  if (allowedOrigins.includes(origin) || origin?.includes('vercel.app') || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept, Authorization, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// JWT Authentication middleware
const requireAuth = (req, res, next) => {
  try {
    const token = req.cookies?.admin_token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      console.log('No token found, redirecting to login');
      return res.redirect('/api/admin/login');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('Invalid token:', error.message);
    // Clear invalid token
    res.setHeader('Set-Cookie', cookie.serialize('admin_token', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 0,
      path: '/'
    }));
    res.redirect('/api/admin/login');
  }
};

// Root route - redirect to admin login
app.get('/', (req, res) => {
  res.redirect('/api/admin/login');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'WooCommerce-Supabase Bridge',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Admin login page
app.get('/api/admin/login', (req, res) => {
  // Check if already authenticated
  try {
    const token = req.cookies?.admin_token;
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.username === ADMIN_USERNAME) {
        console.log('Already authenticated, redirecting to dashboard');
        return res.redirect('/api/admin/dashboard');
      }
    }
  } catch (error) {
    // Token is invalid, continue to login page
  }

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
      <title>Admin Login - Inkwell Dashboard</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>">
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

// Admin login endpoint with JWT
app.post('/api/admin/login', express.json(), async (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt for username:', username);
  
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' });
  }

  try {
    // Check credentials with plain text comparison
    const isUsernameValid = username === ADMIN_USERNAME;
    const isPasswordValid = password === ADMIN_PASSWORD;
    
    if (isUsernameValid && isPasswordValid) {
      // Create JWT token
      const token = jwt.sign(
        { 
          username: username,
          loginTime: new Date().toISOString()
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // Set HTTP-only cookie
      res.setHeader('Set-Cookie', cookie.serialize('admin_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60, // 24 hours
        path: '/'
      }));
      
      console.log('Login successful, JWT token created');
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

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  console.log('Logout requested');
  // Clear the cookie
  res.setHeader('Set-Cookie', cookie.serialize('admin_token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 0,
    path: '/'
  }));
  res.json({ success: true, message: 'Logged out successfully' });
});

// [Rest of your functions remain the same - getUserByEmail, checkExpiredSubscriptions, etc.]

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
    console.log('Admin: Generating enhanced dashboard HTML for user:', req.user.username);
    
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

    // Generate enhanced HTML (same as before, just using req.user.username)
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
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>">
        <style>
            /* Your existing CSS styles here */
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
            
            <!-- Rest of your dashboard HTML -->
            
        </div>

        <script>
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

            // Your existing JavaScript functions here
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

// Handle 404 for all other routes
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
  console.log(`Webhook endpoint: http://localhost:3000/api/webhook`);
  console.log(`Expiration check: http://localhost:3000/api/check-expirations`);
  console.log(`Admin dashboard: http://localhost:3000/api/admin/dashboard`);
  console.log(`Admin login: http://localhost:3000/api/admin/login`);
});
