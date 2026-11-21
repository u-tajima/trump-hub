import type { Connect4Rules, PlayerInfo } from '../types/game';

export type Connect4Cell = 0 | 1 | 2;

export interface Connect4PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  disc: 1 | 2;
}

export interface Connect4InternalState {
  rules: Connect4Rules;
  players: [Connect4PlayerState, Connect4PlayerState];
  board: Connect4Cell[][];
  turnIndex: 0 | 1;
  lastMove: { row: number; col: number } | null;
  winningLine: { row: number; col: number }[];
  winnerId: string | 'draw' | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface Connect4ClientState extends Connect4InternalState {
  myId: string;
}

const AXES = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function initConnect4(playersInfo: PlayerInfo[], rules: Connect4Rules): Connect4InternalState {
  const board: Connect4Cell[][] = Array.from({ length: rules.rows }, () =>
    Array<Connect4Cell>(rules.cols).fill(0)
  );
  const players: [Connect4PlayerState, Connect4PlayerState] = [
    { id: playersInfo[0].id, name: playersInfo[0].name, isBot: playersInfo[0].isBot, disc: 1 },
    { id: playersInfo[1].id, name: playersInfo[1].name, isBot: playersInfo[1].isBot, disc: 2 },
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
    lastLog: `${players[0].name} (🔴赤) からスタート！列を選んで落とそう`,
  };
}

function findDropRow(board: Connect4Cell[][], col: number): number {
  for (let r = board.length - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return -1;
}

function checkConnect4Win(
  board: Connect4Cell[][],
  row: number,
  col: number,
  disc: 1 | 2
): { row: number; col: number }[] | null {
  const rows = board.length;
  const cols = board[0].length;
  for (const [dr, dc] of AXES) {
    const line: { row: number; col: number }[] = [{ row, col }];
    for (const dir of [-1, 1]) {
      let r = row + dr * dir;
      let c = col + dc * dir;
      while (r >= 0 && r < rows && c >= 0 && c < cols && board[r][c] === disc) {
        line.push({ row: r, col: c });
        r += dr * dir;
        c += dc * dir;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

export function applyConnect4Action(
  state: Connect4InternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: Connect4InternalState; error?: string } {
  if (state.phase !== 'playing') return { state, error: 'ゲームは終了しています' };
  const current = state.players[state.turnIndex];
  if (current.id !== playerId) return { state, error: 'あなたのターンではありません' };

  if (action.type !== 'drop') return { state, error: '不明なアクションです' };
  const col = (action.payload as { col?: number })?.col ?? -1;
  if (col < 0 || col >= state.rules.cols) return { state, error: '無効な列です' };

  const row = findDropRow(state.board, col);
  if (row < 0) return { state, error: 'その列はいっぱいです' };

  const board = state.board.map((r) => [...r]);
  board[row][col] = current.disc;

  const winLine = checkConnect4Win(board, row, col, current.disc);
  if (winLine) {
    return {
      state: {
        ...state,
        board,
        lastMove: { row, col },
        winningLine: winLine,
        winnerId: current.id,
        phase: 'finished',
        lastLog: `🏆 ${current.name} が4つ並べて勝利！`,
      },
    };
  }

  const isFull = board[0].every((c) => c !== 0);
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

export function computeConnect4BotAction(state: Connect4InternalState): { type: string; payload?: unknown } | null {
  const bot = state.players[state.turnIndex];
  const oppDisc: 1 | 2 = bot.disc === 1 ? 2 : 1;
  const validCols: number[] = [];
  for (let c = 0; c < state.rules.cols; c++) {
    if (findDropRow(state.board, c) >= 0) validCols.push(c);
  }
  if (validCols.length === 0) return null;

  for (const c of validCols) {
    const r = findDropRow(state.board, c);
    const sim = state.board.map((row) => [...row]);
    sim[r][c] = bot.disc;
    if (checkConnect4Win(sim, r, c, bot.disc)) return { type: 'drop', payload: { col: c } };
  }
  for (const c of validCols) {
    const r = findDropRow(state.board, c);
    const sim = state.board.map((row) => [...row]);
    sim[r][c] = oppDisc;
    if (checkConnect4Win(sim, r, c, oppDisc)) return { type: 'drop', payload: { col: c } };
  }
  const mid = Math.floor(state.rules.cols / 2);
  validCols.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
  return { type: 'drop', payload: { col: validCols[0] } };
}

export function sanitizeConnect4State(state: Connect4InternalState, playerId: string): Connect4ClientState {
  return { ...state, myId: playerId };
}
