import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Crown, MoveHorizontal, Trophy } from 'lucide-react';
import {
  CARROM_BASELINE_MAX_X,
  CARROM_BASELINE_MIN_X,
  CARROM_BOARD_SIZE,
  CARROM_MAX_SHOT_SPEED,
  CARROM_MAX_STEPS,
  CARROM_MIN_SHOT_SPEED,
  CARROM_PIECE_RADIUS,
  CARROM_POCKET_RADIUS,
  CARROM_POCKETS,
  CARROM_STRIKER_RADIUS,
  CARROM_WALL_INSET,
  getCarromBaselineY,
  resolveCarromStrikerX,
  simulateCarromStep,
  type CarromClientState,
  type CarromPiece,
  type CarromStriker,
} from '../../games/carrom';
import {
  computeFlickVelocity,
  FLICK_CAPTURE_MS,
  FLICK_MOVE_START_DIST,
  type FlickSample,
} from '../../utils/flickInput';
import './CarromBoard.css';

interface CarromBoardProps {
  state: CarromClientState;
  onAction: (action: { type: string; payload?: unknown }, overrideActorId?: string) => void;
  isLocalPassAndPlay?: boolean;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface PocketRing {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
}

interface FlickDragState {
  pointerId: number;
  samples: FlickSample[];
  moveStartedAt: number | null;
  autoTimer: number | null;
}

const CARROM_FLICK_OPTIONS = {
  minSpeed: CARROM_MIN_SHOT_SPEED,
  maxSpeed: CARROM_MAX_SHOT_SPEED,
  minDistance: 24,
  minSwipeVelocity: 0.35,
  maxSwipeVelocity: 3.6,
} as const;

const TRAIL_WINDOW_MS = 180;
const MAX_TRAIL_POINTS = 14;
const MAX_RECORDED_SAMPLES = 48;

function drawBoardBackground(ctx: CanvasRenderingContext2D): void {
  const S = CARROM_BOARD_SIZE;

  // 外枠（マホガニー調木枠）
  const frameGrad = ctx.createLinearGradient(0, 0, S, S);
  frameGrad.addColorStop(0, '#4a2511');
  frameGrad.addColorStop(0.5, '#2e1508');
  frameGrad.addColorStop(1, '#1f0d04');
  ctx.fillStyle = frameGrad;
  ctx.fillRect(0, 0, S, S);

  // 内側木目盤面
  const inset = CARROM_WALL_INSET;
  const innerSize = S - inset * 2;
  const woodGrad = ctx.createRadialGradient(S / 2, S / 2, 80, S / 2, S / 2, S * 0.68);
  woodGrad.addColorStop(0, '#f7e5c3');
  woodGrad.addColorStop(0.65, '#ebd1a0');
  woodGrad.addColorStop(1, '#d8b77e');
  ctx.fillStyle = woodGrad;
  ctx.beginPath();
  ctx.roundRect(inset, inset, innerSize, innerSize, 24);
  ctx.fill();

  // 微細な木目テクスチャ
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(inset, inset, innerSize, innerSize, 24);
  ctx.clip();
  ctx.strokeStyle = 'rgba(138, 92, 42, 0.065)';
  ctx.lineWidth = 2;
  for (let y = inset + 12; y < S - inset; y += 14) {
    ctx.beginPath();
    ctx.moveTo(inset, y);
    ctx.bezierCurveTo(
      S * 0.33,
      y + Math.sin(y * 0.04) * 5,
      S * 0.66,
      y - Math.cos(y * 0.03) * 5,
      S - inset,
      y
    );
    ctx.stroke();
  }
  ctx.restore();

  // 内枠のゴールドトリム
  ctx.strokeStyle = 'rgba(120, 68, 28, 0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(inset + 2, inset + 2, innerSize - 4, innerSize - 4, 22);
  ctx.stroke();

  // 四隅の対角矢印ライン
  ctx.strokeStyle = 'rgba(72, 42, 22, 0.55)';
  ctx.lineWidth = 3;
  const arrowCorners = [
    { px: 52, py: 52, dx: 1, dy: 1 },
    { px: 948, py: 52, dx: -1, dy: 1 },
    { px: 52, py: 948, dx: 1, dy: -1 },
    { px: 948, py: 948, dx: -1, dy: -1 },
  ];
  for (const c of arrowCorners) {
    const startX = c.px + c.dx * 78;
    const startY = c.py + c.dy * 78;
    const endX = c.px + c.dx * 278;
    const endY = c.py + c.dy * 278;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // ポケット側の矢印羽根
    const tipX = startX;
    const tipY = startY;
    ctx.beginPath();
    ctx.moveTo(tipX + c.dx * 22, tipY + c.dy * 5);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(tipX + c.dx * 5, tipY + c.dy * 22);
    ctx.stroke();

    // 中央側の装飾円弧
    const arcCenterX = endX - c.dx * 22;
    const arcCenterY = endY - c.dy * 22;
    const baseAngle = Math.atan2(-c.dy, -c.dx);
    ctx.beginPath();
    ctx.arc(arcCenterX, arcCenterY, 26, baseAngle - 0.9, baseAngle + 0.9);
    ctx.stroke();
  }

  // 4方向のベースライン
  const drawBaseline = (horizontal: boolean, pos: number) => {
    const halfBand = 16;
    const min = CARROM_BASELINE_MIN_X;
    const max = CARROM_BASELINE_MAX_X;

    ctx.strokeStyle = 'rgba(65, 36, 18, 0.72)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(min, pos - halfBand);
      ctx.lineTo(max, pos - halfBand);
      ctx.moveTo(min, pos + halfBand);
      ctx.lineTo(max, pos + halfBand);
    } else {
      ctx.moveTo(pos - halfBand, min);
      ctx.lineTo(pos - halfBand, max);
      ctx.moveTo(pos + halfBand, min);
      ctx.lineTo(pos + halfBand, max);
    }
    ctx.stroke();

    // 両端の赤いエンドサークル
    const ends = horizontal
      ? [
          { x: min, y: pos },
          { x: max, y: pos },
        ]
      : [
          { x: pos, y: min },
          { x: pos, y: max },
        ];
    for (const pt of ends) {
      ctx.fillStyle = '#c82828';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, halfBand, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#3b1d0d';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#f7e5c3';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  drawBaseline(true, getCarromBaselineY(0));
  drawBaseline(true, getCarromBaselineY(1));
  drawBaseline(false, getCarromBaselineY(1));
  drawBaseline(false, getCarromBaselineY(0));

  // 中央円 & コンパスローズ
  const cx = S / 2;
  const cy = S / 2;

  ctx.strokeStyle = 'rgba(72, 42, 22, 0.72)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 118, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(180, 42, 42, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 108, 0, Math.PI * 2);
  ctx.stroke();

  // 8方向スター装飾
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const outerR = i % 2 === 0 ? 102 : 76;
    const midR = 28;
    const aLeft = a - Math.PI / 14;
    const aRight = a + Math.PI / 14;

    ctx.fillStyle = i % 2 === 0 ? 'rgba(180, 42, 42, 0.24)' : 'rgba(65, 36, 18, 0.16)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(aLeft) * midR, cy + Math.sin(aLeft) * midR);
    ctx.lineTo(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR);
    ctx.lineTo(cx + Math.cos(aRight) * midR, cy + Math.sin(aRight) * midR);
    ctx.closePath();
    ctx.fill();
  }

  // 中央クイーンサークル
  ctx.fillStyle = 'rgba(185, 28, 28, 0.2)';
  ctx.beginPath();
  ctx.arc(cx, cy, CARROM_PIECE_RADIUS + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#991b1b';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 四隅ポケット
  for (const pocket of CARROM_POCKETS) {
    // ポケット外リム
    ctx.fillStyle = '#2d160a';
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, CARROM_POCKET_RADIUS + 5, 0, Math.PI * 2);
    ctx.fill();

    // ポケット穴
    const holeGrad = ctx.createRadialGradient(
      pocket.x + 4,
      pocket.y + 4,
      4,
      pocket.x,
      pocket.y,
      CARROM_POCKET_RADIUS
    );
    holeGrad.addColorStop(0, '#040404');
    holeGrad.addColorStop(0.75, '#120d0a');
    holeGrad.addColorStop(1, '#261a12');
    ctx.fillStyle = holeGrad;
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, CARROM_POCKET_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(245, 198, 120, 0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawPiece(ctx: CanvasRenderingContext2D, piece: CarromPiece): void {
  if (piece.pocketed) return;
  const { x, y, color } = piece;
  const r = CARROM_PIECE_RADIUS;

  ctx.save();
  // ドロップシャドウ
  ctx.fillStyle = 'rgba(18, 10, 4, 0.34)';
  ctx.beginPath();
  ctx.arc(x + 3, y + 4, r, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 2, x, y, r);
  if (color === 'white') {
    grad.addColorStop(0, '#fffef9');
    grad.addColorStop(0.65, '#f0e2c2');
    grad.addColorStop(1, '#bfa678');
  } else if (color === 'black') {
    grad.addColorStop(0, '#5a5f6b');
    grad.addColorStop(0.55, '#272930');
    grad.addColorStop(1, '#0d0e12');
  } else {
    grad.addColorStop(0, '#fca5a5');
    grad.addColorStop(0.45, '#dc2626');
    grad.addColorStop(1, '#7f1d1d');
  }

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // 外周エッジ
  ctx.strokeStyle =
    color === 'white'
      ? 'rgba(130, 102, 56, 0.65)'
      : color === 'black'
      ? 'rgba(160, 170, 190, 0.35)'
      : 'rgba(254, 202, 202, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 同心円溝リング
  ctx.strokeStyle =
    color === 'white'
      ? 'rgba(148, 114, 62, 0.42)'
      : color === 'black'
      ? 'rgba(255, 255, 255, 0.22)'
      : 'rgba(254, 226, 226, 0.45)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.66, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawStriker(
  ctx: CanvasRenderingContext2D,
  striker: CarromStriker,
  highlight: boolean
): void {
  if (striker.pocketed) return;
  const { x, y } = striker;
  const r = CARROM_STRIKER_RADIUS;

  ctx.save();

  if (highlight) {
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 影
  ctx.fillStyle = 'rgba(18, 10, 4, 0.38)';
  ctx.beginPath();
  ctx.arc(x + 3.5, y + 4.5, r, 0, Math.PI * 2);
  ctx.fill();

  // パール＆ゴールド本体
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 3, x, y, r);
  grad.addColorStop(0, '#fffbeb');
  grad.addColorStop(0.55, '#fde68a');
  grad.addColorStop(0.88, '#d97706');
  grad.addColorStop(1, '#92400e');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 内装飾リング
  ctx.strokeStyle = 'rgba(120, 53, 15, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.68, 0, Math.PI * 2);
  ctx.stroke();

  // 中央ダイヤ
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.moveTo(x, y - 9);
  ctx.lineTo(x + 9, y);
  ctx.lineTo(x, y + 9);
  ctx.lineTo(x - 9, y);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawFlickTrail(
  ctx: CanvasRenderingContext2D,
  samples: readonly FlickSample[],
  now: number
): void {
  const recent = samples
    .filter((s) => now - s.t <= TRAIL_WINDOW_MS)
    .slice(-MAX_TRAIL_POINTS);
  if (recent.length < 2) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];
    const progress = i / (recent.length - 1);
    const ageFade = Math.max(0, 1 - (now - curr.t) / TRAIL_WINDOW_MS);
    const alpha = progress * ageFade;

    // 外側の淡い光彩
    ctx.strokeStyle = `rgba(251, 191, 36, ${(alpha * 0.38).toFixed(3)})`;
    ctx.lineWidth = 4 + progress * 12;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();

    // 芯の明るい光のライン
    ctx.strokeStyle = `rgba(255, 251, 235, ${(alpha * 0.85).toFixed(3)})`;
    ctx.lineWidth = 1.5 + progress * 4.5;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
  }

  // 指先の控えめな光点
  const tip = recent[recent.length - 1];
  const tipFade = Math.max(0, 1 - (now - tip.t) / TRAIL_WINDOW_MS);
  if (tipFade > 0.05) {
    const glow = ctx.createRadialGradient(tip.x, tip.y, 1, tip.x, tip.y, 14);
    glow.addColorStop(0, `rgba(255, 251, 235, ${(tipFade * 0.9).toFixed(3)})`);
    glow.addColorStop(0.5, `rgba(245, 158, 11, ${(tipFade * 0.45).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export const CarromBoard: React.FC<CarromBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strikerX, setStrikerX] = useState<number>(500);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const myPlayerIndex = useMemo<0 | 1>(() => {
    return state.players[1].id === state.myId ? 1 : 0;
  }, [state.players, state.myId]);

  // オンライン対戦で自分が Player 1（黒）のときは180度回転して自分のベースラインを手前にする
  const rotatedView = !isLocalPassAndPlay && myPlayerIndex === 1;

  const activePlayer = state.players[state.turnIndex];
  const isMyTurn =
    state.phase === 'playing' &&
    (isLocalPassAndPlay ? !activePlayer.isBot : activePlayer.id === state.myId);
  const canControl = isMyTurn && !isAnimating;

  const activeBaselineY = getCarromBaselineY(state.turnIndex);
  const resolvedStrikerX = useMemo(
    () => resolveCarromStrikerX(state.pieces, strikerX, activeBaselineY),
    [state.pieces, strikerX, activeBaselineY]
  );

  // アニメーション用ミュータブルRef
  const animRef = useRef<{
    active: boolean;
    pieces: CarromPiece[];
    striker: CarromStriker;
    stepCount: number;
    sparks: SparkParticle[];
    rings: PocketRing[];
  }>({
    active: false,
    pieces: [],
    striker: { x: 500, y: activeBaselineY, vx: 0, vy: 0, pocketed: false },
    stepCount: 0,
    sparks: [],
    rings: [],
  });

  const dragRef = useRef<FlickDragState | null>(null);
  const lastPlayedShotIdRef = useRef<number>(state.lastShot?.shotId ?? 0);

  // 最新ステートを描画ループから読むためのRef
  const latestRef = useRef({
    state,
    resolvedStrikerX,
    activeBaselineY,
    canControl,
    rotatedView,
  });
  latestRef.current = {
    state,
    resolvedStrikerX,
    activeBaselineY,
    canControl,
    rotatedView,
  };

  // 新しいショットが届いたら60fps物理再生を開始（リスタート時はアニメ状態をリセット）
  useEffect(() => {
    const shot = state.lastShot;
    if (!shot) {
      lastPlayedShotIdRef.current = 0;
      animRef.current.active = false;
      setIsAnimating(false);
      setToastText(null);
      return;
    }
    if (shot.shotId === lastPlayedShotIdRef.current) return;
    lastPlayedShotIdRef.current = shot.shotId;

    animRef.current = {
      active: true,
      pieces: shot.initialPieces.map((p) => ({ ...p })),
      striker: { ...shot.initialStriker },
      stepCount: 0,
      sparks: [],
      rings: [],
    };
    setIsAnimating(true);
    setToastText(null);
  }, [state.lastShot]);

  // 結果トーストの自動フェード
  useEffect(() => {
    if (!toastText) return;
    const timer = window.setTimeout(() => setToastText(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toastText]);

  // 60fps 描画＋物理再生ループ
  useEffect(() => {
    let rafId = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const {
            state: curState,
            resolvedStrikerX: curStrikerX,
            activeBaselineY: curBaselineY,
            canControl: curCanControl,
            rotatedView: curRotated,
          } = latestRef.current;

          const anim = animRef.current;

          // アニメーション進行
          if (anim.active) {
            const stepRes = simulateCarromStep(anim.pieces, anim.striker);
            anim.stepCount += 1;

            for (const hit of stepRes.collisions) {
              const count = Math.min(6, Math.ceil(hit.intensity * 6));
              for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2;
                const sp = 1.5 + Math.random() * 4 * hit.intensity;
                anim.sparks.push({
                  x: hit.x,
                  y: hit.y,
                  vx: Math.cos(a) * sp,
                  vy: Math.sin(a) * sp,
                  life: 0,
                  maxLife: 14 + Math.random() * 8,
                  color: '#fde68a',
                  size: 2.5 + Math.random() * 2.5,
                });
              }
            }

            if (stepRes.newlyPocketedIds.length > 0) {
              for (const pid of stepRes.newlyPocketedIds) {
                const piece = anim.pieces.find((p) => p.id === pid);
                if (!piece) continue;
                anim.rings.push({
                  x: piece.x,
                  y: piece.y,
                  life: 0,
                  maxLife: 24,
                  color:
                    piece.color === 'queen'
                      ? '#f87171'
                      : piece.color === 'white'
                      ? '#fef3c7'
                      : '#94a3b8',
                });
              }
            }

            if (stepRes.strikerNewlyPocketed) {
              anim.rings.push({
                x: anim.striker.x,
                y: anim.striker.y,
                life: 0,
                maxLife: 26,
                color: '#ef4444',
              });
            }

            if (!stepRes.moving || anim.stepCount >= CARROM_MAX_STEPS) {
              anim.active = false;
              setIsAnimating(false);
              if (curState.lastShot?.summary) {
                setToastText(curState.lastShot.summary);
              }
            }
          }

          // パーティクル更新
          for (let i = anim.sparks.length - 1; i >= 0; i--) {
            const sp = anim.sparks[i];
            sp.x += sp.vx;
            sp.y += sp.vy;
            sp.vx *= 0.9;
            sp.vy *= 0.9;
            sp.life += 1;
            if (sp.life >= sp.maxLife) anim.sparks.splice(i, 1);
          }

          for (let i = anim.rings.length - 1; i >= 0; i--) {
            const rg = anim.rings[i];
            rg.life += 1;
            if (rg.life >= rg.maxLife) anim.rings.splice(i, 1);
          }

          // 描画開始
          ctx.save();
          ctx.clearRect(0, 0, CARROM_BOARD_SIZE, CARROM_BOARD_SIZE);

          if (curRotated) {
            ctx.translate(CARROM_BOARD_SIZE, CARROM_BOARD_SIZE);
            ctx.rotate(Math.PI);
          }

          drawBoardBackground(ctx);

          const drawPiecesList = anim.active ? anim.pieces : curState.pieces;
          for (const p of drawPiecesList) {
            drawPiece(ctx, p);
          }

          // フリック中の控えめなチャージリング＆短いスワイプ軌跡（光のトレイル）
          const drag = dragRef.current;
          const strikerToDraw: CarromStriker = anim.active
            ? anim.striker
            : {
                x: curStrikerX,
                y: curBaselineY,
                vx: 0,
                vy: 0,
                pocketed: false,
              };

          if (drag && !anim.active && curCanControl && drag.samples.length >= 2) {
            const now = performance.now();
            const first = drag.samples[0];
            const last = drag.samples[drag.samples.length - 1];
            const totalDist = Math.hypot(last.x - first.x, last.y - first.y);

            if (totalDist >= 8) {
              const previewFlick = computeFlickVelocity(drag.samples, CARROM_FLICK_OPTIONS);
              const chargeRatio = previewFlick
                ? previewFlick.powerRatio
                : Math.min(0.25, totalDist / 160);

              // ストライカー周りの控えめなチャージリング
              ctx.save();
              ctx.strokeStyle = `rgba(245, 158, 11, ${(0.28 + chargeRatio * 0.42).toFixed(3)})`;
              ctx.lineWidth = 3 + chargeRatio * 2;
              ctx.beginPath();
              ctx.arc(
                strikerToDraw.x,
                strikerToDraw.y,
                CARROM_STRIKER_RADIUS + 10 + chargeRatio * 14,
                0,
                Math.PI * 2
              );
              ctx.stroke();
              ctx.restore();

              // 指が通った短いスワイプ軌跡（光のトレイル）
              drawFlickTrail(ctx, drag.samples, now);
            }
          }

          // ストライカー描画
          if (curState.phase === 'playing' || anim.active) {
            drawStriker(ctx, strikerToDraw, curCanControl && !anim.active);
          }

          // スパーク描画
          for (const sp of anim.sparks) {
            const alpha = 1 - sp.life / sp.maxLife;
            ctx.fillStyle = sp.color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;

          // ポケットインリング描画
          for (const rg of anim.rings) {
            const t = rg.life / rg.maxLife;
            ctx.strokeStyle = rg.color;
            ctx.lineWidth = 4 * (1 - t);
            ctx.globalAlpha = 1 - t;
            ctx.beginPath();
            ctx.arc(rg.x, rg.y, 16 + t * 38, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;

          ctx.restore();
        }
      }

      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const toLogicalCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 500, y: 500 };
      const rect = canvas.getBoundingClientRect();
      let x = ((clientX - rect.left) / rect.width) * CARROM_BOARD_SIZE;
      let y = ((clientY - rect.top) / rect.height) * CARROM_BOARD_SIZE;
      if (rotatedView) {
        x = CARROM_BOARD_SIZE - x;
        y = CARROM_BOARD_SIZE - y;
      }
      return { x, y };
    },
    [rotatedView]
  );

  const clearDrag = useCallback((drag: FlickDragState | null) => {
    if (drag?.autoTimer != null) {
      window.clearTimeout(drag.autoTimer);
      drag.autoTimer = null;
    }
    if (dragRef.current === drag) {
      dragRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearDrag(dragRef.current);
    };
  }, [clearDrag]);

  const commitDrag = useCallback(
    (drag: FlickDragState) => {
      if (dragRef.current !== drag) return;
      clearDrag(drag);
      if (!canControl) return;

      const flick = computeFlickVelocity(drag.samples, CARROM_FLICK_OPTIONS);
      if (!flick) return;

      onAction(
        {
          type: 'shoot',
          payload: {
            strikerX: resolvedStrikerX,
            vx: flick.vx,
            vy: flick.vy,
          },
        },
        isLocalPassAndPlay ? activePlayer.id : undefined
      );
    },
    [activePlayer.id, canControl, clearDrag, isLocalPassAndPlay, onAction, resolvedStrikerX]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canControl) return;
    clearDrag(dragRef.current);
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = toLogicalCoords(e.clientX, e.clientY);
    dragRef.current = {
      pointerId: e.pointerId,
      samples: [{ x: pt.x, y: pt.y, t: performance.now() }],
      moveStartedAt: null,
      autoTimer: null,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const pt = toLogicalCoords(e.clientX, e.clientY);
    const now = performance.now();
    const prev = drag.samples[drag.samples.length - 1];
    if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) >= 1.5 || now - prev.t >= 8) {
      drag.samples.push({ x: pt.x, y: pt.y, t: now });
      if (drag.samples.length > MAX_RECORDED_SAMPLES) {
        drag.samples.shift();
      }
    }

    // 弾き始めからコンマ数秒（FLICK_CAPTURE_MS）だけ読み取って自動発射
    if (drag.moveStartedAt === null) {
      const origin = drag.samples[0];
      if (Math.hypot(pt.x - origin.x, pt.y - origin.y) >= FLICK_MOVE_START_DIST) {
        drag.moveStartedAt = now;
        drag.autoTimer = window.setTimeout(() => {
          commitDrag(drag);
        }, FLICK_CAPTURE_MS);
      }
    } else if (now - drag.moveStartedAt >= FLICK_CAPTURE_MS) {
      commitDrag(drag);
    }
  };

  const finishDrag = (e: React.PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (cancelled || !canControl) {
      clearDrag(drag);
      return;
    }

    const pt = toLogicalCoords(e.clientX, e.clientY);
    const now = performance.now();
    const prev = drag.samples[drag.samples.length - 1];
    if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) >= 0.5) {
      drag.samples.push({ x: pt.x, y: pt.y, t: now });
    }

    commitDrag(drag);
  };

  // スライダー値（回転ビュー時は左右反転して直感的に操作できるようにする）
  const sliderDisplayValue = rotatedView
    ? CARROM_BASELINE_MIN_X + CARROM_BASELINE_MAX_X - resolvedStrikerX
    : resolvedStrikerX;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Number(e.target.value);
    const logical = rotatedView ? CARROM_BASELINE_MIN_X + CARROM_BASELINE_MAX_X - raw : raw;
    setStrikerX(logical);
  };

  const p0 = state.players[0];
  const p1 = state.players[1];
  const whiteLeft = state.pieces.filter((p) => p.color === 'white' && !p.pocketed).length;
  const blackLeft = state.pieces.filter((p) => p.color === 'black' && !p.pocketed).length;
  const queenPiece = state.pieces.find((p) => p.color === 'queen');
  const queenOnBoard = queenPiece ? !queenPiece.pocketed : false;

  const winnerName =
    state.winnerId === 'draw'
      ? '引き分け'
      : state.players.find((p) => p.id === state.winnerId)?.name ?? '';

  return (
    <div className="carrom-arena">
      <div className="carrom-scoreboard">
        <div className={`carrom-player-card ${state.turnIndex === 0 && state.phase === 'playing' ? 'active' : ''}`}>
          <div className="carrom-disc-badge white" />
          <div className="carrom-player-meta">
            <span className="carrom-player-name">{p0.name}</span>
            <div className="carrom-player-stats">
              <span className="carrom-score-num">{p0.score}pt</span>
              <span>残{whiteLeft}</span>
              {state.queenOwnerId === p0.id && (
                <span className="carrom-queen-pill">
                  <Crown size={10} /> Q
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="carrom-queen-indicator" title="赤クイーン">
          <div
            className={`carrom-queen-dot ${
              state.queenPendingBy
                ? 'pending'
                : !queenOnBoard && state.queenOwnerId
                ? 'taken'
                : ''
            }`}
          />
          <span className="carrom-queen-label">
            {state.queenPendingBy
              ? 'カバー待'
              : state.queenOwnerId
              ? '獲得済'
              : `+${state.rules.queenBonus}`}
          </span>
        </div>

        <div className={`carrom-player-card right ${state.turnIndex === 1 && state.phase === 'playing' ? 'active' : ''}`}>
          <div className="carrom-disc-badge black" />
          <div className="carrom-player-meta">
            <span className="carrom-player-name">{p1.name}</span>
            <div className="carrom-player-stats">
              {state.queenOwnerId === p1.id && (
                <span className="carrom-queen-pill">
                  <Crown size={10} /> Q
                </span>
              )}
              <span>残{blackLeft}</span>
              <span className="carrom-score-num">{p1.score}pt</span>
            </div>
          </div>
        </div>
      </div>

      <div className="carrom-board-stage">
        <canvas
          ref={canvasRef}
          width={CARROM_BOARD_SIZE}
          height={CARROM_BOARD_SIZE}
          className={`carrom-canvas ${!canControl ? 'disabled' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => finishDrag(e, false)}
          onPointerCancel={(e) => finishDrag(e, true)}
        />
        {toastText && <div className="carrom-shot-toast">{toastText}</div>}
      </div>

      {state.phase === 'finished' && !isAnimating ? (
        <div className="carrom-result-banner">
          <Trophy size={18} />
          <span>{state.winnerId === 'draw' ? '引き分け！' : `${winnerName} の勝利！`}</span>
        </div>
      ) : (
        <div className="carrom-controls-panel">
          <div className="carrom-slider-row">
            <span className="carrom-slider-icon" aria-hidden="true">
              <MoveHorizontal size={18} />
            </span>
            <input
              type="range"
              className="carrom-slider"
              min={CARROM_BASELINE_MIN_X}
              max={CARROM_BASELINE_MAX_X}
              step={2}
              value={sliderDisplayValue}
              disabled={!canControl}
              onChange={handleSliderChange}
              aria-label="ストライカーの横位置"
            />
          </div>
          <div className="carrom-status-row">
            <span className="carrom-status-hint">
              <Crosshair size={14} />
              {isAnimating
                ? 'ショット中...'
                : canControl
                ? `${activePlayer.name} の番: 狙う方向へスッと弾く`
                : `${activePlayer.name} のショットを待機中`}
            </span>
            <span>{activePlayer.color === 'white' ? '白' : '黒'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
