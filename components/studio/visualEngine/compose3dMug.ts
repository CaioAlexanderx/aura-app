// ============================================================
// AURA STUDIO · visualEngine/compose3dMug — F4 (motor 3D caneca)
//
// Módulo puro (sem React): monta a cena three.js da caneca com a
// personalização aplicada como CanvasTexture. Caneca PROCEDURAL
// (corpo torneado + alça + borda) — provisória até os GLBs reais; a
// spec já prevê model.kind='glb' + url e o viewer troca sem mudar quem
// usa.
//
// Áreas painel/wrap vêm da spec (uv por área). Mesmo contrato de
// values do 2D: { text, image, ... } (fieldId → valor).
//
// Handle devolvido: update(), snapshot(px), recordTurntable(ms),
// dispose(). Drag pra girar + auto-rotate até o 1º toque.
//
// F5 (03/07/2026): recordTurntable — grava uma volta completa (~4s)
// via canvas.captureStream + MediaRecorder (webm). Zero infra: o
// vídeo nasce no browser do lojista, igual ao demo aprovado.
//
// 04/09/2026 — acabamento de estúdio. A cena era um cilindro sobre um
// fundo chapado, com uma ambiente e duas direcionais, sem sombra e sem
// reflexo: a Imperial dourada renderizava PRETA (metal sem ambiente
// para refletir) e a Chopp sumia. Agora: fundo em gradiente (papel
// quente, o tom da vitrine), chão com sombra de contato e sombra
// projetada macia, luz de três pontos e um mapa de ambiente gerado de
// uma "sala de softbox" procedural (PMREM do core do r128 — sem script
// extra do CDN). Saída em sRGB, com as cores do modelo convertidas, para
// o hex escolhido pelo cliente aparecer na tela como o hex que ele viu.
//
// 03/07/2026 — F4/F5 do escopo Visualização 2D/3D (contrato no chat)
// ============================================================
import type { VisualArea, VisualTemplateSpec } from "@/services/studioVisualApi";
import { loadThree } from "./threeLoader";
import {
  readMugGeometry, heartPath, readMugMaterials, applyCustomerColor,
  readMugAccessories, latheProfile, squarePath, type MugMaterial,
} from "./mugGeometry";
import {
  backdropPalette, cameraDistance, contactShadowRadius, floorLevel,
  hexToRgba, CAMERA_FOV_GRAUS,
} from "./mugScene";

export type Mug3DOptions = {
  garmentColor?: string;  // cor ESCOLHIDA pelo cliente (incide onde o modelo mandar)
  bodyColor?: string;     // cor do corpo do modelo — fundo da textura (S11)
  bodyTopBand?: { color: string; height: number } | null;
  /** Opacidade do corpo: vidro pinta o fundo da textura translúcido e a arte opaca. */
  bodyOpacity?: number;
  artColor?: string;      // cor do texto/emblema
  font?: string;
  areaId?: string;        // 'panel' | 'wrap'
  /** Cor base do fundo (vira gradiente de estúdio). */
  backdrop?: string;
};

export type Mug3DHandle = {
  update: (values: Record<string, any>, opts?: Mug3DOptions) => Promise<void>;
  snapshot: (pixelWidth?: number) => string | null;
  recordTurntable: (durationMs?: number) => Promise<Blob | null>;
  dispose: () => void;
};

const DEFAULTS: Required<Pick<Mug3DOptions, "garmentColor" | "artColor" | "font" | "areaId" | "backdrop">> = {
  garmentColor: "#F5F2EA",
  artColor: "#D85A30",
  font: "Georgia, serif",
  areaId: "panel",
  // O papel da vitrine: o mockup senta na página em vez de parecer colado.
  backdrop: "#FBF8F3",
};

