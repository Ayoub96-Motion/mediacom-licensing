// Public landing page's request-access form (landing/src/pages/SignupPage.tsx).
// Called from a browser on env.landingUrl — see the CORS setup in src/app.ts.
//
// Creates a Customer with status "pending"; an admin approves it from the
// dashboard's Pending Requests list by issuing a license, which flips the
// customer to "active" (src/routes/adminLicenses.ts). A pending customer
// cannot log in to the portal (src/routes/portalAuth.ts) until then.

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { publicSignupRateLimit } from "../middleware/rateLimit";
import { signupRequestSchema } from "../schemas";
import { sendSignupRequestNotification } from "../lib/email";
import { logAction } from "../utils/auditLog";

export const publicSignupRouter = Router();

const GENERIC_MESSAGE = "Thanks — we've received your request and will be in touch shortly.";

// Same response whether the email was new, already pending, or already an
// active customer — same no-enumeration principle as the portal's
// request-link endpoint. An existing ACTIVE customer's row is never touched
// (an unauthenticated form must not be able to rename a real customer or
// downgrade them to pending); an existing PENDING row is refreshed with the
// latest submission, since nothing about it has been acted on yet.
publicSignupRouter.post(
  "/signup-request",
  publicSignupRateLimit,
  asyncHandler(async (req, res) => {
    const { name, email, company, teamSize } = signupRequestSchema.parse(req.body);

    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing && existing.status === "active") {
      res.status(202).json({ message: GENERIC_MESSAGE });
      return;
    }

    const customer = await prisma.customer.upsert({
      where: { email },
      create: { name, email, company, teamSize, status: "pending" },
      update: { name, company, teamSize },
    });

    await logAction({
      actorType: "customer",
      action: existing ? "customer.signup_request.update" : "customer.signup_request",
      targetType: "Customer",
      targetId: customer.id,
      metadata: { name, email, company, teamSize },
    });

    // Only on a genuinely new request — a resubmission of an already-pending
    // one doesn't need to ping admins again.
    if (!existing) {
      const admins = await prisma.adminUser.findMany({ select: { email: true } });
      await sendSignupRequestNotification({
        to: admins.map((a) => a.email),
        name,
        email,
        company,
        teamSize,
      });
    }

    res.status(202).json({ message: GENERIC_MESSAGE });
  })
);
