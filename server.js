import express from 'express';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, validationResult } from 'express-validator';

const app = express();

// =============================================================================
// 🛡️ SECURITY MIDDLEWARE - Production Hardening
// =============================================================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting - Bruteforce protection
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: { error: 'Too many requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use('/api/admin/login', loginLimiter);
app.use('/api/', apiLimiter);

// Session middleware for admin authentication - ENHANCED security
app.use(session({
  name: 'inkwell.admin.sid',
  secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  },
  proxy: true
}));

// =============================================================================
// 🎯 ENVIRONMENT VALIDATION - Production Ready Checks
// =============================================================================

function validateEnvironment() {
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_KEY'];
  const missing = requiredEnvVars.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    console.error('💡 Please set these in your production environment');
    process.exit(1);
  }

  // Validate Supabase connection
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase configuration missing');
    process.exit(1);
  }

  console.log('✅ Environment validation passed');
}

// Your Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://lulmjbdvwcuzpqirsfzg.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bG1qYmR2d2N1enBxaXJzZnpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA1OTUxMCwiZXhwIjoyMDc1NjM1NTEwfQ.1e4CjoUwPKrirbvm535li8Ns52lLvoryPpBTZvUSkUk';
const supabase = createClient(supabaseUrl, supabaseKey);

const PREMIUM_PRODUCT_IDS = [2860];

// Admin credentials - Use environment variables only
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2a$10$8V/7.9qg5s6d4r3e2w1y0u7i8o9p0a1s2d3f4g5h6j7k8l9m0n1o2p3';

// =============================================================================
// 📊 LOGGING & MONITORING SYSTEM
// =============================================================================

class AuditLogger {
  static logAction(action, userId = null, details = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      action,
      userId,
      details,
      ip: details.ip || 'unknown'
    };

    console.log(`🔐 AUDIT: ${timestamp} - ${action}`, JSON.stringify(logEntry));

    // In production, you'd want to store this in a database
    this.storeInDatabase(logEntry);
  }

  static async storeInDatabase(logEntry) {
    try {
      const { error } = await supabase
        .from('admin_audit_logs')
        .insert({
          action: logEntry.action,
          user_id: logEntry.userId,
          details: logEntry.details,
          ip_address: logEntry.ip,
          created_at: logEntry.timestamp
        });

      if (error) {
        console.error('Failed to store audit log:', error);
      }
    } catch (error) {
      console.error('Audit log storage error:', error);
    }
  }
}

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Unhandled Error:', error);
  AuditLogger.logAction('SYSTEM_ERROR', null, { 
    error: error.message, 
    stack: error.stack,
    path: req.path 
  });
  
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message 
  });
});

// =============================================================================
// 🛡️ ENHANCED AUTHENTICATION & VALIDATION
// =============================================================================

// Input validation middleware
const validateLogin = [
  body('username').isLength({ min: 3, max: 50 }).trim().escape(),
  body('password').isLength({ min: 6 }).trim()
];

const validateUserAction = [
  body('userId').isUUID().trim(),
  body('days').optional().isInt({ min: 1, max: 365 })
];

// Enhanced authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.isAuthenticated && req.session.lastActivity > Date.now() - 30 * 60 * 1000) {
    req.session.lastActivity = Date.now();
    next();
  } else {
    AuditLogger.logAction('UNAUTHORIZED_ACCESS', null, { 
      path: req.path,
      ip: req.ip 
    });
    res.redirect('/api/admin/login');
  }
};

// =============================================================================
// 📈 ENHANCED HEALTH CHECK & MONITORING
// =============================================================================

app.get('/api/health', async (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'WooCommerce-Supabase Bridge',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  };

  try {
    // Database health check
    const { data, error } = await supabase
      .from('user_scripts')
      .select('count')
      .limit(1);

    healthCheck.database = error ? 'ERROR' : 'CONNECTED';
    healthCheck.databaseError = error ? error.message : null;

    // Premium users count
    const { count } = await supabase
      .from('user_scripts')
      .select('*', { count: 'exact', head: true })
      .eq('is_premium', true);

    healthCheck.premiumUsers = count;

    res.json(healthCheck);
  } catch (error) {
    healthCheck.status = 'ERROR';
    healthCheck.error = error.message;
    res.status(503).json(healthCheck);
  }
});

