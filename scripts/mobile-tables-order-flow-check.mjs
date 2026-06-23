import { readFileSync } from "node:fs";

const mobileTables = readFileSync("src/app/m/tables/page.tsx", "utf8");
const adminOrders = readFileSync("src/app/admin/orders/page.tsx", "utf8");

const checks = [
  {
    name: "mobile tables links to admin orders with table id",
    pass: mobileTables.includes('href={`/admin/orders?table=${table.id}`}'),
  },
  {
    name: "admin orders layout uses mobile_stack on mobile User-Agent",
    pass: adminOrders.includes('layoutMode={isMobileUA ? "mobile_stack" : entryLayoutMode}'),
  },
  {
    name: "mobile tables avoids default preselection without table",
    pass: mobileTables.includes("selectedTableId ?"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length > 0) {
  console.error("Mobile tables order flow check failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(`Mobile tables order flow check passed (${checks.length} checks).`);