type Opcoes = typeof DEFAULTS & Mug3DOptions;

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
  o: Opcoes
) {
  const ctx = texCv.getContext("2d");
  if (!ctx) return;
  const W = texCv.width, H = texCv.height;
  // S11 — o fundo da textura e a cor do CORPO do modelo, nao a escolha do
  // cliente. Numa caneca de alca colorida o corpo e branco e so a alca
  // segue a cor escolhida; pintar tudo apagava o produto.
  //
  // Vidro: o fundo leva a opacidade do corpo e a arte fica opaca por
  // cima — e um adesivo colado num copo, nao um copo pintado. Antes a
  // opacidade era do material inteiro e a arte sumia junto com o vidro.
  const alpha = typeof o.bodyOpacity === "number" ? o.bodyOpacity : 1;
  const fundo = o.bodyColor || o.garmentColor;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = alpha < 1 ? hexToRgba(fundo, alpha) : fundo;
  ctx.fillRect(0, 0, W, H);
  // Faixa esmaltada no topo (S11). v cresce pra cima na UV e o canvas pra
  // baixo, entao o topo da caneca e y=0 aqui.
  if (o.bodyTopBand && o.bodyTopBand.height > 0) {
    ctx.fillStyle = o.bodyTopBand.color;
    ctx.fillRect(0, 0, W, Math.round(H * o.bodyTopBand.height));
  }

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

// ── Cena de estúdio ──────────────────────────────────────────

/** Fundo: gradiente vertical de papel + halo atrás da peça, como textura 2D. */
function paintBackdrop(THREE: any, backdrop: string) {
  const cv = document.createElement("canvas");
  cv.width = 64; cv.height = 256;
  const ctx = cv.getContext("2d")!;
  const p = backdropPalette(backdrop);
  const g = ctx.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, p.top);
  g.addColorStop(0.55, backdrop);
  g.addColorStop(1, p.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cv.width, cv.height);
  const halo = ctx.createRadialGradient(cv.width / 2, cv.height * 0.42, 0, cv.width / 2, cv.height * 0.42, cv.height * 0.5);
  halo.addColorStop(0, hexToRgba(p.glow, 0.55));
  halo.addColorStop(1, hexToRgba(p.glow, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

/** Mancha macia sob a peça: sombra de contato, independente da luz. */
function paintContactShadow(THREE: any) {
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 256;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(40,30,20,0.42)");
  g.addColorStop(0.45, "rgba(40,30,20,0.18)");
  g.addColorStop(1, "rgba(40,30,20,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
}

/**
 * Mapa de ambiente de uma "sala de softbox": caixa de paredes cinza
 * quente com painéis luminosos (teto grande, lateral forte, lateral
 * fraca, contraluz). É o que a louça e o dourado refletem. Feito só com
 * o core do r128 — RoomEnvironment mora em examples/ e seria mais um
 * script do CDN para falhar.
 */
function buildEnvironment(THREE: any, renderer: any) {
  const sala = new THREE.Scene();
  const parede = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.30, 0.28), side: THREE.BackSide });
  sala.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), parede));
  const painel = (w: number, h: number, cor: [number, number, number], pos: [number, number, number], rot: [number, number, number]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cor[0], cor[1], cor[2]), side: THREE.DoubleSide }),
    );
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.set(rot[0], rot[1], rot[2]);
    sala.add(m);
  };
  painel(7, 4, [2.2, 2.1, 1.9], [0, 5.9, 0], [Math.PI / 2, 0, 0]);          // softbox no teto
  painel(3, 6, [1.6, 1.5, 1.35], [-5.9, 1.5, 2], [0, Math.PI / 2, 0]);      // painel principal (esquerda)
  painel(3, 6, [0.8, 0.85, 1.0], [5.9, 1, 1], [0, -Math.PI / 2, 0]);        // preenchimento frio (direita)
  painel(5, 2, [1.1, 1.1, 1.1], [0, 3.5, -5.9], [0, 0, 0]);                  // contraluz
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(sala, 0.04);
  pmrem.dispose();
  return env.texture;
}

