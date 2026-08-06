import { readFileSync } from "node:fs";

const mobileDelivery = readFileSync("src/app/m/delivery/page.tsx", "utf8");
const mobileRequests = readFileSync("src/app/m/service-requests/page.tsx", "utf8");

const checks = [
  {
    name: "mobile delivery page is not a desktop re-export",
    pass: !mobileDelivery.includes('export { default } from "@/app/delivery/page"'),
  },
  {
    name: "mobile delivery page uses mobile shell surface classes",
    pass: mobileDelivery.includes("m-card") && mobileDelivery.includes("m-stack") && mobileDelivery.includes("m-segment-pill"),
  },
  {
    name: "mobile delivery page does not import BackofficePage",
    pass: !mobileDelivery.includes("BackofficePage"),
  },
  {
    name: "mobile delivery redirects stay under the mobile route",
    pass: mobileDelivery.includes("return `/m/delivery?${params.toString()}`;"),
  },
  {
    name: "mobile delivery exposes dispatch actions",
    pass: mobileDelivery.includes("Kuryeye Ata") && mobileDelivery.includes("Teslim Edildi"),
  },
  {
    name: "mobile service requests page is not a desktop re-export",
    pass: !mobileRequests.includes('export { default } from "@/app/service-requests/page"'),
  },
  {
    name: "mobile service requests page uses mobile shell surface classes",
    pass: mobileRequests.includes("m-card") && mobileRequests.includes("m-stack") && mobileRequests.includes("m-segment-pill"),
  },
  {
    name: "mobile service requests page does not import BackofficePage",
    pass: !mobileRequests.includes("BackofficePage"),
  },
  {
    name: "mobile service requests links stay under the mobile route",
    pass: mobileRequests.includes("return `/m/service-requests?${params.toString()}`;"),
  },
  {
    name: "mobile service requests exposes resolve action",
    pass: mobileRequests.includes("Çözüldü Olarak İşaretle") && mobileRequests.includes("TABLE_REQUEST_RESOLVE"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length > 0) {
  console.error("Mobile delivery/service page check failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(`Mobile delivery/service page check passed (${checks.length} checks).`);
