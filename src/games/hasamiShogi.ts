import type { HasamiShogiRules, PlayerInfo } from '../types/game';

export type HasamiShogiCell = 0 | 1 | 2; // 0: empty, 1: P0 (先手・歩), 2: P1 (後手・と)

export interface HasamiShogiCoord {
  row: number;
  col: number;
}

export interface HasamiShogiPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  side: 1 | 2;
  captured: number; // 獲得した相手駒の数
}

export interface HasamiShogiMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export interface HasamiShogiInternalState {
  rules: HasamiShogiRules;
  players: [HasamiShogiPlayerState, HasamiShogiPlayerState];
  board: HasamiShogiCell[][]; // 9x9
  turnIndex: 0 | 1;
  moveCount: number;
  lastMove: {
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
    capturedCells: HasamiShogiCoord[];
  } | null;
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface HasamiShogiClientState extends HasamiShogiInternalState {
  myId: string;
}

export const HASAMI_BOARD_SIZE = 9;

const ORTHO_DIRS: readonly [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const CORNER_CHECKS: readonly {
  corner: [number, number];
  adj1: [number, number];
  adj2: [number, number];
}[] = [
  { corner: [0, 0], adj1: [0, 1], adj2: [1, 0] },
  { corner: [0, 8], adj1: [0, 7], adj2: [1, 8] },
  { corner: [8, 0], adj1: [7, 0], adj2: [8, 1] },
  { corner: [8, 8], adj1: [7, 8], adj2: [8, 7] },
];

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < HASAMI_BOARD_SIZE && c >= 0 && c < HASAMI_BOARD_SIZE;
}

function createInitialBoard(): HasamiShogiCell[][] {
  const board: HasamiShogiCell[][] = Array.from({ length: HASAMI_BOARD_SIZE }, () =>
    Array<HasamiShogiCell>(HASAMI_BOARD_SIZE).fill(0)
  );
  // P1（後手・と）: row = 0 全9マス
  for (let c = 0; c < HASAMI_BOARD_SIZE; c++) {
    board[0][c] = 2;
  }
  // P0（先手・歩）: row = 8 全9マス
  for (let c = 0; c < HASAMI_BOARD_SIZE; c++) {
    board[8][c] = 1;
  }
  return board;
}

export function initHasamiShogi(
  playersInfo: PlayerInfo[],
  rules: HasamiShogiRules
): HasamiShogiInternalState {
  const p0 = playersInfo[0] ?? {
    id: 'p0',
    name: 'プレイヤー1',
    isHost: true,
    isBot: false,
    connected: true,
  };
  const p1 = playersInfo[1] ?? {
    id: 'bot-1',
    name: 'CPU',
    isHost: false,
    isBot: true,
    connected: true,
  };

  const players: [HasamiShogiPlayerState, HasamiShogiPlayerState] = [
    { id: p0.id, name: p0.name, isBot: p0.isBot, side: 1, captured: 0 },
    { id: p1.id, name: p1.name, isBot: p1.isBot, side: 2, captured: 0 },
  ];

  return {
    rules,
    players,
    board: createInitialBoard(),
    turnIndex: 0,
    moveCount: 0,
    lastMove: null,
    winnerId: null,
    phase: 'playing',
    lastLog: `${players[0].name}（先手・歩）のターン。相手の駒を挟んで取ろう`,
  };
}

/**
 * 指定の駒 (fromRow, fromCol) から移動できるマス一覧を返す。
 */
export function getHasamiLegalDestinations(
  board: HasamiShogiCell[][],
  fromRow: number,
  fromCol: number
): HasamiShogiCoord[] {
  if (!inBounds(fromRow, fromCol) || board[fromRow][fromCol] === 0) return [];
  const dests: HasamiShogiCoord[] = [];
  for (const [dr, dc] of ORTHO_DIRS) {
    let r = fromRow + dr;
    let c = fromCol + dc;
    while (inBounds(r, c) && board[r][c] === 0) {
      dests.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
  }
  return dests;
}

/**
 * 移動後の盤面（移動済み・捕獲前）に対して、移動先 (toRow, toCol) によって発生する捕獲座標を返す。
 * 自殺的な飛び込みでは自駒は取られない。
 */
export function findHasamiCaptures(
  boardAfterMove: HasamiShogiCell[][],
  toRow: number,
  toCol: number,
  mySide: 1 | 2
): HasamiShogiCoord[] {
  const oppSide: 1 | 2 = mySide === 1 ? 2 : 1;
  const capturedMap = new Map<string, HasamiShogiCoord>();

  // 1. 上下左右4方向の直線挟み取り
  for (const [dr, dc] of ORTHO_DIRS) {
    const line: HasamiShogiCoord[] = [];
    let r = toRow + dr;
    let c = toCol + dc;
    while (inBounds(r, c) && boardAfterMove[r][c] === oppSide) {
      line.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    if (line.length > 0 && inBounds(r, c) && boardAfterMove[r][c] === mySide) {
      for (const pos of line) {
        capturedMap.set(`${pos.row},${pos.col}`, pos);
      }
    }
  }

  // 2. 角挟み（隅取り）: 四隅に相手駒があり、隣接する2マスが自駒で塞がれている場合
  for (const { corner, adj1, adj2 } of CORNER_CHECKS) {
    const [cr, cc] = corner;
    const [a1r, a1c] = adj1;
    const [a2r, a2c] = adj2;
    if (
      boardAfterMove[cr][cc] === oppSide &&
      boardAfterMove[a1r][a1c] === mySide &&
      boardAfterMove[a2r][a2c] === mySide
    ) {
      capturedMap.set(`${cr},${cc}`, { row: cr, col: cc });
    }
  }

  return Array.from(capturedMap.values());
}

/**
 * 移動が合法か検証し、合法なら移動・捕獲後の盤面と捕獲座標を返す。
 */
export function simulateHasamiMove(
  board: HasamiShogiCell[][],
  move: HasamiShogiMove,
  side: 1 | 2
): { valid: boolean; nextBoard?: HasamiShogiCell[][]; captures: HasamiShogiCoord[] } {
  const { fromRow, fromCol, toRow, toCol } = move;
  if (
    !Number.isInteger(fromRow) ||
    !Number.isInteger(fromCol) ||
    !Number.isInteger(toRow) ||
    !Number.isInteger(toCol) ||
    !inBounds(fromRow, fromCol) ||
    !inBounds(toRow, toCol)
  ) {
    return { valid: false, captures: [] };
  }

  if (board[fromRow][fromCol] !== side || board[toRow][toCol] !== 0) {
    return { valid: false, captures: [] };
  }

  const sameRow = fromRow === toRow;
  const sameCol = fromCol === toCol;
  if ((!sameRow && !sameCol) || (sameRow && sameCol)) {
    return { valid: false, captures: [] };
  }

  const dr = Math.sign(toRow - fromRow);
  const dc = Math.sign(toCol - fromCol);
  let r = fromRow + dr;
  let c = fromCol + dc;
  while (r !== toRow || c !== toCol) {
    if (board[r][c] !== 0) {
      return { valid: false, captures: [] };
    }
    r += dr;
    c += dc;
  }

  const nextBoard = board.map((row) => [...row]);
  nextBoard[fromRow][fromCol] = 0;
  nextBoard[toRow][toCol] = side;

  const captures = findHasamiCaptures(nextBoard, toRow, toCol, side);
  for (const pos of captures) {
    nextBoard[pos.row][pos.col] = 0;
  }

  return { valid: true, nextBoard, captures };
}

function countPieces(board: HasamiShogiCell[][], side: 1 | 2): number {
  let count = 0;
  for (let r = 0; r < HASAMI_BOARD_SIZE; r++) {
    for (let c = 0; c < HASAMI_BOARD_SIZE; c++) {
      if (board[r][c] === side) count++;
    }
  }
  return count;
}

function hasAnyLegalMove(board: HasamiShogiCell[][], side: 1 | 2): boolean {
  for (let r = 0; r < HASAMI_BOARD_SIZE; r++) {
    for (let c = 0; c < HASAMI_BOARD_SIZE; c++) {
      if (board[r][c] !== side) continue;
      for (const [dr, dc] of ORTHO_DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc) && board[nr][nc] === 0) return true;
      }
    }
  }
  return false;
}

export function applyHasamiShogiAction(
  state: HasamiShogiInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: HasamiShogiInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }
  const current = state.players[state.turnIndex];
  if (current.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }
  if (action.type !== 'move') {
    return { state, error: '不明なアクションです' };
  }

