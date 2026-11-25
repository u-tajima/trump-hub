import type { CrokinoleRules, PlayerInfo } from '../types/game';

export const CROKINOLE_BOARD_SIZE = 1000;
export const CROKINOLE_CENTER = 500;
export const CROKINOLE_PLAY_RADIUS = 450;
export const CROKINOLE_RING10_RADIUS = 280;
export const CROKINOLE_RING15_RADIUS = 145;
export const CROKINOLE_HOLE_RADIUS = 34;
export const CROKINOLE_DISC_RADIUS = 24;
export const CROKINOLE_PEG_RADIUS = 11;
export const CROKINOLE_SHOOT_RADIUS = 418;
export const CROKINOLE_MAX_SHOT_SPEED = 40;
export const CROKINOLE_MIN_SHOT_SPEED = 2.8;
export const CROKINOLE_MAX_STEPS = 380;

// 半径145の円周上に45度間隔で8本のバンパーペグを配置（22.5度オフセット）
export const CROKINOLE_PEGS: readonly { x: number; y: number }[] = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * Math.PI) / 4 + Math.PI / 8;
  return {
    x: CROKINOLE_CENTER + Math.cos(angle) * CROKINOLE_RING15_RADIUS,
    y: CROKINOLE_CENTER + Math.sin(angle) * CROKINOLE_RING15_RADIUS,
  };
});

export type CrokinoleDiscStatus = 'board' | 'hole20' | 'gutter';

export interface CrokinoleDisc {
  id: string;
  ownerIndex: 0 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  status: CrokinoleDiscStatus;
}

export interface CrokinolePlayerState {
  id: string;
  name: string;
  isBot: boolean;
  color: 'ivory' | 'crimson';
  score: number;
  discsLeft: number;
  roundHole20Count: number;
}

export interface CrokinoleRoundResult {
  round: number;
  p0BoardPoints: number;
  p1BoardPoints: number;
  p0Hole20: number;
  p1Hole20: number;
  p0Total: number;
  p1Total: number;
  winnerIndex: 0 | 1 | null;
  awardedPoints: number;
}

export interface CrokinoleShotRecord {
  shotId: number;
  shooterId: string;
  shooterIndex: 0 | 1;
  initialDiscs: CrokinoleDisc[];
  shotDiscId: string;
  hole20Ids: string[];
  gutterIds: string[];
  steps: number;
  summary: string;
  roundFinished: boolean;
}

