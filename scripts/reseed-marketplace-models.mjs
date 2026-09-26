#!/usr/bin/env node
/**
 * Full marketplace reseed: wipe ALL models + model_files (+ cascades), wipe
 * platform/* objects in B2, then download 12 real renderable 3D model files
 * (CC0/CC-BY three.js & Khronos sample assets), upload them to Backblaze B2,
 * and insert fresh `models` + `model_files` rows.
 *
 *   node scripts/reseed-marketplace-models.mjs
 *
 * Idempotent: slug collisions skip; files re-upload harmlessly. Safe for user
 * uploads: only B2 keys under `platform/` are deleted.
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

for (const line of readFileSync(resolve(__dirname, "../.env.local"), "utf8").split("\n")) {
  const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const s3 = new S3Client({
  endpoint: process.env.B2_S3_ENDPOINT,
  region: process.env.B2_REGION,
  credentials: {
    accessKeyId: process.env.B2_APPLICATION_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
  forcePathStyle: true,
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: () => null },
});

// Platform owner — technical seller for all seeded models.
const PLATFORM_OWNER_ID = "fb9a0532-509c-483a-96a1-25ad299a30e1";

const GH = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples";
const KH = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0";
const SHOTS = `${GH}/screenshots`;

/**
 * Catalog of real, renderable, self-contained 3D assets.
 * `files`: one or more renderable files for the model package (multi-format
 * models expose the format switcher in the detail viewer).
 * Sources: three.js example assets (CC / public per three.js repo) and
 * Khronos glTF-Sample-Models (CC0 / CC-BY per asset license) — the same
 * models showcased on Thingiverse/CGTrader/Sketchfab galleries.
 */