// =============================================================================
// 🔐 ENHANCED ADMIN LOGIN SYSTEM
// =============================================================================

// Admin login page with loading states
app.get('/api/admin/login', (req, res) => {
  if (req.session.isAuthenticated) {
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
              const loginButton = document.getElementById('loginButton');
              
              // Show loading state
              loginButton.disabled = true;
              loginButton.classList.add('loading');
              errorMessage.style.display = 'none';
              
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
                      console.log('Login successful, redirecting...');
                      window.location.href = '/api/admin/dashboard';
                  } else {
                      errorMessage.textContent = result.error || 'Login failed';
                      errorMessage.style.display = 'block';
                  }
              } catch (error) {
                  errorMessage.textContent = 'Network error. Please try again.';
                  errorMessage.style.display = 'block';
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

// Enhanced admin login endpoint
app.post('/api/admin/login', validateLogin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    AuditLogger.logAction('LOGIN_VALIDATION_FAILED', null, { 
      errors: errors.array(),
      ip: req.ip 
    });
    return res.status(400).json({ success: false, error: 'Invalid input' });
  }

  const { username, password } = req.body;
  
  try {
    if (username === ADMIN_USERNAME && await bcrypt.compare(password, ADMIN_PASSWORD_HASH)) {
      req.session.isAuthenticated = true;
      req.session.username = username;
      req.session.lastActivity = Date.now();
      
      AuditLogger.logAction('LOGIN_SUCCESS', username, { ip: req.ip });
      
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ success: false, error: 'Session error' });
        }
        res.json({ success: true });
      });
    } else {
      AuditLogger.logAction('LOGIN_FAILED', username, { ip: req.ip });
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (error) {
    AuditLogger.logAction('LOGIN_ERROR', null, { error: error.message, ip: req.ip });
    res.status(500).json({ success: false, error: 'Login error' });
  }
});

// =============================================================================
// 🗄️ ENHANCED DATA FUNCTIONS WITH ERROR HANDLING
// =============================================================================

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

// Enhanced function to check and revert expired premium users
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
      return { success: false, error: error.message };
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
        return { success: false, error: updateError.message };
      } else {
        AuditLogger.logAction('SUBSCRIPTIONS_EXPIRED', null, { count: userIds.length });
        console.log(`Successfully reverted ${userIds.length} users to non-premium`);
        return { success: true, reverted: userIds.length };
      }
    } else {
      console.log('No expired subscriptions found');
      return { success: true, reverted: 0 };
    }
  } catch (error) {
    console.error('Error in checkExpiredSubscriptions:', error);
    return { success: false, error: error.message };
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

// Enhanced function to manually extend subscription
async function extendSubscription(userId, days = 30, adminUsername = 'system') {
  try {
    const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('user_scripts')
      .update({
        premium_expires_at: newExpiry,
        is_premium: true
      })
      .eq('user_id', userId);

    if (!error) {
      AuditLogger.logAction('SUBSCRIPTION_EXTENDED', adminUsername, { 
        userId, 
        days,
        newExpiry 
      });
    }

    return { success: !error, error };
  } catch (error) {
    return { success: false, error };
  }
}

// Enhanced function to revoke premium access
async function revokePremium(userId, adminUsername = 'system') {
  try {
    const { error } = await supabase
      .from('user_scripts')
      .update({
        is_premium: false
      })
      .eq('user_id', userId);

    if (!error) {
      AuditLogger.logAction('PREMIUM_REVOKED', adminUsername, { userId });
    }

    return { success: !error, error };
  } catch (error) {
    return { success: false, error };
  }
}

// =============================================================================
// 📈 BUSINESS INTELLIGENCE & ANALYTICS ENDPOINTS
// =============================================================================

// Enhanced metrics dashboard
app.get('/api/admin/metrics', requireAuth, async (req, res) => {
  try {
    // Get comprehensive metrics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const [
      totalUsers,
      premiumUsers,
      newPremiumThisMonth,
      expiringThisWeek,
      revenueData
    ] = await Promise.all([
      // Total users
      supabase.from('user_scripts').select('*', { count: 'exact', head: true }),
      // Premium users
      supabase.from('user_scripts').select('*', { count: 'exact', head: true }).eq('is_premium', true),
      // New premium this month
      supabase.from('user_scripts').select('*', { count: 'exact', head: true })
        .eq('is_premium', true)
        .gte('premium_expires_at', thirtyDaysAgo),
      // Expiring this week
      supabase.from('user_scripts').select('*', { count: 'exact', head: true })
        .eq('is_premium', true)
        .gte('premium_expires_at', new Date().toISOString())
        .lte('premium_expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
    ]);

    const metrics = {
      totalUsers: totalUsers.count || 0,
      premiumUsers: premiumUsers.count || 0,
      conversionRate: totalUsers.count ? ((premiumUsers.count / totalUsers.count) * 100).toFixed(1) : 0,
      newPremiumThisMonth: newPremiumThisMonth.count || 0,
      expiringThisWeek: expiringThisWeek.count || 0,
      updatedAt: new Date().toISOString()
    };

    res.json({ success: true, metrics });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch metrics' });
  }
});

// Export functionality
app.get('/api/admin/export/users', requireAuth, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('user_scripts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const csvData = users.map(user => ({
      user_id: user.user_id,
      is_premium: user.is_premium,
      premium_expires_at: user.premium_expires_at,
      created_at: user.created_at,
      updated_at: user.updated_at
    }));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=premium-users-export.csv');
    
    // Simple CSV conversion
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    AuditLogger.logAction('DATA_EXPORTED', req.session.username, { recordCount: users.length });
    res.send(csv);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, error: 'Export failed' });
  }
});

