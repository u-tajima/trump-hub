import type { PlayerInfo, ReversiRules } from '../types/game';

export type ReversiCell = 0 | 1 | 2;

export interface ReversiPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  color: 1 | 2;
}

export interface ReversiInternalState {
  rules: ReversiRules;
  players: [ReversiPlayerState, ReversiPlayerState];
  board: ReversiCell[][];
  turnIndex: 0 | 1;
  lastMove: { row: number; col: number } | null;
  winnerId: string | 'draw' | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface ReversiClientState extends ReversiInternalState {
  myId: string;
  validMoves: { row: number; col: number }[];
  counts: { black: number; white: number };
}

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

export function initReversi(playersInfo: PlayerInfo[], rules: ReversiRules): ReversiInternalState {
  const n = rules.boardSize;
  const board: ReversiCell[][] = Array.from({ length: n }, () => Array<ReversiCell>(n).fill(0));
  const mid = n / 2;

  if (rules.parallelSetup) {
    board[mid - 1][mid - 1] = 1;
    board[mid - 1][mid] = 1;
    board[mid][mid - 1] = 2;
    board[mid][mid] = 2;
  } else {
    board[mid - 1][mid - 1] = 2;
    board[mid - 1][mid] = 1;
    board[mid][mid - 1] = 1;
    board[mid][mid] = 2;
  }

  const players: [ReversiPlayerState, ReversiPlayerState] = [
    { id: playersInfo[0].id, name: playersInfo[0].name, isBot: playersInfo[0].isBot, color: 1 },
    { id: playersInfo[1].id, name: playersInfo[1].name, isBot: playersInfo[1].isBot, color: 2 },
  ];

  return {
    rules,
    players,
    board,
    turnIndex: 0,
    lastMove: null,
    winnerId: null,
    phase: 'playing',
    lastLog: `${players[0].name} (黒) のターンからスタート！`,
  };
}

export function getFlippedStones(
  board: ReversiCell[][],
  row: number,
  col: number,
  color: 1 | 2
): { row: number; col: number }[] {
  if (board[row]?.[col] !== 0) return [];
  const opp: ReversiCell = color === 1 ? 2 : 1;
  const n = board.length;
  const flipped: { row: number; col: number }[] = [];

  for (const [dr, dc] of DIRS) {
    const line: { row: number; col: number }[] = [];
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < n && c >= 0 && c < n && board[r][c] === opp) {
      line.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    if (line.length > 0 && r >= 0 && r < n && c >= 0 && c < n && board[r][c] === color) {
      flipped.push(...line);
    }
  }
  return flipped;
}

export function getValidMoves(board: ReversiCell[][], color: 1 | 2): { row: number; col: number }[] {
  const moves: { row: number; col: number }[] = [];
  const n = board.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (getFlippedStones(board, r, c, color).length > 0) {
        moves.push({ row: r, col: c });
      }
    }
  }
  return moves;
}

function countStones(board: ReversiCell[][]): { black: number; white: number } {
  let black = 0;
  let white = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === 1) black++;
      else if (cell === 2) white++;
    }
  }
  return { black, white };
}

export function applyReversiAction(
  state: ReversiInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: ReversiInternalState; error?: string } {
  if (state.phase !== 'playing') return { state, error: 'ゲームは終了しています' };
  const current = state.players[state.turnIndex];
  if (current.id !== playerId) return { state, error: 'あなたのターンではありません' };

  if (action.type !== 'place') return { state, error: '不明なアクションです' };
  const { row, col } = (action.payload as { row: number; col: number }) ?? {};
  const flipped = getFlippedStones(state.board, row, col, current.color);
  if (flipped.length === 0) {
    return { state, error: 'そこには置けません' };
  }

  const board = state.board.map((r) => [...r]);
  board[row][col] = current.color;
  for (const f of flipped) {
    board[f.row][f.col] = current.color;
  }

  const nextIdx: 0 | 1 = state.turnIndex === 0 ? 1 : 0;
  const nextPlayer = state.players[nextIdx];
  const nextMoves = getValidMoves(board, nextPlayer.color);

  if (nextMoves.length > 0) {
    return {
      state: {
        ...state,
        board,
        turnIndex: nextIdx,
        lastMove: { row, col },
        lastLog: `${current.name} が ${flipped.length}枚 返しました！次は ${nextPlayer.name}`,
      },
    };
  }

  const myMoves = getValidMoves(board, current.color);
  if (myMoves.length > 0) {
    return {
      state: {
        ...state,
        board,
        turnIndex: state.turnIndex,
        lastMove: { row, col },
        lastLog: `${nextPlayer.name} は置ける場所がないためパス！引き続き ${current.name}`,
      },
    };
  }

  const { black, white } = countStones(board);
  let winnerId: string | 'draw' = 'draw';
  if (black > white) winnerId = state.players[0].id;
  else if (white > black) winnerId = state.players[1].id;

  const winText =
    winnerId === 'draw'
      ? `引き分け！（黒 ${black} - 白 ${white}）`
      : `🏆 ${winnerId === state.players[0].id ? state.players[0].name : state.players[1].name} の勝利！（黒 ${black} - 白 ${white}）`;

  return {
    state: {
      ...state,
      board,
      lastMove: { row, col },
      winnerId,
      phase: 'finished',
      lastLog: winText,
    },
  };
}

export function computeReversiBotAction(state: ReversiInternalState): { type: string; payload?: unknown } | null {
  const bot = state.players[state.turnIndex];
  const moves = getValidMoves(state.board, bot.color);
  if (moves.length === 0) return null;

  const n = state.board.length;
  const isCorner = (r: number, c: number) =>
    (r === 0 || r === n - 1) && (c === 0 || c === n - 1);

  moves.sort((a, b) => {
    const ac = isCorner(a.row, a.col) ? 1 : 0;
    const bc = isCorner(b.row, b.col) ? 1 : 0;
    if (ac !== bc) return bc - ac;
    return (
      getFlippedStones(state.board, b.row, b.col, bot.color).length -
      getFlippedStones(state.board, a.row, a.col, bot.color).length
    );
  });

  return { type: 'place', payload: moves[0] };
}

export function sanitizeReversiState(state: ReversiInternalState, playerId: string): ReversiClientState {
  const current = state.players[state.turnIndex];
  return {
    ...state,
    myId: playerId,
    validMoves: state.phase === 'playing' ? getValidMoves(state.board, current.color) : [],
    counts: countStones(state.board),
  };
}
