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
  board: Connect4Cell[][]; // [row][col], row 0 is top
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

function scoreConnect4Window(
  c0: Connect4Cell,
  c1: Connect4Cell,
  c2: Connect4Cell,
  c3: Connect4Cell,
  botDisc: 1 | 2,
  oppDisc: 1 | 2
): number {
  let myCount = 0;
  let oppCount = 0;
  let emptyCount = 0;

  if (c0 === botDisc) myCount++;
  else if (c0 === oppDisc) oppCount++;
  else emptyCount++;

  if (c1 === botDisc) myCount++;
  else if (c1 === oppDisc) oppCount++;
  else emptyCount++;

  if (c2 === botDisc) myCount++;
  else if (c2 === oppDisc) oppCount++;
  else emptyCount++;

  if (c3 === botDisc) myCount++;
  else if (c3 === oppDisc) oppCount++;
  else emptyCount++;

  if (myCount > 0 && oppCount > 0) return 0;
  if (myCount === 4) return 100000;
  if (oppCount === 4) return -100000;
  if (myCount === 3 && emptyCount === 1) return 55;
  if (myCount === 2 && emptyCount === 2) return 9;
  if (oppCount === 3 && emptyCount === 1) return -68;
  if (oppCount === 2 && emptyCount === 2) return -10;
  return 0;
}

function evaluateConnect4Board(board: Connect4Cell[][], botDisc: 1 | 2): number {
  const oppDisc: 1 | 2 = botDisc === 1 ? 2 : 1;
  const rows = board.length;
  const cols = board[0].length;
  const midCol = Math.floor(cols / 2);
  let score = 0;

  // 中央寄りの列ボーナス
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];
      if (cell === 0) continue;
      const centerBonus = Math.max(0, 4 - Math.abs(c - midCol)) * 3;
      if (cell === botDisc) score += centerBonus;
      else score -= centerBonus;
    }
  }

  // 横方向の4連ウィンドウ
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - 4; c++) {
      score += scoreConnect4Window(
        board[r][c],
        board[r][c + 1],
        board[r][c + 2],
        board[r][c + 3],
        botDisc,
        oppDisc
      );
    }
  }

  // 縦方向の4連ウィンドウ
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r <= rows - 4; r++) {
      score += scoreConnect4Window(
        board[r][c],
        board[r + 1][c],
        board[r + 2][c],
        board[r + 3][c],
        botDisc,
        oppDisc
      );
    }
  }

  // 右下がり斜め
  for (let r = 0; r <= rows - 4; r++) {
    for (let c = 0; c <= cols - 4; c++) {
      score += scoreConnect4Window(
        board[r][c],
        board[r + 1][c + 1],
        board[r + 2][c + 2],
        board[r + 3][c + 3],
        botDisc,
        oppDisc
      );
    }
  }

  // 右上がり斜め
  for (let r = 3; r < rows; r++) {
    for (let c = 0; c <= cols - 4; c++) {
      score += scoreConnect4Window(
        board[r][c],
        board[r - 1][c + 1],
        board[r - 2][c + 2],
        board[r - 3][c + 3],
        botDisc,
        oppDisc
      );
    }
  }

  return score;
}

function connect4Minimax(
  board: Connect4Cell[][],
  depth: number,
  alpha: number,
  beta: number,
  currentDisc: 1 | 2,
  botDisc: 1 | 2,
  orderedCols: number[]
): number {
  const oppDisc: 1 | 2 = currentDisc === 1 ? 2 : 1;

  // 有効な列の収集と即勝ちチェック
  const validCols: number[] = [];
  for (const c of orderedCols) {
    const r = findDropRow(board, c);
    if (r >= 0) {
      validCols.push(c);
      board[r][c] = currentDisc;
      const isWin = checkConnect4Win(board, r, c, currentDisc) !== null;
      board[r][c] = 0;
      if (isWin) {
        return currentDisc === botDisc ? 100000 + depth * 1000 : -(100000 + depth * 1000);
      }
    }
  }

  if (validCols.length === 0) return 0;
  if (depth <= 0) return evaluateConnect4Board(board, botDisc);

  const isMaximizing = currentDisc === botDisc;
  if (isMaximizing) {
    let best = -Infinity;
    for (const c of validCols) {
      const r = findDropRow(board, c);
      board[r][c] = currentDisc;
      const val = connect4Minimax(board, depth - 1, alpha, beta, oppDisc, botDisc, orderedCols);
      board[r][c] = 0;
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const c of validCols) {
      const r = findDropRow(board, c);
      board[r][c] = currentDisc;
      const val = connect4Minimax(board, depth - 1, alpha, beta, oppDisc, botDisc, orderedCols);
      board[r][c] = 0;
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function computeConnect4BotAction(state: Connect4InternalState): { type: string; payload?: unknown } | null {
  const bot = state.players[state.turnIndex];
  const oppDisc: 1 | 2 = bot.disc === 1 ? 2 : 1;
  const cols = state.rules.cols;
  const mid = Math.floor(cols / 2);

  // 中央から順に探索することでAlpha-Beta枝刈りを高速化
  const orderedCols = Array.from({ length: cols }, (_, i) => i).sort(
    (a, b) => Math.abs(a - mid) - Math.abs(b - mid)
  );
  const validCols = orderedCols.filter((c) => findDropRow(state.board, c) >= 0);
  if (validCols.length === 0) return null;
  if (validCols.length === 1) return { type: 'drop', payload: { col: validCols[0] } };

  const sim = state.board.map((row) => [...row]);

  // 1. 自分が即勝てる手があれば即決
  for (const c of validCols) {
    const r = findDropRow(sim, c);
    sim[r][c] = bot.disc;
    const win = checkConnect4Win(sim, r, c, bot.disc);
    sim[r][c] = 0;
    if (win) return { type: 'drop', payload: { col: c } };
  }

  // 2. 相手が次ターンに即勝つ列があれば必ずブロック
  for (const c of validCols) {
    const r = findDropRow(sim, c);
    sim[r][c] = oppDisc;
    const oppWin = checkConnect4Win(sim, r, c, oppDisc);
    sim[r][c] = 0;
    if (oppWin) return { type: 'drop', payload: { col: c } };
  }

  // 3. 7手先までのAlpha-Beta探索（フォーク作成・相手の二重脅威阻止・自殺手回避）
  const searchDepth = 7;
  let bestCol = validCols[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;

  for (const c of validCols) {
    const r = findDropRow(sim, c);
    sim[r][c] = bot.disc;
    const score = connect4Minimax(sim, searchDepth - 1, alpha, Infinity, oppDisc, bot.disc, orderedCols);
    sim[r][c] = 0;
    if (score > bestScore) {
      bestScore = score;
      bestCol = c;
    }
    if (score > alpha) alpha = score;
  }

  return { type: 'drop', payload: { col: bestCol } };
}

export function sanitizeConnect4State(state: Connect4InternalState, playerId: string): Connect4ClientState {
  return { ...state, myId: playerId };
}
