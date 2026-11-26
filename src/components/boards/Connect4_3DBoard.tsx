import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  ArrowDownToLine,
  Check,
  Compass,
  Eye,
  Layers,
  Move3d,
  RotateCcw,
} from 'lucide-react';
import {
  C4_3D_SIZE,
  findLowestEmptyZ,
  type Connect4_3DCell,
  type Connect4_3DClientState,
  type Connect4_3DCoord,
} from '../../games/connect4_3d';
import './Connect4_3DBoard.css';

interface Connect4_3DBoardProps {
  state: Connect4_3DClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

const COL_LABELS = ['A', 'B', 'C', 'D'] as const;
const ROW_LABELS = ['1', '2', '3', '4'] as const;
const FLOOR_NAMES = ['1F', '2F', '3F', '4F'] as const;

// 3D layout constants
const CELL_SPACING = 1.12;
const BASE_SIZE = 5.2;
const BASE_HEIGHT = 0.42;
const SPHERE_RADIUS = 0.365;
const LEVEL_BASE_Y = 0.41;
const LEVEL_SPACING = 0.78;
const POLE_HEIGHT = 3.24;
const ORBIT_TARGET_Y = 1.48;

const DEFAULT_AZIMUTH = (36 * Math.PI) / 180;
const DEFAULT_ELEVATION = (31 * Math.PI) / 180;
const TOPDOWN_ELEVATION = (75 * Math.PI) / 180;
const MIN_ELEVATION = (15 * Math.PI) / 180;
const MAX_ELEVATION = (78 * Math.PI) / 180;

const TAP_MAX_DISTANCE_PX = 8;
const DROP_DURATION_MS = 260;

function gridToXZ(row: number, col: number): { x: number; z3d: number } {
  return {
    x: (col - 1.5) * CELL_SPACING,
    z3d: (row - 1.5) * CELL_SPACING,
  };
}

function levelToY(z: number): number {
  return LEVEL_BASE_Y + z * LEVEL_SPACING;
}

function coordToWorld(coord: Connect4_3DCoord): THREE.Vector3 {
  const { x, z3d } = gridToXZ(coord.row, coord.col);
  return new THREE.Vector3(x, levelToY(coord.z), z3d);
}

function formatCoord(coord: Connect4_3DCoord): string {
  return `${FLOOR_NAMES[coord.z]}-${COL_LABELS[coord.col]}${ROW_LABELS[coord.row]}`;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function easeOutDrop(t: number): number {
  if (t >= 1) return 1;
  // Crisp fall with a tiny tactile settle at the bottom
  if (t < 0.8) {
    const u = t / 0.8;
    return u * u;
  }
  const u = (t - 0.8) / 0.2;
  return 1 - Math.sin(u * Math.PI) * 0.045;
}

function createWalnutSideTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
  baseGrad.addColorStop(0, '#5a3622');
  baseGrad.addColorStop(0.5, '#462818');
  baseGrad.addColorStop(1, '#331c10');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle horizontal wood grain streaks
  for (let i = 0; i < 90; i++) {
    const y = (i / 90) * h;
    const alpha = 0.04 + (i % 5) * 0.015;
    ctx.strokeStyle = i % 2 === 0 ? `rgba(28, 12, 5, ${alpha})` : `rgba(145, 92, 55, ${alpha * 0.7})`;
    ctx.lineWidth = 1 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) {
      const wave = Math.sin(x * 0.018 + i * 0.7) * 2.4;
      ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createWalnutTopTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Rich walnut wood base
  const grad = ctx.createRadialGradient(
    size * 0.45,
    size * 0.42,
    size * 0.05,
    size * 0.5,
    size * 0.5,
    size * 0.72
  );
  grad.addColorStop(0, '#6a4027');
  grad.addColorStop(0.6, '#502e1b');
  grad.addColorStop(1, '#3b2012');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Organic wood grain lines
  for (let i = 0; i < 160; i++) {
    const y = (i / 160) * size;
    const alpha = 0.035 + (i % 7) * 0.01;
    ctx.strokeStyle =
      i % 3 === 0 ? `rgba(22, 10, 4, ${alpha})` : `rgba(165, 110, 68, ${alpha * 0.65})`;
    ctx.lineWidth = 1.2 + (i % 3) * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 48) {
      const wave = Math.sin(x * 0.01 + i * 0.35) * 5.5 + Math.cos(x * 0.024 - i * 0.2) * 2;
      ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  const worldToPx = (val: number) => ((val + BASE_SIZE / 2) / BASE_SIZE) * size;
  const halfGrid = CELL_SPACING * 2;
  const gridMin = worldToPx(-halfGrid);
  const gridMax = worldToPx(halfGrid);
  const gridSpan = gridMax - gridMin;

  // Outer inlaid brass border around the 4x4 playfield
  ctx.strokeStyle = 'rgba(232, 194, 122, 0.38)';
  ctx.lineWidth = 3;
  ctx.strokeRect(gridMin, gridMin, gridSpan, gridSpan);

  // Subtle 4x4 dividing lines
  ctx.strokeStyle = 'rgba(232, 194, 122, 0.22)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    const pos = worldToPx((i - 2) * CELL_SPACING);
    ctx.beginPath();
    ctx.moveTo(pos, gridMin);
    ctx.lineTo(pos, gridMax);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(gridMin, pos);
    ctx.lineTo(gridMax, pos);
    ctx.stroke();
  }

  // Subtle recessed seat circle at each of the 16 pole bases
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const { x, z3d } = gridToXZ(r, c);
      const px = worldToPx(x);
      const py = worldToPx(z3d);
      ctx.beginPath();
      ctx.arc(px, py, 34, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20, 10, 4, 0.22)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(232, 194, 122, 0.24)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Crisp A-D and 1-4 markings on all 4 margins so every orbit angle is legible
  ctx.fillStyle = 'rgba(246, 224, 174, 0.88)';
  ctx.font = '800 34px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const marginNear = gridMin * 0.52;
  const marginFar = size - gridMin * 0.52;

  for (let c = 0; c < 4; c++) {
    const px = worldToPx((c - 1.5) * CELL_SPACING);
    ctx.fillText(COL_LABELS[c], px, marginFar);
    ctx.fillText(COL_LABELS[c], px, marginNear);
  }
  for (let r = 0; r < 4; r++) {
    const py = worldToPx((r - 1.5) * CELL_SPACING);
    ctx.fillText(ROW_LABELS[r], marginNear, py);
    ctx.fillText(ROW_LABELS[r], marginFar, py);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface DropAnim {
  startTime: number;
  fromY: number;
  toY: number;
}

interface SceneHandles {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  pieceMeshes: THREE.Mesh[][][];
  matP0: THREE.MeshPhysicalMaterial;
  matP1: THREE.MeshPhysicalMaterial;
  matP0Win: THREE.MeshPhysicalMaterial;
  matP1Win: THREE.MeshPhysicalMaterial;
  ghostMesh: THREE.Mesh;
  ghostMat: THREE.MeshPhysicalMaterial;
  ghostRing: THREE.Mesh;
  ghostRingMat: THREE.MeshBasicMaterial;
  poleHighlightRings: THREE.Mesh[][];
  lastMoveRing: THREE.Mesh;
  lastMoveRingMat: THREE.MeshBasicMaterial;
  winBeamGroup: THREE.Group;
  winBeamCore: THREE.Mesh;
  winBeamHalo: THREE.Mesh;
  winBeamHaloMat: THREE.MeshBasicMaterial;
  gravityColliders: THREE.Mesh[];
  freeColliders: THREE.Mesh[];
  freeGuideRings: THREE.Mesh[];
  freeFloorFrame: THREE.LineSegments;
  // Camera orbit state
  azimuth: number;
  elevation: number;
  velAzimuth: number;
  velElevation: number;
  tweenTarget: { azimuth: number; elevation: number } | null;
}

export const Connect4_3DBoard: React.FC<Connect4_3DBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const current = state.players[state.turnIndex];
  const isMyTurn =
    state.phase === 'playing' &&
    (isLocalPassAndPlay ? !current.isBot : current.id === state.myId);
  const winner = state.players.find((p) => p.id === state.winnerId);

  const [pendingCoord, setPendingCoord] = useState<Connect4_3DCoord | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number>(0);
  const [isTopDown, setIsTopDown] = useState<boolean>(false);
  const [isDraggingUI, setIsDraggingUI] = useState<boolean>(false);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneHandles | null>(null);
  const prevBoardRef = useRef<Connect4_3DCell[][][] | null>(null);
  const dropAnimsRef = useRef<Map<string, DropAnim>>(new Map());

  // Latest state refs for Three.js pointer callbacks
  const stateRef = useRef(state);
  const isMyTurnRef = useRef(isMyTurn);
  const pendingRef = useRef<Connect4_3DCoord | null>(pendingCoord);
  const selectedFloorRef = useRef<number>(selectedFloor);
  const onActionRef = useRef(onAction);

  stateRef.current = state;
  isMyTurnRef.current = isMyTurn;
  pendingRef.current = pendingCoord;
  selectedFloorRef.current = selectedFloor;
  onActionRef.current = onAction;

  const floorCounts = useMemo(() => {
    return state.board.map((layer) => {
      let n = 0;
      for (const row of layer) {
        for (const cell of row) {
          if (cell !== 0) n++;
        }
      }
      return n;
    });
  }, [state.board]);

  // Clear pending selection whenever the turn, move count, or phase changes
  useEffect(() => {
    setPendingCoord(null);
  }, [state.moveCount, state.turnIndex, state.phase, isMyTurn]);

  const confirmPlacement = useCallback(() => {
    if (!isMyTurn || !pendingCoord) return;
    onAction({
      type: 'place',
      payload: { z: pendingCoord.z, row: pendingCoord.row, col: pendingCoord.col },
    });
    setPendingCoord(null);
  }, [isMyTurn, pendingCoord, onAction]);

  const handleResetView = useCallback(() => {
    const handles = sceneRef.current;
    if (!handles) return;
    handles.velAzimuth = 0;
    handles.velElevation = 0;
    // Pick nearest equivalent azimuth to DEFAULT_AZIMUTH to avoid multi-spin
    const twoPi = Math.PI * 2;
    const diff =
      ((((DEFAULT_AZIMUTH - handles.azimuth) % twoPi) + twoPi + Math.PI) % twoPi) - Math.PI;
    handles.tweenTarget = {
      azimuth: handles.azimuth + diff,
      elevation: DEFAULT_ELEVATION,
    };
    setIsTopDown(false);
  }, []);

  const handleToggleTopDown = useCallback(() => {
    const handles = sceneRef.current;
    if (!handles) return;
    handles.velAzimuth = 0;
    handles.velElevation = 0;
    const nextTopDown = !isTopDown;
    handles.tweenTarget = {
      azimuth: handles.azimuth,
      elevation: nextTopDown ? TOPDOWN_ELEVATION : DEFAULT_ELEVATION,
    };
    setIsTopDown(nextTopDown);
  }, [isTopDown]);

  const handleSelectFloor = useCallback((z: number) => {
    setSelectedFloor(z);
    setPendingCoord(null);
  }, []);

  // Initialize Three.js scene once
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = Math.max(host.clientWidth, 280);
    const height = Math.max(host.clientHeight, 280);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 80);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    // Track disposable resources
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      materials.push(m);
      return m;
    };
    const trackTex = <T extends THREE.Texture>(t: T): T => {
      textures.push(t);
      return t;
    };

    // Lighting setup: warm key + cool rim + hemisphere ambient
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x3b2314, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.9);
    keyLight.position.set(5.5, 10.5, 6.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 24;
    const d = 4.2;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0008;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.95);
    rimLight.position.set(-6.5, 5.5, -5.5);
    scene.add(rimLight);

