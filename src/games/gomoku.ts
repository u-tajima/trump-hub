import type { GomokuRules, PlayerInfo } from '../types/game';

export type GomokuCell = 0 | 1 | 2; // 0: empty, 1: black, 2: white

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

interface AxisPatternResult {
  isWin: boolean;
  open4: number;
  half4: number;
  open3: number;
  half3: number;
  open2: number;
  score: number;
}

function analyzeGomokuAxis(
  board: GomokuCell[][],
  row: number,
  col: number,
  dr: number,
  dc: number,
  stone: 1 | 2,
  allowOverline: boolean
): AxisPatternResult {
  const n = board.length;
  // 中心(index 5)から前後5マス（計11マス）のラインを取得 (-1 = 盤外または相手石, 0 = 空, 1 = 自分石)
  const C = 5;
  const LEN = 11;
  const line: number[] = new Array(LEN).fill(-1);
  line[C] = 1;
  for (let d = 1; d <= C; d++) {
    const rPos = row + dr * d;
    const cPos = col + dc * d;
    if (rPos >= 0 && rPos < n && cPos >= 0 && cPos < n) {
      const cell = board[rPos][cPos];
      line[C + d] = cell === stone ? 1 : cell === 0 ? 0 : -1;
    }
    const rNeg = row - dr * d;
    const cNeg = col - dc * d;
    if (rNeg >= 0 && rNeg < n && cNeg >= 0 && cNeg < n) {
      const cell = board[rNeg][cNeg];
      line[C - d] = cell === stone ? 1 : cell === 0 ? 0 : -1;
    }
  }

  // 中心から連続する石の数
  let leftCont = 0;
  while (C - leftCont - 1 >= 0 && line[C - leftCont - 1] === 1) leftCont++;
  let rightCont = 0;
  while (C + rightCont + 1 < LEN && line[C + rightCont + 1] === 1) rightCont++;
  const contiguous = 1 + leftCont + rightCont;

  if (allowOverline ? contiguous >= 5 : contiguous === 5) {
    return { isWin: true, open4: 0, half4: 0, open3: 0, half3: 0, open2: 0, score: 1000000 };
  }
  if (!allowOverline && contiguous > 5) {
    return { isWin: false, open4: 0, half4: 0, open3: 0, half3: 0, open2: 0, score: -500 };
  }

  const leftEndIdx = C - leftCont - 1;
  const rightEndIdx = C + rightCont + 1;
  const leftOpen = leftEndIdx >= 0 && line[leftEndIdx] === 0;
  const rightOpen = rightEndIdx < LEN && line[rightEndIdx] === 0;

  // 1マス空き（飛び石）を含めた連続数の確認
  let leftJump = 0;
  if (leftOpen) {
    let idx = leftEndIdx - 1;
    while (idx >= 0 && line[idx] === 1) {
      leftJump++;
      idx--;
    }
  }
  let rightJump = 0;
  if (rightOpen) {
    let idx = rightEndIdx + 1;
    while (idx < LEN && line[idx] === 1) {
      rightJump++;
      idx++;
    }
  }

  // 5連を作れる空間（自分石または空マスが連続5マス以上あるか）
  let spanLeft = 0;
  while (C - spanLeft - 1 >= 0 && line[C - spanLeft - 1] !== -1) spanLeft++;
  let spanRight = 0;
  while (C + spanRight + 1 < LEN && line[C + spanRight + 1] !== -1) spanRight++;
  if (1 + spanLeft + spanRight < 5) {
    return { isWin: false, open4: 0, half4: 0, open3: 0, half3: 0, open2: 0, score: 0 };
  }

  if (contiguous === 4) {
    if (leftOpen && rightOpen) {
      return { isWin: false, open4: 1, half4: 0, open3: 0, half3: 0, open2: 0, score: 120000 };
    }
    if (leftOpen || rightOpen) {
      return { isWin: false, open4: 0, half4: 1, open3: 0, half3: 0, open2: 0, score: 18000 };
    }
  }

  // 飛び四 (例: 111_1, 11_11, 1_111)
  const jumpTotalLeft = contiguous + leftJump;
  const jumpTotalRight = contiguous + rightJump;
  if (jumpTotalLeft >= 4 || jumpTotalRight >= 4) {
    const bothJump4 = jumpTotalLeft >= 4 && jumpTotalRight >= 4;
    if (bothJump4) {
      return { isWin: false, open4: 1, half4: 0, open3: 0, half3: 0, open2: 0, score: 110000 };
    }
    return { isWin: false, open4: 0, half4: 1, open3: 0, half3: 0, open2: 0, score: 16000 };
  }

  if (contiguous === 3) {
    const leftTwoOpen = leftOpen && leftEndIdx - 1 >= 0 && line[leftEndIdx - 1] === 0;
    const rightTwoOpen = rightOpen && rightEndIdx + 1 < LEN && line[rightEndIdx + 1] === 0;
    if (leftOpen && rightOpen && (leftTwoOpen || rightTwoOpen)) {
      return { isWin: false, open4: 0, half4: 0, open3: 1, half3: 0, open2: 0, score: 12000 };
    }
    if (leftOpen || rightOpen) {
      return { isWin: false, open4: 0, half4: 0, open3: 0, half3: 1, open2: 0, score: 1200 };
    }
  }

  // 飛び三 (例: 011_10, 01_110)
  if (jumpTotalLeft === 3) {
    const outerLeftIdx = leftEndIdx - leftJump - 1;
    const outerLeftOpen = outerLeftIdx >= 0 && line[outerLeftIdx] === 0;
    if (rightOpen && outerLeftOpen) {
      return { isWin: false, open4: 0, half4: 0, open3: 1, half3: 0, open2: 0, score: 9500 };
    }
    if (rightOpen || outerLeftOpen) {
      return { isWin: false, open4: 0, half4: 0, open3: 0, half3: 1, open2: 0, score: 900 };
    }
  }
  if (jumpTotalRight === 3) {
    const outerRightIdx = rightEndIdx + rightJump + 1;
    const outerRightOpen = outerRightIdx < LEN && line[outerRightIdx] === 0;
    if (leftOpen && outerRightOpen) {
      return { isWin: false, open4: 0, half4: 0, open3: 1, half3: 0, open2: 0, score: 9500 };
    }
    if (leftOpen || outerRightOpen) {
      return { isWin: false, open4: 0, half4: 0, open3: 0, half3: 1, open2: 0, score: 900 };
    }
  }

  if (contiguous === 2) {
    if (leftOpen && rightOpen) {
      return { isWin: false, open4: 0, half4: 0, open3: 0, half3: 0, open2: 1, score: 380 };
    }
    if (leftOpen || rightOpen) {
      return { isWin: false, open4: 0, half4: 0, open3: 0, half3: 0, open2: 0, score: 70 };
    }
  }

  if (jumpTotalLeft === 2 || jumpTotalRight === 2) {
    if (leftOpen && rightOpen) {
      return { isWin: false, open4: 0, half4: 0, open3: 0, half3: 0, open2: 1, score: 240 };
    }
  }

  return {
    isWin: false,
    open4: 0,
    half4: 0,
    open3: 0,
    half3: 0,
    open2: 0,
    score: leftOpen && rightOpen ? 20 : 5,
  };
}

