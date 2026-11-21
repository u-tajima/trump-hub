import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type BowlSimMode = 'idle' | 'shaking' | 'settling';

interface ChinchiroBowl3DProps {
  mode: BowlSimMode;
  targetDice: [number, number, number];
  soundEnabled: boolean;
  onSettled?: () => void;
}

const DIE_SIZE = 0.72;
const DIE_HALF = DIE_SIZE / 2;
const BOWL_MAX_R = 2.15;

function bowlSurfaceY(r: number): number {
  const flatR = 1.05;
  if (r <= flatR) {
    return 0.12 + 0.04 * (r / flatR) * (r / flatR);
  }
  const d = r - flatR;
  return 0.16 + d * d * 0.92;
}

function bowlNormal(x: number, z: number): THREE.Vector3 {
  const r = Math.hypot(x, z);
  if (r < 0.001) return new THREE.Vector3(0, 1, 0);
  const flatR = 1.05;
  const slope = r <= flatR ? (0.08 * r) / (flatR * flatR) : 1.84 * (r - flatR);
  const nx = -(x / r) * slope;
  const nz = -(z / r) * slope;
  return new THREE.Vector3(nx, 1, nz).normalize();
}

const PIP_COORDS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.26, 0.26], [0.74, 0.74]],
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  4: [[0.26, 0.26], [0.74, 0.26], [0.26, 0.74], [0.74, 0.74]],
  5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
  6: [[0.26, 0.24], [0.74, 0.24], [0.26, 0.5], [0.74, 0.5], [0.26, 0.76], [0.74, 0.76]],
};

function createDieFaceTexture(value: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createRadialGradient(size * 0.38, size * 0.35, 10, size * 0.5, size * 0.5, size * 0.75);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.75, '#f4f1ea');
  bg.addColorStop(1, '#dcd6c8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, size - 10, size - 10);

  const coords = PIP_COORDS[value] ?? PIP_COORDS[1];
  const radius = value === 1 ? size * 0.14 : size * 0.085;

  for (const [u, v] of coords) {
    const cx = u * size;
    const cy = v * size;

    const pipGrad = ctx.createRadialGradient(
      cx - radius * 0.25,
      cy - radius * 0.25,
      radius * 0.1,
      cx,
      cy,
      radius
    );
    if (value === 1) {
      pipGrad.addColorStop(0, '#ef4444');
      pipGrad.addColorStop(0.7, '#b91c1c');
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

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
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

  ctx.strokeStyle = 'rgba(245, 198, 102, 0.22)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.16);
  ctx.lineTo(size, size * 0.16);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 2;
  for (let y = 40; y < size; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function targetQuaternionForFace(value: number, yawRad: number): THREE.Quaternion {
  const qFace = new THREE.Quaternion();
  const euler = new THREE.Euler();
  switch (value) {
    case 1:
      euler.set(0, 0, 0);
      break;
    case 6:
      euler.set(Math.PI, 0, 0);
      break;
    case 2:
      euler.set(-Math.PI / 2, 0, 0);
      break;
    case 5:
      euler.set(Math.PI / 2, 0, 0);
      break;
    case 3:
      euler.set(0, 0, Math.PI / 2);
      break;
    case 4:
      euler.set(0, 0, -Math.PI / 2);
      break;
    default:
      euler.set(0, 0, 0);
  }
  qFace.setFromEuler(euler);
  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawRad);
  return qYaw.multiply(qFace);
}

class DiceSoundSynth {
  private ctx: AudioContext | null = null;
  private lastPlayed = 0;

  playClack(intensity = 0.6) {
    const nowMs = performance.now();
    if (nowMs - this.lastPlayed < 42) return;
    this.lastPlayed = nowMs;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.ctx) this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const baseFreq = 1100 + Math.random() * 650;
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(380, t + 0.045);

      const vol = Math.min(0.16, Math.max(0.02, intensity * 0.14));
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.055);
    } catch {
      // ignore audio block
    }
  }
}

interface SimDie {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  omega: THREE.Vector3;
  startQuat: THREE.Quaternion;
  targetQuat: THREE.Quaternion;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  settledSoundPlayed: boolean;
}

const REST_POSITIONS: [number, number][] = [
  [-0.78, 0.36],
  [0.05, -0.58],
  [0.78, 0.32],
];

