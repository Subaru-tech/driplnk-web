#!/usr/bin/env node
/**
 * Full marketplace reseed: wipe ONLY platform-owned models (+ children), wipe
 * platform/* objects in B2, then download real renderable 3D model files
 * (public-domain NASA + MIT 3MF samples), upload them to Backblaze B2,
 * and insert fresh `models` + `model_files` rows.
 *
 *   node scripts/reseed-marketplace-models.mjs
 *
 * Idempotent: slug collisions skip; files re-upload harmlessly. Safe for user
 * uploads: only B2 keys under `platform/` are deleted and only platform-owned
 * DB rows are wiped.
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

// Platform owner — technical seller for all seeded models. Dedicated headless
// profile (role: seller, shadow auth.users row via sync_clerk_user_profile) so
// seeded listings don't display a personal account name on the marketplace.
const PLATFORM_OWNER_ID = "d1ea0000-0000-4000-8000-00000000d1ea"; // "DripLnk Studio"

/**
 * Catalog of real, renderable, print-friendly 3D assets — launch strategy:
 * functional/utility first (they convert to downloads), educational mechanisms
 * second (student audience + AI-generation demo loop), a few display models.
 * Sources: NASA 3D-Resources (public domain — real ISS-printed tooling and
 * spacecraft hardware) and 3MF Consortium samples (MIT). No branded/licensed
 * models (IP risk); no multi-material/support-heavy prints (bad first claim).
 * Thumbnails intentionally omitted — cards show the live 3D hover preview and
 * the viewer backfills thumbnails when the owner opens the detail page.
 */
