import React, { useEffect, useImperativeHandle, useRef } from 'react';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import '../RouletteWheel3D.css';

export interface CustomRouletteSlot {
  id: string;
  label: string;
  color: string;
  isReroll?: boolean;
}

export interface CustomRouletteTool3DHandle {
  startSpin: () => void;
}

interface CustomRouletteTool3DProps {
  slots: CustomRouletteSlot[];
  soundEnabled: boolean;
  onSettled: (slot: CustomRouletteSlot) => void;
}

const FIXED_DT = 1 / 60;
const BALL_RADIUS = 0.095;

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

function getSlotIndexFromBall(
  bx: number,
  bz: number,
  wheelAngle: number,
  slotCount: number
): number {
  const slotAngle = (Math.PI * 2) / slotCount;
  const worldTheta = Math.atan2(bz, bx);
  const localTheta = normalizeAngle(worldTheta + wheelAngle);
  return Math.floor(normalizeAngle(localTheta + slotAngle / 2) / slotAngle) % slotCount;
}

function createCustomDiscTexture(slots: CustomRouletteSlot[]): THREE.CanvasTexture {
  const size = 1024;
  const half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, size, size);

  const slotCount = Math.max(2, slots.length);
  const slotAngle = (Math.PI * 2) / slotCount;
  const scale = half / R_POCKET_OUT;
  const rInner = R_CONE_OUT * scale;
  const rText = 1.6 * scale;
  const rOuter = R_POCKET_OUT * scale;

  const fontSize = slotCount <= 8 ? 38 : slotCount <= 16 ? 30 : slotCount <= 24 ? 24 : 20;
  const maxChars = slotCount <= 12 ? 6 : slotCount <= 24 ? 4 : 3;

  for (let i = 0; i < slotCount; i++) {
    const slot = slots[i];
    const a0 = (i - 0.5) * slotAngle;
    const a1 = (i + 0.5) * slotAngle;
    const mid = i * slotAngle;

    ctx.beginPath();
    ctx.moveTo(half + Math.cos(a0) * rInner, half + Math.sin(a0) * rInner);
    ctx.arc(half, half, rOuter, a0, a1);
    ctx.arc(half, half, rInner, a1, a0, true);
    ctx.closePath();

    ctx.fillStyle = slot.color;
    ctx.fill();

    ctx.strokeStyle = 'rgba(245, 198, 102, 0.72)';
    ctx.lineWidth = 3;
    ctx.stroke();

    const text =
      slot.label.length > maxChars ? `${slot.label.slice(0, maxChars - 1)}…` : slot.label;

    ctx.save();
    ctx.translate(half + Math.cos(mid) * rText, half + Math.sin(mid) * rText);
    ctx.rotate(mid + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 4;
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

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

class CustomRouletteSound {
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

export const CustomRouletteTool3D = React.forwardRef<
  CustomRouletteTool3DHandle,
  CustomRouletteTool3DProps
>(({ slots, soundEnabled, onSettled }, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  const onSettledRef = useRef(onSettled);
  soundEnabledRef.current = soundEnabled;
  onSettledRef.current = onSettled;

  const actionsRef = useRef<CustomRouletteTool3DHandle | null>(null);
  useImperativeHandle(ref, () => ({
    startSpin: () => actionsRef.current?.startSpin(),
  }));

  // slots の内容キーで必要なときだけ物理＆テクスチャを再構築
  const slotsKey = slots.map((s) => `${s.id}:${s.label}:${s.color}`).join('|');

  useEffect(() => {
    const container = containerRef.current;
    if (!container || slots.length < 2) return;

    const slotCount = slots.length;
    const slotAngle = (Math.PI * 2) / slotCount;
    const width = container.clientWidth || 340;
    const height = 276;

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

    const tableGeo = new THREE.CircleGeometry(7.5, 48);
    const tableMat = new THREE.ShadowMaterial({ opacity: 0.45 });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.rotation.x = -Math.PI / 2;
    tableMesh.position.y = -0.02;
    tableMesh.receiveShadow = true;
    scene.add(tableMesh);

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

    const rimGeo = new THREE.TorusGeometry(R_BOWL_OUT - 0.04, 0.055, 16, 64);
    const rimMesh = new THREE.Mesh(rimGeo, brassMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 1.03;
    rimMesh.castShadow = true;
    scene.add(rimMesh);

    const defGeo = new THREE.OctahedronGeometry(0.11, 0);
    defGeo.scale(0.65, 0.45, 1.35);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const m = new THREE.Mesh(defGeo, brassMat);
      m.position.set(Math.cos(angle) * 2.22, 0.52, Math.sin(angle) * 2.22);
      m.rotation.y = -angle + (i % 2 === 0 ? 0.55 : -0.55);
      m.castShadow = true;
      scene.add(m);
    }

    const wheelGroup = new THREE.Group();
    scene.add(wheelGroup);

    const discGeo = new THREE.CircleGeometry(R_POCKET_OUT, Math.max(64, slotCount * 2));
    const discTex = createCustomDiscTexture(slots);
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

    const fretGeo = new THREE.BoxGeometry(0.56, 0.12, 0.024);
    for (let i = 0; i < slotCount; i++) {
      const fretAngle = (i + 0.5) * slotAngle;
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

    // cannon-es 物理ワールド
    const world = new CANNON.World();
    world.gravity.set(0, -18.5, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    (world.solver as CANNON.GSSolver).iterations = 14;
    world.allowSleep = false;

    const bowlMat = new CANNON.Material('bowl');
    const wheelMat = new CANNON.Material('wheel');
    const ballMatPhys = new CANNON.Material('ball');
    world.addContactMaterial(
      new CANNON.ContactMaterial(bowlMat, ballMatPhys, { friction: 0.015, restitution: 0.3 })
    );
    world.addContactMaterial(
      new CANNON.ContactMaterial(wheelMat, ballMatPhys, { friction: 0.34, restitution: 0.34 })
    );

    const bowlBody = new CANNON.Body({ mass: 0, material: bowlMat });
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      const qYaw = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle);
      bowlBody.addShape(
        new CANNON.Box(new CANNON.Vec3(0.26, 0.08, 0.32)),
        new CANNON.Vec3(Math.cos(angle) * 2.66, 0.66, Math.sin(angle) * 2.66),
        qYaw.mult(new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 0, 1), 0.16))
      );
      bowlBody.addShape(
        new CANNON.Box(new CANNON.Vec3(0.4, 0.08, 0.28)),
        new CANNON.Vec3(Math.cos(angle) * 2.16, 0.39, Math.sin(angle) * 2.16),
        qYaw.mult(new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 0, 1), 0.62))
      );
    }
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const qYaw = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle);
      const qSpin = new CANNON.Quaternion().setFromAxisAngle(
        new CANNON.Vec3(0, 1, 0),
        i % 2 === 0 ? 0.55 : -0.55
      );
      bowlBody.addShape(
        new CANNON.Box(new CANNON.Vec3(0.06, 0.06, 0.13)),
        new CANNON.Vec3(Math.cos(angle) * 2.22, 0.52, Math.sin(angle) * 2.22),
        qYaw.mult(qSpin)
      );
    }
    bowlBody.addShape(new CANNON.Box(new CANNON.Vec3(3.2, 0.12, 3.2)), new CANNON.Vec3(0, 1.9, 0));
    world.addBody(bowlBody);

    const wheelBody = new CANNON.Body({ type: CANNON.Body.KINEMATIC, material: wheelMat });
    wheelBody.addShape(
      new CANNON.Box(new CANNON.Vec3(R_POCKET_OUT + 0.05, 0.16, R_POCKET_OUT + 0.05)),
      new CANNON.Vec3(0, 0, 0)
    );
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const qYaw = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle);
      wheelBody.addShape(
        new CANNON.Box(new CANNON.Vec3(0.66, 0.1, 0.34)),
        new CANNON.Vec3(Math.cos(angle) * 0.72, 0.44, Math.sin(angle) * 0.72),
        qYaw.mult(new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -0.52))
      );
    }
    for (let i = 0; i < slotCount; i++) {
      const fretAngle = (i + 0.5) * slotAngle;
      const qYaw = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -fretAngle);
      wheelBody.addShape(
        new CANNON.Box(new CANNON.Vec3(0.28, 0.125, 0.011)),
        new CANNON.Vec3(Math.cos(fretAngle) * R_POCKET_MID, 0.275, Math.sin(fretAngle) * R_POCKET_MID),
        qYaw
      );
    }
    world.addBody(wheelBody);

    const ballBody = new CANNON.Body({
      mass: 0.25,
      material: ballMatPhys,
      shape: new CANNON.Sphere(BALL_RADIUS),
      position: new CANNON.Vec3(R_POCKET_MID, 0.16 + BALL_RADIUS, 0),
      linearDamping: 0.02,
      angularDamping: 0.08,
    });
    const soundSynth = new CustomRouletteSound();
    ballBody.addEventListener('collide', (ev: { contact: CANNON.ContactEquation }) => {
      if (!soundEnabledRef.current) return;
      const impact = Math.abs(ev.contact.getImpactVelocityAlongNormal());
      if (impact > 1.05) soundSynth.playTick(Math.min(1, impact / 9));
    });
    world.addBody(ballBody);

    let simMode: 'idle' | 'spinning' = 'idle';
    let wheelAngle = 0;
    let wheelOmega = 0.35;
    let spinFrame = 0;
    let settledFrames = 0;
    let lastSlot = -1;
    let restingLocalBall: { r: number; localTheta: number; y: number } | null = {
      r: R_POCKET_MID,
      localTheta: 0,
      y: 0.165 + BALL_RADIUS,
    };

    actionsRef.current = {
      startSpin: () => {
        restingLocalBall = null;
        const startAngle = Math.random() * Math.PI * 2;
        ballBody.wakeUp();
        ballBody.position.set(
          Math.cos(startAngle) * R_WALL_LIMIT,
          0.84,
          Math.sin(startAngle) * R_WALL_LIMIT
        );
        const speed = 28.0 + Math.random() * 6.0;
        ballBody.velocity.set(-Math.sin(startAngle) * speed, 0, Math.cos(startAngle) * speed);
        ballBody.angularVelocity.set(0, 0, 0);
        wheelOmega = 3.0 + Math.random() * 0.7;
        simMode = 'spinning';
        spinFrame = 0;
        settledFrames = 0;
        lastSlot = -1;
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

        if (simMode === 'spinning') {
          spinFrame++;
          wheelOmega = Math.max(0.32, wheelOmega * 0.9978);
          wheelAngle += wheelOmega * FIXED_DT;
          wheelBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), wheelAngle);
          wheelBody.angularVelocity.set(0, wheelOmega, 0);

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
            const vxw = wheelOmega * ballBody.position.z;
            const vzw = -wheelOmega * ballBody.position.x;
            ballBody.velocity.x = vxw + (ballBody.velocity.x - vxw) * 0.965;
            ballBody.velocity.z = vzw + (ballBody.velocity.z - vzw) * 0.965;
          }

          if (spinFrame > 560 && r > R_POCKET_OUT - 0.05) {
            ballBody.velocity.x -= (ballBody.position.x / (r || 1)) * 0.16;
            ballBody.velocity.z -= (ballBody.position.z / (r || 1)) * 0.16;
          }

          world.step(FIXED_DT);

          // 真円外壁の滑らかな法線抗力（2〜3周しっかり側面を高速回転させる）
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

          const bx = ballBody.position.x;
          const by = ballBody.position.y;
          const bz = ballBody.position.z;
          const rr = Math.hypot(bx, bz);
          const vxw = wheelOmega * bz;
          const vzw = -wheelOmega * bx;
          const relSpeed = Math.hypot(
            ballBody.velocity.x - vxw,
            ballBody.velocity.y,
            ballBody.velocity.z - vzw
          );
          const inPocket =
            spinFrame > 80 &&
            rr > R_CONE_OUT - 0.04 &&
            rr < R_POCKET_OUT + 0.04 &&
            by > 0.12 &&
            by < 0.38 &&
            relSpeed < 0.34;

          if (inPocket) {
            const slotIdx = getSlotIndexFromBall(bx, bz, wheelAngle, slotCount);
            if (slotIdx === lastSlot) {
              settledFrames++;
            } else {
              lastSlot = slotIdx;
              settledFrames = 1;
            }
          } else {
            settledFrames = 0;
            lastSlot = -1;
          }

          if (settledFrames >= 22 || spinFrame >= 760) {
            const finalIdx = getSlotIndexFromBall(bx, bz, wheelAngle, slotCount);
            restingLocalBall = {
              r: Math.min(R_POCKET_OUT - 0.14, Math.max(R_CONE_OUT + 0.14, rr)),
              localTheta: normalizeAngle(Math.atan2(bz, bx) + wheelAngle),
              y: 0.165 + BALL_RADIUS,
            };
            wheelOmega = 0.35;
            simMode = 'idle';
            onSettledRef.current(slots[finalIdx]);
          }
        } else {
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
  }, [slotsKey]);

  return <div ref={containerRef} className="roulette-canvas-host" />;
});