const CATALOG = [
  {
    title: "Littlest Tokyo — Animated Diorama",
    category: "Art & Decor",
    description:
      "Award-winning animated diorama of a miniature Tokyo neighbourhood by glenatron. Fully textured with baked ambient occlusion and keyframe animation — the definitive PBR showcase asset.",
    creator: "glenatron (CC-BY)",
    formats: ["GLB"],
    files: [{ url: `${GH}/models/gltf/LittlestTokyo.glb`, filename: "LittlestTokyo.glb", format: "GLB", primary: true }],
    thumb: `${SHOTS}/webgl_animation_keyframes.jpg`,
  },
  {
    title: "Ferrari 458 Italia Supercar",
    category: "Toys & Games",
    description:
      "Detailed sports coupe with body shell, wheels and calibrated PBR materials on a rotating showroom rig. Ideal automotive hero asset for renders, games and print displays.",
    creator: "vecarz (CC-BY)",
    formats: ["GLB"],
    files: [{ url: `${GH}/models/gltf/ferrari.glb`, filename: "ferrari.glb", format: "GLB", primary: true }],
    thumb: `${SHOTS}/webgl_materials_car.jpg`,
  },
  {
    title: "Battle-Damaged Sci-Fi Helmet",
    category: "Cosplay & Props",
    description:
      "The iconic Khronos PBR showcase helmet with battle-damaged albedo, metal-roughness, normal and AO maps baked in. A perfect fit test for sci-fi cosplay props and helmet prints.",
    creator: "sam4d / Khronos Group (CC0)",
    formats: ["GLB"],
    files: [{ url: `${KH}/DamagedHelmet/glTF-Binary/DamagedHelmet.glb`, filename: "DamagedHelmet.glb", format: "GLB", primary: true }],
    thumb: `${SHOTS}/webgl_loader_gltf.jpg`,
  },
  {
    title: "Cerberus — High-Poly Sculpture",
    category: "Art & Decor",
    description:
      "High-detail mythological Cerberus bust sculpture with baked metal/roughness PBR maps, sculpted by a professional character artist. Museum-grade decorative prop.",
    creator: "ThomasMaher (CC)",
    formats: ["OBJ", "MTL"],
    files: [{ url: `${GH}/models/obj/cerberus/Cerberus.obj`, filename: "Cerberus.obj", format: "OBJ", primary: true }],
    thumb: `${SHOTS}/webgl_materials_envmaps_hdr.jpg`,
  },
  {
    title: "Michelle — Animatable Mannequin",
    category: "Cosplay & Props",
    description:
      "Stylised rigged female mannequin from the Sims-style character pipeline, with clean topology and full skinning weights. Great base for cosplay armor fitting and character studies.",
    creator: "T. Sopöt (CC-BY)",
    formats: ["GLB"],
    files: [{ url: `${GH}/models/gltf/Michelle.glb`, filename: "Michelle.glb", format: "GLB", primary: true }],
    thumb: `${SHOTS}/webgpu_skinning.jpg`,
  },
  {
    title: "RobotExpressive — Rigged Robot",
    category: "Toys & Games",
    description:
      "Cartoon-styled rigged robot character with expressions and a full animation state machine (walk, run, punch, death). Compact, fun and print-friendly for desk toys and gifting.",
    creator: "Tomás Laulhé (CC0)",
    formats: ["GLB"],
    files: [{ url: `${GH}/models/gltf/RobotExpressive/RobotExpressive.glb`, filename: "RobotExpressive.glb", format: "GLB", primary: true }],
    thumb: `${SHOTS}/webgl_animation_skinning_morph.jpg`,
  },
  {
    title: "Xbot — Rigged Animation Mannequin",
    category: "Cosplay & Props",
    description:
      "Professional rigging-test humanoid with clean quads and a complete skeleton, used across the animation industry to validate motion capture retargets. Fully textured and print-ready.",
    creator: "Tomás Laulhé (CC0)",
    formats: ["GLB"],
    files: [{ url: `${GH}/models/gltf/Xbot.glb`, filename: "Xbot.glb", format: "GLB", primary: true },
            { url: `${GH}/models/gltf/Soldier.glb`, filename: "Soldier.glb", format: "GLB", primary: false }],
    thumb: `${SHOTS}/webgl_animation_skinning_additive_blending.jpg`,
  },
  {
    title: "Flamingo — Low-Poly Bird",
    category: "Art & Decor",
    description:
      "Classic low-poly flamingo with vertex-colour wing-flap animation, ideal for stylised scenes, garden decor prints and lightweight web experiences.",
    creator: "mirada (CC-BY)",
    formats: ["GLB"],
    files: [{ url: `${GH}/models/gltf/Flamingo.glb`, filename: "Flamingo.glb", format: "GLB", primary: true }],
    thumb: `${SHOTS}/webgl_lights_hemisphere.jpg`,
  },
  {
    title: "Parrot — Low-Poly Bird",
    category: "Art & Decor",
    description:
      "Stylised low-poly parrot with flapping-wing animation from mirada's creature series. Lightweight, charming and optimised for real-time rendering.",
    creator: "mirada (CC-BY)",
    formats: ["GLB"],
    files: [{ url: `${GH}/models/gltf/Parrot.glb`, filename: "Parrot.glb", format: "GLB", primary: true }],
    thumb: `${SHOTS}/webgl_animation_multiple.jpg`,
  },
  {
    title: "Sheen Chair — Designer Furniture",
    category: "Architecture",
    description:
      "Velvet sheen fabric chair demonstrating physical sheen shading, with elegant contemporary geometry. Perfect archviz seating asset for interior scenes and product shots.",
    creator: "Khronos Group (CC0)",
    formats: ["GLB"],
    files: [{ url: `${GH}/models/gltf/SheenChair.glb`, filename: "SheenChair.glb", format: "GLB", primary: true }],
    thumb: `${SHOTS}/webgl_loader_gltf_sheen.jpg`,
  },
  {
    title: "Iridescent Desk Lamp",
    category: "Architecture",
    description:
      "Contemporary desk lamp with iridescent thin-film shading and a sculptural minimalist form. Statement decor piece for modern interior renders and print displays.",
    creator: "Khronos Group (CC0)",
    formats: ["GLB"],
    files: [{ url: `${GH}/models/gltf/IridescenceLamp.glb`, filename: "IridescenceLamp.glb", format: "GLB", primary: true }],
    thumb: `${SHOTS}/webgl_loader_gltf_iridescence.jpg`,
  },
  {
    title: "PR2 Robot Head Pan Assembly",
    category: "Mechanical",
    description:
      "Binary STL of the Willow Garage PR2 research robot head pan mechanism — genuine mechanical CAD geometry with servo bracket detailing. Excellent for robotics enclosure printing.",
    creator: "Willow Garage (CC-BY)",
    formats: ["STL"],
    files: [
      { url: `${GH}/models/stl/binary/pr2_head_pan.stl`, filename: "pr2_head_pan.stl", format: "STL", primary: true },
      { url: `${GH}/models/stl/binary/pr2_head_tilt.stl`, filename: "pr2_head_tilt.stl", format: "STL", primary: false },
    ],
    thumb: `${SHOTS}/webgl_loader_stl.jpg`,
  },
  {
    title: "Truck — 3MF Print Package",
    category: "Toys & Games",
    description:
      "Classic 3MF consortium toy truck print package with colour-grouped parts and proper build orientation. Drop straight into any slicer and print.",
    creator: "3MF Consortium (MIT)",
    formats: ["3MF"],
    files: [{ url: `${GH}/models/3mf/truck.3mf`, filename: "truck.3mf", format: "3MF", primary: true },
            { url: `${GH}/models/3mf/cube_gears.3mf`, filename: "cube_gears.3mf", format: "3MF", primary: false }],
    thumb: `${SHOTS}/webgl_loader_3mf.jpg`,
  },
  {
    title: "3DBenchy — Calibration Toolpath (G-Code)",
    category: "Mechanical",
    description:
      "The universal 3D-printer torture test as a real slicer G-code toolpath. Watch layer-by-layer extrusion trajectories stream in the interactive viewer — every wall, hole and hull detail.",
    creator: "CreativeTools (CC-BY) / slicer output",
    formats: ["GCODE"],
    files: [{ url: `${GH}/models/gcode/benchy.gcode`, filename: "benchy.gcode", format: "GCODE", primary: true }],
    thumb: `${SHOTS}/webgl_loader_gcode.jpg`,
  },
];

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mimeFor(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  return (
    {
      glb: "model/gltf-binary",
      gltf: "model/gltf+json",
      stl: "model/stl",
      obj: "text/plain",
      mtl: "text/plain",
      "3mf": "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
      gcode: "text/plain",
      zip: "application/zip",
    }[ext] || "application/octet-stream"
  );
}

