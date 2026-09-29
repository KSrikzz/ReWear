
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'frontend/.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({ email: 'test@example.com', password: 'password123' });
  if (error) { console.error('Login error:', error); return; }
  const token = data.session.access_token;
  console.log('Got token');
  const res = await fetch('http://localhost:8080/api/recommendations/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ query: 'suit' })
  });
  console.log('Status:', res.status);
  console.log('Response:', await res.text());
}
test();

