import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;
let authClient: SupabaseClient | null = null;

function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
}

function anonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
}

function serviceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

/**
 * Auth calls run on the server, so the service role key is a safe fallback when
 * only the database credentials were added to the deployment. Prefer the anon
 * key so the service role key stays out of any browser-facing client.
 */
function authKey() {
  return anonKey() || serviceRoleKey();
}

/** True when Supabase Auth can send and verify phone OTPs. */
export function isSupabaseAuthConfigured(): boolean {
  return Boolean(supabaseUrl() && authKey());
}

/** True when the server can read and write the Supabase Postgres state row. */
export function isSupabaseDatabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && serviceRoleKey());
}

/**
 * Server-only client for the app_state table. The service role key bypasses
 * RLS, so this must never be imported into a client component.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!isSupabaseDatabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  if (!adminClient) {
    adminClient = createClient(supabaseUrl(), serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

/** Server-side client for Supabase Auth (phone OTP send/verify). */
export function getSupabaseAuth(): SupabaseClient {
  if (!isSupabaseAuthConfigured()) {
    throw new Error(
      "Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL with NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  if (!authClient) {
    authClient = createClient(supabaseUrl(), authKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return authClient;
}
