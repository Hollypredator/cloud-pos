import { BackofficePage } from "@/components/backoffice-ui";
import { TableFloorPlanEditor } from "@/components/table-floor-plan-editor";
import { requireRole } from "@/lib/auth";
import { getTableMap, getTableZones } from "@/lib/domains/tables";

export default async function TableFloorPlanPage() {
  await requireRole(["admin"], "/admin/tables");
  const [{ tables, usingDemoData }, { zones }] = await Promise.all([getTableMap(), getTableZones()]);

  return (
    <BackofficePage title="Salon Krokisi" description="Masaları sürükleyerek gerçek salon yerleşimini oluşturun">
      <TableFloorPlanEditor tables={tables} zones={zones} usingDemoData={usingDemoData} />
    </BackofficePage>
  );
}
