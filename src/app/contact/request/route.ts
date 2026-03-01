import { NextResponse, type NextRequest } from "next/server";
import { createSalesLead } from "@/lib/data";
import { notifySalesLeadCreated } from "@/lib/email";

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const companyName = String(formData.get("companyName") ?? "");
  const contactName = String(formData.get("contactName") ?? "");
  const branchCount = Number(formData.get("branchCount") ?? "1");
  const phone = String(formData.get("phone") ?? "");
  const email = String(formData.get("email") ?? "");
  const note = String(formData.get("note") ?? "");

  const result = await createSalesLead({
    companyName,
    contactName,
    branchCount,
    phone,
    email,
    note,
    source: "landing_form",
  });

  const baseUrl = new URL("/", request.url);
  if (!result.ok) {
    baseUrl.searchParams.set("lead", "error");
    return NextResponse.redirect(baseUrl);
  }

  await notifySalesLeadCreated({
    companyName,
    contactName,
    branchCount,
    phone,
    email,
    note,
  });

  baseUrl.searchParams.set("lead", "success");
  return NextResponse.redirect(baseUrl);
}
