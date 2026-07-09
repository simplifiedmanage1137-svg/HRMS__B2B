require('dotenv').config();
const supabase = require('../config/supabase');

async function run() {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, attendance_type')
    .limit(1);
  if (error) {
    console.log('attendance_type column check FAILED:', error.message);
  } else {
    console.log('attendance_type column EXISTS. Sample:', data);
  }
}
run();
