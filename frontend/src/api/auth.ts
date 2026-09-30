import { apiRequest } from "./client";
import type { LoginResponse } from "../types";

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/admin/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}
