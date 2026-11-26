import type { CorridorRules, PlayerInfo } from '../types/game';

export interface CorridorCoord {
  row: number;
  col: number;
}

export interface CorridorPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  side: 0 | 1; // 0: 下スタート -> row 0 ゴール, 1: 上スタート -> row N-1 ゴール
  pos: CorridorCoord;
  wallsLeft: number;
}

export type CorridorLastAction =
  | { kind: 'move'; side: 0 | 1; from: CorridorCoord; to: CorridorCoord }
  | { kind: 'wall'; side: 0 | 1; orientation: 'h' | 'v'; row: number; col: number };

export interface CorridorInternalState {
  rules: CorridorRules;
  boardSize: 7 | 9;
  players: [CorridorPlayerState, CorridorPlayerState];
  hWalls: boolean[][]; // (N-1) x (N-1)
  vWalls: boolean[][]; // (N-1) x (N-1)
  turnIndex: 0 | 1;
  moveCount: number;
  lastAction: CorridorLastAction | null;
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface CorridorClientState extends CorridorInternalState {
  myId: string;
  validMoves: CorridorCoord[];
  validHWalls: CorridorCoord[];
  validVWalls: CorridorCoord[];
}

const ORTHO_DIRS: readonly [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function inBoard(n: number, r: number, c: number): boolean {
  return r >= 0 && r < n && c >= 0 && c < n;
}

function isValidInt(v: unknown, min: number, maxExclusive: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v < maxExclusive;
}

/**
 * 隣接する2マス (r1,c1) - (r2,c2) の間に壁があるか判定
 */
export function isBlockedByWall(
  n: number,
  hWalls: boolean[][],
  vWalls: boolean[][],
  r1: number,
  c1: number,
  r2: number,
  c2: number
): boolean {
  const dr = r2 - r1;
  const dc = c2 - c1;
  if (Math.abs(dr) + Math.abs(dc) !== 1) return true;

  const wallN = n - 1;
  if (dr === 1) {
    // 下へ: hWalls[r1][c1] または hWalls[r1][c1 - 1]
    return (c1 < wallN && hWalls[r1][c1]) || (c1 > 0 && hWalls[r1][c1 - 1]);
  }
  if (dr === -1) {
    // 上へ: hWalls[r2][c1] または hWalls[r2][c1 - 1]
    return (c1 < wallN && hWalls[r2][c1]) || (c1 > 0 && hWalls[r2][c1 - 1]);
  }
  if (dc === 1) {
    // 右へ: vWalls[r1][c1] または vWalls[r1 - 1][c1]
    return (r1 < wallN && vWalls[r1][c1]) || (r1 > 0 && vWalls[r1 - 1][c1]);
  }
  // 左へ: vWalls[r1][c2] または vWalls[r1 - 1][c2]
  return (r1 < wallN && vWalls[r1][c2]) || (r1 > 0 && vWalls[r1 - 1][c2]);
}

/**
 * 駒の合法移動先を列挙（相手駒へのストレートジャンプ・壁/盤外時の斜め回避ジャンプ対応）
 */
export function getValidPawnMoves(
  n: number,
  hWalls: boolean[][],
  vWalls: boolean[][],
  myPos: CorridorCoord,
  oppPos: CorridorCoord
): CorridorCoord[] {
  const moves: CorridorCoord[] = [];
  const seen = new Set<string>();
  const add = (r: number, c: number) => {
    const key = `${r},${c}`;
    if (!seen.has(key)) {
      seen.add(key);
      moves.push({ row: r, col: c });
    }
  };

  for (const [dr, dc] of ORTHO_DIRS) {
    const nr = myPos.row + dr;
    const nc = myPos.col + dc;
    if (!inBoard(n, nr, nc)) continue;
    if (isBlockedByWall(n, hWalls, vWalls, myPos.row, myPos.col, nr, nc)) continue;

    // 相手駒と隣接していない場合
    if (nr !== oppPos.row || nc !== oppPos.col) {
      add(nr, nc);
      continue;
    }

    // 相手駒と隣接している場合：奥へストレートジャンプ可能か確認
    const jr = nr + dr;
    const jc = nc + dc;
    if (inBoard(n, jr, jc) && !isBlockedByWall(n, hWalls, vWalls, nr, nc, jr, jc)) {
      add(jr, jc);
    } else {
      // 奥が盤外または壁なら左右（直交方向）への斜め回避ジャンプ
      const sideDirs: [number, number][] =
        dr !== 0
          ? [
              [0, -1],
              [0, 1],
            ]
          : [
              [-1, 0],
              [1, 0],
            ];
      for (const [sdr, sdc] of sideDirs) {
        const sr = nr + sdr;
        const sc = nc + sdc;
        if (inBoard(n, sr, sc) && !isBlockedByWall(n, hWalls, vWalls, nr, nc, sr, sc)) {
          add(sr, sc);
        }
      }
    }
  }

  return moves;
}

/**
 * BFS で指定位置から targetRow までの最短歩数を計算（到達不能なら null）
 */
export function shortestPathToRow(
  n: number,
  hWalls: boolean[][],
  vWalls: boolean[][],
  start: CorridorCoord,
  targetRow: number
): number | null {
  if (start.row === targetRow) return 0;

  const visited = new Uint8Array(n * n);
  const queueR = new Int8Array(n * n);
  const queueC = new Int8Array(n * n);
  const queueD = new Int16Array(n * n);

  let head = 0;
  let tail = 0;
  visited[start.row * n + start.col] = 1;
  queueR[tail] = start.row;
  queueC[tail] = start.col;
  queueD[tail] = 0;
  tail++;

  while (head < tail) {
    const r = queueR[head];
    const c = queueC[head];
    const d = queueD[head];
    head++;

    for (const [dr, dc] of ORTHO_DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBoard(n, nr, nc)) continue;
      const idx = nr * n + nc;
      if (visited[idx]) continue;
      if (isBlockedByWall(n, hWalls, vWalls, r, c, nr, nc)) continue;
      if (nr === targetRow) return d + 1;
      visited[idx] = 1;
      queueR[tail] = nr;
      queueC[tail] = nc;
      queueD[tail] = d + 1;
      tail++;
    }
  }

  return null;
}

/**
 * 壁が幾何学的＆BFS完全封鎖禁止ルールを満たすか判定
 */
export function canPlaceWall(
  n: number,
  hWalls: boolean[][],
  vWalls: boolean[][],
  p0Pos: CorridorCoord,
  p1Pos: CorridorCoord,
  orientation: 'h' | 'v',
  row: number,
  col: number
): boolean {
  const wallN = n - 1;
  if (row < 0 || row >= wallN || col < 0 || col >= wallN) return false;

  if (orientation === 'h') {
    if (hWalls[row][col] || vWalls[row][col]) return false;
    if (col > 0 && hWalls[row][col - 1]) return false;
    if (col < wallN - 1 && hWalls[row][col + 1]) return false;

    hWalls[row][col] = true;
    const ok =
      shortestPathToRow(n, hWalls, vWalls, p0Pos, 0) !== null &&
      shortestPathToRow(n, hWalls, vWalls, p1Pos, n - 1) !== null;
    hWalls[row][col] = false;
    return ok;
  } else {
    if (vWalls[row][col] || hWalls[row][col]) return false;
    if (row > 0 && vWalls[row - 1][col]) return false;
    if (row < wallN - 1 && vWalls[row + 1][col]) return false;

    vWalls[row][col] = true;
    const ok =
      shortestPathToRow(n, hWalls, vWalls, p0Pos, 0) !== null &&
      shortestPathToRow(n, hWalls, vWalls, p1Pos, n - 1) !== null;
    vWalls[row][col] = false;
    return ok;
  }
}

function cloneGrid(grid: boolean[][]): boolean[][] {
  return grid.map((row) => [...row]);
}

export function initCorridor(
  playersInfo: PlayerInfo[],
  rules: CorridorRules
): CorridorInternalState {
  const n: 7 | 9 = rules.boardSize === 7 ? 7 : 9;
  const wallsPerPlayer: 6 | 10 = rules.wallsPerPlayer === 6 ? 6 : 10;
  const mid = Math.floor(n / 2);

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

  const wallN = n - 1;
  const hWalls = Array.from({ length: wallN }, () => Array<boolean>(wallN).fill(false));
  const vWalls = Array.from({ length: wallN }, () => Array<boolean>(wallN).fill(false));

  return {
    rules: { boardSize: n, wallsPerPlayer },
    boardSize: n,
    players: [
      {
        id: p0.id,
        name: p0.name,
        isBot: p0.isBot,
        side: 0,
        pos: { row: n - 1, col: mid },
        wallsLeft: wallsPerPlayer,
      },
      {
        id: p1.id,
        name: p1.name,
        isBot: p1.isBot,
        side: 1,
        pos: { row: 0, col: mid },
        wallsLeft: wallsPerPlayer,
      },
    ],
    hWalls,
    vWalls,
    turnIndex: 0,
    moveCount: 0,
    lastAction: null,
    winnerId: null,
    phase: 'playing',
    lastLog: `${p0.name} の先手でレース開始！（上端ゴールを目指せ）`,
  };
}

export function applyCorridorAction(
  state: CorridorInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: CorridorInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: '対局はすでに終了しています' };
  }

  const current = state.players[state.turnIndex];
  if (current.id !== playerId) {
    return { state, error: 'あなたの手番ではありません' };
  }

  const n = state.boardSize;
  const side = current.side;
  const oppSide: 0 | 1 = side === 0 ? 1 : 0;
  const opponent = state.players[oppSide];

  if (action.type === 'move') {
    const payload = action.payload as { row?: unknown; col?: unknown } | undefined;
    if (!payload || !isValidInt(payload.row, 0, n) || !isValidInt(payload.col, 0, n)) {
      return { state, error: '移動座標が不正です' };
    }
    const { row, col } = payload;
    const legal = getValidPawnMoves(n, state.hWalls, state.vWalls, current.pos, opponent.pos);
    if (!legal.some((m) => m.row === row && m.col === col)) {
      return { state, error: 'そこへは移動できません' };
    }

    const from = { ...current.pos };
    const nextPlayers: [CorridorPlayerState, CorridorPlayerState] = [
      { ...state.players[0], pos: { ...state.players[0].pos } },
      { ...state.players[1], pos: { ...state.players[1].pos } },
    ];
    nextPlayers[side].pos = { row, col };

    const goalRow = side === 0 ? 0 : n - 1;
    const reachedGoal = row === goalRow;

    if (reachedGoal) {
      return {
        state: {
          ...state,
          players: nextPlayers,
          moveCount: state.moveCount + 1,
          lastAction: { kind: 'move', side, from, to: { row, col } },
          winnerId: current.id,
          phase: 'finished',
          lastLog: `${current.name} がゴールに到達し勝利！`,
        },
      };
    }

    return {
      state: {
        ...state,
        players: nextPlayers,
        turnIndex: oppSide,
        moveCount: state.moveCount + 1,
        lastAction: { kind: 'move', side, from, to: { row, col } },
        lastLog: `${current.name} が駒を進めました`,
      },
    };
  }

  if (action.type === 'placeWall') {
    const payload = action.payload as
      | { orientation?: unknown; row?: unknown; col?: unknown }
      | undefined;
    const wallN = n - 1;
    if (
      !payload ||
      (payload.orientation !== 'h' && payload.orientation !== 'v') ||
      !isValidInt(payload.row, 0, wallN) ||
      !isValidInt(payload.col, 0, wallN)
    ) {
      return { state, error: '壁の配置パラメータが不正です' };
    }
    if (current.wallsLeft <= 0) {
      return { state, error: '残りの壁がありません' };
    }

    const { orientation, row, col } = payload;
    const nextH = cloneGrid(state.hWalls);
    const nextV = cloneGrid(state.vWalls);

    if (
      !canPlaceWall(
        n,
        nextH,
        nextV,
        state.players[0].pos,
        state.players[1].pos,
        orientation,
        row,
        col
      )
    ) {
      return { state, error: '重なり・交差または完全封鎖となるため壁を置けません' };
    }

    if (orientation === 'h') nextH[row][col] = true;
    else nextV[row][col] = true;

    const nextPlayers: [CorridorPlayerState, CorridorPlayerState] = [
      { ...state.players[0], pos: { ...state.players[0].pos } },
      { ...state.players[1], pos: { ...state.players[1].pos } },
    ];
    nextPlayers[side].wallsLeft -= 1;

    return {
      state: {
        ...state,
        players: nextPlayers,
        hWalls: nextH,
        vWalls: nextV,
        turnIndex: oppSide,
        moveCount: state.moveCount + 1,
        lastAction: { kind: 'wall', side, orientation, row, col },
        lastLog: `${current.name} が${orientation === 'h' ? '横壁' : '縦壁'}を置きました（残${nextPlayers[side].wallsLeft}）`,
      },
    };
  }

  return { state, error: '未対応のアクションです' };
}