function makeMaterial(THREE: any, m: MugMaterial, extra: Record<string, any> = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(m.color).convertSRGBToLinear(),
    roughness: m.roughness,
    metalness: m.metalness,
    transparent: m.opacity < 1,
    opacity: m.opacity,
    // Sem escrever profundidade nas transparentes: parede interna e
    // externa do vidro ficam no mesmo lugar e uma apagava a outra.
    depthWrite: m.opacity >= 1,
    envMapIntensity: m.metalness > 0.5 ? 1.1 : 0.7,
    ...extra,
  });
}

export async function createMugViewer(
  canvas: HTMLCanvasElement,
  spec: VisualTemplateSpec,
  values: Record<string, any>,
  opts: Mug3DOptions = {}
): Promise<Mug3DHandle> {
  const THREE = await loadThree();
  let o: Opcoes = { ...DEFAULTS, ...opts };

  const texW = spec.model?.texture?.w || 2048;
  const texH = spec.model?.texture?.h || 1024;
  const texCv = document.createElement("canvas");
  texCv.width = texW;
  texCv.height = texH;

  // S3 — a forma vem do `spec`, com os numeros de antes como default.
  // Template sem bloco de geometria renderiza exatamente como renderizava
  // (ver mugGeometry.ts).
  const G = readMugGeometry(spec);
  const acess = readMugAccessories(spec);
  const meiaAltura = G.body.height / 2;

  const scene = new THREE.Scene();
  scene.background = paintBackdrop(THREE, o.backdrop);
  const dist = cameraDistance(G, acess);
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_GRAUS, 1, 0.1, 100);
  // Um pouco acima e olhando um pouco para baixo: e o enquadramento de
  // foto de produto, e e o que deixa o chao e a sombra aparecerem.
  camera.position.set(0, dist * 0.2, dist);
  camera.lookAt(0, -0.05, 0);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  // Curva de filme: sem ela o branco da louca estourava e o corpo virava
  // uma mancha chapada, sem o degrade de luz que da volume na foto.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.environment = buildEnvironment(THREE, renderer);

  function resize() {
    // clientWidth=0 em canvas offscreen (geração de vídeo/render sem DOM):
    // cai pra canvas.width setado pelo caller antes do createMugViewer.
    const w = canvas.clientWidth || canvas.width || 320;
    const h = canvas.clientHeight || Math.round(w * 0.78);
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // Tres pontos: principal quente (projeta a sombra), preenchimento frio
  // e contraluz para descolar a peca do fundo. O ambiente vem do env map.
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0xb9ae9e, 0.25));
  const key = new THREE.DirectionalLight(0xfff3e4, 1.0);
  key.position.set(3.2, 6, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -4.5; key.shadow.camera.right = 4.5;
  key.shadow.camera.top = 4.5; key.shadow.camera.bottom = -4.5;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe8f0ff, 0.22); fill.position.set(-5, 2.5, 3); scene.add(fill);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.5); rimLight.position.set(-2, 4, -5); scene.add(rimLight);

  // S11 — cor e material vem do MODELO; a escolha do cliente incide so
  // nas pecas que o template declara em `customer_color_targets`.
  let M = applyCustomerColor(readMugMaterials(spec), o.garmentColor);
  // A PRIMEIRA pintura tambem precisa do fundo e da faixa certos: sem isto
  // o mockup nascia com a cor escolhida no corpo e so acertava no primeiro
  // update.
  o.bodyColor = M.body.color;
  o.bodyTopBand = M.body.topBand ?? null;
  o.bodyOpacity = M.body.opacity;

  const texture = new THREE.CanvasTexture(texCv);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
  // A opacidade do corpo mora no alfa da textura (ver paintTexture).
  const bodyMat = makeMaterial(THREE, M.body, { map: texture, opacity: 1 });
  const handleMat = makeMaterial(THREE, M.handle);
  const rimMat = makeMaterial(THREE, M.rim);
  const bottomMat = makeMaterial(THREE, M.bottom);
  const innerMat = makeMaterial(THREE, M.interior, { side: THREE.BackSide });
  const innerBottomMat = makeMaterial(THREE, M.interior);
  // Vidro nao projeta sombra cheia; a mancha de contato segura a peca.
  const opaco = (m: MugMaterial) => m.opacity >= 0.5;

  const group = new THREE.Group();
  const corpo = new THREE.Mesh(
    new THREE.LatheGeometry(latheProfile(G.body).map((p) => new THREE.Vector2(p.x, p.y)), 96),
    bodyMat
  );
  corpo.castShadow = opaco(M.body);
  group.add(corpo);
  const raioBase = G.body.bottomRadius - G.body.bottomRound;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(raioBase, 64), bottomMat);
  bottom.rotation.x = Math.PI / 2; bottom.position.y = -meiaAltura; group.add(bottom);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(G.rim.radius, G.rim.tube, 12, 96), rimMat);
  rim.rotation.x = Math.PI / 2; rim.position.y = meiaAltura; rim.castShadow = opaco(M.rim); group.add(rim);
  // A parede interna segue o mesmo perfil do corpo, um pouco para dentro,
  // senao a base arredondada deixaria o interior atravessar o exterior.
  const innerProfile = latheProfile({
    topRadius: G.inner.topRadius, bottomRadius: G.inner.bottomRadius,
    height: G.inner.height, bottomRound: Math.max(0, G.body.bottomRound - 0.04),
  });
  const inner = new THREE.Mesh(
    new THREE.LatheGeometry(innerProfile.map((p) => new THREE.Vector2(p.x, p.y)), 96),
    innerMat
  );
  inner.position.y = meiaAltura - 0.03 - G.inner.height / 2;
  group.add(inner);
  const innerBottom = new THREE.Mesh(new THREE.CircleGeometry(G.inner.bottomRadius, 64), innerBottomMat);
  innerBottom.rotation.x = -Math.PI / 2;
  innerBottom.position.y = -meiaAltura + (G.body.height - G.inner.height) + 0.09;
  group.add(innerBottom);
  // Vidro: parede interna e externa tem o mesmo centro, e o three ordena
  // as transparentes por distancia do centro — a interna podia ser
  // desenhada POR CIMA da externa e apagar a arte. A externa vai por
  // ultimo; e a mais perto da camera de qualquer angulo.
  inner.renderOrder = 1; innerBottom.renderOrder = 1;
  corpo.renderOrder = 2; rim.renderOrder = 3;

  // Alca: anel (padrao), coracao ou nenhuma. A forma e o que se vende na
  // "CANECA ALCA CORACAO" — renderiza-la como anel apaga o produto.
  // VAZADA e um tubo que percorre a curva (anel: toro; coracao: tubo pela
  // curva do coracao). PREENCHIDA e a curva extrudada com chanfro — uma
  // orelha macica. Sao produtos diferentes e tem que se distinguir na tela.
  if (G.handle.shape !== "none") {
    const extrusao = {
      depth: G.handle.tube * 1.6,
      bevelEnabled: true,
      bevelThickness: G.handle.tube * 0.5,
      bevelSize: G.handle.tube * 0.5,
      bevelSegments: 6,
      curveSegments: 32,
    };
    let handleGeo: any;
    if (G.handle.shape === "heart" && G.handle.filled) {
      const shape = new THREE.Shape();
      for (const cmd of heartPath(G.handle.radius + G.handle.tube)) {
        if (cmd.op === "moveTo") shape.moveTo(cmd.x, cmd.y);
        else shape.bezierCurveTo(cmd.c1x, cmd.c1y, cmd.c2x, cmd.c2y, cmd.x, cmd.y);
      }
      handleGeo = new THREE.ExtrudeGeometry(shape, extrusao);
      handleGeo.center();
    } else if (G.handle.shape === "heart") {
      const caminho = new THREE.CurvePath();
      let atual: any = null;
      for (const cmd of heartPath(G.handle.radius)) {
        const fim = new THREE.Vector3(cmd.x, cmd.y, 0);
        if (cmd.op === "bezierCurveTo" && atual) {
          caminho.add(new THREE.CubicBezierCurve3(
            atual, new THREE.Vector3(cmd.c1x, cmd.c1y, 0), new THREE.Vector3(cmd.c2x, cmd.c2y, 0), fim,
          ));
        }
        atual = fim;
      }
      handleGeo = new THREE.TubeGeometry(caminho, 96, G.handle.tube, 14, true);
    } else if (G.handle.shape === "square" && G.handle.filled) {
      const shape = new THREE.Shape();
      const pts = squarePath(G.handle.radius + G.handle.tube);
      shape.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) shape.lineTo(p.x, p.y);
      handleGeo = new THREE.ExtrudeGeometry(shape, extrusao);
      handleGeo.center();
    } else if (G.handle.shape === "square") {
      // Sem o ultimo ponto (repete o primeiro): a curva fechada ja emenda.
      const pts = squarePath(G.handle.radius).slice(0, -1).map((p) => new THREE.Vector3(p.x, p.y, 0));
      const curva = new THREE.CatmullRomCurve3(pts, true, "centripetal");
      handleGeo = new THREE.TubeGeometry(curva, 96, G.handle.tube, 14, true);
    } else if (G.handle.filled) {
      const disco = new THREE.Shape();
      disco.absarc(0, 0, G.handle.radius + G.handle.tube, 0, Math.PI * 2, false);
      handleGeo = new THREE.ExtrudeGeometry(disco, { ...extrusao, curveSegments: 48 });
      handleGeo.center();
    } else {
      handleGeo = new THREE.TorusGeometry(G.handle.radius, G.handle.tube, 20, 64);
    }
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(G.handle.offsetX, G.handle.offsetY, 0);
    // SEM rotacao em Y. O coracao vem de uma curva no plano XY — a MESMA
    // orientacao do TorusGeometry, que tambem e XY. Girar 90 graus em Y
    // deixava o coracao de PERFIL para a camera, um risco vertical em vez
    // de uma alca. So a inclinacao no proprio plano (tilt, em Z) e aceita.
    handle.rotation.z = (G.handle.tilt * Math.PI) / 180;
    handle.castShadow = opaco(M.handle);
    group.add(handle);
  }
  // S11 — acessorios do modelo. A colher da CANECA COM COLHER e o pires
  // da xicara sao parte do que se compra: sem eles o mockup mostra outro
  // produto. Na foto a colher fica de pe no vao da alca, com a concha
  // acima da borda — nao encostada na frente da caneca.
  if (acess.spoon) {
    const compr = G.body.height * 0.66;
    const topoDoCabo = meiaAltura + G.body.height * 0.1;
    const inclinacao = -0.12;
    const x = G.handle.offsetX + G.handle.radius * 0.1;
    const cabo = new THREE.Mesh(
      new THREE.BoxGeometry(G.handle.tube * 0.7, compr, G.handle.tube * 0.2),
      handleMat
    );
    cabo.position.set(x, topoDoCabo - compr / 2, 0);
    cabo.rotation.z = inclinacao;
    cabo.castShadow = opaco(M.handle);
    group.add(cabo);
    // A concha e uma elipse achatada, um quarto da largura do corpo.
    const raioConcha = G.body.topRadius * 0.23;
    const concha = new THREE.Mesh(new THREE.SphereGeometry(raioConcha, 24, 16), handleMat);
    concha.scale.set(0.7, 1, 0.3);
    concha.position.set(x - Math.sin(inclinacao) * compr * 0.5, topoDoCabo + raioConcha * 0.7, 0);
    concha.rotation.z = inclinacao;
    concha.castShadow = opaco(M.handle);
    group.add(concha);
  }
  if (acess.saucer) {
    const pires = new THREE.Mesh(
      new THREE.CylinderGeometry(G.body.topRadius * 1.95, G.body.topRadius * 1.72, G.body.height * 0.08, 64),
      handleMat
    );
    pires.position.y = -G.body.height / 2 - G.body.height * 0.05;
    pires.castShadow = true;
    group.add(pires);
  }

  group.rotation.y = Math.PI;
  scene.add(group);

  // Chao: invisivel, so recebe a sombra projetada; e a mancha de contato
  // por cima, que segura a peca no chao mesmo onde a luz nao alcanca.
  const chaoY = floorLevel(G, acess);
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.2 }));
  chao.rotation.x = -Math.PI / 2;
  chao.position.y = chaoY - 0.001;
  chao.receiveShadow = true;
  scene.add(chao);
  const raioSombra = contactShadowRadius(G, acess);
  const contato = new THREE.Mesh(
    new THREE.PlaneGeometry(raioSombra * 2, raioSombra * 2),
    new THREE.MeshBasicMaterial({ map: paintContactShadow(THREE), transparent: true, depthWrite: false }),
  );
  contato.rotation.x = -Math.PI / 2;
  contato.position.y = chaoY + 0.002;
  scene.add(contato);

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
    M = applyCustomerColor(readMugMaterials(spec), o.garmentColor);
    handleMat.color.set(M.handle.color).convertSRGBToLinear();
    rimMat.color.set(M.rim.color).convertSRGBToLinear();
    bottomMat.color.set(M.bottom.color).convertSRGBToLinear();
    innerMat.color.set(M.interior.color).convertSRGBToLinear();
    innerBottomMat.color.set(M.interior.color).convertSRGBToLinear();
    o.bodyColor = M.body.color;
    o.bodyTopBand = M.body.topBand ?? null;
    o.bodyOpacity = M.body.opacity;
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

  // F5: grava uma volta completa (ease in-out) e devolve Blob webm.
  // null = navegador sem captureStream/MediaRecorder (caller mostra erro).
  function recordTurntable(durationMs = 3600): Promise<Blob | null> {
    return new Promise((resolve) => {
      const anyCanvas = canvas as any;
      if (typeof anyCanvas.captureStream !== "function" || typeof (window as any).MediaRecorder === "undefined") {
        return resolve(null);
      }
      userTouched = true; // pausa o auto-rotate do loop durante a gravação
      let rec: any;
      try {
        const stream = anyCanvas.captureStream(30);
        const MR = (window as any).MediaRecorder;
        let mime = "video/webm;codecs=vp9";
        if (MR.isTypeSupported && !MR.isTypeSupported(mime)) mime = "vídeo/webm";
        try {
          rec = new MR(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
        } catch (_e) {
          rec = new MR(stream);
        }
      } catch (_e) {
        return resolve(null);
      }
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e: any) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || "vídeo/webm" }));
      rec.onerror = () => resolve(null);
      rec.start();

      const start = performance.now();
      const startRot = group.rotation.y;
      const spin = (now: number) => {
        if (disposed) { try { rec.stop(); } catch (_e) { resolve(null); } return; }
        const t = Math.min((now - start) / durationMs, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        group.rotation.y = startRot + ease * Math.PI * 2;
        render();
        if (t < 1) {
          requestAnimationFrame(spin);
        } else {
          setTimeout(() => { try { rec.stop(); } catch (_e) { resolve(null); } }, 150);
        }
      };
      requestAnimationFrame(spin);
    });
  }

  function dispose() {
    disposed = true;
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    try { if (scene.environment) scene.environment.dispose(); } catch (_e) {}
    try { renderer.dispose(); } catch (_e) {}
  }

  resize();
  await update(values);
  loop();

  return { update, snapshot, recordTurntable, dispose };
}
