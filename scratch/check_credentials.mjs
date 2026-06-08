import { createClient } from '@supabase/supabase-js';

const NEW_URL = 'https://hcbsbgjlkqugwlkilinq.supabase.co';
const NEW_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjYnNiZ2psa3F1Z3dsa2lsaW5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc2NTExMiwiZXhwIjoyMDk2MzQxMTEyfQ.Us8-1OZ5L401Shhjip2KTl3HBGazUWyxkx9Ivq2DvTI';

const client = createClient(NEW_URL, NEW_SERVICE_ROLE);

async function check() {
  const t1 = await client.from('admin_portal_credentials').select('*');
  console.log('admin_portal_credentials:', JSON.stringify(t1.data, null, 2));
  
  const t2 = await client.from('master_admin_credentials').select('*');
  console.log('master_admin_credentials:', JSON.stringify(t2.data, null, 2));
}

check();