export interface CrokinoleInternalState {
  rules: CrokinoleRules;
  players: [CrokinolePlayerState, CrokinolePlayerState];
  discs: CrokinoleDisc[];
  round: number;
  roundStarterIndex: 0 | 1;
  turnIndex: 0 | 1;
  shotSeq: number;
  lastShot: CrokinoleShotRecord | null;
  lastRoundResult: CrokinoleRoundResult | null;
  nextBotActionAt: number;
  winnerId: string | 'draw' | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface CrokinoleClientState extends CrokinoleInternalState {
  myId: string;
}

export interface CrokinoleStepResult {
  moving: boolean;
  newlyHole20Ids: string[];
  newlyGutterIds: string[];
  collisions: { x: number; y: number; intensity: number; isPeg?: boolean }[];
}

const SUBSTEPS = 3;
const DISC_RESTITUTION = 0.88;
const PEG_RESTITUTION = 0.84;
const LINEAR_DRAG = 0.985;
const COULOMB_FRICTION = 0.042;
const STOP_SPEED = 0.14;
const HOLE20_CAPTURE_DIST = CROKINOLE_HOLE_RADIUS - 10;
const HOLE20_MAX_SPEED = 17.0;

export function getCrokinoleShootAngleRange(playerIndex: 0 | 1): {
  min: number;
  max: number;
  center: number;
} {
  const halfSpan = 0.62;
  const center = playerIndex === 0 ? Math.PI / 2 : -Math.PI / 2;
  return {
    min: center - halfSpan,
    max: center + halfSpan,
    center,
  };
}

export function getCrokinoleShootPosFromAngle(angle: number): { x: number; y: number } {
  return {
    x: CROKINOLE_CENTER + Math.cos(angle) * CROKINOLE_SHOOT_RADIUS,
    y: CROKINOLE_CENTER + Math.sin(angle) * CROKINOLE_SHOOT_RADIUS,
  };
}

/**
 * 自陣シューティングライン弧上で既存ディスクと重ならない角度を返す
 */
export function resolveCrokinoleShootAngle(
  discs: readonly CrokinoleDisc[],
  desiredAngle: number,
  playerIndex: 0 | 1
): number {
  const { min, max } = getCrokinoleShootAngleRange(playerIndex);
  const clamped = Math.max(min, Math.min(max, desiredAngle));
  const minDist = CROKINOLE_DISC_RADIUS * 2 + 4;
  const minDistSq = minDist * minDist;

  const isFree = (ang: number): boolean => {
    const pos = getCrokinoleShootPosFromAngle(ang);
    for (const d of discs) {
      if (d.status !== 'board') continue;
      const dx = d.x - pos.x;
      const dy = d.y - pos.y;
      if (dx * dx + dy * dy < minDistSq) return false;
    }
    return true;
  };

  if (isFree(clamped)) return clamped;

  for (let offset = 0.04; offset <= max - min; offset += 0.04) {
    if (clamped + offset <= max && isFree(clamped + offset)) return clamped + offset;
    if (clamped - offset >= min && isFree(clamped - offset)) return clamped - offset;
  }

  return clamped;
}

export function getCrokinoleDiscScore(x: number, y: number): 5 | 10 | 15 {
  const dist = Math.hypot(x - CROKINOLE_CENTER, y - CROKINOLE_CENTER);
  // 境界線に触れている場合は低い方のエリア点（公式ルール）
  if (dist + CROKINOLE_DISC_RADIUS <= CROKINOLE_RING15_RADIUS) return 15;
  if (dist + CROKINOLE_DISC_RADIUS <= CROKINOLE_RING10_RADIUS) return 10;
  return 5;
}

function cloneDiscs(discs: readonly CrokinoleDisc[]): CrokinoleDisc[] {
  return discs.map((d) => ({ ...d }));
}

function resolvePegCollision(
  disc: CrokinoleDisc,
  peg: { x: number; y: number }
): { x: number; y: number; intensity: number; isPeg: boolean } | null {
  const dx = disc.x - peg.x;
  const dy = disc.y - peg.y;
  const minDist = CROKINOLE_DISC_RADIUS + CROKINOLE_PEG_RADIUS;
  const distSq = dx * dx + dy * dy;
  if (distSq >= minDist * minDist) return null;

  const dist = distSq > 1e-8 ? Math.sqrt(distSq) : 0;
  const nx = dist > 0 ? dx / dist : 1;
  const ny = dist > 0 ? dy / dist : 0;

  const overlap = minDist - dist;
  disc.x += nx * overlap;
  disc.y += ny * overlap;

  const velAlongNormal = disc.vx * nx + disc.vy * ny;
  if (velAlongNormal >= 0) return null;

  const impulse = -(1 + PEG_RESTITUTION) * velAlongNormal;
  disc.vx += impulse * nx;
  disc.vy += impulse * ny;

  return {
    x: peg.x + nx * CROKINOLE_PEG_RADIUS,
    y: peg.y + ny * CROKINOLE_PEG_RADIUS,
    intensity: Math.min(1, Math.abs(velAlongNormal) / 22),
    isPeg: true,
  };
}

function resolveDiscCollision(
  a: CrokinoleDisc,
  b: CrokinoleDisc
): { x: number; y: number; intensity: number } | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minDist = CROKINOLE_DISC_RADIUS * 2;
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

  const impulse = (-(1 + DISC_RESTITUTION) * velAlongNormal) * 0.5;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * nx;
  b.vy += impulse * ny;

  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
    intensity: Math.min(1, Math.abs(velAlongNormal) / 22),
  };
}

function applyFriction(disc: CrokinoleDisc): boolean {
  const speed = Math.hypot(disc.vx, disc.vy);
  if (speed <= STOP_SPEED) {
    disc.vx = 0;
    disc.vy = 0;
    return false;
  }
  const nextSpeed = Math.max(0, speed * LINEAR_DRAG - COULOMB_FRICTION);
  if (nextSpeed <= STOP_SPEED) {
    disc.vx = 0;
    disc.vy = 0;
    return false;
  }
  const ratio = nextSpeed / speed;
  disc.vx *= ratio;
  disc.vy *= ratio;
  return true;
}

/**
 * 決定論的な1フレーム（60fps相当）物理シミュレーションステップ。
 * エンジン側とクライアントCanvasアニメーション側で同一関数を共有する。
 */
