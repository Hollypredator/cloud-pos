import { readFileSync } from "node:fs";

const mobileTables = readFileSync("src/app/m/tables/page.tsx", "utf8");
const promptIndex = mobileTables.indexOf("Once masa seçin.");
const listIndex = mobileTables.indexOf('<section className="m-stack mt-3">');

const checks = [
  {
    name: "new order flow does not render tablet terminal mode on mobile",
    pass: mobileTables.includes('layoutMode="mobile_stack"') && !mobileTables.includes('layoutMode="tablet_3pane"'),
  },
  {
    name: "new order flow instruction appears before the table list",
    pass: promptIndex >= 0 && listIndex >= 0 && promptIndex < listIndex,
  },
  {
    name: "new order flow still avoids defaulting to the first table",
    pass: mobileTables.includes(": null;") && mobileTables.includes("selectedTableId"),
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
