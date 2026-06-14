export function feedbackHref(tone: "success" | "error", message: string) {
  return `/admin/tables?tone=${encodeURIComponent(tone)}&feedback=${encodeURIComponent(message)}`;
}

export function tableStatusLabel(status: string) {
  if (status === "occupied") return "Dolu";
  if (status === "reserved") return "Rezerve";
  return "Boş";
}

export function tableStatusTone(status: string) {
  if (status === "occupied") return "bg-amber-100 text-amber-800";
  if (status === "reserved") return "bg-sky-100 text-sky-800";
  return "bg-emerald-100 text-emerald-700";
}

export function orderTone(status: string) {
  if (status === "paid") return "bg-emerald-100 text-emerald-700";
  if (status === "served") return "bg-[#fff2ee] text-[#ff5a34]";
  return "bg-slate-100 text-slate-700";
}