export function simulateCrokinoleStep(discs: CrokinoleDisc[]): CrokinoleStepResult {
  const newlyHole20Ids: string[] = [];
  const newlyGutterIds: string[] = [];
  const collisions: { x: number; y: number; intensity: number; isPeg?: boolean }[] = [];

  for (let sub = 0; sub < SUBSTEPS; sub++) {
    // 位置更新 + 20点ホール / ガター判定
    for (const d of discs) {
      if (d.status !== 'board') continue;
      d.x += d.vx / SUBSTEPS;
      d.y += d.vy / SUBSTEPS;

      const distFromCenter = Math.hypot(d.x - CROKINOLE_CENTER, d.y - CROKINOLE_CENTER);

      // 20点ホール落下判定（低速〜中低速で中心に収まるとホールイン）
      if (distFromCenter <= HOLE20_CAPTURE_DIST) {
        const speed = Math.hypot(d.vx, d.vy);
        if (speed <= HOLE20_MAX_SPEED) {
          d.status = 'hole20';
          d.x = CROKINOLE_CENTER;
          d.y = CROKINOLE_CENTER;
          d.vx = 0;
          d.vy = 0;
          newlyHole20Ids.push(d.id);
          continue;
        }
      }

      // 盤外（ガター）落下判定
      if (distFromCenter > CROKINOLE_PLAY_RADIUS + 4) {
        d.status = 'gutter';
        d.vx = 0;
        d.vy = 0;
        newlyGutterIds.push(d.id);
        continue;
      }
    }

    // ペグ衝突
    for (const d of discs) {
      if (d.status !== 'board') continue;
      for (const peg of CROKINOLE_PEGS) {
        const hit = resolvePegCollision(d, peg);
        if (hit && hit.intensity > 0.06) collisions.push(hit);
      }
    }

    // ディスク同士の衝突
    for (let i = 0; i < discs.length; i++) {
      const a = discs[i];
      if (a.status !== 'board') continue;
      for (let j = i + 1; j < discs.length; j++) {
        const b = discs[j];
        if (b.status !== 'board') continue;
        const hit = resolveDiscCollision(a, b);
        if (hit && hit.intensity > 0.06) collisions.push(hit);
      }
    }

    // 衝突押し出し後のペグ再補正
    for (const d of discs) {
      if (d.status !== 'board') continue;
      for (const peg of CROKINOLE_PEGS) {
        resolvePegCollision(d, peg);
      }
    }
  }

  let moving = false;
  for (const d of discs) {
    if (d.status !== 'board') continue;
    if (applyFriction(d)) moving = true;
  }

  return {
    moving,
    newlyHole20Ids,
    newlyGutterIds,
    collisions,
  };
}

export function initCrokinole(
  playersInfo: PlayerInfo[],
  rules: CrokinoleRules
): CrokinoleInternalState {
  const players: [CrokinolePlayerState, CrokinolePlayerState] = [
    {
      id: playersInfo[0].id,
      name: playersInfo[0].name,
      isBot: playersInfo[0].isBot,
      color: 'ivory',
      score: 0,
      discsLeft: rules.discsPerPlayer,
      roundHole20Count: 0,
    },
    {
      id: playersInfo[1].id,
      name: playersInfo[1].name,
      isBot: playersInfo[1].isBot,
      color: 'crimson',
      score: 0,
      discsLeft: rules.discsPerPlayer,
      roundHole20Count: 0,
    },
  ];

  return {
    rules,
    players,
    discs: [],
    round: 1,
    roundStarterIndex: 0,
    turnIndex: 0,
    shotSeq: 0,
    lastShot: null,
    lastRoundResult: null,
    nextBotActionAt: 0,
    winnerId: null,
    phase: 'playing',
    lastLog: `ラウンド1開始！ ${players[0].name} からショット`,
  };
}

