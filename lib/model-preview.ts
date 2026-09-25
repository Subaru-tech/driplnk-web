import type { Object3D, WebGLRenderer as WebGLRendererType } from "three";
import { extensionOf } from "@/lib/uploads";

/**
 * Turning an uploaded file into something you can look at.
 *
 * Everything here is browser-only and imported dynamically: three.js plus
 * loaders are heavy, and a dashboard that never opens a preview should never
 * pay for them. Nothing in this module runs during SSR.
 */

export type MaterialPreset = "silver" | "clay" | "obsidian" | "orange";

/**
 * High-grade PBR material tailored for 3D printed & CAD models.
 * Silver gives that sleek CGTrader / Sketchfab automotive titanium look.
 */
export function createPBRMaterial(
  preset: MaterialPreset = "silver",
  THREE: typeof import("three"),
) {
  switch (preset) {
    case "clay":
      return new THREE.MeshPhysicalMaterial({
        color: 0xd9c7b8,
        roughness: 0.65,
        metalness: 0.02,
        clearcoat: 0.1,
        clearcoatRoughness: 0.7,
        side: THREE.DoubleSide,
      });
    case "obsidian":
      return new THREE.MeshPhysicalMaterial({
        color: 0x23272e,
        roughness: 0.28,
        metalness: 0.65,
        clearcoat: 0.7,
        clearcoatRoughness: 0.15,
        side: THREE.DoubleSide,
      });
    case "orange":
      return new THREE.MeshPhysicalMaterial({
        color: 0xf97316,
        roughness: 0.35,
        metalness: 0.08,
        clearcoat: 0.45,
        clearcoatRoughness: 0.25,
        side: THREE.DoubleSide,
      });
    case "silver":
    default:
      // Automotive Metallic Silver / Titanium
      return new THREE.MeshPhysicalMaterial({
        color: 0x9ca3af,
        roughness: 0.28,
        metalness: 0.35,
        clearcoat: 0.6,
        clearcoatRoughness: 0.18,
        sheen: 0.2,
        sheenColor: new THREE.Color(0xd1d5db),
        side: THREE.DoubleSide,
      });
  }
}

/**
 * Creates a studio-quality environment map from a cyclorama gradient.
 * Provides soft ambient wrapping and sharp specular reflections.
 */
export async function createStudioEnvironment(renderer: WebGLRendererType) {
  const THREE = await import("three");
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileCubemapShader();

    const envScene = new THREE.Scene();

    /* Sky dome — soft warm white overhead, neutral horizon, dark ground bounce */
    const skyGeo = new THREE.SphereGeometry(60, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true });
    const colors = skyGeo.getAttribute("position");
    const colorAttr = new Float32Array(colors.count * 3);
    const tmpV = new THREE.Vector3();
    for (let i = 0; i < colors.count; i++) {
      tmpV.set(colors.getX(i), colors.getY(i), colors.getZ(i)).normalize();
      const t = tmpV.y * 0.5 + 0.5; // 0 = floor, 1 = ceiling
      if (t > 0.5) {
        const u = (t - 0.5) * 2;
        colorAttr[i * 3] = 0.55 + u * 0.75;
        colorAttr[i * 3 + 1] = 0.6 + u * 0.7;
        colorAttr[i * 3 + 2] = 0.65 + u * 0.7;
      } else {
        const u = t * 2;
        colorAttr[i * 3] = 0.15 + u * 0.4;
        colorAttr[i * 3 + 1] = 0.17 + u * 0.43;
        colorAttr[i * 3 + 2] = 0.2 + u * 0.45;
      }
    }
    skyGeo.setAttribute("color", new THREE.BufferAttribute(colorAttr, 3));
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    envScene.add(skyMesh);

    /* Overhead studio softbox panels for sharp horizon & surface highlights */
    const softbox1 = new THREE.Mesh(
      new THREE.PlaneGeometry(35, 25),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    );
    softbox1.position.set(15, 30, 15);
    softbox1.lookAt(0, 0, 0);
    envScene.add(softbox1);

    const softbox2 = new THREE.Mesh(
      new THREE.PlaneGeometry(25, 20),
      new THREE.MeshBasicMaterial({ color: 0xe2e8f0, side: THREE.DoubleSide }),
    );
    softbox2.position.set(-20, 20, -15);
    softbox2.lookAt(0, 0, 0);
    envScene.add(softbox2);

    const envMap = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
    skyGeo.dispose();
    skyMat.dispose();
    softbox1.geometry.dispose();
    softbox2.geometry.dispose();

    return envMap;
  } catch (err) {
    console.warn("Studio environment creation skipped:", err);
    return null;
  }
}

/** Extensions we can actually draw. STEP and ZIP are uploadable but not viewable. */
export const PREVIEWABLE_EXTENSIONS = [
  ".stl",
  ".obj",
  ".ply",
  ".3mf",
  ".glb",
  ".gltf",
  ".gcode",
] as const;

