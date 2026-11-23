import React, { useEffect, useImperativeHandle, useRef } from 'react';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import '../ChinchiroBowl3D.css';

export interface DiceTool3DHandle {
  startShake: () => void;
  stopShake: () => void;
}

interface DiceTool3DProps {
  diceCount: number; // 1..6
  soundEnabled: boolean;
  onSettled: (dice: number[]) => void;
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

const DEFAULT_FACE_VALUES = [3, 4, 1, 6, 2, 5];

const PIP_COORDS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.29, 0.29], [0.71, 0.71]],
  3: [[0.29, 0.29], [0.5, 0.5], [0.71, 0.71]],
  4: [[0.29, 0.29], [0.71, 0.29], [0.29, 0.71], [0.71, 0.71]],
  5: [[0.29, 0.29], [0.71, 0.29], [0.5, 0.5], [0.29, 0.71], [0.71, 0.71]],
  6: [[0.29, 0.27], [0.71, 0.27], [0.29, 0.5], [0.71, 0.5], [0.29, 0.73], [0.71, 0.73]],
};

function getTopFaceInfo(q: CANNON.Quaternion): { value: number; alignment: number } {
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
  return { value: DEFAULT_FACE_VALUES[bestIdx], alignment: bestY };
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

    ctx.beginPath();
    ctx.arc(cx + 1.5, cy + 1.5, radius * 1.06, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
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
  const flatR = 1.32;
  if (r <= flatR) return 0.14;
  const d = r - flatR;
  return 0.14 + d * d * 1.25;
}

function getInitialPositions(count: number): [number, number][] {
  if (count === 1) return [[0, 0]];
  const radius = count <= 3 ? 0.66 : count === 4 ? 0.74 : 0.82;
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(a) * radius, Math.sin(a) * radius];
  });
}

class ToolDiceSound {
  private ctx: AudioContext | null = null;
  private lastPlayed = 0;

