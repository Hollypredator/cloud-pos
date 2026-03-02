import { cache } from "react";
import { cookies } from "next/headers";
import { ACTIVE_BRANCH_COOKIE, normalizeBranchId } from "@/lib/business";

export const getActiveBranchId = cache(async () => {
  const store = await cookies();
  const cookieValue = store.get(ACTIVE_BRANCH_COOKIE)?.value;
  return normalizeBranchId(cookieValue);
});
