// Run: node scripts/add-attendance-type-column.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  console.log('Adding attendance_type column to attendance table...');

  const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args)).catch(() => {
    const https = require('https');
    return new Promise((resolve, reject) => {
      const [url, opts = {}] = args;
      const urlObj = new URL(url);
      const body = opts.body || '';
      const req = https.request({
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: opts.method || 'GET',
        headers: opts.headers || {}
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ ok: res.statusCode < 300, status: res.statusCode, text: () => Promise.resolve(data) }));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  });

  const projectRef = process.env.SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

  const sql = `
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS attendance_type TEXT DEFAULT NULL;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_type_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_type_check
  CHECK (attendance_type IS NULL OR attendance_type IN ('paid_leave', 'comp_off'));
CREATE INDEX IF NOT EXISTS idx_attendance_type ON attendance (attendance_type);
  `.trim();

  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ query: sql })
      }
    );
    console.log('Management API status:', res.status);
    console.log('Response:', await res.text());
  } catch (err) {
    console.error('Management API error:', err.message);
  }

  console.log('\nVerifying column exists...');
  const { error } = await supabase.from('attendance').select('attendance_type').limit(1);
  if (error) {
    console.error('Column NOT found:', error.message);
    console.log('\nRun this SQL manually in the Supabase SQL Editor instead:');
    console.log('https://supabase.com/dashboard/project/' + projectRef + '/sql/new\n');
    console.log(sql);
  } else {
    console.log('Column exists and is accessible.');
  }
  process.exit(0);
}

run();
