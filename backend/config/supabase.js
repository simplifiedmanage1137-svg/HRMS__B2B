const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    const msg = `Missing Supabase credentials — SUPABASE_URL: ${supabaseUrl ? 'OK' : 'MISSING'}, KEY: ${supabaseKey ? 'OK' : 'MISSING'}`;
    console.error('❌', msg);
    throw new Error(msg);
}

// @supabase/realtime-js (>=2.1xx) requires a native `WebSocket` global (Node 22+) and throws at
// construction time otherwise — even though this app never actually uses realtime subscriptions,
// createClient() unconditionally builds a RealtimeClient. Passing the `ws` package as the
// transport avoids that crash entirely and works the same on every Node version, so behavior
// doesn't depend on which Node version happens to be installed/provisioned.
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket }
});

console.log('✅ Supabase client initialized');

module.exports = supabase;