import type { CoinSoccerRules, PlayerInfo } from '../types/game';

export const COIN_SOCCER_WIDTH = 600;
export const COIN_SOCCER_HEIGHT = 900;
export const COIN_SOCCER_WALL_INSET = 28;
export const COIN_SOCCER_GOAL_WIDTH = 200;
export const COIN_SOCCER_GOAL_LEFT = (COIN_SOCCER_WIDTH - COIN_SOCCER_GOAL_WIDTH) / 2; // 200
export const COIN_SOCCER_GOAL_RIGHT = COIN_SOCCER_GOAL_LEFT + COIN_SOCCER_GOAL_WIDTH; // 400
export const COIN_SOCCER_GOAL_DEPTH = 26;
export const COIN_SOCCER_POST_RADIUS = 8;
export const COIN_SOCCER_COIN_RADIUS = 26;
export const COIN_SOCCER_MAX_SPEED = 21;
export const COIN_SOCCER_MIN_SPEED = 2.6;
export const COIN_SOCCER_MAX_STEPS = 320;

export const COIN_SOCCER_POSTS: readonly { x: number; y: number }[] = [
  { x: COIN_SOCCER_GOAL_LEFT, y: COIN_SOCCER_WALL_INSET },
  { x: COIN_SOCCER_GOAL_RIGHT, y: COIN_SOCCER_WALL_INSET },
  { x: COIN_SOCCER_GOAL_LEFT, y: COIN_SOCCER_HEIGHT - COIN_SOCCER_WALL_INSET },
  { x: COIN_SOCCER_GOAL_RIGHT, y: COIN_SOCCER_HEIGHT - COIN_SOCCER_WALL_INSET },
];

export type CoinIndex = 0 | 1 | 2;

export interface CoinSoccerCoin {
  id: CoinIndex;
  x: number;
  y: number;
  vx: number;
  vy: number;
  outOfBounds: boolean;
  inGoal: 'top' | 'bottom' | null;
}

export interface CoinSoccerPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  side: 'bottom' | 'top'; // P0: bottom (attacks top goal), P1: top (attacks bottom goal)
  score: number;
}

export type CoinSoccerShotOutcome =
  | 'goal'
  | 'nice_pass'
  | 'foul_collision'
  | 'foul_out'
  | 'foul_own_goal'
  | 'foul_direct_goal'
  | 'foul_no_gate';

export interface CoinSoccerShotRecord {
  shotId: number;
  shooterId: string;
  shooterIndex: 0 | 1;
  coinIndex: CoinIndex;
  initialCoins: [CoinSoccerCoin, CoinSoccerCoin, CoinSoccerCoin];
  outcome: CoinSoccerShotOutcome;
  passedGate: boolean;
  collidedCoin: boolean;
  steps: number;
  summary: string;
}

