import type { CarromRules, PlayerInfo } from '../types/game';

export const CARROM_BOARD_SIZE = 1000;
export const CARROM_WALL_INSET = 14;
export const CARROM_POCKET_RADIUS = 38;
export const CARROM_PIECE_RADIUS = 22;
export const CARROM_STRIKER_RADIUS = 27;
export const CARROM_BASELINE_MIN_X = 215;
export const CARROM_BASELINE_MAX_X = 785;
export const CARROM_BASELINE_Y_P0 = 835;
export const CARROM_BASELINE_Y_P1 = 165;
export const CARROM_MAX_SHOT_SPEED = 42;
export const CARROM_MIN_SHOT_SPEED = 2.5;
export const CARROM_MAX_STEPS = 420;

export const CARROM_POCKETS: readonly { x: number; y: number }[] = [
  { x: 52, y: 52 },
  { x: 948, y: 52 },
  { x: 52, y: 948 },
  { x: 948, y: 948 },
];

export type CarromPieceColor = 'white' | 'black' | 'queen';

export interface CarromPiece {
  id: string;
  color: CarromPieceColor;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pocketed: boolean;
}

export interface CarromStriker {
  x: number;
  y: number;
  vx: number;
  vy: number;
  pocketed: boolean;
}

export interface CarromPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  color: 'white' | 'black';
  score: number;
  pocketedCount: number;
}

export interface CarromShotRecord {
  shotId: number;
  shooterId: string;
  shooterIndex: 0 | 1;
  initialPieces: CarromPiece[];
  initialStriker: CarromStriker;
  pocketedIds: string[];
  strikerPocketed: boolean;
  steps: number;
  summary: string;
}

export interface CarromInternalState {
  rules: CarromRules;
  players: [CarromPlayerState, CarromPlayerState];
  pieces: CarromPiece[];
  turnIndex: 0 | 1;
  queenPendingBy: string | null;
  queenOwnerId: string | null;
  shotSeq: number;
  lastShot: CarromShotRecord | null;
  nextBotActionAt: number;
  winnerId: string | 'draw' | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface CarromClientState extends CarromInternalState {
  myId: string;
}

export interface CarromStepResult {
  moving: boolean;
  newlyPocketedIds: string[];
  strikerNewlyPocketed: boolean;
  collisions: { x: number; y: number; intensity: number }[];
}

const SUBSTEPS = 3;
const WALL_RESTITUTION = 0.78;
const PIECE_RESTITUTION = 0.88;
const PIECE_MASS = 1.0;
const STRIKER_MASS = 2.4;
const LINEAR_DRAG = 0.984;
const COULOMB_FRICTION = 0.045;
const STOP_SPEED = 0.14;
const POCKET_CAPTURE_RADIUS = CARROM_POCKET_RADIUS - 3;

function clonePieces(pieces: CarromPiece[]): CarromPiece[] {
  return pieces.map((p) => ({ ...p }));
}

function createInitialPieces(piecesPerSide: 5 | 9): CarromPiece[] {
  const cx = CARROM_BOARD_SIZE / 2;
  const cy = CARROM_BOARD_SIZE / 2;
  const pieces: CarromPiece[] = [
    {
      id: 'queen',
      color: 'queen',
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      pocketed: false,
    },
  ];

  // 内リング: 6個（白3・黒3を交互配置、半径46）
  const innerRadius = CARROM_PIECE_RADIUS * 2 + 2;
  let whiteIdx = 1;
  let blackIdx = 1;

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6 - Math.PI / 2;
    const color: 'white' | 'black' = i % 2 === 0 ? 'white' : 'black';
    const id = color === 'white' ? `w${whiteIdx++}` : `b${blackIdx++}`;
    pieces.push({
      id,
      color,
      x: cx + Math.cos(angle) * innerRadius,
      y: cy + Math.sin(angle) * innerRadius,
      vx: 0,
      vy: 0,
      pocketed: false,
    });
  }

  // 外リング: piecesPerSide===9 なら12個（白6・黒6）、5 なら4個（白2・黒2）
  const outerCount = piecesPerSide === 9 ? 12 : 4;
  const outerRadius = CARROM_PIECE_RADIUS * 4 + 3;
  const angleOffset = piecesPerSide === 9 ? -Math.PI / 2 : -Math.PI / 4;

