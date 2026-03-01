export const DEFAULT_BUSINESS_SLUG =
  process.env.NEXT_PUBLIC_DEFAULT_BUSINESS_SLUG || process.env.DEFAULT_BUSINESS_SLUG || "default";
export const ACTIVE_BUSINESS_COOKIE = "active_business_slug";
export const ACTIVE_BRANCH_COOKIE = "active_branch_id";
export const ALL_BRANCHES_VALUE = "__all__";

export function normalizeBusinessSlug(input?: string) {
  return (input || DEFAULT_BUSINESS_SLUG).trim().toLowerCase();
}

export function normalizeBranchId(input?: string) {
  const value = (input || "").trim();
  return value === ALL_BRANCHES_VALUE ? ALL_BRANCHES_VALUE : value;
}
