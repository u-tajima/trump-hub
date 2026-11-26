import type { Connect4_3DRules, PlayerInfo } from '../types/game';

export type Connect4_3DCell = 0 | 1 | 2; // 0: empty, 1: P0 (red), 2: P1 (cyan/yellow)

export interface Connect4_3DCoord {
  z: number;
  row: number;
  col: number;
}

export interface Connect4_3DPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  disc: 1 | 2;
}

export interface Connect4_3DInternalState {
  rules: Connect4_3DRules;
  players: [Connect4_3DPlayerState, Connect4_3DPlayerState];
  board: Connect4_3DCell[][][]; // board[z][row][col], z=0..3 (1F..4F)
  turnIndex: 0 | 1;
  moveCount: number;
  lastMove: Connect4_3DCoord | null;
  winningLine: Connect4_3DCoord[];
  winnerId: string | 'draw' | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface Connect4_3DClientState extends Connect4_3DInternalState {
  myId: string;
}

export const C4_3D_SIZE = 4;

/**
 * 4x4x4 立体4目並べの全76本の勝利ラインを生成する。
 * - 同一階層の横: 16本
 * - 同一階層の縦: 16本
 * - 同一階層の斜め: 8本
 * - 垂直柱: 16本
 * - 縦断面斜め (r固定): 8本
 * - 横断面斜め (c固定): 8本
 * - 立体対角線: 4本
 * 合計 = 76本
 */
export const WINNING_LINES_3D: readonly Connect4_3DCoord[][] = (() => {
  const lines: Connect4_3DCoord[][] = [];

  // 1. 同一階層の横 (16)
  for (let z = 0; z < 4; z++) {
    for (let r = 0; r < 4; r++) {
      lines.push([0, 1, 2, 3].map((c) => ({ z, row: r, col: c })));
    }
  }

  // 2. 同一階層の縦 (16)
  for (let z = 0; z < 4; z++) {
    for (let c = 0; c < 4; c++) {
      lines.push([0, 1, 2, 3].map((r) => ({ z, row: r, col: c })));
    }
  }

  // 3. 同一階層の斜め (8)
  for (let z = 0; z < 4; z++) {
    lines.push([0, 1, 2, 3].map((i) => ({ z, row: i, col: i })));
    lines.push([0, 1, 2, 3].map((i) => ({ z, row: i, col: 3 - i })));
  }

  // 4. 垂直柱 (16)
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      lines.push([0, 1, 2, 3].map((z) => ({ z, row: r, col: c })));
    }
  }

  // 5. 縦断面斜め (r固定, 8)
  for (let r = 0; r < 4; r++) {
    lines.push([0, 1, 2, 3].map((i) => ({ z: i, row: r, col: i })));
    lines.push([0, 1, 2, 3].map((i) => ({ z: i, row: r, col: 3 - i })));
  }

  // 6. 横断面斜め (c固定, 8)
  for (let c = 0; c < 4; c++) {
    lines.push([0, 1, 2, 3].map((i) => ({ z: i, row: i, col: c })));
    lines.push([0, 1, 2, 3].map((i) => ({ z: i, row: 3 - i, col: c })));
  }

  // 7. 立体対角線 (4)
  lines.push([0, 1, 2, 3].map((i) => ({ z: i, row: i, col: i })));
  lines.push([0, 1, 2, 3].map((i) => ({ z: i, row: i, col: 3 - i })));
  lines.push([0, 1, 2, 3].map((i) => ({ z: i, row: 3 - i, col: i })));
  lines.push([0, 1, 2, 3].map((i) => ({ z: i, row: 3 - i, col: 3 - i })));

  return lines;
})();

function createEmptyBoard(): Connect4_3DCell[][][] {
  return Array.from({ length: C4_3D_SIZE }, () =>
    Array.from({ length: C4_3D_SIZE }, () => Array<Connect4_3DCell>(C4_3D_SIZE).fill(0))
  );
}

function inRange(v: number): boolean {
  return Number.isInteger(v) && v >= 0 && v < C4_3D_SIZE;
}

export function findLowestEmptyZ(
  board: Connect4_3DCell[][][],
  row: number,
  col: number
): number {
  for (let z = 0; z < C4_3D_SIZE; z++) {
    if (board[z][row][col] === 0) return z;
  }
  return -1;
}

export function findConnect4_3DWinningLine(
  board: Connect4_3DCell[][][],
  disc: 1 | 2
): Connect4_3DCoord[] | null {
  for (const line of WINNING_LINES_3D) {
    if (
      board[line[0].z][line[0].row][line[0].col] === disc &&
      board[line[1].z][line[1].row][line[1].col] === disc &&
      board[line[2].z][line[2].row][line[2].col] === disc &&
      board[line[3].z][line[3].row][line[3].col] === disc
    ) {
      return line;
    }
  }
  return null;
}

