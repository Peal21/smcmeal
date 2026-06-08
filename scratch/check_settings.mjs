import { createClient } from '@supabase/supabase-js';

const NEW_URL = 'https://hcbsbgjlkqugwlkilinq.supabase.co';
const NEW_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjYnNiZ2psa3F1Z3dsa2lsaW5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc2NTExMiwiZXhwIjoyMDk2MzQxMTEyfQ.Us8-1OZ5L401Shhjip2KTl3HBGazUWyxkx9Ivq2DvTI';

const client = createClient(NEW_URL, NEW_SERVICE_ROLE);

async function check() {
  const { data, error } = await client.from('app_settings').select('*');
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}

check();
