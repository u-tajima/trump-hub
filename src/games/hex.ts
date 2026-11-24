import type { HexRules, PlayerInfo } from '../types/game';

export type HexCell = 0 | 1 | 2; // 0: empty, 1: red (player 0, top-bottom), 2: blue (player 1, left-right)

export interface HexPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  color: 1 | 2;
}

export interface HexCoord {
  row: number;
  col: number;
}

export interface HexInternalState {
  rules: HexRules;
  players: [HexPlayerState, HexPlayerState];
  board: HexCell[][];
  turnIndex: 0 | 1;
  moveCount: number;
  lastMove: HexCoord | null;
  swapped: boolean;
  winningPath: HexCoord[];
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface HexClientState extends HexInternalState {
  myId: string;
  canSwap: boolean;
}

const HEX_DIRS: readonly [number, number][] = [
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
];

// 2手先の仮想連結（ブリッジ）パターン: [targetDr, targetDc, bridge1Dr, bridge1Dc, bridge2Dr, bridge2Dc]
const BRIDGE_PATTERNS: readonly [number, number, number, number, number, number][] = [
  [-2, 1, -1, 0, -1, 1],
  [-1, 2, -1, 1, 0, 1],
  [1, 1, 0, 1, 1, 0],
  [2, -1, 1, 0, 1, -1],
  [1, -2, 1, -1, 0, -1],
  [-1, -1, 0, -1, -1, 0],
];

function inBounds(n: number, r: number, c: number): boolean {
  return r >= 0 && r < n && c >= 0 && c < n;
}

/**
 * 指定色の対辺連結をBFSで判定し、勝利している場合は最短勝利経路を返す。
 * color === 1 (赤): row 0 <-> row n-1
 * color === 2 (青): col 0 <-> col n-1
 */
export function findHexWinningPath(board: HexCell[][], color: 1 | 2): HexCoord[] | null {
  const n = board.length;
  const visited: boolean[][] = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  const parent: (HexCoord | null)[][] = Array.from({ length: n }, () =>
    Array<HexCoord | null>(n).fill(null)
  );
  const queue: HexCoord[] = [];

  if (color === 1) {
    for (let c = 0; c < n; c++) {
      if (board[0][c] === 1) {
        visited[0][c] = true;
        queue.push({ row: 0, col: c });
      }
    }
  } else {
    for (let r = 0; r < n; r++) {
      if (board[r][0] === 2) {
        visited[r][0] = true;
        queue.push({ row: r, col: 0 });
      }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if ((color === 1 && cur.row === n - 1) || (color === 2 && cur.col === n - 1)) {
      const path: HexCoord[] = [];
      let node: HexCoord | null = cur;
      while (node) {
        path.push(node);
        node = parent[node.row][node.col];
      }
      path.reverse();
      return path;
    }

    for (const [dr, dc] of HEX_DIRS) {
      const nr = cur.row + dr;
      const nc = cur.col + dc;
      if (inBounds(n, nr, nc) && !visited[nr][nc] && board[nr][nc] === color) {
        visited[nr][nc] = true;
        parent[nr][nc] = cur;
        queue.push({ row: nr, col: nc });
      }
    }
  }

  return null;
}

export function initHex(playersInfo: PlayerInfo[], rules: HexRules): HexInternalState {
  const n = rules.boardSize;
  const board: HexCell[][] = Array.from({ length: n }, () => Array<HexCell>(n).fill(0));
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

  const players: [HexPlayerState, HexPlayerState] = [
    { id: p0.id, name: p0.name, isBot: p0.isBot, color: 1 },
    { id: p1.id, name: p1.name, isBot: p1.isBot, color: 2 },
  ];

  return {
    rules,
    players,
    board,
    turnIndex: 0,
    moveCount: 0,
    lastMove: null,
    swapped: false,
    winningPath: [],
    winnerId: null,
    phase: 'playing',
    lastLog: `${players[0].name} (赤・上下連結) のターンからスタート！`,
  };
}

export function applyHexAction(
  state: HexInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: HexInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }
  const current = state.players[state.turnIndex];
  if (current.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }

  const n = state.board.length;

  // パイルール（スワップ）
  if (action.type === 'swap') {
    if (!state.rules.swapRule || state.moveCount !== 1 || state.turnIndex !== 1 || !state.lastMove) {
      return { state, error: '現在はパイルールで交換できません' };
    }
    const { row, col } = state.lastMove;
    const board = state.board.map((r) => [...r]);
    board[row][col] = 2; // 後手(青)の色に奪う

    return {
      state: {
        ...state,
        board,
        turnIndex: 0,
        moveCount: state.moveCount + 1,
        swapped: true,
        lastLog: `${current.name} がパイルールで初手の石を奪いました！次は ${state.players[0].name} (赤)`,
      },
    };
  }

  if (action.type !== 'place') {
    return { state, error: '不明なアクションです' };
  }

  const payload = action.payload as { row?: unknown; col?: unknown } | undefined;
  const row = payload?.row;
  const col = payload?.col;
  if (
    typeof row !== 'number' ||
    typeof col !== 'number' ||
    !Number.isInteger(row) ||
    !Number.isInteger(col) ||
    !inBounds(n, row, col)
  ) {
    return { state, error: '不正な座標です' };
  }

  if (state.board[row][col] !== 0) {
    return { state, error: 'すでに石が置かれています' };
  }

  const board = state.board.map((r) => [...r]);
  board[row][col] = current.color;

  const winningPath = findHexWinningPath(board, current.color);
  if (winningPath) {
    const colorLabel = current.color === 1 ? '赤・上下' : '青・左右';
    return {
      state: {
        ...state,
        board,
        moveCount: state.moveCount + 1,
        lastMove: { row, col },
        winningPath,
        winnerId: current.id,
        phase: 'finished',
        lastLog: `${current.name} (${colorLabel}) が対辺を繋いで勝利！`,
      },
    };
  }

  const nextIndex: 0 | 1 = state.turnIndex === 0 ? 1 : 0;
  const nextPlayer = state.players[nextIndex];
  const nextColorLabel = nextPlayer.color === 1 ? '赤' : '青';

  return {
    state: {
      ...state,
      board,
      turnIndex: nextIndex,
      moveCount: state.moveCount + 1,
      lastMove: { row, col },
      lastLog: `${current.name} が着手しました。次は ${nextPlayer.name} (${nextColorLabel})`,
    },
  };
}

/**
 * 0-1 BFS による対辺連結までの最小必要手数（距離）を算出。
 * 自色石=コスト0、空きマス=コスト1、相手石=通行不可。
 */
function shortestConnectionDistance(board: HexCell[][], color: 1 | 2): number {
  const n = board.length;
  const opp: HexCell = color === 1 ? 2 : 1;
  const INF = 9999;
  const dist: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(INF));
  const deque: HexCoord[] = [];

