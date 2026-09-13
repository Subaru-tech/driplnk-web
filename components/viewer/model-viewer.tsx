"use client";

import {
  AlertCircle,
  Camera,
  Loader2,
  Maximize2,
  Palette,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  MaterialPreset,
  createPBRMaterial,
  createStudioEnvironment,
  disposeObject,
  frameObject,
  loadModel,
} from "@/lib/model-preview";

/**
 * Live 3D studio preview of an uploaded file.
 *
 * Features:
 *   - Auto-oriented (STL Z-up -> Three.js Y-up conversion)
 *   - Creased normals for silky smooth automotive curves with sharp seams
 *   - Scaled 4-light studio rig with soft contact ground shadows
 *   - ACESFilmic tone mapping & studio cyclorama reflections
 *   - Interactive toolbar: Rotate 90°, Wireframe, 4 PBR Shading presets, Reset
 *   - Automatic thumbnail backfill for models that lack one
 */
export function ModelViewer({
  url,
  filename,
  modelId,
  hasThumbnail = true,
  className,
}: {
  url: string;
  filename: string;
  modelId?: string;
  hasThumbnail?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  // Viewer interactive state
  const [preset, setPreset] = useState<MaterialPreset>("silver");
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showPresets, setShowPresets] = useState(false);

  // Callbacks hooked into the active Three.js instance
  const controlsRef = useRef<{ autoRotate?: boolean } | null>(null);
  const objectRef = useRef<unknown>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);
  const rotateObjectRef = useRef<((axis: "x" | "y", angle: number) => void) | null>(null);
  const updateMaterialRef = useRef<((newPreset: MaterialPreset) => void) | null>(null);
  const toggleWireframeRef = useRef<((wf: boolean) => void) | null>(null);
  const thumbnailCapturedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let frame = 0;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Couldn't fetch the model file.");
        const buffer = await response.arrayBuffer();
        if (disposed) return;

        const THREE = await import("three");
        const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");

        const object = await loadModel(buffer, filename, preset);
        if (disposed) {
          await disposeObject(object);
          return;
        }

        objectRef.current = object;

        /* ---- Scene ---- */
        const scene = new THREE.Scene();

        /* Sleek neutral studio gradient background */
        const bgCanvas = document.createElement("canvas");
        bgCanvas.width = 2;
        bgCanvas.height = 512;
        const bgCtx = bgCanvas.getContext("2d")!;
        const grad = bgCtx.createLinearGradient(0, 0, 0, 512);
        grad.addColorStop(0, "#23272e");   // Subtle studio graphite top
        grad.addColorStop(0.5, "#181a1f"); // Mid slate
        grad.addColorStop(1, "#101215");   // Deep studio floor
        bgCtx.fillStyle = grad;
        bgCtx.fillRect(0, 0, 2, 512);
        const bgTexture = new THREE.CanvasTexture(bgCanvas);
        bgTexture.colorSpace = THREE.SRGBColorSpace;
        scene.background = bgTexture;

        scene.add(object);

        /* ---- Camera & Object Framing ---- */
        const width = container.clientWidth || 1;
        const height = container.clientHeight || 1;
        const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 10000);

        const { distance, radius, size } = await frameObject(object, 40);

        // Position camera at a classic three-quarter beauty shot
        const initialCameraPos = new THREE.Vector3(
          distance * 0.72,
          distance * 0.45,
          distance * 0.72,
        );
        camera.position.copy(initialCameraPos);
        camera.lookAt(0, 0, 0);
        camera.near = distance * 0.02;
        camera.far = distance * 10;
        camera.updateProjectionMatrix();

        /* ---- Scaled 4-Light Studio Rig ---- */
        scene.add(new THREE.HemisphereLight(0xf8fafc, 0x1e293b, 0.75));

        const key = new THREE.DirectionalLight(0xffffff, 1.8);
        key.position.set(radius * 2.2, radius * 3.0, radius * 2.2);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.bias = -0.0001;
        key.shadow.normalBias = 0.02;
        const shadowExt = radius * 1.6;
        key.shadow.camera.left = -shadowExt;
        key.shadow.camera.right = shadowExt;
        key.shadow.camera.top = shadowExt;
        key.shadow.camera.bottom = -shadowExt;
        key.shadow.camera.near = radius * 0.5;
        key.shadow.camera.far = radius * 7.0;
        scene.add(key);

        const fill = new THREE.DirectionalLight(0xb8cce4, 0.7);
        fill.position.set(-radius * 2.2, radius * 1.5, -radius * 1.2);
        scene.add(fill);

        const rim = new THREE.DirectionalLight(0xffffff, 0.9);
        rim.position.set(0, radius * 2.0, -radius * 2.8);
        scene.add(rim);

        /* ---- Ground Contact Shadow directly under object ---- */
        const groundGeo = new THREE.PlaneGeometry(radius * 5, radius * 5);
        const shadowCanvas = document.createElement("canvas");
        shadowCanvas.width = 256;
        shadowCanvas.height = 256;
        const sCtx = shadowCanvas.getContext("2d")!;
        const sGrad = sCtx.createRadialGradient(128, 128, 15, 128, 128, 128);
        sGrad.addColorStop(0, "rgba(0, 0, 0, 0.4)");
        sGrad.addColorStop(0.5, "rgba(0, 0, 0, 0.15)");
        sGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        sCtx.fillStyle = sGrad;
        sCtx.fillRect(0, 0, 256, 256);
        const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
        const groundMat = new THREE.MeshBasicMaterial({
          map: shadowTexture,
          transparent: true,
          depthWrite: false,
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -size.y / 2 - 0.001;
        scene.add(ground);

        /* ---- Renderer ---- */
        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height, false);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.domElement.className = "size-full touch-none cursor-grab active:cursor-grabbing";
        container.appendChild(renderer.domElement);

        /* ---- Environment Map ---- */
        const envMap = await createStudioEnvironment(renderer);
        if (envMap) {
          scene.environment = envMap;
          object.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              for (const mat of mats) {
                if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
                  if (!mat.envMap) mat.envMap = envMap;
                  mat.envMapIntensity = 0.95;
                  mat.needsUpdate = true;
                }
              }
            }
          });
        }

        /* ---- OrbitControls ---- */
        const controls = new OrbitControls(camera, renderer.domElement);
        controlsRef.current = controls;
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.rotateSpeed = 0.8;
        controls.panSpeed = 0.6;
        controls.zoomSpeed = 1.1;
        controls.target.set(0, 0, 0);
        controls.minDistance = distance * 0.15;
        controls.maxDistance = distance * 5;
        controls.autoRotate = autoRotate;
        controls.autoRotateSpeed = 1.6;
        controls.update();

        // Pause auto-rotate during user drag, resume after idle
        let autoRotateTimer: ReturnType<typeof setTimeout> | null = null;
        const pauseAutoRotate = () => {
          if (autoRotate) {
            controls.autoRotate = false;
            if (autoRotateTimer) clearTimeout(autoRotateTimer);
            autoRotateTimer = setTimeout(() => {
              controls.autoRotate = true;
            }, 3000);
          }
        };
        renderer.domElement.addEventListener("pointerdown", pauseAutoRotate);
        renderer.domElement.addEventListener("wheel", pauseAutoRotate);

        /* ---- Interactive Callbacks ---- */
        resetCameraRef.current = () => {
          camera.position.copy(initialCameraPos);
          controls.target.set(0, 0, 0);
          controls.update();
        };

        rotateObjectRef.current = (axis: "x" | "y", angle: number) => {
          if (axis === "x") {
            object.rotation.x += angle;
          } else {
            object.rotation.y += angle;
          }
          object.updateMatrix();
        };

        updateMaterialRef.current = (newPreset: MaterialPreset) => {
          const newMat = createPBRMaterial(newPreset, THREE);
          if (envMap) {
            newMat.envMap = envMap;
            newMat.envMapIntensity = 0.95;
          }
          newMat.wireframe = wireframe;

          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = newMat;
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
        };

        toggleWireframeRef.current = (wf: boolean) => {
          object.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              for (const m of mats) {
                m.wireframe = wf;
              }
            }
          });
        };

        /* ---- Render Loop ---- */
        const render = () => {
          controls.update();
          renderer.render(scene, camera);
          frame = requestAnimationFrame(render);
        };
        frame = requestAnimationFrame(render);

        const observer = new ResizeObserver(() => {
          const w = container.clientWidth || 1;
          const h = container.clientHeight || 1;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h, false);
        });
        observer.observe(container);

        setStatus("ready");

        /* ---- Auto Thumbnail Capture ---- */
        let thumbTimer: ReturnType<typeof setTimeout> | null = null;
        if (!hasThumbnail && modelId && !thumbnailCapturedRef.current) {
          thumbTimer = setTimeout(async () => {
            if (disposed || thumbnailCapturedRef.current) return;
            thumbnailCapturedRef.current = true;
            try {
              const dataUrl = renderer.domElement.toDataURL("image/webp", 0.85);
              if (dataUrl && dataUrl.length > 200) {
                const { updateModelThumbnail } = await import("@/driplnk-web-backend/actions/upload");
                await updateModelThumbnail({ id: modelId, thumbnailUrl: dataUrl });
              }
            } catch (err) {
              console.warn("Failed to auto-save model thumbnail:", err);
            }
          }, 400);
        }

        cleanup = () => {
          cancelAnimationFrame(frame);
          if (thumbTimer) clearTimeout(thumbTimer);
          if (autoRotateTimer) clearTimeout(autoRotateTimer);
          renderer.domElement.removeEventListener("pointerdown", pauseAutoRotate);
          renderer.domElement.removeEventListener("wheel", pauseAutoRotate);
          observer.disconnect();
          controls.dispose();
          envMap?.dispose?.();
          bgTexture.dispose();
          shadowTexture.dispose();
          groundGeo.dispose();
          groundMat.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
          void disposeObject(object);
        };
      } catch (error) {
        if (disposed) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Couldn't render this file.");
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanup?.();
    };
  }, [url, filename]);

  // Sync auto-rotate state with controls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  function handlePresetChange(newPreset: MaterialPreset) {
    setPreset(newPreset);
    setShowPresets(false);
    updateMaterialRef.current?.(newPreset);
  }

  function handleWireframeToggle() {
    const next = !wireframe;
    setWireframe(next);
    toggleWireframeRef.current?.(next);
  }

  return (
    <div
      className={cn(
        "group/viewer relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-[#111317]",
        className,
      )}
    >
      <div ref={containerRef} className="size-full" />

      {status === "loading" ? (
        <div className="absolute inset-0 grid place-items-center gap-2 bg-[#111317] text-muted">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-7 animate-spin text-fg" aria-hidden="true" />
            <span className="text-xs font-mono text-faint">Optimizing geometry & lighting…</span>
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center bg-[#111317]">
          <AlertCircle className="size-6 text-danger" aria-hidden="true" />
          <p className="text-sm text-muted">{message}</p>
        </div>
      ) : null}

      {status === "ready" ? (
        <>
          {/* Top-right Floating Control Toolbar */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 p-1 backdrop-blur-md transition-opacity">
            {/* Rotate X 90° */}
            <button
              type="button"
              onClick={() => rotateObjectRef.current?.("x", Math.PI / 2)}
              title="Rotate 90° X (Flip Upright)"
              className="grid size-8 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              <RotateCw className="size-4" />
            </button>

            {/* Rotate Y 90° */}
            <button
              type="button"
              onClick={() => rotateObjectRef.current?.("y", Math.PI / 2)}
              title="Rotate 90° Y (Turn)"
              className="grid size-8 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              <RotateCcw className="size-4" />
            </button>

            {/* Wireframe toggle */}
            <button
              type="button"
              onClick={handleWireframeToggle}
              title={wireframe ? "Solid shading" : "Wireframe mesh"}
              className={cn(
                "grid size-8 place-items-center rounded-full transition-colors",
                wireframe
                  ? "bg-white text-black"
                  : "text-white/80 hover:bg-white/15 hover:text-white",
              )}
            >
              <Sparkles className="size-4" />
            </button>

            {/* Material Presets dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPresets((v) => !v)}
                title="Change material"
                className="grid size-8 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              >
                <Palette className="size-4" />
              </button>

              {showPresets && (
                <div className="absolute right-0 top-10 z-30 flex flex-col gap-1 min-w-[130px] rounded-xl border border-white/15 bg-black/85 p-1.5 backdrop-blur-xl shadow-2xl animate-fade-in text-xs">
                  <button
                    onClick={() => handlePresetChange("silver")}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors text-left",
                      preset === "silver"
                        ? "bg-white/20 text-white font-medium"
                        : "text-white/70 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <span className="size-3 rounded-full bg-[#9ca3af] border border-white/30" />
                    Silver Metallic
                  </button>
                  <button
                    onClick={() => handlePresetChange("clay")}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors text-left",
                      preset === "clay"
                        ? "bg-white/20 text-white font-medium"
                        : "text-white/70 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <span className="size-3 rounded-full bg-[#d9c7b8] border border-white/30" />
                    Matte Clay
                  </button>
                  <button
                    onClick={() => handlePresetChange("obsidian")}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors text-left",
                      preset === "obsidian"
                        ? "bg-white/20 text-white font-medium"
                        : "text-white/70 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <span className="size-3 rounded-full bg-[#23272e] border border-white/30" />
                    Obsidian Dark
                  </button>
                  <button
                    onClick={() => handlePresetChange("orange")}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors text-left",
                      preset === "orange"
                        ? "bg-white/20 text-white font-medium"
                        : "text-white/70 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <span className="size-3 rounded-full bg-[#f97316] border border-white/30" />
                    Filament Orange
                  </button>
                </div>
              )}
            </div>

            {/* Auto-rotate toggle */}
            <button
              type="button"
              onClick={() => setAutoRotate((v) => !v)}
              title={autoRotate ? "Pause rotation" : "Auto rotate"}
              className="grid size-8 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              {autoRotate ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            </button>

            {/* Recenter Camera */}
            <button
              type="button"
              onClick={() => resetCameraRef.current?.()}
              title="Reset Camera View"
              className="grid size-8 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              <Camera className="size-4" />
            </button>
          </div>

          {/* Bottom Hint */}
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/60 backdrop-blur-sm">
            <span>Drag to orbit · Scroll to zoom · Right-click to pan</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
