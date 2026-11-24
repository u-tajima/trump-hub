import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Trophy, Zap } from 'lucide-react';
import type { AirHockeyClientState } from '../../games/airhockey';
import './AirHockeyBoard.css';

interface AirHockeyBoardProps {
  state: AirHockeyClientState;
  onAction: (action: { type: string; payload?: unknown }, overrideActorId?: string) => void;
  isLocalPassAndPlay?: boolean;
}

const TABLE_W = 600;
const TABLE_H = 960;
const WALL_PAD = 14;
const GOAL_WIDTH = 224;
const GOAL_LEFT = (TABLE_W - GOAL_WIDTH) / 2;
const GOAL_RIGHT = (TABLE_W + GOAL_WIDTH) / 2;
const MALLET_R = 40;
const PUCK_R = 24;
const SUBSTEPS = 4;

interface MalletBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
}

interface PuckBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Ripple {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function clampMalletPos(
  x: number,
  y: number,
  side: 'bottom' | 'top'
): { x: number; y: number } {
  const minX = WALL_PAD + MALLET_R;
  const maxX = TABLE_W - WALL_PAD - MALLET_R;
  const cx = clamp(x, minX, maxX);

  if (side === 'bottom') {
    const minY = TABLE_H / 2 + MALLET_R + 4;
    const maxY = TABLE_H - WALL_PAD - MALLET_R;
    return { x: cx, y: clamp(y, minY, maxY) };
  }
  const minY = WALL_PAD + MALLET_R;
  const maxY = TABLE_H / 2 - MALLET_R - 4;
  return { x: cx, y: clamp(y, minY, maxY) };
}

function drawNeonTable(ctx: CanvasRenderingContext2D): void {
  // ベース背景
  const bg = ctx.createLinearGradient(0, 0, 0, TABLE_H);
  bg.addColorStop(0, '#0a1224');
  bg.addColorStop(0.5, '#070d1a');
  bg.addColorStop(1, '#091628');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, TABLE_W, TABLE_H);

