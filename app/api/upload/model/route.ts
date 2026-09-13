import { NextResponse } from "next/server";
import { getUnifiedUser } from "@/driplnk-web-backend/auth/clerk";
import { uploadModelToB2 } from "@/lib/b2-client";

// Allowlist of safe 3D model formats
export const ALLOWED_MODEL_EXTENSIONS = [".stl", ".step", ".stp", ".3mf", ".obj"];

// Max allowed file size: 50 MB
export const MAX_MODEL_FILE_BYTES = 50 * 1024 * 1024;

// Standard Anti-Virus test signature (EICAR)
const EICAR_SIGNATURE = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

// Common malicious executable magic numbers / script headers
const MALICIOUS_HEADERS = [
  { name: "Windows PE/DOS Executable (MZ)", bytes: Buffer.from([0x4d, 0x5a]) },
  { name: "Linux ELF Executable", bytes: Buffer.from([0x7f, 0x45, 0x4c, 0x46]) },
  { name: "macOS Mach-O 32-bit", bytes: Buffer.from([0xfe, 0xed, 0xfa, 0xce]) },
  { name: "macOS Mach-O 64-bit", bytes: Buffer.from([0xfe, 0xed, 0xfa, 0xcf]) },
  { name: "macOS Mach-O (Reversed)", bytes: Buffer.from([0xce, 0xfa, 0xed, 0xfe]) },
  { name: "Java Class / Mach-O Fat Binary", bytes: Buffer.from([0xca, 0xfe, 0xba, 0xbe]) },
  { name: "Shell Script Shebang", bytes: Buffer.from([0x23, 0x21]) },
];

export function verifyModelFormatMagic(ext: string, buf: Buffer): { valid: boolean; reason?: string } {
  const cleanExt = ext.replace(".", "").toLowerCase();

  // 1. Check against executable/script magic headers
  for (const sig of MALICIOUS_HEADERS) {
    if (buf.length >= sig.bytes.length && buf.subarray(0, sig.bytes.length).equals(sig.bytes)) {
      return {
        valid: false,
        reason: `Executable binary signature detected (${sig.name}). Disallowed file masquerading as .${cleanExt} rejected before storage.`,
      };
    }
  }

  // 2. Check EICAR standard test signature
  if (buf.includes(Buffer.from(EICAR_SIGNATURE))) {
    return {
      valid: false,
      reason: "Malware / virus signature detected in uploaded file (EICAR-Test-Signature). Upload rejected before storage.",
    };
  }

  // 3. Format-specific internal structure & magic checks
  if (cleanExt === "3mf") {
    // 3MF must be an Open Packaging Convention ZIP container starting with 'PK'
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
      return { valid: false, reason: "Invalid 3MF package: Missing standard ZIP (PK) container header." };
    }
    return { valid: true };
  }

  if (cleanExt === "step" || cleanExt === "stp") {
    const textPreview = buf.subarray(0, 512).toString("utf8");
    if (!textPreview.includes("ISO-10303-21") && !textPreview.includes("HEADER;")) {
      return { valid: false, reason: "Invalid STEP file: Missing 'ISO-10303-21' or 'HEADER;' Exchange Structure definition." };
    }
    return { valid: true };
  }

  if (cleanExt === "stl") {
    const textHead = buf.subarray(0, 80).toString("utf8").trim().toLowerCase();
    if (textHead.startsWith("solid")) {
      const sample = buf.subarray(0, Math.min(buf.length, 512));
      const hasNullBytes = sample.some((b) => b === 0);
      if (!hasNullBytes) {
        return { valid: true }; // Valid ASCII STL
      }
    }

    // Binary STL validation: 80 bytes header + 4 bytes uint32 triangle count + (N * 50 bytes)
    if (buf.length >= 84) {
      const triangleCount = buf.readUInt32LE(80);
      const expectedSize = 84 + triangleCount * 50;
      if (triangleCount > 0 && Math.abs(buf.length - expectedSize) <= 100) {
        return { valid: true }; // Valid Binary STL
      }
    }

    if (textHead.startsWith("solid")) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: "Invalid STL file: Header and triangle geometry do not match valid ASCII or Binary STL specifications.",
    };
  }

  if (cleanExt === "obj") {
    const textSample = buf.subarray(0, 1024).toString("utf8");
    const lines = textSample.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    const hasObjTokens = lines.some((l) => l.startsWith("v ") || l.startsWith("f ") || l.startsWith("vt ") || l.startsWith("vn "));
    if (!hasObjTokens && lines.length > 0) {
      return { valid: false, reason: "Invalid Wavefront OBJ file: Missing geometric vertex (v) or face (f) elements." };
    }
    return { valid: true };
  }

  return { valid: true };
}

