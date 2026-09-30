import { apiRequest } from "./client";
import type { DashboardStats } from "../types";

export function getStats(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>("/admin/stats");
}