function evaluateGomokuPoint(
  board: GomokuCell[][],
  row: number,
  col: number,
  stone: 1 | 2,
  allowOverline: boolean
): number {
  let totalScore = 0;
  let open4 = 0;
  let half4 = 0;
  let open3 = 0;
  let half3 = 0;
  let open2 = 0;

  for (const [dr, dc] of AXES) {
    const res = analyzeGomokuAxis(board, row, col, dr, dc, stone, allowOverline);
    if (res.isWin) return 1000000;
    totalScore += res.score;
    open4 += res.open4;
    half4 += res.half4;
    open3 += res.open3;
    half3 += res.half3;
    open2 += res.open2;
  }

  // 複合フォークボーナス（四四・四三・三三）
  if (open4 >= 1 || half4 >= 2) {
    totalScore += 120000;
  } else if (half4 >= 1 && open3 >= 1) {
    totalScore += 85000;
  } else if (open3 >= 2) {
    totalScore += 50000;
  } else if (open3 >= 1 && (half3 >= 1 || open2 >= 1)) {
    totalScore += 4000;
  } else if (open2 >= 2) {
    totalScore += 900;
  }

  return totalScore;
}

function generateGomokuCandidates(
  board: GomokuCell[][],
  myStone: 1 | 2,
  oppStone: 1 | 2,
  allowOverline: boolean,
  maxCandidates = 10
): { row: number; col: number; atk: number; def: number; priority: number }[] {
  const n = board.length;
  const center = Math.floor(n / 2);
  let hasAnyStone = false;

  const candidates: { row: number; col: number; atk: number; def: number; priority: number }[] = [];

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (board[r][c] !== 0) {
        hasAnyStone = true;
        continue;
      }
      // 既存の石から距離2以内のみ候補にする
      let near = false;
      for (let dr = -2; dr <= 2 && !near; dr++) {
        for (let dc = -2; dc <= 2 && !near; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n && board[nr][nc] !== 0) {
            near = true;
          }
        }
      }
      if (!near) continue;

      const atk = evaluateGomokuPoint(board, r, c, myStone, allowOverline);
      const def = evaluateGomokuPoint(board, r, c, oppStone, allowOverline);
      const distPenalty = (Math.abs(r - center) + Math.abs(c - center)) * 2;
      // 攻防合算＋相手の決定打阻止も高評価
      const priority = atk * 1.05 + def + Math.max(atk, def * 0.98) - distPenalty;
      candidates.push({ row: r, col: c, atk, def, priority });
    }
  }

  if (!hasAnyStone) {
    return [{ row: center, col: center, atk: 100, def: 100, priority: 200 }];
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates.slice(0, maxCandidates);
}