export function sanitizeCorridorState(
  state: CorridorInternalState,
  playerId: string
): CorridorClientState {
  const n = state.boardSize;
  const current = state.players[state.turnIndex];
  const opponent = state.players[state.turnIndex === 0 ? 1 : 0];
  const isTurnPlayer = state.phase === 'playing' && current.id === playerId;

  const validMoves = isTurnPlayer
    ? getValidPawnMoves(n, state.hWalls, state.vWalls, current.pos, opponent.pos)
    : [];

  const validHWalls: CorridorCoord[] = [];
  const validVWalls: CorridorCoord[] = [];

  if (isTurnPlayer && current.wallsLeft > 0) {
    const hCopy = cloneGrid(state.hWalls);
    const vCopy = cloneGrid(state.vWalls);
    const wallN = n - 1;
    for (let r = 0; r < wallN; r++) {
      for (let c = 0; c < wallN; c++) {
        if (
          canPlaceWall(
            n,
            hCopy,
            vCopy,
            state.players[0].pos,
            state.players[1].pos,
            'h',
            r,
            c
          )
        ) {
          validHWalls.push({ row: r, col: c });
        }
        if (
          canPlaceWall(
            n,
            hCopy,
            vCopy,
            state.players[0].pos,
            state.players[1].pos,
            'v',
            r,
            c
          )
        ) {
          validVWalls.push({ row: r, col: c });
        }
      }
    }
  }

  return {
    ...state,
    myId: playerId,
    validMoves,
    validHWalls,
    validVWalls,
  };
}

