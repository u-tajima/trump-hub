import React, { useEffect, useImperativeHandle, useRef } from 'react';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { EUROPEAN_WHEEL_ORDER, getRouletteColor } from '../games/roulette';
import './RouletteWheel3D.css';

export interface RouletteWheel3DHandle {
  startInteractiveSpin: () => void;
  playTargetSpin: (targetNumber: number) => void;
}

interface RouletteWheel3DProps {
  soundEnabled: boolean;
  onInteractiveSettled: (winningNumber: number) => void;
  onReplaySettled: () => void;
}

const SLOT_COUNT = EUROPEAN_WHEEL_ORDER.length; // 37
const SLOT_ANGLE = (Math.PI * 2) / SLOT_COUNT;
const FIXED_DT = 1 / 60;
const BALL_RADIUS = 0.095;

// 各リングの基準半径
const R_CONE_OUT = 1.26;
const R_POCKET_MID = 1.56;
const R_POCKET_OUT = 1.86;
const R_TRACK_IN = 2.46;
const R_TRACK_OUT = 2.86;
const R_WALL_LIMIT = R_TRACK_OUT - BALL_RADIUS - 0.02;
const R_BOWL_OUT = 3.06;

function normalizeAngle(rad: number): number {
  const twoPi = Math.PI * 2;
  return ((rad % twoPi) + twoPi) % twoPi;
}

// 玉のワールド座標 (bx, bz) とホイール回転角 wheelAngle からポケット番号インデックス (0..36) を求める
function getSlotIndexFromBall(bx: number, bz: number, wheelAngle: number): number {
  const worldTheta = Math.atan2(bz, bx);
  const localTheta = normalizeAngle(worldTheta + wheelAngle);
  return Math.floor(normalizeAngle(localTheta + SLOT_ANGLE / 2) / SLOT_ANGLE) % SLOT_COUNT;
}

function createWheelDiscTexture(): THREE.CanvasTexture {
  const size = 1024;
  const half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, size, size);

  const scale = half / R_POCKET_OUT;
  const rInner = R_CONE_OUT * scale;
  const rNumBand = 1.62 * scale;
  const rOuter = R_POCKET_OUT * scale;

  for (let i = 0; i < SLOT_COUNT; i++) {
    const num = EUROPEAN_WHEEL_ORDER[i];
    const color = getRouletteColor(num);
    const a0 = (i - 0.5) * SLOT_ANGLE;
    const a1 = (i + 0.5) * SLOT_ANGLE;
    const mid = i * SLOT_ANGLE;

    // ポケット領域の塗りつぶし
    ctx.beginPath();
    ctx.moveTo(half + Math.cos(a0) * rInner, half + Math.sin(a0) * rInner);
    ctx.arc(half, half, rOuter, a0, a1);
    ctx.arc(half, half, rInner, a1, a0, true);
    ctx.closePath();

    if (color === 'green') {
      ctx.fillStyle = '#15803d';
    } else if (color === 'red') {
      ctx.fillStyle = '#b91c1c';
    } else {
      ctx.fillStyle = '#111827';
    }
    ctx.fill();

    // 仕切りのゴールド細線
    ctx.strokeStyle = 'rgba(245, 198, 102, 0.72)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 数字の印字（ポケット外側リング上に読みやすく配置）
    ctx.save();
    ctx.translate(half + Math.cos(mid) * rNumBand, half + Math.sin(mid) * rNumBand);
    ctx.rotate(mid + Math.PI / 2);
    ctx.fillStyle = '#fefce8';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), 0, 0);
    ctx.restore();
  }

  // ポケット内縁・外縁のゴールドリング
  ctx.beginPath();
  ctx.arc(half, half, rInner, 0, Math.PI * 2);
  ctx.strokeStyle = '#d99b26';
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(half, half, rOuter - 4, 0, Math.PI * 2);
  ctx.strokeStyle = '#d99b26';
  ctx.lineWidth = 7;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createWoodBowlTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#5a2815');
  grad.addColorStop(0.45, '#3b180b');
  grad.addColorStop(1, '#220d06');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 細かな木目ライン
  ctx.strokeStyle = 'rgba(255, 200, 150, 0.06)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 42; i++) {
    const y = (i / 42) * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + 6, size * 0.7, y - 6, size, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// cannon-es ルーレット剛体物理ワールドの共通構築ファクトリ