const COL_LABELS = ['A', 'B', 'C', 'D'];

function formatCoord(coord: Connect4_3DCoord): string {
  return `${coord.z + 1}F-${COL_LABELS[coord.col]}${coord.row + 1}`;
}

export function initConnect4_3D(
  playersInfo: PlayerInfo[],
  rules: Connect4_3DRules
): Connect4_3DInternalState {
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

  const players: [Connect4_3DPlayerState, Connect4_3DPlayerState] = [
    { id: p0.id, name: p0.name, isBot: p0.isBot, disc: 1 },
    { id: p1.id, name: p1.name, isBot: p1.isBot, disc: 2 },
  ];

  const modeHint = rules.gravityMode
    ? '重力モード：下の階から積み上がります'
    : '自由配置モード：どの階にも直接置けます';

  return {
    rules,
    players,
    board: createEmptyBoard(),
    turnIndex: 0,
    moveCount: 0,
    lastMove: null,
    winningLine: [],
    winnerId: null,
    phase: 'playing',
    lastLog: `${players[0].name}（赤）からスタート！${modeHint}`,
  };
}

export function applyConnect4_3DAction(
  state: Connect4_3DInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: Connect4_3DInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }
  const current = state.players[state.turnIndex];
  if (current.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }
  if (action.type !== 'place') {
    return { state, error: '不明なアクションです' };
  }

  const payload = action.payload as { z?: unknown; row?: unknown; col?: unknown } | undefined;
  const rawZ = payload?.z;
  const row = payload?.row;
  const col = payload?.col;

  if (typeof row !== 'number' || typeof col !== 'number' || !inRange(row) || !inRange(col)) {
    return { state, error: '不正な座標です' };
  }

  let targetZ: number;
  if (state.rules.gravityMode) {
    if (rawZ !== undefined && (typeof rawZ !== 'number' || !inRange(rawZ))) {
      return { state, error: '不正な階層です' };
    }
    targetZ = findLowestEmptyZ(state.board, row, col);
    if (targetZ < 0) {
      return { state, error: 'その柱は最上階まで埋まっています' };
    }
  } else {
    if (typeof rawZ !== 'number' || !inRange(rawZ)) {
      return { state, error: '不正な階層です' };
    }
    if (state.board[rawZ][row][col] !== 0) {
      return { state, error: 'そのマスにはすでに駒があります' };
    }
    targetZ = rawZ;
  }

  const board = state.board.map((layer) => layer.map((r) => [...r]));
  board[targetZ][row][col] = current.disc;

  const moveCoord: Connect4_3DCoord = { z: targetZ, row, col };
  const moveCount = state.moveCount + 1;

  const winLine = findConnect4_3DWinningLine(board, current.disc);
  if (winLine) {
    return {
      state: {
        ...state,
        board,
        moveCount,
        lastMove: moveCoord,
        winningLine: winLine,
        winnerId: current.id,
        phase: 'finished',
        lastLog: `${current.name} が ${formatCoord(moveCoord)} で立体4連を完成させ勝利！`,
      },
    };
  }

  if (moveCount >= 64) {
    return {
      state: {
        ...state,
        board,
        moveCount,
        lastMove: moveCoord,
        winnerId: 'draw',
        phase: 'finished',
        lastLog: '全64マスが埋まり引き分けです！',
      },
    };
  }

  const nextIndex: 0 | 1 = state.turnIndex === 0 ? 1 : 0;
  const nextPlayer = state.players[nextIndex];
  const nextLabel = nextPlayer.disc === 1 ? '赤' : '黄';

  return {
    state: {
      ...state,
      board,
      turnIndex: nextIndex,
      moveCount,
      lastMove: moveCoord,
      lastLog: `${current.name} が ${formatCoord(moveCoord)} に配置。次は ${nextPlayer.name}（${nextLabel}）`,
    },
  };
}

function getValidMoves(
  board: Connect4_3DCell[][][],
  gravityMode: boolean
): Connect4_3DCoord[] {
  const moves: Connect4_3DCoord[] = [];
  if (gravityMode) {
    for (let r = 0; r < C4_3D_SIZE; r++) {
      for (let c = 0; c < C4_3D_SIZE; c++) {
        const z = findLowestEmptyZ(board, r, c);
        if (z >= 0) moves.push({ z, row: r, col: c });
      }
    }
  } else {
    for (let z = 0; z < C4_3D_SIZE; z++) {
      for (let r = 0; r < C4_3D_SIZE; r++) {
        for (let c = 0; c < C4_3D_SIZE; c++) {
          if (board[z][r][c] === 0) moves.push({ z, row: r, col: c });
        }
      }
    }
  }
  return moves;
}