  for (let i = 0; i < outerCount; i++) {
    const angle = (i * Math.PI * 2) / outerCount + angleOffset;
    const color: 'white' | 'black' = i % 2 === 0 ? 'white' : 'black';
    const id = color === 'white' ? `w${whiteIdx++}` : `b${blackIdx++}`;
    pieces.push({
      id,
      color,
      x: cx + Math.cos(angle) * outerRadius,
      y: cy + Math.sin(angle) * outerRadius,
      vx: 0,
      vy: 0,
      pocketed: false,
    });
  }

  return pieces;
}

export function getCarromBaselineY(playerIndex: 0 | 1): number {
  return playerIndex === 0 ? CARROM_BASELINE_Y_P0 : CARROM_BASELINE_Y_P1;
}

/**
 * ベースライン上で既存パックと重ならないストライカーX位置を返す
 */
export function resolveCarromStrikerX(
  pieces: readonly CarromPiece[],
  desiredX: number,
  baselineY: number
): number {
  const clamped = Math.max(CARROM_BASELINE_MIN_X, Math.min(CARROM_BASELINE_MAX_X, desiredX));
  const minDist = CARROM_STRIKER_RADIUS + CARROM_PIECE_RADIUS + 2;
  const minDistSq = minDist * minDist;

  const isFree = (x: number): boolean => {
    for (const p of pieces) {
      if (p.pocketed) continue;
      const dx = p.x - x;
      const dy = p.y - baselineY;
      if (dx * dx + dy * dy < minDistSq) return false;
    }
    return true;
  };

  if (isFree(clamped)) return clamped;

  for (let offset = 6; offset <= CARROM_BASELINE_MAX_X - CARROM_BASELINE_MIN_X; offset += 6) {
    const right = clamped + offset;
    if (right <= CARROM_BASELINE_MAX_X && isFree(right)) return right;
    const left = clamped - offset;
    if (left >= CARROM_BASELINE_MIN_X && isFree(left)) return left;
  }

  return clamped;
}

function findFreeCenterSpot(pieces: readonly CarromPiece[]): { x: number; y: number } {
  const cx = CARROM_BOARD_SIZE / 2;
  const cy = CARROM_BOARD_SIZE / 2;
  const minDist = CARROM_PIECE_RADIUS * 2 + 2;
  const minDistSq = minDist * minDist;

  const isFree = (x: number, y: number): boolean => {
    for (const p of pieces) {
      if (p.pocketed) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < minDistSq) return false;
    }
    return true;
  };

  if (isFree(cx, cy)) return { x: cx, y: cy };

  for (let r = 24; r <= 240; r += 12) {
    const steps = Math.max(8, Math.round((2 * Math.PI * r) / 24));
    for (let i = 0; i < steps; i++) {
      const a = (i * Math.PI * 2) / steps;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (isFree(x, y)) return { x, y };
    }
  }

  return { x: cx, y: cy };
}

function isInPocket(x: number, y: number): boolean {
  const rSq = POCKET_CAPTURE_RADIUS * POCKET_CAPTURE_RADIUS;
  for (const pocket of CARROM_POCKETS) {
    const dx = x - pocket.x;
    const dy = y - pocket.y;
    if (dx * dx + dy * dy <= rSq) return true;
  }
  return false;
}

function resolveWallBounce(body: { x: number; y: number; vx: number; vy: number }, radius: number): void {
  const minPos = CARROM_WALL_INSET + radius;
  const maxPos = CARROM_BOARD_SIZE - CARROM_WALL_INSET - radius;

  if (body.x < minPos) {
    body.x = minPos;
    if (body.vx < 0) body.vx = -body.vx * WALL_RESTITUTION;
  } else if (body.x > maxPos) {
    body.x = maxPos;
    if (body.vx > 0) body.vx = -body.vx * WALL_RESTITUTION;
  }

  if (body.y < minPos) {
    body.y = minPos;
    if (body.vy < 0) body.vy = -body.vy * WALL_RESTITUTION;
  } else if (body.y > maxPos) {
    body.y = maxPos;
    if (body.vy > 0) body.vy = -body.vy * WALL_RESTITUTION;
  }
}