function createRoulettePhysicsRig() {
  const world = new CANNON.World();
  world.gravity.set(0, -18.5, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  (world.solver as CANNON.GSSolver).iterations = 14;
  world.allowSleep = false;

  const bowlMat = new CANNON.Material('bowl');
  const wheelMat = new CANNON.Material('wheel');
  const ballMat = new CANNON.Material('ball');

  world.addContactMaterial(
    new CANNON.ContactMaterial(bowlMat, ballMat, {
      friction: 0.015,
      restitution: 0.3,
    })
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(wheelMat, ballMat, {
      friction: 0.34,
      restitution: 0.34,
    })
  );

  // 1. 静的ボウル剛体（ボールトラック棚＋スロープ＋8個のダイヤモンド・デフレクター）
  // ※外周側面壁は多角形の角での急減速を防ぐため、真円法線抗力として stepRoulettePhysics で厳密処理
  const bowlBody = new CANNON.Body({
    mass: 0,
    material: bowlMat,
    position: new CANNON.Vec3(0, 0, 0),
  });

  const ringSegs = 32;
  for (let i = 0; i < ringSegs; i++) {
    const angle = (i / ringSegs) * Math.PI * 2;
    const qYaw = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle);

    // 上段ボールトラック棚（内側へ約9°傾いており、高速時は遠心力で側面を2〜3周回ってから自然落下）
    const rTrack = (R_TRACK_IN + R_TRACK_OUT) / 2;
    const qTrack = qYaw.mult(
      new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 0, 1), 0.16)
    );
    bowlBody.addShape(
      new CANNON.Box(new CANNON.Vec3(0.26, 0.08, 0.32)),
      new CANNON.Vec3(Math.cos(angle) * rTrack, 0.66, Math.sin(angle) * rTrack),
      qTrack
    );

    // スロープ（トラックからポケットへ落ちる約36°斜面）
    const rSlope = (R_POCKET_OUT + R_TRACK_IN) / 2;
    const qSlope = qYaw.mult(
      new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 0, 1), 0.62)
    );
    bowlBody.addShape(
      new CANNON.Box(new CANNON.Vec3(0.4, 0.08, 0.28)),
      new CANNON.Vec3(Math.cos(angle) * rSlope, 0.39, Math.sin(angle) * rSlope),
      qSlope
    );
  }

  // 8個のダイヤモンド・デフレクター（スロープ途中で玉を不規則に弾く）
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const rDef = 2.22;
    const qYaw = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle);
    const qSpin = new CANNON.Quaternion().setFromAxisAngle(
      new CANNON.Vec3(0, 1, 0),
      i % 2 === 0 ? 0.55 : -0.55
    );
    bowlBody.addShape(
      new CANNON.Box(new CANNON.Vec3(0.06, 0.06, 0.13)),
      new CANNON.Vec3(Math.cos(angle) * rDef, 0.52, Math.sin(angle) * rDef),
      qYaw.mult(qSpin)
    );
  }

  // 飛び出し防止の見えない天井
  bowlBody.addShape(
    new CANNON.Box(new CANNON.Vec3(3.2, 0.12, 3.2)),
    new CANNON.Vec3(0, 1.9, 0)
  );

  world.addBody(bowlBody);

  // 2. キネマティック回転ホイール剛体（底板＋中央コーン＋37枚のポケット仕切り板）
  const wheelBody = new CANNON.Body({
    type: CANNON.Body.KINEMATIC,
    material: wheelMat,
    position: new CANNON.Vec3(0, 0, 0),
  });

  // ポケット底面（上面 y = 0.16）
  wheelBody.addShape(
    new CANNON.Box(new CANNON.Vec3(R_POCKET_OUT + 0.05, 0.16, R_POCKET_OUT + 0.05)),
    new CANNON.Vec3(0, 0.0, 0)
  );

  // 中央コーン斜面（中心が高く外側へ -0.52 rad 傾斜 → 玉は必ずポケットへ落ちる）
  const coneSegs = 16;
  for (let i = 0; i < coneSegs; i++) {
    const angle = (i / coneSegs) * Math.PI * 2;
    const rCone = 0.72;
    const qYaw = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle);
    const qTilt = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -0.52);
    wheelBody.addShape(
      new CANNON.Box(new CANNON.Vec3(0.66, 0.1, 0.34)),
      new CANNON.Vec3(Math.cos(angle) * rCone, 0.44, Math.sin(angle) * rCone),
      qYaw.mult(qTilt)
    );
  }

  // 37枚の実際のポケット仕切り板（フレット）
  for (let i = 0; i < SLOT_COUNT; i++) {
    const fretAngle = (i + 0.5) * SLOT_ANGLE;
    const qYaw = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -fretAngle);
    wheelBody.addShape(
      new CANNON.Box(new CANNON.Vec3(0.28, 0.125, 0.011)),
      new CANNON.Vec3(Math.cos(fretAngle) * R_POCKET_MID, 0.275, Math.sin(fretAngle) * R_POCKET_MID),
      qYaw
    );
  }

  world.addBody(wheelBody);

  // 3. 剛体球（アイボリー玉）
  const ballBody = new CANNON.Body({
    mass: 0.25,
    material: ballMat,
    shape: new CANNON.Sphere(BALL_RADIUS),
    position: new CANNON.Vec3(R_POCKET_MID, 0.16 + BALL_RADIUS, 0),
    linearDamping: 0.02,
    angularDamping: 0.08,
  });
  world.addBody(ballBody);

  return { world, wheelBody, ballBody };
}

