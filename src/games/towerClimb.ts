import type { PlayerInfo, TowerClimbRules } from '../types/game';

export interface TowerCoord {
  row: number;
  col: number;
}

export interface TowerWorker {
  id: string;
  owner: 0 | 1;
  row: number;
  col: number;
}

export interface TowerClimbPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  side: 0 | 1;
}

export type TowerClimbSubPhase = 'place' | 'move' | 'build';

export interface TowerClimbInternalState {
  rules: TowerClimbRules;
  players: [TowerClimbPlayerState, TowerClimbPlayerState];
  heights: number[][]; // 5x5, 0..4 (4 = dome)
  workers: TowerWorker[];
  turnIndex: 0 | 1;
  subPhase: TowerClimbSubPhase;
  movedWorkerId: string | null;
  moveCount: number;
  lastCoord: TowerCoord | null;
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface TowerClimbClientState extends TowerClimbInternalState {
  myId: string;
  validMovesByWorker: Record<string, TowerCoord[]>;
  validBuilds: TowerCoord[];
}

const BOARD_SIZE = 5;

const ALL_8_DIRS: readonly [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

function isValidCoord(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < BOARD_SIZE;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function hasWorkerAt(workers: TowerWorker[], r: number, c: number): boolean {
  return workers.some((w) => w.row === r && w.col === c);
}

export function getValidWorkerMoves(
  heights: number[][],
  workers: TowerWorker[],
  worker: TowerWorker
): TowerCoord[] {
  const fromH = heights[worker.row][worker.col];
  const res: TowerCoord[] = [];
  for (const [dr, dc] of ALL_8_DIRS) {
    const nr = worker.row + dr;
    const nc = worker.col + dc;
    if (!inBounds(nr, nc)) continue;
    if (hasWorkerAt(workers, nr, nc)) continue;
    const toH = heights[nr][nc];
    if (toH >= 4) continue;
    if (toH <= fromH + 1) {
      res.push({ row: nr, col: nc });
    }
  }
  return res;
}

export function getValidBuilds(
  heights: number[][],
  workers: TowerWorker[],
  worker: TowerWorker,
  enableDome: boolean
): TowerCoord[] {
  const maxBuildable = enableDome ? 4 : 3;
  const res: TowerCoord[] = [];
  for (const [dr, dc] of ALL_8_DIRS) {
    const nr = worker.row + dr;
    const nc = worker.col + dc;
    if (!inBounds(nr, nc)) continue;
    if (hasWorkerAt(workers, nr, nc)) continue;
    if (heights[nr][nc] < maxBuildable) {
      res.push({ row: nr, col: nc });
    }
  }
  return res;
}

function hasAnyLegalMove(
  heights: number[][],
  workers: TowerWorker[],
  side: 0 | 1
): boolean {
  for (const w of workers) {
    if (w.owner !== side) continue;
    if (getValidWorkerMoves(heights, workers, w).length > 0) {
      return true;
    }
  }
  return false;
}

export function initTowerClimb(
  playersInfo: PlayerInfo[],
  rules: TowerClimbRules
): TowerClimbInternalState {
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

  const heights = Array.from({ length: BOARD_SIZE }, () =>
    Array<number>(BOARD_SIZE).fill(0)
  );

  return {
    rules: { enableDome: rules.enableDome ?? true },
    players: [
      { id: p0.id, name: p0.name, isBot: p0.isBot, side: 0 },
      { id: p1.id, name: p1.name, isBot: p1.isBot, side: 1 },
    ],
    heights,
    workers: [],
    turnIndex: 0,
    subPhase: 'place',
    movedWorkerId: null,
    moveCount: 0,
    lastCoord: null,
    winnerId: null,
    phase: 'playing',
    lastLog: `${p0.name} が1体目のワーカーを配置してください`,
  };
}

export function applyTowerClimbAction(
  state: TowerClimbInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: TowerClimbInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: '対局はすでに終了しています' };
  }

  const current = state.players[state.turnIndex];
  if (current.id !== playerId) {
    return { state, error: 'あなたの手番ではありません' };
  }

  const side = current.side;
  const oppSide: 0 | 1 = side === 0 ? 1 : 0;
  const opponent = state.players[oppSide];

  // 1. 初期配置フェーズ
  if (state.subPhase === 'place') {
    if (action.type !== 'placeWorker') {
      return { state, error: 'ワーカーを配置するフェーズです' };
    }
    const payload = action.payload as { row?: unknown; col?: unknown } | undefined;
    if (!payload || !isValidCoord(payload.row) || !isValidCoord(payload.col)) {
      return { state, error: '配置座標が不正です' };
    }
    const { row, col } = payload;
    if (hasWorkerAt(state.workers, row, col)) {
      return { state, error: 'そのマスにはすでにワーカーがいます' };
    }

    const myCount = state.workers.filter((w) => w.owner === side).length;
    const newWorker: TowerWorker = {
      id: `p${side}-w${myCount}`,
      owner: side,
      row,
      col,
    };
    const nextWorkers = [...state.workers, newWorker];

    if (nextWorkers.length >= 4) {
      return {
        state: {
          ...state,
          workers: nextWorkers,
          turnIndex: 0,
          subPhase: 'move',
          movedWorkerId: null,
          lastCoord: { row, col },
          lastLog: `全員の配置が完了！ ${state.players[0].name} がワーカーを移動してください`,
        },
      };
    }

    const nextTurn: 0 | 1 = oppSide;
    const nextPlayer = state.players[nextTurn];
    const nextNum = nextWorkers.filter((w) => w.owner === nextTurn).length + 1;

    return {
      state: {
        ...state,
        workers: nextWorkers,
        turnIndex: nextTurn,
        lastCoord: { row, col },
        lastLog: `${current.name} が配置完了 → ${nextPlayer.name} の${nextNum}体目を配置`,
      },
    };
  }

  // 2. 移動フェーズ
  if (state.subPhase === 'move') {
    if (action.type !== 'moveWorker') {
      return { state, error: 'ワーカーを移動するフェーズです' };
    }
    const payload = action.payload as
      | { workerId?: unknown; toRow?: unknown; toCol?: unknown }
      | undefined;
    if (
      !payload ||
      typeof payload.workerId !== 'string' ||
      !isValidCoord(payload.toRow) ||
      !isValidCoord(payload.toCol)
    ) {
      return { state, error: '移動パラメータが不正です' };
    }

    const worker = state.workers.find((w) => w.id === payload.workerId);
    if (!worker || worker.owner !== side) {
      return { state, error: '自分のワーカーを選択してください' };
    }

    const legalMoves = getValidWorkerMoves(state.heights, state.workers, worker);
    if (!legalMoves.some((m) => m.row === payload.toRow && m.col === payload.toCol)) {
      return { state, error: 'そのマスへは移動できません' };
    }

    const nextWorkers = state.workers.map((w) =>
      w.id === worker.id ? { ...w, row: payload.toRow as number, col: payload.toCol as number } : { ...w }
    );
    const movedWorker = nextWorkers.find((w) => w.id === worker.id)!;

    // 3段目に到達したら即勝利！
    if (state.heights[movedWorker.row][movedWorker.col] === 3) {
      return {
        state: {
          ...state,
          workers: nextWorkers,
          moveCount: state.moveCount + 1,
          movedWorkerId: null,
          lastCoord: { row: movedWorker.row, col: movedWorker.col },
          winnerId: current.id,
          phase: 'finished',
          lastLog: `${current.name} が3段目の頂上に到達して勝利！`,
        },
      };
    }

    // 移動後に建築できるマスが1つもない場合は手詰まり敗北
    const builds = getValidBuilds(
      state.heights,
      nextWorkers,
      movedWorker,
      state.rules.enableDome
    );
    if (builds.length === 0) {
      return {
        state: {
          ...state,
          workers: nextWorkers,
          moveCount: state.moveCount + 1,
          movedWorkerId: null,
          lastCoord: { row: movedWorker.row, col: movedWorker.col },
          winnerId: opponent.id,
          phase: 'finished',
          lastLog: `${current.name} は建築できるマスがなく手詰まり！ ${opponent.name} の勝利！`,
        },
      };
    }

    return {
      state: {
        ...state,
        workers: nextWorkers,
        subPhase: 'build',
        movedWorkerId: movedWorker.id,
        lastCoord: { row: movedWorker.row, col: movedWorker.col },
        lastLog: `${current.name} が移動完了 → 周囲のマスに1段建築してください`,
      },
    };
  }

  // 3. 建築フェーズ
  if (state.subPhase === 'build') {
    if (action.type !== 'build') {
      return { state, error: '建築するフェーズです' };
    }
    const payload = action.payload as { row?: unknown; col?: unknown } | undefined;
    if (!payload || !isValidCoord(payload.row) || !isValidCoord(payload.col)) {
      return { state, error: '建築座標が不正です' };
    }
    const movedWorker = state.workers.find((w) => w.id === state.movedWorkerId);
    if (!movedWorker || movedWorker.owner !== side) {
      return { state, error: '建築元のワーカーが見つかりません' };
    }

    const legalBuilds = getValidBuilds(
      state.heights,
      state.workers,
      movedWorker,
      state.rules.enableDome
    );
    if (!legalBuilds.some((b) => b.row === payload.row && b.col === payload.col)) {
      return { state, error: 'そのマスには建築できません' };
    }

    const nextHeights = state.heights.map((r) => [...r]);
    nextHeights[payload.row][payload.col] += 1;
    const builtH = nextHeights[payload.row][payload.col];

    // 次の手番プレイヤー（相手）に合法移動が1つもなければ手詰まり勝利！
    if (!hasAnyLegalMove(nextHeights, state.workers, oppSide)) {
      return {
        state: {
          ...state,
          heights: nextHeights,
          turnIndex: oppSide,
          subPhase: 'move',
          movedWorkerId: null,
          moveCount: state.moveCount + 1,
          lastCoord: { row: payload.row, col: payload.col },
          winnerId: current.id,
          phase: 'finished',
          lastLog: `${opponent.name} が移動できず手詰まり！ ${current.name} の勝利！`,
        },
      };
    }

    const builtLabel = builtH === 4 ? 'ドームで封鎖' : `${builtH}段目を建築`;
    return {
      state: {
        ...state,
        heights: nextHeights,
        turnIndex: oppSide,
        subPhase: 'move',
        movedWorkerId: null,
        moveCount: state.moveCount + 1,
        lastCoord: { row: payload.row, col: payload.col },
        lastLog: `${current.name} が${builtLabel}しました`,
      },
    };
  }

  return { state, error: '不正なフェーズです' };
}

export function sanitizeTowerClimbState(
  state: TowerClimbInternalState,
  playerId: string
): TowerClimbClientState {
  const current = state.players[state.turnIndex];
  const isTurnPlayer = state.phase === 'playing' && current.id === playerId;

  const validMovesByWorker: Record<string, TowerCoord[]> = {};
  let validBuilds: TowerCoord[] = [];

  if (isTurnPlayer && state.subPhase === 'move') {
    for (const w of state.workers) {
      if (w.owner === current.side) {
        validMovesByWorker[w.id] = getValidWorkerMoves(state.heights, state.workers, w);
      }
    }
  } else if (isTurnPlayer && state.subPhase === 'build' && state.movedWorkerId) {
    const moved = state.workers.find((w) => w.id === state.movedWorkerId);
    if (moved) {
      validBuilds = getValidBuilds(
        state.heights,
        state.workers,
        moved,
        state.rules.enableDome
      );
    }
  }

  return {
    ...state,
    myId: playerId,
    validMovesByWorker,
    validBuilds,
  };
}

function isAdjacent(r1: number, c1: number, r2: number, c2: number): boolean {
  return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1 && !(r1 === r2 && c1 === c2);
}

function canOppWinNextTurn(
  heights: number[][],
  workers: TowerWorker[],
  oppSide: 0 | 1
): boolean {
  for (const w of workers) {
    if (w.owner !== oppSide) continue;
    if (heights[w.row][w.col] !== 2) continue;
    const moves = getValidWorkerMoves(heights, workers, w);
    if (moves.some((m) => heights[m.row][m.col] === 3)) {
      return true;
    }
  }
  return false;
}

export function computeTowerClimbBotAction(
  state: TowerClimbInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  const bot = state.players[state.turnIndex];
  if (!bot.isBot) return null;

  const botSide = bot.side;
  const oppSide: 0 | 1 = botSide === 0 ? 1 : 0;

  // 1. 初期配置
  if (state.subPhase === 'place') {
    const candidates: { row: number; col: number; score: number }[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (hasWorkerAt(state.workers, r, c)) continue;
        const centerDist = Math.abs(r - 2) + Math.abs(c - 2);
        const score = 10 - centerDist * 2.5 + Math.random() * 1.5;
        candidates.push({ row: r, col: c, score });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const pick = candidates[0];
    if (!pick) return null;
    return { type: 'placeWorker', payload: { row: pick.row, col: pick.col } };
  }

  // 2. 移動フェーズ
  if (state.subPhase === 'move') {
    const myWorkers = state.workers.filter((w) => w.owner === botSide);
    let bestMove: { workerId: string; toRow: number; toCol: number } | null = null;
    let bestScore = -Infinity;

    for (const w of myWorkers) {
      const moves = getValidWorkerMoves(state.heights, state.workers, w);
      for (const m of moves) {
        // 即勝利チェック（高さ3へ登る）
        if (state.heights[m.row][m.col] === 3) {
          return {
            type: 'moveWorker',
            payload: { workerId: w.id, toRow: m.row, toCol: m.col },
          };
        }

        const nextWorkers = state.workers.map((x) =>
          x.id === w.id ? { ...x, row: m.row, col: m.col } : x
        );
        const movedW = nextWorkers.find((x) => x.id === w.id)!;
        const builds = getValidBuilds(
          state.heights,
          nextWorkers,
          movedW,
          state.rules.enableDome
        );
        if (builds.length === 0) continue;

        const fromH = state.heights[w.row][w.col];
        const toH = state.heights[m.row][m.col];

        // 相手が2段目にいて3段目リーチを持っている場合、それをドーム封鎖できる位置への移動を高評価
        let bestBuildBonus = -Infinity;
        for (const b of builds) {
          const nextH = state.heights.map((row) => [...row]);
          nextH[b.row][b.col] += 1;
          let bScore = 0;
          if (!hasAnyLegalMove(nextH, nextWorkers, oppSide)) {
            bScore += 5000;
          }
          if (canOppWinNextTurn(nextH, nextWorkers, oppSide)) {
            bScore -= 2000;
          }
          // 自分が2段目にいて周囲に3段目を作れた場合
          if (toH === 2 && nextH[b.row][b.col] === 3) {
            bScore += 45;
          }
          if (bScore > bestBuildBonus) bestBuildBonus = bScore;
        }

        const centerBonus = (4 - (Math.abs(m.row - 2) + Math.abs(m.col - 2))) * 2;
        const heightScore = toH * 28 + (toH > fromH ? 14 : 0);
        const score = heightScore + centerBonus + bestBuildBonus + Math.random() * 2;

        if (score > bestScore) {
          bestScore = score;
          bestMove = { workerId: w.id, toRow: m.row, toCol: m.col };
        }
      }
    }

    if (!bestMove) return null;
    return { type: 'moveWorker', payload: bestMove };
  }

  // 3. 建築フェーズ
  if (state.subPhase === 'build' && state.movedWorkerId) {
    const moved = state.workers.find((w) => w.id === state.movedWorkerId);
    if (!moved) return null;
    const builds = getValidBuilds(
      state.heights,
      state.workers,
      moved,
      state.rules.enableDome
    );
    if (builds.length === 0) return null;

    const oppWorkers = state.workers.filter((w) => w.owner === oppSide);
    const myWorkers = state.workers.filter((w) => w.owner === botSide);

    let bestBuild = builds[0];
    let bestScore = -Infinity;

    for (const b of builds) {
      const nextH = state.heights.map((row) => [...row]);
      const prevLevel = nextH[b.row][b.col];
      nextH[b.row][b.col] = prevLevel + 1;
      const newLevel = nextH[b.row][b.col];

      let score = 0;

      // 相手を手詰まりにできるなら最優先
      if (!hasAnyLegalMove(nextH, state.workers, oppSide)) {
        return { type: 'build', payload: { row: b.row, col: b.col } };
      }

      // 建築後に相手が次ターン即勝利できる状態なら大減点
      if (canOppWinNextTurn(nextH, state.workers, oppSide)) {
        score -= 3000;
      }

      // 相手が高さ2で隣接している3段目にドームを置く（封鎖）のは最高の一手
      if (newLevel === 4) {
        const oppThreatened = oppWorkers.some(
          (ow) => state.heights[ow.row][ow.col] === 2 && isAdjacent(ow.row, ow.col, b.row, b.col)
        );
        score += oppThreatened ? 500 : 10;
      } else if (newLevel === 3) {
        const myAdj2 = myWorkers.some(
          (mw) => state.heights[mw.row][mw.col] === 2 && isAdjacent(mw.row, mw.col, b.row, b.col)
        );
        const oppAdj2 = oppWorkers.some(
          (ow) => state.heights[ow.row][ow.col] === 2 && isAdjacent(ow.row, ow.col, b.row, b.col)
        );
        if (myAdj2 && !oppAdj2) score += 90;
        if (oppAdj2) score -= 400;
      } else if (newLevel === 2) {
        const myAdj12 = myWorkers.some(
          (mw) => state.heights[mw.row][mw.col] >= 1 && isAdjacent(mw.row, mw.col, b.row, b.col)
        );
        score += myAdj12 ? 32 : 8;
      } else {
        score += 12;
      }

      // 中央寄りボーナス
      score += (4 - (Math.abs(b.row - 2) + Math.abs(b.col - 2))) * 2;
      score += Math.random() * 1.5;

      if (score > bestScore) {
        bestScore = score;
        bestBuild = b;
      }
    }

    return { type: 'build', payload: { row: bestBuild.row, col: bestBuild.col } };
  }

  return null;
}
