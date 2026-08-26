// ===================================================================
// session-guard
// -------------------------------------------------------------------
// Called by the browser right after a successful login. It revokes
// the *refresh token* of every OTHER active session belonging to the
// calling student (keeping only the session that just called this
// function alive) using Supabase Auth's admin API. This is the real,
// unbypassable backend enforcement layer for "one device at a time":
// even a modified/old client that ignores everything the UI does
// cannot keep a revoked session's access token refreshing forever.
//
// Admin accounts are intentionally exempt — they may legitimately
// need more than one active device/tab to manage the platform.
//
// Deploy with:  supabase functions deploy session-guard
// Requires the standard auto-injected secrets: SUPABASE_URL,
// SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (already used by the
// existing admin-users function, no extra setup needed).
// ===================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Server configuration is incomplete' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  const token = authHeader.replace('Bearer ', '');

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const deviceId = String(body?.deviceId || '').trim();
  if (!deviceId || deviceId.length < 8) return json({ error: 'deviceId is required' }, 400);

  // Verify the caller's own access token (the device that just logged in / reloaded).
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user: caller }, error: callerError } = await userClient.auth.getUser();
  if (callerError || !caller) return json({ error: 'Unauthorized' }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile, error: profileError } = await adminClient
    .from('profiles').select('role').eq('id', caller.id).maybeSingle();
  if (profileError) return json({ error: profileError.message }, 500);

  // Admins are not restricted to a single device.
  if (profile?.role === 'admin') return json({ ok: true, skipped: 'admin' });

  // Revoke every OTHER session's refresh token for this user, keeping
  // only the one identified by the token we were just called with.
  const { error: signOutError } = await adminClient.auth.admin.signOut(token, 'others');
  if (signOutError) return json({ error: signOutError.message }, 400);

  return json({ ok: true });
});
