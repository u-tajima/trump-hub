import React, { useEffect, useImperativeHandle, useRef } from 'react';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import './ChinchiroBowl3D.css';

export interface ChinchiroBowl3DHandle {
  startInteractiveShake: () => void;
  stopInteractiveShake: () => void;
  playTargetRoll: (targetDice: [number, number, number]) => void;
}

interface ChinchiroBowl3DProps {
  soundEnabled: boolean;
  onInteractiveSettled: (dice: [number, number, number]) => void;
  onReplaySettled: () => void;
}

const DIE_SIZE = 0.68;
const DIE_HALF = DIE_SIZE / 2;
const FIXED_DT = 1 / 60;

// BoxGeometry の面順: [0:+x, 1:-x, 2:+y, 3:-y, 4:+z, 5:-z]
const LOCAL_FACE_AXES = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

const DEFAULT_FACE_VALUES = [3, 4, 1, 6, 2, 5];

// 対面和 = 7 を維持しながら、指定ローカル面 topFaceIdx に targetValue が来る 6面配列を生成
function buildRemappedFaceValues(topFaceIdx: number, targetValue: number): number[] {
  const oppIdx = topFaceIdx % 2 === 0 ? topFaceIdx + 1 : topFaceIdx - 1;
  const oppVal = 7 - targetValue;
  const remainingPairs: [number, number][] = (
    [
      [1, 6],
      [2, 5],
      [3, 4],
    ] as [number, number][]
  ).filter(([a, b]) => a !== targetValue && b !== targetValue);

  const result = Array<number>(6).fill(1);
  result[topFaceIdx] = targetValue;
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

function getTopFaceIndex(q: CANNON.Quaternion): { index: number; alignment: number } {
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

const PIP_COORDS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.29, 0.29], [0.71, 0.71]],
  3: [[0.29, 0.29], [0.5, 0.5], [0.71, 0.71]],
  4: [[0.29, 0.29], [0.71, 0.29], [0.29, 0.71], [0.71, 0.71]],
  5: [[0.29, 0.29], [0.71, 0.29], [0.5, 0.5], [0.29, 0.71], [0.71, 0.71]],
  6: [[0.29, 0.27], [0.71, 0.27], [0.29, 0.5], [0.71, 0.5], [0.29, 0.73], [0.71, 0.73]],
};

