import type { Release, ReleaseProduct as PrismaReleaseProduct } from "@prisma/client";

// The public API contract (spec'd 2026-09-30, Phase 3 kickoff) uses dashed
// product values ("server-win"). Prisma enum identifiers can't contain a
// dash, so the generated client's TS-side value is "server_win" — the
// prisma/schema.prisma @map only changes what's stored in MySQL, not this
// generated identifier (confirmed against node_modules/.prisma/client's
// output, not assumed). These helpers are the one place that difference is
// bridged; every route converts at the boundary instead of comparing raw
// strings in two different spellings in a dozen places.
export type ApiReleaseProduct = "server-win" | "android" | "ios";

const API_TO_PRISMA: Record<ApiReleaseProduct, PrismaReleaseProduct> = {
  "server-win": "server_win",
  android: "android",
  ios: "ios",
};

const PRISMA_TO_API: Record<PrismaReleaseProduct, ApiReleaseProduct> = {
  server_win: "server-win",
  android: "android",
  ios: "ios",
};

export function toPrismaProduct(value: ApiReleaseProduct): PrismaReleaseProduct {
  return API_TO_PRISMA[value];
}

export function toApiProduct(value: PrismaReleaseProduct): ApiReleaseProduct {
  return PRISMA_TO_API[value];
}

/** Release rows as Prisma returns them use the internal product spelling — always send the API spelling out. storageKey (a local disk path) is never exposed to any client. */
export function serializeRelease(release: Release) {
  const { storageKey: _storageKey, ...rest } = release;
  return { ...rest, product: toApiProduct(release.product) };
}