  playClack(intensity = 0.5) {
    const nowMs = performance.now();
    if (nowMs - this.lastPlayed < 38) return;
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

export const DiceTool3D = React.forwardRef<DiceTool3DHandle, DiceTool3DProps>(
  ({ diceCount, soundEnabled, onSettled }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const soundEnabledRef = useRef(soundEnabled);
    const onSettledRef = useRef(onSettled);
    soundEnabledRef.current = soundEnabled;
    onSettledRef.current = onSettled;

    const actionsRef = useRef<DiceTool3DHandle | null>(null);
    useImperativeHandle(ref, () => ({
      startShake: () => actionsRef.current?.startShake(),
      stopShake: () => actionsRef.current?.stopShake(),
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const count = Math.max(1, Math.min(6, Math.floor(diceCount)));
      // 個数が多いときは少しコンパクトにして茶碗底へ綺麗に収める
      const dieSize = count <= 3 ? 0.68 : count <= 4 ? 0.62 : 0.56;
      const dieHalf = dieSize / 2;

      const width = container.clientWidth || 340;
      const height = 260;

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

      // 茶碗メッシュ
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

      // cannon-es ワールド構築
      const world = new CANNON.World();
      world.gravity.set(0, -26, 0);
      world.broadphase = new CANNON.NaiveBroadphase();
      (world.solver as CANNON.GSSolver).iterations = 14;
      world.allowSleep = true;

      const bowlMat = new CANNON.Material('bowl');
      const dieMat = new CANNON.Material('die');
      world.addContactMaterial(
        new CANNON.ContactMaterial(bowlMat, dieMat, {
          friction: 0.3,
          restitution: 0.14,
          contactEquationStiffness: 1e7,
          contactEquationRelaxation: 4,
        })
      );
      world.addContactMaterial(
        new CANNON.ContactMaterial(dieMat, dieMat, {
          friction: 0.2,
          restitution: 0.18,
          contactEquationStiffness: 1e7,
          contactEquationRelaxation: 4,
        })
      );

      const bowlBody = new CANNON.Body({
        type: CANNON.Body.KINEMATIC,
        material: bowlMat,
        position: new CANNON.Vec3(0, 0, 0),
      });
      // 継ぎ目のない1枚のフラット底面（上面が y = 0.14）
      bowlBody.addShape(new CANNON.Box(new CANNON.Vec3(2.6, 0.14, 2.6)), new CANNON.Vec3(0, 0, 0));

      const segments = 16;
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const qYaw = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle);
        bowlBody.addShape(
          new CANNON.Box(new CANNON.Vec3(0.14, 0.95, 0.64)),
          new CANNON.Vec3(Math.cos(angle) * 2.08, 0.85, Math.sin(angle) * 2.08),
          qYaw.mult(new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -0.48))
        );
        bowlBody.addShape(
          new CANNON.Box(new CANNON.Vec3(0.14, 0.85, 0.68)),
          new CANNON.Vec3(Math.cos(angle) * 2.54, 2.1, Math.sin(angle) * 2.54),
          qYaw
        );
      }
      bowlBody.addShape(new CANNON.Box(new CANNON.Vec3(2.8, 0.15, 2.8)), new CANNON.Vec3(0, 2.95, 0));
      world.addBody(bowlBody);

      // ダイスマテリアル＆角丸ジオメトリ
      const faceMaterials = DEFAULT_FACE_VALUES.map(
        (v) =>
          new THREE.MeshPhysicalMaterial({
            map: createDieFaceTexture(v),
            roughness: 0.2,
            metalness: 0.02,
            clearcoat: 0.65,
            clearcoatRoughness: 0.14,
          })
      );
      const dieGeo = createRoundedDieGeometry(dieSize);
      const dieShape = new CANNON.Box(new CANNON.Vec3(dieHalf, dieHalf, dieHalf));
      const soundSynth = new ToolDiceSound();

      const positions = getInitialPositions(count);
      const dieBodies = positions.map(([x, z]) => {
        const body = new CANNON.Body({
          mass: 1,
          material: dieMat,
          shape: dieShape,
          position: new CANNON.Vec3(x, 0.14 + dieHalf + 0.01, z),
          linearDamping: 0.24,
          angularDamping: 0.3,
          allowSleep: true,
          sleepSpeedLimit: 0.05,
          sleepTimeLimit: 10,
        });
        body.sleep();
        body.addEventListener('collide', (ev: { contact: CANNON.ContactEquation }) => {
          if (!soundEnabledRef.current) return;
          const impact = Math.abs(ev.contact.getImpactVelocityAlongNormal());
          if (impact > 1.4) soundSynth.playClack(Math.min(1, impact / 11));
        });
        world.addBody(body);
        return body;
      });

      const dieMeshes = dieBodies.map(() => {
        const mesh = new THREE.Mesh(dieGeo, faceMaterials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        return mesh;
      });

      let simState: 'idle' | 'shaking' | 'settling' = 'idle';
      let shakeTime = 0;
      let stillFrames = 0;
      let settleFrames = 0;
      let bowlX = 0;
      let bowlY = 0;
      let bowlZ = 0;
      let bowlRx = 0;
      let bowlRz = 0;

      actionsRef.current = {
        startShake: () => {
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
        stopShake: () => {
          if (simState !== 'shaking') return;
          simState = 'settling';
          stillFrames = 0;
          settleFrames = 0;
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

          if (simState === 'idle') {
            continue;
          }

          if (simState === 'shaking') {
            shakeTime += FIXED_DT;
            const nextBx = Math.sin(shakeTime * 18) * 0.4;
            const nextBz = Math.cos(shakeTime * 14) * 0.25;
            const nextBy = Math.abs(Math.sin(shakeTime * 18)) * 0.09;
            const nextRz = -Math.sin(shakeTime * 18) * 0.15;
            const nextRx = Math.cos(shakeTime * 14) * 0.11;

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

            for (const b of dieBodies) {
              if (b.position.y < 0.72 && b.velocity.length() < 3.6) {
                b.velocity.y += 2.3;
                b.angularVelocity.x += (Math.random() - 0.5) * 9;
                b.angularVelocity.z += (Math.random() - 0.5) * 9;
              }
            }
          } else {
            const nextBx = Math.abs(bowlX) < 0.002 ? 0 : bowlX * 0.56;
            const nextBy = Math.abs(bowlY) < 0.002 ? 0 : bowlY * 0.56;
            const nextBz = Math.abs(bowlZ) < 0.002 ? 0 : bowlZ * 0.56;
            const nextRx = Math.abs(bowlRx) < 0.002 ? 0 : bowlRx * 0.56;
            const nextRz = Math.abs(bowlRz) < 0.002 ? 0 : bowlRz * 0.56;

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

          if (simState === 'settling') {
            settleFrames++;
            const bowlSettled = bowlX === 0 && bowlY === 0 && bowlZ === 0 && bowlRx === 0 && bowlRz === 0;

            // 平らに着地したダイスを微振動（ガタガタ）させず滑らかにスリープへ収束させる
            if (bowlSettled) {
              for (const b of dieBodies) {
                if (b.sleepState === CANNON.Body.SLEEPING) continue;
                const v = b.velocity.length();
                const w = b.angularVelocity.length();
                const align = getTopFaceInfo(b.quaternion).alignment;
                const onFloor = b.position.y < 0.14 + dieHalf + 0.08;
                if (onFloor && align > 0.94 && v < 1.2 && w < 2.2) {
                  b.velocity.scale(0.68, b.velocity);
                  b.angularVelocity.scale(0.6, b.angularVelocity);
                  if (v < 0.35 && w < 0.65) {
                    b.velocity.set(0, 0, 0);
                    b.angularVelocity.set(0, 0, 0);
                    b.sleep();
                  }
                } else if (
                  (!onFloor || align <= 0.94) &&
                  v < 0.55 &&
                  w < 1.3 &&
                  settleFrames > 14 &&
                  settleFrames < 140 &&
                  settleFrames % 10 === 0
                ) {
                  const r = Math.hypot(b.position.x, b.position.z);
                  b.velocity.y = Math.max(b.velocity.y, 1.4);
                  if (r > 0.25) {
                    b.velocity.x += (-b.position.x / r) * 1.6;
                    b.velocity.z += (-b.position.z / r) * 1.6;
                  } else {
                    b.velocity.x += (Math.random() - 0.5) * 1.8;
                    b.velocity.z += (Math.random() - 0.5) * 1.8;
                  }
                  b.angularVelocity.x += (Math.random() - 0.5) * 3.2;
                }
              }
            }

            const allStill =
              bowlSettled &&
              dieBodies.every(
                (b) =>
                  b.sleepState === CANNON.Body.SLEEPING ||
                  (b.velocity.length() < 0.3 &&
                    b.angularVelocity.length() < 0.5 &&
                    getTopFaceInfo(b.quaternion).alignment > 0.94)
              );

            if (allStill) {
              stillFrames++;
            } else {
              stillFrames = 0;
            }

            if (stillFrames >= 3 || settleFrames >= 150) {
              simState = 'idle';
              for (const b of dieBodies) {
                b.velocity.set(0, 0, 0);
                b.angularVelocity.set(0, 0, 0);
                b.sleep();
              }
              const results = dieBodies.map((b) => getTopFaceInfo(b.quaternion).value);
              onSettledRef.current(results);
            }
          }
        }

        bowlGroup.position.set(bowlBody.position.x, bowlBody.position.y, bowlBody.position.z);
        bowlGroup.quaternion.set(
          bowlBody.quaternion.x,
          bowlBody.quaternion.y,
          bowlBody.quaternion.z,
          bowlBody.quaternion.w
        );
        for (let i = 0; i < dieBodies.length; i++) {
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
        faceMaterials.forEach((m) => {
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
    }, [diceCount]);

    return <div ref={containerRef} className="chinchiro-canvas-host" />;
  }
);