export function computeCorridorBotAction(
  state: CorridorInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  const bot = state.players[state.turnIndex];
  if (!bot.isBot) return null;

  const n = state.boardSize;
  const botSide = bot.side;
  const oppSide: 0 | 1 = botSide === 0 ? 1 : 0;
  const opp = state.players[oppSide];
  const botGoalRow = botSide === 0 ? 0 : n - 1;
  const oppGoalRow = oppSide === 0 ? 0 : n - 1;

  const legalMoves = getValidPawnMoves(n, state.hWalls, state.vWalls, bot.pos, opp.pos);
  if (legalMoves.length === 0) return null;

  // 1. 即ゴールできるなら迷わず移動
  const winMove = legalMoves.find((m) => m.row === botGoalRow);
  if (winMove) {
    return { type: 'move', payload: { row: winMove.row, col: winMove.col } };
  }

  const curMyDist = shortestPathToRow(n, state.hWalls, state.vWalls, bot.pos, botGoalRow) ?? 99;
  const curOppDist = shortestPathToRow(n, state.hWalls, state.vWalls, opp.pos, oppGoalRow) ?? 99;
  const curDiff = curOppDist - curMyDist;

  // 最短経路へ進む最良の駒移動候補を先に算出
  let bestMove = legalMoves[0];
  let bestMoveDist = Infinity;
  for (const m of legalMoves) {
    const d = shortestPathToRow(n, state.hWalls, state.vWalls, m, botGoalRow) ?? 99;
    const centerBias = Math.abs(m.col - Math.floor(n / 2)) * 0.05;
    const score = d + centerBias + Math.random() * 0.02;
    if (score < bestMoveDist) {
      bestMoveDist = score;
      bestMove = m;
    }
  }

  // 2. 壁が残っていて相手が有利・またはゴール目前のとき、相手を最も遠回りさせる壁を検討
  if (bot.wallsLeft > 0 && (curOppDist <= curMyDist || curOppDist <= 3)) {
    const hCopy = cloneGrid(state.hWalls);
    const vCopy = cloneGrid(state.vWalls);
    const wallN = n - 1;

    let bestWall: { orientation: 'h' | 'v'; row: number; col: number } | null = null;
    let bestWallGain = 0;

    for (const orientation of ['h', 'v'] as const) {
      for (let r = 0; r < wallN; r++) {
        for (let c = 0; c < wallN; c++) {
          // 高速幾何チェック
          if (hCopy[r][c] || vCopy[r][c]) continue;
          if (orientation === 'h') {
            if ((c > 0 && hCopy[r][c - 1]) || (c < wallN - 1 && hCopy[r][c + 1])) continue;
            hCopy[r][c] = true;
          } else {
            if ((r > 0 && vCopy[r - 1][c]) || (r < wallN - 1 && vCopy[r + 1][c])) continue;
            vCopy[r][c] = true;
          }

          const newMyDist = shortestPathToRow(n, hCopy, vCopy, bot.pos, botGoalRow);
          const newOppDist = shortestPathToRow(n, hCopy, vCopy, opp.pos, oppGoalRow);

          if (orientation === 'h') hCopy[r][c] = false;
          else vCopy[r][c] = false;

          if (newMyDist === null || newOppDist === null) continue;

          const newDiff = newOppDist - newMyDist;
          const gain = newDiff - curDiff;

          // 相手を明確に遠回りさせられる壁だけ評価
          if (newOppDist > curOppDist && gain > bestWallGain) {
            // 相手駒に近い壁に微ボーナス
            const prox =
              Math.abs(r - opp.pos.row) + Math.abs(c - opp.pos.col) <= 2 ? 0.15 : 0;
            const adjustedGain = gain + prox + Math.random() * 0.05;
            if (adjustedGain > bestWallGain) {
              bestWallGain = adjustedGain;
              bestWall = { orientation, row: r, col: c };
            }
          }
        }
      }
    }

    const threshold = curOppDist <= 2 ? 1 : 2;
    if (bestWall && bestWallGain >= threshold) {
      return {
        type: 'placeWall',
        payload: bestWall,
      };
    }
  }

  return { type: 'move', payload: { row: bestMove.row, col: bestMove.col } };
}
