require('dotenv').config();
const supabase = require('../config/supabase');

async function run() {
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('employee_id, first_name, last_name, shift_timing')
    .eq('employee_id', 'B2B260524')
    .maybeSingle();

  console.log('Employee:', emp, empErr?.message);

  const { data: att, error: attErr } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', 'B2B260524')
    .eq('attendance_date', '2026-07-07')
    .maybeSingle();

  console.log('Attendance record:', JSON.stringify(att, null, 2), attErr?.message);
}
run();
