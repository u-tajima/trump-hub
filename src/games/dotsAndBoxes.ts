import type { DotsAndBoxesRules, PlayerInfo } from '../types/game';

export interface DotsAndBoxesPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  colorIndex: number;
  score: number;
}

export interface DotsLineMove {
  kind: 'h' | 'v';
  row: number;
  col: number;
}

export interface DotsAndBoxesInternalState {
  rules: DotsAndBoxesRules;
  players: DotsAndBoxesPlayerState[];
  /** (N + 1) x N: 水平線の所有者 playerIndex (未配置は null) */
  hLines: (number | null)[][];
  /** N x (N + 1): 垂直線の所有者 playerIndex (未配置は null) */
  vLines: (number | null)[][];
  /** N x N: ボックスの所有者 playerIndex (未獲得は null) */
  boxes: (number | null)[][];
  turnIndex: number;
  lastMove: DotsLineMove | null;
  lastClaimedBoxes: { row: number; col: number }[];
  winnerId: string | 'draw' | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface DotsAndBoxesClientState extends DotsAndBoxesInternalState {
  myId: string;
}

export function initDotsAndBoxes(
  playersInfo: PlayerInfo[],
  rules: DotsAndBoxesRules
): DotsAndBoxesInternalState {
  const n = rules.gridSize;
  const hLines: (number | null)[][] = Array.from({ length: n + 1 }, () =>
    Array<number | null>(n).fill(null)
  );
  const vLines: (number | null)[][] = Array.from({ length: n }, () =>
    Array<number | null>(n + 1).fill(null)
  );
  const boxes: (number | null)[][] = Array.from({ length: n }, () =>
    Array<number | null>(n).fill(null)
  );

  const players: DotsAndBoxesPlayerState[] = playersInfo.map((p, idx) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    colorIndex: idx,
    score: 0,
  }));

  return {
    rules,
    players,
    hLines,
    vLines,
    boxes,
    turnIndex: 0,
    lastMove: null,
    lastClaimedBoxes: [],
    winnerId: null,
    phase: 'playing',
    lastLog: `${players[0].name} の番からスタート`,
  };
}

function countBoxSides(
  hLines: (number | null)[][],
  vLines: (number | null)[][],
  r: number,
  c: number
): number {
  let count = 0;
  if (hLines[r][c] !== null) count++;
  if (hLines[r + 1][c] !== null) count++;
  if (vLines[r][c] !== null) count++;
  if (vLines[r][c + 1] !== null) count++;
  return count;
}

function getAdjacentBoxes(
  n: number,
  move: DotsLineMove
): { row: number; col: number }[] {
  const adj: { row: number; col: number }[] = [];
  if (move.kind === 'h') {
    if (move.row > 0) adj.push({ row: move.row - 1, col: move.col });
    if (move.row < n) adj.push({ row: move.row, col: move.col });
  } else {
    if (move.col > 0) adj.push({ row: move.row, col: move.col - 1 });
    if (move.col < n) adj.push({ row: move.row, col: move.col });
  }
  return adj;
}

export function applyDotsAndBoxesAction(
  state: DotsAndBoxesInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: DotsAndBoxesInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }
  const current = state.players[state.turnIndex];
  if (current.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }
  if (action.type !== 'drawLine') {
    return { state, error: '不明なアクションです' };
  }

  const { kind, row, col } = (action.payload as Partial<DotsLineMove>) ?? {};
  const n = state.rules.gridSize;
  if (
    (kind !== 'h' && kind !== 'v') ||
    typeof row !== 'number' ||
    typeof col !== 'number' ||
    !Number.isInteger(row) ||
    !Number.isInteger(col)
  ) {
    return { state, error: '不正な座標です' };
  }

  if (kind === 'h') {
    if (row < 0 || row > n || col < 0 || col >= n) {
      return { state, error: '範囲外の線です' };
    }
    if (state.hLines[row][col] !== null) {
      return { state, error: 'すでに引かれている線です' };
    }
  } else {
    if (row < 0 || row >= n || col < 0 || col > n) {
      return { state, error: '範囲外の線です' };
    }
    if (state.vLines[row][col] !== null) {
      return { state, error: 'すでに引かれている線です' };
    }
  }

  const hLines = state.hLines.map((r) => [...r]);
  const vLines = state.vLines.map((r) => [...r]);
  const boxes = state.boxes.map((r) => [...r]);

  if (kind === 'h') {
    hLines[row][col] = state.turnIndex;
  } else {
    vLines[row][col] = state.turnIndex;
  }

  const move: DotsLineMove = { kind, row, col };
  const adj = getAdjacentBoxes(n, move);
  const claimed: { row: number; col: number }[] = [];

  for (const b of adj) {
    if (boxes[b.row][b.col] === null && countBoxSides(hLines, vLines, b.row, b.col) === 4) {
      boxes[b.row][b.col] = state.turnIndex;
      claimed.push(b);
    }
  }

  const players = state.players.map((p, idx) =>
    idx === state.turnIndex ? { ...p, score: p.score + claimed.length } : p
  );

  const totalClaimed = players.reduce((acc, p) => acc + p.score, 0);
  const totalBoxes = n * n;

  if (totalClaimed >= totalBoxes) {
    const maxScore = Math.max(...players.map((p) => p.score));
    const leaders = players.filter((p) => p.score === maxScore);
    const winnerId: string | 'draw' = leaders.length === 1 ? leaders[0].id : 'draw';
    const log =
      winnerId === 'draw'
        ? `引き分け（最高 ${maxScore} ボックス）`
        : `${leaders[0].name} の勝利（${maxScore} ボックス獲得）`;

    return {
      state: {
        ...state,
        players,
        hLines,
        vLines,
        boxes,
        lastMove: move,
        lastClaimedBoxes: claimed,
        winnerId,
        phase: 'finished',
        lastLog: log,
      },
    };
  }

  const nextTurnIndex =
    claimed.length > 0 ? state.turnIndex : (state.turnIndex + 1) % players.length;
  const nextPlayer = players[nextTurnIndex];
  const log =
    claimed.length > 0
      ? `${current.name} が ${claimed.length}ボックス獲得！連続ターン`
      : `${current.name} が線を引きました。次は ${nextPlayer.name}`;

  return {
    state: {
      ...state,
      players,
      hLines,
      vLines,
      boxes,
      turnIndex: nextTurnIndex,
      lastMove: move,
      lastClaimedBoxes: claimed,
      lastLog: log,
    },
  };
}

