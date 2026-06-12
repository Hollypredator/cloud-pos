import { readFileSync } from "node:fs";

const mobileCashier = readFileSync("src/app/m/cashier/page.tsx", "utf8");

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
    pass: mobileCashier.includes('return `/m/cashier?${params.toString()}`;'),
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