function createRoundedDieGeometry(size: number): THREE.BufferGeometry {
  // 辺の約18%の丸み＋5分割で滑らかに角を取った本物のサイコロ形状
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

  // 角丸の継ぎ目が出ないよう、外周は均一な象牙白でシームレスに繋ぐ
  ctx.fillStyle = '#f2eee5';
  ctx.fillRect(0, 0, size, size);

  const bg = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.05, size * 0.5, size * 0.5, size * 0.46);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.75, '#f8f5ee');
  bg.addColorStop(1, '#f2eee5');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  const coords = PIP_COORDS[value] ?? PIP_COORDS[1];
  const radius = value === 1 ? size * 0.14 : size * 0.082;

  for (const [u, v] of coords) {
    const cx = u * size;
    const cy = v * size;

    // 彫り込みくぼみの外縁ハイライト
    ctx.beginPath();
    ctx.arc(cx + 1.5, cy + 1.5, radius * 1.06, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fill();

    // 彫り込みの影と色
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
      pipGrad.addColorStop(0.65, '#b91c1c');
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

function createBowlInteriorTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#1e3a5f');
  grad.addColorStop(0.55, '#172e4c');
  grad.addColorStop(1, '#0f1e33');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(245, 198, 102, 0.24)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.16);
  ctx.lineTo(size, size * 0.16);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function bowlVisualY(r: number): number {
  const flatR = 1.15;
  if (r <= flatR) return 0.14;
  const d = r - flatR;
  return 0.14 + d * d * 0.88;
}

// cannon-es の茶碗＆ダイス物理ワールドを構築する共通ファクトリ
function createPhysicsRig() {
  const world = new CANNON.World();
  world.gravity.set(0, -24, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  (world.solver as CANNON.GSSolver).iterations = 14;
  world.allowSleep = false;

  const bowlMat = new CANNON.Material('bowl');
  const dieMat = new CANNON.Material('die');

  world.addContactMaterial(
    new CANNON.ContactMaterial(bowlMat, dieMat, {
      friction: 0.38,
      restitution: 0.36,
    })
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(dieMat, dieMat, {
      friction: 0.25,
      restitution: 0.45,
    })
  );

  // キネマティック剛体の茶碗（底＋2段16角形お椀斜面＋飛び出し防止天井）
  const bowlBody = new CANNON.Body({
    type: CANNON.Body.KINEMATIC,
    material: bowlMat,
    position: new CANNON.Vec3(0, 0, 0),
  });

  // 底面プレート（上面が y = 0.14）
  bowlBody.addShape(
    new CANNON.Box(new CANNON.Vec3(1.22, 0.14, 1.22)),
    new CANNON.Vec3(0, 0.0, 0)
  );

  const segments = 16;
  // 下段の緩やかなお椀斜面（bowlVisualY に合わせて外側へ開く -1.02 rad）
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const r = 1.56;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const qYaw = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle);
    const qTilt = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -1.02);
    const q = qYaw.mult(qTilt);
    bowlBody.addShape(
      new CANNON.Box(new CANNON.Vec3(0.12, 0.48, 0.56)),
      new CANNON.Vec3(x, 0.25, z),
      q
    );
  }

  // 上段のお椀壁（bowlVisualY に合わせて外側へ開く -0.52 rad）
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const r = 2.24;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const qYaw = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle);
    const qTilt = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -0.52);
    const q = qYaw.mult(qTilt);
    bowlBody.addShape(
      new CANNON.Box(new CANNON.Vec3(0.12, 0.68, 0.62)),
      new CANNON.Vec3(x, 1.0, z),
      q
    );
  }

  // 見えない垂直ガード壁（激しく振っても茶碗外へロストしない）
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const r = 2.54;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const qYaw = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle);
    bowlBody.addShape(
      new CANNON.Box(new CANNON.Vec3(0.12, 0.72, 0.65)),
      new CANNON.Vec3(x, 2.2, z),
      qYaw
    );
  }

  // 見えない上部キャップ
  bowlBody.addShape(
    new CANNON.Box(new CANNON.Vec3(2.8, 0.15, 2.8)),
    new CANNON.Vec3(0, 2.95, 0)
  );

  world.addBody(bowlBody);

  // 3つの立方体剛体ダイス
  const dieShape = new CANNON.Box(new CANNON.Vec3(DIE_HALF, DIE_HALF, DIE_HALF));
  const initialOffsets: [number, number][] = [
    [-0.75, 0.35],
    [0.05, -0.55],
    [0.75, 0.32],
  ];

  const dieBodies = initialOffsets.map(([x, z]) => {
    const body = new CANNON.Body({
      mass: 1,
      material: dieMat,
      shape: dieShape,
      position: new CANNON.Vec3(x, 0.14 + DIE_HALF + 0.02, z),
      linearDamping: 0.14,
      angularDamping: 0.18,
    });
    world.addBody(body);
    return body;
  });

  return { world, bowlBody, dieBodies };
}

interface RecordedFrame {
  bowlPos: [number, number, number];
  bowlQuat: [number, number, number, number];
  dicePos: [number, number, number][];
  diceQuat: [number, number, number, number][];
  maxImpact: number;
}

interface RecordedRoll {
  frames: RecordedFrame[];
  topFaceIndices: number[];
}

