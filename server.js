import express from 'express';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// Your Supabase configuration
const supabaseUrl = 'https://lulmjbdvwcuzpqirsfzg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bG1qYmR2d2N1enBxaXJzZnpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA1OTUxMCwiZXhwIjoyMDc1NjM1NTEwfQ.1e4CjoUwPKrirbvm535li8Ns52lLvoryPpBTZvUSkUk';
const supabase = createClient(supabaseUrl, supabaseKey);

const PREMIUM_PRODUCT_IDS = [2860];

// Function to get user by email using Admin API
async function getUserByEmail(email) {
  try {
    console.log('🔍 Searching for user in Auth:', email);
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
    console.log('📊 Auth API response received');
    return data;
  } catch (error) {
    console.error('💥 Error in getUserByEmail:', error);
    throw error;
  }
}

// Function to check and revert expired premium users
async function checkExpiredSubscriptions() {
  try {
    const now = new Date().toISOString();
    console.log('🕒 Checking for expired premium subscriptions...');
    
    const { data: expiredUsers, error } = await supabase
      .from('user_scripts')
      .select('user_id, email')
      .eq('is_premium', true)
      .lt('premium_expires_at', now);

    if (error) {
      console.error('❌ Error checking expired users:', error);
      return;
    }

    if (expiredUsers && expiredUsers.length > 0) {
      console.log(`📉 Found ${expiredUsers.length} expired subscriptions to revert`);
      
      const userIds = expiredUsers.map(user => user.user_id);
      const { error: updateError } = await supabase
        .from('user_scripts')
        .update({ is_premium: false })
        .in('user_id', userIds);

      if (updateError) {
        console.error('❌ Error reverting expired users:', updateError);
      } else {
        console.log(`✅ Successfully reverted ${userIds.length} users to non-premium`);
      }
    } else {
      console.log('➡️ No expired subscriptions found');
    }
  } catch (error) {
    console.error('💥 Error in checkExpiredSubscriptions:', error);
  }
}

app.post('/api/webhook', async (req, res) => {
  console.log('🛒 Webhook received from WooCommerce');
  
  try {
    const orderData = req.body;
    const customerEmail = orderData.billing?.email;
    const orderStatus = orderData.status;
    
    console.log(`Processing order #${orderData.id} for ${customerEmail}, status: ${orderStatus}`);

    const hasPremiumProduct = orderData.line_items?.some(item => 
      PREMIUM_PRODUCT_IDS.includes(item.product_id)
    );

    if (hasPremiumProduct && (orderStatus === 'completed' || orderStatus === 'processing')) {
      console.log('⭐ Premium product found - upgrading user');
      
      const authData = await getUserByEmail(customerEmail);
      if (!authData.users || authData.users.length === 0) {
        console.error('❌ User not found in Auth:', customerEmail);
        return res.status(404).json({ error: 'User not found' });
      }

      const authUser = authData.users[0];
      console.log('👤 Found auth user:', authUser.id);

      // FIXED: Update existing user instead of upsert
      const { error: scriptError } = await supabase
        .from('user_scripts')
        .update({
          is_premium: true,
          premium_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
        })
        .eq('user_id', authUser.id);

      if (scriptError) {
        console.error('❌ Supabase update error:', scriptError);
        throw scriptError;
      }

      console.log('✅ Successfully upgraded user to premium for 30 days:', customerEmail);
      res.status(200).json({ success: true, message: 'User upgraded to premium for 30 days' });
      
    } else {
      console.log('➡️ No action needed');
      res.status(200).json({ success: true, message: 'No action needed' });
    }

  } catch (error) {
    console.error('💥 Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// New endpoint to manually check expirations
app.post('/api/check-expirations', async (req, res) => {
  console.log('🔍 Manual expiration check requested');
  await checkExpiredSubscriptions();
  res.json({ success: true, message: 'Expiration check completed' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', service: 'WooCommerce-Supabase Bridge' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Webhook endpoint: http://localhost:3000/api/webhook`);
  console.log(`⏰ Expiration check: http://localhost:3000/api/check-expirations`);
});