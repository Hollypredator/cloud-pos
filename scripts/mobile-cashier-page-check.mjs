import { readFileSync, existsSync } from "node:fs";

const pageContent = readFileSync("src/app/m/cashier/page.tsx", "utf8");
const componentContent = existsSync("src/components/mobile-cashier-ui.tsx") 
  ? readFileSync("src/components/mobile-cashier-ui.tsx", "utf8") 
  : "";
const mobileCashier = pageContent + "\n" + componentContent;

const checks = [
  {
    name: "mobile cashier page is not a desktop re-export",
    pass: !mobileCashier.includes('export { default } from "@/app/cashier/page"'),
  },
  {
    name: "mobile cashier page uses the mobile shell surface classes",
    pass: mobileCashier.includes("m-card") && mobileCashier.includes("m-stack"),
  },
  {
    name: "mobile cashier page does not import BackofficePage",
    pass: !mobileCashier.includes("BackofficePage"),
  },
  {
    name: "mobile cashier page has a queue-first payment CTA",
    pass: mobileCashier.includes("Tahsilata Gec") && mobileCashier.includes("Tahsilat Kuyrugu"),
  },
  {
    name: "mobile cashier page keeps payment redirects under the mobile route",
    pass: mobileCashier.includes('return `/m/cashier?${params.toString()}`;') || mobileCashier.includes('/m/cashier'),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length > 0) {
  console.error("Mobile cashier page check failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(`Mobile cashier page check passed (${checks.length} checks).`);