export const ChinchiroBowl3D: React.FC<ChinchiroBowl3DProps> = ({
  mode,
  targetDice,
  soundEnabled,
  onSettled,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<BowlSimMode>(mode);
  const targetDiceRef = useRef<[number, number, number]>(targetDice);
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  const onSettledRef = useRef(onSettled);
  const settleStartRef = useRef<number>(0);
  const settledFiredRef = useRef<boolean>(false);
  const triggerTransitionRef = useRef<((nextMode: BowlSimMode) => void) | null>(null);

  soundEnabledRef.current = soundEnabled;
  onSettledRef.current = onSettled;
  targetDiceRef.current = targetDice;

  useEffect(() => {
    modeRef.current = mode;
    triggerTransitionRef.current?.(mode);
  }, [mode, targetDice]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 340;
    const height = 250;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 60);
    camera.position.set(0, 6.2, 5.4);
    camera.lookAt(0, 0.35, 0.05);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xfff8e7, 0x102a1d, 0.9);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff4d6, 1.9);
    dirLight.position.set(4.5, 9.5, 4.0);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 22;
    const dCam = 4.2;
    dirLight.shadow.camera.left = -dCam;
    dirLight.shadow.camera.right = dCam;
    dirLight.shadow.camera.top = dCam;
    dirLight.shadow.camera.bottom = -dCam;
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

    const bowlGroup = new THREE.Group();
    scene.add(bowlGroup);

    const outerPoints: THREE.Vector2[] = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(1.15, 0.0),
      new THREE.Vector2(1.22, 0.14),
      new THREE.Vector2(1.65, 0.38),
      new THREE.Vector2(2.22, 0.95),
      new THREE.Vector2(2.55, 1.62),
      new THREE.Vector2(2.46, 1.68),
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
      innerPoints.push(new THREE.Vector2(r, bowlSurfaceY(r)));
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
    rimMesh.position.y = 1.65;
    rimMesh.castShadow = true;
    bowlGroup.add(rimMesh);

    const faceOrder = [3, 4, 1, 6, 2, 5];
    const dieMaterials = faceOrder.map(
      (v) =>
        new THREE.MeshStandardMaterial({
          map: createDieFaceTexture(v),
          roughness: 0.22,
          metalness: 0.05,
        })
    );
    const dieGeo = new THREE.BoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE);

    const soundSynth = new DiceSoundSynth();

    const diceBodies: SimDie[] = REST_POSITIONS.map(([rx, rz], idx) => {
      const mesh = new THREE.Mesh(dieGeo, dieMaterials);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const y = bowlSurfaceY(Math.hypot(rx, rz)) + DIE_HALF;
      mesh.position.set(rx, y, rz);
      const q = targetQuaternionForFace(idx + 1, idx * 0.4 - 0.3);
      mesh.quaternion.copy(q);
      bowlGroup.add(mesh);

      return {
        mesh,
        pos: new THREE.Vector3(rx, y, rz),
        vel: new THREE.Vector3(),
        omega: new THREE.Vector3(),
        startQuat: q.clone(),
        targetQuat: q.clone(),
        startPos: new THREE.Vector3(rx, y, rz),
        targetPos: new THREE.Vector3(rx, y, rz),
        settledSoundPlayed: false,
      };
    });

    triggerTransitionRef.current = (nextMode: BowlSimMode) => {
      if (nextMode === 'shaking') {
        settledFiredRef.current = false;
        for (const d of diceBodies) {
          d.vel.set(
            (Math.random() - 0.5) * 9.5,
            3.5 + Math.random() * 4.0,
            (Math.random() - 0.5) * 9.5
          );
          d.omega.set(
            (Math.random() - 0.5) * 18,
            (Math.random() - 0.5) * 18,
            (Math.random() - 0.5) * 18
          );
        }
        if (soundEnabledRef.current) soundSynth.playClack(0.8);
      } else if (nextMode === 'settling') {
        settleStartRef.current = performance.now();
        settledFiredRef.current = false;
        const vals = targetDiceRef.current;

        const baseAngle = Math.random() * Math.PI * 2;
        diceBodies.forEach((d, idx) => {
          const a = baseAngle + (idx * Math.PI * 2) / 3 + (Math.random() - 0.5) * 0.28;
          const dist = 0.62 + Math.random() * 0.25;
          const tx = Math.cos(a) * dist;
          const tz = Math.sin(a) * dist;
          const ty = bowlSurfaceY(Math.hypot(tx, tz)) + DIE_HALF;

          d.startPos.copy(d.pos);
          d.targetPos.set(tx, ty, tz);
          d.startQuat.copy(d.mesh.quaternion);
          d.targetQuat.copy(targetQuaternionForFace(vals[idx], (Math.random() - 0.5) * Math.PI * 1.4));
          d.settledSoundPlayed = false;
        });
      }
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
    const tmpQuat = new THREE.Quaternion();
    const tmpAxis = new THREE.Vector3();

    const animate = (now: number) => {
      const dt = Math.min(0.032, (now - lastTime) / 1000);
      lastTime = now;
      const curMode = modeRef.current;

      if (curMode === 'shaking') {
        const t = now / 1000;
        bowlGroup.position.x = Math.sin(t * 21) * 0.34;
        bowlGroup.position.z = Math.cos(t * 17) * 0.22;
        bowlGroup.position.y = Math.abs(Math.sin(t * 21)) * 0.1;
        bowlGroup.rotation.z = -Math.sin(t * 21) * 0.14;
        bowlGroup.rotation.x = Math.cos(t * 17) * 0.11;

        for (const d of diceBodies) {
          d.vel.y -= 28 * dt;
          d.vel.x += Math.cos(t * 21) * 18 * dt + (Math.random() - 0.5) * 14 * dt;
          d.vel.z += Math.sin(t * 17) * 18 * dt + (Math.random() - 0.5) * 14 * dt;

          d.pos.addScaledVector(d.vel, dt);

          let r = Math.hypot(d.pos.x, d.pos.z);
          if (r > BOWL_MAX_R - DIE_HALF) {
            const scale = (BOWL_MAX_R - DIE_HALF) / r;
            d.pos.x *= scale;
            d.pos.z *= scale;
            r = BOWL_MAX_R - DIE_HALF;
          }

          const surfY = bowlSurfaceY(r) + DIE_HALF;
          if (d.pos.y <= surfY) {
            d.pos.y = surfY;
            const n = bowlNormal(d.pos.x, d.pos.z);
            const vn = d.vel.dot(n);
            if (vn < 0) {
              d.vel.addScaledVector(n, -1.72 * vn);
              d.vel.y += 1.6 + Math.random() * 2.2;
              d.omega.set(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 16,
                (Math.random() - 0.5) * 20
              );
              if (soundEnabledRef.current && Math.abs(vn) > 2.2) {
                soundSynth.playClack(Math.min(1, Math.abs(vn) / 10));
              }
            }
          }

          d.vel.x *= 0.988;
          d.vel.z *= 0.988;

          const speed = d.omega.length();
          if (speed > 0.001) {
            tmpAxis.copy(d.omega).divideScalar(speed);
            tmpQuat.setFromAxisAngle(tmpAxis, speed * dt);
            d.mesh.quaternion.premultiply(tmpQuat).normalize();
          }
          d.mesh.position.copy(d.pos);
        }

        for (let i = 0; i < 3; i++) {
          for (let j = i + 1; j < 3; j++) {
            const a = diceBodies[i];
            const b = diceBodies[j];
            const diff = new THREE.Vector3().subVectors(b.pos, a.pos);
            const dist = diff.length();
            const minD = DIE_SIZE * 1.12;
            if (dist < minD && dist > 0.001) {
              const n = diff.divideScalar(dist);
              const overlap = (minD - dist) * 0.5;
              a.pos.addScaledVector(n, -overlap);
              b.pos.addScaledVector(n, overlap);

              const relV = new THREE.Vector3().subVectors(a.vel, b.vel);
              const sep = relV.dot(n);
              if (sep > 0) {
                a.vel.addScaledVector(n, -sep * 0.9);
                b.vel.addScaledVector(n, sep * 0.9);
                if (soundEnabledRef.current && sep > 2.0) {
                  soundSynth.playClack(0.7);
                }
              }
              a.mesh.position.copy(a.pos);
              b.mesh.position.copy(b.pos);
            }
          }
        }
      } else if (curMode === 'settling') {
        bowlGroup.position.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 10));
        bowlGroup.rotation.x *= Math.max(0, 1 - dt * 10);
        bowlGroup.rotation.z *= Math.max(0, 1 - dt * 10);

        const elapsed = now - settleStartRef.current;
        const delays = [0, 190, 380];
        const dur = 680;
        let allDone = true;

        diceBodies.forEach((d, idx) => {
          const localT = Math.max(0, elapsed - delays[idx]);
          const p = Math.min(1, localT / dur);
          if (p < 1) allDone = false;

          const ease = 1 - Math.pow(1 - p, 3);
          d.pos.lerpVectors(d.startPos, d.targetPos, ease);
          const bounce = p < 1 ? Math.abs(Math.sin(p * Math.PI * 2.5)) * (1 - p) * 0.85 : 0;
          const minSurf = bowlSurfaceY(Math.hypot(d.pos.x, d.pos.z)) + DIE_HALF;
          d.pos.y = Math.max(minSurf, d.pos.y) + bounce;

          d.mesh.position.copy(d.pos);
          d.mesh.quaternion.slerpQuaternions(d.startQuat, d.targetQuat, ease);

          if (p >= 0.95 && !d.settledSoundPlayed) {
            d.settledSoundPlayed = true;
            if (soundEnabledRef.current) soundSynth.playClack(0.55);
          }
        });

        if (allDone && !settledFiredRef.current) {
          settledFiredRef.current = true;
          onSettledRef.current?.();
        }
      } else {
        bowlGroup.position.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 8));
        bowlGroup.rotation.x *= Math.max(0, 1 - dt * 8);
        bowlGroup.rotation.z *= Math.max(0, 1 - dt * 8);
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      dieGeo.dispose();
      dieMaterials.forEach((m) => {
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
};
