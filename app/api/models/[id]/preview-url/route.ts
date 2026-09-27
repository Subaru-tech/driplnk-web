import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/driplnk-web-backend/db/client";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// Formats renderable by the Three.js ModelViewer
const RENDERABLE_EXTS = new Set(["stl", "obj", "glb", "gltf", "3mf", "ply", "gcode"]);

function ext(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fileId = req.nextUrl.searchParams.get("fileId");

  // Cheap route (no storage fetch), but it precedes every /file hit — keep it
  // inside the same per-IP budget so it can't be hammered for DB lookups.
  const rl = rateLimit(`file:${clientIp(req.headers)}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  // Service client: draft rows are RLS-hidden from anon sessions (Clerk-only
  // users have no Supabase session), so ownership is enforced by the gate below
  // instead of by RLS — same pattern as getCreatorStudioModels.
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  // Resolve preview for published models, or for the owner's own drafts
  // (dashboard preview of uploaded-but-unpublished files).
  const { data: model } = await supabase
    .from("models")
    .select("id, status, owner_id, seller_user_id, file_path, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!model) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const isPublished = model.status === "published";
  if (!isPublished) {
    const user = await getUnifiedUser();
    const isOwner = Boolean(user && user.id && (user.id === model.owner_id || user.id === model.seller_user_id));
    if (!isOwner) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  let storagePath: string | null = null;
  let filename = "";

  if (fileId) {
    // Specific file requested
    const { data: file } = await supabase
      .from("model_files")
      .select("id, storage_path, filename, format")
      .eq("id", fileId)
      .eq("model_id", id)
      .maybeSingle();

    if (file?.storage_path) {
      storagePath = file.storage_path;
      filename = file.filename || file.storage_path.split("/").pop() || "";
    }
  }

  if (!storagePath) {
    // Query all model_files for this model
    const { data: allFiles } = await supabase
      .from("model_files")
      .select("id, storage_path, filename, format, is_primary")
      .eq("model_id", id);

    if (allFiles && allFiles.length > 0) {
      // 1. Try primary file if renderable
      const primary = allFiles.find((f) => f.is_primary);
      const primaryName = primary ? (primary.filename || primary.storage_path.split("/").pop() || "") : "";
      if (primary?.storage_path && RENDERABLE_EXTS.has(ext(primaryName))) {
        storagePath = primary.storage_path;
        filename = primaryName;
      } else {
        // 2. Find any renderable file
        const renderable = allFiles.find((f) => {
          const fn = f.filename || f.storage_path?.split("/").pop() || "";
          return f.storage_path && RENDERABLE_EXTS.has(ext(fn));
        });
        if (renderable?.storage_path) {
          storagePath = renderable.storage_path;
          filename = renderable.filename || renderable.storage_path.split("/").pop() || "";
        }
      }
    }
  }

  if (!storagePath) {
    // Fall back to model-level path
    storagePath =
      (model as { storage_path?: string | null }).storage_path ??
      model.file_path ??
      null;
    filename = storagePath?.split("/").pop() ?? "";
  }

  if (!storagePath || !RENDERABLE_EXTS.has(ext(filename))) {
    return NextResponse.json({ error: "no_renderable_file" }, { status: 404 });
  }

  // Return same-origin proxy URL so Three.js can fetch the model without CORS errors
  const url = `/api/models/${id}/file${fileId ? `?fileId=${encodeURIComponent(fileId)}` : ""}`;
  return NextResponse.json({ url, filename });
}
