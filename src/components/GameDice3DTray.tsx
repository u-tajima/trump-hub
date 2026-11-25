import React, { useEffect, useRef } from 'react';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import './GameDice3DTray.css';

export interface GameDice3DTrayProps {
  dice: number[];                 // 各サイコロの出目 (1..6)、長さ 1..6
  rollTrigger: number;            // 値が増えると未ホールドのサイコロを3D物理ロール
  held?: boolean[];               // ホールド中のサイコロはロールせず金色発光リング付きで静止
  highlighted?: boolean[];        // 強調表示（ワイルド1・該当目など）
  dimmed?: boolean;               // 未ロール状態などの控えめ表現
  height?: number;                // キャンバス高さ（px、デフォルト 144）
  interactive?: boolean;          // true のとき3Dサイコロの直接タップ (Raycaster) で onDieClick を発火
  onDieClick?: (index: number) => void;
  onRollSettled?: () => void;
}

const FIXED_DT = 1 / 60;

// BoxGeometry / RoundedBoxGeometry の面順: [0:+x, 1:-x, 2:+y, 3:-y, 4:+z, 5:-z]
const LOCAL_FACE_AXES = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

const PIP_COORDS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.29, 0.29], [0.71, 0.71]],
  3: [[0.29, 0.29], [0.5, 0.5], [0.71, 0.71]],
  4: [[0.29, 0.29], [0.71, 0.29], [0.29, 0.71], [0.71, 0.71]],
  5: [[0.29, 0.29], [0.71, 0.29], [0.5, 0.5], [0.29, 0.71], [0.71, 0.71]],
  6: [[0.29, 0.27], [0.71, 0.27], [0.29, 0.5], [0.71, 0.5], [0.29, 0.73], [0.71, 0.73]],
};

function clampFace(v: number): number {
  const n = Math.round(v);
  if (n < 1) return 1;
  if (n > 6) return 6;
  return n;
}

// 対面和 = 7 を維持しながら、指定ローカル面 topFaceIdx に targetValue が来る 6面配列を生成
function buildRemappedFaceValues(topFaceIdx: number, targetValue: number): number[] {
  const safeVal = clampFace(targetValue);
  const oppIdx = topFaceIdx % 2 === 0 ? topFaceIdx + 1 : topFaceIdx - 1;
  const oppVal = 7 - safeVal;
  const remainingPairs: [number, number][] = (
    [
      [1, 6],
      [2, 5],
      [3, 4],
    ] as [number, number][]
  ).filter(([a, b]) => a !== safeVal && b !== safeVal);

  const result = Array<number>(6).fill(1);
  result[topFaceIdx] = safeVal;
  result[oppIdx] = oppVal;

  const remainingIdxPairs: [number, number][] = (
    [
      [0, 1],
      [2, 3],
      [4, 5],
    ] as [number, number][]
  ).filter(([a, b]) => a !== topFaceIdx && b !== topFaceIdx);

  remainingIdxPairs.forEach(([ia, ib], i) => {
    result[ia] = remainingPairs[i][0];
    result[ib] = remainingPairs[i][1];
  });
  return result;
}

function getTopFaceIndex(q: { x: number; y: number; z: number; w: number }): {
  index: number;
  alignment: number;
} {
  const tq = new THREE.Quaternion(q.x, q.y, q.z, q.w);
  let bestIdx = 2;
  let bestY = -2;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < 6; i++) {
    tmp.copy(LOCAL_FACE_AXES[i]).applyQuaternion(tq);
    if (tmp.y > bestY) {
      bestY = tmp.y;
      bestIdx = i;
    }
  }
  return { index: bestIdx, alignment: bestY };
}

function createRoundedDieGeometry(size: number): THREE.BufferGeometry {
  const geo = new RoundedBoxGeometry(size, size, size, 5, size * 0.18);
  const vertsPerSide = geo.attributes.position.count / 6;
  geo.clearGroups();
  for (let side = 0; side < 6; side++) {
    geo.addGroup(side * vertsPerSide, vertsPerSide, side);
  }
  return geo;
}