const NASA = "https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Printing";
const M3 = "https://raw.githubusercontent.com/3MFConsortium/3mf-samples/master/examples";
const CATALOG = [
  /* ── Functional / utility (60-70%) ─────────────────────────────────────── */
  {
    title: "ISS Wrench — Orbitally-Printed Tool",
    category: "Tools & Jigs",
    description:
      "The wrench NASA emailed to the International Space Station in 2014 and printed on orbit — the first tool ever manufactured in space. Single-material, no supports, prints on any machine. A proven functional print.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [{ url: `${NASA}/Wrench/Wrench.stl`, filename: "wrench.stl", format: "STL", primary: true }],
  },
  {
    title: "ISS Wire Tie Tool",
    category: "Tools & Jigs",
    description:
      "Wire-tie tool from the ISS toolset printed aboard the station. Practical workshop utility for securing cable bundles and looms — strong in PLA or PETG at 4+ perimeters.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [{ url: `${NASA}/International%20Space%20Station%20Tools/021%20-%20Wire%20Tie.stl`, filename: "wire-tie-tool.stl", format: "STL", primary: true }],
  },
  {
    title: "Multi-Purpose Precision Maintenance Tool",
    category: "Tools & Jigs",
    description:
      "NASA's multi-function maintenance tool combining several hand-tool profiles in one printable body. A great first functional print: flat on the bed, minimal infill tuning needed.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [{ url: `${NASA}/Multi-Purpose%20Precision%20Maintenance%20Tool/Multi-Purpose%20Precision%20Maintenance%20Tool.stl`, filename: "precision-maintenance-tool.stl", format: "STL", primary: true }],
  },
  {
    title: "ISS Mechanical Test Coupon Kit",
    category: "Tools & Jigs",
    description:
      "Tensile, compression and range coupons from the ISS print-quality program. Print them, break them, compare — the standard way to calibrate a new printer or material. Three-file kit.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [
      { url: `${NASA}/International%20Space%20Station%20Tools/004%20-%20Tensile.stl`, filename: "tensile-coupon.stl", format: "STL", primary: true },
      { url: `${NASA}/International%20Space%20Station%20Tools/005%20-%20Compression.stl`, filename: "compression-coupon.stl", format: "STL", primary: false },
      { url: `${NASA}/International%20Space%20Station%20Tools/007%20-%20Range.stl`, filename: "range-coupon.stl", format: "STL", primary: false },
    ],
  },
  {
    title: "ISS Torque Calibration Tool",
    category: "Tools & Jigs",
    description:
      "Torque-check tool from the ISS station toolset — printed hardware used to verify fastener tightness in microgravity. Chunky, single-material and support-free.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [{ url: `${NASA}/International%20Space%20Station%20Tools/008%20-%20Torque.stl`, filename: "torque-tool.stl", format: "STL", primary: true }],
  },
  {
    title: "ISS Crew Provisioning Kit Part",
    category: "Tools & Jigs",
    description:
      "Crew-provisioning hardware from the ISS printed-parts log — everyday utility hardware manufactured on demand aboard the station. Proof that “useful” is the killer app of 3D printing.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [{ url: `${NASA}/International%20Space%20Station%20Tools/009%20-%20ISS%20Crew.stl`, filename: "iss-crew-kit.stl", format: "STL", primary: true }],
  },
  {
    title: "Zero-G Print Fixture",
    category: "Tools & Jigs",
    description:
      "Zero-gravity handling fixture from NASA's in-orbit print catalogue. Small, fast to print, and a genuine piece of space-manufacturing history for your workshop.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [{ url: `${NASA}/International%20Space%20Station%20Tools/011%20-%20ZeroG1.stl`, filename: "zerog-fixture.stl", format: "STL", primary: true }],
  },
  {
    title: "Mars 2020 Sample Tube — Functional Replica",
    category: "Mechanical",
    description:
      "Printable replica of the Perseverance sample-sealing tube geometry — screw-fit threads and sealing surfaces modeled from the flight design. Print it and study how NASA engineers thread-seal a sample container.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [{ url: `${NASA}/Mars%202020%20sample%20tube/Mars%202020%20sample%20tube.stl`, filename: "sample-tube.stl", format: "STL", primary: true }],
  },
  {
    title: "Ka-Band Terminal Positioner Assembly",
    category: "Mechanical",
    description:
      "Positioner arm, body and post from NASA's Alphasat Ka-band terminal — real antenna-pointing hardware you can print, pin together and animate. Three-part mechanical kit.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [
      { url: `${NASA}/Ka-Band%20Satellite%20Beacon%20Receiver/Alphasat%20Terminal%20-%20Positioner%20Arm.stl`, filename: "positioner-arm.stl", format: "STL", primary: true },
      { url: `${NASA}/Ka-Band%20Satellite%20Beacon%20Receiver/Alphasat%20Terminal%20-%20Positioner%20Body.stl`, filename: "positioner-body.stl", format: "STL", primary: false },
      { url: `${NASA}/Ka-Band%20Satellite%20Beacon%20Receiver/Alphasat%20Terminal%20-%20Post.stl`, filename: "positioner-post.stl", format: "STL", primary: false },
    ],
  },
  {
    title: "Ka-Band Reflector Mount Kit",
    category: "Mechanical",
    description:
      "Reflector, mount and antenna feed from the Alphasat terminal — authentic satellite-communication hardware geometry. Pairs with the positioner assembly to build the full terminal.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [
      { url: `${NASA}/Ka-Band%20Satellite%20Beacon%20Receiver/Alphasat%20Terminal%20-%20Ka-Band%20Reflector%20Mount.stl`, filename: "reflector-mount.stl", format: "STL", primary: true },
      { url: `${NASA}/Ka-Band%20Satellite%20Beacon%20Receiver/Alphasat%20Terminal%20-%20Ka-Band%20Reflector.stl`, filename: "reflector.stl", format: "STL", primary: false },
      { url: `${NASA}/Ka-Band%20Satellite%20Beacon%20Receiver/Alphasat%20Terminal%20-%20Antenna%20Feed.stl`, filename: "antenna-feed.stl", format: "STL", primary: false },
    ],
  },
  {
    title: "Deep Space Network Antenna Components",
    category: "Mechanical",
    description:
      "Azimuth track and alidade sections from the Beam Waveguide antenna — the actual mounting hardware that steers NASA's Deep Space Station dishes. Structurally chunky, prints without supports.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [
      { url: `${NASA}/Beam%20Waveguide%20Deep%20Space%20Station%20Antenna/Azimuth%20track.stl`, filename: "azimuth-track.stl", format: "STL", primary: true },
      { url: `${NASA}/Beam%20Waveguide%20Deep%20Space%20Station%20Antenna/Upper%20alidade.stl`, filename: "upper-alidade.stl", format: "STL", primary: false },
      { url: `${NASA}/Beam%20Waveguide%20Deep%20Space%20Station%20Antenna/Lower%20alidade.stl`, filename: "lower-alidade.stl", format: "STL", primary: false },
    ],
  },
  {
    title: "CubeSat 1U Structural Kit",
    category: "Robotics",
    description:
      "Bottom, middle and top structure of a 1U CubeSat — the standard 10cm research-satellite bus used by university teams worldwide. Print the frame for your own avionics mockup or student robotics project.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [
      { url: `${NASA}/CubeSat/CubeSat%20bottom.stl`, filename: "cubesat-bottom.stl", format: "STL", primary: true },
      { url: `${NASA}/CubeSat/CubeSat%20middle.stl`, filename: "cubesat-middle.stl", format: "STL", primary: false },
      { url: `${NASA}/CubeSat/CubeSat%20top.stl`, filename: "cubesat-top.stl", format: "STL", primary: false },
    ],
  },
  {
    title: "Chandra Observatory Component Kit",
    category: "Educational",
    description:
      "Base, cover, cylinder and top of the Chandra X-ray Observatory, split into printable sub-assemblies. Explore how the flight telescope breaks down into modular components.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [
      { url: `${NASA}/Chandra%20X-ray%20Observatory/Chandra%20base.stl`, filename: "chandra-base.stl", format: "STL", primary: true },
      { url: `${NASA}/Chandra%20X-ray%20Observatory/Chandra%20cover.stl`, filename: "chandra-cover.stl", format: "STL", primary: false },
      { url: `${NASA}/Chandra%20X-ray%20Observatory/Chandra%20cylinder.stl`, filename: "chandra-cylinder.stl", format: "STL", primary: false },
      { url: `${NASA}/Chandra%20X-ray%20Observatory/Chandra%20top.stl`, filename: "chandra-top.stl", format: "STL", primary: false },
    ],
  },

  /* ── Educational / hobbyist (mechanisms, print-in-place demos) ────────── */
  {
    title: "Cube Gears — Planetary Reduction Demo",
    category: "Educational",
    description:
      "The classic print-in-place planetary gear cube: gears mesh inside a printed cage with zero assembly. The definitive demonstration that a 3D printer can make moving mechanisms in one pass.",
    creator: "3MF Consortium (MIT)",
    formats: ["3MF"],
    files: [{ url: `${M3}/core/cube_gears.3mf`, filename: "cube-gears.3mf", format: "3MF", primary: true }],
  },
  {
    title: "Heart Gears — Print-in-Place Gear Train",
    category: "Educational",
    description:
      "Heart-shaped planetary gear train that rotates straight off the bed, no assembly. Print one for your desk, print ten for a mechanisms classroom demo.",
    creator: "3MF Consortium (MIT)",
    formats: ["3MF"],
    files: [{ url: `${M3}/core/heartgears.3mf`, filename: "heart-gears.3mf", format: "3MF", primary: true }],
  },
  {
    title: "DodecaChain Loop — Kinematic Mechanism",
    category: "Educational",
    description:
      "Closed loop of linked dodecahedra printed in place — a flexible chain from a rigid material. Includes a colour-grouped variant for multi-colour printers. Great topology and tolerance lesson.",
    creator: "3MF Consortium (MIT)",
    formats: ["3MF"],
    files: [
      { url: `${M3}/core/dodeca_chain_loop.3mf`, filename: "dodeca-chain-loop.3mf", format: "3MF", primary: true },
      { url: `${M3}/material/dodeca_chain_loop_color.3mf`, filename: "dodeca-chain-loop-color.3mf", format: "3MF", primary: false },
    ],
  },
  {
    title: "Spinal Implant Lattice Study",
    category: "Educational",
    description:
      "Beam-lattice vertebral implant geometry demonstrating 3MF's beam-lattice extension — the same lattice techniques used in real osseointegrated implants. Study lightweight internal structures.",
    creator: "3MF Consortium (MIT)",
    formats: ["3MF"],
    files: [{ url: `${M3}/beam%20lattice/spinal%20implant.3mf`, filename: "spinal-lattice.3mf", format: "3MF", primary: true }],
  },
  {
    title: "LISA Spacecraft Assembly Kit",
    category: "Educational",
    description:
      "Base, top, solar panel and telescope of the LISA gravitational-wave observatory demonstrator. Four printable modules that stack into the full spacecraft — a hands-on mission-design lesson.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [
      { url: `${NASA}/Laser%20Interferometer%20Space%20Antenna%20(LISA)/Spacecraft%20base.stl`, filename: "lisa-base.stl", format: "STL", primary: true },
      { url: `${NASA}/Laser%20Interferometer%20Space%20Antenna%20(LISA)/Spacecraft%20top.stl`, filename: "lisa-top.stl", format: "STL", primary: false },
      { url: `${NASA}/Laser%20Interferometer%20Space%20Antenna%20(LISA)/Solar%20panel.stl`, filename: "lisa-solar-panel.stl", format: "STL", primary: false },
      { url: `${NASA}/Laser%20Interferometer%20Space%20Antenna%20(LISA)/Telescope.stl`, filename: "lisa-telescope.stl", format: "STL", primary: false },
    ],
  },

  /* ── Decorative / display (keep small) ────────────────────────────────── */
  {
    title: "Hubble Space Telescope Display Model",
    category: "Art & Decor",
    description:
      "Multi-part display model of history's most famous telescope: body, solar arrays, dishes, base and hatch. Prints in six small pieces that assemble without hardware.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [
      { url: `${NASA}/Hubble%20Space%20Telescope/Main%20body.stl`, filename: "hubble-body.stl", format: "STL", primary: true },
      { url: `${NASA}/Hubble%20Space%20Telescope/Solar%20panels.stl`, filename: "hubble-solar-panels.stl", format: "STL", primary: false },
      { url: `${NASA}/Hubble%20Space%20Telescope/Radio%20dishes.stl`, filename: "hubble-dishes.stl", format: "STL", primary: false },
      { url: `${NASA}/Hubble%20Space%20Telescope/Base.stl`, filename: "hubble-base.stl", format: "STL", primary: false },
      { url: `${NASA}/Hubble%20Space%20Telescope/Body%20coupler.stl`, filename: "hubble-coupler.stl", format: "STL", primary: false },
      { url: `${NASA}/Hubble%20Space%20Telescope/Cover%20hatch.stl`, filename: "hubble-hatch.stl", format: "STL", primary: false },
    ],
  },
  {
    title: "Orion Capsule with Display Stand",
    category: "Art & Decor",
    description:
      "NASA's crew capsule on its display stand — the spacecraft that will return humans to the Moon. Two prints: the capsule and a canted stand that holds it at display angle.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [
      { url: `${NASA}/Orion%20Capsule/Orion%20Capsule%20(no%20fbc).stl`, filename: "orion-capsule.stl", format: "STL", primary: true },
      { url: `${NASA}/Orion%20Capsule/Orion%20Capsule%20(stand).stl`, filename: "orion-stand.stl", format: "STL", primary: false },
    ],
  },
  {
    title: "Saturn V Rocket — Five-Stage Kit",
    category: "Art & Decor",
    description:
      "The Moon rocket as a six-part stacking kit: S-IC, S-II and S-IVB stages plus command module and escape tower. Print stage by stage and build history on your desk.",
    creator: "NASA (public domain)",
    formats: ["STL"],
    files: [
      { url: `${NASA}/Saturn%20V%20Rocket/S-IC%20bottom.stl`, filename: "saturn-v-s1c-bottom.stl", format: "STL", primary: true },
      { url: `${NASA}/Saturn%20V%20Rocket/S-IC%20top.stl`, filename: "saturn-v-s1c-top.stl", format: "STL", primary: false },
      { url: `${NASA}/Saturn%20V%20Rocket/S-II.stl`, filename: "saturn-v-s2.stl", format: "STL", primary: false },
      { url: `${NASA}/Saturn%20V%20Rocket/S-IV%20b.stl`, filename: "saturn-v-s4b.stl", format: "STL", primary: false },
      { url: `${NASA}/Saturn%20V%20Rocket/command%20moduel.stl`, filename: "saturn-v-command-module.stl", format: "STL", primary: false },
      { url: `${NASA}/Saturn%20V%20Rocket/escape%20tower.stl`, filename: "saturn-v-escape-tower.stl", format: "STL", primary: false },
    ],
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
  console.log("🗑  Wiping platform-owned models + related rows (user uploads untouched) ...");
  // ponytail note: reseed must NEVER delete user uploads — every wipe below is
  // scoped to PLATFORM_OWNER_ID's rows, children first via model_id membership.
  const { data: own } = await supabase.from("models").select("id").eq("owner_id", PLATFORM_OWNER_ID);
  const ownIds = (own ?? []).map((r) => r.id);
  if (ownIds.length > 0) {
    for (const table of ["model_files", "model_acquisitions", "model_favorites", "model_reports"]) {
      const { error } = await supabase.from(table).delete().in("model_id", ownIds);
      if (error) throw new Error(`${table} wipe: ` + error.message);
    }
    const { error: mErr } = await supabase.from("models").delete().in("id", ownIds);
    if (mErr) throw new Error("models wipe: " + mErr.message);
  }
  console.log(`   removed ${ownIds.length} platform-owned model(s)`);

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
