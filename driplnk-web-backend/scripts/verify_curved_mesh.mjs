import fs from "node:fs";
import path from "node:path";
import { calculateStlVolume, calculatePartWeight } from "../utils/mesh-calc.ts";

const SCRATCH_DIR = "/home/sasa/.gemini/antigravity-ide/brain/c4394864-cb63-4628-ad09-f780aa2d93ee/scratch";

/**
 * Generate binary STL for a cylinder centered at origin with radius r and height h
 * Approximated with N segments
 */
function createCylinderStl(r, h, segments = 64) {
  const triangles = [];
  const halfH = h / 2;

  // Top and bottom center vertices
  const topCenter = [0, 0, halfH];
  const bottomCenter = [0, 0, -halfH];

  const ringTop = [];
  const ringBottom = [];

  for (let i = 0; i < segments; i++) {
    const theta = (2 * Math.PI * i) / segments;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    ringTop.push([x, y, halfH]);
    ringBottom.push([x, y, -halfH]);
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;

    // Top cap (counter-clockwise viewed from +Z)
    triangles.push([topCenter, ringTop[i], ringTop[next]]);

    // Bottom cap (counter-clockwise viewed from -Z)
    triangles.push([bottomCenter, ringBottom[next], ringBottom[i]]);

    // Side quad: split into two triangles
    // T1: bottom[i] -> bottom[next] -> top[next]
    triangles.push([ringBottom[i], ringBottom[next], ringTop[next]]);
    // T2: bottom[i] -> top[next] -> top[i]
    triangles.push([ringBottom[i], ringTop[next], ringTop[i]]);
  }

  return writeBinaryStl(triangles);
}

/**
 * Generate binary STL for a UV sphere with radius r
 * Approximated with rings x segments
 */
function createSphereStl(r, rings = 64, segments = 128) {
  const triangles = [];

  const topPole = [0, 0, r];
  const bottomPole = [0, 0, -r];

  // Vertices grid (excluding poles)
  // phi from 0 to pi (lat), theta from 0 to 2pi (lon)
  const grid = [];
  for (let i = 1; i < rings; i++) {
    const phi = (Math.PI * i) / rings;
    const ring = [];
    for (let j = 0; j < segments; j++) {
      const theta = (2 * Math.PI * j) / segments;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      ring.push([x, y, z]);
    }
    grid.push(ring);
  }

  // Top pole triangles
  for (let j = 0; j < segments; j++) {
    const next = (j + 1) % segments;
    triangles.push([topPole, grid[0][j], grid[0][next]]);
  }

  // Intermediate quads
  for (let i = 0; i < rings - 2; i++) {
    for (let j = 0; j < segments; j++) {
      const next = (j + 1) % segments;
      const v1 = grid[i][j];
      const v2 = grid[i + 1][j];
      const v3 = grid[i + 1][next];
      const v4 = grid[i][next];

      triangles.push([v1, v2, v3]);
      triangles.push([v1, v3, v4]);
    }
  }

  // Bottom pole triangles
  const lastRing = grid[grid.length - 1];
  for (let j = 0; j < segments; j++) {
    const next = (j + 1) % segments;
    triangles.push([bottomPole, lastRing[next], lastRing[j]]);
  }

  return writeBinaryStl(triangles);
}

function writeBinaryStl(triangles) {
  const buffer = Buffer.alloc(84 + triangles.length * 50);
  buffer.write("Binary STL generated for geometry verification", 0, "utf8");
  buffer.writeUInt32LE(triangles.length, 80);

  let offset = 84;
  for (const tri of triangles) {
    // Normal (0,0,0) - not strictly required by parser
    buffer.writeFloatLE(0, offset);
    buffer.writeFloatLE(0, offset + 4);
    buffer.writeFloatLE(0, offset + 8);

    // v1
    buffer.writeFloatLE(tri[0][0], offset + 12);
    buffer.writeFloatLE(tri[0][1], offset + 16);
    buffer.writeFloatLE(tri[0][2], offset + 20);

    // v2
    buffer.writeFloatLE(tri[1][0], offset + 24);
    buffer.writeFloatLE(tri[1][1], offset + 28);
    buffer.writeFloatLE(tri[1][2], offset + 32);

    // v3
    buffer.writeFloatLE(tri[2][0], offset + 36);
    buffer.writeFloatLE(tri[2][1], offset + 40);
    buffer.writeFloatLE(tri[2][2], offset + 44);

    // attribute byte count
    buffer.writeUInt16LE(0, offset + 48);

    offset += 50;
  }

  return buffer;
}

