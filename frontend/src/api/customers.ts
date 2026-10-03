import { apiRequest } from "./client";
import type { Customer, CustomerListItem, CustomerStatus, CustomerWithLicenses, DeviceWithLicense, Paginated } from "../types";

export function listCustomers(params: {
  q?: string;
  status?: CustomerStatus;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<CustomerListItem>> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.status) qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  return apiRequest<Paginated<CustomerListItem>>(`/admin/customers?${qs.toString()}`);
}

export function getCustomer(id: string): Promise<CustomerWithLicenses> {
  return apiRequest<CustomerWithLicenses>(`/admin/customers/${id}`);
}

export interface CreateCustomerInput {
  name: string;
  company?: string;
  email: string;
  phone?: string;
}

export function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return apiRequest<Customer>("/admin/customers", { method: "POST", body: input });
}

export async function listCustomerDevices(customerId: string): Promise<DeviceWithLicense[]> {
  const result = await apiRequest<{ items: DeviceWithLicense[] }>(`/admin/customers/${customerId}/devices`);
  return result.items;
}
