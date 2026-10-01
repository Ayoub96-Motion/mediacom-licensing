import { apiRequest } from "./client";
import type { PortalRelease } from "../types";

export function listReleases(): Promise<{ items: PortalRelease[] }> {
  return apiRequest<{ items: PortalRelease[] }>("/api/portal/releases");
}
