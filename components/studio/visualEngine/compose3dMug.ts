// ============================================================
// AURA STUDIO · visualEngine/compose3dMug — F4 (motor 3D caneca)
//
// Módulo puro (sem React): monta a cena three.js da caneca com a
// personalização aplicada como CanvasTexture. Caneca PROCEDURAL
// (cilindro + alça + borda) — provisória até os GLBs reais; a spec
// já prevê model.kind='glb' + url e o viewer troca sem mudar quem usa.
//
// Áreas painel/wrap vêm da spec (uv por área). Mesmo contrato de
// values do 2D: { text, image, ... } (fieldId → valor).
//
// Handle devolvido: update(), setArea(), snapshot(px), dispose().
// Drag pra girar + auto-rotate até o 1º toque (igual demo aprovado).
//
// 03/07/2026 — F4 do escopo Visualização 2D/3D (contrato no chat)
// ============================================================
import type { VisualArea, VisualTemplateSpec } from "@/services/studioVisualApi";
import { loadThree } from "./threeLoader";

export type Mug3DOptions = {
  garmentColor?: string;  // cor da louça
  artColor?: string;      // cor do texto/emblema
  font?: string;
  areaId?: string;        // 'panel' | 'wrap'
  backdrop?: string;
};

export type Mug3DHandle = {
  update: (values: Record<string, any>, opts?: Mug3DOptions) => Promise<void>;
  snapshot: (pixelWidth?: number) => string | null;
  dispose: () => void;
};

const DEFAULTS: Required<Pick<Mug3DOptions, "garmentColor" | "artColor" | "font" | "areaId" | "backdrop">> = {
  garmentColor: "#F5F2EA",
  artColor: "#D85A30",
  font: "Georgia, serif",
  areaId: "panel",
  backdrop: "#ECEAE4",
};

function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function pickArea(spec: VisualTemplateSpec, areaId: string): VisualArea | null {
  const areas = spec.areas || [];
  return areas.find((a) => a.id === areaId) || areas[0] || null;
}

async function paintTexture(
  texCv: HTMLCanvasElement,
  spec: VisualTemplateSpec,
  values: Record<string, any>,
  o: typeof DEFAULTS
) {
  const ctx = texCv.getContext("2d");
  if (!ctx) return;
  const W = texCv.width, H = texCv.height;
  ctx.fillStyle = o.garmentColor;
  ctx.fillRect(0, 0, W, H);

  const area = pickArea(spec, o.areaId);
  if (!area || !area.uv) return;
  const ax = area.uv.u0 * W;
  const aw = (area.uv.u1 - area.uv.u0) * W;
  const ay = (1 - area.uv.v1) * H; // v cresce pra cima na UV; canvas pra baixo
  const ah = (area.uv.v1 - area.uv.v0) * H;

  const text: string = values.text != null ? String(values.text) : "";
  const imageUrl: string | null = values.image || values.template || null;
  const cx = ax + aw / 2;
  const imgBoxH = ah * (text ? 0.55 : 0.85);

  if (imageUrl) {
    const img = await loadImg(imageUrl);
    if (img && img.width > 0) {
      const r = Math.min((aw * 0.9) / img.width, imgBoxH / img.height);
      const dw = img.width * r, dh = img.height * r;
      ctx.drawImage(img, cx - dw / 2, ay + (imgBoxH - dh) / 2, dw, dh);
    }
  } else if (text) {
    // Emblema simples acima do texto (mesma identidade do 2D)
    ctx.strokeStyle = o.artColor;
    ctx.lineWidth = Math.max(ah * 0.02, 4);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const ey = ay + imgBoxH * 0.45, es = Math.min(aw, ah) * 0.16;
    ctx.beginPath(); ctx.arc(cx, ey + es * 0.35, es, 3.5, 5.9); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - es * 0.7, ey + es * 0.55);
    ctx.lineTo(cx - es * 0.15, ey - es * 0.2);
    ctx.lineTo(cx + es * 0.12, ey + es * 0.25);
    ctx.lineTo(cx + es * 0.45, ey - es * 0.3);
    ctx.lineTo(cx + es * 0.85, ey + es * 0.45);
    ctx.stroke();
  }

  if (text) {
    ctx.fillStyle = o.artColor;
    ctx.textAlign = "center";
    let fontPx = ah * 0.28;
    ctx.font = "600 " + Math.round(fontPx) + "px " + o.font;
    while (fontPx > 12 && ctx.measureText(text).width > aw * 0.92) {
      fontPx -= 4;
      ctx.font = "600 " + Math.round(fontPx) + "px " + o.font;
    }
    ctx.fillText(text, cx, ay + imgBoxH + (ah - imgBoxH) * 0.6 + fontPx * 0.3);
  }
}