export interface CoinSoccerInternalState {
  rules: CoinSoccerRules;
  players: [CoinSoccerPlayerState, CoinSoccerPlayerState];
  coins: [CoinSoccerCoin, CoinSoccerCoin, CoinSoccerCoin];
  turnIndex: 0 | 1;
  passStreak: number;
  shotSeq: number;
  lastShot: CoinSoccerShotRecord | null;
  nextBotActionAt: number;
  winnerId: string | 'draw' | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface CoinSoccerClientState extends CoinSoccerInternalState {
  myId: string;
}

export interface CoinSoccerStepResult {
  moving: boolean;
  passedGateNow: boolean;
  collidedWithCoin: boolean;
  goalScored: 'top' | 'bottom' | null;
  wentOutOfBounds: boolean;
  collisions: { x: number; y: number; intensity: number }[];
}

const SUBSTEPS = 4;
const COIN_RESTITUTION = 0.86;
const POST_RESTITUTION = 0.82;
const LINEAR_DRAG = 0.982;
const COULOMB_FRICTION = 0.055;
const STOP_SPEED = 0.14;

function cloneCoins(
  coins: readonly [CoinSoccerCoin, CoinSoccerCoin, CoinSoccerCoin]
): [CoinSoccerCoin, CoinSoccerCoin, CoinSoccerCoin] {
  return [{ ...coins[0] }, { ...coins[1] }, { ...coins[2] }];
}

export function createCoinSoccerKickoffCoins(
  kickoffPlayerIndex: 0 | 1
): [CoinSoccerCoin, CoinSoccerCoin, CoinSoccerCoin] {
  const cx = COIN_SOCCER_WIDTH / 2;
  if (kickoffPlayerIndex === 0) {
    // P0（下側・上ゴール攻め）用の三角形配置
    return [
      { id: 0, x: cx, y: 565, vx: 0, vy: 0, outOfBounds: false, inGoal: null },
      { id: 1, x: cx - 88, y: 440, vx: 0, vy: 0, outOfBounds: false, inGoal: null },
      { id: 2, x: cx + 88, y: 440, vx: 0, vy: 0, outOfBounds: false, inGoal: null },
    ];
  }
  // P1（上側・下ゴール攻め）用の三角形配置
  return [
    { id: 0, x: cx, y: 335, vx: 0, vy: 0, outOfBounds: false, inGoal: null },
    { id: 1, x: cx - 88, y: 460, vx: 0, vy: 0, outOfBounds: false, inGoal: null },
    { id: 2, x: cx + 88, y: 460, vx: 0, vy: 0, outOfBounds: false, inGoal: null },
  ];
}

function getOtherCoinIndices(coinIndex: CoinIndex): [CoinIndex, CoinIndex] {
  if (coinIndex === 0) return [1, 2];
  if (coinIndex === 1) return [0, 2];
  return [0, 1];
}

/**
 * 2D線分 (p1 -> p2) と (a -> b) の厳密交差判定（間通し判定用）
 */
function segmentsIntersect(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): boolean {
  const rX = p2x - p1x;
  const rY = p2y - p1y;
  const sX = bx - ax;
  const sY = by - ay;

  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 1e-8) return false;

  const qpx = ax - p1x;
  const qpy = ay - p1y;

  const t = (qpx * sY - qpy * sX) / denom;
  const u = (qpx * rY - qpy * rX) / denom;

  return t >= 0 && t <= 1 && u > 0.02 && u < 0.98;
}

function resolvePostCollision(
  coin: CoinSoccerCoin,
  post: { x: number; y: number }
): { x: number; y: number; intensity: number } | null {
  const dx = coin.x - post.x;
  const dy = coin.y - post.y;
  const minDist = COIN_SOCCER_COIN_RADIUS + COIN_SOCCER_POST_RADIUS;
  const distSq = dx * dx + dy * dy;
  if (distSq >= minDist * minDist) return null;

  const dist = distSq > 1e-8 ? Math.sqrt(distSq) : 0;
  const nx = dist > 0 ? dx / dist : 0;
  const ny = dist > 0 ? dy / dist : 1;

  const overlap = minDist - dist;
  coin.x += nx * overlap;
  coin.y += ny * overlap;

  const velAlongNormal = coin.vx * nx + coin.vy * ny;
  if (velAlongNormal >= 0) return null;

  const impulse = -(1 + POST_RESTITUTION) * velAlongNormal;
  coin.vx += impulse * nx;
  coin.vy += impulse * ny;

  return {
    x: post.x + nx * COIN_SOCCER_POST_RADIUS,
    y: post.y + ny * COIN_SOCCER_POST_RADIUS,
    intensity: Math.min(1, Math.abs(velAlongNormal) / 20),
  };
}