export function applyCrokinoleAction(
  state: CrokinoleInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: CrokinoleInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }

  const shooterIndex = state.turnIndex;
  const shooter = state.players[shooterIndex];
  if (shooter.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }

  if (shooter.discsLeft <= 0) {
    return { state, error: '手持ちディスクがありません' };
  }

  if (action.type !== 'shoot') {
    return { state, error: '不明なアクションです' };
  }

  const payload = action.payload as { angle?: number; vx?: number; vy?: number } | undefined;
  if (
    !payload ||
    typeof payload.angle !== 'number' ||
    typeof payload.vx !== 'number' ||
    typeof payload.vy !== 'number' ||
    !Number.isFinite(payload.angle) ||
    !Number.isFinite(payload.vx) ||
    !Number.isFinite(payload.vy)
  ) {
    return { state, error: 'ショットパラメータが不正です' };
  }

  const rawSpeed = Math.hypot(payload.vx, payload.vy);
  if (rawSpeed < CROKINOLE_MIN_SHOT_SPEED) {
    return { state, error: 'ショットの威力が弱すぎます' };
  }

  const scale = rawSpeed > CROKINOLE_MAX_SHOT_SPEED ? CROKINOLE_MAX_SHOT_SPEED / rawSpeed : 1;
  const vx = payload.vx * scale;
  const vy = payload.vy * scale;

  const resolvedAngle = resolveCrokinoleShootAngle(state.discs, payload.angle, shooterIndex);
  const startPos = getCrokinoleShootPosFromAngle(resolvedAngle);

  const shotSeq = state.shotSeq + 1;
  const shotDiscId = `r${state.round}_s${shotSeq}_p${shooterIndex}`;
  const shotDisc: CrokinoleDisc = {
    id: shotDiscId,
    ownerIndex: shooterIndex,
    x: startPos.x,
    y: startPos.y,
    vx,
    vy,
    status: 'board',
  };

  const initialDiscs: CrokinoleDisc[] = [
    ...cloneDiscs(state.discs.filter((d) => d.status === 'board')).map((d) => ({
      ...d,
      vx: 0,
      vy: 0,
    })),
    shotDisc,
  ];

  const simDiscs = cloneDiscs(initialDiscs);
  const hole20Ids: string[] = [];
  const gutterIds: string[] = [];
  let steps = 0;

  for (let i = 0; i < CROKINOLE_MAX_STEPS; i++) {
    steps = i + 1;
    const res = simulateCrokinoleStep(simDiscs);
    if (res.newlyHole20Ids.length > 0) hole20Ids.push(...res.newlyHole20Ids);
    if (res.newlyGutterIds.length > 0) gutterIds.push(...res.newlyGutterIds);
    if (!res.moving) break;
  }

  for (const d of simDiscs) {
    d.vx = 0;
    d.vy = 0;
  }

  const nextPlayers: [CrokinolePlayerState, CrokinolePlayerState] = [
    { ...state.players[0] },
    { ...state.players[1] },
  ];
  nextPlayers[shooterIndex].discsLeft -= 1;

  // 20点ホール獲得カウント
  let ownHole20ThisShot = 0;
  for (const hid of hole20Ids) {
    const disc = simDiscs.find((d) => d.id === hid);
    if (!disc) continue;
    nextPlayers[disc.ownerIndex].roundHole20Count += 1;
    if (disc.ownerIndex === shooterIndex) ownHole20ThisShot += 1;
  }

  const remainingBoardDiscs = simDiscs.filter((d) => d.status === 'board');

  const events: string[] = [];
  if (ownHole20ThisShot > 0) {
    events.push(`20点ホールイン！ (+${ownHole20ThisShot * 20})`);
  } else if (hole20Ids.length > 0) {
    events.push('相手ディスクが20点ホールイン');
  }

  const opponentIndex: 0 | 1 = shooterIndex === 0 ? 1 : 0;
  const knockedOutOpponent = gutterIds.filter((gid) => {
    const d = simDiscs.find((x) => x.id === gid);
    return d && d.ownerIndex === opponentIndex;
  }).length;
  const selfGuttered = gutterIds.includes(shotDiscId);

  if (knockedOutOpponent > 0) {
    events.push(`相手ディスク×${knockedOutOpponent} 弾き出し`);
  }
  if (selfGuttered) {
    events.push('ガター落下');
  } else if (events.length === 0) {
    const landed = remainingBoardDiscs.find((d) => d.id === shotDiscId);
    if (landed) {
      const pts = getCrokinoleDiscScore(landed.x, landed.y);
      events.push(`${pts}点エリアに着地`);
    }
  }

  const summary = `${shooter.name}: ${events.join(' / ')}`;

  const roundFinished = nextPlayers[0].discsLeft === 0 && nextPlayers[1].discsLeft === 0;
  let nextRound = state.round;
  let nextRoundStarterIndex = state.roundStarterIndex;
  let nextTurnIndex: 0 | 1 = opponentIndex;
  let nextDiscs = remainingBoardDiscs;
  let lastRoundResult = state.lastRoundResult;
  let winnerId: string | 'draw' | null = null;
  let phase: 'playing' | 'finished' = 'playing';
  let lastLog = `${summary} → ${nextPlayers[opponentIndex].name} の番`;

  if (roundFinished) {
    let p0BoardPoints = 0;
    let p1BoardPoints = 0;
    for (const d of remainingBoardDiscs) {
      const pts = getCrokinoleDiscScore(d.x, d.y);
      if (d.ownerIndex === 0) p0BoardPoints += pts;
      else p1BoardPoints += pts;
    }
    const p0Hole20 = nextPlayers[0].roundHole20Count;
    const p1Hole20 = nextPlayers[1].roundHole20Count;
    const p0Total = p0BoardPoints + p0Hole20 * 20;
    const p1Total = p1BoardPoints + p1Hole20 * 20;

    let roundWinnerIndex: 0 | 1 | null = null;
    let awardedPoints = 0;
    if (p0Total > p1Total) {
      roundWinnerIndex = 0;
      awardedPoints = p0Total - p1Total;
      nextPlayers[0].score += awardedPoints;
    } else if (p1Total > p0Total) {
      roundWinnerIndex = 1;
      awardedPoints = p1Total - p0Total;
      nextPlayers[1].score += awardedPoints;
    }

    lastRoundResult = {
      round: state.round,
      p0BoardPoints,
      p1BoardPoints,
      p0Hole20,
      p1Hole20,
      p0Total,
      p1Total,
      winnerIndex: roundWinnerIndex,
      awardedPoints,
    };

    if (nextPlayers[0].score >= state.rules.targetScore || nextPlayers[1].score >= state.rules.targetScore) {
      phase = 'finished';
      if (nextPlayers[0].score > nextPlayers[1].score) winnerId = nextPlayers[0].id;
      else if (nextPlayers[1].score > nextPlayers[0].score) winnerId = nextPlayers[1].id;
      else winnerId = 'draw';

      const wName =
        winnerId === 'draw'
          ? '引き分け'
          : nextPlayers.find((p) => p.id === winnerId)?.name ?? '';
      lastLog =
        winnerId === 'draw'
          ? `R${state.round}終了・引き分け！`
          : `R${state.round}終了！ ${wName} が目標点到達で勝利！`;
    } else {
      // 次ラウンド準備
      nextRound = state.round + 1;
      nextRoundStarterIndex = state.roundStarterIndex === 0 ? 1 : 0;
      nextTurnIndex = nextRoundStarterIndex;
      nextDiscs = [];
      nextPlayers[0].discsLeft = state.rules.discsPerPlayer;
      nextPlayers[1].discsLeft = state.rules.discsPerPlayer;
      nextPlayers[0].roundHole20Count = 0;
      nextPlayers[1].roundHole20Count = 0;

      const diffText =
        roundWinnerIndex === null
          ? '同点 (+0)'
          : `${nextPlayers[roundWinnerIndex].name} +${awardedPoints}pt`;
      lastLog = `R${state.round}集計: ${p0Total}対${p1Total} (${diffText}) → R${nextRound}開始`;
    }
  } else if (nextPlayers[opponentIndex].discsLeft === 0) {
    nextTurnIndex = shooterIndex;
  }

  const lastShot: CrokinoleShotRecord = {
    shotId: shotSeq,
    shooterId: shooter.id,
    shooterIndex,
    initialDiscs,
    shotDiscId,
    hole20Ids,
    gutterIds,
    steps,
    summary,
    roundFinished,
  };

  return {
    state: {
      ...state,
      players: nextPlayers,
      discs: nextDiscs,
      round: nextRound,
      roundStarterIndex: nextRoundStarterIndex,
      turnIndex: nextTurnIndex,
      shotSeq,
      lastShot,
      lastRoundResult,
      nextBotActionAt: Date.now() + Math.ceil((steps / 60) * 1000) + (roundFinished ? 1100 : 600),
      winnerId,
      phase,
      lastLog,
    },
  };
}