function launchBallInRig(
  ballBody: CANNON.Body
): { wheelOmega: number } {
  const startAngle = Math.random() * Math.PI * 2;
  const x = Math.cos(startAngle) * R_WALL_LIMIT;
  const z = Math.sin(startAngle) * R_WALL_LIMIT;
  ballBody.wakeUp();
  ballBody.position.set(x, 0.84, z);

  // ホイールは反時計回り (+wheelOmega) に対し、玉は時計回り (+angle方向) に高速発射
  const speed = 28.0 + Math.random() * 6.0;
  const tx = -Math.sin(startAngle);
  const tz = Math.cos(startAngle);
  ballBody.velocity.set(tx * speed, 0, tz * speed);
  ballBody.angularVelocity.set(0, 0, 0);

  const wheelOmega = 3.0 + Math.random() * 0.7;
  return { wheelOmega };
}

function stepRoulettePhysics(
  world: CANNON.World,
  wheelBody: CANNON.Body,
  ballBody: CANNON.Body,
  wheelAngle: number,
  wheelOmega: number,
  spinFrame: number
): { nextWheelAngle: number; nextWheelOmega: number } {
  const nextWheelOmega = Math.max(0.32, wheelOmega * 0.9978);
  const nextWheelAngle = wheelAngle + nextWheelOmega * FIXED_DT;

  wheelBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), nextWheelAngle);
  wheelBody.angularVelocity.set(0, nextWheelOmega, 0);

  // 外周トラック周回中は緩やかな減衰で2〜3周以上しっかり側面を高速回転→自然にスロープへ落下
  const r = Math.hypot(ballBody.position.x, ballBody.position.z);
  const preSpeed = Math.hypot(ballBody.velocity.x, ballBody.velocity.z);
  const trackDamp = 0.9905;
  if (r > R_TRACK_IN - 0.05) {
    ballBody.velocity.x *= trackDamp;
    ballBody.velocity.z *= trackDamp;
  } else if (r > R_POCKET_OUT) {
    ballBody.velocity.x *= 0.994;
    ballBody.velocity.z *= 0.994;
  } else {
    // ポケット内に入った玉がホイールに馴染みやすいよう軽い相対速度減衰
    const vxWheel = wheelBody.angularVelocity.y * ballBody.position.z;
    const vzWheel = -wheelBody.angularVelocity.y * ballBody.position.x;
    const rvx = ballBody.velocity.x - vxWheel;
    const rvz = ballBody.velocity.z - vzWheel;
    ballBody.velocity.x = vxWheel + rvx * 0.965;
    ballBody.velocity.z = vzWheel + rvz * 0.965;
  }

  // 万が一 560 フレーム以上経過してもスロープ上などに留まっていたら中心方向へわずかに促す
  if (spinFrame > 560 && r > R_POCKET_OUT - 0.05) {
    ballBody.velocity.x -= (ballBody.position.x / (r || 1)) * 0.16;
    ballBody.velocity.z -= (ballBody.position.z / (r || 1)) * 0.16;
  }

  world.step(FIXED_DT);

  // 真円外壁の滑らかな法線抗力（多角形の角での急減速を防ぎ側面を滑らかに周回させる）
  const rrPost = Math.hypot(ballBody.position.x, ballBody.position.z);
  if (rrPost > R_WALL_LIMIT) {
    const nx = ballBody.position.x / rrPost;
    const nz = ballBody.position.z / rrPost;
    ballBody.position.x = nx * R_WALL_LIMIT;
    ballBody.position.z = nz * R_WALL_LIMIT;
    const vr = ballBody.velocity.x * nx + ballBody.velocity.z * nz;
    if (vr > 0) {
      ballBody.velocity.x -= nx * vr;
      ballBody.velocity.z -= nz * vr;
      const postTan = Math.hypot(ballBody.velocity.x, ballBody.velocity.z);
      const targetTan = preSpeed * trackDamp;
      if (postTan > 0.1 && targetTan > postTan) {
        const k = targetTan / postTan;
        ballBody.velocity.x *= k;
        ballBody.velocity.z *= k;
      }
    }
  }

  return { nextWheelAngle, nextWheelOmega };
}

