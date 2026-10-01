import { apiRequest } from "./client";
import type { Customer, PortalDevice, PortalLicense } from "../types";

export function getMe(): Promise<{ customer: Customer; licenses: PortalLicense[] }> {
  return apiRequest<{ customer: Customer; licenses: PortalLicense[] }>("/api/portal/me");
}

export function revealKey(licenseId: string): Promise<{ rawKey: string }> {
  return apiRequest<{ rawKey: string }>(`/api/portal/licenses/${licenseId}/reveal-key`, { method: "POST" });
}

export function listDevices(licenseId: string): Promise<{ items: PortalDevice[]; activeCount: number }> {
  return apiRequest<{ items: PortalDevice[]; activeCount: number }>(`/api/portal/licenses/${licenseId}/devices`);
}

export function deactivateDevice(licenseId: string, deviceId: string): Promise<PortalDevice> {
  return apiRequest<PortalDevice>(`/api/portal/licenses/${licenseId}/devices/${deviceId}/deactivate`, {
    method: "POST",
  });
}