function resolveCoinCollision(
  a: CoinSoccerCoin,
  b: CoinSoccerCoin
): { x: number; y: number; intensity: number } | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minDist = COIN_SOCCER_COIN_RADIUS * 2;
  const distSq = dx * dx + dy * dy;
  if (distSq >= minDist * minDist) return null;

  const dist = distSq > 1e-8 ? Math.sqrt(distSq) : 0;
  const nx = dist > 0 ? dx / dist : 1;
  const ny = dist > 0 ? dy / dist : 0;

  const overlap = (minDist - dist) * 0.5;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;
  if (velAlongNormal > 0) return null;

  const impulse = (-(1 + COIN_RESTITUTION) * velAlongNormal) * 0.5;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * nx;
  b.vy += impulse * ny;

  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
    intensity: Math.min(1, Math.abs(velAlongNormal) / 20),
  };
}

function applyFriction(coin: CoinSoccerCoin): boolean {
  const speed = Math.hypot(coin.vx, coin.vy);
  if (speed <= STOP_SPEED) {
    coin.vx = 0;
    coin.vy = 0;
    return false;
  }
  const nextSpeed = Math.max(0, speed * LINEAR_DRAG - COULOMB_FRICTION);
  if (nextSpeed <= STOP_SPEED) {
    coin.vx = 0;
    coin.vy = 0;
    return false;
  }
  const ratio = nextSpeed / speed;
  coin.vx *= ratio;
  coin.vy *= ratio;
  return true;
}

function checkBoundsAndGoal(coin: CoinSoccerCoin): {
  goal: 'top' | 'bottom' | null;
  out: boolean;
} {
  const minX = COIN_SOCCER_WALL_INSET;
  const maxX = COIN_SOCCER_WIDTH - COIN_SOCCER_WALL_INSET;
  const minY = COIN_SOCCER_WALL_INSET;
  const maxY = COIN_SOCCER_HEIGHT - COIN_SOCCER_WALL_INSET;

  const inGoalMouthX =
    coin.x > COIN_SOCCER_GOAL_LEFT + COIN_SOCCER_POST_RADIUS * 0.5 &&
    coin.x < COIN_SOCCER_GOAL_RIGHT - COIN_SOCCER_POST_RADIUS * 0.5;

  // 上ゴール判定（ゴールラインを完全に越えた）
  if (coin.y < minY - 4 && inGoalMouthX) {
    coin.y = Math.max(minY - COIN_SOCCER_GOAL_DEPTH + COIN_SOCCER_COIN_RADIUS * 0.45, coin.y);
    coin.vx = 0;
    coin.vy = 0;
    coin.inGoal = 'top';
    return { goal: 'top', out: false };
  }

  // 下ゴール判定
  if (coin.y > maxY + 4 && inGoalMouthX) {
    coin.y = Math.min(maxY + COIN_SOCCER_GOAL_DEPTH - COIN_SOCCER_COIN_RADIUS * 0.45, coin.y);
    coin.vx = 0;
    coin.vy = 0;
    coin.inGoal = 'bottom';
    return { goal: 'bottom', out: false };
  }

  // ピッチ外（タッチラインまたはゴール開口部以外のゴールラインを完全に越えた）
  if (coin.x < minX - 4 || coin.x > maxX + 4 || coin.y < minY - 4 || coin.y > maxY + 4) {
    coin.vx = 0;
    coin.vy = 0;
    coin.outOfBounds = true;
    return { goal: null, out: true };
  }

  return { goal: null, out: false };
}

/**
 * 決定論的な1フレーム（60fps相当）物理シミュレーションステップ。
 * エンジン側とクライアントCanvasアニメーション側で同一関数を共有する。
 */