function isCenterCell(c: Connect4_3DCoord): boolean {
  return (
    (c.z === 1 || c.z === 2) &&
    (c.row === 1 || c.row === 2) &&
    (c.col === 1 || c.col === 2)
  );
}

function isCornerCell(c: Connect4_3DCoord): boolean {
  return (
    (c.z === 0 || c.z === 3) &&
    (c.row === 0 || c.row === 3) &&
    (c.col === 0 || c.col === 3)
  );
}

function evaluate3DBoard(
  board: Connect4_3DCell[][][],
  botDisc: 1 | 2,
  oppDisc: 1 | 2
): { score: number; myThreats: number; oppThreats: number } {
  let score = 0;
  let myThreats = 0;
  let oppThreats = 0;

  for (const line of WINNING_LINES_3D) {
    let myCount = 0;
    let oppCount = 0;
    for (const p of line) {
      const cell = board[p.z][p.row][p.col];
      if (cell === botDisc) myCount++;
      else if (cell === oppDisc) oppCount++;
    }
    if (myCount > 0 && oppCount > 0) continue;

    if (myCount === 4) {
      score += 100000;
    } else if (oppCount === 4) {
      score -= 100000;
    } else if (myCount === 3) {
      myThreats++;
      score += 85;
    } else if (myCount === 2) {
      score += 14;
    } else if (myCount === 1) {
      score += 2;
    } else if (oppCount === 3) {
      oppThreats++;
      score -= 95;
    } else if (oppCount === 2) {
      score -= 16;
    } else if (oppCount === 1) {
      score -= 2;
    }
  }

  // フォーク（複数リーチ）作成ボーナス
  if (myThreats >= 2) score += 260;
  if (oppThreats >= 2) score -= 240;

  return { score, myThreats, oppThreats };
}

export function computeConnect4_3DBotAction(
  state: Connect4_3DInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  const bot = state.players[state.turnIndex];
  const oppDisc: 1 | 2 = bot.disc === 1 ? 2 : 1;
  const validMoves = getValidMoves(state.board, state.rules.gravityMode);
  if (validMoves.length === 0) return null;

  const sim = state.board.map((layer) => layer.map((r) => [...r]));

  // 1. 即4目勝利チェック
  for (const m of validMoves) {
    sim[m.z][m.row][m.col] = bot.disc;
    const win = findConnect4_3DWinningLine(sim, bot.disc);
    sim[m.z][m.row][m.col] = 0;
    if (win) return { type: 'place', payload: m };
  }

  // 2. 相手の即4目勝利をブロック
  for (const m of validMoves) {
    sim[m.z][m.row][m.col] = oppDisc;
    const oppWin = findConnect4_3DWinningLine(sim, oppDisc);
    sim[m.z][m.row][m.col] = 0;
    if (oppWin) return { type: 'place', payload: m };
  }

  // 3. フォーク・ライン評価・中央8マス優先・重力アシスト回避
  let bestMove = validMoves[0];
  let bestScore = -Infinity;

  for (const m of validMoves) {
    sim[m.z][m.row][m.col] = bot.disc;
    const { score: baseScore } = evaluate3DBoard(sim, bot.disc, oppDisc);
    let score = baseScore;

    // 重力モードON時: 自分の直上のマス (z+1) に相手が置いて即勝ちできる自殺手を回避
    if (state.rules.gravityMode && m.z + 1 < C4_3D_SIZE) {
      sim[m.z + 1][m.row][m.col] = oppDisc;
      const givesOppWin = findConnect4_3DWinningLine(sim, oppDisc) !== null;
      sim[m.z + 1][m.row][m.col] = 0;
      if (givesOppWin) {
        score -= 5000;
      }
    }

    sim[m.z][m.row][m.col] = 0;

    // 中央8マスと角8マスは通過ライン数（7本）が最も多い強ポジション
    if (isCenterCell(m)) {
      score += 22;
    } else if (isCornerCell(m)) {
      score += 12;
    }

    // 同点ゆらぎ
    score += Math.random() * 2.0;

    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }

  return { type: 'place', payload: bestMove };
}

export function sanitizeConnect4_3DState(
  state: Connect4_3DInternalState,
  playerId: string
): Connect4_3DClientState {
  return {
    ...state,
    myId: playerId,
  };
}