export function canPreview(filename: string): boolean {
  return (PREVIEWABLE_EXTENSIONS as readonly string[]).includes(extensionOf(filename));
}

/**
 * Loads a model from bytes into a three.js object.
 *
 * For geometry-only formats (STL, PLY):
 * 1. Merges duplicate vertices to enable seamless shading
 * 2. Generates creased normals (smooth body curves + crisp mechanical seams)
 * 3. Rotates -90° on X to align 3D printing Z-up coordinates to Three.js Y-up
 */
export async function loadModel(
  buffer: ArrayBuffer,
  filename: string,
  preset: MaterialPreset = "silver",
): Promise<Object3D> {
  const THREE = await import("three");
  const ext = extensionOf(filename);

  switch (ext) {
    case ".stl": {
      const { STLLoader } = await import("three/addons/loaders/STLLoader.js");
      let geometry = new STLLoader().parse(buffer);

      // Compute creased normals for smooth curves on moderate models (<120k vertices)
      if (geometry.attributes.position && geometry.attributes.position.count <= 120000) {
        try {
          const { mergeVertices, toCreasedNormals } = await import(
            "three/addons/utils/BufferGeometryUtils.js"
          );
          const merged = mergeVertices(geometry);
          geometry = toCreasedNormals(merged, (38 * Math.PI) / 180);
        } catch {
          geometry.computeVertexNormals();
        }
      } else {
        geometry.computeVertexNormals();
      }

      const mesh = new THREE.Mesh(geometry, createPBRMaterial(preset, THREE));
      mesh.name = "primary_mesh";
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // 3D printing STL coordinate system is Z-up -> convert to Three.js Y-up
      mesh.rotation.x = -Math.PI / 2;
      mesh.updateMatrix();

      const group = new THREE.Group();
      group.add(mesh);
      return group;
    }
    case ".ply": {
      const { PLYLoader } = await import("three/addons/loaders/PLYLoader.js");
      let geometry = new PLYLoader().parse(buffer);

      if (geometry.attributes.position && geometry.attributes.position.count <= 120000) {
        try {
          const { mergeVertices, toCreasedNormals } = await import(
            "three/addons/utils/BufferGeometryUtils.js"
          );
          const merged = mergeVertices(geometry);
          geometry = toCreasedNormals(merged, (38 * Math.PI) / 180);
        } catch {
          geometry.computeVertexNormals();
        }
      } else {
        geometry.computeVertexNormals();
      }

      const mesh = new THREE.Mesh(geometry, createPBRMaterial(preset, THREE));
      mesh.name = "primary_mesh";
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Convert Z-up to Y-up
      mesh.rotation.x = -Math.PI / 2;
      mesh.updateMatrix();

      const group = new THREE.Group();
      group.add(mesh);
      return group;
    }
    case ".obj": {
      const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
      const obj = new OBJLoader().parse(new TextDecoder().decode(buffer));
      // Give unshaded OBJ meshes the sleek default material
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (!child.material || child.material.type === "MeshBasicMaterial") {
            child.material = createPBRMaterial(preset, THREE);
          }
        }
      });
      return obj;
    }
    case ".3mf": {
      const { ThreeMFLoader } = await import("three/addons/loaders/3MFLoader.js");
      const obj = new ThreeMFLoader().parse(buffer);
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      // 3MF build orientation is Z-up -> convert to Y-up
      obj.rotation.x = -Math.PI / 2;
      return obj;
    }
    case ".glb":
    case ".gltf": {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const gltf = await loader.parseAsync(buffer, "");
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      return gltf.scene;
    }
    case ".gcode": {
      const { GCodeLoader } = await import("three/addons/loaders/GCodeLoader.js");
      const obj = new GCodeLoader().parse(new TextDecoder().decode(buffer));
      obj.rotation.x = -Math.PI / 2;
      return obj;
    }
    default:
      throw new Error(`No preview for ${ext || "that file type"}.`);
  }
}

/**
 * Centers an object at the origin (0, 0, 0) and computes optimal framing.
 */
export async function frameObject(object: Object3D, fovDegrees: number, padding = 1.15) {
  const THREE = await import("three");
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);

  if (box.isEmpty()) {
    return {
      distance: 10,
      radius: 1,
      center: new THREE.Vector3(0, 0, 0),
      size: new THREE.Vector3(1, 1, 1),
    };
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // Center object directly at the origin (0, 0, 0)
  object.position.sub(center);
  object.updateMatrixWorld(true);

  const maxDim = Math.max(size.x, size.y, size.z);
  const radius = maxDim / 2;

  // Frame tightly based on the largest dimension
  const fovRad = (fovDegrees * Math.PI) / 180;
  const distance = (maxDim / (2 * Math.tan(fovRad / 2))) * padding;

  return { distance, radius, center: new THREE.Vector3(0, 0, 0), size };
}