export function simulateCoinSoccerStep(
  coins: [CoinSoccerCoin, CoinSoccerCoin, CoinSoccerCoin],
  flickedIndex: CoinIndex
): CoinSoccerStepResult {
  let passedGateNow = false;
  let collidedWithCoin = false;
  let goalScored: 'top' | 'bottom' | null = null;
  let wentOutOfBounds = false;
  const collisions: { x: number; y: number; intensity: number }[] = [];

  const [otherAIdx, otherBIdx] = getOtherCoinIndices(flickedIndex);

  for (let sub = 0; sub < SUBSTEPS; sub++) {
    const flicked = coins[flickedIndex];
    const prevX = flicked.x;
    const prevY = flicked.y;

    // 位置更新
    for (const c of coins) {
      if (c.outOfBounds || c.inGoal !== null) continue;
      c.x += c.vx / SUBSTEPS;
      c.y += c.vy / SUBSTEPS;
    }

    // ゴールポストとの衝突
    for (const c of coins) {
      if (c.outOfBounds || c.inGoal !== null) continue;
      for (const post of COIN_SOCCER_POSTS) {
        const hit = resolvePostCollision(c, post);
        if (hit && hit.intensity > 0.06) collisions.push(hit);
      }
    }

    // コイン同士の衝突
    for (let i = 0; i < 3; i++) {
      const a = coins[i];
      if (a.outOfBounds || a.inGoal !== null) continue;
      for (let j = i + 1; j < 3; j++) {
        const b = coins[j];
        if (b.outOfBounds || b.inGoal !== null) continue;
        const hit = resolveCoinCollision(a, b);
        if (hit) {
          collidedWithCoin = true;
          if (hit.intensity > 0.06) collisions.push(hit);
        }
      }
    }

    // ゲート（他の2枚を結ぶ線分）通過判定
    if (!flicked.outOfBounds && flicked.inGoal === null) {
      const a = coins[otherAIdx];
      const b = coins[otherBIdx];
      if (
        !a.outOfBounds &&
        !b.outOfBounds &&
        a.inGoal === null &&
        b.inGoal === null &&
        segmentsIntersect(prevX, prevY, flicked.x, flicked.y, a.x, a.y, b.x, b.y)
      ) {
        passedGateNow = true;
      }
    }

    // ゴール・場外チェック
    for (const c of coins) {
      if (c.outOfBounds || c.inGoal !== null) continue;
      const res = checkBoundsAndGoal(c);
      if (res.goal && c.id === flickedIndex && goalScored === null) {
        goalScored = res.goal;
      }
      if (res.out) {
        wentOutOfBounds = true;
      }
    }
  }

  let moving = false;
  for (const c of coins) {
    if (c.outOfBounds || c.inGoal !== null) continue;
    if (applyFriction(c)) moving = true;
  }

  return {
    moving,
    passedGateNow,
    collidedWithCoin,
    goalScored,
    wentOutOfBounds,
    collisions,
  };
}

function findSafeSpotInsidePitch(
  desiredX: number,
  desiredY: number,
  otherCoins: readonly CoinSoccerCoin[]
): { x: number; y: number } {
  const pad = COIN_SOCCER_WALL_INSET + COIN_SOCCER_COIN_RADIUS + 14;
  const clampX = (x: number) => Math.max(pad, Math.min(COIN_SOCCER_WIDTH - pad, x));
  const clampY = (y: number) => Math.max(pad, Math.min(COIN_SOCCER_HEIGHT - pad, y));

  const baseX = clampX(desiredX);
  const baseY = clampY(desiredY);
  const minDist = COIN_SOCCER_COIN_RADIUS * 2 + 12;
  const minDistSq = minDist * minDist;

  const isFree = (x: number, y: number) => {
    for (const c of otherCoins) {
      const dx = c.x - x;
      const dy = c.y - y;
      if (dx * dx + dy * dy < minDistSq) return false;
    }
    return true;
  };

  if (isFree(baseX, baseY)) return { x: baseX, y: baseY };

  for (let r = 24; r <= 240; r += 20) {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      const x = clampX(baseX + Math.cos(a) * r);
      const y = clampY(baseY + Math.sin(a) * r);
      if (isFree(x, y)) return { x, y };
    }
  }

  return { x: COIN_SOCCER_WIDTH / 2, y: COIN_SOCCER_HEIGHT / 2 };
}

