import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function logUserActivity(
  userId: string,
  scope: "profiles" | "platform_access_users" | "studio_access_users"
) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return;
    
    // Call the RPC function created by migration 20260502_add_user_activity_tracking
    await supabase.rpc("update_last_seen", { user_id: userId, table_name: scope });
  } catch (error) {
    // Silently ignore activity logging errors so they don't break the main flow
    console.error("Activity logging failed:", error);
  }
}