  if (color === 1) {
    for (let c = 0; c < n; c++) {
      const cell = board[0][c];
      if (cell === opp) continue;
      const cost = cell === color ? 0 : 1;
      dist[0][c] = cost;
      if (cost === 0) deque.unshift({ row: 0, col: c });
      else deque.push({ row: 0, col: c });
    }
  } else {
    for (let r = 0; r < n; r++) {
      const cell = board[r][0];
      if (cell === opp) continue;
      const cost = cell === color ? 0 : 1;
      dist[r][0] = cost;
      if (cost === 0) deque.unshift({ row: r, col: 0 });
      else deque.push({ row: r, col: 0 });
    }
  }

  while (deque.length > 0) {
    const cur = deque.shift()!;
    const curDist = dist[cur.row][cur.col];
    if ((color === 1 && cur.row === n - 1) || (color === 2 && cur.col === n - 1)) {
      return curDist;
    }

    for (const [dr, dc] of HEX_DIRS) {
      const nr = cur.row + dr;
      const nc = cur.col + dc;
      if (!inBounds(n, nr, nc)) continue;
      const cell = board[nr][nc];
      if (cell === opp) continue;
      const step = cell === color ? 0 : 1;
      const nd = curDist + step;
      if (nd < dist[nr][nc]) {
        dist[nr][nc] = nd;
        if (step === 0) deque.unshift({ row: nr, col: nc });
        else deque.push({ row: nr, col: nc });
      }
    }
  }

  return INF;
}

