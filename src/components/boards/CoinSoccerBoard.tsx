import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Flame, Trophy } from 'lucide-react';
import {
  COIN_SOCCER_COIN_RADIUS,
  COIN_SOCCER_GOAL_DEPTH,
  COIN_SOCCER_GOAL_LEFT,
  COIN_SOCCER_GOAL_RIGHT,
  COIN_SOCCER_GOAL_WIDTH,
  COIN_SOCCER_HEIGHT,
  COIN_SOCCER_MAX_SPEED,
  COIN_SOCCER_MAX_STEPS,
  COIN_SOCCER_MIN_SPEED,
  COIN_SOCCER_POST_RADIUS,
  COIN_SOCCER_POSTS,
  COIN_SOCCER_WALL_INSET,
  COIN_SOCCER_WIDTH,
  simulateCoinSoccerStep,
  type CoinIndex,
  type CoinSoccerClientState,
  type CoinSoccerCoin,
} from '../../games/coinSoccer';
import './CoinSoccerBoard.css';

interface CoinSoccerBoardProps {
  state: CoinSoccerClientState;
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

interface PulseRing {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  maxRadius: number;
}

interface DragAimState {
  pointerId: number;
  coinIndex: CoinIndex;
  startX: number;
  startY: number;
  currX: number;
  currY: number;
}

const MAX_DRAG_DIST = 185;
const MIN_DRAG_DIST = 16;

function drawPitchBackground(ctx: CanvasRenderingContext2D, rotatedView: boolean): void {
  const W = COIN_SOCCER_WIDTH;
  const H = COIN_SOCCER_HEIGHT;
  const inset = COIN_SOCCER_WALL_INSET;
  const pitchW = W - inset * 2;
  const pitchH = H - inset * 2;

  // 外周（ダークターフ）
  ctx.fillStyle = '#0d261a';
  ctx.fillRect(0, 0, W, H);

  // 芝生ピッチのベース（ストライプ）
  ctx.save();
  ctx.beginPath();
  ctx.rect(inset, inset, pitchW, pitchH);
  ctx.clip();

  const stripeCount = 10;
  const stripeH = pitchH / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1b6e3a' : '#175e31';
    ctx.fillRect(inset, inset + i * stripeH, pitchW, stripeH + 1);
  }