function resolveCircleCollision(
  a: { x: number; y: number; vx: number; vy: number },
  ra: number,
  ma: number,
  b: { x: number; y: number; vx: number; vy: number },
  rb: number,
  mb: number
): { x: number; y: number; intensity: number } | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minDist = ra + rb;
  const distSq = dx * dx + dy * dy;

  if (distSq >= minDist * minDist) return null;

  let dist: number;
  let nx: number;
  let ny: number;
  if (distSq === 0) {
    // 完全重複時は微小オフセット方向へ分離
    dist = 0;
    nx = 1;
    ny = 0;
  } else {
    dist = Math.sqrt(distSq);
    nx = dx / dist;
    ny = dy / dist;
  }

  // めり込み補正
  const overlap = minDist - dist;
  const invMa = 1 / ma;
  const invMb = 1 / mb;
  const invSum = invMa + invMb;
  const corr = overlap / invSum;

  a.x -= nx * corr * invMa;
  a.y -= ny * corr * invMa;
  b.x += nx * corr * invMb;
  b.y += ny * corr * invMb;

  // 相対速度
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;

  if (velAlongNormal > 0) return null;

  const impulse = (-(1 + PIECE_RESTITUTION) * velAlongNormal) / invSum;
  const ix = impulse * nx;
  const iy = impulse * ny;

  a.vx -= ix * invMa;
  a.vy -= iy * invMa;
  b.vx += ix * invMb;
  b.vy += iy * invMb;

  return {
    x: a.x + nx * ra,
    y: a.y + ny * ra,
    intensity: Math.min(1, Math.abs(velAlongNormal) / 24),
  };
}

function applyFriction(body: { vx: number; vy: number }): boolean {
  const speed = Math.hypot(body.vx, body.vy);
  if (speed <= STOP_SPEED) {
    body.vx = 0;
    body.vy = 0;
    return false;
  }
  const nextSpeed = Math.max(0, speed * LINEAR_DRAG - COULOMB_FRICTION);
  if (nextSpeed <= STOP_SPEED) {
    body.vx = 0;
    body.vy = 0;
    return false;
  }
  const ratio = nextSpeed / speed;
  body.vx *= ratio;
  body.vy *= ratio;
  return true;
}

/**
 * 決定論的な1フレーム（60fps相当）物理シミュレーションステップ。
 * エンジン側とクライアントCanvasアニメーション側で同一関数を共有し、停止位置を完全一致させる。
 */
export function simulateCarromStep(
  pieces: CarromPiece[],
  striker: CarromStriker
): CarromStepResult {
  const newlyPocketedIds: string[] = [];
  let strikerNewlyPocketed = false;
  const collisions: { x: number; y: number; intensity: number }[] = [];

  for (let sub = 0; sub < SUBSTEPS; sub++) {
    // 位置更新 & ポケット判定 & 壁反射
    for (const p of pieces) {
      if (p.pocketed) continue;
      p.x += p.vx / SUBSTEPS;
      p.y += p.vy / SUBSTEPS;

      if (isInPocket(p.x, p.y)) {
        p.pocketed = true;
        p.vx = 0;
        p.vy = 0;
        newlyPocketedIds.push(p.id);
        continue;
      }
      resolveWallBounce(p, CARROM_PIECE_RADIUS);
    }

    if (!striker.pocketed) {
      striker.x += striker.vx / SUBSTEPS;
      striker.y += striker.vy / SUBSTEPS;

      if (isInPocket(striker.x, striker.y)) {
        striker.pocketed = true;
        striker.vx = 0;
        striker.vy = 0;
        strikerNewlyPocketed = true;
      } else {
        resolveWallBounce(striker, CARROM_STRIKER_RADIUS);
      }
    }

    // ストライカー vs パック衝突
    if (!striker.pocketed) {
      for (const p of pieces) {
        if (p.pocketed) continue;
        const hit = resolveCircleCollision(
          striker,
          CARROM_STRIKER_RADIUS,
          STRIKER_MASS,
          p,
          CARROM_PIECE_RADIUS,
          PIECE_MASS
        );
        if (hit && hit.intensity > 0.08) collisions.push(hit);
      }
    }

    // パック vs パック衝突
    for (let i = 0; i < pieces.length; i++) {
      const a = pieces[i];
      if (a.pocketed) continue;
      for (let j = i + 1; j < pieces.length; j++) {
        const b = pieces[j];
        if (b.pocketed) continue;
        const hit = resolveCircleCollision(
          a,
          CARROM_PIECE_RADIUS,
          PIECE_MASS,
          b,
          CARROM_PIECE_RADIUS,
          PIECE_MASS
        );
        if (hit && hit.intensity > 0.08) collisions.push(hit);
      }
    }

    // 衝突押し出し後の壁クランプ
    for (const p of pieces) {
      if (p.pocketed) continue;
      resolveWallBounce(p, CARROM_PIECE_RADIUS);
    }
    if (!striker.pocketed) {
      resolveWallBounce(striker, CARROM_STRIKER_RADIUS);
    }
  }

  // 摩擦減速
  let moving = false;
  for (const p of pieces) {
    if (p.pocketed) continue;
    if (applyFriction(p)) moving = true;
  }
  if (!striker.pocketed) {
    if (applyFriction(striker)) moving = true;
  }

  return {
    moving,
    newlyPocketedIds,
    strikerNewlyPocketed,
    collisions,
  };
}