  const payload = action.payload as
    | { fromRow?: unknown; fromCol?: unknown; toRow?: unknown; toCol?: unknown }
    | undefined;
  const fromRow = payload?.fromRow;
  const fromCol = payload?.fromCol;
  const toRow = payload?.toRow;
  const toCol = payload?.toCol;

  if (
    typeof fromRow !== 'number' ||
    typeof fromCol !== 'number' ||
    typeof toRow !== 'number' ||
    typeof toCol !== 'number' ||
    !Number.isInteger(fromRow) ||
    !Number.isInteger(fromCol) ||
    !Number.isInteger(toRow) ||
    !Number.isInteger(toCol)
  ) {
    return { state, error: '不正な座標です' };
  }

  const sim = simulateHasamiMove(
    state.board,
    { fromRow, fromCol, toRow, toCol },
    current.side
  );
  if (!sim.valid || !sim.nextBoard) {
    return { state, error: 'そのマスには移動できません' };
  }

  const nextPlayers: [HasamiShogiPlayerState, HasamiShogiPlayerState] = [
    { ...state.players[0] },
    { ...state.players[1] },
  ];
  nextPlayers[state.turnIndex].captured += sim.captures.length;

  const oppIndex: 0 | 1 = state.turnIndex === 0 ? 1 : 0;
  const oppPlayer = nextPlayers[oppIndex];
  const oppRemaining = countPieces(sim.nextBoard, oppPlayer.side);
  const myCaptured = nextPlayers[state.turnIndex].captured;
  const moveCount = state.moveCount + 1;
  const lastMove = {
    fromRow,
    fromCol,
    toRow,
    toCol,
    capturedCells: sim.captures,
  };

