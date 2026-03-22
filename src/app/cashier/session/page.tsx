import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LiveOpsBridge } from "@/components/live-ops-bridge";
import { CashierSessionSettingsForm, type SessionSettingsFormActionState } from "@/components/cashier-session-settings-form";
import { BackofficePage, ContentCard, FeatureLockedState, NoticeBanner, SidebarPanel, SummaryCard, WorkflowGuide } from "@/components/backoffice-ui";
import { requireRole } from "@/lib/auth";
import { getCurrentCashSession, getPaymentOverview } from "@/lib/domains/finance";
import { executeWebOpsCommand } from "@/lib/ops/server-action";
import { getApplicationSettings, updateApplicationSettings } from "@/lib/data";
import { getFeatureAccess } from "@/lib/plan-access";

function feedbackHref(tone: "success" | "error", message: string) {
  return `/cashier/session?tone=${encodeURIComponent(tone)}&feedback=${encodeURIComponent(message)}`;
}

async function openSessionAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/cashier/session");

  const openingCash = Number(formData.get("openingCash"));
  const note = formData.get("note");
  if (!Number.isFinite(openingCash) || openingCash < 0) {
    redirect(feedbackHref("error", "Acilis nakdi gecerli bir sifir veya pozitif tutar olmali."));
  }

  try {
    const result = await executeWebOpsCommand({
      type: "CASH_SESSION_OPEN",
      payload: {
        opening_cash: openingCash,
        note: typeof note === "string" ? note : undefined,
      },
    });
    if (result.status !== "ACK") {
      redirect(feedbackHref("error", result.message ?? "Gun basi islemi tamamlanamadi."));
    }
    revalidatePath("/cashier/session");
    redirect(feedbackHref("success", "Gun basi basariyla acildi."));
  } catch {
    redirect(feedbackHref("error", "Gun basi islemi tamamlanamadi."));
  }
}

async function closeSessionAction(formData: FormData) {
  "use server";
  await requireRole(["admin", "cashier"], "/cashier/session");

  const sessionId = formData.get("sessionId");
  const closingCash = Number(formData.get("closingCash"));
  const note = formData.get("note");
  if (typeof sessionId !== "string") {
    redirect(feedbackHref("error", "Kapatilacak oturum bulunamadi."));
  }
  if (!Number.isFinite(closingCash) || closingCash < 0) {
    redirect(feedbackHref("error", "Sayilan nakit gecerli bir sifir veya pozitif tutar olmali."));
  }

  try {
    const result = await executeWebOpsCommand({
      type: "CASH_SESSION_CLOSE",
      payload: {
        session_id: sessionId,
        closing_cash: closingCash,
        note: typeof note === "string" ? note : undefined,
      },
    });
    if (result.status !== "ACK") {
      redirect(feedbackHref("error", result.message ?? "Gun sonu islemi tamamlanamadi."));
    }
    revalidatePath("/cashier/session");
    const varianceValue = typeof result.data?.variance === "number" ? result.data.variance : null;
    const expectedCash = typeof result.data?.expectedCash === "number" ? result.data.expectedCash : 0;
    const varianceMessage =
      typeof varianceValue === "number"
        ? ` Beklenen: ${expectedCash.toFixed(2)} TL, fark: ${varianceValue.toFixed(2)} TL.`
        : "";
    const mismatchMessage =
      result.data?.mismatchAlertSent === true
        ? " Mutabakat farki esigi asildigi icin operasyon alarmi olusturuldu."
        : "";
    redirect(feedbackHref("success", `Gun sonu islemi tamamlandi.${varianceMessage}${mismatchMessage}`));
  } catch {
    redirect(feedbackHref("error", "Gun sonu islemi tamamlanamadi."));
  }
}

async function updateSessionSettingsAction(
  _state: SessionSettingsFormActionState,
  formData: FormData,
): Promise<SessionSettingsFormActionState> {
  "use server";
  await requireRole(["admin", "cashier"], "/cashier/session");

  const { settings: currentSettings } = await getApplicationSettings();
  const hasAutoSessionClose = formData.has("autoSessionCloseEnabled_present") || formData.has("autoSessionCloseEnabled");
  const hasOpenCheckControl =
    formData.has("requireNoOpenChecksForSessionClose_present") || formData.has("requireNoOpenChecksForSessionClose");
  const autoSessionCloseTimeRaw = formData.get("autoSessionCloseTime");
  const autoSessionCloseTime =
    typeof autoSessionCloseTimeRaw === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(autoSessionCloseTimeRaw)
      ? autoSessionCloseTimeRaw
      : currentSettings.autoSessionCloseTime;
  const result = await updateApplicationSettings({
    ...currentSettings,
    autoSessionCloseEnabled: hasAutoSessionClose ? formData.get("autoSessionCloseEnabled") === "on" : currentSettings.autoSessionCloseEnabled,
    autoSessionCloseTime,
    requireNoOpenChecksForSessionClose: hasOpenCheckControl
      ? formData.get("requireNoOpenChecksForSessionClose") === "on"
      : currentSettings.requireNoOpenChecksForSessionClose,
  });

  if (!result.ok) {
    return {
      tone: "error",
      message: result.error ?? "Gun islemleri ayarlari kaydedilemedi.",
    };
  }

  revalidatePath("/cashier/session");
  return {
    tone: "success",
    message: "Gun islemleri ayarlari kaydedildi.",
  };
}