export function computeHexBotAction(
  state: HexInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  const bot = state.players[state.turnIndex];
  const myColor = bot.color;
  const oppColor: 1 | 2 = myColor === 1 ? 2 : 1;
  const n = state.board.length;
  const center = (n - 1) / 2;

  // パイルール検討: 初手が中央寄りなら奪う
  if (state.rules.swapRule && state.moveCount === 1 && state.turnIndex === 1 && state.lastMove) {
    const distFromCenter =
      Math.abs(state.lastMove.row - center) + Math.abs(state.lastMove.col - center);
    if (distFromCenter <= Math.max(1.5, n * 0.25)) {
      return { type: 'swap' };
    }
  }

  const empties: HexCoord[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (state.board[r][c] === 0) {
        empties.push({ row: r, col: c });
      }
    }
  }
  if (empties.length === 0) return null;

  // 初手は中央付近に打つ
  if (state.moveCount === 0) {
    const mid = Math.floor(n / 2);
    return { type: 'place', payload: { row: mid, col: mid } };
  }

  const workBoard = state.board.map((r) => [...r]);

  // 1. 即勝ち手チェック
  for (const pos of empties) {
    workBoard[pos.row][pos.col] = myColor;
    if (findHexWinningPath(workBoard, myColor)) {
      return { type: 'place', payload: pos };
    }
    workBoard[pos.row][pos.col] = 0;
  }

  // 2. 相手の即勝ちブロックチェック
  for (const pos of empties) {
    workBoard[pos.row][pos.col] = oppColor;
    if (findHexWinningPath(workBoard, oppColor)) {
      return { type: 'place', payload: pos };
    }
    workBoard[pos.row][pos.col] = 0;
  }

  // 3. 距離差 + 仮想連結(ブリッジ) + 中央制御で評価
  const baseMyDist = shortestConnectionDistance(workBoard, myColor);
  const baseOppDist = shortestConnectionDistance(workBoard, oppColor);

  let bestPos = empties[0];
  let bestScore = -Infinity;

  for (const pos of empties) {
    workBoard[pos.row][pos.col] = myColor;
    const myDist = shortestConnectionDistance(workBoard, myColor);
    const oppDist = shortestConnectionDistance(workBoard, oppColor);
    workBoard[pos.row][pos.col] = 0;

    // 自分の距離を縮め、相手の距離を伸ばす手を高く評価
    let score = (baseMyDist - myDist) * 42 + (oppDist - baseOppDist) * 48 - myDist * 6 + oppDist * 4;

    // 仮想連結（ブリッジ）形成と相手のブリッジ破壊
    for (const [tdr, tdc, b1r, b1c, b2r, b2c] of BRIDGE_PATTERNS) {
      const tr = pos.row + tdr;
      const tc = pos.col + tdc;
      const m1r = pos.row + b1r;
      const m1c = pos.col + b1c;
      const m2r = pos.row + b2r;
      const m2c = pos.col + b2c;
      if (
        inBounds(n, tr, tc) &&
        inBounds(n, m1r, m1c) &&
        inBounds(n, m2r, m2c) &&
        state.board[tr][tc] === myColor &&
        state.board[m1r][m1c] === 0 &&
        state.board[m2r][m2c] === 0
      ) {
        score += 10;
      }
    }

    // 相手がこちらのブリッジに割り込んできた場合の受け（もう片方の空きマスを最優先で守る）
    for (const [dr1, dc1] of HEX_DIRS) {
      const r1 = pos.row + dr1;
      const c1 = pos.col + dc1;
      if (inBounds(n, r1, c1) && state.board[r1][c1] === oppColor) {
        // 相手の直前の手への近接対応を少し優遇
        if (state.lastMove && state.lastMove.row === r1 && state.lastMove.col === c1) {
          score += 9;
        }
      }
    }

    // 中央優先
    const centerDist = Math.abs(pos.row - center) + Math.abs(pos.col - center);
    score += Math.max(0, n - centerDist) * 1.4;

    // 同点のゆらぎ
    score += Math.random() * 0.8;

    if (score > bestScore) {
      bestScore = score;
      bestPos = pos;
    }
  }

  return { type: 'place', payload: bestPos };
}

export function sanitizeHexState(state: HexInternalState, playerId: string): HexClientState {
  const current = state.players[state.turnIndex];
  const canSwap =
    state.phase === 'playing' &&
    state.rules.swapRule &&
    state.moveCount === 1 &&
    state.turnIndex === 1 &&
    current.id === playerId;

  return {
    ...state,
    myId: playerId,
    canSwap,
  };
}