function getAllAvailableLines(state: DotsAndBoxesInternalState): DotsLineMove[] {
  const n = state.rules.gridSize;
  const moves: DotsLineMove[] = [];
  for (let r = 0; r <= n; r++) {
    for (let c = 0; c < n; c++) {
      if (state.hLines[r][c] === null) moves.push({ kind: 'h', row: r, col: c });
    }
  }
  for (let r = 0; r < n; r++) {
    for (let c = 0; c <= n; c++) {
      if (state.vLines[r][c] === null) moves.push({ kind: 'v', row: r, col: c });
    }
  }
  return moves;
}

/** ある手を打った後に相手が連鎖的に取れるボックス数を概算 */
function estimateGiveawayChain(
  state: DotsAndBoxesInternalState,
  move: DotsLineMove
): number {
  const n = state.rules.gridSize;
  const hLines = state.hLines.map((r) => [...r]);
  const vLines = state.vLines.map((r) => [...r]);
  if (move.kind === 'h') hLines[move.row][move.col] = 0;
  else vLines[move.row][move.col] = 0;

  let taken = 0;
  let progress = true;
  while (progress) {
    progress = false;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (countBoxSides(hLines, vLines, r, c) === 3) {
          if (hLines[r][c] === null) hLines[r][c] = 1;
          else if (hLines[r + 1][c] === null) hLines[r + 1][c] = 1;
          else if (vLines[r][c] === null) vLines[r][c] = 1;
          else if (vLines[r][c + 1] === null) vLines[r][c + 1] = 1;
          taken++;
          progress = true;
        }
      }
    }
  }
  return taken;
}

export function computeDotsAndBoxesBotAction(
  state: DotsAndBoxesInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  const moves = getAllAvailableLines(state);
  if (moves.length === 0) return null;

  const n = state.rules.gridSize;

  // 1. 3辺埋まっているボックスを完成させられる手を最優先（2箱同時獲得ならさらに優先）
  let bestCapture: DotsLineMove | null = null;
  let bestCaptureCount = 0;
  for (const m of moves) {
    const adj = getAdjacentBoxes(n, m);
    let completes = 0;
    for (const b of adj) {
      if (countBoxSides(state.hLines, state.vLines, b.row, b.col) === 3) {
        completes++;
      }
    }
    if (completes > bestCaptureCount) {
      bestCaptureCount = completes;
      bestCapture = m;
    }
  }
  if (bestCapture) {
    return { type: 'drawLine', payload: bestCapture };
  }

  // 2. 相手に3辺目を与えない安全な線を選ぶ
  const safeMoves = moves.filter((m) => {
    const adj = getAdjacentBoxes(n, m);
    return adj.every((b) => countBoxSides(state.hLines, state.vLines, b.row, b.col) < 2);
  });

  if (safeMoves.length > 0) {
    const pick = safeMoves[Math.floor(Math.random() * safeMoves.length)];
    return { type: 'drawLine', payload: pick };
  }

  // 3. すべて危険な手なら、相手に与える連鎖ボックス数が最小の手を選ぶ
  let bestSacrifice = moves[0];
  let minGiveaway = Infinity;
  for (const m of moves) {
    const giveaway = estimateGiveawayChain(state, m);
    if (giveaway < minGiveaway) {
      minGiveaway = giveaway;
      bestSacrifice = m;
    }
  }

  return { type: 'drawLine', payload: bestSacrifice };
}

export function sanitizeDotsAndBoxesState(
  state: DotsAndBoxesInternalState,
  playerId: string
): DotsAndBoxesClientState {
  return {
    ...state,
    myId: playerId,
  };
}