// 相手/CPU用: ヘッドレス cannon-es で「茶碗を少し揺らす→止める→自然静止」を完全シミュレートして記録
// 最終静止面を事前に把握し、再生前にマテリアルを割り当てることで着地後の不自然な回転をゼロにする
function presimulateRecordedRoll(): RecordedRoll {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { world, bowlBody, dieBodies } = createPhysicsRig();

    // 初期状態にランダムな姿勢・初速を与える
    const slots: [number, number][] = [
      [-0.72, 0.34],
      [0.04, -0.56],
      [0.72, 0.3],
    ];
    dieBodies.forEach((b, i) => {
      const [sx, sz] = slots[i];
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        )
      );
      b.position.set(sx, 0.9 + Math.random() * 0.45, sz);
      b.quaternion.set(q.x, q.y, q.z, q.w);
      b.velocity.set((Math.random() - 0.5) * 5.2, 2.2 + Math.random() * 2.0, (Math.random() - 0.5) * 5.2);
      b.angularVelocity.set(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18
      );
    });

    let stepImpact = 0;
    dieBodies.forEach((b) => {
      b.addEventListener('collide', (ev: { contact: CANNON.ContactEquation }) => {
        const imp = Math.abs(ev.contact.getImpactVelocityAlongNormal());
        if (imp > stepImpact) stepImpact = imp;
      });
    });

    const frames: RecordedFrame[] = [];
    const shakeSteps = 26; // 約0.43秒 茶碗を振る
    let bx = 0;
    let by = 0;
    let bz = 0;
    let rx = 0;
    let rz = 0;
    let stillFrames = 0;

    for (let step = 0; step < 300; step++) {
      stepImpact = 0;
      let nextBx: number;
      let nextBy: number;
      let nextBz: number;
      let nextRx: number;
      let nextRz: number;

      if (step < shakeSteps) {
        const t = (step + 1) * FIXED_DT;
        nextBx = Math.sin(t * 18) * 0.38;
        nextBz = Math.cos(t * 14) * 0.24;
        nextBy = Math.abs(Math.sin(t * 18)) * 0.08;
        nextRz = -Math.sin(t * 18) * 0.14;
        nextRx = Math.cos(t * 14) * 0.11;
      } else {
        // 茶碗を滑らかに水平・中央へ戻す
        nextBx = bx * 0.72;
        nextBy = by * 0.72;
        nextBz = bz * 0.72;
        nextRx = rx * 0.72;
        nextRz = rz * 0.72;
        if (Math.abs(nextBx) < 0.002) nextBx = 0;
        if (Math.abs(nextBy) < 0.002) nextBy = 0;
        if (Math.abs(nextBz) < 0.002) nextBz = 0;
        if (Math.abs(nextRx) < 0.002) nextRx = 0;
        if (Math.abs(nextRz) < 0.002) nextRz = 0;
      }

      bowlBody.velocity.set((nextBx - bx) / FIXED_DT, (nextBy - by) / FIXED_DT, (nextBz - bz) / FIXED_DT);
      bowlBody.position.set(nextBx, nextBy, nextBz);
      bowlBody.quaternion.setFromEuler(nextRx, 0, nextRz);
      bx = nextBx;
      by = nextBy;
      bz = nextBz;
      rx = nextRx;
      rz = nextRz;

      world.step(FIXED_DT);

      frames.push({
        bowlPos: [bowlBody.position.x, bowlBody.position.y, bowlBody.position.z],
        bowlQuat: [
          bowlBody.quaternion.x,
          bowlBody.quaternion.y,
          bowlBody.quaternion.z,
          bowlBody.quaternion.w,
        ],
        dicePos: dieBodies.map((b) => [b.position.x, b.position.y, b.position.z]),
        diceQuat: dieBodies.map((b) => [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]),
        maxImpact: stepImpact,
      });

      if (step > shakeSteps + 18) {
        for (const b of dieBodies) {
          const v = b.velocity.length();
          const w = b.angularVelocity.length();
          if (getTopFaceIndex(b.quaternion).alignment > 0.94 && v < 0.45 && w < 0.85) {
            b.velocity.scale(0.8, b.velocity);
            b.angularVelocity.scale(0.75, b.angularVelocity);
          }
        }
        const allStill = dieBodies.every(
          (b) => b.velocity.length() < 0.12 && b.angularVelocity.length() < 0.18
        );
        if (allStill) {
          stillFrames++;
          if (stillFrames >= 8) break;
        } else {
          stillFrames = 0;
        }
      }
    }

    const allFlat = dieBodies.every((b) => getTopFaceIndex(b.quaternion).alignment > 0.91);
    const allInside = dieBodies.every((b) => b.position.y > 0.1 && b.position.y < 1.8);
    if ((allFlat && allInside) || attempt === 5) {
      return {
        frames,
        topFaceIndices: dieBodies.map((b) => getTopFaceIndex(b.quaternion).index),
      };
    }
  }

  // フォールバック（通常到達しない）
  return {
    frames: [],
    topFaceIndices: [2, 2, 2],
  };
}

class DiceSoundSynth {
  private ctx: AudioContext | null = null;
  private lastPlayed = 0;

