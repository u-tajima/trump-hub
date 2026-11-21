import type { GomokuRules, PlayerInfo } from '../types/game';

export type GomokuCell = 0 | 1 | 2;

export interface GomokuPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  stone: 1 | 2;
}

export interface GomokuInternalState {
  rules: GomokuRules;
  players: [GomokuPlayerState, GomokuPlayerState];
  board: GomokuCell[][];
  turnIndex: 0 | 1;
  lastMove: { row: number; col: number } | null;
  winningLine: { row: number; col: number }[];
  winnerId: string | 'draw' | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface GomokuClientState extends GomokuInternalState {
  myId: string;
}

const AXES = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function initGomoku(playersInfo: PlayerInfo[], rules: GomokuRules): GomokuInternalState {
  const n = rules.boardSize;
  const board: GomokuCell[][] = Array.from({ length: n }, () => Array<GomokuCell>(n).fill(0));
  const players: [GomokuPlayerState, GomokuPlayerState] = [
    { id: playersInfo[0].id, name: playersInfo[0].name, isBot: playersInfo[0].isBot, stone: 1 },
    { id: playersInfo[1].id, name: playersInfo[1].name, isBot: playersInfo[1].isBot, stone: 2 },
  ];

  return {
    rules,
    players,
    board,
    turnIndex: 0,
    lastMove: null,
    winningLine: [],
    winnerId: null,
    phase: 'playing',
    lastLog: `${players[0].name} (●黒) からスタート！`,
  };
}

function checkWin(
  board: GomokuCell[][],
  row: number,
  col: number,
  stone: 1 | 2,
  allowOverline: boolean
): { row: number; col: number }[] | null {
  const n = board.length;
  for (const [dr, dc] of AXES) {
    const line: { row: number; col: number }[] = [{ row, col }];
    for (const dir of [-1, 1]) {
      let r = row + dr * dir;
      let c = col + dc * dir;
      while (r >= 0 && r < n && c >= 0 && c < n && board[r][c] === stone) {
        line.push({ row: r, col: c });
        r += dr * dir;
        c += dc * dir;
      }
    }
    if (allowOverline ? line.length >= 5 : line.length === 5) {
      return line;
    }
  }
  return null;
}

export function applyGomokuAction(
  state: GomokuInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: GomokuInternalState; error?: string } {
  if (state.phase !== 'playing') return { state, error: 'ゲームは終了しています' };
  const current = state.players[state.turnIndex];
  if (current.id !== playerId) return { state, error: 'あなたのターンではありません' };

  if (action.type !== 'place') return { state, error: '不明なアクションです' };
  const { row, col } = (action.payload as { row: number; col: number }) ?? {};
  if (state.board[row]?.[col] !== 0) {
    return { state, error: 'そこには置けません' };
  }

  const board = state.board.map((r) => [...r]);
  board[row][col] = current.stone;

  const winLine = checkWin(board, row, col, current.stone, state.rules.allowOverline);
  if (winLine) {
    return {
      state: {
        ...state,
        board,
        lastMove: { row, col },
        winningLine: winLine,
        winnerId: current.id,
        phase: 'finished',
        lastLog: `🏆 ${current.name} が5目並べて勝利！`,
      },
    };
  }

  const isFull = board.every((r) => r.every((c) => c !== 0));
  if (isFull) {
    return {
      state: {
        ...state,
        board,
        lastMove: { row, col },
        winnerId: 'draw',
        phase: 'finished',
        lastLog: '引き分けです！',
      },
    };
  }

  const nextIdx: 0 | 1 = state.turnIndex === 0 ? 1 : 0;
  return {
    state: {
      ...state,
      board,
      turnIndex: nextIdx,
      lastMove: { row, col },
      lastLog: `次は ${state.players[nextIdx].name} のターン`,
    },
  };
}

function scoreLine(board: GomokuCell[][], row: number, col: number, stone: 1 | 2): number {
  const n = board.length;
  let best = 0;
  for (const [dr, dc] of AXES) {
    let count = 1;
    let openEnds = 0;
    for (const dir of [-1, 1]) {
      let r = row + dr * dir;
      let c = col + dc * dir;
      while (r >= 0 && r < n && c >= 0 && c < n && board[r][c] === stone) {
        count++;
        r += dr * dir;
        c += dc * dir;
      }
      if (r >= 0 && r < n && c >= 0 && c < n && board[r][c] === 0) {
        openEnds++;
      }
    }
    const score = count >= 5 ? 100000 : count === 4 ? (openEnds > 0 ? 10000 : 1000) : count * 20 + openEnds * 5;
    if (score > best) best = score;
  }
  return best;
}

export function computeGomokuBotAction(state: GomokuInternalState): { type: string; payload?: unknown } | null {
  const bot = state.players[state.turnIndex];
  const oppStone: 1 | 2 = bot.stone === 1 ? 2 : 1;
  const n = state.board.length;
  const center = Math.floor(n / 2);

  let bestMove: { row: number; col: number } | null = null;
  let bestScore = -1;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (state.board[r][c] !== 0) continue;
      const atk = scoreLine(state.board, r, c, bot.stone);
      const def = scoreLine(state.board, r, c, oppStone) * 0.9;
      const distPenalty = Math.abs(r - center) + Math.abs(c - center);
      const total = Math.max(atk, def) - distPenalty * 0.1 + Math.random() * 0.5;
      if (total > bestScore) {
        bestScore = total;
        bestMove = { row: r, col: c };
      }
    }
  }

  return bestMove ? { type: 'place', payload: bestMove } : null;
}

export function sanitizeGomokuState(state: GomokuInternalState, playerId: string): GomokuClientState {
  return { ...state, myId: playerId };
}