export function initCoinSoccer(
  playersInfo: PlayerInfo[],
  rules: CoinSoccerRules
): CoinSoccerInternalState {
  const players: [CoinSoccerPlayerState, CoinSoccerPlayerState] = [
    {
      id: playersInfo[0].id,
      name: playersInfo[0].name,
      isBot: playersInfo[0].isBot,
      side: 'bottom',
      score: 0,
    },
    {
      id: playersInfo[1].id,
      name: playersInfo[1].name,
      isBot: playersInfo[1].isBot,
      side: 'top',
      score: 0,
    },
  ];

  return {
    rules,
    players,
    coins: createCoinSoccerKickoffCoins(0),
    turnIndex: 0,
    passStreak: 0,
    shotSeq: 0,
    lastShot: null,
    nextBotActionAt: 0,
    winnerId: null,
    phase: 'playing',
    lastLog: `${players[0].name} のキックオフ！他の2枚の間を通して攻めよう`,
  };
}

export function applyCoinSoccerAction(
  state: CoinSoccerInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: CoinSoccerInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: '試合は終了しています' };
  }

  const shooterIndex = state.turnIndex;
  const shooter = state.players[shooterIndex];
  if (shooter.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }

  if (action.type !== 'flick') {
    return { state, error: '不明なアクションです' };
  }

  const payload = action.payload as { coinIndex?: number; vx?: number; vy?: number } | undefined;
  if (
    !payload ||
    (payload.coinIndex !== 0 && payload.coinIndex !== 1 && payload.coinIndex !== 2) ||
    typeof payload.vx !== 'number' ||
    typeof payload.vy !== 'number' ||
    !Number.isFinite(payload.vx) ||
    !Number.isFinite(payload.vy)
  ) {
    return { state, error: 'ショットパラメータが不正です' };
  }

  const coinIndex: CoinIndex = payload.coinIndex;
  const rawSpeed = Math.hypot(payload.vx, payload.vy);
  if (rawSpeed < COIN_SOCCER_MIN_SPEED) {
    return { state, error: '弾く力が弱すぎます' };
  }

  const scale = rawSpeed > COIN_SOCCER_MAX_SPEED ? COIN_SOCCER_MAX_SPEED / rawSpeed : 1;
  const vx = payload.vx * scale;
  const vy = payload.vy * scale;

  const initialCoins = cloneCoins(state.coins);
  for (const c of initialCoins) {
    c.vx = 0;
    c.vy = 0;
    c.outOfBounds = false;
    c.inGoal = null;
  }
  initialCoins[coinIndex].vx = vx;
  initialCoins[coinIndex].vy = vy;

  const simCoins = cloneCoins(initialCoins);
  let passedGate = false;
  let collidedCoin = false;
  let goalScored: 'top' | 'bottom' | null = null;
  let wentOut = false;
  let steps = 0;

  for (let i = 0; i < COIN_SOCCER_MAX_STEPS; i++) {
    steps = i + 1;
    const res = simulateCoinSoccerStep(simCoins, coinIndex);
    if (res.passedGateNow) passedGate = true;
    if (res.collidedWithCoin) collidedCoin = true;
    if (res.goalScored && goalScored === null) goalScored = res.goalScored;
    if (res.wentOutOfBounds) wentOut = true;
    if (!res.moving) break;
  }

  for (const c of simCoins) {
    c.vx = 0;
    c.vy = 0;
  }

  const targetGoal: 'top' | 'bottom' = shooterIndex === 0 ? 'top' : 'bottom';
  const ownGoal: 'top' | 'bottom' = shooterIndex === 0 ? 'bottom' : 'top';
  const opponentIndex: 0 | 1 = shooterIndex === 0 ? 1 : 0;

  let outcome: CoinSoccerShotOutcome;
  let nextTurnIndex: 0 | 1 = opponentIndex;
  let nextPassStreak = 0;
  let nextCoins: [CoinSoccerCoin, CoinSoccerCoin, CoinSoccerCoin] = simCoins;
  const nextPlayers: [CoinSoccerPlayerState, CoinSoccerPlayerState] = [
    { ...state.players[0] },
    { ...state.players[1] },
  ];
  let winnerId: string | 'draw' | null = null;
  let phase: 'playing' | 'finished' = 'playing';
  let summary = '';
  let lastLog = '';

  if (goalScored === targetGoal && !collidedCoin) {
    if (state.passStreak === 0) {
      // まだ1回も間通しパスを成功させていない状態での直接ゴールは禁止（ファウル）
      outcome = 'foul_direct_goal';
      summary = '一撃ゴール禁止（ファウル）！';
      nextTurnIndex = opponentIndex;
      nextPassStreak = 0;
      nextCoins = normalizeCoinsInsidePitch(simCoins, initialCoins);
      lastLog = `${shooter.name}: ${summary} → ${nextPlayers[opponentIndex].name} の番`;
    } else {
      // 1回以上間通しパス成功後であればシュート成立！
      outcome = 'goal';
      nextPlayers[shooterIndex].score += 1;
      const isSuper = passedGate;
      summary = isSuper
        ? `スーパーゴール！ (${shooter.name})`
        : `ゴール！ (${shooter.name})`;

      if (nextPlayers[shooterIndex].score >= state.rules.winScore) {
        phase = 'finished';
        winnerId = shooter.id;
        lastLog = `${summary} ${shooter.name} の勝利！`;
        nextCoins = createCoinSoccerKickoffCoins(opponentIndex);
      } else {
        nextTurnIndex = opponentIndex;
        nextCoins = createCoinSoccerKickoffCoins(opponentIndex);
        lastLog = `${summary} → ${nextPlayers[opponentIndex].name} のキックオフ`;
      }
    }
  } else if (goalScored === ownGoal) {
    outcome = 'foul_own_goal';
    summary = 'ファウル（自陣ゴール落下）';
    nextTurnIndex = opponentIndex;
    nextCoins = createCoinSoccerKickoffCoins(opponentIndex);
    lastLog = `${shooter.name}: ${summary} → ${nextPlayers[opponentIndex].name} の番`;
  } else if (collidedCoin) {
    outcome = 'foul_collision';
    summary = 'ファウル（コイン衝突）';
    nextTurnIndex = opponentIndex;
    // 場外やゴールへ出たコインがあれば安全位置へ戻す
    nextCoins = normalizeCoinsInsidePitch(simCoins, initialCoins);
    lastLog = `${shooter.name}: ${summary} → ${nextPlayers[opponentIndex].name} の番`;
  } else if (wentOut) {
    outcome = 'foul_out';
    summary = 'ファウル（ピッチ外）';
    nextTurnIndex = opponentIndex;
    nextCoins = normalizeCoinsInsidePitch(simCoins, initialCoins);
    lastLog = `${shooter.name}: ${summary} → ${nextPlayers[opponentIndex].name} の番`;
  } else if (passedGate) {
    outcome = 'nice_pass';
    nextTurnIndex = shooterIndex;
    nextPassStreak = state.passStreak + 1;
    summary =
      nextPassStreak >= 2
        ? `ナイスパス！ (${nextPassStreak}連続)`
        : 'ナイスパス！ 継続ターン';
    lastLog = `${shooter.name}: ${summary}`;
  } else {
    outcome = 'foul_no_gate';
    summary = 'ファウル（間通し失敗）';
    nextTurnIndex = opponentIndex;
    lastLog = `${shooter.name}: ${summary} → ${nextPlayers[opponentIndex].name} の番`;
  }

  const shotSeq = state.shotSeq + 1;
  const lastShot: CoinSoccerShotRecord = {
    shotId: shotSeq,
    shooterId: shooter.id,
    shooterIndex,
    coinIndex,
    initialCoins,
    outcome,
    passedGate,
    collidedCoin,
    steps,
    summary,
  };

  return {
    state: {
      ...state,
      players: nextPlayers,
      coins: nextCoins,
      turnIndex: nextTurnIndex,
      passStreak: nextPassStreak,
      shotSeq,
      lastShot,
      nextBotActionAt: Date.now() + Math.ceil((steps / 60) * 1000) + 600,
      winnerId,
      phase,
      lastLog,
    },
  };
}