export function initCarrom(playersInfo: PlayerInfo[], rules: CarromRules): CarromInternalState {
  const players: [CarromPlayerState, CarromPlayerState] = [
    {
      id: playersInfo[0].id,
      name: playersInfo[0].name,
      isBot: playersInfo[0].isBot,
      color: 'white',
      score: 0,
      pocketedCount: 0,
    },
    {
      id: playersInfo[1].id,
      name: playersInfo[1].name,
      isBot: playersInfo[1].isBot,
      color: 'black',
      score: 0,
      pocketedCount: 0,
    },
  ];

  return {
    rules,
    players,
    pieces: createInitialPieces(rules.piecesPerSide),
    turnIndex: 0,
    queenPendingBy: null,
    queenOwnerId: null,
    shotSeq: 0,
    lastShot: null,
    nextBotActionAt: 0,
    winnerId: null,
    phase: 'playing',
    lastLog: `${players[0].name} (白) のブレイクショット！`,
  };
}

function recomputePlayerScores(
  players: [CarromPlayerState, CarromPlayerState],
  pieces: CarromPiece[],
  queenOwnerId: string | null,
  queenBonus: number
): [CarromPlayerState, CarromPlayerState] {
  const whitePocketed = pieces.filter((p) => p.color === 'white' && p.pocketed).length;
  const blackPocketed = pieces.filter((p) => p.color === 'black' && p.pocketed).length;

  return [
    {
      ...players[0],
      pocketedCount: whitePocketed,
      score: whitePocketed + (queenOwnerId === players[0].id ? queenBonus : 0),
    },
    {
      ...players[1],
      pocketedCount: blackPocketed,
      score: blackPocketed + (queenOwnerId === players[1].id ? queenBonus : 0),
    },
  ];
}

