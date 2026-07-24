const supabase = require('./config/supabase');

(async () => {
  const { data, error } = await supabase
    .from('employees')
    .select('employee_id, first_name, last_name, profile_image')
    .not('profile_image', 'is', null)
    .limit(5);
  console.log('error:', error);
  console.log('employees with profile_image set:', data);

  const { data: pratik, error: err2 } = await supabase
    .from('employees')
    .select('employee_id, first_name, last_name, profile_image')
    .ilike('first_name', '%pratik%');
  console.log('pratik matches:', pratik, err2);

  process.exit(0);
})();