  // 微細なグリッド
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 60; x < TABLE_W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, WALL_PAD);
    ctx.lineTo(x, TABLE_H - WALL_PAD);
    ctx.stroke();
  }
  for (let y = 60; y < TABLE_H; y += 60) {
    ctx.beginPath();
    ctx.moveTo(WALL_PAD, y);
    ctx.lineTo(TABLE_W - WALL_PAD, y);
    ctx.stroke();
  }

  // 外周ネオンフレーム（ゴール開口部を除く）
  ctx.save();
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';

  // 左・右壁
  ctx.strokeStyle = '#38bdf8';
  ctx.shadowColor = '#0ea5e9';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(WALL_PAD, WALL_PAD);
  ctx.lineTo(WALL_PAD, TABLE_H - WALL_PAD);
  ctx.moveTo(TABLE_W - WALL_PAD, WALL_PAD);
  ctx.lineTo(TABLE_W - WALL_PAD, TABLE_H - WALL_PAD);
  ctx.stroke();

  // 上壁（左右）
  ctx.strokeStyle = '#fb7185';
  ctx.shadowColor = '#f43f5e';
  ctx.beginPath();
  ctx.moveTo(WALL_PAD, WALL_PAD);
  ctx.lineTo(GOAL_LEFT, WALL_PAD);
  ctx.moveTo(GOAL_RIGHT, WALL_PAD);
  ctx.lineTo(TABLE_W - WALL_PAD, WALL_PAD);
  ctx.stroke();

  // 下壁（左右）
  ctx.strokeStyle = '#22d3ee';
  ctx.shadowColor = '#06b6d4';
  ctx.beginPath();
  ctx.moveTo(WALL_PAD, TABLE_H - WALL_PAD);
  ctx.lineTo(GOAL_LEFT, TABLE_H - WALL_PAD);
  ctx.moveTo(GOAL_RIGHT, TABLE_H - WALL_PAD);
  ctx.lineTo(TABLE_W - WALL_PAD, TABLE_H - WALL_PAD);
  ctx.stroke();

  // 上ゴールスロット
  ctx.shadowBlur = 18;
  ctx.strokeStyle = 'rgba(251, 113, 133, 0.75)';
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(GOAL_LEFT, WALL_PAD);
  ctx.lineTo(GOAL_RIGHT, WALL_PAD);
  ctx.stroke();

  // 下ゴールスロット
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.75)';
  ctx.beginPath();
  ctx.moveTo(GOAL_LEFT, TABLE_H - WALL_PAD);
  ctx.lineTo(GOAL_RIGHT, TABLE_H - WALL_PAD);
  ctx.stroke();
  ctx.setLineDash([]);

  // ゴールクリース（半円）
  ctx.shadowBlur = 10;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(251, 113, 133, 0.45)';
  ctx.beginPath();
  ctx.arc(TABLE_W / 2, WALL_PAD, GOAL_WIDTH * 0.54, 0, Math.PI);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
  ctx.beginPath();
  ctx.arc(TABLE_W / 2, TABLE_H - WALL_PAD, GOAL_WIDTH * 0.54, Math.PI, Math.PI * 2);
  ctx.stroke();

  // センターライン
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(WALL_PAD + 4, TABLE_H / 2);
  ctx.lineTo(TABLE_W - WALL_PAD - 4, TABLE_H / 2);
  ctx.stroke();

  // センターサークル
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(TABLE_W / 2, TABLE_H / 2, 74, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.beginPath();
  ctx.arc(TABLE_W / 2, TABLE_H / 2, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawMallet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  primary: string,
  glow: string
): void {
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 18;

  // 外側リング
  const outerGrad = ctx.createRadialGradient(x - 10, y - 10, 6, x, y, MALLET_R);
  outerGrad.addColorStop(0, '#ffffff');
  outerGrad.addColorStop(0.32, primary);
  outerGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(x, y, MALLET_R, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = primary;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // 内側グリップ
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0b1324';
  ctx.beginPath();
  ctx.arc(x, y, MALLET_R * 0.52, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, MALLET_R * 0.34, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawPuck(
  ctx: CanvasRenderingContext2D,
  puck: PuckBody,
  trail: { x: number; y: number }[]
): void {
  // 残像トレイル
  for (let i = 0; i < trail.length; i++) {
    const t = (i + 1) / (trail.length + 1);
    const pt = trail[i];
    ctx.fillStyle = `rgba(251, 191, 36, ${t * 0.28})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, PUCK_R * (0.45 + t * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 20;

  const grad = ctx.createRadialGradient(puck.x - 6, puck.y - 6, 3, puck.x, puck.y, PUCK_R);
  grad.addColorStop(0, '#fffbeb');
  grad.addColorStop(0.55, '#fbbf24');
  grad.addColorStop(1, '#b45309');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(puck.x, puck.y, PUCK_R, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#fef3c7';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(120, 53, 15, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(puck.x, puck.y, PUCK_R * 0.52, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

export const AirHockeyBoard: React.FC<AirHockeyBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const myPlayerIndex = useMemo<0 | 1>(() => {
    return state.players[1].id === state.myId ? 1 : 0;
  }, [state.players, state.myId]);

  // オンライン対戦で自分が Player 1 のときは上下反転表示（自分が常に下側コート）
  const rotatedView = !isLocalPassAndPlay && myPlayerIndex === 1;
  const isCpuMatch = !isLocalPassAndPlay && state.players[1].isBot;
  const isOnlineGuest = !isLocalPassAndPlay && !isCpuMatch && myPlayerIndex === 1;

  // 物理シミュレーション状態（60fpsループ専用）
  const simRef = useRef<{
    puck: PuckBody;
    guestTargetPuck: PuckBody & { hasSnapshot: boolean };
    mallets: [MalletBody, MalletBody];
    trail: { x: number; y: number }[];
    sparks: Spark[];
    ripples: Ripple[];
    rallyCount: number;
    goalPauseFrames: number;
    goalFlashAlpha: number;
    goalFlashColor: string;
    goalBannerText: string;
    lastSyncSentAt: number;
    lastGoalSeqSeen: number;
  }>({
    puck: { x: TABLE_W / 2, y: TABLE_H / 2, vx: 0, vy: 0 },
    guestTargetPuck: { x: TABLE_W / 2, y: TABLE_H / 2, vx: 0, vy: 0, hasSnapshot: false },
    mallets: [
      { x: TABLE_W / 2, y: TABLE_H - 150, vx: 0, vy: 0, targetX: TABLE_W / 2, targetY: TABLE_H - 150 },
      { x: TABLE_W / 2, y: 150, vx: 0, vy: 0, targetX: TABLE_W / 2, targetY: 150 },
    ],
    trail: [],
    sparks: [],
    ripples: [],
    rallyCount: 0,
    goalPauseFrames: 30,
    goalFlashAlpha: 0,
    goalFlashColor: '#22d3ee',
    goalBannerText: 'FACE OFF',
    lastSyncSentAt: 0,
    lastGoalSeqSeen: state.lastGoalSeq,
  });

  // マルチタッチ追跡: pointerId -> 'bottom' (Player 0) | 'top' (Player 1)
  const pointersRef = useRef<Map<number, 'bottom' | 'top'>>(new Map());

  const latestRef = useRef({
    state,
    onAction,
    isLocalPassAndPlay,
    isCpuMatch,
    isOnlineGuest,
    rotatedView,
  });
  latestRef.current = {
    state,
    onAction,
    isLocalPassAndPlay,
    isCpuMatch,
    isOnlineGuest,
    rotatedView,
  };

  // リスタート時（スコア0-0, lastGoalSeq===0）に盤面リセット
  useEffect(() => {
    if (state.scores[0] === 0 && state.scores[1] === 0 && state.lastGoalSeq === 0) {
      const sim = simRef.current;
      sim.puck = { x: TABLE_W / 2, y: TABLE_H / 2, vx: 0, vy: 0 };
      sim.guestTargetPuck = { x: TABLE_W / 2, y: TABLE_H / 2, vx: 0, vy: 0, hasSnapshot: false };
      sim.mallets[0] = {
        x: TABLE_W / 2,
        y: TABLE_H - 150,
        vx: 0,
        vy: 0,
        targetX: TABLE_W / 2,
        targetY: TABLE_H - 150,
      };
      sim.mallets[1] = {
        x: TABLE_W / 2,
        y: 150,
        vx: 0,
        vy: 0,
        targetX: TABLE_W / 2,
        targetY: 150,
      };
      sim.trail = [];
      sim.rallyCount = 0;
      sim.goalPauseFrames = 24;
      sim.goalBannerText = 'FACE OFF';
      sim.lastGoalSeqSeen = 0;
    }
  }, [state.scores, state.lastGoalSeq]);

  // プレイ中以外はポインタ追跡と視覚エフェクトをクリア
  useEffect(() => {
    if (state.phase !== 'playing') {
      pointersRef.current.clear();
      const sim = simRef.current;
      sim.goalFlashAlpha = 0;
      sim.sparks = [];
      sim.ripples = [];
    }
  }, [state.phase]);

  // オンライン同期スナップショット受信反映
  useEffect(() => {
    const snap = state.syncSnapshot;
    if (!snap) return;
    const sim = simRef.current;

    if (isOnlineGuest) {
      const jumpDist = Math.hypot(snap.puckX - sim.puck.x, snap.puckY - sim.puck.y);
      const shouldSnapDirectly = !sim.guestTargetPuck.hasSnapshot || jumpDist > 180;
      sim.guestTargetPuck = {
        x: snap.puckX,
        y: snap.puckY,
        vx: snap.puckVx,
        vy: snap.puckVy,
        hasSnapshot: true,
      };
      if (shouldSnapDirectly) {
        sim.puck.x = snap.puckX;
        sim.puck.y = snap.puckY;
      }
      sim.puck.vx = snap.puckVx;
      sim.puck.vy = snap.puckVy;
      sim.mallets[0].targetX = snap.mallet0X;
      sim.mallets[0].targetY = snap.mallet0Y;
    } else if (!isLocalPassAndPlay && !isCpuMatch) {
      // ホストはゲスト側マレット(1)の位置を受信
      sim.mallets[1].targetX = snap.mallet1X;
      sim.mallets[1].targetY = snap.mallet1Y;
    }
  }, [state.syncSnapshot, isOnlineGuest, isLocalPassAndPlay, isCpuMatch]);

  // ゲスト側でもゴールフラッシュ演出を同期
  useEffect(() => {
    const sim = simRef.current;
    if (state.lastGoalSeq !== sim.lastGoalSeqSeen) {
      sim.lastGoalSeqSeen = state.lastGoalSeq;
      const p0Scored = state.lastGoalBy === state.players[0].id;
      sim.goalFlashAlpha = 0.75;
      sim.goalFlashColor = p0Scored ? '#22d3ee' : '#fb7185';
      sim.goalBannerText = 'GOAL!';
      sim.goalPauseFrames = 56;
    }
  }, [state.lastGoalSeq, state.lastGoalBy, state.players]);

  const spawnHitEffects = (x: number, y: number, color: string, count: number) => {
    const sim = simRef.current;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 7.5;
      sim.sparks.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0,
        maxLife: 16 + Math.random() * 12,
        color,
        size: 2.5 + Math.random() * 3,
      });
    }
    if (sim.sparks.length > 48) {
      sim.sparks.splice(0, sim.sparks.length - 48);
    }
    sim.ripples.push({
      x,
      y,
      life: 0,
      maxLife: 20,
      color,
    });
  };

  // 60fps メイン物理＆描画ループ
  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      const {
        state: curState,
        onAction: dispatchAction,
        isLocalPassAndPlay: curLocal,
        isCpuMatch: curCpu,
        isOnlineGuest: curGuest,
        rotatedView: curRotated,
      } = latestRef.current;

      const sim = simRef.current;
      const isFast = curState.rules.puckSpeed === 'fast';
      const maxPuckSpeed = isFast ? 28 : 22;
      const friction = isFast ? 0.9965 : 0.9945;

      // CPU AI（Player 1 = 上側マレット）
      if (curCpu && curState.phase === 'playing') {
        const cpu = sim.mallets[1];
        const puck = sim.puck;
        const aiSpeed = isFast ? 12.5 : 9.8;

        let desiredX = TABLE_W / 2;
        let desiredY = 128;

        if (sim.goalPauseFrames <= 0) {
          const puckInTopHalf = puck.y < TABLE_H * 0.52;
          if (puckInTopHalf) {
            // 攻め: パックの少し後ろに回り込んで下ゴールへ打ち返す
            if (puck.y < cpu.y - 10) {
              // パックがCPUより後ろ（自ゴール寄り）にいるときは横から回り込む
              desiredX = puck.x < TABLE_W / 2 ? puck.x + 68 : puck.x - 68;
              desiredY = Math.max(WALL_PAD + MALLET_R + 12, puck.y - 40);
            } else {
              desiredX = puck.x + puck.vx * 3;
              desiredY = puck.y - 14;
            }
          } else {
            // 守り: ゴール前でパックの予測Xに追従
            const predictedX =
              puck.vy < -1
                ? puck.x + puck.vx * Math.min(24, (puck.y - 135) / Math.abs(puck.vy))
                : puck.x;
            desiredX = clamp(predictedX, GOAL_LEFT - 10, GOAL_RIGHT + 10);
            desiredY = 118;
          }
        }

        const clamped = clampMalletPos(desiredX, desiredY, 'top');
        const dx = clamped.x - cpu.x;
        const dy = clamped.y - cpu.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.5) {
          const step = Math.min(dist, aiSpeed);
          cpu.targetX = cpu.x + (dx / dist) * step;
          cpu.targetY = cpu.y + (dy / dist) * step;
        }
      }

      // マレットの滑らか追従と速度算出
      for (let i = 0; i < 2; i++) {
        const m = sim.mallets[i];
        const prevX = m.x;
        const prevY = m.y;
        const lerp = i === 1 && curCpu ? 0.65 : 0.52;
        m.x += (m.targetX - m.x) * lerp;
        m.y += (m.targetY - m.y) * lerp;
        const clamped = clampMalletPos(m.x, m.y, i === 0 ? 'bottom' : 'top');
        m.x = clamped.x;
        m.y = clamped.y;
        m.vx = m.x - prevX;
        m.vy = m.y - prevY;
      }

      // 物理演算（ホスト / ローカル / CPU戦）
      if (curState.phase === 'playing' && !curGuest) {
        if (sim.goalPauseFrames > 0) {
          sim.goalPauseFrames -= 1;
        } else {
          const puck = sim.puck;
          let scoredBy: 0 | 1 | null = null;
          const minX = WALL_PAD + PUCK_R;
          const maxX = TABLE_W - WALL_PAD - PUCK_R;
          const minY = WALL_PAD + PUCK_R;
          const maxY = TABLE_H - WALL_PAD - PUCK_R;
          const goalMinX = GOAL_LEFT + PUCK_R;
          const goalMaxX = GOAL_RIGHT - PUCK_R;

          const resolvePuckWallsAndGoal = (prevY: number, emitEffects: boolean): 0 | 1 | null => {
            const inGoalEntranceX =
              puck.x > GOAL_LEFT + PUCK_R * 0.4 && puck.x < GOAL_RIGHT - PUCK_R * 0.4;
            const wasInTopMouth = prevY < minY;
            const wasInBottomMouth = prevY > maxY;
            const inTopMouth = puck.y < minY && (wasInTopMouth || inGoalEntranceX);
            const inBottomMouth = puck.y > maxY && (wasInBottomMouth || inGoalEntranceX);

            if (inTopMouth || inBottomMouth) {
              // ゴール開口部内ではポスト内壁でX方向を反射させ、テーブル内へテレポートさせない
              if (puck.x < goalMinX) {
                puck.x = goalMinX;
                if (puck.vx < 0) {
                  puck.vx = -puck.vx * 0.92;
                  if (emitEffects) {
                    spawnHitEffects(puck.x - PUCK_R, puck.y, inTopMouth ? '#fb7185' : '#22d3ee', 5);
                  }
                }
              } else if (puck.x > goalMaxX) {
                puck.x = goalMaxX;
                if (puck.vx > 0) {
                  puck.vx = -puck.vx * 0.92;
                  if (emitEffects) {
                    spawnHitEffects(puck.x + PUCK_R, puck.y, inTopMouth ? '#fb7185' : '#22d3ee', 5);
                  }
                }
              }

              if (inTopMouth && puck.y < -PUCK_R) {
                return 0; // 下側プレイヤー(0)が上ゴールに得点
              }
              if (inBottomMouth && puck.y > TABLE_H + PUCK_R) {
                return 1; // 上側プレイヤー(1)が下ゴールに得点
              }
              return null;
            }

            // 左右壁反射
            if (puck.x < minX) {
              puck.x = minX;
              if (puck.vx < 0) {
                puck.vx = -puck.vx * 0.92;
                if (emitEffects) spawnHitEffects(puck.x - PUCK_R, puck.y, '#38bdf8', 5);
              }
            } else if (puck.x > maxX) {
              puck.x = maxX;
              if (puck.vx > 0) {
                puck.vx = -puck.vx * 0.92;
                if (emitEffects) spawnHitEffects(puck.x + PUCK_R, puck.y, '#38bdf8', 5);
              }
            }

            // 上下壁反射（ゴール開口部外）
            if (puck.y < minY) {
              puck.y = minY;
              if (puck.vy < 0) {
                puck.vy = -puck.vy * 0.92;
                if (emitEffects) spawnHitEffects(puck.x, puck.y - PUCK_R, '#fb7185', 5);
              }
            } else if (puck.y > maxY) {
              puck.y = maxY;
              if (puck.vy > 0) {
                puck.vy = -puck.vy * 0.92;
                if (emitEffects) spawnHitEffects(puck.x, puck.y + PUCK_R, '#22d3ee', 5);
              }
            }

            return null;
          };

          for (let sub = 0; sub < SUBSTEPS; sub++) {
            const prevY = puck.y;
            puck.x += puck.vx / SUBSTEPS;
            puck.y += puck.vy / SUBSTEPS;

            scoredBy = resolvePuckWallsAndGoal(prevY, true);
            if (scoredBy !== null) break;

            // マレット vs パック衝突
            let collidedWithMallet = false;
            const prePushY = puck.y;
            for (let mIdx = 0; mIdx < 2; mIdx++) {
              const m = sim.mallets[mIdx];
              const dx = puck.x - m.x;
              const dy = puck.y - m.y;
              const minDist = MALLET_R + PUCK_R;
              const distSq = dx * dx + dy * dy;

              if (distSq < minDist * minDist && distSq > 0.0001) {
                collidedWithMallet = true;
                const dist = Math.sqrt(distSq);
                const nx = dx / dist;
                const ny = dy / dist;

                // めり込み押し出し
                const overlap = minDist - dist;
                puck.x += nx * (overlap + 0.5);
                puck.y += ny * (overlap + 0.5);

                // 相対速度に基づく弾き返し
                const rvx = puck.vx - m.vx;
                const rvy = puck.vy - m.vy;
                const relNormal = rvx * nx + rvy * ny;

                if (relNormal < 0) {
                  const restitution = isFast ? 1.04 : 0.96;
                  const impulse = -(1 + restitution) * relNormal;
                  puck.vx += nx * impulse + m.vx * 0.45;
                  puck.vy += ny * impulse + m.vy * 0.45;
                } else {
                  puck.vx += nx * 4 + m.vx * 0.6;
                  puck.vy += ny * 4 + m.vy * 0.6;
                }

                // 速度上限クランプ
                const spd = Math.hypot(puck.vx, puck.vy);
                if (spd > maxPuckSpeed) {
                  puck.vx = (puck.vx / spd) * maxPuckSpeed;
                  puck.vy = (puck.vy / spd) * maxPuckSpeed;
                }

                sim.rallyCount += 1;
                const hitColor = mIdx === 0 ? '#22d3ee' : '#fb7185';
                spawnHitEffects(m.x + nx * MALLET_R, m.y + ny * MALLET_R, hitColor, 10);
              }
            }

            // マレット衝突押し出し後の壁クランプ＆ゴール判定
            if (collidedWithMallet) {
              scoredBy = resolvePuckWallsAndGoal(prePushY, false);
              if (scoredBy !== null) break;
            }
          }

          // 空気抵抗 & 角詰まり防止
          puck.vx *= friction;
          puck.vy *= friction;

          const speedNow = Math.hypot(puck.vx, puck.vy);
          const nearCorner =
            (puck.x < WALL_PAD + PUCK_R + 18 || puck.x > TABLE_W - WALL_PAD - PUCK_R - 18) &&
            (puck.y < WALL_PAD + PUCK_R + 18 || puck.y > TABLE_H - WALL_PAD - PUCK_R - 18);
          if (nearCorner && speedNow < 1.8) {
            puck.vx += (TABLE_W / 2 - puck.x) * 0.012;
            puck.vy += (TABLE_H / 2 - puck.y) * 0.012;
          }

          // ゴール確定処理
          if (scoredBy !== null) {
            const scorerColor = scoredBy === 0 ? '#22d3ee' : '#fb7185';
            const goalY = scoredBy === 0 ? WALL_PAD + 10 : TABLE_H - WALL_PAD - 10;
            spawnHitEffects(puck.x, goalY, scorerColor, 26);

            sim.goalFlashAlpha = 0.85;
            sim.goalFlashColor = scorerColor;
            sim.goalBannerText = 'GOAL!';
            sim.goalPauseFrames = 64;
            sim.trail = [];

            // 失点側寄りへフェイスオフ配置
            puck.x = TABLE_W / 2;
            puck.y = scoredBy === 0 ? TABLE_H * 0.36 : TABLE_H * 0.64;
            puck.vx = 0;
            puck.vy = 0;

            const rally = sim.rallyCount;
            sim.rallyCount = 0;

            // ホスト側の useEffect によるゴール演出二重発火を防止
            sim.lastGoalSeqSeen = curState.lastGoalSeq + 1;

            dispatchAction(
              { type: 'goal', payload: { scorerIndex: scoredBy, rallyCount: rally } },
              curLocal ? curState.players[scoredBy].id : undefined
            );
          }
        }
      } else if (curState.phase === 'playing' && curGuest) {
        // オンラインゲスト: 60fpsデッドレコニング＋スナップショットへの滑らか補間
        if (sim.goalPauseFrames > 0) {
          sim.goalPauseFrames -= 1;
        } else if (sim.guestTargetPuck.hasSnapshot) {
          const gt = sim.guestTargetPuck;
          const minX = WALL_PAD + PUCK_R;
          const maxX = TABLE_W - WALL_PAD - PUCK_R;
          const minY = WALL_PAD + PUCK_R;
          const maxY = TABLE_H - WALL_PAD - PUCK_R;

          gt.x += gt.vx;
          gt.y += gt.vy;
          gt.vx *= friction;
          gt.vy *= friction;

          if (gt.x < minX) {
            gt.x = minX;
            if (gt.vx < 0) gt.vx = -gt.vx * 0.92;
          } else if (gt.x > maxX) {
            gt.x = maxX;
            if (gt.vx > 0) gt.vx = -gt.vx * 0.92;
          }
          const inGoalX = gt.x > GOAL_LEFT + PUCK_R * 0.4 && gt.x < GOAL_RIGHT - PUCK_R * 0.4;
          if (!inGoalX) {
            if (gt.y < minY) {
              gt.y = minY;
              if (gt.vy < 0) gt.vy = -gt.vy * 0.92;
            } else if (gt.y > maxY) {
              gt.y = maxY;
              if (gt.vy > 0) gt.vy = -gt.vy * 0.92;
            }
          }

          sim.puck.x += sim.puck.vx;
          sim.puck.y += sim.puck.vy;
          sim.puck.x += (gt.x - sim.puck.x) * 0.32;
          sim.puck.y += (gt.y - sim.puck.y) * 0.32;
          sim.puck.vx *= friction;
          sim.puck.vy *= friction;
        }
      }

      // オンライン対戦時の軽量位置同期（約18Hz）
      if (curState.phase === 'playing' && !curLocal && !curCpu) {
        const now = performance.now();
        if (now - sim.lastSyncSentAt > 55) {
          sim.lastSyncSentAt = now;
          if (curGuest) {
            dispatchAction({
              type: 'syncState',
              payload: {
                mallet1X: sim.mallets[1].x,
                mallet1Y: sim.mallets[1].y,
              },
            });
          } else {
            dispatchAction({
              type: 'syncState',
              payload: {
                puckX: sim.puck.x,
                puckY: sim.puck.y,
                puckVx: sim.puck.vx,
                puckVy: sim.puck.vy,
                mallet0X: sim.mallets[0].x,
                mallet0Y: sim.mallets[0].y,
              },
            });
          }
        }
      }

      // トレイル更新
      if (sim.goalPauseFrames <= 0 && curState.phase === 'playing') {
        sim.trail.push({ x: sim.puck.x, y: sim.puck.y });
        if (sim.trail.length > 10) sim.trail.shift();
      } else if (sim.trail.length > 0) {
        sim.trail.shift();
      }

      // パーティクル＆フラッシュ減衰
      for (let i = sim.sparks.length - 1; i >= 0; i--) {
        const s = sim.sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.92;
        s.vy *= 0.92;
        s.life += 1;
        if (s.life >= s.maxLife) sim.sparks.splice(i, 1);
      }

      for (let i = sim.ripples.length - 1; i >= 0; i--) {
        const r = sim.ripples[i];
        r.life += 1;
        if (r.life >= r.maxLife) sim.ripples.splice(i, 1);
      }

      if (sim.goalFlashAlpha > 0) {
        sim.goalFlashAlpha = Math.max(0, sim.goalFlashAlpha - 0.025);
      }

      // Canvas 描画
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.clearRect(0, 0, TABLE_W, TABLE_H);

          if (curRotated) {
            ctx.translate(TABLE_W, TABLE_H);
            ctx.rotate(Math.PI);
          }

          drawNeonTable(ctx);

          // 波紋描画
          for (const r of sim.ripples) {
            const t = r.life / r.maxLife;
            ctx.strokeStyle = r.color;
            ctx.lineWidth = 3 * (1 - t);
            ctx.globalAlpha = (1 - t) * 0.8;
            ctx.beginPath();
            ctx.arc(r.x, r.y, 18 + t * 50, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;

          // パック & マレット描画
          drawPuck(ctx, sim.puck, sim.trail);
          drawMallet(ctx, sim.mallets[0].x, sim.mallets[0].y, '#22d3ee', '#06b6d4');
          drawMallet(ctx, sim.mallets[1].x, sim.mallets[1].y, '#fb7185', '#f43f5e');

          // 火花パーティクル描画
          for (const s of sim.sparks) {
            ctx.fillStyle = s.color;
            ctx.globalAlpha = 1 - s.life / s.maxLife;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;

          // ゴール時フラッシュ
          if (sim.goalFlashAlpha > 0) {
            ctx.fillStyle = sim.goalFlashColor;
            ctx.globalAlpha = sim.goalFlashAlpha * 0.28;
            ctx.fillRect(0, 0, TABLE_W, TABLE_H);
            ctx.globalAlpha = 1;
          }

          ctx.restore();

          // 画面向きに合わせたGOAL / FACE OFFテキスト
          if (sim.goalPauseFrames > 0 && curState.phase === 'playing') {
            ctx.save();
            ctx.font = '900 44px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = sim.goalFlashColor;
            ctx.shadowBlur = 22;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(sim.goalBannerText, TABLE_W / 2, TABLE_H / 2);
            ctx.restore();
          }
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const toTableCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: TABLE_W / 2, y: TABLE_H / 2 };
      const rect = canvas.getBoundingClientRect();
      let x = ((clientX - rect.left) / rect.width) * TABLE_W;
      let y = ((clientY - rect.top) / rect.height) * TABLE_H;
      if (rotatedView) {
        x = TABLE_W - x;
        y = TABLE_H - y;
      }
      return { x, y };
    },
    [rotatedView]
  );

  const updateMalletFromPointer = useCallback(
    (side: 'bottom' | 'top', x: number, y: number) => {
      const idx = side === 'bottom' ? 0 : 1;
      const clamped = clampMalletPos(x, y, side);
      simRef.current.mallets[idx].targetX = clamped.x;
      simRef.current.mallets[idx].targetY = clamped.y;
    },
    []
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (state.phase !== 'playing') return;
    const pt = toTableCoords(e.clientX, e.clientY);

    let side: 'bottom' | 'top';
    if (isLocalPassAndPlay) {
      side = pt.y < TABLE_H / 2 ? 'top' : 'bottom';
    } else if (rotatedView) {
      side = 'top';
    } else {
      side = 'bottom';
    }

    // 同一サイドにつきアクティブな指は1本のみ追跡（2本目の指は無視）
    for (const activeSide of pointersRef.current.values()) {
      if (activeSide === side) return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, side);
    updateMalletFromPointer(side, pt.x, pt.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const side = pointersRef.current.get(e.pointerId);
    if (!side || state.phase !== 'playing') return;
    const pt = toTableCoords(e.clientX, e.clientY);
    updateMalletFromPointer(side, pt.x, pt.y);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
  };

  const topPlayer = rotatedView ? state.players[0] : state.players[1];
  const bottomPlayer = rotatedView ? state.players[1] : state.players[0];
  const topScore = rotatedView ? state.scores[0] : state.scores[1];
  const bottomScore = rotatedView ? state.scores[1] : state.scores[0];
  const topColorClass = rotatedView ? 'bottom' : 'top';
  const bottomColorClass = rotatedView ? 'top' : 'bottom';

  const winnerName = state.players.find((p) => p.id === state.winnerId)?.name ?? '';

  return (
    <div className="airhockey-arena">
      <div className={`airhockey-bar ${topColorClass} ${isLocalPassAndPlay ? 'flipped' : ''}`}>
        <div className="airhockey-bar-left">
          <span className={`airhockey-dot ${topColorClass}`} />
          <span className="airhockey-name">{topPlayer.name}</span>
        </div>
        <div className="airhockey-bar-right">
          <span className="airhockey-target-tag">{state.rules.winScore}点先取</span>
          <span className={`airhockey-score ${topColorClass}`}>{topScore}</span>
        </div>
      </div>

      <div className="airhockey-table-wrap">
        <canvas
          ref={canvasRef}
          width={TABLE_W}
          height={TABLE_H}
          className="airhockey-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
        />

        {state.phase === 'playing' && (
          <div className="airhockey-hint-pill">
            <Zap size={12} />
            {isLocalPassAndPlay
              ? '上下それぞれのコートを同時にドラッグ'
              : '自陣マレットを指でドラッグして打ち返そう'}
          </div>
        )}

        {state.phase === 'finished' && (
          <div className="airhockey-overlay">
            <div className="airhockey-result-card">
              <div className="airhockey-result-title">
                <Trophy size={22} />
                <span>{winnerName} の勝利！</span>
              </div>
              <div className="airhockey-result-score">
                {state.players[0].name} {state.scores[0]} - {state.scores[1]} {state.players[1].name}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`airhockey-bar ${bottomColorClass}`}>
        <div className="airhockey-bar-left">
          <span className={`airhockey-dot ${bottomColorClass}`} />
          <span className="airhockey-name">{bottomPlayer.name}</span>
        </div>
        <div className="airhockey-bar-right">
          <span className="airhockey-target-tag">
            {state.rules.puckSpeed === 'fast' ? 'ハイスピード' : '標準速度'}
          </span>
          <span className={`airhockey-score ${bottomColorClass}`}>{bottomScore}</span>
        </div>
      </div>
    </div>
  );
};
