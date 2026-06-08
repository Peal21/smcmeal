import { createClient } from '@supabase/supabase-js';

const OLD_URL      = 'https://fmleplqssxndaynmxhjr.supabase.co';
const OLD_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtbGVwbHFzc3huZGF5bm14aGpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjEzNTEsImV4cCI6MjA5MDAzNzM1MX0.pNIo5AR3w1spZJmNT_FI1OWLacRZfX9akSELG5YByGU';

async function main() {
  const email = 'askpeal@gmail.com';
  const password = '123456';
  
  console.log('Logging in to old DB...');
  const oldClient = createClient(OLD_URL, OLD_ANON_KEY);
  const { data: authData, error: authError } = await oldClient.auth.signInWithPassword({ email, password });
  
  if (authError || !authData?.session) {
    console.error('Login failed:', authError?.message || 'No session');
    return;
  }
  console.log('Logged in successfully!');
  
  console.log('Checking if exec_sql RPC exists and executing unschedule commands...');
  const { data, error } = await oldClient.rpc('exec_sql', { 
    query: `
      SELECT cron.unschedule('telegram-reminder-9pm');
      SELECT cron.unschedule('telegram-reminder-930pm');
      SELECT cron.unschedule('telegram-reminder-955pm');
    ` 
  });
  
  if (error) {
    console.error('RPC failed:', error);
  } else {
    console.log('RPC Succeeded! Result:', data);
  }
}

main();