function isBallSettledInPocket(
  ballBody: CANNON.Body,
  wheelOmega: number
): boolean {
  const bx = ballBody.position.x;
  const by = ballBody.position.y;
  const bz = ballBody.position.z;
  const r = Math.hypot(bx, bz);
  if (r < R_CONE_OUT - 0.04 || r > R_POCKET_OUT + 0.04) return false;
  if (by > 0.38 || by < 0.12) return false;

  // 回転ホイール上の同地点の接線速度: v = omega × r = (0, w, 0) × (x, y, z) = (w*z, 0, -w*x)
  const vxWheel = wheelOmega * bz;
  const vzWheel = -wheelOmega * bx;
  const relSpeed = Math.hypot(
    ballBody.velocity.x - vxWheel,
    ballBody.velocity.y,
    ballBody.velocity.z - vzWheel
  );
  return relSpeed < 0.34;
}

interface RecordedRouletteFrame {
  wheelAngle: number;
  ballPos: [number, number, number];
  maxImpact: number;
}

interface RecordedRouletteSpin {
  frames: RecordedRouletteFrame[];
  naturalSlotIndex: number;
  finalWheelOmega: number;
}

// ゲスト・他プレイヤー用: ヘッドレス cannon-es で物理を最後まで回し、自然着地スロットを記録
function presimulateRouletteSpin(): RecordedRouletteSpin {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { world, wheelBody, ballBody } = createRoulettePhysicsRig();
    let { wheelOmega } = launchBallInRig(ballBody);
    let wheelAngle = Math.random() * Math.PI * 2;

    let stepImpact = 0;
    ballBody.addEventListener('collide', (ev: { contact: CANNON.ContactEquation }) => {
      const imp = Math.abs(ev.contact.getImpactVelocityAlongNormal());
      if (imp > stepImpact) stepImpact = imp;
    });

    const frames: RecordedRouletteFrame[] = [];
    let settledFrames = 0;
    let lastSlot = -1;

    for (let step = 0; step < 760; step++) {
      stepImpact = 0;
      const res = stepRoulettePhysics(world, wheelBody, ballBody, wheelAngle, wheelOmega, step);
      wheelAngle = res.nextWheelAngle;
      wheelOmega = res.nextWheelOmega;

      frames.push({
        wheelAngle,
        ballPos: [ballBody.position.x, ballBody.position.y, ballBody.position.z],
        maxImpact: stepImpact,
      });

      if (step > 80 && isBallSettledInPocket(ballBody, wheelOmega)) {
        const slot = getSlotIndexFromBall(ballBody.position.x, ballBody.position.z, wheelAngle);
        if (slot === lastSlot) {
          settledFrames++;
          if (settledFrames >= 22) {
            return { frames, naturalSlotIndex: slot, finalWheelOmega: wheelOmega };
          }
        } else {
          lastSlot = slot;
          settledFrames = 1;
        }
      } else {
        settledFrames = 0;
        lastSlot = -1;
      }
    }

    const fallbackSlot = getSlotIndexFromBall(ballBody.position.x, ballBody.position.z, wheelAngle);
    if (attempt === 3) {
      return { frames, naturalSlotIndex: fallbackSlot, finalWheelOmega: wheelOmega };
    }
  }

  return { frames: [], naturalSlotIndex: 0, finalWheelOmega: 0.4 };
}

