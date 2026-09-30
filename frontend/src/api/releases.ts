import { apiRequest, ApiError, getBaseUrl, getToken } from "./client";
import type { Paginated, Release, ReleaseChannel, ReleaseProduct, TierPresetName } from "../types";

export function listReleases(params: {
  product?: ReleaseProduct;
  channel?: ReleaseChannel;
  isPublished?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<Release>> {
  const qs = new URLSearchParams();
  if (params.product) qs.set("product", params.product);
  if (params.channel) qs.set("channel", params.channel);
  if (params.isPublished !== undefined) qs.set("isPublished", String(params.isPublished));
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  return apiRequest<Paginated<Release>>(`/admin/releases?${qs.toString()}`);
}

export interface UpdateReleaseInput {
  channel?: ReleaseChannel;
  notes?: string | null;
  minPlanCode?: TierPresetName | null;
  isPublished?: boolean;
}

export function updateRelease(id: string, input: UpdateReleaseInput): Promise<Release> {
  return apiRequest<Release>(`/admin/releases/${id}`, { method: "PUT", body: input });
}

export function deleteRelease(id: string): Promise<void> {
  return apiRequest<void>(`/admin/releases/${id}`, { method: "DELETE" });
}

export interface UploadFileReleaseInput {
  product: "server-win";
  version: string;
  channel: ReleaseChannel;
  notes?: string;
  minPlanCode?: TierPresetName;
  file: File;
}

export interface UploadLinkReleaseInput {
  product: "android" | "ios";
  version: string;
  channel: ReleaseChannel;
  notes?: string;
  minPlanCode?: TierPresetName;
  externalUrl: string;
}

export type UploadReleaseInput = UploadFileReleaseInput | UploadLinkReleaseInput;

/**
 * Bypasses apiRequest() — that wrapper always sends JSON, but this is
 * multipart/form-data, and fetch has no upload-progress event at all, so
 * this uses XMLHttpRequest instead. Field order in the FormData matters:
 * the backend's multer filename() callback needs `product`/`version`
 * already parsed by the time the `file` part streams in (see
 * src/routes/adminReleases.ts's comment on this) — text fields are
 * appended before `file` below for exactly that reason.
 */
export function uploadRelease(input: UploadReleaseInput, onProgress?: (fraction: number) => void): Promise<Release> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("product", input.product);
    form.append("version", input.version);
    form.append("channel", input.channel);
    if (input.notes) form.append("notes", input.notes);
    if (input.minPlanCode) form.append("minPlanCode", input.minPlanCode);
    if (input.product === "server-win") {
      form.append("file", input.file);
    } else {
      form.append("externalUrl", input.externalUrl);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getBaseUrl()}/admin/releases`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };

    xhr.onload = () => {
      let json: unknown;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        reject(new ApiError(xhr.status, "invalid_response", "Server returned an invalid response"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json as Release);
      } else {
        const body = json as { error?: { code: string; message: string } };
        reject(new ApiError(xhr.status, body.error?.code ?? "unknown_error", body.error?.message ?? "Upload failed"));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "network_error", "Could not reach the server"));

    xhr.send(form);
  });
}
