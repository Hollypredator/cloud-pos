export {
  getAppShellSnapshot as getAppShellContext,
  getBusinessContextBySlug,
  getDefaultBusinessScope as getBusinessScopeContext,
  getRequestAppContext,
} from "@/lib/server/app-context/core";

import * as AppContextCore from "@/lib/server/app-context/core";

export type RequestAppContext = Awaited<ReturnType<typeof AppContextCore.getRequestAppContext>>;
export type BusinessScopeContext = Awaited<ReturnType<typeof AppContextCore.getDefaultBusinessScope>>;
export type AppShellContext = Awaited<ReturnType<typeof AppContextCore.getAppShellSnapshot>>;