class RouletteSoundSynth {
  private ctx: AudioContext | null = null;
  private lastPlayed = 0;

  playTick(intensity = 0.5) {
    const nowMs = performance.now();
    if (nowMs - this.lastPlayed < 42) return;
    this.lastPlayed = nowMs;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.ctx) this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') void this.ctx.resume();

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1600 + Math.random() * 800, t);
      osc.frequency.exponentialRampToValueAtTime(520, t + 0.032);

      const vol = Math.min(0.13, Math.max(0.014, intensity * 0.11));
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.036);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.04);
    } catch {
      // ignore
    }
  }
}

type SimMode = 'idle' | 'spinningInteractive' | 'replaying';

export const RouletteWheel3D = React.forwardRef<RouletteWheel3DHandle, RouletteWheel3DProps>(
  ({ soundEnabled, onInteractiveSettled, onReplaySettled }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const soundEnabledRef = useRef(soundEnabled);
    const onInteractiveSettledRef = useRef(onInteractiveSettled);
    const onReplaySettledRef = useRef(onReplaySettled);

    soundEnabledRef.current = soundEnabled;
    onInteractiveSettledRef.current = onInteractiveSettled;
    onReplaySettledRef.current = onReplaySettled;

    const actionsRef = useRef<RouletteWheel3DHandle | null>(null);
    useImperativeHandle(ref, () => ({
      startInteractiveSpin: () => actionsRef.current?.startInteractiveSpin(),
      playTargetSpin: (num) => actionsRef.current?.playTargetSpin(num),
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const width = container.clientWidth || 340;
      const height = 276;

      // Three.js 斜め俯瞰シーン構築
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 60);
      camera.position.set(0, 6.6, 5.5);
      camera.lookAt(0, 0.25, 0.15);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.16;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xfff8e7, 0x0b2218, 0.95));

      const dirLight = new THREE.DirectionalLight(0xfff4d6, 2.2);
      dirLight.position.set(4.8, 10.5, 4.5);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 1;
      dirLight.shadow.camera.far = 24;
      dirLight.shadow.camera.left = -4.5;
      dirLight.shadow.camera.right = 4.5;
      dirLight.shadow.camera.top = 4.5;
      dirLight.shadow.camera.bottom = -4.5;
      dirLight.shadow.bias = -0.001;
      scene.add(dirLight);

      const accentLight = new THREE.PointLight(0xfbbf24, 0.7, 15);
      accentLight.position.set(-4.2, 4.5, -3.5);
      scene.add(accentLight);

      // 卓上シャドウ受け
      const tableGeo = new THREE.CircleGeometry(7.5, 48);
      const tableMat = new THREE.ShadowMaterial({ opacity: 0.45 });
      const tableMesh = new THREE.Mesh(tableGeo, tableMat);
      tableMesh.rotation.x = -Math.PI / 2;
      tableMesh.position.y = -0.02;
      tableMesh.receiveShadow = true;
      scene.add(tableMesh);

      // 1. 静的マホガニー外枠ボウル
      const woodTex = createWoodBowlTexture();
      const woodMat = new THREE.MeshPhysicalMaterial({
        map: woodTex,
        roughness: 0.28,
        metalness: 0.08,
        clearcoat: 0.55,
        clearcoatRoughness: 0.22,
      });
      const brassMat = new THREE.MeshStandardMaterial({
        color: 0xe2ae3b,
        roughness: 0.24,
        metalness: 0.88,
      });

      const bowlProfile: THREE.Vector2[] = [
        new THREE.Vector2(R_POCKET_OUT, 0.16),
        new THREE.Vector2(R_TRACK_IN, 0.61),
        new THREE.Vector2(R_TRACK_OUT, 0.7),
        new THREE.Vector2(R_TRACK_OUT + 0.02, 1.02),
        new THREE.Vector2(R_BOWL_OUT, 1.04),
        new THREE.Vector2(R_BOWL_OUT + 0.06, 0.52),
        new THREE.Vector2(R_BOWL_OUT - 0.18, 0.0),
        new THREE.Vector2(0.0, 0.0),
      ];
      const bowlGeo = new THREE.LatheGeometry(bowlProfile, 64);
      const bowlMesh = new THREE.Mesh(bowlGeo, woodMat);
      bowlMesh.castShadow = true;
      bowlMesh.receiveShadow = true;
      scene.add(bowlMesh);

      // 真鍮リム
      const rimGeo = new THREE.TorusGeometry(R_BOWL_OUT - 0.04, 0.055, 16, 64);
      const rimMesh = new THREE.Mesh(rimGeo, brassMat);
      rimMesh.rotation.x = Math.PI / 2;
      rimMesh.position.y = 1.03;
      rimMesh.castShadow = true;
      scene.add(rimMesh);

      // 8個のダイヤモンド・デフレクター（真鍮ひし形突起）
      const defGeo = new THREE.OctahedronGeometry(0.11, 0);
      defGeo.scale(0.65, 0.45, 1.35);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const rDef = 2.22;
        const m = new THREE.Mesh(defGeo, brassMat);
        m.position.set(Math.cos(angle) * rDef, 0.52, Math.sin(angle) * rDef);
        m.rotation.y = -angle + (i % 2 === 0 ? 0.55 : -0.55);
        m.castShadow = true;
        scene.add(m);
      }

      // 2. 回転ホイールグループ
      const wheelGroup = new THREE.Group();
      scene.add(wheelGroup);

      // 37ポケット円盤（テクスチャ付き）
      const discGeo = new THREE.CircleGeometry(R_POCKET_OUT, 74);
      const discTex = createWheelDiscTexture();
      const discMat = new THREE.MeshStandardMaterial({
        map: discTex,
        roughness: 0.32,
        metalness: 0.08,
      });
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.rotation.x = -Math.PI / 2;
      discMesh.position.y = 0.165;
      discMesh.receiveShadow = true;
      wheelGroup.add(discMesh);

      // 37本の立体真鍮フレット（仕切り棒）
      const fretGeo = new THREE.BoxGeometry(0.56, 0.12, 0.024);
      for (let i = 0; i < SLOT_COUNT; i++) {
        const fretAngle = (i + 0.5) * SLOT_ANGLE;
        const fret = new THREE.Mesh(fretGeo, brassMat);
        fret.position.set(
          Math.cos(fretAngle) * R_POCKET_MID,
          0.225,
          Math.sin(fretAngle) * R_POCKET_MID
        );
        fret.rotation.y = -fretAngle;
        fret.castShadow = true;
        wheelGroup.add(fret);
      }

      // 中央コーン＋真鍮タレット（十字スピナー）
      const coneGeo = new THREE.CylinderGeometry(0.22, R_CONE_OUT, 0.62, 48);
      const coneMesh = new THREE.Mesh(coneGeo, woodMat);
      coneMesh.position.y = 0.47;
      coneMesh.castShadow = true;
      coneMesh.receiveShadow = true;
      wheelGroup.add(coneMesh);

      const turretCenterGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.34, 24);
      const turretCenter = new THREE.Mesh(turretCenterGeo, brassMat);
      turretCenter.position.y = 0.88;
      turretCenter.castShadow = true;
      wheelGroup.add(turretCenter);

      const turretCapGeo = new THREE.SphereGeometry(0.18, 20, 16);
      const turretCap = new THREE.Mesh(turretCapGeo, brassMat);
      turretCap.position.y = 1.05;
      wheelGroup.add(turretCap);

      const armGeo = new THREE.CylinderGeometry(0.032, 0.032, 1.08, 12);
      const arm1 = new THREE.Mesh(armGeo, brassMat);
      arm1.rotation.z = Math.PI / 2;
      arm1.position.y = 0.92;
      arm1.castShadow = true;
      wheelGroup.add(arm1);

      const arm2 = new THREE.Mesh(armGeo, brassMat);
      arm2.rotation.x = Math.PI / 2;
      arm2.position.y = 0.92;
      arm2.castShadow = true;
      wheelGroup.add(arm2);

      const knobGeo = new THREE.SphereGeometry(0.068, 16, 12);
      [
        [0.54, 0],
        [-0.54, 0],
        [0, 0.54],
        [0, -0.54],
      ].forEach(([kx, kz]) => {
        const knob = new THREE.Mesh(knobGeo, brassMat);
        knob.position.set(kx, 0.92, kz);
        knob.castShadow = true;
        wheelGroup.add(knob);
      });

      // 3. アイボリー玉メッシュ（光沢クリアコート仕上げ）
      const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 24, 20);
      const ballMat = new THREE.MeshPhysicalMaterial({
        color: 0xfffdf7,
        roughness: 0.1,
        metalness: 0.02,
        clearcoat: 0.9,
        clearcoatRoughness: 0.08,
      });
      const ballMesh = new THREE.Mesh(ballGeo, ballMat);
      ballMesh.castShadow = true;
      scene.add(ballMesh);

      // 4. cannon-es 物理セットアップ
      const { world, wheelBody, ballBody } = createRoulettePhysicsRig();
      const soundSynth = new RouletteSoundSynth();

      ballBody.addEventListener('collide', (ev: { contact: CANNON.ContactEquation }) => {
        if (!soundEnabledRef.current) return;
        const impact = Math.abs(ev.contact.getImpactVelocityAlongNormal());
        if (impact > 1.05) {
          soundSynth.playTick(Math.min(1, impact / 9));
        }
      });

      let simMode: SimMode = 'idle';
      let wheelAngle = 0;
      let wheelOmega = 0.35; // 待機中もゆっくり優雅に回り続ける
      let spinFrame = 0;
      let settledFrames = 0;
      let lastSlot = -1;

      // リプレイ用状態
      let replayFrames: RecordedRouletteFrame[] = [];
      let replayCursor = 0;
      let replayAngleOffset = 0;
      // 静止後にポケット内で一緒に回る玉のローカル位置（ホイール基準）
      let restingLocalBall: { r: number; localTheta: number; y: number } | null = {
        r: R_POCKET_MID,
        localTheta: 0,
        y: 0.165 + BALL_RADIUS,
      };

      actionsRef.current = {
        startInteractiveSpin: () => {
          restingLocalBall = null;
          replayFrames = [];
          replayCursor = 0;
          replayAngleOffset = 0;
          const launch = launchBallInRig(ballBody);
          wheelOmega = launch.wheelOmega;
          simMode = 'spinningInteractive';
          spinFrame = 0;
          settledFrames = 0;
          lastSlot = -1;
        },

        playTargetSpin: (targetNumber: number) => {
          const recorded = presimulateRouletteSpin();
          const targetSlotIdx = Math.max(0, EUROPEAN_WHEEL_ORDER.indexOf(targetNumber));
          // 37ポケットの円対称性を利用し、ホイール開始角を (target - natural) * SLOT_ANGLE だけ事前にずらす
          replayAngleOffset = (targetSlotIdx - recorded.naturalSlotIndex) * SLOT_ANGLE;
          replayFrames = recorded.frames;
          replayCursor = 0;
          restingLocalBall = null;

          if (replayFrames.length > 0) {
            simMode = 'replaying';
          } else {
            simMode = 'idle';
            restingLocalBall = {
              r: R_POCKET_MID,
              localTheta: targetSlotIdx * SLOT_ANGLE,
              y: 0.165 + BALL_RADIUS,
            };
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

          if (simMode === 'replaying') {
            const frame = replayFrames[Math.min(replayCursor, replayFrames.length - 1)];
            wheelAngle = frame.wheelAngle + replayAngleOffset;
            ballBody.position.set(frame.ballPos[0], frame.ballPos[1], frame.ballPos[2]);
            if (soundEnabledRef.current && frame.maxImpact > 1.05) {
              soundSynth.playTick(Math.min(1, frame.maxImpact / 9));
            }
            replayCursor++;
            if (replayCursor >= replayFrames.length) {
              const bx = ballBody.position.x;
              const bz = ballBody.position.z;
              const localTheta = normalizeAngle(Math.atan2(bz, bx) + wheelAngle);
              restingLocalBall = {
                r: Math.min(R_POCKET_OUT - 0.14, Math.max(R_CONE_OUT + 0.14, Math.hypot(bx, bz))),
                localTheta,
                y: 0.165 + BALL_RADIUS,
              };
              wheelOmega = 0.35;
              simMode = 'idle';
              onReplaySettledRef.current();
            }
          } else if (simMode === 'spinningInteractive') {
            spinFrame++;
            const res = stepRoulettePhysics(
              world,
              wheelBody,
              ballBody,
              wheelAngle,
              wheelOmega,
              spinFrame
            );
            wheelAngle = res.nextWheelAngle;
            wheelOmega = res.nextWheelOmega;

            const settledNow = spinFrame > 80 && isBallSettledInPocket(ballBody, wheelOmega);
            if (settledNow) {
              const slot = getSlotIndexFromBall(ballBody.position.x, ballBody.position.z, wheelAngle);
              if (slot === lastSlot) {
                settledFrames++;
              } else {
                lastSlot = slot;
                settledFrames = 1;
              }
            } else {
              settledFrames = 0;
              lastSlot = -1;
            }

            if (settledFrames >= 22 || spinFrame >= 760) {
              const finalSlot = getSlotIndexFromBall(
                ballBody.position.x,
                ballBody.position.z,
                wheelAngle
              );
              const winningNumber = EUROPEAN_WHEEL_ORDER[finalSlot];
              const bx = ballBody.position.x;
              const bz = ballBody.position.z;
              restingLocalBall = {
                r: Math.min(R_POCKET_OUT - 0.14, Math.max(R_CONE_OUT + 0.14, Math.hypot(bx, bz))),
                localTheta: normalizeAngle(Math.atan2(bz, bx) + wheelAngle),
                y: 0.165 + BALL_RADIUS,
              };
              wheelOmega = 0.35;
              simMode = 'idle';
              onInteractiveSettledRef.current(winningNumber);
            }
          } else {
            // 待機・結果表示中はゆっくりホイールが回り、玉もポケットに入ったまま一緒に回る
            wheelAngle += wheelOmega * FIXED_DT;
            if (restingLocalBall) {
              const worldTheta = restingLocalBall.localTheta - wheelAngle;
              ballBody.position.set(
                Math.cos(worldTheta) * restingLocalBall.r,
                restingLocalBall.y,
                Math.sin(worldTheta) * restingLocalBall.r
              );
            }
          }
        }

        // Three.js メッシュへ完全同期
        wheelGroup.rotation.y = wheelAngle;
        ballMesh.position.set(ballBody.position.x, ballBody.position.y, ballBody.position.z);

        renderer.render(scene, camera);
        rafId = requestAnimationFrame(animate);
      };

      rafId = requestAnimationFrame(animate);

      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', handleResize);
        tableGeo.dispose();
        tableMat.dispose();
        bowlGeo.dispose();
        woodTex.dispose();
        woodMat.dispose();
        brassMat.dispose();
        rimGeo.dispose();
        defGeo.dispose();
        discGeo.dispose();
        discTex.dispose();
        discMat.dispose();
        fretGeo.dispose();
        coneGeo.dispose();
        turretCenterGeo.dispose();
        turretCapGeo.dispose();
        armGeo.dispose();
        knobGeo.dispose();
        ballGeo.dispose();
        ballMat.dispose();
        renderer.dispose();
      };
    }, []);

    return <div ref={containerRef} className="roulette-canvas-host" />;
  }
);
