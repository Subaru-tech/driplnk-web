import { NextRequest, NextResponse } from "next/server";
import { getB2Object } from "@/lib/b2-client";
import { getSupabaseServiceClient } from "@/driplnk-web-backend/db/client";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const RENDERABLE_EXTS = new Set(["stl", "obj", "glb", "gltf", "3mf", "ply", "gcode"]);

const MIME_MAP: Record<string, string> = {
  stl: "model/stl",
  obj: "text/plain",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  "3mf": "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
  ply: "text/plain",
  gcode: "text/plain",
};

function ext(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fileId = req.nextUrl.searchParams.get("fileId");

  // Each hit streams a full B2 object into memory. Rate-limit the public hot
  // path per IP before touching the database or storage (per-viewer budget:
  // 120 reads/minute, ample for the WebGL viewer's single fetch).
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

  const { data: model } = await supabase
    .from("models")
    .select("id, status, owner_id, seller_user_id, file_path, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!model) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Access gate:
  // - Published models: streamable by anyone (same-origin interactive preview)
  // - Drafts/unpublished: only the owner/seller (dashboard preview of own uploads)
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
    const { data: allFiles } = await supabase
      .from("model_files")
      .select("id, storage_path, filename, format, is_primary")
      .eq("model_id", id);

    if (allFiles && allFiles.length > 0) {
      const primary = allFiles.find((f) => f.is_primary);
      const primaryName = primary ? (primary.filename || primary.storage_path.split("/").pop() || "") : "";
      if (primary?.storage_path && RENDERABLE_EXTS.has(ext(primaryName))) {
        storagePath = primary.storage_path;
        filename = primaryName;
      } else {
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
    storagePath =
      (model as { storage_path?: string | null }).storage_path ??
      model.file_path ??
      null;
    filename = storagePath?.split("/").pop() ?? "";
  }

  if (!storagePath || !RENDERABLE_EXTS.has(ext(filename))) {
    return NextResponse.json({ error: "no_renderable_file" }, { status: 404 });
  }

  try {
    const { bytes } = await getB2Object(storagePath);
    if (!bytes) {
      return NextResponse.json({ error: "file_empty" }, { status: 404 });
    }

    const fileExt = ext(filename);
    const contentType = MIME_MAP[fileExt] || "application/octet-stream";

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        // Draft files are owner-private: never cache them publicly.
        "Cache-Control": isPublished
          ? "public, max-age=3600, stale-while-revalidate=86400"
          : "private, no-store",
      },
    });
  } catch (err) {
    // B2 free-tier daily download cap — self-heals at 00:00 GMT. Report it as
    // a retryable condition instead of a generic server error.
    if (err instanceof Error && err.message.includes("cap exceeded")) {
      return NextResponse.json(
        { error: "storage_cap_exceeded" },
        { status: 503, headers: { "Retry-After": "3600" } }
      );
    }
    console.error("Failed to stream model preview file from B2:", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