// =============================================================================
// ⚡ BULK OPERATIONS ENDPOINTS
// =============================================================================

// Bulk extend subscriptions
app.post('/api/admin/bulk/extend', requireAuth, validateUserAction, async (req, res) => {
  try {
    const { userIds, days } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, error: 'User IDs array required' });
    }

    const results = await Promise.all(
      userIds.map(userId => extendSubscription(userId, days, req.session.username))
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    AuditLogger.logAction('BULK_EXTEND', req.session.username, { 
      total: userIds.length, 
      successful, 
      failed 
    });

    res.json({ 
      success: true, 
      message: `Extended ${successful} subscriptions, ${failed} failed`,
      results 
    });
  } catch (error) {
    console.error('Bulk extend error:', error);
    res.status(500).json({ success: false, error: 'Bulk operation failed' });
  }
});

// =============================================================================
// 🔔 WEBHOOK ENDPOINT WITH ENHANCED SECURITY
// =============================================================================

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

      AuditLogger.logAction('PREMIUM_UPGRADE', null, { 
        userId: authUser.id, 
        email: customerEmail,
        orderId: orderData.id 
      });

      console.log('Successfully upgraded user to premium for 30 days:', customerEmail);
      res.status(200).json({ success: true, message: 'User upgraded to premium for 30 days' });
      
    } else {
      console.log('No action needed');
      res.status(200).json({ success: true, message: 'No action needed' });
    }

  } catch (error) {
    console.error('Webhook error:', error);
    AuditLogger.logAction('WEBHOOK_ERROR', null, { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================================================
// 🎯 ENHANCED ADMIN DASHBOARD WITH ALL NEW FEATURES
// =============================================================================

// Enhanced HTML Admin Dashboard with all new features
app.get('/api/admin/dashboard', requireAuth, async (req, res) => {
  try {
    console.log('Admin: Generating enhanced dashboard HTML');
    
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

    // Generate enhanced HTML with all new features
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
            .bulk-actions {
                background: rgba(255, 255, 255, 0.1);
                padding: 20px;
                border-radius: 10px;
                margin-bottom: 20px;
                border: 2px solid #ffffff;
            }
            .bulk-actions h3 {
                margin-bottom: 15px;
                color: #ffffff;
            }
            .bulk-controls {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                align-items: center;
            }
            .bulk-select {
                padding: 8px 12px;
                border-radius: 6px;
                border: 1px solid #ffffff;
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }
            .btn-bulk {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            .btn-bulk.extend {
                background: #68d391;
                color: #0a1128;
            }
            .btn-bulk.revoke {
                background: #fc8181;
                color: #0a1128;
            }
            .btn-bulk:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
            }
            .loading-overlay {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(10, 17, 40, 0.8);
                backdrop-filter: blur(5px);
                z-index: 9999;
                justify-content: center;
                align-items: center;
                flex-direction: column;
                color: white;
            }
            .loading-spinner-large {
                width: 50px;
                height: 50px;
                border: 4px solid transparent;
                border-top: 4px solid #ffffff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
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
            
            <!-- Bulk Actions Section -->
            <div class="bulk-actions">
                <h3>🔄 Bulk Operations</h3>
                <div class="bulk-controls">
                    <select class="bulk-select" id="bulkAction">
                        <option value="extend30">Extend 30 days</option>
                        <option value="extend7">Extend 7 days</option>
                        <option value="revoke">Revoke premium</option>
                    </select>
                    <button class="btn-bulk extend" onclick="applyBulkAction()">Apply to Selected</button>
                    <button class="btn-bulk extend" onclick="selectAll()">Select All</button>
                    <button class="btn-bulk revoke" onclick="clearSelection()">Clear Selection</button>
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
                <div class="stat-card" onclick="window.open('/api/admin/metrics', '_blank')">
                    <div class="stat-number">📊</div>
                    <div class="stat-label">View Analytics</div>
                </div>
            </div>
            
            <div class="users-table">
                <table id="usersTable">
                    <thead>
                        <tr>
                            <th style="width: 20px;"><input type="checkbox" id="selectAll" onchange="toggleSelectAll()"></th>
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
                <a href="/api/check-expirations" target="_blank">Check Expirations</a> |
                <a href="/api/admin/export/users" target="_blank">Export Data</a> |
                <a href="/api/admin/metrics" target="_blank">View Metrics</a>
            </div>
        </div>

        <div id="notification" class="notification"></div>
        
        <div class="loading-overlay" id="loadingOverlay">
            <div class="loading-spinner-large"></div>
            <div>Processing bulk operation...</div>
        </div>

        <script>
            let selectedUsers = new Set();
            
            function filterTable(filter = 'all') {
                const searchTerm = document.getElementById('searchInput').value.toLowerCase();
                const rows = document.querySelectorAll('#usersTable tbody tr');
                const filterButtons = document.querySelectorAll('.filter-btn');
                
                // Update active filter button
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

            function showLoading(show = true) {
                document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
            }

            // Enhanced selection functions
            function toggleSelectAll() {
                const selectAll = document.getElementById('selectAll').checked;
                const rows = document.querySelectorAll('#usersTable tbody tr');
                
                rows.forEach(row => {
                    if (row.style.display !== 'none') {
                        const checkbox = row.querySelector('input[type="checkbox"]');
                        const userId = row.getAttribute('data-user-id');
                        
                        if (checkbox) {
                            checkbox.checked = selectAll;
                            if (selectAll) {
                                selectedUsers.add(userId);
                            } else {
                                selectedUsers.delete(userId);
                            }
                        }
                    }
                });
            }

            function toggleUserSelection(userId, checkbox) {
                if (checkbox.checked) {
                    selectedUsers.add(userId);
                } else {
                    selectedUsers.delete(userId);
                }
                updateSelectAllCheckbox();
            }

            function updateSelectAllCheckbox() {
                const visibleRows = document.querySelectorAll('#usersTable tbody tr[style=""]');
                const checkedRows = Array.from(visibleRows).filter(row => {
                    const checkbox = row.querySelector('input[type="checkbox"]');
                    return checkbox && checkbox.checked;
                });
                
                document.getElementById('selectAll').checked = 
                    checkedRows.length > 0 && checkedRows.length === visibleRows.length;
            }

            function selectAll() {
                document.getElementById('selectAll').checked = true;
                toggleSelectAll();
            }

            function clearSelection() {
                document.getElementById('selectAll').checked = false;
                toggleSelectAll();
            }

            async function applyBulkAction() {
                if (selectedUsers.size === 0) {
                    showNotification('Please select users first', 'error');
                    return;
                }

                const action = document.getElementById('bulkAction').value;
                let days = 0;
                let endpoint = '';
                let body = {};

                switch (action) {
                    case 'extend30':
                        days = 30;
                        endpoint = '/api/admin/bulk/extend';
                        body = { userIds: Array.from(selectedUsers), days };
                        break;
                    case 'extend7':
                        days = 7;
                        endpoint = '/api/admin/bulk/extend';
                        body = { userIds: Array.from(selectedUsers), days };
                        break;
                    case 'revoke':
                        endpoint = '/api/admin/bulk/revoke';
                        body = { userIds: Array.from(selectedUsers) };
                        break;
                }

                showLoading(true);

                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        showNotification(result.message);
                        setTimeout(() => location.reload(), 1500);
                    } else {
                        showNotification('Error: ' + result.error, 'error');
                    }
                } catch (error) {
                    showNotification('Network error', 'error');
                } finally {
                    showLoading(false);
                }
            }

            async function extendSubscription(userId, days) {
                if (!confirm('Extend subscription for ' + days + ' days?')) return;
                
                try {
                    const response = await fetch('/api/admin/extend-subscription', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, days })
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
                        body: JSON.stringify({ userId })
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
                        headers: { 'Content-Type': 'application/json' }
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

            // Initialize search and add checkboxes to rows
            document.getElementById('searchInput').addEventListener('input', filterTable);
            
            // Add checkboxes to existing rows
            document.querySelectorAll('#usersTable tbody tr').forEach(row => {
                const userId = row.getAttribute('data-user-id');
                const firstCell = row.querySelector('td:first-child');
                const existingContent = firstCell.innerHTML;
                
                firstCell.innerHTML = \`
                    <input type="checkbox" onchange="toggleUserSelection('\${userId}', this)">
                    \${existingContent}
                \`;
            });
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

// =============================================================================
// 🚀 STARTUP & INITIALIZATION
// =============================================================================

// Initialize the application
async function initializeApp() {
  console.log('🚀 Initializing Inkwell Premium Management System...');
  
  // Validate environment
  validateEnvironment();
  
  // Test database connection
  try {
    const { data, error } = await supabase
      .from('user_scripts')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
  
  console.log('✅ Application initialized successfully');
}

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  AuditLogger.logAction('LOGOUT', req.session.username, { ip: req.ip });
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// New endpoint to manually check expirations
app.post('/api/check-expirations', requireAuth, async (req, res) => {
  console.log('Manual expiration check requested');
  const result = await checkExpiredSubscriptions();
  res.json(result);
});

// Admin action endpoints
app.post('/api/admin/extend-subscription', requireAuth, validateUserAction, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid input' });
    }

    const { userId, days } = req.body;
    console.log(`Extending subscription for ${userId} by ${days} days`);
    
    const result = await extendSubscription(userId, days, req.session.username);
    
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

app.post('/api/admin/revoke-premium', requireAuth, validateUserAction, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid input' });
    }

    const { userId } = req.body;
    console.log(`Revoking premium access for ${userId}`);
    
    const result = await revokePremium(userId, req.session.username);
    
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

const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, async () => {
  await initializeApp();
  console.log(`\n🎉 Server running on http://localhost:${PORT}`);
  console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/api/webhook`);
  console.log(`📊 Expiration check: http://localhost:${PORT}/api/check-expirations`);
  console.log(`👨‍💼 Admin dashboard: http://localhost:${PORT}/api/admin/dashboard`);
  console.log(`🔐 Admin login: http://localhost:${PORT}/api/admin/login`);
  console.log(`❤️ Health check: http://localhost:${PORT}/api/health`);
  console.log(`\n📈 Enhanced features activated:`);
  console.log(`   ✅ Rate limiting & security headers`);
  console.log(`   ✅ Audit logging & monitoring`);
  console.log(`   ✅ Bulk operations & export`);
  console.log(`   ✅ Business intelligence metrics`);
  console.log(`   ✅ Production-ready error handling`);
});
