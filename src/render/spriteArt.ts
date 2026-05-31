import * as THREE from "three";
import type { MonsterKind, MonsterVisualState, WeaponId } from "../simulation/types";

export type WeaponSpriteArt = {
  texture: THREE.CanvasTexture;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

export type MonsterSpriteAnimations = Record<MonsterVisualState, THREE.CanvasTexture[]>;
export type PropSpriteArt = {
  texture: THREE.CanvasTexture;
  width: number;
  height: number;
  offsetY: number;
};

export type WeaponSpritePose = "idle" | "attack" | "side";

const SPRITE_ASSET_URL = "/assets/sprites-ai";
const sheetImages = new Map<string, HTMLImageElement>();
const loadedSheets = new Set<string>();
const pendingSheetPaints = new Map<string, Array<() => void>>();

export function createMonsterAnimations(kind: MonsterKind): MonsterSpriteAnimations {
  return {
    walk: [0, 1, 2, 3].map((frame) => createMonsterFrame(kind, "walk", frame)),
    hit: [0, 1].map((frame) => createMonsterFrame(kind, "hit", frame)),
    attack: [0, 1, 2].map((frame) => createMonsterFrame(kind, "attack", frame)),
    dead: [0].map((frame) => createMonsterFrame(kind, "dead", frame)),
  };
}

export function createWeaponArt(weaponId: WeaponId, pose: WeaponSpritePose = "idle"): WeaponSpriteArt {
  return createWeaponAssetArt(weaponId, pose);
}

export function createWeaponPickupArt(weaponId: WeaponId): WeaponSpriteArt {
  const texture = createSpriteAssetTexture(getWeaponSpriteUrl(weaponId, "side"), 640, 420);
  if (weaponId === "knife") {
    return { texture, width: 2.05, height: 0.58, offsetX: 0, offsetY: 0.82 };
  }
  if (weaponId === "m134") {
    return { texture, width: 2.35, height: 0.78, offsetX: 0, offsetY: 0.86 };
  }
  if (weaponId === "scarlm" || weaponId === "barrett" || weaponId === "m667") {
    return { texture, width: weaponId === "barrett" ? 2.55 : 2.35, height: 0.72, offsetX: 0, offsetY: 0.86 };
  }
  return { texture, width: 1.62, height: 0.84, offsetX: 0, offsetY: 0.86 };
}

export function createPropArt(kind: "chest" | "exit"): PropSpriteArt {
  const texture = createSpriteAssetTexture(`${SPRITE_ASSET_URL}/props/${kind}.png`, 320, 360);
  return kind === "chest"
    ? { texture, width: 2.05, height: 1.75, offsetY: 0.88 }
    : { texture, width: 3.15, height: 3.65, offsetY: 1.82 };
}

export function createWeaponIconStyle(weaponId: WeaponId): string {
  return `--slot-image:url('${getWeaponSpriteUrl(weaponId, "side")}'); --slot-position:center; --slot-size:contain`;
}

function createMonsterFrame(kind: MonsterKind, state: MonsterVisualState, frame: number): THREE.CanvasTexture {
  if (kind === "zombie" || kind === "skull") {
    return createSpriteAssetTexture(`${SPRITE_ASSET_URL}/monsters/${kind}-${state}-${frame}.png`, 320, 448);
  }

  const canvas = createCanvas(320, 448);
  const context = getContext(canvas);
  context.translate(160, state === "dead" ? 280 : 240 + Math.sin(frame * 1.8) * 5);

  if (kind === "skull") {
    drawCyberSkull(context, state, frame);
  } else {
    drawCyberZombie(context, state, frame);
  }

  return createTexture(canvas, 112);
}

function getWeaponSpriteUrl(weaponId: WeaponId, pose: WeaponSpritePose): string {
  return `${SPRITE_ASSET_URL}/weapons/${weaponId}-${pose}.png`;
}

function createSpriteAssetTexture(url: string, canvasWidth: number, canvasHeight: number): THREE.CanvasTexture {
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const context = getContext(canvas);
  const texture = createTexture(canvas, 0);
  const paint = () => {
    const image = getSpriteAssetImage(url);
    if (!image || !loadedSheets.has(url)) return;

    const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    texture.needsUpdate = true;
  };

  if (loadedSheets.has(url)) {
    paint();
  } else {
    const pendingPaints = pendingSheetPaints.get(url) ?? [];
    pendingPaints.push(paint);
    pendingSheetPaints.set(url, pendingPaints);
    getSpriteAssetImage(url);
  }

  return texture;
}

function getSpriteAssetImage(sheetUrl: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  const existing = sheetImages.get(sheetUrl);
  if (existing) return existing;

  const image = new Image();
  image.onload = () => {
    loadedSheets.add(sheetUrl);
    const pendingPaints = pendingSheetPaints.get(sheetUrl) ?? [];
    pendingSheetPaints.set(sheetUrl, []);
    for (const paint of pendingPaints) {
      paint();
    }
  };
  image.src = sheetUrl;
  sheetImages.set(sheetUrl, image);
  return image;
}

function createWeaponAssetArt(weaponId: WeaponId, pose: WeaponSpritePose): WeaponSpriteArt {
  const texture = createSpriteAssetTexture(getWeaponSpriteUrl(weaponId, pose), 640, 420);
  if (pose === "attack") {
    if (weaponId === "knife") {
      return { texture, width: 2.38, height: 1.32, offsetX: -0.02, offsetY: 0.02 };
    }
    if (weaponId === "m134") {
      return { texture, width: 3.18, height: 1.22, offsetX: -0.1, offsetY: 0 };
    }
    if (weaponId === "scarlm" || weaponId === "barrett" || weaponId === "m667") {
      return { texture, width: weaponId === "barrett" ? 3.32 : 3.08, height: 1.2, offsetX: -0.12, offsetY: 0 };
    }
    return { texture, width: 2.58, height: 1.18, offsetX: -0.06, offsetY: 0 };
  }
  if (weaponId === "knife") {
    return { texture, width: pose === "side" ? 2.05 : 1.95, height: pose === "side" ? 0.62 : 1.18, offsetX: 0.12, offsetY: -0.04 };
  }
  if (weaponId === "m134") {
    return { texture, width: 2.28, height: 1.05, offsetX: 0.08, offsetY: -0.04 };
  }
  if (weaponId === "scarlm" || weaponId === "barrett" || weaponId === "m667") {
    return { texture, width: weaponId === "barrett" ? 2.42 : 2.2, height: 1.02, offsetX: 0.04, offsetY: -0.03 };
  }
  return { texture, width: 1.82, height: 1, offsetX: 0.1, offsetY: -0.03 };
}

function drawSlashEffect(context: CanvasRenderingContext2D): void {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.globalCompositeOperation = "source-over";
  context.shadowBlur = 24;
  context.shadowColor = "#62f7ff";
  context.strokeStyle = "rgba(104, 247, 255, 0.95)";
  context.lineWidth = 18;
  context.beginPath();
  context.ellipse(350, 154, 210, 68, -0.22, Math.PI * 0.92, Math.PI * 1.92);
  context.stroke();
  context.shadowColor = "#ff4bd8";
  context.strokeStyle = "rgba(255, 75, 216, 0.86)";
  context.lineWidth = 9;
  context.beginPath();
  context.ellipse(360, 170, 205, 56, -0.22, Math.PI * 0.98, Math.PI * 1.82);
  context.stroke();
  context.restore();
}

function drawMuzzleEffect(context: CanvasRenderingContext2D, weaponId: WeaponId): void {
  const origin = getMuzzleEffectOrigin(weaponId);
  context.save();
  context.globalCompositeOperation = "source-over";
  const flashSize = weaponId === "barrett" || weaponId === "m667" ? 180 : weaponId === "m134" ? 160 : 150;
  const gradient = context.createRadialGradient(origin.x, origin.y, 4, origin.x, origin.y, flashSize);
  gradient.addColorStop(0, "rgba(255, 255, 235, 1)");
  gradient.addColorStop(0.25, "rgba(255, 187, 76, 0.95)");
  gradient.addColorStop(0.62, "rgba(255, 83, 34, 0.5)");
  gradient.addColorStop(1, "rgba(255, 83, 34, 0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(origin.x, origin.y, flashSize * 1.05, flashSize * 0.42, -0.08, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(255, 225, 92, 0.92)";
  context.beginPath();
  context.moveTo(origin.x - flashSize * 0.9, origin.y);
  context.lineTo(origin.x + flashSize * 0.2, origin.y - flashSize * 0.34);
  context.lineTo(origin.x + flashSize * 0.55, origin.y);
  context.lineTo(origin.x + flashSize * 0.2, origin.y + flashSize * 0.34);
  context.closePath();
  context.fill();

  context.strokeStyle = weaponId === "m667" ? "rgba(91, 245, 255, 0.9)" : "rgba(255, 231, 156, 0.8)";
  context.lineWidth = 5;
  context.shadowBlur = 14;
  context.shadowColor = context.strokeStyle;
  for (let index = 0; index < 5; index += 1) {
    const spread = (index - 2) * 0.18;
    context.beginPath();
    context.moveTo(origin.x + 18, origin.y);
    context.lineTo(origin.x - flashSize * 0.78, origin.y + spread * flashSize);
    context.stroke();
  }

  context.fillStyle = "rgba(242, 176, 75, 0.92)";
  for (let index = 0; index < 3; index += 1) {
    context.save();
    context.translate(origin.x + 172 + index * 34, origin.y - 58 - index * 10);
    context.rotate(-0.34 + index * 0.18);
    context.fillRect(-16, -5, 32, 10);
    context.restore();
  }
  context.restore();
}

function getMuzzleEffectOrigin(weaponId: WeaponId): { x: number; y: number } {
  if (weaponId === "m134") return { x: 360, y: 142 };
  if (weaponId === "scarlm" || weaponId === "barrett") return { x: 340, y: 138 };
  if (weaponId === "m667") return { x: 350, y: 150 };
  return { x: 420, y: 145 };
}

function drawCyberSkull(context: CanvasRenderingContext2D, state: MonsterVisualState, frame: number): void {
  if (state === "dead") {
    drawDeadSkull(context);
    return;
  }

  const pulse = frame === 1 ? 1 : 0.72;
  const mainColor = state === "hit" ? "#f5fbff" : "#55f4ff";
  const dangerColor = state === "hit" ? "#ff557a" : "#ff4dd8";
  glow(context, mainColor, 28 * pulse);

  context.fillStyle = "rgba(3, 8, 14, 0.94)";
  context.strokeStyle = mainColor;
  context.lineWidth = 6;
  const attackStretch = state === "attack" ? 18 : 0;
  polygon(context, [
    { x: -72, y: -112 - attackStretch },
    { x: -112, y: -44 - attackStretch },
    { x: -80, y: 44 + attackStretch },
    { x: -34, y: 88 },
    { x: 34, y: 88 },
    { x: 80, y: 44 + attackStretch },
    { x: 112, y: -44 - attackStretch },
    { x: 72, y: -112 - attackStretch },
  ], true);

  context.strokeStyle = dangerColor;
  context.lineWidth = 4;
  line(context, -55, -18, -20, -8);
  line(context, 55, -18, 20, -8);
  line(context, -42, 36, 42, 36);
  line(context, -26, 56, 26, 56);

  glow(context, dangerColor, 18 * pulse);
  context.fillStyle = dangerColor;
  context.fillRect(-62, state === "attack" ? -44 : -36, 38, state === "attack" ? 22 : 15);
  context.fillRect(24, state === "attack" ? -44 : -36, 38, state === "attack" ? 22 : 15);

  glow(context, mainColor, 18);
  context.strokeStyle = mainColor;
  context.lineWidth = 5;
  circle(context, 0, 3, 28, false);
  line(context, 0, -25, 0, 31);
  line(context, -82, -98, -124 - attackStretch, -150 + attackStretch);
  line(context, 82, -98, 124 + attackStretch, -150 + attackStretch);

  if (state === "attack") {
    context.strokeStyle = "#e9fbff";
    context.lineWidth = 6;
    line(context, -58, 58, -92, 118);
    line(context, 58, 58, 92, 118);
  }

  context.globalAlpha = frame === 2 ? 0.9 : 0.55;
  context.strokeStyle = "#e9fbff";
  context.lineWidth = 2;
  line(context, -102, 108, 102, 108);
  line(context, -72, 126, 72, 126);
  context.globalAlpha = 1;
}

function drawCyberZombie(context: CanvasRenderingContext2D, state: MonsterVisualState, frame: number): void {
  if (state === "dead") {
    drawDeadZombie(context);
    return;
  }

  const step = frame % 2 === 0 ? -1 : 1;
  const lean = state === "attack" ? -0.18 : state === "hit" ? 0.13 : -0.06 + step * 0.025;
  const yBob = state === "attack" ? -8 : step * 3;
  const cyan = state === "hit" ? "#dffbff" : "#80d8df";
  const magenta = state === "hit" ? "#ff4f86" : "#d934ae";
  const acid = state === "hit" ? "#e9fff3" : "#55c988";

  context.save();
  context.translate(0, yBob);
  context.rotate(lean);
  glow(context, acid, 10);

  drawZombieLeg(context, -24, 68, -50 + step * 9, 160, -28 + step * 5, 174, acid);
  drawZombieLeg(context, 28, 70, 34 - step * 7, 158, 68 - step * 6, 172, acid);
  drawZombieTorso(context, cyan, acid, magenta);

  if (state === "attack") {
    drawZombieArm(context, -48, -45, -104, -10, -126, 18, acid);
    drawZombieArm(context, 48, -42, 114, -10, 144, 14, acid);
    glow(context, magenta, 18);
    context.strokeStyle = magenta;
    context.lineWidth = 5;
    context.beginPath();
    context.arc(98, 12, 72, -0.6, 0.75);
    context.stroke();
  } else {
    drawZombieArm(context, -48, -44, -78 + step * 9, 18, -86 + step * 8, 72, acid);
    drawZombieArm(context, 46, -42, 74 - step * 7, 15, 82 - step * 9, 70, acid);
  }

  drawZombieHead(context, cyan, magenta, state === "hit");
  drawZombieWires(context, magenta, cyan);

  if (state === "hit") {
    drawImpactSparks(context, 62, -18, magenta);
  }

  context.restore();
}

function drawDeadSkull(context: CanvasRenderingContext2D): void {
  context.rotate(-0.08);
  glow(context, "#55f4ff", 16);
  context.fillStyle = "rgba(3, 8, 14, 0.88)";
  context.strokeStyle = "rgba(85, 244, 255, 0.86)";
  context.lineWidth = 5;
  polygon(context, [
    { x: -124, y: -26 },
    { x: -72, y: -62 },
    { x: 76, y: -56 },
    { x: 128, y: -16 },
    { x: 96, y: 46 },
    { x: -90, y: 48 },
  ], true);
  context.strokeStyle = "#ff557a";
  context.lineWidth = 4;
  line(context, -46, -10, -16, 10);
  line(context, 38, -12, 12, 8);
  context.strokeStyle = "rgba(233, 251, 255, 0.6)";
  line(context, -116, 68, 118, 68);
  line(context, -78, 88, 78, 88);
}

function drawDeadZombie(context: CanvasRenderingContext2D): void {
  context.save();
  context.rotate(0.03);
  glow(context, "#62ff9d", 10);

  context.strokeStyle = "rgba(37, 45, 47, 0.95)";
  context.lineWidth = 17;
  line(context, -108, 36, -46, 12);
  line(context, 12, 16, 106, 46);
  line(context, -28, 32, -86, 76);
  line(context, 42, 35, 112, 74);

  context.strokeStyle = "rgba(109, 255, 155, 0.72)";
  context.lineWidth = 4;
  line(context, -108, 36, -46, 12);
  line(context, 12, 16, 106, 46);

  context.fillStyle = "rgba(8, 13, 16, 0.96)";
  context.strokeStyle = "rgba(109, 255, 155, 0.88)";
  context.lineWidth = 5;
  roundedRect(context, -62, -8, 126, 54, 12, true);

  context.fillStyle = "rgba(33, 39, 43, 0.98)";
  context.strokeStyle = "rgba(140, 247, 255, 0.78)";
  roundedRect(context, -45, -22, 78, 34, 8, true);

  context.fillStyle = "rgba(42, 44, 48, 0.98)";
  context.strokeStyle = "rgba(255, 79, 134, 0.9)";
  ellipse(context, 86, 18, 32, 23, -0.18, true);
  context.fillStyle = "#d7dad9";
  ellipse(context, 74, 13, 10, 8, -0.2, true);
  context.fillStyle = "#09090c";
  ellipse(context, 72, 14, 4, 3, 0, true);
  context.fillStyle = "#ff45d7";
  context.fillRect(86, 3, 28, 5);

  context.strokeStyle = "rgba(255, 69, 215, 0.85)";
  context.lineWidth = 3;
  line(context, -92, 84, 124, 86);
  line(context, -18, 52, 74, 56);
  drawSmoke(context, -16, -46);
  context.restore();
}

function drawZombieHead(context: CanvasRenderingContext2D, cyan: string, magenta: string, hit: boolean): void {
  glow(context, magenta, hit ? 10 : 5);
  context.fillStyle = "rgba(49, 50, 54, 0.98)";
  context.strokeStyle = "rgba(210, 223, 219, 0.78)";
  context.lineWidth = 3;
  ellipse(context, 7, -132, 24, 31, -0.16, true);

  context.fillStyle = "rgba(163, 168, 166, 0.95)";
  ellipse(context, -3, -136, 9, 7, -0.18, true);
  ellipse(context, 14, -137, 7, 6, -0.18, true);
  context.fillStyle = "#05070b";
  ellipse(context, -3, -136, 3, 2, 0, true);
  ellipse(context, 14, -137, 3, 2, 0, true);

  context.strokeStyle = magenta;
  context.lineWidth = 3;
  line(context, -14, -120, 25, -124);
  context.strokeStyle = "rgba(210, 223, 219, 0.64)";
  context.lineWidth = 2;
  line(context, -5, -109, 18, -113);
  line(context, -10, -147, -23, -155);
  context.lineWidth = 2;
  context.strokeStyle = magenta;
  line(context, 24, -149, 44, -161);
  circle(context, 46, -157, 4, true);
}

function drawZombieTorso(context: CanvasRenderingContext2D, cyan: string, acid: string, magenta: string): void {
  context.fillStyle = "rgba(18, 22, 24, 0.98)";
  context.strokeStyle = "rgba(85, 201, 136, 0.82)";
  context.lineWidth = 3;
  polygon(context, [
    { x: -35, y: -85 },
    { x: 36, y: -78 },
    { x: 49, y: 26 },
    { x: 21, y: 76 },
    { x: -28, y: 73 },
    { x: -50, y: 17 },
  ], true);

  context.fillStyle = "rgba(43, 49, 51, 0.98)";
  context.strokeStyle = "rgba(128, 216, 223, 0.7)";
  context.lineWidth = 3;
  roundedRect(context, -38, -52, 76, 38, 7, true);
  roundedRect(context, -29, 0, 62, 42, 6, true);
  context.fillStyle = "rgba(18, 22, 24, 0.95)";
  roundedRect(context, -21, -68, 34, 24, 5, true);

  context.strokeStyle = "rgba(220, 233, 231, 0.62)";
  context.lineWidth = 2;
  line(context, -22, -35, 24, -31);
  line(context, -18, 17, 22, 18);
  line(context, -19, 36, 19, 36);

  glow(context, magenta, 5);
  context.fillStyle = magenta;
  circle(context, 39, -39, 4, true);
  circle(context, -33, 18, 3, true);
  circle(context, 17, 57, 3, true);
}

function drawZombieArm(
  context: CanvasRenderingContext2D,
  shoulderX: number,
  shoulderY: number,
  elbowX: number,
  elbowY: number,
  handX: number,
  handY: number,
  accent: string,
): void {
  context.strokeStyle = "rgba(30, 33, 35, 0.98)";
  context.lineWidth = 13;
  line(context, shoulderX, shoulderY, elbowX, elbowY);
  line(context, elbowX, elbowY, handX, handY);
  context.strokeStyle = "rgba(85, 201, 136, 0.72)";
  context.lineWidth = 3;
  line(context, shoulderX, shoulderY, elbowX, elbowY);
  line(context, elbowX, elbowY, handX, handY);
  context.fillStyle = "rgba(62, 65, 68, 0.98)";
  context.strokeStyle = "rgba(206, 211, 208, 0.7)";
  context.lineWidth = 2;
  roundedRect(context, handX - 8, handY - 7, 16, 14, 4, true);
  context.strokeStyle = "rgba(206, 211, 208, 0.76)";
  context.lineWidth = 2;
  line(context, handX + 4, handY + 3, handX + 18, handY + 11);
  line(context, handX + 3, handY - 2, handX + 19, handY - 2);
}

function drawZombieLeg(
  context: CanvasRenderingContext2D,
  hipX: number,
  hipY: number,
  kneeX: number,
  kneeY: number,
  footX: number,
  footY: number,
  accent: string,
): void {
  context.strokeStyle = "rgba(27, 31, 33, 0.98)";
  context.lineWidth = 16;
  line(context, hipX, hipY, kneeX, kneeY);
  line(context, kneeX, kneeY, footX, footY);
  context.strokeStyle = "rgba(85, 201, 136, 0.65)";
  context.lineWidth = 3;
  line(context, hipX, hipY, kneeX, kneeY);
  line(context, kneeX, kneeY, footX, footY);
  context.fillStyle = "rgba(32, 35, 38, 0.98)";
  context.strokeStyle = "rgba(216, 224, 222, 0.62)";
  context.lineWidth = 3;
  roundedRect(context, footX - 18, footY - 4, 42, 16, 6, true);
}

function drawZombieWires(context: CanvasRenderingContext2D, magenta: string, cyan: string): void {
  context.shadowBlur = 0;
  context.strokeStyle = "rgba(255, 69, 215, 0.6)";
  context.lineWidth = 2;
  line(context, -22, -76, -52, -104);
  line(context, 34, -72, 60, -96);
  context.strokeStyle = "rgba(140, 247, 255, 0.56)";
  line(context, -4, -78, 8, -116);
  context.fillStyle = magenta;
  circle(context, -52, -104, 3, true);
  context.fillStyle = cyan;
  circle(context, 61, -96, 3, true);
}

function drawImpactSparks(context: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  glow(context, color, 12);
  context.strokeStyle = color;
  context.lineWidth = 3;
  for (let index = 0; index < 7; index += 1) {
    const angle = index * 0.9;
    line(context, x, y, x + Math.cos(angle) * (22 + index * 3), y + Math.sin(angle) * (18 + index * 2));
  }
}

function drawSmoke(context: CanvasRenderingContext2D, x: number, y: number): void {
  context.shadowBlur = 0;
  context.fillStyle = "rgba(118, 138, 139, 0.26)";
  ellipse(context, x, y, 14, 9, -0.2, true);
  ellipse(context, x + 16, y - 16, 18, 12, 0.2, true);
  ellipse(context, x + 39, y - 34, 13, 9, -0.1, true);
}

function drawKnife(context: CanvasRenderingContext2D, color: string): void {
  context.rotate(-0.58);
  glow(context, color, 24);
  context.fillStyle = "rgba(220, 250, 255, 0.95)";
  polygon(context, [
    { x: -220, y: -24 },
    { x: 108, y: -38 },
    { x: 246, y: 0 },
    { x: 108, y: 38 },
    { x: -220, y: 24 },
  ], true);
  context.fillStyle = color;
  polygon(context, [
    { x: -186, y: 0 },
    { x: 122, y: -12 },
    { x: 210, y: 0 },
    { x: 122, y: 12 },
  ], true);
  context.fillStyle = "#080b10";
  roundedRect(context, -306, -34, 92, 68, 12, true);
  context.fillStyle = "#151a20";
  roundedRect(context, -246, -54, 34, 108, 8, true);
}

function drawPistol(context: CanvasRenderingContext2D, color: string, weaponId: WeaponId): void {
  context.rotate(-0.08);
  glow(context, color, 18);
  context.fillStyle = "#090d13";
  roundedRect(context, -212, -58, 282, 78, 12, true);
  context.fillStyle = "#151d26";
  roundedRect(context, -188, -84, 230, 40, 8, true);
  context.fillStyle = color;
  context.fillRect(-174, -74, weaponId === "glock29" ? 96 : 64, 7);
  context.fillStyle = "#070a0f";
  roundedRect(context, -76, 6, 58, 128, 10, true);
  context.fillStyle = color;
  context.fillRect(40, -66, 132, 16);
  context.fillStyle = "rgba(233, 251, 255, 0.9)";
  context.fillRect(168, -62, 42, 8);
}

function drawLongGun(context: CanvasRenderingContext2D, color: string, weaponId: WeaponId): void {
  const longScale = weaponId === "barrett" ? 1.16 : 1;
  glow(context, color, 19);
  context.fillStyle = "#080c12";
  roundedRect(context, -250, -52, 276, 74, 10, true);
  context.fillStyle = "#151d26";
  roundedRect(context, -178, -88, 196, 38, 6, true);
  context.fillStyle = color;
  context.fillRect(-162, -76, 158, 6);
  context.fillStyle = "#070a0f";
  roundedRect(context, -292, -28, 72, 54, 8, true);
  roundedRect(context, -88, 8, 48, 124, 10, true);
  context.fillStyle = color;
  context.fillRect(10, -42, 210 * longScale, weaponId === "m667" ? 28 : 14);
  context.fillStyle = "rgba(233, 251, 255, 0.86)";
  context.fillRect(206 * longScale, -38, 60, 6);
  if (weaponId === "m667") {
    context.strokeStyle = color;
    context.lineWidth = 8;
    circle(context, 72, -27, 38, false);
  }
}

function drawMinigun(context: CanvasRenderingContext2D, color: string): void {
  glow(context, color, 22);
  context.fillStyle = "#090d13";
  roundedRect(context, -238, -62, 252, 96, 14, true);
  context.fillStyle = "#151d26";
  roundedRect(context, -100, -100, 100, 48, 8, true);
  context.fillStyle = color;
  for (let y = -58; y <= 18; y += 19) {
    context.fillRect(-8, y, 242, 8);
  }
  context.strokeStyle = color;
  context.lineWidth = 8;
  circle(context, 228, -20, 34, false);
  context.fillStyle = "#070a0f";
  roundedRect(context, -78, 4, 54, 126, 10, true);
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable.");
  context.lineCap = "round";
  context.lineJoin = "round";
  return context;
}

function createTexture(canvas: HTMLCanvasElement, alphaFloor = 0): THREE.CanvasTexture {
  if (alphaFloor > 0) {
    removeSoftAlphaPixels(canvas, alphaFloor);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function removeSoftAlphaPixels(canvas: HTMLCanvasElement, alphaFloor: number): void {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable.");

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 3; index < imageData.data.length; index += 4) {
    if (imageData.data[index] < alphaFloor) {
      imageData.data[index] = 0;
    }
  }
  context.putImageData(imageData, 0, 0);
}

function glow(context: CanvasRenderingContext2D, color: string, blur: number): void {
  context.shadowColor = color;
  context.shadowBlur = blur;
}

function polygon(context: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>, fill: boolean): void {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) {
    context.lineTo(point.x, point.y);
  }
  context.closePath();
  if (fill) context.fill();
  context.stroke();
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: boolean): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  if (fill) context.fill();
  context.stroke();
}

function circle(context: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: boolean): void {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  if (fill) context.fill();
  context.stroke();
}

function ellipse(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  rotation: number,
  fill: boolean,
): void {
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
  if (fill) context.fill();
  context.stroke();
}

function line(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}
