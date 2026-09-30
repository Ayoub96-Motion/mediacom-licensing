import { apiRequest } from "./client";
import type {
  CreateLicenseResponse,
  Device,
  Entitlements,
  License,
  LicenseActivation,
  LicenseStatusFilter,
  LicenseType,
  LicenseWithDevices,
  LicenseWithCustomer,
  Paginated,
  TierPresetName,
} from "../types";

export function listLicenses(params: {
  customerId?: string;
  status?: LicenseStatusFilter;
  type?: LicenseType;
  expiringWithinDays?: number;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<LicenseWithCustomer>> {
  const qs = new URLSearchParams();
  if (params.customerId) qs.set("customerId", params.customerId);
  if (params.status) qs.set("status", params.status);
  if (params.type) qs.set("type", params.type);
  if (params.expiringWithinDays) qs.set("expiringWithinDays", String(params.expiringWithinDays));
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  return apiRequest<Paginated<LicenseWithCustomer>>(`/admin/licenses?${qs.toString()}`);
}

export function getExpiringSoonCount(withinDays = 30): Promise<{ count: number; withinDays: number }> {
  return apiRequest<{ count: number; withinDays: number }>(`/admin/licenses/expiring-soon?withinDays=${withinDays}`);
}

export function getLicense(id: string): Promise<LicenseWithDevices> {
  return apiRequest<LicenseWithDevices>(`/admin/licenses/${id}`);
}

export interface CreateLicenseInput {
  customerId: string;
  deviceLimit: number;
  type: LicenseType;
  expiresAt?: string | null;
  tier?: TierPresetName;
  features?: Entitlements;
}

export function createLicense(input: CreateLicenseInput): Promise<CreateLicenseResponse> {
  return apiRequest<CreateLicenseResponse>("/admin/licenses", { method: "POST", body: input });
}

export interface UpdateLicenseInput {
  features?: Entitlements;
  deviceLimit?: number;
  expiresAt?: string | null;
  type?: LicenseType;
}

export function updateLicense(id: string, input: UpdateLicenseInput): Promise<License> {
  return apiRequest<License>(`/admin/licenses/${id}`, { method: "PATCH", body: input });
}

export function revokeLicense(id: string): Promise<License> {
  return apiRequest<License>(`/admin/licenses/${id}/revoke`, { method: "POST" });
}

// Hard delete — existing mechanism, kept for CustomerDetailPage's Devices
// section (unchanged, out of scope for this pass). LicenseDetailPage below
// uses the new soft-delete deactivateActivation() instead.
export function deactivateDevice(licenseId: string, deviceId: string): Promise<void> {
  return apiRequest<void>(`/admin/licenses/${licenseId}/devices/${deviceId}`, { method: "DELETE" });
}

export function listActivations(licenseId: string): Promise<{ items: LicenseActivation[]; activeCount: number }> {
  return apiRequest<{ items: LicenseActivation[]; activeCount: number }>(`/admin/licenses/${licenseId}/activations`);
}

// Soft delete (Phase 1) — sets deactivatedAt instead of removing the row.
export function deactivateActivation(activationId: string): Promise<Device> {
  return apiRequest<Device>(`/admin/activations/${activationId}/deactivate`, { method: "POST" });
}