function evaluateGomokuBoardStatic(
  board: GomokuCell[][],
  botStone: 1 | 2,
  allowOverline: boolean
): number {
  const n = board.length;
  let score = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = board[r][c];
      if (cell === 0) continue;
      const pt = evaluateGomokuPoint(board, r, c, cell, allowOverline);
      if (cell === botStone) score += pt;
      else score -= pt * 1.05;
    }
  }
  return score;
}

function gomokuMinimax(
  board: GomokuCell[][],
  depth: number,
  alpha: number,
  beta: number,
  currentStone: 1 | 2,
  botStone: 1 | 2,
  allowOverline: boolean
): number {
  const oppStone: 1 | 2 = currentStone === 1 ? 2 : 1;
  const candidates = generateGomokuCandidates(board, currentStone, oppStone, allowOverline, 7);
  if (candidates.length === 0) return 0;

  // 即5連がある場合
  if (candidates[0].atk >= 1000000) {
    return currentStone === botStone ? 1000000 + depth * 10000 : -(1000000 + depth * 10000);
  }

  if (depth <= 0) {
    return evaluateGomokuBoardStatic(board, botStone, allowOverline);
  }

  const isMaximizing = currentStone === botStone;
  if (isMaximizing) {
    let best = -Infinity;
    for (const cand of candidates) {
      board[cand.row][cand.col] = currentStone;
      const val = gomokuMinimax(board, depth - 1, alpha, beta, oppStone, botStone, allowOverline);
      board[cand.row][cand.col] = 0;
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const cand of candidates) {
      board[cand.row][cand.col] = currentStone;
      const val = gomokuMinimax(board, depth - 1, alpha, beta, oppStone, botStone, allowOverline);
      board[cand.row][cand.col] = 0;
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function computeGomokuBotAction(state: GomokuInternalState): { type: string; payload?: unknown } | null {
  const bot = state.players[state.turnIndex];
  const oppStone: 1 | 2 = bot.stone === 1 ? 2 : 1;
  const allowOverline = state.rules.allowOverline;
  const sim = state.board.map((r) => [...r]);

  const candidates = generateGomokuCandidates(sim, bot.stone, oppStone, allowOverline, 10);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    return { type: 'place', payload: { row: candidates[0].row, col: candidates[0].col } };
  }

  // 1. 自分の即5連勝ち
  const winMove = candidates.find((c) => c.atk >= 1000000);
  if (winMove) {
    return { type: 'place', payload: { row: winMove.row, col: winMove.col } };
  }

  // 2. 相手の即5連を必ず阻止
  const blockWinMove = candidates.find((c) => c.def >= 1000000);
  if (blockWinMove) {
    return { type: 'place', payload: { row: blockWinMove.row, col: blockWinMove.col } };
  }

  // 3. 自分が活四・四四・四三の必勝形を作れるなら即実行
  const unstoppableAtk = candidates.find((c) => c.atk >= 95000);
  if (unstoppableAtk) {
    return { type: 'place', payload: { row: unstoppableAtk.row, col: unstoppableAtk.col } };
  }

  // 4. 相手が活四・四三・三三の必勝形を作る手を最優先で阻止
  const blockFork = candidates.find((c) => c.def >= 60000);
  if (blockFork) {
    return { type: 'place', payload: { row: blockFork.row, col: blockFork.col } };
  }

  // 5. 深さ3のAlpha-Beta探索で最善手を選択
  let bestMove = { row: candidates[0].row, col: candidates[0].col };
  let bestScore = -Infinity;
  let alpha = -Infinity;

  for (const cand of candidates) {
    sim[cand.row][cand.col] = bot.stone;
    const lookahead = gomokuMinimax(sim, 2, alpha, Infinity, oppStone, bot.stone, allowOverline);
    sim[cand.row][cand.col] = 0;
    const total = lookahead + cand.priority * 0.15;
    if (total > bestScore) {
      bestScore = total;
      bestMove = { row: cand.row, col: cand.col };
    }
    if (total > alpha) alpha = total;
  }

  return { type: 'place', payload: bestMove };
}

export function sanitizeGomokuState(state: GomokuInternalState, playerId: string): GomokuClientState {
  return { ...state, myId: playerId };
}