export async function createMugViewer(
  canvas: HTMLCanvasElement,
  spec: VisualTemplateSpec,
  values: Record<string, any>,
  opts: Mug3DOptions = {}
): Promise<Mug3DHandle> {
  const THREE = await loadThree();
  let o = { ...DEFAULTS, ...opts };

  const texW = spec.model?.texture?.w || 2048;
  const texH = spec.model?.texture?.h || 1024;
  const texCv = document.createElement("canvas");
  texCv.width = texW;
  texCv.height = texH;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(o.backdrop);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 1.1, 6.6);
  camera.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });

  function resize() {
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || Math.round(w * 0.78);
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.65); d1.position.set(3, 5, 4); scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.25); d2.position.set(-4, 2, -2); scene.add(d2);

  const texture = new THREE.CanvasTexture(texCv);
  const bodyMat   = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3, metalness: 0 });
  const solidMat  = new THREE.MeshStandardMaterial({ color: o.garmentColor, roughness: 0.3, metalness: 0 });
  const innerMat  = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.6, side: THREE.BackSide });

  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(1, 0.94, 2.3, 64, 1, true), bodyMat));
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.94, 64), solidMat);
  bottom.rotation.x = Math.PI / 2; bottom.position.y = -1.15; group.add(bottom);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.975, 0.028, 12, 64), solidMat);
  rim.rotation.x = Math.PI / 2; rim.position.y = 1.15; group.add(rim);
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.9, 2.24, 64, 1, true), innerMat));
  const innerBottomMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.6 });
  const innerBottom = new THREE.Mesh(new THREE.CircleGeometry(0.9, 64), innerBottomMat);
  innerBottom.rotation.x = -Math.PI / 2; innerBottom.position.y = -1.0; group.add(innerBottom);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.11, 20, 48), solidMat);
  handle.position.set(1.02, 0, 0); group.add(handle);
  group.rotation.y = Math.PI;
  group.rotation.x = 0.06;
  scene.add(group);

  let disposed = false;
  let dragging = false;
  let userTouched = false;
  let lastX = 0;

  function render() { if (!disposed) renderer.render(scene, camera); }

  const onDown = (e: PointerEvent) => {
    dragging = true; userTouched = true; lastX = e.clientX;
    try { canvas.setPointerCapture(e.pointerId); } catch (_e) {}
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    group.rotation.y += (e.clientX - lastX) * 0.011;
    lastX = e.clientX;
    render();
  };
  const onUp = () => { dragging = false; };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);

  function loop() {
    if (disposed) return;
    if (!userTouched) { group.rotation.y += 0.004; render(); }
    requestAnimationFrame(loop);
  }

  async function update(newValues: Record<string, any>, newOpts?: Mug3DOptions) {
    o = { ...o, ...(newOpts || {}) };
    solidMat.color.set(o.garmentColor);
    await paintTexture(texCv, spec, newValues, o);
    texture.needsUpdate = true;
    render();
  }

  function snapshot(pixelWidth = 1600): string | null {
    try {
      // preserveDrawingBuffer garante leitura do frame atual
      render();
      if (pixelWidth && canvas.width < pixelWidth) render();
      return renderer.domElement.toDataURL("image/png");
    } catch (_e) {
      return null;
    }
  }

  function dispose() {
    disposed = true;
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    try { renderer.dispose(); } catch (_e) {}
  }

  resize();
  await update(values);
  loop();

  return { update, snapshot, dispose };
}
