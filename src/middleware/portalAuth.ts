// Customer portal authentication — server-side sessions (see
// src/services/portalSession.ts). Replaced a stateless-JWT version after a
// security review found logout couldn't actually revoke a JWT, only clear
// the client's copy of it.

import type { NextFunction, Request, Response } from "express";
import type { PortalSession } from "@prisma/client";
import { asyncHandler } from "./errorHandler";
import { ApiError } from "../lib/errors";
import { resolvePortalSession } from "../services/portalSession";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      customerId?: string;
      // Exposed (not just customerId) so routes that need the session's own
      // metadata — currently just createdAt, for the reveal-key freshness
      // check — don't need a second lookup.
      portalSession?: PortalSession;
    }
  }
}

export const requirePortalSession = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const session = await resolvePortalSession(req);
  if (!session) {
    throw new ApiError(401, "unauthorized", "Not logged in, or your session has expired");
  }
  req.customerId = session.customerId;
  req.portalSession = session;
  next();
});
