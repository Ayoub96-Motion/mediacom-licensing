import { apiRequest } from "./client";
import type { AuditLogEntry, AuditTargetType, Paginated } from "../types";

export function listAuditLog(params: {
  targetType?: AuditTargetType;
  targetId?: string;
  adminId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<AuditLogEntry>> {
  const qs = new URLSearchParams();
  if (params.targetType) qs.set("targetType", params.targetType);
  if (params.targetId) qs.set("targetId", params.targetId);
  if (params.adminId) qs.set("adminId", params.adminId);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  return apiRequest<Paginated<AuditLogEntry>>(`/admin/audit-log?${qs.toString()}`);
}

export function customerAuditLog(customerId: string, page = 1): Promise<Paginated<AuditLogEntry>> {
  return apiRequest<Paginated<AuditLogEntry>>(`/admin/customers/${customerId}/audit-log?page=${page}`);
}

export function licenseAuditLog(licenseId: string, page = 1): Promise<Paginated<AuditLogEntry>> {
  return apiRequest<Paginated<AuditLogEntry>>(`/admin/licenses/${licenseId}/audit-log?page=${page}`);
}
