import { revalidatePath } from "next/cache";
import { listStudioAccessUsers, setStudioAccessUserRole, setStudioAccessUserStatus, upsertStudioAccessUser } from "@/lib/data";
import { requireStudioAccess } from "@/lib/auth";
import type { StudioRole } from "@/lib/types";

async function addStudioUserAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/access", ["owner"]);
  await upsertStudioAccessUser({
    email: String(formData.get("email") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    role: String(formData.get("role") ?? "editor") as StudioRole,
    isActive: true,
  });
  revalidatePath("/studio/access");
}

async function toggleStudioUserAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/access", ["owner"]);
  await setStudioAccessUserStatus(String(formData.get("id") ?? ""), String(formData.get("nextState") ?? "") === "true");
  revalidatePath("/studio/access");
}

async function updateStudioRoleAction(formData: FormData) {
  "use server";
  await requireStudioAccess("/studio/access", ["owner"]);
  await setStudioAccessUserRole(String(formData.get("id") ?? ""), String(formData.get("role") ?? "editor") as StudioRole);
  revalidatePath("/studio/access");
}

export default async function StudioAccessPage() {
  await requireStudioAccess("/studio/access", ["owner"]);
  const { users, usingDemoData } = await listStudioAccessUsers();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Studio Access</p>
        <h1 className="text-3xl font-semibold text-slate-900">Backoffice kullanicilari</h1>
      </header>

      {usingDemoData ? <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Demo modda studio kullanicilari kaydedilemez.</p> : null}

      <form action={addStudioUserAction} className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <input name="fullName" placeholder="Ad soyad" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <input name="email" type="email" placeholder="ornek@firma.com" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          <select name="role" className="rounded-xl border border-slate-300 px-4 py-3 text-sm md:col-span-2">
            <option value="editor">Editor</option>
            <option value="owner">Owner</option>
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
                <form action={updateStudioRoleAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={user.id} />
                  <select name="role" defaultValue={user.role} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="editor">Editor</option>
                    <option value="owner">Owner</option>
                  </select>
                  <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
                    Rol
                  </button>
                </form>
                <form action={toggleStudioUserAction}>
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