export function applyCarromAction(
  state: CarromInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: CarromInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }

  const shooterIndex = state.turnIndex;
  const shooter = state.players[shooterIndex];
  if (shooter.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }

  if (action.type !== 'shoot') {
    return { state, error: '不明なアクションです' };
  }

  const payload = action.payload as { strikerX?: number; vx?: number; vy?: number } | undefined;
  if (
    !payload ||
    typeof payload.strikerX !== 'number' ||
    typeof payload.vx !== 'number' ||
    typeof payload.vy !== 'number' ||
    !Number.isFinite(payload.strikerX) ||
    !Number.isFinite(payload.vx) ||
    !Number.isFinite(payload.vy)
  ) {
    return { state, error: 'ショットパラメータが不正です' };
  }

  const rawSpeed = Math.hypot(payload.vx, payload.vy);
  if (rawSpeed < CARROM_MIN_SHOT_SPEED) {
    return { state, error: 'ショットの威力が弱すぎます' };
  }

  const scale = rawSpeed > CARROM_MAX_SHOT_SPEED ? CARROM_MAX_SHOT_SPEED / rawSpeed : 1;
  const vx = payload.vx * scale;
  const vy = payload.vy * scale;

  const baselineY = getCarromBaselineY(shooterIndex);
  const startX = resolveCarromStrikerX(state.pieces, payload.strikerX, baselineY);

  const initialPieces = clonePieces(state.pieces).map((p) => ({ ...p, vx: 0, vy: 0 }));
  const initialStriker: CarromStriker = {
    x: startX,
    y: baselineY,
    vx,
    vy,
    pocketed: false,
  };

  // 物理シミュレーション実行
  const simPieces = clonePieces(initialPieces);
  const simStriker: CarromStriker = { ...initialStriker };
  const pocketedIds: string[] = [];
  let strikerPocketed = false;
  let steps = 0;

  for (let i = 0; i < CARROM_MAX_STEPS; i++) {
    steps = i + 1;
    const res = simulateCarromStep(simPieces, simStriker);
    if (res.newlyPocketedIds.length > 0) {
      pocketedIds.push(...res.newlyPocketedIds);
    }
    if (res.strikerNewlyPocketed) {
      strikerPocketed = true;
    }
    if (!res.moving) break;
  }

  // 全停止を保証
  for (const p of simPieces) {
    p.vx = 0;
    p.vy = 0;
  }

  const ownColor = shooter.color;
  const pocketedSet = new Set(pocketedIds);
  const ownPocketed = simPieces.filter((p) => p.color === ownColor && pocketedSet.has(p.id)).length;
  const queenPiece = simPieces.find((p) => p.color === 'queen')!;
  const queenPocketedThisTurn = pocketedSet.has(queenPiece.id);

  let queenPendingBy = state.queenPendingBy;
  let queenOwnerId = state.queenOwnerId;
  const events: string[] = [];

  const returnQueenToCenter = () => {
    const spot = findFreeCenterSpot(simPieces);
    queenPiece.pocketed = false;
    queenPiece.x = spot.x;
    queenPiece.y = spot.y;
    queenPiece.vx = 0;
    queenPiece.vy = 0;
  };

  if (strikerPocketed) {
    // ファウル: 落とした自色パックがあれば1個中央に戻す
    events.push('ファウル（ストライカー落下）');
    const pocketedOwn = simPieces.find((p) => p.color === ownColor && p.pocketed);
    if (pocketedOwn) {
      const spot = findFreeCenterSpot(simPieces);
      pocketedOwn.pocketed = false;
      pocketedOwn.x = spot.x;
      pocketedOwn.y = spot.y;
      pocketedOwn.vx = 0;
      pocketedOwn.vy = 0;
      events.push('ペナルティで1個返却');
    }
    if (queenPendingBy === shooter.id || queenPocketedThisTurn) {
      returnQueenToCenter();
      queenPendingBy = null;
      events.push('クイーン中央復帰');
    }
  } else {
    // 前手からクイーンカバー待ちだった場合
    if (queenPendingBy === shooter.id) {
      if (ownPocketed > 0) {
        queenOwnerId = shooter.id;
        queenPendingBy = null;
        events.push(`クイーン獲得 (+${state.rules.queenBonus})`);
      } else {
        returnQueenToCenter();
        queenPendingBy = null;
        events.push('クイーンカバー失敗・中央復帰');
      }
    }

    // 今ターンでクイーンを落とした場合
    if (queenPocketedThisTurn) {
      const ownLeftNow = simPieces.filter((p) => p.color === ownColor && !p.pocketed).length;
      if (ownPocketed > 0 || ownLeftNow === 0) {
        queenOwnerId = shooter.id;
        queenPendingBy = null;
        events.push(`クイーン獲得 (+${state.rules.queenBonus})`);
      } else {
        queenPendingBy = shooter.id;
        events.push('クイーンイン！次手でカバー');
      }
    }

    if (ownPocketed > 0) {
      events.push(`${ownColor === 'white' ? '白' : '黒'}×${ownPocketed} ポケットイン`);
    }
  }

  // クイーン未獲得（盤上またはカバー待ち）のまま同手でクイーンを落とさずに自色最後のパックを落とした場合、
  // 公式ルールに準じて自色パック1個を中央付近へ返却する（ペナルティ）
  let lastPiecePenalty = false;
  const queenOnBoardBeforeCheck = !queenPiece.pocketed || queenPendingBy !== null;
  const ownLeftAfterShot = simPieces.filter((p) => p.color === ownColor && !p.pocketed).length;
  if (queenOnBoardBeforeCheck && !queenPocketedThisTurn && ownLeftAfterShot === 0) {
    const returnPiece =
      simPieces.find((p) => p.color === ownColor && pocketedSet.has(p.id) && p.pocketed) ??
      simPieces.find((p) => p.color === ownColor && p.pocketed);
    if (returnPiece) {
      const spot = findFreeCenterSpot(simPieces);
      returnPiece.pocketed = false;
      returnPiece.x = spot.x;
      returnPiece.y = spot.y;
      returnPiece.vx = 0;
      returnPiece.vy = 0;
      lastPiecePenalty = true;
      events.push('クイーン未獲得で最終パック落下・1個返却');
    }
  }

  const nextPlayers = recomputePlayerScores(
    state.players,
    simPieces,
    queenOwnerId,
    state.rules.queenBonus
  );

  // 勝敗判定
  const whiteLeft = simPieces.filter((p) => p.color === 'white' && !p.pocketed).length;
  const blackLeft = simPieces.filter((p) => p.color === 'black' && !p.pocketed).length;
  const queenOnBoard = !queenPiece.pocketed || queenPendingBy !== null;

  let winnerId: string | 'draw' | null = null;
  let phase: 'playing' | 'finished' = 'playing';

  if (!queenOnBoard) {
    if (whiteLeft === 0 && blackLeft === 0) {
      if (nextPlayers[0].score > nextPlayers[1].score) winnerId = nextPlayers[0].id;
      else if (nextPlayers[1].score > nextPlayers[0].score) winnerId = nextPlayers[1].id;
      else winnerId = 'draw';
      phase = 'finished';
    } else if (whiteLeft === 0) {
      winnerId = nextPlayers[0].id;
      phase = 'finished';
    } else if (blackLeft === 0) {
      winnerId = nextPlayers[1].id;
      phase = 'finished';
    }
  }

  // 継続ターン判定
  const keepTurn =
    phase === 'playing' &&
    !strikerPocketed &&
    !lastPiecePenalty &&
    (ownPocketed > 0 || queenPocketedThisTurn);
  const nextTurnIndex: 0 | 1 = keepTurn ? shooterIndex : shooterIndex === 0 ? 1 : 0;

  const summary =
    events.length > 0
      ? `${shooter.name}: ${events.join(' / ')}`
      : `${shooter.name}: ノーポケット`;

  let lastLog = summary;
  if (phase === 'finished') {
    if (winnerId === 'draw') {
      lastLog = '引き分け！';
    } else {
      const winner = nextPlayers.find((p) => p.id === winnerId);
      lastLog = `${winner?.name ?? ''} の勝利！`;
    }
  } else if (keepTurn) {
    lastLog = `${summary} → 継続ターン！`;
  } else {
    lastLog = `${summary} → ${nextPlayers[nextTurnIndex].name} の番`;
  }

  const shotSeq = state.shotSeq + 1;
  const lastShot: CarromShotRecord = {
    shotId: shotSeq,
    shooterId: shooter.id,
    shooterIndex,
    initialPieces,
    initialStriker,
    pocketedIds,
    strikerPocketed,
    steps,
    summary,
  };

  return {
    state: {
      ...state,
      players: nextPlayers,
      pieces: simPieces,
      turnIndex: nextTurnIndex,
      queenPendingBy,
      queenOwnerId,
      shotSeq,
      lastShot,
      nextBotActionAt: Date.now() + Math.ceil((steps / 60) * 1000) + 550,
      winnerId,
      phase,
      lastLog,
    },
  };
}