  // 芝生の繊細なライティング
  const turfGrad = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, H * 0.62);
  turfGrad.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
  turfGrad.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
  ctx.fillStyle = turfGrad;
  ctx.fillRect(inset, inset, pitchW, pitchH);
  ctx.restore();

  // 上下ゴールネット背景（奥側＝相手ゴール / 手前側＝自陣ゴール）
  const drawGoalNet = (isTop: boolean) => {
    const gx = COIN_SOCCER_GOAL_LEFT;
    const gy = isTop ? inset - COIN_SOCCER_GOAL_DEPTH : H - inset;
    const gw = COIN_SOCCER_GOAL_WIDTH;
    const gh = COIN_SOCCER_GOAL_DEPTH;

    // チームカラーアクセント（P0は下側ブルー・上側レッドへ攻める）
    const isP1Goal = isTop; // 論理上 top は P1 のゴール（P0が攻める）
    ctx.fillStyle = isP1Goal ? 'rgba(239, 68, 68, 0.18)' : 'rgba(59, 130, 246, 0.18)';
    ctx.fillRect(gx, gy, gw, gh);

    // ネット格子
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = gx + 14; x < gx + gw; x += 14) {
      ctx.moveTo(x, gy);
      ctx.lineTo(x, gy + gh);
    }
    for (let y = gy + 9; y < gy + gh; y += 9) {
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + gw, y);
    }
    ctx.stroke();

    // ゴール枠
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (isTop) {
      ctx.moveTo(gx, inset);
      ctx.lineTo(gx, gy);
      ctx.lineTo(gx + gw, gy);
      ctx.lineTo(gx + gw, inset);
    } else {
      ctx.moveTo(gx, H - inset);
      ctx.lineTo(gx, gy + gh);
      ctx.lineTo(gx + gw, gy + gh);
      ctx.lineTo(gx + gw, H - inset);
    }
    ctx.stroke();
  };

  drawGoalNet(true);
  drawGoalNet(false);

  // ピッチ白線
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.lineWidth = 3;

  // 外枠（ゴール開口部を空ける）
  ctx.beginPath();
  // 左辺
  ctx.moveTo(inset, inset);
  ctx.lineTo(inset, H - inset);
  // 右辺
  ctx.moveTo(W - inset, inset);
  ctx.lineTo(W - inset, H - inset);
  // 上辺（ゴール左・右）
  ctx.moveTo(inset, inset);
  ctx.lineTo(COIN_SOCCER_GOAL_LEFT, inset);
  ctx.moveTo(COIN_SOCCER_GOAL_RIGHT, inset);
  ctx.lineTo(W - inset, inset);
  // 下辺（ゴール左・右）
  ctx.moveTo(inset, H - inset);
  ctx.lineTo(COIN_SOCCER_GOAL_LEFT, H - inset);
  ctx.moveTo(COIN_SOCCER_GOAL_RIGHT, H - inset);
  ctx.lineTo(W - inset, H - inset);
  ctx.stroke();

  // ゴールライン（薄い点線）
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(COIN_SOCCER_GOAL_LEFT, inset);
  ctx.lineTo(COIN_SOCCER_GOAL_RIGHT, inset);
  ctx.moveTo(COIN_SOCCER_GOAL_LEFT, H - inset);
  ctx.lineTo(COIN_SOCCER_GOAL_RIGHT, H - inset);
  ctx.stroke();
  ctx.restore();

  // ハーフウェイライン＆センターサークル
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(inset, H / 2);
  ctx.lineTo(W - inset, H / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 74, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 5, 0, Math.PI * 2);
  ctx.fill();

  // 上下ペナルティエリア＆ゴールエリア
  const penW = 320;
  const penH = 128;
  const gBoxW = 220;
  const gBoxH = 52;
  ctx.strokeRect((W - penW) / 2, inset, penW, penH);
  ctx.strokeRect((W - gBoxW) / 2, inset, gBoxW, gBoxH);
  ctx.strokeRect((W - penW) / 2, H - inset - penH, penW, penH);
  ctx.strokeRect((W - gBoxW) / 2, H - inset - gBoxH, gBoxW, gBoxH);

  // ペナルティアーク
  ctx.beginPath();
  ctx.arc(W / 2, inset + 92, 62, 0.22 * Math.PI, 0.78 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H - inset - 92, 62, 1.22 * Math.PI, 1.78 * Math.PI);
  ctx.stroke();

  // 金属ゴールポスト（4本）
  for (const post of COIN_SOCCER_POSTS) {
    const pGrad = ctx.createRadialGradient(
      post.x - 2,
      post.y - 2,
      1,
      post.x,
      post.y,
      COIN_SOCCER_POST_RADIUS
    );
    pGrad.addColorStop(0, '#ffffff');
    pGrad.addColorStop(0.65, '#cbd5e1');
    pGrad.addColorStop(1, '#475569');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(post.x, post.y, COIN_SOCCER_POST_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 攻め方向の控えめな矢印透かし（rotatedView 考慮）
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  const drawChevron = (cy: number, dirY: number) => {
    ctx.beginPath();
    ctx.moveTo(W / 2, cy + dirY * 18);
    ctx.lineTo(W / 2 - 22, cy - dirY * 8);
    ctx.lineTo(W / 2 - 12, cy - dirY * 8);
    ctx.lineTo(W / 2, cy + dirY * 6);
    ctx.lineTo(W / 2 + 12, cy - dirY * 8);
    ctx.lineTo(W / 2 + 22, cy - dirY * 8);
    ctx.closePath();
    ctx.fill();
  };
  if (rotatedView) {
    drawChevron(H / 2 + 130, 1);
  } else {
    drawChevron(H / 2 - 130, -1);
  }
  ctx.restore();
}

function drawGateGuide(
  ctx: CanvasRenderingContext2D,
  coins: readonly [CoinSoccerCoin, CoinSoccerCoin, CoinSoccerCoin],
  selectedIndex: CoinIndex
): void {
  const others = coins.filter((_, i) => i !== selectedIndex);
  if (others.length !== 2) return;
  const [a, b] = others;
  if (a.outOfBounds || b.outOfBounds || a.inGoal !== null || b.inGoal !== null) return;

  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const canFit = dist > COIN_SOCCER_COIN_RADIUS * 2.08;
  const gateColor = canFit ? 'rgba(52, 211, 153, 0.85)' : 'rgba(248, 113, 113, 0.8)';
  const glowColor = canFit ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.28)';

  ctx.save();
  // グロー帯
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  // 破線ゲート
  ctx.strokeStyle = gateColor;
  ctx.lineWidth = 3.5;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // ゲート中央のターゲットドット
  const mx = (a.x + b.x) * 0.5;
  const my = (a.y + b.y) * 0.5;
  ctx.fillStyle = gateColor;
  ctx.beginPath();
  ctx.arc(mx, my, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCoin(
  ctx: CanvasRenderingContext2D,
  coin: CoinSoccerCoin,
  isSelected: boolean,
  rotatedView: boolean
): void {
  if (coin.outOfBounds) return;
  const { x, y, id } = coin;
  const r = COIN_SOCCER_COIN_RADIUS;

  ctx.save();

  if (isSelected) {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r + 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ドロップシャドウ
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.arc(x + 3, y + 5, r, 0, Math.PI * 2);
  ctx.fill();

  // メタリックコイン本体（シルバー/ゴールド調）
  const grad = ctx.createRadialGradient(x - r * 0.32, y - r * 0.35, 3, x, y, r);
  if (isSelected) {
    grad.addColorStop(0, '#fffbeb');
    grad.addColorStop(0.55, '#fcd34d');
    grad.addColorStop(0.88, '#d97706');
    grad.addColorStop(1, '#78350f');
  } else {
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(0.58, '#cbd5e1');
    grad.addColorStop(0.88, '#64748b');
    grad.addColorStop(1, '#334155');
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // ギザ縁風リング
  ctx.strokeStyle = isSelected ? '#fef08a' : 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.strokeStyle = isSelected ? 'rgba(120, 53, 15, 0.55)' : 'rgba(30, 41, 59, 0.45)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();

  // コイン番号（回転ビューでも読みやすい向きに描画）
  ctx.translate(x, y);
  if (rotatedView) ctx.rotate(Math.PI);
  ctx.fillStyle = isSelected ? '#78350f' : '#1e293b';
  ctx.font = '900 18px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(id + 1), 0, 1);

  ctx.restore();
}

export const CoinSoccerBoard: React.FC<CoinSoccerBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedCoin, setSelectedCoin] = useState<CoinIndex>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const [goalBanner, setGoalBanner] = useState<string | null>(null);

  const myPlayerIndex = useMemo<0 | 1>(() => {
    return state.players[1].id === state.myId ? 1 : 0;
  }, [state.players, state.myId]);

  const rotatedView = !isLocalPassAndPlay && myPlayerIndex === 1;
  const activePlayer = state.players[state.turnIndex];
  const isMyTurn =
    state.phase === 'playing' &&
    (isLocalPassAndPlay ? !activePlayer.isBot : activePlayer.id === state.myId);
  const canControl = isMyTurn && !isAnimating;

  const animRef = useRef<{
    active: boolean;
    coins: [CoinSoccerCoin, CoinSoccerCoin, CoinSoccerCoin];
    flickedIndex: CoinIndex;
    stepCount: number;
    gateFlashed: boolean;
    sparks: SparkParticle[];
    rings: PulseRing[];
  }>({
    active: false,
    coins: state.coins.map((c) => ({ ...c })) as [CoinSoccerCoin, CoinSoccerCoin, CoinSoccerCoin],
    flickedIndex: 0,
    stepCount: 0,
    gateFlashed: false,
    sparks: [],
    rings: [],
  });

  const dragRef = useRef<DragAimState | null>(null);
  const lastPlayedShotIdRef = useRef<number>(state.lastShot?.shotId ?? 0);

  const latestRef = useRef({
    state,
    selectedCoin,
    canControl,
    rotatedView,
  });
  latestRef.current = {
    state,
    selectedCoin,
    canControl,
    rotatedView,
  };

  // 新ショット受信時に60fps物理再生を開始（リスタート時は完全リセット）
  useEffect(() => {
    const shot = state.lastShot;
    if (!shot) {
      lastPlayedShotIdRef.current = 0;
      animRef.current.active = false;
      setIsAnimating(false);
      setToastText(null);
      setGoalBanner(null);
      return;
    }
    if (shot.shotId === lastPlayedShotIdRef.current) return;
    lastPlayedShotIdRef.current = shot.shotId;

    animRef.current = {
      active: true,
      coins: [
        { ...shot.initialCoins[0] },
        { ...shot.initialCoins[1] },
        { ...shot.initialCoins[2] },
      ],
      flickedIndex: shot.coinIndex,
      stepCount: 0,
      gateFlashed: false,
      sparks: [],
      rings: [],
    };
    setSelectedCoin(shot.coinIndex);
    setIsAnimating(true);
    setToastText(null);
    setGoalBanner(null);
  }, [state.lastShot]);

  useEffect(() => {
    if (!toastText) return;
    const timer = window.setTimeout(() => setToastText(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toastText]);

  useEffect(() => {
    if (!goalBanner) return;
    const timer = window.setTimeout(() => setGoalBanner(null), 2200);
    return () => window.clearTimeout(timer);
  }, [goalBanner]);

  // 60fps 物理再生＆描画ループ
  useEffect(() => {
    let rafId = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const {
            state: curState,
            selectedCoin: curSelected,
            canControl: curCanControl,
            rotatedView: curRotated,
          } = latestRef.current;
          const anim = animRef.current;

          if (anim.active) {
            const stepRes = simulateCoinSoccerStep(anim.coins, anim.flickedIndex);
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
                  color: '#fca5a5',
                  size: 2.5 + Math.random() * 2.5,
                });
              }
            }

            if (stepRes.passedGateNow && !anim.gateFlashed) {
              anim.gateFlashed = true;
              const fc = anim.coins[anim.flickedIndex];
              anim.rings.push({
                x: fc.x,
                y: fc.y,
                life: 0,
                maxLife: 24,
                color: '#34d399',
                maxRadius: 68,
              });
            }

            if (stepRes.goalScored) {
              const fc = anim.coins[anim.flickedIndex];
              anim.rings.push({
                x: fc.x,
                y: fc.y,
                life: 0,
                maxLife: 34,
                color: '#facc15',
                maxRadius: 96,
              });
            }

            if (!stepRes.moving || anim.stepCount >= COIN_SOCCER_MAX_STEPS) {
              anim.active = false;
              setIsAnimating(false);
              if (curState.lastShot) {
                if (curState.lastShot.outcome === 'goal') {
                  setGoalBanner(curState.lastShot.summary);
                } else {
                  setToastText(curState.lastShot.summary);
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
          ctx.clearRect(0, 0, COIN_SOCCER_WIDTH, COIN_SOCCER_HEIGHT);

          if (curRotated) {
            ctx.translate(COIN_SOCCER_WIDTH, COIN_SOCCER_HEIGHT);
            ctx.rotate(Math.PI);
          }

          drawPitchBackground(ctx, curRotated);

          const drawCoinsList = anim.active ? anim.coins : curState.coins;
          const activeCoinIdx = anim.active
            ? anim.flickedIndex
            : dragRef.current?.coinIndex ?? curSelected;

          // ゲート破線ガイド（操作可能時・再生中とも表示して分かりやすく）
          if (curState.phase === 'playing' || anim.active) {
            drawGateGuide(ctx, drawCoinsList, activeCoinIdx);
          }

          // ドラッグ中のエイム＆パワーガイド
          const drag = dragRef.current;
          if (drag && !anim.active && curCanControl) {
            const coin = curState.coins[drag.coinIndex];
            const pullX = drag.startX - drag.currX;
            const pullY = drag.startY - drag.currY;
            const pullDist = Math.hypot(pullX, pullY);

            if (pullDist >= MIN_DRAG_DIST) {
              const clampedDist = Math.min(MAX_DRAG_DIST, pullDist);
              const powerRatio = clampedDist / MAX_DRAG_DIST;
              const dirX = pullX / pullDist;
              const dirY = pullY / pullDist;

              const ringColor =
                powerRatio < 0.45 ? '#34d399' : powerRatio < 0.78 ? '#f59e0b' : '#ef4444';

              ctx.save();
              // パワーリング
              ctx.strokeStyle = ringColor;
              ctx.lineWidth = 4.5;
              ctx.beginPath();
              ctx.arc(coin.x, coin.y, COIN_SOCCER_COIN_RADIUS + 12 + powerRatio * 22, 0, Math.PI * 2);
              ctx.stroke();

              // 後ろ引きライン
              const tailX = coin.x - dirX * clampedDist * 0.72;
              const tailY = coin.y - dirY * clampedDist * 0.72;
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
              ctx.lineWidth = 3.5;
              ctx.beginPath();
              ctx.moveTo(coin.x, coin.y);
              ctx.lineTo(tailX, tailY);
              ctx.stroke();

              ctx.fillStyle = ringColor;
              ctx.beginPath();
              ctx.arc(tailX, tailY, 8, 0, Math.PI * 2);
              ctx.fill();

              // 前方エイム点線
              const rayLen = 140 + powerRatio * 240;
              ctx.strokeStyle = ringColor;
              ctx.lineWidth = 3.5;
              ctx.setLineDash([10, 8]);
              ctx.beginPath();
              ctx.moveTo(coin.x, coin.y);
              ctx.lineTo(coin.x + dirX * rayLen, coin.y + dirY * rayLen);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.restore();
            }
          }

          // 3枚のコインを描画
          for (let i = 0; i < 3; i++) {
            const c = drawCoinsList[i];
            const isSel =
              (curCanControl || anim.active) && i === activeCoinIdx;
            drawCoin(ctx, c, isSel, curRotated);
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

          // ゲート通過 / ゴールリング描画
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
      if (!canvas) return { x: COIN_SOCCER_WIDTH / 2, y: COIN_SOCCER_HEIGHT / 2 };
      const rect = canvas.getBoundingClientRect();
      let x = ((clientX - rect.left) / rect.width) * COIN_SOCCER_WIDTH;
      let y = ((clientY - rect.top) / rect.height) * COIN_SOCCER_HEIGHT;
      if (rotatedView) {
        x = COIN_SOCCER_WIDTH - x;
        y = COIN_SOCCER_HEIGHT - y;
      }
      return { x, y };
    },
    [rotatedView]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canControl) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = toLogicalCoords(e.clientX, e.clientY);

    // タップした位置に最も近いコインが半径+32px以内なら自動選択
    let chosen: CoinIndex = selectedCoin;
    let nearestDist = COIN_SOCCER_COIN_RADIUS + 34;
    for (let i = 0; i < 3; i++) {
      const c = state.coins[i];
      const d = Math.hypot(c.x - pt.x, c.y - pt.y);
      if (d < nearestDist) {
        nearestDist = d;
        chosen = i as CoinIndex;
      }
    }
    setSelectedCoin(chosen);

    dragRef.current = {
      pointerId: e.pointerId,
      coinIndex: chosen,
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
      COIN_SOCCER_MIN_SPEED +
      Math.pow(powerRatio, 1.06) * (COIN_SOCCER_MAX_SPEED - COIN_SOCCER_MIN_SPEED);

    onAction(
      {
        type: 'flick',
        payload: {
          coinIndex: drag.coinIndex,
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
    <div className="coinsoccer-arena">
      <div className="coinsoccer-scoreboard">
        <div
          className={`coinsoccer-player-card ${
            state.turnIndex === 0 && state.phase === 'playing' ? 'active' : ''
          }`}
        >
          <span className="coinsoccer-team-dot blue" />
          <div className="coinsoccer-player-meta">
            <span className="coinsoccer-player-name">{p0.name}</span>
            <span className="coinsoccer-player-sub">上へ攻め</span>
          </div>
          <span className="coinsoccer-score-num">{p0.score}</span>
        </div>

        <div className="coinsoccer-mid-badge">
          <span className="coinsoccer-goal-target">{state.rules.winScore}点先取</span>
          {state.passStreak > 0 && state.phase === 'playing' && (
            <span className="coinsoccer-streak-pill">
              <Flame size={11} /> {state.passStreak}連続
            </span>
          )}
        </div>

        <div
          className={`coinsoccer-player-card right ${
            state.turnIndex === 1 && state.phase === 'playing' ? 'active' : ''
          }`}
        >
          <span className="coinsoccer-team-dot red" />
          <div className="coinsoccer-player-meta">
            <span className="coinsoccer-player-name">{p1.name}</span>
            <span className="coinsoccer-player-sub">下へ攻め</span>
          </div>
          <span className="coinsoccer-score-num">{p1.score}</span>
        </div>
      </div>

      <div className="coinsoccer-pitch-stage">
        <canvas
          ref={canvasRef}
          width={COIN_SOCCER_WIDTH}
          height={COIN_SOCCER_HEIGHT}
          className={`coinsoccer-canvas ${!canControl ? 'disabled' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => finishDrag(e, false)}
          onPointerCancel={(e) => finishDrag(e, true)}
        />
        {goalBanner && <div className="coinsoccer-goal-banner">{goalBanner}</div>}
        {toastText && !goalBanner && <div className="coinsoccer-toast">{toastText}</div>}
      </div>

      {state.phase === 'finished' && !isAnimating ? (
        <div className="coinsoccer-result-banner">
          <Trophy size={18} />
          <span>{state.winnerId === 'draw' ? '引き分け！' : `${winnerName} の勝利！`}</span>
        </div>
      ) : (
        <div className="coinsoccer-controls">
          <div className="coinsoccer-coin-selector" role="group" aria-label="弾くコインを選択">
            {([0, 1, 2] as CoinIndex[]).map((idx) => (
              <button
                key={idx}
                type="button"
                className={`coinsoccer-coin-btn ${selectedCoin === idx ? 'selected' : ''}`}
                disabled={!canControl}
                onClick={() => setSelectedCoin(idx)}
              >
                #{idx + 1}
              </button>
            ))}
          </div>
          <div className="coinsoccer-status-hint">
            <Crosshair size={14} />
            <span>
              {isAnimating
                ? 'シュート中...'
                : canControl
                ? `${activePlayer.name}: 破線の間を通して弾く`
                : `${activePlayer.name} の番を待機中`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