export function sanitizeCrokinoleState(
  state: CrokinoleInternalState,
  playerId: string
): CrokinoleClientState {
  return {
    ...state,
    myId: playerId,
  };
}

/**
 * 相手の高得点ディスク弾き出し or 中央20点ホール狙いをシミュレーション評価して選ぶBot
 */
export function computeCrokinoleBotAction(
  state: CrokinoleInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;

  const shooterIndex = state.turnIndex;
  const opponentIndex: 0 | 1 = shooterIndex === 0 ? 1 : 0;
  const range = getCrokinoleShootAngleRange(shooterIndex);

  const boardDiscs = state.discs.filter((d) => d.status === 'board');
  const oppDiscs = boardDiscs.filter((d) => d.ownerIndex === opponentIndex);

  let bestValue = -Infinity;
  let bestShot: { angle: number; vx: number; vy: number } | null = null;

  const evaluateShot = (rawAngle: number, targetX: number, targetY: number, speed: number) => {
    const angle = resolveCrokinoleShootAngle(boardDiscs, rawAngle, shooterIndex);
    const start = getCrokinoleShootPosFromAngle(angle);
    const dx = targetX - start.x;
    const dy = targetY - start.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 20) return;

    const ux = dx / dist;
    const uy = dy / dist;

    const testDiscs: CrokinoleDisc[] = [
      ...cloneDiscs(boardDiscs),
      {
        id: 'bot_test',
        ownerIndex: shooterIndex,
        x: start.x,
        y: start.y,
        vx: ux * speed,
        vy: uy * speed,
        status: 'board',
      },
    ];

    let own20 = 0;
    let opp20 = 0;
    for (let s = 0; s < CROKINOLE_MAX_STEPS; s++) {
      const res = simulateCrokinoleStep(testDiscs);
      for (const hid of res.newlyHole20Ids) {
        const d = testDiscs.find((x) => x.id === hid);
        if (d) {
          if (d.ownerIndex === shooterIndex) own20 += 1;
          else opp20 += 1;
        }
      }
      if (!res.moving) break;
    }

    let ownPts = own20 * 24; // 20点ホールを高評価
    let oppPts = opp20 * 24;
    for (const d of testDiscs) {
      if (d.status !== 'board') continue;
      const pts = getCrokinoleDiscScore(d.x, d.y);
      if (d.ownerIndex === shooterIndex) ownPts += pts;
      else oppPts += pts;
    }

    const value = ownPts - oppPts;
    if (value > bestValue) {
      bestValue = value;
      bestShot = { angle, vx: ux * speed, vy: uy * speed };
    }
  };

  // 1. 中央20点ホール狙い（複数角度・複数スピード）
  const sampleAngles = [
    range.center,
    range.center - 0.25,
    range.center + 0.25,
    range.center - 0.48,
    range.center + 0.48,
  ];
  for (const ang of sampleAngles) {
    evaluateShot(ang, CROKINOLE_CENTER, CROKINOLE_CENTER, 16.5);
    evaluateShot(ang, CROKINOLE_CENTER, CROKINOLE_CENTER, 18.2);
    evaluateShot(ang, CROKINOLE_CENTER, CROKINOLE_CENTER, 20.5);
  }

  // 2. 相手ディスクへの弾き出しショット
  for (const opp of oppDiscs) {
    const oppAngles = [range.center, range.center - 0.35, range.center + 0.35];
    for (const ang of oppAngles) {
      evaluateShot(ang, opp.x, opp.y, 26);
      evaluateShot(ang, opp.x, opp.y, 33);
    }
  }

  const applyHumanJitter = (shot: { angle: number; vx: number; vy: number }) => {
    const baseSpeed = Math.hypot(shot.vx, shot.vy);
    const baseAngle = Math.atan2(shot.vy, shot.vx);
    // 人間らしい自然な角度ブレ（±2.5度）と速度ブレ（±6%）
    const maxAngleJitterRad = (2.5 * Math.PI) / 180;
    const angleJitter = (Math.random() - 0.5) * 2 * maxAngleJitterRad;
    const speedScale = 0.94 + Math.random() * 0.12;
    const clampedSpeed = Math.max(
      CROKINOLE_MIN_SHOT_SPEED,
      Math.min(CROKINOLE_MAX_SHOT_SPEED, baseSpeed * speedScale)
    );
    const finalAngle = baseAngle + angleJitter;
    return {
      angle: shot.angle,
      vx: Math.cos(finalAngle) * clampedSpeed,
      vy: Math.sin(finalAngle) * clampedSpeed,
    };
  };

  if (bestShot !== null) {
    return {
      type: 'shoot',
      payload: applyHumanJitter(bestShot),
    };
  }

  const fallbackPos = getCrokinoleShootPosFromAngle(range.center);
  const dx = CROKINOLE_CENTER - fallbackPos.x;
  const dy = CROKINOLE_CENTER - fallbackPos.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  return {
    type: 'shoot',
    payload: applyHumanJitter({
      angle: range.center,
      vx: (dx / dist) * 18,
      vy: (dy / dist) * 18,
    }),
  };
}
