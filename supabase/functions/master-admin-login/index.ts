import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { login_id, password } = await req.json();
    if (typeof login_id !== 'string' || typeof password !== 'string' || !login_id.trim() || !password) {
      return new Response(JSON.stringify({ error: 'login_id and password required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 1. Verify master credentials
    const { data: boundId, error: vErr } = await admin.rpc('verify_master_admin', {
      _login_id: login_id.trim(),
      _password: password,
    });
    if (vErr) throw vErr;
    if (boundId === null || boundId === undefined) {
      return new Response(JSON.stringify({ error: 'ভুল লগইন আইডি বা পাসওয়ার্ড' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Resolve / bind target user
    let targetUserId: string | null = boundId as string | null;
    if (!targetUserId) {
      const { data: rolesRow } = await admin
        .from('user_roles')
        .select('user_id, id')
        .eq('role', 'super_admin')
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!rolesRow) {
        return new Response(JSON.stringify({ error: 'কোনো super_admin ইউজার নেই — আগে একজন admin তৈরি করুন' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      targetUserId = rolesRow.user_id as string;
      await admin.rpc('bind_master_admin_user', { _user_id: targetUserId });
    }

    // 3. Fetch user email
    const { data: userRes, error: uErr } = await admin.auth.admin.getUserById(targetUserId);
    if (uErr || !userRes?.user?.email) {
      return new Response(JSON.stringify({ error: 'Bound admin user পাওয়া যায়নি' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const email = userRes.user.email;

    // 4. Generate magiclink
    const { data: linkData, error: lErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (lErr || !linkData?.properties?.hashed_token) {
      return new Response(JSON.stringify({ error: 'লিংক তৈরি করতে সমস্যা হয়েছে' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ email, token_hash: linkData.properties.hashed_token }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('master-admin-login error', e);
    return new Response(JSON.stringify({ error: (e as Error).message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