  // 勝利判定: 目標枚数到達 or 相手の残り駒1枚以下 or 相手に合法手なし
  if (
    myCaptured >= state.rules.captureTarget ||
    oppRemaining <= 1 ||
    !hasAnyLegalMove(sim.nextBoard, oppPlayer.side)
  ) {
    const reason =
      myCaptured >= state.rules.captureTarget
        ? `${myCaptured}枚獲得して`
        : oppRemaining <= 1
        ? '相手の駒を1枚以下にして'
        : '相手の動きを封じて';
    return {
      state: {
        ...state,
        players: nextPlayers,
        board: sim.nextBoard,
        moveCount,
        lastMove,
        winnerId: current.id,
        phase: 'finished',
        lastLog: `${current.name} が${reason}勝利！`,
      },
    };
  }

  const nextLabel = oppPlayer.side === 1 ? '歩' : 'と';
  const logMsg =
    sim.captures.length > 0
      ? `${current.name} が相手の駒を${sim.captures.length}枚挟んで獲得！（計${myCaptured}/${state.rules.captureTarget}）次は ${oppPlayer.name}（${nextLabel}）`
      : `${current.name} が駒を動かしました。次は ${oppPlayer.name}（${nextLabel}）`;

  return {
    state: {
      ...state,
      players: nextPlayers,
      board: sim.nextBoard,
      turnIndex: oppIndex,
      moveCount,
      lastMove,
      lastLog: logMsg,
    },
  };
}

/**
 * 盤面上で oppSide が次ターンに 1 手で最大何枚捕獲できるか（簡易脅威チェック）
 */
function maxOpponentImmediateCapture(
  board: HasamiShogiCell[][],
  oppSide: 1 | 2
): number {
  let maxCap = 0;
  for (let r = 0; r < HASAMI_BOARD_SIZE; r++) {
    for (let c = 0; c < HASAMI_BOARD_SIZE; c++) {
      if (board[r][c] !== oppSide) continue;
      for (const [dr, dc] of ORTHO_DIRS) {
        let nr = r + dr;
        let nc = c + dc;
        while (inBounds(nr, nc) && board[nr][nc] === 0) {
          board[r][c] = 0;
          board[nr][nc] = oppSide;
          const caps = findHasamiCaptures(board, nr, nc, oppSide);
          board[nr][nc] = 0;
          board[r][c] = oppSide;
          if (caps.length > maxCap) {
            maxCap = caps.length;
            if (maxCap >= 2) return maxCap;
          }
          nr += dr;
          nc += dc;
        }
      }
    }
  }
  return maxCap;
}

export function computeHasamiShogiBotAction(
  state: HasamiShogiInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  const bot = state.players[state.turnIndex];
  const opp = state.players[state.turnIndex === 0 ? 1 : 0];

  const moves: HasamiShogiMove[] = [];
  for (let r = 0; r < HASAMI_BOARD_SIZE; r++) {
    for (let c = 0; c < HASAMI_BOARD_SIZE; c++) {
      if (state.board[r][c] !== bot.side) continue;
      const dests = getHasamiLegalDestinations(state.board, r, c);
      for (const d of dests) {
        moves.push({ fromRow: r, fromCol: c, toRow: d.row, toCol: d.col });
      }
    }
  }
  if (moves.length === 0) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const sim = simulateHasamiMove(state.board, move, bot.side);
    if (!sim.valid || !sim.nextBoard) continue;

    const capCount = sim.captures.length;
    const oppRemaining = countPieces(sim.nextBoard, opp.side);
    if (bot.captured + capCount >= state.rules.captureTarget || oppRemaining <= 1) {
      return { type: 'move', payload: move };
    }

    let score = 0;

    // 1. 捕獲ボーナス（複数取りを大きく優遇）
    score += capCount * 140 + (capCount >= 2 ? 60 : 0);

    // 2. 相手の即反撃捕獲リスクを強く減点
    const oppThreat = maxOpponentImmediateCapture(sim.nextBoard, opp.side);
    score -= oppThreat * 115;

    // 3. 中央展開ボーナス
    const centerDist = Math.abs(move.toRow - 4) + Math.abs(move.toCol - 4);
    score += Math.max(0, 8 - centerDist) * 3.2;

    // 4. 四隅への移動は角挟みリスクがあるため減点
    const isCorner =
      (move.toRow === 0 || move.toRow === 8) && (move.toCol === 0 || move.toCol === 8);
    if (isCorner) score -= 24;

    // 5. 相手駒への隣接圧力（挟みの準備）
    for (const [dr, dc] of ORTHO_DIRS) {
      const nr = move.toRow + dr;
      const nc = move.toCol + dc;
      if (inBounds(nr, nc) && sim.nextBoard[nr][nc] === opp.side) {
        score += 6;
      }
    }

    // 6. わずかなゆらぎ
    score += Math.random() * 2.5;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return { type: 'move', payload: bestMove };
}

export function sanitizeHasamiShogiState(
  state: HasamiShogiInternalState,
  playerId: string
): HasamiShogiClientState {
  return {
    ...state,
    myId: playerId,
  };
}
