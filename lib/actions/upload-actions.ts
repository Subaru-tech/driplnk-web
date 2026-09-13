"use server";

import * as actions from "@/driplnk-web-backend/actions/upload";

export type { UploadSession } from "@/driplnk-web-backend/actions/upload";

export async function getUploadSession() {
  return actions.getUploadSession();
}

export async function recordUploadedModel(args: Parameters<typeof actions.recordUploadedModel>[0]) {
  return actions.recordUploadedModel(args);
}

export async function updateModelThumbnail(args: Parameters<typeof actions.updateModelThumbnail>[0]) {
  return actions.updateModelThumbnail(args);
}

export async function recordUploadedListing(args: Parameters<typeof actions.recordUploadedListing>[0]) {
  return actions.recordUploadedListing(args);
}

export async function deleteUploadedModel(id: string) {
  return actions.deleteUploadedModel(id);
}
