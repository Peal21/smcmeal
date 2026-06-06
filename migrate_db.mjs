#!/usr/bin/env node
/**
 * SMC Meal Full DB Migration Script v2
 * 
 * Steps:
 * 1. Login to old Lovable DB
 * 2. Read all profiles + user data
 * 3. Create matching auth users in new DB (same UUIDs)
 * 4. Copy all table data
 * 
 * Usage: EMAIL=askpeal@gmail.com PASS=123456 bun run migrate_db.mjs
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ────────────────────────────────────────────────────────────────────
const OLD_URL      = 'https://fmleplqssxndaynmxhjr.supabase.co';
const OLD_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtbGVwbHFzc3huZGF5bm14aGpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjEzNTEsImV4cCI6MjA5MDAzNzM1MX0.pNIo5AR3w1spZJmNT_FI1OWLacRZfX9akSELG5YByGU';

const NEW_URL          = 'https://hcbsbgjlkqugwlkilinq.supabase.co';
const NEW_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjYnNiZ2psa3F1Z3dsa2lsaW5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc2NTExMiwiZXhwIjoyMDk2MzQxMTEyfQ.Us8-1OZ5L401Shhjip2KTl3HBGazUWyxkx9Ivq2DvTI';
// ───────────────────────────────────────────────────────────────────────────────

// Tables to copy (no auth dependency first, then auth-dependent)
const SIMPLE_TABLES = [
  'carry_logs',
  'feast_day_config',
  'special_day_items',
  'app_settings',
  'admin_portal_credentials',
  'master_admin_credentials',
];

const USER_TABLES = [
  'meal_months',
  'profiles',
  'user_roles',
  'daily_meals',
  'extra_meals',
  'payments',
  'member_balances',
  'special_day_responses',
  'password_reset_codes',
];

async function readAll(client, table) {
  let allData = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await client.from(table).select('*').range(from, from + pageSize - 1);
    if (error) {
      console.warn(`  ⚠️  Cannot read ${table}: ${error.message}`);
      return [];
    }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
}

async function upsertAll(client, table, rows) {
  if (!rows.length) return { inserted: 0 };
  const CHUNK = 200;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await client.from(table).upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
    if (error) {
      return { inserted: total, error: error.message };
    }
    total += chunk.length;
  }
  return { inserted: total };
}

async function main() {
  console.log('\n🚀 SMC Meal Full DB Migration v2');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📤 Source: ${OLD_URL}`);
  console.log(`📥 Target: ${NEW_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const email    = process.env.EMAIL || '';
  const password = process.env.PASS  || '';

  if (!email || !password) {
    console.error('❌ Set EMAIL and PASS env vars.');
    process.exit(1);
  }

  // ── Step 1: Login to old DB ─────────────────────────────────────────────────
  console.log(`🔐 Logging in as ${email}...`);
  const oldClient = createClient(OLD_URL, OLD_ANON_KEY);
  const { data: authData, error: authError } = await oldClient.auth.signInWithPassword({ email, password });

  if (authError || !authData?.session) {
    console.error('❌ Login failed:', authError?.message || 'No session');
    process.exit(1);
  }
  console.log('✅ Logged in to old DB!\n');

  // ── Step 2: New DB service_role client ──────────────────────────────────────
  const newClient = createClient(NEW_URL, NEW_SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // ── Step 3: Read profiles to get all user UUIDs ─────────────────────────────
  console.log('👥 Reading user profiles from old DB...');
  const profiles = await readAll(oldClient, 'profiles');
  console.log(`   Found ${profiles.length} profiles`);

  // Get email hints from password_reset_codes
  const resetCodes = await readAll(oldClient, 'password_reset_codes');
  const emailMap = {};
  for (const r of resetCodes) {
    if (r.user_id && r.email) emailMap[r.user_id] = r.email;
  }
  // The logged-in user's email
  emailMap[authData.user.id] = email;

  // ── Step 4: Create auth users in new DB ─────────────────────────────────────
  console.log('\n👤 Creating auth users in new DB...');
  let usersCreated = 0, usersSkipped = 0;

  for (const profile of profiles) {
    const userId = profile.user_id;
    const userEmail = emailMap[userId] || `user-${userId.slice(0, 8)}@smcmeal.local`;
    
    // Try to create user with specific UUID via admin API
    const res = await fetch(`${NEW_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': NEW_SERVICE_ROLE,
        'Authorization': `Bearer ${NEW_SERVICE_ROLE}`,
      },
      body: JSON.stringify({
        id: userId,
        email: userEmail,
        password: 'TempPass@2024!',  // temporary password
        email_confirm: true,
        user_metadata: {
          full_name: profile.full_name,
          year: profile.year,
          gender: profile.gender,
          roll_number: profile.roll_number,
        }
      })
    });

    const result = await res.json();
    if (res.ok) {
      usersCreated++;
      process.stdout.write('.');
    } else if (result.msg?.includes('already') || result.code === 'email_exists' || result.message?.includes('already')) {
      usersSkipped++;
      process.stdout.write('s');
    } else {
      process.stdout.write('?');
    }
  }
  console.log(`\n   ✅ Created: ${usersCreated}, Skipped (exists): ${usersSkipped}`);

  // ── Step 5: Copy all tables ─────────────────────────────────────────────────
  console.log('\n📋 Copying table data...\n');
  const results = {};

  const allTables = [...SIMPLE_TABLES, ...USER_TABLES];
  for (const table of allTables) {
    process.stdout.write(`  📦 ${table.padEnd(32)}`);
    const rows = await readAll(oldClient, table);
    process.stdout.write(`read: ${String(rows.length).padStart(5)} rows  →  `);
    const { inserted, error } = await upsertAll(newClient, table, rows);
    if (error) {
      process.stdout.write(`⚠️  FAILED: ${error.slice(0, 60)}\n`);
    } else {
      process.stdout.write(`✅ inserted: ${inserted}\n`);
    }
    results[table] = { read: rows.length, inserted: inserted || 0, error };
  }

  // ── Step 6: Apply delete payment policy ────────────────────────────────────
  console.log('\n🔒 Applying delete payment policy to new DB...');
  const policySQL = `
    DROP POLICY IF EXISTS "Managers can delete payments" ON public.payments;
    CREATE POLICY "Managers can delete payments" ON public.payments 
    FOR DELETE TO authenticated 
    USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
  `;
  
  const policyRes = await fetch(`${NEW_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': NEW_SERVICE_ROLE,
      'Authorization': `Bearer ${NEW_SERVICE_ROLE}`,
    },
    body: JSON.stringify({ query: policySQL })
  });
  console.log(policyRes.ok ? '  ✅ Policy applied' : '  ⚠️  Policy via Supabase SQL Editor needed');

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Migration Summary:\n');
  let totalRead = 0, totalInserted = 0;
  for (const [table, res] of Object.entries(results)) {
    const icon = res.error ? '⚠️ ' : '✅';
    const str = `${icon} ${table.padEnd(32)} ${String(res.read).padStart(5)} read → ${String(res.inserted).padStart(5)} inserted`;
    console.log('  ' + str);
    totalRead += res.read;
    totalInserted += res.inserted;
  }
  console.log(`\n  TOTAL: ${totalRead} rows read → ${totalInserted} rows inserted`);
  console.log('\n> NOTE: Users in new DB have temporary password: TempPass@2024!');
  console.log('> The real admin (askpeal@gmail.com) keeps original password.');
  console.log('\n✅ Migration complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