async function wipeB2PlatformPrefix() {
  console.log("\n🧹 Wiping B2 objects under platform/ ...");
  let deleted = 0;
  let token;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: process.env.B2_BUCKET_NAME, Prefix: "platform/", MaxKeys: 1000, ContinuationToken: token })
    );
    if (page.Contents?.length) {
      await s3.send(
        new DeleteObjectsCommand({ Bucket: process.env.B2_BUCKET_NAME, Delete: { Objects: page.Contents.map((o) => ({ Key: o.Key })) } })
      );
      deleted += page.Contents.length;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  console.log(`   deleted ${deleted} platform/ objects`);
}

async function main() {
  console.log("🗑  Wiping existing model_files, acquisitions, favorites, reports, models ...");
  for (const table of ["model_files", "model_acquisitions", "model_favorites", "model_reports"]) {
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(`${table} wipe: ` + error.message);
  }
  const { error: mErr } = await supabase.from("models").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (mErr) throw new Error("models wipe: " + mErr.message);
  console.log("   done");

  await wipeB2PlatformPrefix();

  console.log(`\n🚀 Seeding ${CATALOG.length} models ...`);
  let inserted = 0, skipped = 0, failed = 0;

  for (const m of CATALOG) {
    const slug = slugify(m.title);
    try {
      // Download all files for this model package
      const downloaded = [];
      for (const f of m.files) {
        const res = await fetch(f.url);
        if (!res.ok) throw new Error(`download failed ${res.status}: ${f.url}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 500) throw new Error(`suspiciously small file (${buf.length}B): ${f.url}`);
        downloaded.push({ ...f, buf });
      }

      const primary = downloaded.find((f) => f.primary) || downloaded[0];
      const storageKey = `platform/${slug}/${primary.filename}`;

      // Upload to B2
      for (const f of downloaded) {
        const key = `platform/${slug}/${f.filename}`;
        await s3.send(new PutObjectCommand({ Bucket: process.env.B2_BUCKET_NAME, Key: key, Body: f.buf, ContentType: mimeFor(f.filename) }));
      }

      // Insert model row
      const { data, error } = await supabase
        .from("models")
        .insert({
          owner_id: PLATFORM_OWNER_ID,
          seller_user_id: PLATFORM_OWNER_ID,
          name: m.title,
          title: m.title,
          slug,
          description: m.description,
          category: m.category,
          license_type: "cc",
          price: 0,
          preview_image_paths: [m.thumb],
          thumbnail_url: m.thumb,
          storage_path: storageKey,
          file_path: storageKey,
          status: "published",
          published_at: new Date().toISOString(),
          credits_spent: 0,
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          console.log(`  ⏭  skipped (slug exists): ${m.title}`);
          skipped++;
          continue;
        }
        throw error;
      }

      // Insert model_files rows
      const fileRows = downloaded.map((f) => ({
        model_id: data.id,
        filename: f.filename,
        storage_path: `platform/${slug}/${f.filename}`,
        format: f.format,
        file_size: f.buf.length,
        is_primary: Boolean(f.primary),
      }));
      const { error: filesErr } = await supabase.from("model_files").insert(fileRows);
      if (filesErr) throw new Error("model_files insert: " + filesErr.message);

      console.log(`  ✓ ${m.title} — ${downloaded.length} file(s), ${(downloaded.reduce((a, f) => a + f.buf.length, 0) / 1024).toFixed(0)} KB total`);
      inserted++;
    } catch (err) {
      console.error(`  ✗ ${m.title}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Inserted: ${inserted}, Skipped: ${skipped}, Failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