  playClack(intensity = 0.5) {
    const nowMs = performance.now();
    if (nowMs - this.lastPlayed < 38) return;
    this.lastPlayed = nowMs;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.ctx) this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') void this.ctx.resume();

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1050 + Math.random() * 600, t);
      osc.frequency.exponentialRampToValueAtTime(340, t + 0.04);

      const vol = Math.min(0.15, Math.max(0.015, intensity * 0.13));
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    } catch {
      // ignore
    }
  }
}

type InternalSimState = 'idle' | 'shaking' | 'settlingInteractive' | 'replaying';

export const ChinchiroBowl3D = React.forwardRef<ChinchiroBowl3DHandle, ChinchiroBowl3DProps>(
  ({ soundEnabled, onInteractiveSettled, onReplaySettled }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const soundEnabledRef = useRef(soundEnabled);
    const onInteractiveSettledRef = useRef(onInteractiveSettled);
    const onReplaySettledRef = useRef(onReplaySettled);

    soundEnabledRef.current = soundEnabled;
    onInteractiveSettledRef.current = onInteractiveSettled;
    onReplaySettledRef.current = onReplaySettled;

    const actionsRef = useRef<ChinchiroBowl3DHandle | null>(null);
    useImperativeHandle(ref, () => ({
      startInteractiveShake: () => actionsRef.current?.startInteractiveShake(),
      stopInteractiveShake: () => actionsRef.current?.stopInteractiveShake(),
      playTargetRoll: (dice) => actionsRef.current?.playTargetRoll(dice),
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const width = container.clientWidth || 340;
      const height = 260;

      // Three.js シーン構築
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(37, width / height, 0.1, 60);
      camera.position.set(0, 6.2, 5.5);
      camera.lookAt(0, 0.4, 0.05);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xfff8e7, 0x102a1d, 0.95));

      const dirLight = new THREE.DirectionalLight(0xfff4d6, 2.0);
      dirLight.position.set(4.5, 9.5, 4.2);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 1;
      dirLight.shadow.camera.far = 22;
      dirLight.shadow.camera.left = -4.2;
      dirLight.shadow.camera.right = 4.2;
      dirLight.shadow.camera.top = 4.2;
      dirLight.shadow.camera.bottom = -4.2;
      dirLight.shadow.bias = -0.001;
      scene.add(dirLight);

      const rimLight = new THREE.PointLight(0x60a5fa, 0.65, 14);
      rimLight.position.set(-4.5, 4.0, -4.0);
      scene.add(rimLight);

      const tableGeo = new THREE.CircleGeometry(7.5, 48);
      const tableMat = new THREE.ShadowMaterial({ opacity: 0.42 });
      const tableMesh = new THREE.Mesh(tableGeo, tableMat);
      tableMesh.rotation.x = -Math.PI / 2;
      tableMesh.position.y = -0.02;
      tableMesh.receiveShadow = true;
      scene.add(tableMesh);

      // 茶碗の見た目メッシュグループ
      const bowlGroup = new THREE.Group();
      scene.add(bowlGroup);

      const outerPoints: THREE.Vector2[] = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(1.18, 0.0),
        new THREE.Vector2(1.25, 0.14),
        new THREE.Vector2(1.7, 0.42),
        new THREE.Vector2(2.24, 1.0),
        new THREE.Vector2(2.55, 1.65),
        new THREE.Vector2(2.46, 1.7),
      ];
      const outerGeo = new THREE.LatheGeometry(outerPoints, 48);
      const outerMat = new THREE.MeshStandardMaterial({
        color: 0x1a1412,
        roughness: 0.22,
        metalness: 0.18,
      });
      const outerMesh = new THREE.Mesh(outerGeo, outerMat);
      outerMesh.castShadow = true;
      outerMesh.receiveShadow = true;
      bowlGroup.add(outerMesh);

      const innerPoints: THREE.Vector2[] = [];
      for (let i = 0; i <= 20; i++) {
        const r = (i / 20) * 2.42;
        innerPoints.push(new THREE.Vector2(r, bowlVisualY(r)));
      }
      const innerGeo = new THREE.LatheGeometry(innerPoints, 48);
      const innerTex = createBowlInteriorTexture();
      const innerMat = new THREE.MeshStandardMaterial({
        map: innerTex,
        roughness: 0.34,
        metalness: 0.08,
        side: THREE.DoubleSide,
      });
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      innerMesh.receiveShadow = true;
      bowlGroup.add(innerMesh);

      const rimGeo = new THREE.TorusGeometry(2.48, 0.065, 16, 64);
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0xd99b26,
        roughness: 0.25,
        metalness: 0.82,
      });
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.rotation.x = Math.PI / 2;
      rimMesh.position.y = 1.67;
      rimMesh.castShadow = true;
      bowlGroup.add(rimMesh);

      // 1..6 のダイス面マテリアルをキャッシュ（丸角に艶が映えるクリアコート仕上げ）
      const matByValue: Record<number, THREE.MeshPhysicalMaterial> = {};
      for (let v = 1; v <= 6; v++) {
        matByValue[v] = new THREE.MeshPhysicalMaterial({
          map: createDieFaceTexture(v),
          roughness: 0.2,
          metalness: 0.02,
          clearcoat: 0.65,
          clearcoatRoughness: 0.14,
        });
      }

      const dieGeo = createRoundedDieGeometry(DIE_SIZE);
      const { world, bowlBody, dieBodies } = createPhysicsRig();
      const soundSynth = new DiceSoundSynth();

      // 各ダイスの現在の6面値マッピング
      const dieFaceMaps: number[][] = [
        [...DEFAULT_FACE_VALUES],
        [...DEFAULT_FACE_VALUES],
        [...DEFAULT_FACE_VALUES],
      ];

      const dieMeshes = dieBodies.map((body, idx) => {
        const mesh = new THREE.Mesh(
          dieGeo,
          dieFaceMaps[idx].map((v) => matByValue[v])
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        body.addEventListener('collide', (ev: { contact: CANNON.ContactEquation }) => {
          if (!soundEnabledRef.current) return;
          const impact = Math.abs(ev.contact.getImpactVelocityAlongNormal());
          if (impact > 1.4) {
            soundSynth.playClack(Math.min(1, impact / 11));
          }
        });
        return mesh;
      });

      const applyFaceMap = (dieIdx: number, faceValues: number[]) => {
        dieFaceMaps[dieIdx] = faceValues;
        dieMeshes[dieIdx].material = faceValues.map((v) => matByValue[v]);
      };

      let simState: InternalSimState = 'idle';
      let shakeTime = 0;
      let stillFrames = 0;
      let settleFrames = 0;
      let bowlX = 0;
      let bowlY = 0;
      let bowlZ = 0;
      let bowlRx = 0;
      let bowlRz = 0;
      let replayFrames: RecordedFrame[] = [];
      let replayCursor = 0;

      const resetBowlImmediate = () => {
        bowlX = 0;
        bowlY = 0;
        bowlZ = 0;
        bowlRx = 0;
        bowlRz = 0;
        bowlBody.position.set(0, 0, 0);
        bowlBody.quaternion.set(0, 0, 0, 1);
        bowlBody.velocity.set(0, 0, 0);
        bowlBody.angularVelocity.set(0, 0, 0);
      };

      actionsRef.current = {
        startInteractiveShake: () => {
          // 標準のサイコロ配列に戻す
          for (let i = 0; i < 3; i++) {
            applyFaceMap(i, [...DEFAULT_FACE_VALUES]);
          }
          replayFrames = [];
          replayCursor = 0;
          simState = 'shaking';
          shakeTime = 0;
          stillFrames = 0;
          settleFrames = 0;

          dieBodies.forEach((b) => {
            b.wakeUp();
            b.velocity.set(
              (Math.random() - 0.5) * 6,
              4.2 + Math.random() * 2.5,
              (Math.random() - 0.5) * 6
            );
            b.angularVelocity.set(
              (Math.random() - 0.5) * 18,
              (Math.random() - 0.5) * 18,
              (Math.random() - 0.5) * 18
            );
          });
        },

        stopInteractiveShake: () => {
          if (simState !== 'shaking') return;
          // 急停止テレポートせず、animate 内で滑らかに水平・中央へ減速させる
          simState = 'settlingInteractive';
          stillFrames = 0;
          settleFrames = 0;
        },

        playTargetRoll: (targetDice: [number, number, number]) => {
          const recorded = presimulateRecordedRoll();
          // 物理シミュレーションで自然静止したローカル面に targetDice を事前マッピング
          for (let i = 0; i < 3; i++) {
            const remapped = buildRemappedFaceValues(recorded.topFaceIndices[i], targetDice[i]);
            applyFaceMap(i, remapped);
          }

          replayFrames = recorded.frames;
          replayCursor = 0;
          if (replayFrames.length > 0) {
            simState = 'replaying';
          } else {
            resetBowlImmediate();
            simState = 'idle';
            onReplaySettledRef.current();
          }
        },
      };

      const handleResize = () => {
        if (!container) return;
        const w = container.clientWidth || 340;
        camera.aspect = w / height;
        camera.updateProjectionMatrix();
        renderer.setSize(w, height);
      };
      window.addEventListener('resize', handleResize);

      let rafId = 0;
      let lastTime = performance.now();
      let accumulator = 0;

      const animate = (now: number) => {
        const dt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;
        accumulator += dt;

        while (accumulator >= FIXED_DT) {
          accumulator -= FIXED_DT;

          if (simState === 'replaying') {
            const frame = replayFrames[Math.min(replayCursor, replayFrames.length - 1)];
            bowlBody.position.set(frame.bowlPos[0], frame.bowlPos[1], frame.bowlPos[2]);
            bowlBody.quaternion.set(
              frame.bowlQuat[0],
              frame.bowlQuat[1],
              frame.bowlQuat[2],
              frame.bowlQuat[3]
            );
            for (let i = 0; i < 3; i++) {
              const p = frame.dicePos[i];
              const q = frame.diceQuat[i];
              dieBodies[i].position.set(p[0], p[1], p[2]);
              dieBodies[i].quaternion.set(q[0], q[1], q[2], q[3]);
              dieBodies[i].velocity.set(0, 0, 0);
              dieBodies[i].angularVelocity.set(0, 0, 0);
            }
            if (soundEnabledRef.current && frame.maxImpact > 1.5) {
              soundSynth.playClack(Math.min(1, frame.maxImpact / 11));
            }
            replayCursor++;
            if (replayCursor >= replayFrames.length) {
              resetBowlImmediate();
              simState = 'idle';
              onReplaySettledRef.current();
            }
            continue;
          }

          if (simState === 'shaking') {
            shakeTime += FIXED_DT;
            const nextBx = Math.sin(shakeTime * 18) * 0.4;
            const nextBz = Math.cos(shakeTime * 14) * 0.25;
            const nextBy = Math.abs(Math.sin(shakeTime * 18)) * 0.09;
            const nextRz = -Math.sin(shakeTime * 18) * 0.15;
            const nextRx = Math.cos(shakeTime * 14) * 0.11;

            // キネマティック速度を設定して摩擦・衝突を物理的に伝える
            bowlBody.velocity.set(
              (nextBx - bowlX) / FIXED_DT,
              (nextBy - bowlY) / FIXED_DT,
              (nextBz - bowlZ) / FIXED_DT
            );
            bowlX = nextBx;
            bowlY = nextBy;
            bowlZ = nextBz;
            bowlRx = nextRx;
            bowlRz = nextRz;
            bowlBody.position.set(bowlX, bowlY, bowlZ);
            bowlBody.quaternion.setFromEuler(bowlRx, 0, bowlRz);

            // 茶碗の底で落ち着きすぎないよう継続的に適度な撹拌を加える
            for (const b of dieBodies) {
              if (b.position.y < 0.7 && b.velocity.length() < 3.6) {
                b.velocity.y += 2.3;
                b.angularVelocity.x += (Math.random() - 0.5) * 9;
                b.angularVelocity.z += (Math.random() - 0.5) * 9;
              }
            }
          } else {
            // 茶碗を滑らかに水平・中央へ戻す（テレポートによるめり込み防止）
            const nextBx = Math.abs(bowlX) < 0.002 ? 0 : bowlX * 0.72;
            const nextBy = Math.abs(bowlY) < 0.002 ? 0 : bowlY * 0.72;
            const nextBz = Math.abs(bowlZ) < 0.002 ? 0 : bowlZ * 0.72;
            const nextRx = Math.abs(bowlRx) < 0.002 ? 0 : bowlRx * 0.72;
            const nextRz = Math.abs(bowlRz) < 0.002 ? 0 : bowlRz * 0.72;

            bowlBody.velocity.set(
              (nextBx - bowlX) / FIXED_DT,
              (nextBy - bowlY) / FIXED_DT,
              (nextBz - bowlZ) / FIXED_DT
            );
            bowlBody.angularVelocity.set(0, 0, 0);
            bowlX = nextBx;
            bowlY = nextBy;
            bowlZ = nextBz;
            bowlRx = nextRx;
            bowlRz = nextRz;
            bowlBody.position.set(bowlX, bowlY, bowlZ);
            bowlBody.quaternion.setFromEuler(bowlRx, 0, bowlRz);
          }

          world.step(FIXED_DT);

          // インタラクティブ停止後の自然静止判定
          if (simState === 'settlingInteractive') {
            settleFrames++;
            const bowlSettled = bowlX === 0 && bowlY === 0 && bowlZ === 0 && bowlRx === 0 && bowlRz === 0;

            // 平らに着地して微振動（ガタガタ）しているダイスを滑らかに静止へ収束させる
            if (bowlSettled) {
              for (const b of dieBodies) {
                const v = b.velocity.length();
                const w = b.angularVelocity.length();
                const align = getTopFaceIndex(b.quaternion).alignment;
                if (align > 0.94 && v < 0.45 && w < 0.85) {
                  b.velocity.scale(0.8, b.velocity);
                  b.angularVelocity.scale(0.75, b.angularVelocity);
                }
              }
            }

            const allSlow =
              bowlSettled &&
              dieBodies.every((b) => b.velocity.length() < 0.12 && b.angularVelocity.length() < 0.18);

            if (allSlow) {
              // 立ち目（斜めに引っかかっている）チェック
              const allFlat = dieBodies.every((b) => getTopFaceIndex(b.quaternion).alignment > 0.92);
              if (!allFlat && settleFrames < 220) {
                // 斜めに引っかかったダイスを軽く小突いて自然に転がす
                for (const b of dieBodies) {
                  if (getTopFaceIndex(b.quaternion).alignment <= 0.92) {
                    b.velocity.x += (Math.random() - 0.5) * 1.6;
                    b.velocity.z += (Math.random() - 0.5) * 1.6;
                    b.angularVelocity.x += (Math.random() - 0.5) * 4.5;
                  }
                }
                stillFrames = 0;
              } else {
                stillFrames++;
              }
            } else {
              stillFrames = 0;
            }

            if (stillFrames >= 8 || settleFrames >= 240) {
              simState = 'idle';
              for (const b of dieBodies) {
                b.velocity.set(0, 0, 0);
                b.angularVelocity.set(0, 0, 0);
              }
              const results = dieBodies.map((b, i) => {
                const topIdx = getTopFaceIndex(b.quaternion).index;
                return dieFaceMaps[i][topIdx];
              }) as [number, number, number];
              onInteractiveSettledRef.current(results);
            }
          }
        }

        // 物理ボディ → Three.js メッシュへ完全同期
        bowlGroup.position.set(bowlBody.position.x, bowlBody.position.y, bowlBody.position.z);
        bowlGroup.quaternion.set(
          bowlBody.quaternion.x,
          bowlBody.quaternion.y,
          bowlBody.quaternion.z,
          bowlBody.quaternion.w
        );

        for (let i = 0; i < 3; i++) {
          const b = dieBodies[i];
          const m = dieMeshes[i];
          m.position.set(b.position.x, b.position.y, b.position.z);
          m.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
        }

        renderer.render(scene, camera);
        rafId = requestAnimationFrame(animate);
      };

      rafId = requestAnimationFrame(animate);

      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', handleResize);
        dieGeo.dispose();
        Object.values(matByValue).forEach((m) => {
          m.map?.dispose();
          m.dispose();
        });
        outerGeo.dispose();
        outerMat.dispose();
        innerGeo.dispose();
        innerTex.dispose();
        innerMat.dispose();
        rimGeo.dispose();
        rimMat.dispose();
        tableGeo.dispose();
        tableMat.dispose();
        renderer.dispose();
      };
    }, []);

    return <div ref={containerRef} className="chinchiro-canvas-host" />;
  }
);
