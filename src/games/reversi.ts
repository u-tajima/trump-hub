import type { PlayerInfo, ReversiRules } from '../types/game';

export type ReversiCell = 0 | 1 | 2; // 0: empty, 1: black (player 0), 2: white (player 1)

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

  // 相手が置けない場合、自分がまだ置けるか確認
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

  // 両者置けない → ゲーム終了
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

function applyMoveToBoard(
  board: ReversiCell[][],
  row: number,
  col: number,
  color: 1 | 2,
  flipped: { row: number; col: number }[]
): ReversiCell[][] {
  const next = board.map((r) => [...r]);
  next[row][col] = color;
  for (const f of flipped) {
    next[f.row][f.col] = color;
  }
  return next;
}

function getPositionalWeight(board: ReversiCell[][], r: number, c: number, color: 1 | 2): number {
  const n = board.length;
  const last = n - 1;
  const isRCorner = r === 0 || r === last;
  const isCCorner = c === 0 || c === last;
  if (isRCorner && isCCorner) return 120;

  // 最も近い角の座標
  const cr = r <= 1 ? 0 : r >= last - 1 ? last : -1;
  const cc = c <= 1 ? 0 : c >= last - 1 ? last : -1;
  if (cr !== -1 && cc !== -1) {
    const cornerCell = board[cr][cc];
    const isXSquare = (r === 1 || r === last - 1) && (c === 1 || c === last - 1);
    const isCSquare = !isXSquare && (r <= 1 || r >= last - 1) && (c <= 1 || c >= last - 1);
    if (cornerCell === 0) {
      if (isXSquare) return -55;
      if (isCSquare) return -25;
    } else if (cornerCell === color) {
      if (isCSquare) return 22;
      if (isXSquare) return 10;
    } else {
      if (isXSquare) return -15;
    }
  }

  // 外周エッジ
  if (isRCorner || isCCorner) return 18;
  // 内側1つ目（エッジ隣接）
  if (r === 1 || r === last - 1 || c === 1 || c === last - 1) return -4;
  return 4;
}

function evaluateReversiBoard(board: ReversiCell[][], botColor: 1 | 2): number {
  const oppColor: 1 | 2 = botColor === 1 ? 2 : 1;
  const n = board.length;
  let emptyCount = 0;
  let myStones = 0;
  let oppStones = 0;
  let posScore = 0;
  let myFrontier = 0;
  let oppFrontier = 0;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = board[r][c];
      if (cell === 0) {
        emptyCount++;
        continue;
      }
      const w = getPositionalWeight(board, r, c, cell);
      let isFrontier = false;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && board[nr][nc] === 0) {
          isFrontier = true;
          break;
        }
      }
      if (cell === botColor) {
        myStones++;
        posScore += w;
        if (isFrontier) myFrontier++;
      } else {
        oppStones++;
        posScore -= w;
        if (isFrontier) oppFrontier++;
      }
    }
  }

  const myMoves = getValidMoves(board, botColor).length;
  const oppMoves = getValidMoves(board, oppColor).length;

  // 終盤（完了状態）は確定石差を最優先
  if (emptyCount === 0 || (myMoves === 0 && oppMoves === 0)) {
    if (myStones > oppStones) return 50000 + (myStones - oppStones) * 100;
    if (myStones < oppStones) return -50000 + (myStones - oppStones) * 100;
    return 0;
  }

  if (myStones === 0) return -90000;
  if (oppStones === 0) return 90000;

  const totalCells = n * n;
  const progress = (totalCells - emptyCount) / totalCells;

  // 序盤・中盤は着手可能数（モビリティ）と開放度（フロンティア少なさ）重視、終盤は石数重視
  const mobilityScore = (myMoves - oppMoves) * (progress < 0.75 ? 16 : 8);
  const frontierScore = (oppFrontier - myFrontier) * (progress < 0.7 ? 7 : 2);
  const discDiffScore = (myStones - oppStones) * (progress > 0.75 ? 14 : -2);

  return posScore + mobilityScore + frontierScore + discDiffScore;
}

function reversiMinimax(
  board: ReversiCell[][],
  depth: number,
  alpha: number,
  beta: number,
  currentColor: 1 | 2,
  botColor: 1 | 2,
  passedPrev: boolean
): number {
  if (depth <= 0) {
    return evaluateReversiBoard(board, botColor);
  }

  const oppColor: 1 | 2 = currentColor === 1 ? 2 : 1;
  const moves = getValidMoves(board, currentColor);

  if (moves.length === 0) {
    if (passedPrev) {
      return evaluateReversiBoard(board, botColor);
    }
    return reversiMinimax(board, depth - 1, alpha, beta, oppColor, botColor, true);
  }

  // Move ordering: 角や好位置を先に探索して枝刈り効率を高める
  moves.sort(
    (a, b) =>
      getPositionalWeight(board, b.row, b.col, currentColor) -
      getPositionalWeight(board, a.row, a.col, currentColor)
  );

  const isMaximizing = currentColor === botColor;
  if (isMaximizing) {
    let best = -Infinity;
    for (const m of moves) {
      const flipped = getFlippedStones(board, m.row, m.col, currentColor);
      const nextBoard = applyMoveToBoard(board, m.row, m.col, currentColor, flipped);
      const val = reversiMinimax(nextBoard, depth - 1, alpha, beta, oppColor, botColor, false);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const flipped = getFlippedStones(board, m.row, m.col, currentColor);
      const nextBoard = applyMoveToBoard(board, m.row, m.col, currentColor, flipped);
      const val = reversiMinimax(nextBoard, depth - 1, alpha, beta, oppColor, botColor, false);
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function computeReversiBotAction(state: ReversiInternalState): { type: string; payload?: unknown } | null {
  const bot = state.players[state.turnIndex];
  const moves = getValidMoves(state.board, bot.color);
  if (moves.length === 0) return null;
  if (moves.length === 1) return { type: 'place', payload: moves[0] };

  let emptyCount = 0;
  for (const row of state.board) {
    for (const cell of row) {
      if (cell === 0) emptyCount++;
    }
  }

  // 残り10手以下は完全読みに近い深さ、通常時は5手先までAlpha-Beta探索
  const searchDepth = emptyCount <= 10 ? emptyCount : 5;
  const oppColor: 1 | 2 = bot.color === 1 ? 2 : 1;

  moves.sort(
    (a, b) =>
      getPositionalWeight(state.board, b.row, b.col, bot.color) -
      getPositionalWeight(state.board, a.row, a.col, bot.color)
  );

  let bestMove = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;

  for (const m of moves) {
    const flipped = getFlippedStones(state.board, m.row, m.col, bot.color);
    const nextBoard = applyMoveToBoard(state.board, m.row, m.col, bot.color, flipped);
    const score = reversiMinimax(nextBoard, searchDepth - 1, alpha, Infinity, oppColor, bot.color, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
    if (score > alpha) alpha = score;
  }

  return { type: 'place', payload: bestMove };
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
