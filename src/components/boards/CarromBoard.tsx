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

interface DragAimState {
  pointerId: number;
  startX: number;
  startY: number;
  currX: number;
  currY: number;
}

const MAX_DRAG_DIST = 210;
const MIN_DRAG_DIST = 18;

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

function computeAimRayEnd(
  sx: number,
  sy: number,
  dx: number,
  dy: number,
  pieces: readonly CarromPiece[]
): { x: number; y: number } {
  const minWall = CARROM_WALL_INSET + CARROM_STRIKER_RADIUS;
  const maxWall = CARROM_BOARD_SIZE - CARROM_WALL_INSET - CARROM_STRIKER_RADIUS;

  let bestT = 560;

  if (dx < -0.001) bestT = Math.min(bestT, (minWall - sx) / dx);
  if (dx > 0.001) bestT = Math.min(bestT, (maxWall - sx) / dx);
  if (dy < -0.001) bestT = Math.min(bestT, (minWall - sy) / dy);
  if (dy > 0.001) bestT = Math.min(bestT, (maxWall - sy) / dy);

  const hitR = CARROM_STRIKER_RADIUS + CARROM_PIECE_RADIUS;
  for (const p of pieces) {
    if (p.pocketed) continue;
    const ocx = p.x - sx;
    const ocy = p.y - sy;
    const proj = ocx * dx + ocy * dy;
    if (proj <= 0 || proj > bestT) continue;
    const perpSq = ocx * ocx + ocy * ocy - proj * proj;
    if (perpSq < hitR * hitR) {
      const hitT = proj - Math.sqrt(hitR * hitR - perpSq);
      if (hitT > 0 && hitT < bestT) bestT = hitT;
    }
  }

  return {
    x: sx + dx * Math.max(0, bestT),
    y: sy + dy * Math.max(0, bestT),
  };
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

  const dragRef = useRef<DragAimState | null>(null);
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

  // 新しいショットが届いたら60fps物理再生を開始
  useEffect(() => {
    const shot = state.lastShot;
    if (!shot || shot.shotId === lastPlayedShotIdRef.current) return;
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

          // エイムガイド描画（ドラッグ中）
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

          if (drag && !anim.active && curCanControl) {
            const pullX = drag.startX - drag.currX;
            const pullY = drag.startY - drag.currY;
            const pullDist = Math.hypot(pullX, pullY);

            if (pullDist >= MIN_DRAG_DIST) {
              const clampedDist = Math.min(MAX_DRAG_DIST, pullDist);
              const powerRatio = clampedDist / MAX_DRAG_DIST;
              const dirX = pullX / pullDist;
              const dirY = pullY / pullDist;

              // パワーリング
              const ringColor =
                powerRatio < 0.45
                  ? '#10b981'
                  : powerRatio < 0.78
                  ? '#f59e0b'
                  : '#ef4444';

              ctx.save();
              ctx.strokeStyle = ringColor;
              ctx.lineWidth = 5;
              ctx.beginPath();
              ctx.arc(
                strikerToDraw.x,
                strikerToDraw.y,
                CARROM_STRIKER_RADIUS + 14 + powerRatio * 26,
                0,
                Math.PI * 2
              );
              ctx.stroke();

              // 引っ張りライン（後ろ方向）
              const tailX = strikerToDraw.x - dirX * clampedDist * 0.72;
              const tailY = strikerToDraw.y - dirY * clampedDist * 0.72;
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.moveTo(strikerToDraw.x, strikerToDraw.y);
              ctx.lineTo(tailX, tailY);
              ctx.stroke();

              ctx.fillStyle = ringColor;
              ctx.beginPath();
              ctx.arc(tailX, tailY, 9, 0, Math.PI * 2);
              ctx.fill();

              // 狙い方向の点線ガイド
              const rayEnd = computeAimRayEnd(
                strikerToDraw.x,
                strikerToDraw.y,
                dirX,
                dirY,
                curState.pieces
              );
              ctx.strokeStyle = ringColor;
              ctx.lineWidth = 4;
              ctx.setLineDash([12, 10]);
              ctx.beginPath();
              ctx.moveTo(strikerToDraw.x, strikerToDraw.y);
              ctx.lineTo(rayEnd.x, rayEnd.y);
              ctx.stroke();
              ctx.setLineDash([]);

              // 着弾予測ゴースト円
              ctx.strokeStyle = ringColor;
              ctx.lineWidth = 2.5;
              ctx.globalAlpha = 0.7;
              ctx.beginPath();
              ctx.arc(rayEnd.x, rayEnd.y, CARROM_STRIKER_RADIUS, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
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

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canControl) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = toLogicalCoords(e.clientX, e.clientY);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: pt.x,
      startY: pt.y,
      currX: pt.x,
      currY: pt.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const pt = toLogicalCoords(e.clientX, e.clientY);
    dragRef.current.currX = pt.x;
    dragRef.current.currY = pt.y;
  };

  const finishDrag = (e: React.PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;

    if (cancelled || !canControl) return;

    const pullX = drag.startX - drag.currX;
    const pullY = drag.startY - drag.currY;
    const pullDist = Math.hypot(pullX, pullY);
    if (pullDist < MIN_DRAG_DIST) return;

    const clamped = Math.min(MAX_DRAG_DIST, pullDist);
    const powerRatio = (clamped - MIN_DRAG_DIST) / (MAX_DRAG_DIST - MIN_DRAG_DIST);
    const speed =
      CARROM_MIN_SHOT_SPEED +
      Math.pow(powerRatio, 1.08) * (CARROM_MAX_SHOT_SPEED - CARROM_MIN_SHOT_SPEED);

    const vx = (pullX / pullDist) * speed;
    const vy = (pullY / pullDist) * speed;

    onAction(
      {
        type: 'shoot',
        payload: {
          strikerX: resolvedStrikerX,
          vx,
          vy,
        },
      },
      isLocalPassAndPlay ? activePlayer.id : undefined
    );
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
                ? `${activePlayer.name} の番: 盤面を後ろに引いて発射`
                : `${activePlayer.name} のショットを待機中`}
            </span>
            <span>{activePlayer.color === 'white' ? '白' : '黒'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