function normalizeCoinsInsidePitch(
  simCoins: [CoinSoccerCoin, CoinSoccerCoin, CoinSoccerCoin],
  fallbackCoins: [CoinSoccerCoin, CoinSoccerCoin, CoinSoccerCoin]
): [CoinSoccerCoin, CoinSoccerCoin, CoinSoccerCoin] {
  const result = cloneCoins(simCoins);
  for (let i = 0; i < 3; i++) {
    const c = result[i];
    if (c.outOfBounds || c.inGoal !== null) {
      const others = result.filter((_, idx) => idx !== i && !result[idx].outOfBounds && result[idx].inGoal === null);
      const safe = findSafeSpotInsidePitch(fallbackCoins[i].x, fallbackCoins[i].y, others);
      c.x = safe.x;
      c.y = safe.y;
      c.outOfBounds = false;
      c.inGoal = null;
      c.vx = 0;
      c.vy = 0;
    }
  }
  return result;
}

export function sanitizeCoinSoccerState(
  state: CoinSoccerInternalState,
  playerId: string
): CoinSoccerClientState {
  return {
    ...state,
    myId: playerId,
  };
}

/**
 * 3枚のうち最適な1枚を選び、直接ゴールまたはゲート通過で相手ゴールへ近づけるBot
 */
