import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type AuditAction =
  | "customer.create"
  | "customer.update"
  | "license.create"
  | "license.update"
  | "license.revoke"
  | "device.deactivate"
  // Phase 1 device API actions — actorType 'device', no adminId.
  | "device.activate"
  | "device.refresh"
  // Phase 3 release management actions.
  | "release.upload"
  | "release.update"
  | "release.publish"
  | "release.unpublish"
  | "release.delete"
  // actorType 'customer', no adminId — logged from the portal download endpoint.
  | "release.download"
  // Phase 4 portal actions — all actorType 'customer', no adminId. Covers
  // the sensitive/state-changing portal actions (matching how every other
  // actor's audit trail here works — a GET/list isn't logged, only actions
  // with a real consequence or that reveal something sensitive).
  | "customer.login"
  | "customer.license.reveal_key"
  | "customer.device.deactivate";

export type AuditTargetType = "License" | "Customer" | "Device" | "Release";
export type AuditActorType = "admin" | "customer" | "device";

interface LogActionParams {
  // Required for actorType 'admin' (the default — every existing call site
  // is an admin route). Omit for 'device'/'customer' entries, which have no
  // AdminUser to attribute to.
  adminId?: string;
  actorType?: AuditActorType; // defaults to 'admin', matching the DB column's default
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records an admin action. Never throws — an audit log write failing must
 * never block the real request it's describing (issuing a license, revoking
 * one, etc. all matter far more than the log entry). Failures are logged
 * server-side only.
 */
export async function logAction(params: LogActionParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: params.adminId ?? null,
        actorType: params.actorType ?? "admin",
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (err) {
    console.error("[audit-log] failed to record action", params.action, params.targetId, err);
  }
}
