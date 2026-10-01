// Phase 4: real customer portal authentication — replaces the Phase 3 stub
// that treated a raw license key as the credential on every request (see
// git history for that version's TODO). Sessions are httpOnly-cookie-based;
// see src/services/portalSession.ts for the cookie/JWT mechanics.

import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/errors";
import { readCustomerIdFromRequest } from "../services/portalSession";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      customerId?: string;
    }
  }
}

export function requirePortalSession(req: Request, _res: Response, next: NextFunction) {
  const customerId = readCustomerIdFromRequest(req);
  if (!customerId) {
    throw new ApiError(401, "unauthorized", "Not logged in, or your session has expired");
  }
  req.customerId = customerId;
  next();
}