// 1. Generate and verify Cylinder (r=10mm, h=30mm)
const cylRadius = 10; // mm
const cylHeight = 30; // mm
const cylBuffer = createCylinderStl(cylRadius, cylHeight, 64);
const cylPath = path.join(SCRATCH_DIR, "ref4_cylinder_r10_h30mm.stl");
fs.writeFileSync(cylPath, cylBuffer);

const cylAnalyticalVolumeMm3 = Math.PI * Math.pow(cylRadius, 2) * cylHeight;
const cylAnalyticalVolumeCm3 = cylAnalyticalVolumeMm3 / 1000;
// Exact polyhedral volume of 64-gon cylinder
const cylPolyVolumeMm3 = (64 / 2) * Math.pow(cylRadius, 2) * Math.sin((2 * Math.PI) / 64) * cylHeight;
const cylPolyVolumeCm3 = cylPolyVolumeMm3 / 1000;

const cylResult = calculateStlVolume(cylBuffer);
const cylErrorVsPoly = Math.abs(cylResult.volumeCm3 - cylPolyVolumeCm3) / cylPolyVolumeCm3 * 100;
const cylErrorVsSmooth = Math.abs(cylResult.volumeCm3 - cylAnalyticalVolumeCm3) / cylAnalyticalVolumeCm3 * 100;

console.log("=== CYLINDER VERIFICATION ===");
console.log(`Dimensions: r=${cylRadius}mm, h=${cylHeight}mm, segments=64`);
console.log(`Triangle Count: ${cylResult.triangleCount}`);
console.log(`Smooth Analytical Volume: ${cylAnalyticalVolumeCm3.toFixed(6)} cm3`);
console.log(`Polyhedral (64-gon) Expected Volume: ${cylPolyVolumeCm3.toFixed(6)} cm3`);
console.log(`Computed Mesh Volume: ${cylResult.volumeCm3.toFixed(6)} cm3`);
console.log(`Error vs Polyhedral Target: ${cylErrorVsPoly.toFixed(6)}%`);
console.log(`Error vs Smooth Cylinder: ${cylErrorVsSmooth.toFixed(4)}% (discretization error)`);

// 2. Generate and verify Sphere (r=15mm)
const sphereRadius = 15; // mm
const sphereBuffer = createSphereStl(sphereRadius, 64, 128);
const spherePath = path.join(SCRATCH_DIR, "ref5_sphere_r15mm.stl");
fs.writeFileSync(spherePath, sphereBuffer);

const sphereAnalyticalVolumeMm3 = (4 / 3) * Math.PI * Math.pow(sphereRadius, 3);
const sphereAnalyticalVolumeCm3 = sphereAnalyticalVolumeMm3 / 1000;

const sphereResult = calculateStlVolume(sphereBuffer);
const sphereErrorVsSmooth = Math.abs(sphereResult.volumeCm3 - sphereAnalyticalVolumeCm3) / sphereAnalyticalVolumeCm3 * 100;

console.log("\n=== SPHERE VERIFICATION ===");
console.log(`Dimensions: r=${sphereRadius}mm, rings=64, segments=128`);
console.log(`Triangle Count: ${sphereResult.triangleCount}`);
console.log(`Smooth Analytical Volume: ${sphereAnalyticalVolumeCm3.toFixed(6)} cm3`);
console.log(`Computed Mesh Volume: ${sphereResult.volumeCm3.toFixed(6)} cm3`);
console.log(`Error vs Smooth Sphere: ${sphereErrorVsSmooth.toFixed(4)}%`);
console.log(`PLA Weight Expected: ${(sphereAnalyticalVolumeCm3 * 1.24).toFixed(4)} g`);
console.log(`PLA Weight Computed: ${calculatePartWeight(sphereResult.volumeCm3, "pla").toFixed(4)} g`);