export async function POST(req: Request) {
  try {
    const user = await getUnifiedUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required to upload model files." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided in request." },
        { status: 400 }
      );
    }

    const filename = file.name || "model.stl";
    const dot = filename.lastIndexOf(".");
    const ext = dot === -1 ? "" : filename.slice(dot).toLowerCase();

    // 1. Extension Allowlist Check (BEFORE STORAGE)
    if (!ALLOWED_MODEL_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: `File type '${ext || "unknown"}' is disallowed. Only 3D CAD/mesh files (${ALLOWED_MODEL_EXTENSIONS.join(
            ", "
          )}) are permitted.`,
        },
        { status: 400 }
      );
    }

    // 2. Max File Size Check (BEFORE STORAGE)
    if (file.size > MAX_MODEL_FILE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `File size (${(file.size / (1024 * 1024)).toFixed(
            2
          )} MB) exceeds the maximum allowed limit of 50 MB.`,
        },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { success: false, error: "File is empty (0 bytes)." },
        { status: 400 }
      );
    }

    // Read buffer for malware & format inspection
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Format-Specific Magic-Byte & Header Verification (BEFORE STORAGE)
    const formatCheck = verifyModelFormatMagic(ext, buffer);
    if (!formatCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          error: formatCheck.reason || `Corrupted or invalid ${ext} file signature.`,
        },
        { status: 400 }
      );
    }

    // 4. Invoke Multi-Layer Virus & Malware Scanner (ClamAV / Heuristics Edge Function)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      try {
        const scanRes = await fetch(`${supabaseUrl}/functions/v1/model-virus-scanner`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            filename,
            fileBase64: buffer.toString("base64"),
          }),
        });

        if (scanRes.ok) {
          const scanResult = await scanRes.json();
          if (!scanResult.safe) {
            return NextResponse.json(
              {
                success: false,
                error: `Security scan rejected file: ${scanResult.detectedThreat || "Potential security risk detected."}`,
              },
              { status: 400 }
            );
          }
        }
      } catch (scanErr) {
        console.warn("Edge virus scanner invocation failed, relying on primary magic-byte validation:", scanErr);
      }
    }

    // 5. File is verified safe — persist to Backblaze B2 (S3-compatible) storage bucket
    const cleanStem = filename.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40);
    const storagePath = `${user.id}/${Date.now()}-${cleanStem}${ext}`;
    const contentType = file.type || "application/octet-stream";

    const b2Upload = await uploadModelToB2(storagePath, buffer, contentType);
    if (!b2Upload.success) {
      console.error("Backblaze B2 storage upload error:", b2Upload.error);
      return NextResponse.json(
        { success: false, error: b2Upload.error || "Failed to store file in Backblaze B2." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      storagePath, // Relative object key stored in database
      filename,
      format: ext.replace(".", ""),
      fileSize: file.size,
      moderationStatus: "pending_review",
      storageProvider: "backblaze-b2",
    });
  } catch (err) {
    console.error("Upload handler error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Upload processing failed." },
      { status: 500 }
    );
  }
}
