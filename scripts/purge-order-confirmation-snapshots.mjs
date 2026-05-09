import { createClient } from "@supabase/supabase-js";

const RETENTION_DAYS = 90;

function assertEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`[qr-confirmation-purge] eksik env: ${name}`);
  }
  return value;
}

async function run() {
  const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = assertEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cutoffIso = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("order_confirmation_snapshots")
    .delete()
    .lt("created_at", cutoffIso)
    .select("id");

  if (error) {
    throw new Error(`[qr-confirmation-purge] silme hatasi: ${error.message}`);
  }

  console.log(
    `[qr-confirmation-purge] silinen kayit: ${Array.isArray(data) ? data.length : 0}, cutoff: ${cutoffIso}`,
  );
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
