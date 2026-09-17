import type { Request } from "express";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Consistent error response shape across every endpoint:
// { error: { code: string, message: string } }
export function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

/** Route params are typed string | string[] by Express; our routes never use repeated param names. */
export function paramId(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new ApiError(400, "bad_request", `Invalid route parameter: ${name}`);
  }
  return value;
}
