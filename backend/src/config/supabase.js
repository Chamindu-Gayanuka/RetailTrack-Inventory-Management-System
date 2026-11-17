'use strict';

const { createClient } = require('@supabase/supabase-js');
const config = require('./env');

// Service-role client. It bypasses Row Level Security, so it must only be used on the server
// and every route that reaches it must be protected by authentication and role checks.
const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

module.exports = supabase;