    const warmFill = new THREE.PointLight(0xfbbf24, 0.55, 16);
    warmFill.position.set(-4.0, 2.5, 5.0);
    scene.add(warmFill);

    // Subtle ground shadow catcher beneath the walnut base
    const shadowCatcherGeo = trackGeo(new THREE.PlaneGeometry(14, 14));
    const shadowCatcherMat = trackMat(
      new THREE.ShadowMaterial({
        opacity: 0.32,
      })
    );
    const shadowCatcher = new THREE.Mesh(shadowCatcherGeo, shadowCatcherMat);
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = -BASE_HEIGHT - 0.01;
    shadowCatcher.receiveShadow = true;
    scene.add(shadowCatcher);

    // Walnut wooden pedestal base
    const walnutSideTex = trackTex(createWalnutSideTexture());
    walnutSideTex.anisotropy = maxAnisotropy;
    const walnutTopTex = trackTex(createWalnutTopTexture());
    walnutTopTex.anisotropy = maxAnisotropy;

    const baseGeo = trackGeo(new RoundedBoxGeometry(BASE_SIZE, BASE_HEIGHT, BASE_SIZE, 4, 0.09));
    const baseMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: walnutSideTex,
        roughness: 0.48,
        metalness: 0.08,
      })
    );
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -BASE_HEIGHT / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    scene.add(baseMesh);

    // Flat walnut top plate with crisp grid & A-D / 1-4 markings
    const topPlateSize = BASE_SIZE - 0.14;
    const topPlateGeo = trackGeo(new THREE.PlaneGeometry(topPlateSize, topPlateSize));
    const topPlateMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: walnutTopTex,
        roughness: 0.42,
        metalness: 0.06,
      })
    );
    const topPlate = new THREE.Mesh(topPlateGeo, topPlateMat);
    topPlate.rotation.x = -Math.PI / 2;
    topPlate.position.y = 0.002;
    topPlate.receiveShadow = true;
    scene.add(topPlate);

    // Brass decorative rim around base bottom
    const trimGeo = trackGeo(
      new RoundedBoxGeometry(BASE_SIZE + 0.06, 0.06, BASE_SIZE + 0.06, 3, 0.025)
    );
    const brassMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd8b162,
        roughness: 0.25,
        metalness: 0.86,
      })
    );
    const trimMesh = new THREE.Mesh(trimGeo, brassMat);
    trimMesh.position.y = -BASE_HEIGHT + 0.03;
    trimMesh.receiveShadow = true;
    scene.add(trimMesh);

    // 16 Brass poles + base collars + rounded caps + pole selection rings
    const poleGeo = trackGeo(new THREE.CylinderGeometry(0.062, 0.068, POLE_HEIGHT, 18));
    const collarGeo = trackGeo(new THREE.CylinderGeometry(0.135, 0.165, 0.06, 20));
    const capGeo = trackGeo(new THREE.SphereGeometry(0.064, 14, 10));
    const poleHighlightGeo = trackGeo(new THREE.TorusGeometry(0.24, 0.028, 12, 28));
    const poleHighlightMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.9,
      })
    );

    const poleHighlightRings: THREE.Mesh[][] = [];
    const gravityColliderGeo = trackGeo(
      new THREE.CylinderGeometry(0.42, 0.42, POLE_HEIGHT + 0.28, 12)
    );
    const colliderMat = trackMat(
      new THREE.MeshBasicMaterial({
        visible: false,
      })
    );
    const gravityColliders: THREE.Mesh[] = [];

    for (let r = 0; r < C4_3D_SIZE; r++) {
      const rowRings: THREE.Mesh[] = [];
      for (let c = 0; c < C4_3D_SIZE; c++) {
        const { x, z3d } = gridToXZ(r, c);

        const pole = new THREE.Mesh(poleGeo, brassMat);
        pole.position.set(x, POLE_HEIGHT / 2, z3d);
        pole.castShadow = true;
        pole.receiveShadow = true;
        scene.add(pole);

        const collar = new THREE.Mesh(collarGeo, brassMat);
        collar.position.set(x, 0.03, z3d);
        collar.receiveShadow = true;
        scene.add(collar);

        const cap = new THREE.Mesh(capGeo, brassMat);
        cap.position.set(x, POLE_HEIGHT, z3d);
        scene.add(cap);

        const hlRing = new THREE.Mesh(poleHighlightGeo, poleHighlightMat);
        hlRing.rotation.x = Math.PI / 2;
        hlRing.position.set(x, 0.016, z3d);
        hlRing.visible = false;
        scene.add(hlRing);
        rowRings.push(hlRing);

        const collider = new THREE.Mesh(gravityColliderGeo, colliderMat);
        collider.position.set(x, (POLE_HEIGHT + 0.28) / 2, z3d);
        collider.userData = { row: r, col: c };
        scene.add(collider);
        gravityColliders.push(collider);
      }
      poleHighlightRings.push(rowRings);
    }

    // Free-mode floor guide rings, colliders, and subtle floor frame
    const freeGuideGeo = trackGeo(new THREE.TorusGeometry(0.26, 0.022, 10, 28));
    const freeGuideMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.45,
      })
    );
    const freeColliderGeo = trackGeo(new THREE.SphereGeometry(0.43, 12, 10));
    const freeGuideRings: THREE.Mesh[] = [];
    const freeColliders: THREE.Mesh[] = [];

    for (let r = 0; r < C4_3D_SIZE; r++) {
      for (let c = 0; c < C4_3D_SIZE; c++) {
        const { x, z3d } = gridToXZ(r, c);
        const guide = new THREE.Mesh(freeGuideGeo, freeGuideMat);
        guide.rotation.x = Math.PI / 2;
        guide.position.set(x, levelToY(0), z3d);
        guide.visible = false;
        scene.add(guide);
        freeGuideRings.push(guide);

        const colMesh = new THREE.Mesh(freeColliderGeo, colliderMat);
        colMesh.position.set(x, levelToY(0), z3d);
        colMesh.userData = { row: r, col: c };
        scene.add(colMesh);
        freeColliders.push(colMesh);
      }
    }

    const frameHalf = CELL_SPACING * 2 + 0.08;
    const framePts = [
      new THREE.Vector3(-frameHalf, 0, -frameHalf),
      new THREE.Vector3(frameHalf, 0, -frameHalf),
      new THREE.Vector3(frameHalf, 0, -frameHalf),
      new THREE.Vector3(frameHalf, 0, frameHalf),
      new THREE.Vector3(frameHalf, 0, frameHalf),
      new THREE.Vector3(-frameHalf, 0, frameHalf),
      new THREE.Vector3(-frameHalf, 0, frameHalf),
      new THREE.Vector3(-frameHalf, 0, -frameHalf),
    ];
    const freeFloorFrameGeo = trackGeo(new THREE.BufferGeometry().setFromPoints(framePts));
    const freeFloorFrameMat = trackMat(
      new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.42,
      })
    );
    const freeFloorFrame = new THREE.LineSegments(freeFloorFrameGeo, freeFloorFrameMat);
    freeFloorFrame.visible = false;
    scene.add(freeFloorFrame);

    // 64 Piece spheres (4x4x4 pool)
    const sphereGeo = trackGeo(new THREE.SphereGeometry(SPHERE_RADIUS, 32, 24));

    const matP0 = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xf59e0b,
        emissive: 0x5c2604,
        emissiveIntensity: 0.22,
        roughness: 0.16,
        metalness: 0.16,
        clearcoat: 0.92,
        clearcoatRoughness: 0.1,
      })
    );
    const matP1 = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x0ea5e9,
        emissive: 0x083358,
        emissiveIntensity: 0.24,
        roughness: 0.15,
        metalness: 0.16,
        clearcoat: 0.92,
        clearcoatRoughness: 0.1,
      })
    );
    const matP0Win = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xfde047,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.95,
        roughness: 0.12,
        metalness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      })
    );
    const matP1Win = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x7dd3fc,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.95,
        roughness: 0.12,
        metalness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      })
    );

    const pieceMeshes: THREE.Mesh[][][] = [];
    for (let z = 0; z < C4_3D_SIZE; z++) {
      const layer: THREE.Mesh[][] = [];
      for (let r = 0; r < C4_3D_SIZE; r++) {
        const rowArr: THREE.Mesh[] = [];
        for (let c = 0; c < C4_3D_SIZE; c++) {
          const mesh = new THREE.Mesh(sphereGeo, matP0);
          const pos = coordToWorld({ z, row: r, col: c });
          mesh.position.copy(pos);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.visible = false;
          scene.add(mesh);
          rowArr.push(mesh);
        }
        layer.push(rowArr);
      }
      pieceMeshes.push(layer);
    }

    // Ghost preview sphere + equator ring
    const ghostMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.45,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
      })
    );
    const ghostMesh = new THREE.Mesh(sphereGeo, ghostMat);
    ghostMesh.visible = false;
    scene.add(ghostMesh);

    const ghostRingGeo = trackGeo(new THREE.TorusGeometry(SPHERE_RADIUS + 0.09, 0.025, 12, 32));
    const ghostRingMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.85,
      })
    );
    const ghostRing = new THREE.Mesh(ghostRingGeo, ghostRingMat);
    ghostRing.rotation.x = Math.PI / 2;
    ghostRing.visible = false;
    scene.add(ghostRing);

    // Last move subtle glow ring
    const lastMoveRingGeo = trackGeo(
      new THREE.TorusGeometry(SPHERE_RADIUS + 0.075, 0.024, 12, 36)
    );
    const lastMoveRingMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.8,
      })
    );
    const lastMoveRing = new THREE.Mesh(lastMoveRingGeo, lastMoveRingMat);
    lastMoveRing.rotation.x = Math.PI / 2;
    lastMoveRing.visible = false;
    scene.add(lastMoveRing);

    // Winning 4-in-a-row golden 3D light beam (core + additive halo)
    const winBeamGroup = new THREE.Group();
    winBeamGroup.visible = false;
    const winBeamCoreGeo = trackGeo(new THREE.CylinderGeometry(0.058, 0.058, 1, 18));
    const winBeamCoreMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xfff7c2,
      })
    );
    const winBeamCore = new THREE.Mesh(winBeamCoreGeo, winBeamCoreMat);
    winBeamGroup.add(winBeamCore);

    const winBeamHaloGeo = trackGeo(new THREE.CylinderGeometry(0.135, 0.135, 1, 18));
    const winBeamHaloMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const winBeamHalo = new THREE.Mesh(winBeamHaloGeo, winBeamHaloMat);
    winBeamGroup.add(winBeamHalo);
    scene.add(winBeamGroup);

    const handles: SceneHandles = {
      renderer,
      camera,
      pieceMeshes,
      matP0,
      matP1,
      matP0Win,
      matP1Win,
      ghostMesh,
      ghostMat,
      ghostRing,
      ghostRingMat,
      poleHighlightRings,
      lastMoveRing,
      lastMoveRingMat,
      winBeamGroup,
      winBeamCore,
      winBeamHalo,
      winBeamHaloMat,
      gravityColliders,
      freeColliders,
      freeGuideRings,
      freeFloorFrame,
      azimuth: DEFAULT_AZIMUTH,
      elevation: DEFAULT_ELEVATION,
      velAzimuth: 0,
      velElevation: 0,
      tweenTarget: null,
    };
    sceneRef.current = handles;

    const updateCameraPosition = () => {
      const aspect = camera.aspect || 1;
      // Slightly further back on tall narrow mobile screens so the 4x4x4 cube fits comfortably
      const radius = aspect < 0.85 ? 11.1 : aspect < 1.05 ? 10.2 : 9.4;
      const cosEl = Math.cos(handles.elevation);
      const sinEl = Math.sin(handles.elevation);
      camera.position.set(
        radius * cosEl * Math.sin(handles.azimuth),
        ORBIT_TARGET_Y + radius * sinEl,
        radius * cosEl * Math.cos(handles.azimuth)
      );
      camera.lookAt(0, ORBIT_TARGET_Y, 0);
    };
    updateCameraPosition();

    // Pointer interaction: 1-finger 360° orbit + <8px tap selection
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    let activePointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let maxMovePx = 0;

    const handlePointerDown = (e: PointerEvent) => {
      if (activePointerId !== null) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      activePointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      maxMovePx = 0;
      handles.tweenTarget = null;
      handles.velAzimuth = 0;
      handles.velElevation = 0;
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failures on synthetic events
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const distFromStart = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (distFromStart > maxMovePx) {
        maxMovePx = distFromStart;
      }

      if (maxMovePx >= 4) {
        setIsDraggingUI(true);
        const dAz = -dx * 0.0082;
        const dEl = dy * 0.0068;
        handles.azimuth += dAz;
        handles.elevation = clamp(handles.elevation + dEl, MIN_ELEVATION, MAX_ELEVATION);
        handles.velAzimuth = dAz;
        handles.velElevation = dEl;
        if (handles.elevation < TOPDOWN_ELEVATION - 0.25) {
          setIsTopDown(false);
        }
      }

      lastX = e.clientX;
      lastY = e.clientY;
    };

    const performTapRaycast = (clientX: number, clientY: number) => {
      if (!isMyTurnRef.current) return;
      const curState = stateRef.current;
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);

      let chosen: Connect4_3DCoord | null = null;

      if (curState.rules.gravityMode) {
        const hits = raycaster.intersectObjects(handles.gravityColliders, false);
        for (const hit of hits) {
          const { row, col } = hit.object.userData as { row: number; col: number };
          const nextZ = findLowestEmptyZ(curState.board, row, col);
          if (nextZ >= 0) {
            chosen = { z: nextZ, row, col };
            break;
          }
        }
      } else {
        const floorZ = selectedFloorRef.current;
        const hits = raycaster.intersectObjects(handles.freeColliders, false);
        for (const hit of hits) {
          const { row, col } = hit.object.userData as { row: number; col: number };
          if (curState.board[floorZ][row][col] === 0) {
            chosen = { z: floorZ, row, col };
            break;
          }
        }
      }

      if (!chosen) return;

      const prev = pendingRef.current;
      if (
        prev &&
        prev.z === chosen.z &&
        prev.row === chosen.row &&
        prev.col === chosen.col
      ) {
        onActionRef.current({
          type: 'place',
          payload: { z: chosen.z, row: chosen.row, col: chosen.col },
        });
        setPendingCoord(null);
      } else {
        setPendingCoord(chosen);
      }
    };

    const finishPointer = (e: PointerEvent, allowTap: boolean) => {
      if (e.pointerId !== activePointerId) return;
      activePointerId = null;
      setIsDraggingUI(false);
      try {
        if (renderer.domElement.hasPointerCapture(e.pointerId)) {
          renderer.domElement.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      if (allowTap && maxMovePx < TAP_MAX_DISTANCE_PX) {
        handles.velAzimuth = 0;
        handles.velElevation = 0;
        performTapRaycast(e.clientX, e.clientY);
      }
    };

    const handlePointerUp = (e: PointerEvent) => finishPointer(e, true);
    const handlePointerCancel = (e: PointerEvent) => finishPointer(e, false);

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerCancel);

    // ResizeObserver for crisp responsive canvas
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(Math.floor(entry.contentRect.width), 200);
        const h = Math.max(Math.floor(entry.contentRect.height), 200);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        updateCameraPosition();
      }
    });
    resizeObserver.observe(host);

    // Animation loop
    let rafId = 0;
    let prevTime = performance.now();

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;

      // Camera tween or inertial damping
      if (handles.tweenTarget) {
        const factor = 1 - Math.exp(-10 * dt);
        handles.azimuth += (handles.tweenTarget.azimuth - handles.azimuth) * factor;
        handles.elevation += (handles.tweenTarget.elevation - handles.elevation) * factor;
        if (
          Math.abs(handles.tweenTarget.azimuth - handles.azimuth) < 0.002 &&
          Math.abs(handles.tweenTarget.elevation - handles.elevation) < 0.002
        ) {
          handles.azimuth = handles.tweenTarget.azimuth;
          handles.elevation = handles.tweenTarget.elevation;
          handles.tweenTarget = null;
        }
      } else if (activePointerId === null) {
        if (Math.abs(handles.velAzimuth) > 0.0001 || Math.abs(handles.velElevation) > 0.0001) {
          const stepScale = dt * 60;
          handles.azimuth += handles.velAzimuth * stepScale;
          handles.elevation = clamp(
            handles.elevation + handles.velElevation * stepScale,
            MIN_ELEVATION,
            MAX_ELEVATION
          );
          const damping = Math.pow(0.88, stepScale);
          handles.velAzimuth *= damping;
          handles.velElevation *= damping;
        }
      }
      updateCameraPosition();

      // Drop animations for newly placed pieces
      const anims = dropAnimsRef.current;
      if (anims.size > 0) {
        anims.forEach((anim, key) => {
          const [zStr, rStr, cStr] = key.split(',');
          const z = Number(zStr);
          const r = Number(rStr);
          const c = Number(cStr);
          const mesh = handles.pieceMeshes[z]?.[r]?.[c];
          if (!mesh) {
            anims.delete(key);
            return;
          }
          const t = Math.min(1, (now - anim.startTime) / DROP_DURATION_MS);
          const eased = easeOutDrop(t);
          mesh.position.y = anim.fromY + (anim.toY - anim.fromY) * eased;
          if (t >= 1) {
            mesh.position.y = anim.toY;
            anims.delete(key);
          }
        });
      }

      // Ghost preview pulsing
      const pulse = Math.sin(now * 0.0065) * 0.5 + 0.5;
      if (handles.ghostMesh.visible) {
        const s = 0.94 + pulse * 0.1;
        handles.ghostMesh.scale.setScalar(s);
        handles.ghostMat.opacity = 0.42 + pulse * 0.28;
        handles.ghostRing.scale.setScalar(0.96 + pulse * 0.12);
        handles.ghostRingMat.opacity = 0.55 + pulse * 0.35;
      }

      // Last move ring subtle pulse
      if (handles.lastMoveRing.visible) {
        const lp = Math.sin(now * 0.0045) * 0.5 + 0.5;
        handles.lastMoveRing.scale.setScalar(1.0 + lp * 0.09);
        handles.lastMoveRingMat.opacity = 0.52 + lp * 0.38;
      }

      // Winning spheres & beam glow pulse
      if (handles.winBeamGroup.visible) {
        const wp = Math.sin(now * 0.007) * 0.5 + 0.5;
        handles.matP0Win.emissiveIntensity = 0.78 + wp * 0.55;
        handles.matP1Win.emissiveIntensity = 0.78 + wp * 0.55;
        handles.winBeamHaloMat.opacity = 0.24 + wp * 0.24;
      }

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerCancel);

      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  // Sync game board, drop animations, lastMove, winningLine, ghost, and free-mode guides
  useEffect(() => {
    const handles = sceneRef.current;
    if (!handles) return;

    const winningSet = new Set<string>();
    for (const c of state.winningLine) {
      winningSet.add(`${c.z},${c.row},${c.col}`);
    }

    const prevBoard = prevBoardRef.current;
    const now = performance.now();

    for (let z = 0; z < C4_3D_SIZE; z++) {
      for (let r = 0; r < C4_3D_SIZE; r++) {
        for (let c = 0; c < C4_3D_SIZE; c++) {
          const cell = state.board[z][r][c];
          const mesh = handles.pieceMeshes[z][r][c];
          const key = `${z},${r},${c}`;
          const targetY = levelToY(z);

          if (cell === 0) {
            mesh.visible = false;
            mesh.position.y = targetY;
            dropAnimsRef.current.delete(key);
          } else {
            const isWin = winningSet.has(key);
            mesh.material =
              cell === 1
                ? isWin
                  ? handles.matP0Win
                  : handles.matP0
                : isWin
                ? handles.matP1Win
                : handles.matP1;
            mesh.visible = true;

            const wasEmpty = prevBoard !== null && prevBoard[z][r][c] === 0;
            if (wasEmpty) {
              const fromY = Math.max(POLE_HEIGHT + 0.45, targetY + 1.15);
              mesh.position.y = fromY;
              dropAnimsRef.current.set(key, {
                startTime: now,
                fromY,
                toY: targetY,
              });
            } else if (!dropAnimsRef.current.has(key)) {
              mesh.position.y = targetY;
            }
          }
        }
      }
    }

    // Snapshot board for next diff
    prevBoardRef.current = state.board.map((layer) => layer.map((row) => [...row]));

    // Last move subtle glowing ring
    if (state.lastMove && state.winningLine.length === 0) {
      const lm = state.lastMove;
      const lmCell = state.board[lm.z][lm.row][lm.col];
      handles.lastMoveRing.position.copy(coordToWorld(lm));
      handles.lastMoveRingMat.color.setHex(lmCell === 1 ? 0xfef08a : 0xbae6fd);
      handles.lastMoveRing.visible = true;
    } else {
      handles.lastMoveRing.visible = false;
    }

    // Winning 4-in-a-row golden 3D beam
    if (state.winningLine.length === 4) {
      const pStart = coordToWorld(state.winningLine[0]);
      const pEnd = coordToWorld(state.winningLine[3]);
      const dir = new THREE.Vector3().subVectors(pEnd, pStart);
      const beamLength = dir.length() + SPHERE_RADIUS * 2.2;
      const mid = new THREE.Vector3().addVectors(pStart, pEnd).multiplyScalar(0.5);
      const up = new THREE.Vector3(0, 1, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize());

      handles.winBeamGroup.position.copy(mid);
      handles.winBeamGroup.quaternion.copy(quat);
      handles.winBeamCore.scale.set(1, beamLength, 1);
      handles.winBeamHalo.scale.set(1, beamLength, 1);
      handles.winBeamGroup.visible = true;
    } else {
      handles.winBeamGroup.visible = false;
    }

    // Ghost preview sphere & base pole highlight ring
    for (let r = 0; r < C4_3D_SIZE; r++) {
      for (let c = 0; c < C4_3D_SIZE; c++) {
        handles.poleHighlightRings[r][c].visible = false;
      }
    }

    if (isMyTurn && pendingCoord) {
      const worldPos = coordToWorld(pendingCoord);
      const isP0 = current.disc === 1;
      handles.ghostMesh.position.copy(worldPos);
      handles.ghostMat.color.setHex(isP0 ? 0xfbbf24 : 0x38bdf8);
      handles.ghostMat.emissive.setHex(isP0 ? 0xf59e0b : 0x0ea5e9);
      handles.ghostMesh.visible = true;

      handles.ghostRing.position.copy(worldPos);
      handles.ghostRingMat.color.setHex(isP0 ? 0xf97316 : 0x38bdf8);
      handles.ghostRing.visible = true;

      handles.poleHighlightRings[pendingCoord.row][pendingCoord.col].visible = true;
    } else {
      handles.ghostMesh.visible = false;
      handles.ghostRing.visible = false;
    }

    // Free-mode floor guide rings & colliders
    const showFreeGuides = !state.rules.gravityMode && state.phase === 'playing';
    const floorY = levelToY(selectedFloor);
    handles.freeFloorFrame.visible = showFreeGuides;
    handles.freeFloorFrame.position.y = floorY;

    let idx = 0;
    for (let r = 0; r < C4_3D_SIZE; r++) {
      for (let c = 0; c < C4_3D_SIZE; c++) {
        const isEmpty = state.board[selectedFloor][r][c] === 0;
        const isSelectedHere =
          pendingCoord !== null &&
          pendingCoord.z === selectedFloor &&
          pendingCoord.row === r &&
          pendingCoord.col === c;

        const guide = handles.freeGuideRings[idx];
        guide.position.y = floorY;
        guide.visible = showFreeGuides && isMyTurn && isEmpty && !isSelectedHere;

        const colMesh = handles.freeColliders[idx];
        colMesh.position.y = floorY;
        idx++;
      }
    }
  }, [state, isMyTurn, pendingCoord, selectedFloor, current.disc]);

  return (
    <div className="board-container c43d-board">
      {/* プレイヤーバー */}
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && current.id === p.id;
          const isP0 = p.disc === 1;
          const accent = isP0 ? '#f59e0b' : '#38bdf8';
          return (
            <div
              key={p.id}
              className={`opp-pill ${active ? 'active' : ''} ${
                !isLocalPassAndPlay && p.id === state.myId ? 'me' : ''
              }`}
              style={active ? { borderColor: accent } : undefined}
            >
              <div
                className="opp-name"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <span className={`c43d-disc-dot ${isP0 ? 'p0' : 'p1'}`} />
                <span>{p.name}</span>
              </div>
              <div className="opp-meta">
                {active
                  ? isLocalPassAndPlay
                    ? '手番'
                    : p.id === state.myId
                    ? 'あなたの番'
                    : '相手の番'
                  : '待機'}
              </div>
            </div>
          );
        })}
      </div>

      {/* モード＆手数 */}
      <div className="c43d-meta-row">
        <span className={`c43d-mode-pill ${state.rules.gravityMode ? 'gravity' : 'free'}`}>
          {state.rules.gravityMode ? (
            <>
              <ArrowDownToLine size={12} />
              重力落下モード
            </>
          ) : (
            <>
              <Layers size={12} />
              自由配置モード
            </>
          )}
        </span>
        <span className="c43d-move-count">{state.moveCount} / 64手</span>
      </div>

      {/* 3D WebGL ステージ */}
      <div className="c43d-stage-wrap">
        <div
          ref={hostRef}
          className={`c43d-canvas-host ${isDraggingUI ? 'dragging' : ''}`}
          aria-label="立体4目並べ3Dボード"
        />

        <div className="c43d-orbit-hint">
          <Move3d size={13} />
          <span>ドラッグで回転</span>
        </div>

        <div className="c43d-cam-controls">
          <button
            type="button"
            className="c43d-cam-btn"
            onClick={handleResetView}
            aria-label="視点をリセット"
            title="視点をリセット"
          >
            <RotateCcw size={14} />
            <span>標準</span>
          </button>
          <button
            type="button"
            className={`c43d-cam-btn ${isTopDown ? 'active' : ''}`}
            onClick={handleToggleTopDown}
            aria-label={isTopDown ? '斜め視点へ切替' : '真上視点へ切替'}
            title={isTopDown ? '斜め視点へ切替' : '真上視点へ切替'}
          >
            {isTopDown ? <Compass size={14} /> : <Eye size={14} />}
            <span>{isTopDown ? '斜め' : '真上'}</span>
          </button>
        </div>

        {state.lastMove && (
          <div className="c43d-last-badge">
            <span
              className={`c43d-disc-dot ${
                state.board[state.lastMove.z][state.lastMove.row][state.lastMove.col] === 1
                  ? 'p0'
                  : 'p1'
              }`}
            />
            <span>直前: {formatCoord(state.lastMove)}</span>
          </div>
        )}
      </div>

      {/* 勝敗結果 or 下部アクションバー */}
      {state.phase === 'finished' ? (
        <div className="result-card">
          <h3>
            {state.winnerId === 'draw'
              ? '引き分け！'
              : isLocalPassAndPlay
              ? `${winner?.name ?? ''} の勝利！`
              : state.winnerId === state.myId
              ? 'あなたの勝利！'
              : `${winner?.name ?? '相手'} の勝利…`}
          </h3>
          {state.winnerId !== 'draw' && (
            <p className="panel-desc">
              {winner?.name ?? ''} が立体4連を完成させました（全{state.moveCount}手）
            </p>
          )}
        </div>
      ) : (
        <div className="sticky-bottom-bar c43d-bottom-bar">
          {!state.rules.gravityMode && (
            <div className="c43d-floor-bar" role="tablist" aria-label="配置階層の選択">
              {[0, 1, 2, 3].map((z) => (
                <button
                  key={z}
                  type="button"
                  role="tab"
                  aria-selected={selectedFloor === z}
                  className={`c43d-floor-btn ${selectedFloor === z ? 'active' : ''}`}
                  onClick={() => handleSelectFloor(z)}
                >
                  <span>{FLOOR_NAMES[z]}</span>
                  <span className="c43d-floor-count">{floorCounts[z]}/16</span>
                </button>
              ))}
            </div>
          )}

          <div className="c43d-action-row">
            {isMyTurn ? (
              <>
                <div className={`c43d-coord-chip ${pendingCoord ? 'selected' : ''}`}>
                  <span className={`c43d-disc-dot ${current.disc === 1 ? 'p0' : 'p1'}`} />
                  <span>{pendingCoord ? formatCoord(pendingCoord) : '未選択'}</span>
                </div>

                <button
                  type="button"
                  className="c43d-place-btn"
                  disabled={!pendingCoord}
                  onClick={confirmPlacement}
                >
                  <Check size={17} />
                  <span>
                    {pendingCoord
                      ? `ここに置く (${formatCoord(pendingCoord)})`
                      : state.rules.gravityMode
                      ? '柱をタップして選択'
                      : `${FLOOR_NAMES[selectedFloor]}のマスをタップ`}
                  </span>
                </button>

                <button
                  type="button"
                  className="c43d-reset-icon-btn"
                  onClick={handleResetView}
                  aria-label="視点リセット"
                  title="視点リセット"
                >
                  <RotateCcw size={17} />
                </button>
              </>
            ) : (
              <>
                <div className="c43d-wait-banner">
                  <span className={`c43d-disc-dot ${current.disc === 1 ? 'p0' : 'p1'}`} />
                  <span>{current.name} の手を待っています…（視点回転OK）</span>
                </div>
                <button
                  type="button"
                  className="c43d-reset-icon-btn"
                  onClick={handleResetView}
                  aria-label="視点リセット"
                  title="視点リセット"
                >
                  <RotateCcw size={17} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
