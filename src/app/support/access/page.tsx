import { revalidatePath } from "next/cache";
import { requireSupportAccess } from "@/lib/auth";
import {
  listPlatformAccessUsers,
  listSupportAccessUsers,
  setPlatformAccessUserRole,
  setPlatformAccessUserStatus,
  setSupportAccessUserRole,
  setSupportAccessUserStatus,
  upsertPlatformAccessUser,
  upsertSupportAccessUser,
} from "@/lib/domains/support";
import type { PlatformRole, SupportRole } from "@/lib/types";

async function addSupportUserAction(formData: FormData) {
  "use server";
  await requireSupportAccess("/support/access", ["support_admin"]);
  await upsertSupportAccessUser({
    email: String(formData.get("email") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    role: String(formData.get("role") ?? "support_agent") as SupportRole,
    isActive: true,
  });
  revalidatePath("/support/access");
}

async function toggleSupportUserAction(formData: FormData) {
  "use server";
  await requireSupportAccess("/support/access", ["support_admin"]);
  await setSupportAccessUserStatus(String(formData.get("id") ?? ""), String(formData.get("nextState") ?? "") === "true");
  revalidatePath("/support/access");
}

async function updateSupportRoleAction(formData: FormData) {
  "use server";
  await requireSupportAccess("/support/access", ["support_admin"]);
  await setSupportAccessUserRole(String(formData.get("id") ?? ""), String(formData.get("role") ?? "support_agent") as SupportRole);
  revalidatePath("/support/access");
}

async function addPlatformUserAction(formData: FormData) {
  "use server";
  await requireSupportAccess("/support/access", ["support_admin"]);
  await upsertPlatformAccessUser({
    email: String(formData.get("email") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    role: String(formData.get("role") ?? "observer") as PlatformRole,
    isActive: true,
  });
  revalidatePath("/support/access");
}

async function togglePlatformUserAction(formData: FormData) {
  "use server";
  await requireSupportAccess("/support/access", ["support_admin"]);
  await setPlatformAccessUserStatus(String(formData.get("id") ?? ""), String(formData.get("nextState") ?? "") === "true");
  revalidatePath("/support/access");
}

async function updatePlatformRoleAction(formData: FormData) {
  "use server";
  await requireSupportAccess("/support/access", ["support_admin"]);
  await setPlatformAccessUserRole(String(formData.get("id") ?? ""), String(formData.get("role") ?? "observer") as PlatformRole);
  revalidatePath("/support/access");
}

export default async function SupportAccessPage() {
  await requireSupportAccess("/support/access");
  const [{ users, usingDemoData }, { users: platformUsers }] = await Promise.all([
    listSupportAccessUsers(),
    listPlatformAccessUsers(),
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Support Access</p>
        <h1 className="text-3xl font-semibold text-slate-900">Support kullanicilari</h1>
      </header>

      {usingDemoData ? <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Demo modda support kullanicilari kaydedilemez.</p> : null}

      <form action={addPlatformUserAction} className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="mb-4 text-lg font-semibold text-slate-900">Platform kullanicilari</p>
        <div className="grid gap-4 md:grid-cols-2">
          <input name="fullName" placeholder="Ad soyad" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <input name="email" type="email" placeholder="ornek@firma.com" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <select name="role" className="rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2">
            <option value="platform_owner">Platform Owner</option>
            <option value="platform_admin">Platform Admin</option>
            <option value="support_manager">Support Manager</option>
            <option value="support_agent">Support Agent</option>
            <option value="billing_manager">Billing Manager</option>
            <option value="content_manager">Content Manager</option>
            <option value="content_editor">Content Editor</option>
            <option value="observer">Observer</option>
          </select>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Platform Kullanici Ekle</button>
        </div>
      </form>

      <section className="space-y-3">
        {platformUsers.map((user) => (
          <article key={user.id} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">{user.full_name || user.email}</p>
                <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400">{user.role}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <form action={updatePlatformRoleAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={user.id} />
                  <select name="role" defaultValue={user.role} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="platform_owner">Platform Owner</option>
                    <option value="platform_admin">Platform Admin</option>
                    <option value="support_manager">Support Manager</option>
                    <option value="support_agent">Support Agent</option>
                    <option value="billing_manager">Billing Manager</option>
                    <option value="content_manager">Content Manager</option>
                    <option value="content_editor">Content Editor</option>
                    <option value="observer">Observer</option>
                  </select>
                  <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
                    Rol
                  </button>
                </form>
                <form action={togglePlatformUserAction}>
                  <input type="hidden" name="id" value={user.id} />
                  <input type="hidden" name="nextState" value={user.is_active ? "false" : "true"} />
                  <button
                    type="submit"
                    className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                      user.is_active ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {user.is_active ? "Pasif Yap" : "Aktif Et"}
                  </button>
                </form>
              </div>
            </div>
          </article>
        ))}
      </section>

      <form action={addSupportUserAction} className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="mb-4 text-lg font-semibold text-slate-900">Support kullanicilari</p>
        <div className="grid gap-4 md:grid-cols-2">
          <input name="fullName" placeholder="Ad soyad" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <input name="email" type="email" placeholder="ornek@firma.com" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <select name="role" className="rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2">
            <option value="support_agent">Support Agent</option>
            <option value="support_admin">Support Admin</option>
            <option value="billing_agent">Billing Agent</option>
            <option value="read_only">Read Only</option>
          </select>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Kullanici Ekle</button>
        </div>
      </form>

      <section className="space-y-3">
        {users.map((user) => (
          <article key={user.id} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">{user.full_name || user.email}</p>
                <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400">{user.role}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <form action={updateSupportRoleAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={user.id} />
                  <select name="role" defaultValue={user.role} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="support_agent">Support Agent</option>
                    <option value="support_admin">Support Admin</option>
                    <option value="billing_agent">Billing Agent</option>
                    <option value="read_only">Read Only</option>
                  </select>
                  <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
                    Rol
                  </button>
                </form>
                <form action={toggleSupportUserAction}>
                  <input type="hidden" name="id" value={user.id} />
                  <input type="hidden" name="nextState" value={user.is_active ? "false" : "true"} />
                  <button
                    type="submit"
                    className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                      user.is_active ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {user.is_active ? "Pasif Yap" : "Aktif Et"}
                  </button>
                </form>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

