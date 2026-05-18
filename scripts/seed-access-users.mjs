import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL (veya SUPABASE_URL) ve SUPABASE_SERVICE_ROLE_KEY zorunludur.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const ACCOUNTS = [
  { email: "msamedcbn@gmail.com", password: "Samed4344??", role: "owner", fullName: "Samed Coban" },
  { email: "demo-admin@cloudpos.local", password: "Demo123!", role: "admin", fullName: "Demo Admin" },
  { email: "demo-kasa@cloudpos.local", password: "Demo123!", role: "cashier", fullName: "Demo Kasa" },
  { email: "demo-mutfak@cloudpos.local", password: "Demo123!", role: "kitchen", fullName: "Demo Mutfak" },
  { email: "demo-servis@cloudpos.local", password: "Demo123!", role: "waiter", fullName: "Demo Servis" },
];

async function getOrCreateUser(account) {
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;
  const existing = usersData.users.find((u) => (u.email || "").toLowerCase() === account.email.toLowerCase());
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: account.fullName },
  });
  if (createError) throw createError;
  return created.user.id;
}

async function main() {
  const { data: business, error: businessError } = await supabase.from("businesses").select("id").order("created_at", { ascending: true }).limit(1).single();
  if (businessError) throw businessError;
  const businessId = business.id;

  const { data: branch } = await supabase
    .from("branches")
    .select("id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const branchId = branch?.id ?? null;

  for (const account of ACCOUNTS) {
    const userId = await getOrCreateUser(account);

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: userId, full_name: account.fullName, role: account.role }, { onConflict: "id" });
    if (profileError) throw profileError;

    const accessScope = account.role === "owner" || account.role === "admin" ? "business" : "branch";
    const accessBranchId = accessScope === "business" ? null : branchId;

    const { error: deleteAccessError } = await supabase
      .from("staff_branch_access")
      .delete()
      .eq("profile_id", userId)
      .eq("business_id", businessId);
    if (deleteAccessError) throw deleteAccessError;

    const { error: accessError } = await supabase.from("staff_branch_access").insert({
      profile_id: userId,
      business_id: businessId,
      branch_id: accessBranchId,
      access_scope: accessScope,
      is_primary: true,
    });
    if (accessError) throw accessError;
  }

  await supabase.from("platform_access_users").upsert(
    {
      email: "msamedcbn@gmail.com",
      full_name: "Platform Owner",
      role: "platform_owner",
      permissions: [],
      is_active: true,
    },
    { onConflict: "email" },
  );
  await supabase.from("support_access_users").upsert(
    { email: "msamedcbn@gmail.com", full_name: "Support Owner", role: "support_admin", is_active: true },
    { onConflict: "email" },
  );
  await supabase.from("studio_access_users").upsert(
    { email: "msamedcbn@gmail.com", full_name: "Studio Owner", is_active: true },
    { onConflict: "email" },
  );

  console.log("Done: users, profiles and access mappings are ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

