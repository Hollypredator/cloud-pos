import type { NextRequest } from "next/server";
import { middleware } from "./middleware";

export { config } from "./middleware";

export function proxy(request: NextRequest) {
  return middleware(request);
}