function createDieFaceTexture(value: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f2eee5';
  ctx.fillRect(0, 0, size, size);

  const bg = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.05,
    size * 0.5,
    size * 0.5,
    size * 0.46
  );
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.75, '#f8f5ee');
  bg.addColorStop(1, '#f2eee5');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  const coords = PIP_COORDS[value] ?? PIP_COORDS[1];
  const radius = value === 1 ? size * 0.145 : size * 0.084;

  for (const [u, v] of coords) {
    const cx = u * size;
    const cy = v * size;

    ctx.beginPath();
    ctx.arc(cx + 1.5, cy + 1.5, radius * 1.06, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.fill();

    const pipGrad = ctx.createRadialGradient(
      cx + radius * 0.22,
      cy + radius * 0.22,
      radius * 0.08,
      cx,
      cy,
      radius
    );
    if (value === 1) {
      pipGrad.addColorStop(0, '#ef4444');
      pipGrad.addColorStop(0.62, '#b91c1c');
      pipGrad.addColorStop(1, '#7f1d1d');
    } else {
      pipGrad.addColorStop(0, '#334155');
      pipGrad.addColorStop(0.6, '#0f172a');
      pipGrad.addColorStop(1, '#020617');
    }
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = pipGrad;
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createFeltTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(w * 0.5, h * 0.48, 20, w * 0.5, h * 0.5, w * 0.6);
  grad.addColorStop(0, '#18633b');
  grad.addColorStop(0.58, '#114a2c');
  grad.addColorStop(1, '#0a2f1c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 微細なフェルト質感（決定論的疑似乱数）
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 2400; i++) {
    const x = nextRand() * w;
    const y = nextRand() * h;
    const alpha = 0.02 + nextRand() * 0.04;
    ctx.fillStyle = nextRand() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha * 1.4})`;
    ctx.fillRect(x, y, 2, 1.5);
  }

  // 内側の繊細なゴールドトリム線
  ctx.strokeStyle = 'rgba(217, 170, 72, 0.28)';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 14, w - 32, h - 28);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

interface TrayLayoutSpec {
  trayW: number;
  trayD: number;
  dieSize: number;
}

function getTrayLayoutSpec(count: number): TrayLayoutSpec {
  if (count <= 2) {
    return { trayW: 4.0, trayD: 2.1, dieSize: 0.82 };
  }
  if (count <= 4) {
    return { trayW: 5.0, trayD: 2.35, dieSize: 0.74 };
  }
  return { trayW: 5.9, trayD: 2.45, dieSize: 0.68 };
}

function getAlignedPositions(count: number, trayW: number, dieSize: number): [number, number][] {
  if (count <= 1) return [[0, 0]];
  const maxSpan = trayW - dieSize * 1.55;
  const idealSpacing = dieSize * 1.42;
  const span = Math.min(maxSpan, idealSpacing * (count - 1));
  const step = span / (count - 1);
  const startX = -span / 2;
  return Array.from({ length: count }, (_, i) => [startX + step * i, 0]);
}

interface RecordedTrayFrame {
  pos: [number, number, number][];
  quat: [number, number, number, number][];
}

interface RecordedTrayRoll {
  frames: RecordedTrayFrame[];
  topFaceIndices: number[];
}

function presimulateTrayRoll(
  count: number,
  spec: TrayLayoutSpec,
  heldMask: boolean[],
  currentPos: [number, number, number][],
  currentQuat: [number, number, number, number][]
): RecordedTrayRoll {
  const { trayW, trayD, dieSize } = spec;
  const dieHalf = dieSize / 2;
  const innerHalfW = trayW / 2 - 0.08;
  const innerHalfD = trayD / 2 - 0.08;
  const aligned = getAlignedPositions(count, trayW, dieSize);

  const unheldIndices: number[] = [];
  for (let i = 0; i < count; i++) {
    if (!heldMask[i]) unheldIndices.push(i);
  }

  if (unheldIndices.length === 0) {
    return {
      frames: [],
      topFaceIndices: currentQuat.map((q) =>
        getTopFaceIndex({ x: q[0], y: q[1], z: q[2], w: q[3] }).index
      ),
    };
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const world = new CANNON.World();
    world.gravity.set(0, -28, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    (world.solver as CANNON.GSSolver).iterations = 12;
    world.allowSleep = true;

    const trayMat = new CANNON.Material('tray');
    const dieMat = new CANNON.Material('die');
    world.addContactMaterial(
      new CANNON.ContactMaterial(trayMat, dieMat, {
        friction: 0.36,
        restitution: 0.22,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 4,
      })
    );
    world.addContactMaterial(
      new CANNON.ContactMaterial(dieMat, dieMat, {
        friction: 0.22,
        restitution: 0.24,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 4,
      })
    );

    // 静的トレイ（床＋4壁＋飛び出し防止天井）
    const trayBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      material: trayMat,
    });
    // 床（上面が y = 0）
    trayBody.addShape(
      new CANNON.Box(new CANNON.Vec3(innerHalfW + 0.5, 0.2, innerHalfD + 0.5)),
      new CANNON.Vec3(0, -0.2, 0)
    );
    // 左右壁
    trayBody.addShape(
      new CANNON.Box(new CANNON.Vec3(0.2, 1.5, innerHalfD + 0.5)),
      new CANNON.Vec3(-innerHalfW - 0.2, 1.3, 0)
    );
    trayBody.addShape(
      new CANNON.Box(new CANNON.Vec3(0.2, 1.5, innerHalfD + 0.5)),
      new CANNON.Vec3(innerHalfW + 0.2, 1.3, 0)
    );
    // 前後壁
    trayBody.addShape(
      new CANNON.Box(new CANNON.Vec3(innerHalfW + 0.5, 1.5, 0.2)),
      new CANNON.Vec3(0, 1.3, -innerHalfD - 0.2)
    );
    trayBody.addShape(
      new CANNON.Box(new CANNON.Vec3(innerHalfW + 0.5, 1.5, 0.2)),
      new CANNON.Vec3(0, 1.3, innerHalfD + 0.2)
    );
    // 飛び出し防止天井
    trayBody.addShape(
      new CANNON.Box(new CANNON.Vec3(innerHalfW + 0.5, 0.2, innerHalfD + 0.5)),
      new CANNON.Vec3(0, 2.75, 0)
    );
    world.addBody(trayBody);

    const dieShape = new CANNON.Box(new CANNON.Vec3(dieHalf, dieHalf, dieHalf));
    const bodies: CANNON.Body[] = [];

    for (let i = 0; i < count; i++) {
      if (heldMask[i]) {
        // ホールド中のサイコロはその場に完全固定（他ダイスと衝突しつつ動かない）
        const [px, py, pz] = currentPos[i];
        const [qx, qy, qz, qw] = currentQuat[i];
        const staticBody = new CANNON.Body({
          type: CANNON.Body.STATIC,
          material: dieMat,
          shape: dieShape,
          position: new CANNON.Vec3(px, Math.max(dieHalf, py), pz),
        });
        staticBody.quaternion.set(qx, qy, qz, qw);
        world.addBody(staticBody);
        bodies.push(staticBody);
      } else {
        const [ax] = aligned[i];
        const spawnX = Math.max(
          -innerHalfW + dieHalf + 0.12,
          Math.min(innerHalfW - dieHalf - 0.12, ax + (Math.random() - 0.5) * 0.45)
        );
        const spawnZ = (Math.random() - 0.5) * (innerHalfD * 0.72);
        const spawnY = 0.95 + Math.random() * 0.42 + (i % 3) * 0.12;

        const randQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
          )
        );

        const dynBody = new CANNON.Body({
          mass: 1,
          material: dieMat,
          shape: dieShape,
          position: new CANNON.Vec3(spawnX, spawnY, spawnZ),
          linearDamping: 0.26,
          angularDamping: 0.32,
          allowSleep: true,
          sleepSpeedLimit: 0.08,
          sleepTimeLimit: 0.4,
        });
        dynBody.quaternion.set(randQuat.x, randQuat.y, randQuat.z, randQuat.w);

        // 中心寄りへ転がる自然な初速（壁跳ね返り・ダイス衝突が気持ちよく出る速度）
        const dirToCenterX = -Math.sign(spawnX || (Math.random() - 0.5)) * (1.2 + Math.random() * 2.4);
        const vx = dirToCenterX + (Math.random() - 0.5) * 3.6;
        const vz = (Math.random() - 0.5) * 4.4;
        const vy = -1.2 - Math.random() * 1.4;
        dynBody.velocity.set(vx, vy, vz);
        dynBody.angularVelocity.set(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 20
        );
        world.addBody(dynBody);
        bodies.push(dynBody);
      }
    }

    const frames: RecordedTrayFrame[] = [];
    let stillFrames = 0;

    for (let step = 0; step < 120; step++) {
      world.step(FIXED_DT);

      if (step >= 18) {
        for (const idx of unheldIndices) {
          const b = bodies[idx];
          if (b.sleepState === CANNON.Body.SLEEPING) continue;
          const v = b.velocity.length();
          const w = b.angularVelocity.length();
          const align = getTopFaceIndex(b.quaternion).alignment;
          const onFloor = b.position.y < dieHalf + 0.09;

          if (onFloor && align > 0.94 && v < 1.15 && w < 2.2) {
            b.velocity.scale(0.68, b.velocity);
            b.angularVelocity.scale(0.62, b.angularVelocity);
            if (v < 0.24 && w < 0.42) {
              b.velocity.set(0, 0, 0);
              b.angularVelocity.set(0, 0, 0);
              b.sleep();
            }
          } else if (step > 42 && step % 12 === 0 && (!onFloor || align <= 0.94) && v < 0.55) {
            // まれに他ダイスへ引っかかったときだけ軽くほどく
            b.velocity.x += (Math.random() - 0.5) * 2.0;
            b.velocity.z += (Math.random() - 0.5) * 2.0;
            b.angularVelocity.x += (Math.random() - 0.5) * 4.0;
          }
        }
      }

      frames.push({
        pos: bodies.map((b) => [b.position.x, b.position.y, b.position.z]),
        quat: bodies.map((b) => [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]),
      });

      if (step >= 32) {
        const allStill = unheldIndices.every((idx) => {
          const b = bodies[idx];
          return (
            b.sleepState === CANNON.Body.SLEEPING ||
            (b.velocity.length() < 0.22 &&
              b.angularVelocity.length() < 0.35 &&
              getTopFaceIndex(b.quaternion).alignment > 0.94)
          );
        });
        if (allStill) {
          stillFrames++;
          if (stillFrames >= 4) break;
        } else {
          stillFrames = 0;
        }
      }
    }

    const allValid = unheldIndices.every((idx) => {
      const b = bodies[idx];
      const align = getTopFaceIndex(b.quaternion).alignment;
      return (
        align > 0.93 &&
        b.position.y >= dieHalf - 0.08 &&
        b.position.y <= dieHalf + 0.14 &&
        Math.abs(b.position.x) <= innerHalfW + 0.05 &&
        Math.abs(b.position.z) <= innerHalfD + 0.05
      );
    });

    if (allValid || attempt === 5) {
      return {
        frames,
        topFaceIndices: bodies.map((b) => getTopFaceIndex(b.quaternion).index),
      };
    }
  }

  return {
    frames: [],
    topFaceIndices: Array<number>(count).fill(2),
  };
}

interface TrayRuntimeApi {
  triggerRoll: (targetDice: number[], heldMask: boolean[]) => void;
  resetAligned: (targetDice: number[]) => void;
  syncStaticDice: (targetDice: number[]) => void;
  updateRings: (heldMask: boolean[], highlightedMask: boolean[]) => void;
}

export const GameDice3DTray: React.FC<GameDice3DTrayProps> = ({
  dice,
  rollTrigger,
  held,
  highlighted,
  dimmed = false,
  height = 144,
  interactive = false,
  onDieClick,
  onRollSettled,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<TrayRuntimeApi | null>(null);

  const interactiveRef = useRef(interactive);
  const onDieClickRef = useRef(onDieClick);
  const onRollSettledRef = useRef(onRollSettled);
  interactiveRef.current = interactive;
  onDieClickRef.current = onDieClick;
  onRollSettledRef.current = onRollSettled;

  const diceCount = Math.max(1, Math.min(6, dice.length || 1));
  const normalizedDice = Array.from({ length: diceCount }, (_, i) => clampFace(dice[i] ?? 1));
  const diceKey = normalizedDice.join(',');
  const heldKey = Array.from({ length: diceCount }, (_, i) => (held?.[i] ? '1' : '0')).join('');
  const highlightKey = Array.from({ length: diceCount }, (_, i) =>
    highlighted?.[i] ? '1' : '0'
  ).join('');

  const latestDiceRef = useRef<number[]>(normalizedDice);
  const latestHeldRef = useRef<boolean[]>(
    Array.from({ length: diceCount }, (_, i) => Boolean(held?.[i]))
  );
  const latestHighlightRef = useRef<boolean[]>(
    Array.from({ length: diceCount }, (_, i) => Boolean(highlighted?.[i]))
  );
  const latestRollTriggerRef = useRef<number>(rollTrigger);

  latestDiceRef.current = normalizedDice;
  latestHeldRef.current = Array.from({ length: diceCount }, (_, i) => Boolean(held?.[i]));
  latestHighlightRef.current = Array.from({ length: diceCount }, (_, i) =>
    Boolean(highlighted?.[i])
  );
  latestRollTriggerRef.current = rollTrigger;

  const lastPlayedTriggerRef = useRef<number>(0);

  // Three.js シーン構築（diceCount または height 変更時に再構築）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const spec = getTrayLayoutSpec(diceCount);
    const { trayW, trayD, dieSize } = spec;
    const dieHalf = dieSize / 2;

    const width = container.clientWidth || 340;
    const canvasHeight = Math.max(72, height);

    const scene = new THREE.Scene();
    const fov = 34;
    const camera = new THREE.PerspectiveCamera(fov, width / canvasHeight, 0.1, 60);

    const updateCameraFit = (w: number, h: number) => {
      const aspect = Math.max(0.5, w / Math.max(1, h));
      camera.aspect = aspect;
      const vFovRad = THREE.MathUtils.degToRad(fov);
      const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);

      const outerW = trayW + 0.56;
      const outerD = trayD + 0.56;
      const distH = (outerD * 0.56) / Math.tan(vFovRad / 2);
      const distW = (outerW * 0.53) / Math.tan(hFovRad / 2);
      const dist = Math.max(distH, distW);

      // ほぼ俯瞰しつつサイコロの立体感が見える仰角（約72度）
      const camY = dist * 0.95;
      const camZ = dist * 0.31;
      camera.position.set(0, camY, camZ);
      camera.lookAt(0, 0.12, 0.04);
      camera.updateProjectionMatrix();
    };
    updateCameraFit(width, canvasHeight);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, canvasHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // ライティング
    scene.add(new THREE.HemisphereLight(0xfff9eb, 0x0b2618, 1.05));

    const dirLight = new THREE.DirectionalLight(0xfff5dc, 1.95);
    dirLight.position.set(2.8, 8.8, 3.4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 20;
    const shadowSpan = Math.max(trayW, trayD) * 0.68;
    dirLight.shadow.camera.left = -shadowSpan;
    dirLight.shadow.camera.right = shadowSpan;
    dirLight.shadow.camera.top = shadowSpan;
    dirLight.shadow.camera.bottom = -shadowSpan;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    const fillLight = new THREE.PointLight(0x93c5fd, 0.45, 16);
    fillLight.position.set(-4.2, 4.5, -2.8);
    scene.add(fillLight);

    // 深緑フェルト床面
    const feltGeo = new THREE.PlaneGeometry(trayW, trayD);
    const feltTex = createFeltTexture();
    const feltMat = new THREE.MeshStandardMaterial({
      map: feltTex,
      roughness: 0.92,
      metalness: 0.02,
    });
    const feltMesh = new THREE.Mesh(feltGeo, feltMat);
    feltMesh.rotation.x = -Math.PI / 2;
    feltMesh.position.y = 0;
    feltMesh.receiveShadow = true;
    scene.add(feltMesh);

    // 木枠フレーム（ウォールナット調）＋真鍮内縁トリム
    const frameThick = 0.24;
    const frameHeight = 0.42;
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x3f2414,
      roughness: 0.44,
      metalness: 0.08,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xd4a038,
      roughness: 0.28,
      metalness: 0.78,
    });

    const disposableGeos: THREE.BufferGeometry[] = [feltGeo];
    const disposableMats: THREE.Material[] = [feltMat, woodMat, trimMat];
    const disposableTexs: THREE.Texture[] = [feltTex];

    const addFrameBar = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      disposableGeos.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    };

    // 上下フレーム
    addFrameBar(trayW + frameThick * 2, frameHeight, frameThick, 0, frameHeight / 2 - 0.04, -(trayD / 2 + frameThick / 2), woodMat);
    addFrameBar(trayW + frameThick * 2, frameHeight, frameThick, 0, frameHeight / 2 - 0.04, trayD / 2 + frameThick / 2, woodMat);
    // 左右フレーム
    addFrameBar(frameThick, frameHeight, trayD, -(trayW / 2 + frameThick / 2), frameHeight / 2 - 0.04, 0, woodMat);
    addFrameBar(frameThick, frameHeight, trayD, trayW / 2 + frameThick / 2, frameHeight / 2 - 0.04, 0, woodMat);

    // 真鍮ゴールド内縁トリム
    const trimThick = 0.035;
    addFrameBar(trayW + trimThick * 2, 0.03, trimThick, 0, frameHeight - 0.035, -(trayD / 2 + trimThick / 2), trimMat);
    addFrameBar(trayW + trimThick * 2, 0.03, trimThick, 0, frameHeight - 0.035, trayD / 2 + trimThick / 2, trimMat);
    addFrameBar(trimThick, 0.03, trayD, -(trayW / 2 + trimThick / 2), frameHeight - 0.035, 0, trimMat);
    addFrameBar(trimThick, 0.03, trayD, trayW / 2 + trimThick / 2, frameHeight - 0.035, 0, trimMat);

    // ダイス面マテリアルキャッシュ（1..6）
    const matByValue: Record<number, THREE.MeshPhysicalMaterial> = {};
    for (let v = 1; v <= 6; v++) {
      const tex = createDieFaceTexture(v);
      disposableTexs.push(tex);
      const mat = new THREE.MeshPhysicalMaterial({
        map: tex,
        roughness: 0.2,
        metalness: 0.02,
        clearcoat: 0.65,
        clearcoatRoughness: 0.14,
      });
      disposableMats.push(mat);
      matByValue[v] = mat;
    }

    const dieGeo = createRoundedDieGeometry(dieSize);
    disposableGeos.push(dieGeo);

    const ringGeo = new THREE.RingGeometry(dieSize * 0.56, dieSize * 0.72, 36);
    disposableGeos.push(ringGeo);

    const alignedPos = getAlignedPositions(diceCount, trayW, dieSize);
    const diePos: [number, number, number][] = alignedPos.map(([x, z]) => [x, dieHalf, z]);
    const dieQuat: [number, number, number, number][] = alignedPos.map((_, i) => {
      // わずかな自然な角度差をつけて並べる（上面は +y で完全に水平）
      const yaw = ((i % 2 === 0 ? 1 : -1) * 0.05) + (i - (diceCount - 1) / 2) * 0.018;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      return [q.x, q.y, q.z, q.w];
    });

    const dieMeshes: THREE.Mesh[] = [];
    const ringMeshes: THREE.Mesh[] = [];
    const ringMats: THREE.MeshBasicMaterial[] = [];

    for (let i = 0; i < diceCount; i++) {
      const faceMap = buildRemappedFaceValues(2, latestDiceRef.current[i] ?? 1);
      const mesh = new THREE.Mesh(
        dieGeo,
        faceMap.map((v) => matByValue[v])
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.dieIndex = i;
      mesh.position.set(diePos[i][0], diePos[i][1], diePos[i][2]);
      mesh.quaternion.set(dieQuat[i][0], dieQuat[i][1], dieQuat[i][2], dieQuat[i][3]);
      scene.add(mesh);
      dieMeshes.push(mesh);

      const rMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      disposableMats.push(rMat);
      ringMats.push(rMat);

      const rMesh = new THREE.Mesh(ringGeo, rMat);
      rMesh.rotation.x = -Math.PI / 2;
      rMesh.position.set(diePos[i][0], 0.016, diePos[i][2]);
      rMesh.visible = false;
      scene.add(rMesh);
      ringMeshes.push(rMesh);
    }

    let isReplaying = false;
    let replayFrames: RecordedTrayFrame[] = [];
    let replayCursor = 0;
    let ringModes: ('none' | 'held' | 'highlight')[] = Array(diceCount).fill('none');

    const applyRingStates = (heldMask: boolean[], highlightedMask: boolean[]) => {
      for (let i = 0; i < diceCount; i++) {
        if (heldMask[i]) {
          ringModes[i] = 'held';
          ringMats[i].color.setHex(0xfbbf24);
          ringMeshes[i].visible = true;
        } else if (highlightedMask[i]) {
          ringModes[i] = 'highlight';
          ringMats[i].color.setHex(0x34d399);
          ringMeshes[i].visible = true;
        } else {
          ringModes[i] = 'none';
          ringMeshes[i].visible = false;
        }
      }
    };

    const startPhysicsReplay = (targetDice: number[], heldMask: boolean[]) => {
      const recorded = presimulateTrayRoll(diceCount, spec, heldMask, diePos, dieQuat);

      // 物理シミュレーションで自然静止したローカル面に targetDice を事前マッピング
      for (let i = 0; i < diceCount; i++) {
        if (heldMask[i]) continue;
        const faceMap = buildRemappedFaceValues(recorded.topFaceIndices[i], targetDice[i] ?? 1);
        dieMeshes[i].material = faceMap.map((v) => matByValue[v]);
      }

      if (recorded.frames.length > 0) {
        replayFrames = recorded.frames;
        replayCursor = 0;
        isReplaying = true;
      } else {
        isReplaying = false;
        onRollSettledRef.current?.();
      }
    };

    apiRef.current = {
      triggerRoll: (targetDice, heldMask) => {
        startPhysicsReplay(targetDice, heldMask);
      },
      resetAligned: (targetDice) => {
        isReplaying = false;
        replayFrames = [];
        replayCursor = 0;
        for (let i = 0; i < diceCount; i++) {
          const [ax, az] = alignedPos[i];
          const yaw = ((i % 2 === 0 ? 1 : -1) * 0.05) + (i - (diceCount - 1) / 2) * 0.018;
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
          diePos[i] = [ax, dieHalf, az];
          dieQuat[i] = [q.x, q.y, q.z, q.w];
          const faceMap = buildRemappedFaceValues(2, targetDice[i] ?? 1);
          dieMeshes[i].material = faceMap.map((v) => matByValue[v]);
        }
      },
      syncStaticDice: (targetDice) => {
        if (isReplaying) return;
        for (let i = 0; i < diceCount; i++) {
          const topIdx = getTopFaceIndex({
            x: dieQuat[i][0],
            y: dieQuat[i][1],
            z: dieQuat[i][2],
            w: dieQuat[i][3],
          }).index;
          const faceMap = buildRemappedFaceValues(topIdx, targetDice[i] ?? 1);
          dieMeshes[i].material = faceMap.map((v) => matByValue[v]);
        }
      },
      updateRings: (heldMask, highlightedMask) => {
        applyRingStates(heldMask, highlightedMask);
      },
    };

    applyRingStates(latestHeldRef.current, latestHighlightRef.current);

    // マウント時点で rollTrigger > 0 かつ未再生なら即ロール（ライアーズダイスの新ラウンド等）
    if (latestRollTriggerRef.current > 0 && latestRollTriggerRef.current !== lastPlayedTriggerRef.current) {
      lastPlayedTriggerRef.current = latestRollTriggerRef.current;
      startPhysicsReplay(latestDiceRef.current, latestHeldRef.current);
    }

    // Raycaster による3Dサイコロ直接タップ
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -dieHalf);
    const hitPoint = new THREE.Vector3();
    let downX = 0;
    let downY = 0;

    const canvasEl = renderer.domElement;
    const handlePointerDown = (ev: PointerEvent) => {
      downX = ev.clientX;
      downY = ev.clientY;
    };
    const handlePointerUp = (ev: PointerEvent) => {
      if (!interactiveRef.current || !onDieClickRef.current) return;
      const moveDist = Math.hypot(ev.clientX - downX, ev.clientY - downY);
      if (moveDist > 12) return;

      const rect = canvasEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(dieMeshes, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData.dieIndex;
        if (typeof idx === 'number') {
          onDieClickRef.current(idx);
          return;
        }
      }

      // スマホ指タップの当たり判定を少し優しくするフォールバック（床面投影の近傍）
      if (raycaster.ray.intersectPlane(floorPlane, hitPoint)) {
        let nearestIdx = -1;
        let nearestDist = dieSize * 0.78;
        for (let i = 0; i < diceCount; i++) {
          const d = Math.hypot(hitPoint.x - diePos[i][0], hitPoint.z - diePos[i][2]);
          if (d < nearestDist) {
            nearestDist = d;
            nearestIdx = i;
          }
        }
        if (nearestIdx >= 0) {
          onDieClickRef.current(nearestIdx);
        }
      }
    };

    canvasEl.addEventListener('pointerdown', handlePointerDown);
    canvasEl.addEventListener('pointerup', handlePointerUp);

    // リサイズ対応
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 340;
      updateCameraFit(w, canvasHeight);
      renderer.setSize(w, canvasHeight);
    };
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
    }
    window.addEventListener('resize', handleResize);

    // 60fps アニメーションループ
    let rafId = 0;
    let lastTime = performance.now();
    let accumulator = 0;

    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      accumulator += dt;

      while (accumulator >= FIXED_DT) {
        accumulator -= FIXED_DT;
        if (isReplaying) {
          const frame = replayFrames[Math.min(replayCursor, replayFrames.length - 1)];
          for (let i = 0; i < diceCount; i++) {
            diePos[i] = frame.pos[i];
            dieQuat[i] = frame.quat[i];
          }
          replayCursor++;
          if (replayCursor >= replayFrames.length) {
            isReplaying = false;
            onRollSettledRef.current?.();
          }
        }
      }

      const pulse = 0.72 + 0.24 * Math.sin(now * 0.0055);
      for (let i = 0; i < diceCount; i++) {
        const m = dieMeshes[i];
        m.position.set(diePos[i][0], diePos[i][1], diePos[i][2]);
        m.quaternion.set(dieQuat[i][0], dieQuat[i][1], dieQuat[i][2], dieQuat[i][3]);

        const r = ringMeshes[i];
        if (r.visible) {
          r.position.set(diePos[i][0], 0.016, diePos[i][2]);
          ringMats[i].opacity = ringModes[i] === 'held' ? pulse : pulse * 0.9;
        }
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      apiRef.current = null;
      cancelAnimationFrame(rafId);
      canvasEl.removeEventListener('pointerdown', handlePointerDown);
      canvasEl.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();

      disposableGeos.forEach((g) => g.dispose());
      disposableTexs.forEach((t) => t.dispose());
      disposableMats.forEach((m) => m.dispose());
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [diceCount, height]);

  // rollTrigger 増加時に未ホールドサイコロを3D物理ロール
  useEffect(() => {
    if (rollTrigger <= 0) {
      lastPlayedTriggerRef.current = 0;
      apiRef.current?.resetAligned(latestDiceRef.current);
      return;
    }
    if (rollTrigger !== lastPlayedTriggerRef.current) {
      lastPlayedTriggerRef.current = rollTrigger;
      apiRef.current?.triggerRoll(latestDiceRef.current, latestHeldRef.current);
    }
  }, [rollTrigger, diceKey]);

  // rollTrigger 以外で dice が変わったときの静的同期
  useEffect(() => {
    apiRef.current?.syncStaticDice(latestDiceRef.current);
  }, [diceKey]);

  // ホールド / ハイライトリングの更新
  useEffect(() => {
    apiRef.current?.updateRings(latestHeldRef.current, latestHighlightRef.current);
  }, [heldKey, highlightKey]);

  return (
    <div
      ref={containerRef}
      className={`game-dice-tray ${dimmed ? 'game-dice-tray--dimmed' : ''} ${
        interactive ? 'game-dice-tray--interactive' : ''
      }`}
      style={{ height }}
      aria-label={`3Dダイストレイ: ${normalizedDice.join(', ')}`}
    />
  );
};
