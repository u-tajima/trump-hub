import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Award, Crosshair, MoveHorizontal, Trophy } from 'lucide-react';
import {
  CROKINOLE_BOARD_SIZE,
  CROKINOLE_CENTER,
  CROKINOLE_DISC_RADIUS,
  CROKINOLE_HOLE_RADIUS,
  CROKINOLE_MAX_SHOT_SPEED,
  CROKINOLE_MAX_STEPS,
  CROKINOLE_MIN_SHOT_SPEED,
  CROKINOLE_PEG_RADIUS,
  CROKINOLE_PEGS,
  CROKINOLE_PLAY_RADIUS,
  CROKINOLE_RING10_RADIUS,
  CROKINOLE_RING15_RADIUS,
  CROKINOLE_SHOOT_RADIUS,
  getCrokinoleShootAngleRange,
  getCrokinoleShootPosFromAngle,
  resolveCrokinoleShootAngle,
  simulateCrokinoleStep,
  type CrokinoleClientState,
  type CrokinoleDisc,
} from '../../games/crokinole';
import './CrokinoleBoard.css';

interface CrokinoleBoardProps {
  state: CrokinoleClientState;
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

interface EffectRing {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  maxRadius: number;
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

function drawCrokinoleBoard(
  ctx: CanvasRenderingContext2D,
  activeTurnIndex: 0 | 1,
  rotatedView: boolean
): void {
  const S = CROKINOLE_BOARD_SIZE;
  const C = CROKINOLE_CENTER;

  // 背景クリア（ダークウォールナット外周）
  ctx.fillStyle = '#1b110a';
  ctx.fillRect(0, 0, S, S);

  // 外枠リング（マホガニー木枠）
  const outerGrad = ctx.createRadialGradient(C, C, CROKINOLE_PLAY_RADIUS + 8, C, C, 496);
  outerGrad.addColorStop(0, '#2c160b');
  outerGrad.addColorStop(0.55, '#4b2613');
  outerGrad.addColorStop(0.85, '#3b1c0d');
  outerGrad.addColorStop(1, '#1e0e06');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(C, C, 494, 0, Math.PI * 2);
  ctx.fill();

  // ガター（溝）の暗い影
  ctx.fillStyle = '#120904';
  ctx.beginPath();
  ctx.arc(C, C, CROKINOLE_PLAY_RADIUS + 20, 0, Math.PI * 2);
  ctx.fill();

  // 盤面（明るいメープル木目）
  const woodGrad = ctx.createRadialGradient(C - 80, C - 90, 30, C, C, CROKINOLE_PLAY_RADIUS);
  woodGrad.addColorStop(0, '#fbf0d8');
  woodGrad.addColorStop(0.58, '#efd6a6');
  woodGrad.addColorStop(0.88, '#dfb97e');
  woodGrad.addColorStop(1, '#cfa262');
  ctx.fillStyle = woodGrad;
  ctx.beginPath();
  ctx.arc(C, C, CROKINOLE_PLAY_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // 微細な木目テクスチャ（円形クリップ）
  ctx.save();
  ctx.beginPath();
  ctx.arc(C, C, CROKINOLE_PLAY_RADIUS, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(130, 84, 34, 0.065)';
  ctx.lineWidth = 2;
  for (let y = C - CROKINOLE_PLAY_RADIUS; y <= C + CROKINOLE_PLAY_RADIUS; y += 13) {
    ctx.beginPath();
    ctx.moveTo(C - CROKINOLE_PLAY_RADIUS, y);
    ctx.bezierCurveTo(
      C - 160,
      y + Math.sin(y * 0.03) * 6,
      C + 160,
      y - Math.cos(y * 0.025) * 6,
      C + CROKINOLE_PLAY_RADIUS,
      y
    );
    ctx.stroke();
  }
  ctx.restore();

  // 盤面の外周リム線
  ctx.strokeStyle = '#5c3317';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(C, C, CROKINOLE_PLAY_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  // 15点・10点・シューティングラインリング
  ctx.strokeStyle = 'rgba(72, 40, 18, 0.72)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(C, C, CROKINOLE_RING10_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(C, C, CROKINOLE_RING15_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  // 4分割クォーターライン（10点円〜盤面外周）
  ctx.strokeStyle = 'rgba(72, 40, 18, 0.45)';
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(C + Math.cos(a) * CROKINOLE_RING10_RADIUS, C + Math.sin(a) * CROKINOLE_RING10_RADIUS);
    ctx.lineTo(C + Math.cos(a) * CROKINOLE_PLAY_RADIUS, C + Math.sin(a) * CROKINOLE_PLAY_RADIUS);
    ctx.stroke();
  }

  // シューティングライン円弧（両陣営・アクティブ側を強調）
  const drawShootArc = (pIdx: 0 | 1) => {
    const range = getCrokinoleShootAngleRange(pIdx);
    const isActive = pIdx === activeTurnIndex;
    ctx.save();
    ctx.strokeStyle = isActive
      ? pIdx === 0
        ? 'rgba(245, 158, 11, 0.85)'
        : 'rgba(239, 68, 68, 0.85)'
      : 'rgba(72, 40, 18, 0.35)';
    ctx.lineWidth = isActive ? 5 : 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(C, C, CROKINOLE_SHOOT_RADIUS, range.min, range.max);
    ctx.stroke();
    ctx.restore();
  };
  drawShootArc(0);
  drawShootArc(1);

  // 得点表記（5, 10, 15）を控えめに配置
  const drawScoreLabel = (label: string, distY: number) => {
    ctx.save();
    ctx.translate(C, C + (rotatedView ? -distY : distY));
    if (rotatedView) ctx.rotate(Math.PI);
    ctx.fillStyle = 'rgba(92, 51, 23, 0.55)';
    ctx.font = '800 24px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  };
  drawScoreLabel('15', 92);
  drawScoreLabel('10', 214);
  drawScoreLabel('5', 346);

  // 中央20点ホール
  ctx.fillStyle = '#3b1d0d';
  ctx.beginPath();
  ctx.arc(C, C, CROKINOLE_HOLE_RADIUS + 5, 0, Math.PI * 2);
  ctx.fill();

  const holeGrad = ctx.createRadialGradient(C + 4, C + 4, 4, C, C, CROKINOLE_HOLE_RADIUS);
  holeGrad.addColorStop(0, '#050403');
  holeGrad.addColorStop(0.75, '#170f0a');
  holeGrad.addColorStop(1, '#2f1e13');
  ctx.fillStyle = holeGrad;
  ctx.beginPath();
  ctx.arc(C, C, CROKINOLE_HOLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(245, 198, 120, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 20点ラベル
  ctx.save();
  ctx.translate(C, C);
  if (rotatedView) ctx.rotate(Math.PI);
  ctx.fillStyle = 'rgba(250, 204, 21, 0.65)';
  ctx.font = '900 18px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('20', 0, 1);
  ctx.restore();

  // 8本の金属バンパーペグ
  for (const peg of CROKINOLE_PEGS) {
    // 影
    ctx.fillStyle = 'rgba(20, 10, 4, 0.38)';
    ctx.beginPath();
    ctx.arc(peg.x + 2.5, peg.y + 3.5, CROKINOLE_PEG_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    const pGrad = ctx.createRadialGradient(
      peg.x - 3,
      peg.y - 3,
      1.5,
      peg.x,
      peg.y,
      CROKINOLE_PEG_RADIUS
    );
    pGrad.addColorStop(0, '#fffbeb');
    pGrad.addColorStop(0.45, '#d4af37');
    pGrad.addColorStop(0.85, '#785a1c');
    pGrad.addColorStop(1, '#3b2809');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(peg.x, peg.y, CROKINOLE_PEG_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#291a05';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

function drawCrokinoleDisc(
  ctx: CanvasRenderingContext2D,
  disc: { x: number; y: number; ownerIndex: 0 | 1 },
  highlight: boolean
): void {
  const { x, y, ownerIndex } = disc;
  const r = CROKINOLE_DISC_RADIUS;

  ctx.save();

  if (highlight) {
    ctx.strokeStyle = ownerIndex === 0 ? 'rgba(245, 158, 11, 0.65)' : 'rgba(248, 113, 113, 0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ドロップシャドウ
  ctx.fillStyle = 'rgba(18, 10, 4, 0.36)';
  ctx.beginPath();
  ctx.arc(x + 3, y + 4, r, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createRadialGradient(x - r * 0.32, y - r * 0.35, 2, x, y, r);
  if (ownerIndex === 0) {
    // アイボリー・ナチュラルウッド
    grad.addColorStop(0, '#fffef9');
    grad.addColorStop(0.62, '#f1e4c6');
    grad.addColorStop(1, '#bfa474');
  } else {
    // クリムゾン・ダークウッド
    grad.addColorStop(0, '#f87171');
    grad.addColorStop(0.55, '#b91c1c');
    grad.addColorStop(1, '#5c0b0b');
  }

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // 外周リム
  ctx.strokeStyle =
    ownerIndex === 0 ? 'rgba(130, 100, 52, 0.65)' : 'rgba(254, 202, 202, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 凹みリング（クルキノールディスクの定番デザイン）
  ctx.strokeStyle =
    ownerIndex === 0 ? 'rgba(155, 118, 60, 0.42)' : 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, r * 0.25, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

export const CrokinoleBoard: React.FC<CrokinoleBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sliderRatio, setSliderRatio] = useState<number>(0.5); // 0..1 発射円弧上の位置
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const [hole20Banner, setHole20Banner] = useState<string | null>(null);
  const [roundBanner, setRoundBanner] = useState<string | null>(null);

  const myPlayerIndex = useMemo<0 | 1>(() => {
    return state.players[1].id === state.myId ? 1 : 0;
  }, [state.players, state.myId]);

  const rotatedView = !isLocalPassAndPlay && myPlayerIndex === 1;
  const activePlayer = state.players[state.turnIndex];
  const isMyTurn =
    state.phase === 'playing' &&
    (isLocalPassAndPlay ? !activePlayer.isBot : activePlayer.id === state.myId);
  const canControl = isMyTurn && !isAnimating;

  const angleRange = useMemo(
    () => getCrokinoleShootAngleRange(state.turnIndex),
    [state.turnIndex]
  );

  // スライダー比率（0=画面左、1=画面右）→ 論理角度へ変換
  const resolvedShootAngle = useMemo(() => {
    // P0（下側円弧）は右→左で角度が増える（π/2 - span が右、π/2 + span が左）
    // P1（上側円弧）は左→右で角度が増える（-π/2 - span が左、-π/2 + span が右）
    // 画面上の「左→右」を直感的に一致させる
    let logicalRatio = sliderRatio;
    if (state.turnIndex === 0) {
      logicalRatio = rotatedView ? sliderRatio : 1 - sliderRatio;
    } else {
      logicalRatio = rotatedView ? 1 - sliderRatio : sliderRatio;
    }
    const desired = angleRange.min + logicalRatio * (angleRange.max - angleRange.min);
    return resolveCrokinoleShootAngle(state.discs, desired, state.turnIndex);
  }, [sliderRatio, state.turnIndex, state.discs, angleRange, rotatedView]);

  const shooterPreviewPos = useMemo(
    () => getCrokinoleShootPosFromAngle(resolvedShootAngle),
    [resolvedShootAngle]
  );

  const animRef = useRef<{
    active: boolean;
    discs: CrokinoleDisc[];
    stepCount: number;
    sparks: SparkParticle[];
    rings: EffectRing[];
  }>({
    active: false,
    discs: [],
    stepCount: 0,
    sparks: [],
    rings: [],
  });

  const dragRef = useRef<DragAimState | null>(null);
  const lastPlayedShotIdRef = useRef<number>(state.lastShot?.shotId ?? 0);

  const latestRef = useRef({
    state,
    shooterPreviewPos,
    canControl,
    rotatedView,
  });
  latestRef.current = {
    state,
    shooterPreviewPos,
    canControl,
    rotatedView,
  };

  // ターンが変わったらスライダーを中央に戻す
  useEffect(() => {
    setSliderRatio(0.5);
  }, [state.turnIndex, state.round]);

  // 新ショット到着で60fps物理再生（リスタート時は完全リセット）
  useEffect(() => {
    const shot = state.lastShot;
    if (!shot) {
      lastPlayedShotIdRef.current = 0;
      animRef.current.active = false;
      setIsAnimating(false);
      setToastText(null);
      setHole20Banner(null);
      setRoundBanner(null);
      return;
    }
    if (shot.shotId === lastPlayedShotIdRef.current) return;
    lastPlayedShotIdRef.current = shot.shotId;

    animRef.current = {
      active: true,
      discs: shot.initialDiscs.map((d) => ({ ...d })),
      stepCount: 0,
      sparks: [],
      rings: [],
    };
    setIsAnimating(true);
    setToastText(null);
    setHole20Banner(null);
  }, [state.lastShot]);

  useEffect(() => {
    if (!toastText) return;
    const t = window.setTimeout(() => setToastText(null), 2400);
    return () => window.clearTimeout(t);
  }, [toastText]);

  useEffect(() => {
    if (!hole20Banner) return;
    const t = window.setTimeout(() => setHole20Banner(null), 2100);
    return () => window.clearTimeout(t);
  }, [hole20Banner]);

  useEffect(() => {
    if (!roundBanner) return;
    const t = window.setTimeout(() => setRoundBanner(null), 3400);
    return () => window.clearTimeout(t);
  }, [roundBanner]);

  // 60fps 描画＆物理再生ループ
  useEffect(() => {
    let rafId = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const {
            state: curState,
            shooterPreviewPos: curPreviewPos,
            canControl: curCanControl,
            rotatedView: curRotated,
          } = latestRef.current;
          const anim = animRef.current;

          if (anim.active) {
            const stepRes = simulateCrokinoleStep(anim.discs);
            anim.stepCount += 1;

            for (const hit of stepRes.collisions) {
              const count = Math.min(6, Math.ceil(hit.intensity * 6));
              for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2;
                const sp = 1.5 + Math.random() * 4.2 * hit.intensity;
                anim.sparks.push({
                  x: hit.x,
                  y: hit.y,
                  vx: Math.cos(a) * sp,
                  vy: Math.sin(a) * sp,
                  life: 0,
                  maxLife: 14 + Math.random() * 8,
                  color: hit.isPeg ? '#fde047' : '#fed7aa',
                  size: 2.5 + Math.random() * 2.5,
                });
              }
            }

            if (stepRes.newlyHole20Ids.length > 0) {
              anim.rings.push({
                x: CROKINOLE_CENTER,
                y: CROKINOLE_CENTER,
                life: 0,
                maxLife: 32,
                color: '#facc15',
                maxRadius: 92,
              });
              for (let i = 0; i < 14; i++) {
                const a = (i * Math.PI * 2) / 14;
                const sp = 2.5 + Math.random() * 4.5;
                anim.sparks.push({
                  x: CROKINOLE_CENTER,
                  y: CROKINOLE_CENTER,
                  vx: Math.cos(a) * sp,
                  vy: Math.sin(a) * sp,
                  life: 0,
                  maxLife: 24 + Math.random() * 8,
                  color: '#fef08a',
                  size: 3.5 + Math.random() * 2,
                });
              }
            }

            if (stepRes.newlyGutterIds.length > 0) {
              for (const gid of stepRes.newlyGutterIds) {
                const disc = anim.discs.find((d) => d.id === gid);
                if (!disc) continue;
                anim.rings.push({
                  x: disc.x,
                  y: disc.y,
                  life: 0,
                  maxLife: 22,
                  color: '#94a3b8',
                  maxRadius: 42,
                });
              }
            }

            if (!stepRes.moving || anim.stepCount >= CROKINOLE_MAX_STEPS) {
              anim.active = false;
              setIsAnimating(false);
              const shot = curState.lastShot;
              if (shot) {
                if (shot.hole20Ids.length > 0) {
                  setHole20Banner('20点ホールイン！');
                }
                if (shot.roundFinished && curState.lastRoundResult) {
                  const rr = curState.lastRoundResult;
                  const diffText =
                    rr.winnerIndex === null
                      ? '同点 (+0pt)'
                      : `${curState.players[rr.winnerIndex].name} +${rr.awardedPoints}pt`;
                  setRoundBanner(`R${rr.round} 採点: ${rr.p0Total} 対 ${rr.p1Total} → ${diffText}`);
                } else if (shot.summary) {
                  setToastText(shot.summary);
                }
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

          ctx.save();
          ctx.clearRect(0, 0, CROKINOLE_BOARD_SIZE, CROKINOLE_BOARD_SIZE);

          if (curRotated) {
            ctx.translate(CROKINOLE_BOARD_SIZE, CROKINOLE_BOARD_SIZE);
            ctx.rotate(Math.PI);
          }

          drawCrokinoleBoard(ctx, curState.turnIndex, curRotated);

          // 盤上ディスク描画
          const drawList = anim.active ? anim.discs : curState.discs;
          for (const d of drawList) {
            if (d.status !== 'board') continue;
            drawCrokinoleDisc(ctx, d, false);
          }

          // ドラッグ中のエイム＆パワーガイド
          const drag = dragRef.current;
          if (drag && !anim.active && curCanControl) {
            const pullX = drag.startX - drag.currX;
            const pullY = drag.startY - drag.currY;
            const pullDist = Math.hypot(pullX, pullY);

            if (pullDist >= MIN_DRAG_DIST) {
              const clampedDist = Math.min(MAX_DRAG_DIST, pullDist);
              const powerRatio = clampedDist / MAX_DRAG_DIST;
              const dirX = pullX / pullDist;
              const dirY = pullY / pullDist;

              const ringColor =
                powerRatio < 0.45 ? '#10b981' : powerRatio < 0.78 ? '#f59e0b' : '#ef4444';

              ctx.save();
              ctx.strokeStyle = ringColor;
              ctx.lineWidth = 5;
              ctx.beginPath();
              ctx.arc(
                curPreviewPos.x,
                curPreviewPos.y,
                CROKINOLE_DISC_RADIUS + 13 + powerRatio * 24,
                0,
                Math.PI * 2
              );
              ctx.stroke();

              // 後ろ引きライン
              const tailX = curPreviewPos.x - dirX * clampedDist * 0.7;
              const tailY = curPreviewPos.y - dirY * clampedDist * 0.7;
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.moveTo(curPreviewPos.x, curPreviewPos.y);
              ctx.lineTo(tailX, tailY);
              ctx.stroke();

              ctx.fillStyle = ringColor;
              ctx.beginPath();
              ctx.arc(tailX, tailY, 9, 0, Math.PI * 2);
              ctx.fill();

              // 前方エイム点線
              const rayLen = 180 + powerRatio * 340;
              ctx.strokeStyle = ringColor;
              ctx.lineWidth = 4;
              ctx.setLineDash([12, 10]);
              ctx.beginPath();
              ctx.moveTo(curPreviewPos.x, curPreviewPos.y);
              ctx.lineTo(curPreviewPos.x + dirX * rayLen, curPreviewPos.y + dirY * rayLen);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.restore();
            }
          }

          // 発射待機ディスクのプレビュー描画
          if (!anim.active && curState.phase === 'playing' && curState.players[curState.turnIndex].discsLeft > 0) {
            drawCrokinoleDisc(
              ctx,
              {
                x: curPreviewPos.x,
                y: curPreviewPos.y,
                ownerIndex: curState.turnIndex,
              },
              curCanControl
            );
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

          // エフェクトリング描画
          for (const rg of anim.rings) {
            const t = rg.life / rg.maxLife;
            ctx.strokeStyle = rg.color;
            ctx.lineWidth = 5 * (1 - t);
            ctx.globalAlpha = 1 - t;
            ctx.beginPath();
            ctx.arc(rg.x, rg.y, 18 + t * rg.maxRadius, 0, Math.PI * 2);
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
      if (!canvas) return { x: CROKINOLE_CENTER, y: CROKINOLE_CENTER };
      const rect = canvas.getBoundingClientRect();
      let x = ((clientX - rect.left) / rect.width) * CROKINOLE_BOARD_SIZE;
      let y = ((clientY - rect.top) / rect.height) * CROKINOLE_BOARD_SIZE;
      if (rotatedView) {
        x = CROKINOLE_BOARD_SIZE - x;
        y = CROKINOLE_BOARD_SIZE - y;
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
      CROKINOLE_MIN_SHOT_SPEED +
      Math.pow(powerRatio, 1.08) * (CROKINOLE_MAX_SHOT_SPEED - CROKINOLE_MIN_SHOT_SPEED);

    onAction(
      {
        type: 'shoot',
        payload: {
          angle: resolvedShootAngle,
          vx: (pullX / pullDist) * speed,
          vy: (pullY / pullDist) * speed,
        },
      },
      isLocalPassAndPlay ? activePlayer.id : undefined
    );
  };

  const p0 = state.players[0];
  const p1 = state.players[1];
  const winnerName =
    state.winnerId === 'draw'
      ? '引き分け'
      : state.players.find((p) => p.id === state.winnerId)?.name ?? '';

  return (
    <div className="crokinole-arena">
      <div className="crokinole-scoreboard">
        <div
          className={`crokinole-player-card ${
            state.turnIndex === 0 && state.phase === 'playing' ? 'active' : ''
          }`}
        >
          <div className="crokinole-disc-badge ivory" />
          <div className="crokinole-player-meta">
            <span className="crokinole-player-name">{p0.name}</span>
            <div className="crokinole-player-stats">
              <span className="crokinole-score-num">{p0.score}pt</span>
              <span>残{p0.discsLeft}</span>
              {p0.roundHole20Count > 0 && (
                <span className="crokinole-hole20-pill">20×{p0.roundHole20Count}</span>
              )}
            </div>
          </div>
        </div>

        <div className="crokinole-round-badge">
          <span className="crokinole-round-num">R{state.round}</span>
          <span className="crokinole-target-label">目標{state.rules.targetScore}</span>
        </div>

        <div
          className={`crokinole-player-card right ${
            state.turnIndex === 1 && state.phase === 'playing' ? 'active' : ''
          }`}
        >
          <div className="crokinole-disc-badge crimson" />
          <div className="crokinole-player-meta">
            <span className="crokinole-player-name">{p1.name}</span>
            <div className="crokinole-player-stats">
              {p1.roundHole20Count > 0 && (
                <span className="crokinole-hole20-pill">20×{p1.roundHole20Count}</span>
              )}
              <span>残{p1.discsLeft}</span>
              <span className="crokinole-score-num">{p1.score}pt</span>
            </div>
          </div>
        </div>
      </div>

      <div className="crokinole-board-stage">
        <canvas
          ref={canvasRef}
          width={CROKINOLE_BOARD_SIZE}
          height={CROKINOLE_BOARD_SIZE}
          className={`crokinole-canvas ${!canControl ? 'disabled' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => finishDrag(e, false)}
          onPointerCancel={(e) => finishDrag(e, true)}
        />
        {hole20Banner && (
          <div className="crokinole-hole20-banner">
            <Award size={16} />
            <span>{hole20Banner}</span>
          </div>
        )}
        {roundBanner && (
          <div className="crokinole-round-banner">{roundBanner}</div>
        )}
        {toastText && !roundBanner && (
          <div className="crokinole-shot-toast">{toastText}</div>
        )}
      </div>

      {state.phase === 'finished' && !isAnimating ? (
        <div className="crokinole-result-banner">
          <Trophy size={18} />
          <span>{state.winnerId === 'draw' ? '引き分け！' : `${winnerName} の勝利！`}</span>
        </div>
      ) : (
        <div className="crokinole-controls-panel">
          <div className="crokinole-slider-row">
            <span className="crokinole-slider-icon" aria-hidden="true">
              <MoveHorizontal size={18} />
            </span>
            <input
              type="range"
              className="crokinole-slider"
              min={0}
              max={1}
              step={0.01}
              value={sliderRatio}
              disabled={!canControl}
              onChange={(e) => setSliderRatio(Number(e.target.value))}
              aria-label="発射ライン上の位置"
            />
          </div>
          <div className="crokinole-status-row">
            <span className="crokinole-status-hint">
              <Crosshair size={14} />
              {isAnimating
                ? 'ショット中...'
                : canControl
                ? `${activePlayer.name} の番: 後ろに引いて発射`
                : `${activePlayer.name} のショットを待機中`}
            </span>
            <span>{activePlayer.color === 'ivory' ? '白木' : '紅木'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