export function computeCoinSoccerBotAction(
  state: CoinSoccerInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;

  const shooterIndex = state.turnIndex;
  const targetGoal: 'top' | 'bottom' = shooterIndex === 0 ? 'top' : 'bottom';
  const targetGoalY =
    shooterIndex === 0 ? COIN_SOCCER_WALL_INSET : COIN_SOCCER_HEIGHT - COIN_SOCCER_WALL_INSET;
  const goalCenterX = COIN_SOCCER_WIDTH / 2;

  let bestScore = -Infinity;
  let bestAction: { coinIndex: CoinIndex; vx: number; vy: number } | null = null;

  const evaluateCandidate = (coinIndex: CoinIndex, dirX: number, dirY: number, speed: number) => {
    const simCoins = cloneCoins(state.coins);
    simCoins[coinIndex].vx = dirX * speed;
    simCoins[coinIndex].vy = dirY * speed;

    let passedGate = false;
    let collided = false;
    let goal: 'top' | 'bottom' | null = null;
    let wentOut = false;

    for (let step = 0; step < COIN_SOCCER_MAX_STEPS; step++) {
      const res = simulateCoinSoccerStep(simCoins, coinIndex);
      if (res.passedGateNow) passedGate = true;
      if (res.collidedWithCoin) {
        collided = true;
        break;
      }
      if (res.goalScored) {
        goal = res.goalScored;
        break;
      }
      if (res.wentOutOfBounds) {
        wentOut = true;
        break;
      }
      if (!res.moving) break;
    }

    if (collided || wentOut) return;
    if (goal && goal !== targetGoal) return;

    let score = 0;
    if (goal === targetGoal) {
      // 1撃ゴール禁止：まだ間通しパスを成功させていないターンでは直接ゴールを避ける
      if (state.passStreak === 0) return;
      score = 10000 + (passedGate ? 500 : 0) - speed * 2;
    } else if (passedGate) {
      const endCoin = simCoins[coinIndex];
      const distToGoal = Math.hypot(endCoin.x - goalCenterX, endCoin.y - targetGoalY);
      const startDist = Math.hypot(
        state.coins[coinIndex].x - goalCenterX,
        state.coins[coinIndex].y - targetGoalY
      );
      const progress = startDist - distToGoal;
      const centerBonus = 120 - Math.abs(endCoin.x - goalCenterX) * 0.4;
      score = 1000 + progress * 2.2 - distToGoal * 0.5 + centerBonus;
    } else {
      return;
    }

    if (score > bestScore) {
      bestScore = score;
      bestAction = {
        coinIndex,
        vx: dirX * speed,
        vy: dirY * speed,
      };
    }
  };

  const coinIndices: CoinIndex[] = [0, 1, 2];
  for (const idx of coinIndices) {
    const c = state.coins[idx];
    const [o1, o2] = getOtherCoinIndices(idx);
    const a = state.coins[o1];
    const b = state.coins[o2];

    // 1. 直接ゴール狙い（シュート解放後のみ：中央・左右やや内側）
    if (state.passStreak >= 1) {
      const goalTargetsX = [goalCenterX, goalCenterX - 42, goalCenterX + 42];
      for (const gx of goalTargetsX) {
        const dx = gx - c.x;
        const dy = targetGoalY - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 10) continue;
        const ux = dx / dist;
        const uy = dy / dist;
        const neededSpeed = Math.min(COIN_SOCCER_MAX_SPEED, Math.max(9, dist * 0.036 + 5));
        evaluateCandidate(idx, ux, uy, neededSpeed);
        if (neededSpeed + 3.5 <= COIN_SOCCER_MAX_SPEED) {
          evaluateCandidate(idx, ux, uy, neededSpeed + 3.5);
        }
      }
    }

    // 2. ゲート（残り2枚の中点付近）を通過するショット
    const gateWidth = Math.hypot(b.x - a.x, b.y - a.y);
    if (gateWidth > COIN_SOCCER_COIN_RADIUS * 2.15) {
      const gatePoints = [0.5, 0.38, 0.62];
      for (const frac of gatePoints) {
        const mx = a.x + (b.x - a.x) * frac;
        const my = a.y + (b.y - a.y) * frac;
        const dx = mx - c.x;
        const dy = my - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 10) continue;
        const ux = dx / dist;
        const uy = dy / dist;

        const speeds = [
          Math.max(6.5, dist * 0.032 + 3.2),
          Math.max(9.5, dist * 0.044 + 5),
          Math.min(COIN_SOCCER_MAX_SPEED * 0.88, dist * 0.056 + 7.5),
        ];
        for (const sp of speeds) {
          evaluateCandidate(idx, ux, uy, Math.min(COIN_SOCCER_MAX_SPEED, sp));
        }
      }
    }
  }

  if (bestAction !== null) {
    const chosen: { coinIndex: CoinIndex; vx: number; vy: number } = bestAction;
    // 人間らしい自然なブレ（角度 ±2.5度、速度 ±6%）
    const angleJitter = (Math.random() - 0.5) * 2 * ((2.5 * Math.PI) / 180);
    const speedFactor = 1 + (Math.random() - 0.5) * 0.12;
    const baseSpeed = Math.hypot(chosen.vx, chosen.vy);
    const nextSpeed = Math.max(
      COIN_SOCCER_MIN_SPEED,
      Math.min(COIN_SOCCER_MAX_SPEED, baseSpeed * speedFactor)
    );
    const baseAngle = Math.atan2(chosen.vy, chosen.vx) + angleJitter;
    return {
      type: 'flick',
      payload: {
        coinIndex: chosen.coinIndex,
        vx: Math.cos(baseAngle) * nextSpeed,
        vy: Math.sin(baseAngle) * nextSpeed,
      },
    };
  }

  // フォールバック: 0番コインを相手ゴール方向へ軽く弾く
  const c0 = state.coins[0];
  const dx = goalCenterX - c0.x;
  const dy = targetGoalY - c0.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const fallbackSpeed = Math.min(COIN_SOCCER_MAX_SPEED, 11);
  return {
    type: 'flick',
    payload: {
      coinIndex: 0,
      vx: (dx / dist) * fallbackSpeed,
      vy: (dy / dist) * fallbackSpeed,
    },
  };
}