export default async function CashierSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ feedback?: string; tone?: "success" | "error" }>;
}) {
  await requireRole(["admin", "cashier"], "/cashier/session");
  const featureAccess = await getFeatureAccess("shift_management");
  if (!featureAccess.enabled) {
    return (
      <BackofficePage title="Gun Islemleri" description="Kasa vardiya ve gun sonu yonetimi">
        <FeatureLockedState
          title={featureAccess.title}
          description={featureAccess.description}
          currentPlan={featureAccess.plan}
          requiredPlan={featureAccess.requiredPlan}
        />
      </BackofficePage>
    );
  }
  const { feedback, tone } = await searchParams;
  const [{ session }, { today, usingDemoData }, { settings: applicationSettings }] = await Promise.all([
    getCurrentCashSession(),
    getPaymentOverview(),
    getApplicationSettings(),
  ]);

  return (
    <BackofficePage
      title="Gun Islemleri"
      description="Kasa acilis / kapanis ve gunluk operasyon takibi"
      sidebar={
        <div className="space-y-5">
          <SidebarPanel title="Manuel Gun Islemi">
            <div className={`rounded-[22px] px-4 py-4 text-sm ${session ? "bg-sky-100 text-sky-900" : "bg-amber-100 text-amber-900"}`}>
              <p className="text-lg font-semibold">{session ? "Gun Basi Yapilmis" : "Gun Basi Yapilmamis"}</p>
              <p className="mt-1">{session ? "Gunluk islemler devam ediyor." : "Islemlere baslamak icin gun basi yapin."}</p>
            </div>
            {!session ? (
              <form action={openSessionAction} className="space-y-3">
                <input name="openingCash" type="number" min="0" step="0.01" defaultValue={0} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                <input name="note" placeholder="Acilis notu" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                <button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f04b4b] px-4 py-3 text-sm font-semibold text-white">
                  Gun Basi Yap
                </button>
              </form>
            ) : (
              <form action={closeSessionAction} className="space-y-3">
                <input type="hidden" name="sessionId" value={session.id} />
                <input name="closingCash" type="number" min="0" step="0.01" placeholder="Sayilan nakit" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                <input name="note" placeholder="Kapanis notu" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                <button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-[#ff5a34] to-[#f04b4b] px-4 py-3 text-sm font-semibold text-white">
                  Gun Sonu Yap
                </button>
              </form>
            )}
          </SidebarPanel>

          <SidebarPanel title="Gun Islemleri Ayarlari">
            <CashierSessionSettingsForm
              values={{
                autoSessionCloseEnabled: applicationSettings.autoSessionCloseEnabled,
                autoSessionCloseTime: applicationSettings.autoSessionCloseTime,
                requireNoOpenChecksForSessionClose: applicationSettings.requireNoOpenChecksForSessionClose,
              }}
              action={updateSessionSettingsAction}
            />
          </SidebarPanel>
        </div>
      }
      actions={
        <>
          <LiveOpsBridge tables={["payments", "cash_register_sessions"]} />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-center">
            <p className="text-2xl font-semibold tracking-tight text-slate-900">
              {new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
            <p className="text-sm text-slate-500">{session ? "Acik oturum" : "Oturum kapali"}</p>
          </div>
        </>
      }
    >
      {feedback ? (
        <NoticeBanner
          tone={tone === "error" ? "error" : "success"}
          title={tone === "error" ? "Kasa islemi tamamlanamadi" : "Kasa islemi tamamlandi"}
          description={feedback}
        />
      ) : null}

      {usingDemoData ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Demo modda kasa session verisi sinirlidir.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard label="Nakit Satis" value={`${today.cashSale.toFixed(2)} TL`} hint="Kasa girisi" tone="accent" />
        <SummaryCard label="Kart Satis" value={`${today.cardSale.toFixed(2)} TL`} hint="POS tahsilati" />
        <SummaryCard label="Iade" value={`${today.refunds.toFixed(2)} TL`} hint="Gunluk iade" tone="danger" />
        <SummaryCard label="Net" value={`${today.net.toFixed(2)} TL`} hint="Gun sonu beklentisi" tone="success" />
      </section>

      <WorkflowGuide
        title="Gun Islemleri 3 Adim"
        description="Kasayi yeni kullanan personel gun basi ve gun sonunu karistirmadan tamamlayabilsin."
        steps={[
          { title: "Vardiya acarken gun basi yap", description: "Kasaya koyulan ilk nakit tutarini gir ve acilis notunu yaz; sonra Gun Basi Yap butonuna bas." },
          { title: "Gun boyu tahsilati takip et", description: "Ustteki nakit, kart, iade ve net kartlari vardiya boyunca kasa durumunu gosterir." },
          { title: "Kapanista sayilan nakdi gir", description: "Gun sonunda kasadaki sayilan tutari yaz, gerekiyorsa not dus ve Gun Sonu Yap ile vardiyayi kapat." },
        ]}
      />

      <ContentCard title="Gun Islemleri Gecmisi">
        <div className="responsive-table-shell rounded-[22px] border border-slate-200">
          <table className="responsive-table w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-4 font-semibold">Durum</th>
                <th className="px-4 py-4 font-semibold">Baslangic</th>
                <th className="px-4 py-4 font-semibold">Bitis</th>
                <th className="px-4 py-4 font-semibold">Not</th>
              </tr>
            </thead>
            <tbody>
              {session ? (
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Acik</span>
                  </td>
                  <td className="px-4 py-4 text-slate-700">{new Date(session.opened_at).toLocaleString("tr-TR")}</td>
                  <td className="px-4 py-4 text-slate-500">----</td>
                  <td className="px-4 py-4 text-slate-500">{session.note ?? "Not yok"}</td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                    Henuz gun islemi kaydi bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ContentCard>
    </BackofficePage>
  );
}