export function sanitizeCarromState(
  state: CarromInternalState,
  playerId: string
): CarromClientState {
  return {
    ...state,
    myId: playerId,
  };
}

/**
 * 生存している自色パックと最寄りポケットの直線上を狙ってストライカー位置と初速を計算するBot
 */
export function computeCarromBotAction(
  state: CarromInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  const shooterIndex = state.turnIndex;
  const shooter = state.players[shooterIndex];
  const baselineY = getCarromBaselineY(shooterIndex);

  const ownPieces = state.pieces.filter((p) => !p.pocketed && p.color === shooter.color);
  const queen = state.pieces.find((p) => p.color === 'queen' && !p.pocketed);

  const targets: CarromPiece[] = [...ownPieces];
  if (queen && (ownPieces.length <= 2 || state.queenPendingBy === null)) {
    // 終盤や空きがあればクイーンも候補に含める
    if (ownPieces.length === 0 || ownPieces.length <= 3) {
      targets.push(queen);
    }
  }

  if (targets.length === 0) return null;

  const activePieces = state.pieces.filter((p) => !p.pocketed);

  const countObstacles = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    ignoreId: string,
    clearance: number
  ): number => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) return 0;
    let count = 0;
    for (const p of activePieces) {
      if (p.id === ignoreId) continue;
      const t = ((p.x - x1) * dx + (p.y - y1) * dy) / lenSq;
      if (t <= 0.04 || t >= 0.96) continue;
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      const dist = Math.hypot(p.x - px, p.y - py);
      if (dist < clearance) count++;
    }
    return count;
  };

  let bestScore = -Infinity;
  let bestShot: { strikerX: number; vx: number; vy: number } | null = null;

  const ghostOffset = CARROM_PIECE_RADIUS + CARROM_STRIKER_RADIUS - 1;

  for (const target of targets) {
    for (const pocket of CARROM_POCKETS) {
      const toPocketX = pocket.x - target.x;
      const toPocketY = pocket.y - target.y;
      const distToPocket = Math.hypot(toPocketX, toPocketY);
      if (distToPocket < 1) continue;

      const dirX = toPocketX / distToPocket;
      const dirY = toPocketY / distToPocket;

      const ghostX = target.x - dirX * ghostOffset;
      const ghostY = target.y - dirY * ghostOffset;

      // ベースラインとの直線交点を最優先候補に
      const candidateXs: number[] = [];
      if (Math.abs(dirY) > 0.15) {
        const t = (baselineY - ghostY) / dirY;
        const idealX = ghostX + dirX * t;
        if (idealX >= CARROM_BASELINE_MIN_X && idealX <= CARROM_BASELINE_MAX_X) {
          candidateXs.push(idealX);
        }
      }
      for (let x = CARROM_BASELINE_MIN_X; x <= CARROM_BASELINE_MAX_X; x += 95) {
        candidateXs.push(x);
      }

      const pocketObstacles = countObstacles(
        target.x,
        target.y,
        pocket.x,
        pocket.y,
        target.id,
        CARROM_PIECE_RADIUS * 1.85
      );

      for (const rawX of candidateXs) {
        const sx = resolveCarromStrikerX(state.pieces, rawX, baselineY);
        const shotDx = ghostX - sx;
        const shotDy = ghostY - baselineY;
        const shotDist = Math.hypot(shotDx, shotDy);
        if (shotDist < 40) continue;

        const shotDirX = shotDx / shotDist;
        const shotDirY = shotDy / shotDist;

        // 撃つ方向とポケット方向の内積（1に近いほど真っ直ぐ）
        const alignment = shotDirX * dirX + shotDirY * dirY;
        if (alignment < 0.35) continue;

        const pathObstacles = countObstacles(
          sx,
          baselineY,
          ghostX,
          ghostY,
          target.id,
          CARROM_STRIKER_RADIUS + CARROM_PIECE_RADIUS - 3
        );

        const queenWeight = target.color === 'queen' && ownPieces.length <= 2 ? 18 : 0;
        const score =
          alignment * 100 -
          pathObstacles * 48 -
          pocketObstacles * 55 -
          distToPocket * 0.05 -
          shotDist * 0.03 +
          queenWeight;

        if (score > bestScore) {
          bestScore = score;
          const basePower = Math.min(
            CARROM_MAX_SHOT_SPEED * 0.92,
            Math.max(18, (shotDist + distToPocket * 0.85) * 0.033 / Math.max(0.5, alignment))
          );
          // わずかな人間味のある揺らぎ（±1.2度）
          const jitter = (Math.random() - 0.5) * 0.04;
          const cosJ = Math.cos(jitter);
          const sinJ = Math.sin(jitter);
          const finalDirX = shotDirX * cosJ - shotDirY * sinJ;
          const finalDirY = shotDirX * sinJ + shotDirY * cosJ;

          bestShot = {
            strikerX: sx,
            vx: finalDirX * basePower,
            vy: finalDirY * basePower,
          };
        }
      }
    }
  }

  if (bestShot) {
    return { type: 'shoot', payload: bestShot };
  }

  // フォールバック: 自色パックの1つに向かってブレイクショット
  const fallbackTarget = targets[0];
  const sx = resolveCarromStrikerX(state.pieces, 500, baselineY);
  const dx = fallbackTarget.x - sx;
  const dy = fallbackTarget.y - baselineY;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const power = 32;

  return {
    type: 'shoot',
    payload: {
      strikerX: sx,
      vx: (dx / dist) * power,
      vy: (dy / dist) * power,
    },
  };
}
