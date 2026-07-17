import { readFileSync, existsSync } from "node:fs";

const pageContent = readFileSync("src/app/m/kitchen/page.tsx", "utf8");
const componentContent = existsSync("src/components/mobile-kitchen-ui.tsx") 
  ? readFileSync("src/components/mobile-kitchen-ui.tsx", "utf8") 
  : "";
const mobileKitchen = pageContent + "\n" + componentContent;

const checks = [
  {
    name: "mobile kitchen page is not a desktop re-export",
    pass: !mobileKitchen.includes('export { default } from "@/app/kitchen/page"'),
  },
  {
    name: "mobile kitchen page uses mobile shell surface classes",
    pass: mobileKitchen.includes("m-card") && mobileKitchen.includes("m-stack"),
  },
  {
    name: "mobile kitchen page does not import BackofficePage",
    pass: !mobileKitchen.includes("BackofficePage"),
  },
  {
    name: "mobile kitchen station links stay under the mobile route",
    pass: mobileKitchen.includes("return `/m/kitchen?station=${station}`;") || mobileKitchen.includes("/m/kitchen?station="),
  },
  {
    name: "mobile kitchen exposes operational station copy",
    pass: mobileKitchen.includes("Aktif Istasyon") || mobileKitchen.includes("Aktif İstasyon"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length > 0) {
  console.error("Mobile kitchen page check failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(`Mobile kitchen page check passed (${checks.length} checks).`);