/**
 * Renders one frame off-screen and returns a PNG blob with perceptual hash.
 */
export async function renderThumbnailWithPhash(
  file: File,
  size = 512
): Promise<{ blob: Blob | null; phash: number[] | null }> {
  try {
    const THREE = await import("three");
    const buffer = await file.arrayBuffer();
    const object = await loadModel(buffer, file.name, "silver");

    const scene = new THREE.Scene();
    scene.add(object);

    const { distance, radius, center } = await frameObject(object, 42);

    /* 3-point studio lighting properly scaled to object radius */
    scene.add(new THREE.HemisphereLight(0xf8fafc, 0x1e293b, 0.9));

    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(radius * 2.2, radius * 2.8, radius * 2.2);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xb0c4de, 0.7);
    fill.position.set(-radius * 2.0, radius * 1.5, -radius * 1.2);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.9);
    rim.position.set(0, radius * 1.8, -radius * 2.5);
    scene.add(rim);

    // Subtle soft ground contact shadow
    const shadowGeo = new THREE.PlaneGeometry(radius * 4, radius * 4);
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext("2d")!;
    const sGrad = sCtx.createRadialGradient(64, 64, 10, 64, 64, 64);
    sGrad.addColorStop(0, "rgba(0, 0, 0, 0.35)");
    sGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.001;
    scene.add(shadowMesh);

    const camera = new THREE.PerspectiveCamera(42, 1, distance * 0.05, distance * 10);
    // Three-quarter dynamic angle
    camera.position.set(distance * 0.75, distance * 0.45, distance * 0.75);
    camera.lookAt(center);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(size, size, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Try applying studio environment map
    const envMap = await createStudioEnvironment(renderer);
    if (envMap) {
      scene.environment = envMap;
      object.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const mat of mats) {
            if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
              if (!mat.envMap) mat.envMap = envMap;
              mat.envMapIntensity = 0.9;
              mat.needsUpdate = true;
            }
          }
        }
      });
    }

    renderer.render(scene, camera);

    const phash = computePerceptualHashFromCanvas(canvas);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );

    envMap?.dispose?.();
    shadowTex.dispose();
    shadowGeo.dispose();
    shadowMat.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    void disposeObject(object);

    return { blob, phash };
  } catch (err) {
    console.error("renderThumbnailWithPhash failed:", err);
    return { blob: null, phash: null };
  }
}

/**
 * Computes a 64-dimensional DCT-based perceptual hash vector from a canvas.
 * Scales to 32x32 grayscale, computes top-left 8x8 DCT frequencies,
 * and normalizes to a 64-value float vector suitable for cosine similarity.
 */
export function computePerceptualHashFromCanvas(
  sourceCanvas: HTMLCanvasElement
): number[] {
  try {
    const size = 32;
    const targetDim = 8;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return new Array(64).fill(0);

    ctx.drawImage(sourceCanvas, 0, 0, size, size);
    const imgData = ctx.getImageData(0, 0, size, size);
    const pixels = imgData.data;

    // Convert to grayscale 32x32 matrix
    const gray: number[][] = [];
    for (let y = 0; y < size; y++) {
      const row: number[] = [];
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        row.push(0.299 * r + 0.587 * g + 0.114 * b);
      }
      gray.push(row);
    }

    // 2D DCT for 8x8 lowest frequencies
    const dct: number[] = [];
    const pi = Math.PI;

    for (let u = 0; u < targetDim; u++) {
      for (let v = 0; v < targetDim; v++) {
        let sum = 0;
        for (let x = 0; x < size; x++) {
          for (let y = 0; y < size; y++) {
            sum +=
              gray[y][x] *
              Math.cos(((2 * x + 1) * u * pi) / (2 * size)) *
              Math.cos(((2 * y + 1) * v * pi) / (2 * size));
          }
        }
        const alphaU = u === 0 ? 1 / Math.sqrt(size) : Math.sqrt(2 / size);
        const alphaV = v === 0 ? 1 / Math.sqrt(size) : Math.sqrt(2 / size);
        dct.push(alphaU * alphaV * sum);
      }
    }

    // Compute median of frequencies
    const sorted = [...dct].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Produce binary vector (1.0 or 0.0)
    return dct.map((val) => (val > median ? 1.0 : 0.0));
  } catch (err) {
    console.warn("Failed to compute perceptual hash:", err);
    return new Array(64).fill(0);
  }
}

/**
 * Backward-compatible wrapper returning only the PNG blob.
 */
export async function renderThumbnail(file: File, size = 512): Promise<Blob | null> {
  const result = await renderThumbnailWithPhash(file, size);
  return result.blob;
}

/** Frees GPU memory for an object tree. */
export async function disposeObject(object: Object3D) {
  const THREE = await import("three");
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points) {
      child.geometry?.dispose?.();
      const material = child.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose?.();
    }
  });
}
