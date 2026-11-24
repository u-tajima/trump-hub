import type { IgoRules, PlayerInfo } from '../types/game';

export type IgoCell = 0 | 1 | 2; // 0: 空, 1: 黒(先手), 2: 白(後手)

export interface IgoPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  color: 1 | 2;
  captures: number;
  scoringAgreed: boolean;
}

export interface IgoScoreSummary {
  blackStones: number;
  whiteStones: number;
  blackTerritory: number;
  whiteTerritory: number;
  blackTotal: number;
  whiteTotal: number;
  komi: number;
  deadKeys: string[];
}

export interface IgoInternalState {
  rules: IgoRules;
  players: [IgoPlayerState, IgoPlayerState];
  board: IgoCell[][];
  turnIndex: 0 | 1;
  consecutivePasses: number;
  koPoint: { row: number; col: number } | null;
  boardHistory: string[];
  lastMove: { row: number; col: number; pass?: boolean } | null;
  subPhase: 'play' | 'scoring';
  deadStones: string[];
  scoreSummary: IgoScoreSummary | null;
  winnerId: string | 'draw' | null;
  finishReason: 'score' | 'resign' | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface IgoClientState extends IgoInternalState {
  myId: string;
}

export interface CanPlaceIgoResult {
  ok: boolean;
  reason?: string;
  capturedCount?: number;
  nextBoard?: IgoCell[][];
  nextBoardKey?: string;
  koPoint?: { row: number; col: number } | null;
}

const ORTHO_DIRS: readonly [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const DIAG_DIRS: readonly [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

function coordKey(row: number, col: number): string {
  return `${row},${col}`;
}

function serializeBoard(board: IgoCell[][]): string {
  let out = '';
  for (let r = 0; r < board.length; r++) {
    const row = board[r];
    for (let c = 0; c < row.length; c++) {
      out += row[c];
    }
  }
  return out;
}

function cloneBoard(board: IgoCell[][]): IgoCell[][] {
  return board.map((row) => [...row]);
}

function roundHalf(value: number): number {
  return Math.round(value * 10) / 10;
}

interface GroupInfo {
  stones: { row: number; col: number }[];
  liberties: number;
  libertyKeys: Set<string>;
}

function getGroupAndLiberties(board: IgoCell[][], startRow: number, startCol: number): GroupInfo {
  const n = board.length;
  const color = board[startRow][startCol];
  if (color === 0) {
    return { stones: [], liberties: 0, libertyKeys: new Set() };
  }

  const visited = new Set<string>();
  const libertyKeys = new Set<string>();
  const stones: { row: number; col: number }[] = [];
  const queue: { row: number; col: number }[] = [{ row: startRow, col: startCol }];
  visited.add(coordKey(startRow, startCol));

  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    stones.push(cur);

    for (const [dr, dc] of ORTHO_DIRS) {
      const nr = cur.row + dr;
      const nc = cur.col + dc;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;

      const cell = board[nr][nc];
      const key = coordKey(nr, nc);
      if (cell === 0) {
        libertyKeys.add(key);
      } else if (cell === color && !visited.has(key)) {
        visited.add(key);
        queue.push({ row: nr, col: nc });
      }
    }
  }

  return { stones, liberties: libertyKeys.size, libertyKeys };
}

export function initIgo(playersInfo: PlayerInfo[], rules: IgoRules): IgoInternalState {
  const n = rules.boardSize;
  const board: IgoCell[][] = Array.from({ length: n }, () => Array<IgoCell>(n).fill(0));
  const players: [IgoPlayerState, IgoPlayerState] = [
    {
      id: playersInfo[0].id,
      name: playersInfo[0].name,
      isBot: playersInfo[0].isBot,
      color: 1,
      captures: 0,
      scoringAgreed: false,
    },
    {
      id: playersInfo[1].id,
      name: playersInfo[1].name,
      isBot: playersInfo[1].isBot,
      color: 2,
      captures: 0,
      scoringAgreed: false,
    },
  ];

  return {
    rules,
    players,
    board,
    turnIndex: 0,
    consecutivePasses: 0,
    koPoint: null,
    boardHistory: [serializeBoard(board)],
    lastMove: null,
    subPhase: 'play',
    deadStones: [],
    scoreSummary: null,
    winnerId: null,
    finishReason: null,
    phase: 'playing',
    lastLog: `${players[0].name}（黒・先手）から対局開始`,
  };
}

export function canPlaceIgoStone(
  state: IgoInternalState,
  row: number,
  col: number,
  color: 1 | 2
): CanPlaceIgoResult {
  const n = state.board.length;
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= n || col < 0 || col >= n) {
    return { ok: false, reason: '盤外の座標です' };
  }
  if (state.board[row][col] !== 0) {
    return { ok: false, reason: 'すでに石が置かれています' };
  }
  if (state.koPoint && state.koPoint.row === row && state.koPoint.col === col) {
    return { ok: false, reason: 'コウの直後は取り返せません' };
  }

  const opp: 1 | 2 = color === 1 ? 2 : 1;
  const nextBoard = cloneBoard(state.board);
  nextBoard[row][col] = color;

  const capturedStones: { row: number; col: number }[] = [];
  const checkedOpp = new Set<string>();

  for (const [dr, dc] of ORTHO_DIRS) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
    if (nextBoard[nr][nc] !== opp) continue;

    const key = coordKey(nr, nc);
    if (checkedOpp.has(key)) continue;

    const group = getGroupAndLiberties(nextBoard, nr, nc);
    for (const s of group.stones) {
      checkedOpp.add(coordKey(s.row, s.col));
    }
    if (group.liberties === 0) {
      for (const s of group.stones) {
        nextBoard[s.row][s.col] = 0;
        capturedStones.push(s);
      }
    }
  }

  const ownGroup = getGroupAndLiberties(nextBoard, row, col);
  if (capturedStones.length === 0 && ownGroup.liberties === 0) {
    return { ok: false, reason: '自殺手は打てません' };
  }

  const nextBoardKey = serializeBoard(nextBoard);
  if (state.rules.superko && state.boardHistory.includes(nextBoardKey)) {
    return { ok: false, reason: 'スーパーコウ（同形反復）禁止です' };
  }

  // 単純コウ判定: 単石でちょうど1子を取り、その結果自分の単石の呼吸点がちょうど1（取り上げた点のみ）になった場合
  let nextKoPoint: { row: number; col: number } | null = null;
  if (capturedStones.length === 1 && ownGroup.stones.length === 1 && ownGroup.liberties === 1) {
    const cap = capturedStones[0];
    if (ownGroup.libertyKeys.has(coordKey(cap.row, cap.col))) {
      nextKoPoint = { row: cap.row, col: cap.col };
    }
  }

  return {
    ok: true,
    capturedCount: capturedStones.length,
    nextBoard,
    nextBoardKey,
    koPoint: nextKoPoint,
  };
}

export function computeIgoScore(
  board: IgoCell[][],
  deadStones: string[],
  komi: number
): IgoScoreSummary {
  const n = board.length;
  const deadSet = new Set(deadStones);
  const validDeadKeys: string[] = [];

  const evalBoard: IgoCell[][] = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => {
      const cell = board[r][c];
      const key = coordKey(r, c);
      if (cell !== 0 && deadSet.has(key)) {
        validDeadKeys.push(key);
        return 0;
      }
      return cell;
    })
  );

  let blackStones = 0;
  let whiteStones = 0;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (evalBoard[r][c] === 1) blackStones++;
      else if (evalBoard[r][c] === 2) whiteStones++;
    }
  }

  let blackTerritory = 0;
  let whiteTerritory = 0;
  const visitedEmpty = new Set<string>();

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (evalBoard[r][c] !== 0) continue;
      const startKey = coordKey(r, c);
      if (visitedEmpty.has(startKey)) continue;

      let regionSize = 0;
      let touchesBlack = false;
      let touchesWhite = false;
      const queue: { row: number; col: number }[] = [{ row: r, col: c }];
      visitedEmpty.add(startKey);

      let head = 0;
      while (head < queue.length) {
        const cur = queue[head++];
        regionSize++;

        for (const [dr, dc] of ORTHO_DIRS) {
          const nr = cur.row + dr;
          const nc = cur.col + dc;
          if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;

          const neighbor = evalBoard[nr][nc];
          if (neighbor === 1) {
            touchesBlack = true;
          } else if (neighbor === 2) {
            touchesWhite = true;
          } else {
            const nKey = coordKey(nr, nc);
            if (!visitedEmpty.has(nKey)) {
              visitedEmpty.add(nKey);
              queue.push({ row: nr, col: nc });
            }
          }
        }
      }

      if (touchesBlack && !touchesWhite) {
        blackTerritory += regionSize;
      } else if (touchesWhite && !touchesBlack) {
        whiteTerritory += regionSize;
      }
    }
  }

  const blackTotal = roundHalf(blackStones + blackTerritory);
  const whiteTotal = roundHalf(whiteStones + whiteTerritory + komi);

  return {
    blackStones,
    whiteStones,
    blackTerritory,
    whiteTerritory,
    blackTotal,
    whiteTotal,
    komi,
    deadKeys: validDeadKeys,
  };
}

function formatCoordLabel(row: number, col: number, boardSize: number): string {
  const letters = 'ABCDEFGHJKLMNOPQRST'; // 囲碁標準座標（Iを除く）
  const colChar = letters[col] ?? String(col + 1);
  const rowNum = boardSize - row;
  return `${colChar}${rowNum}`;
}

export function applyIgoAction(
  state: IgoInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: IgoInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: '対局はすでに終了しています' };
  }

  const actorIdx = state.players.findIndex((p) => p.id === playerId);
  if (actorIdx === -1) {
    return { state, error: '参加していないプレイヤーです' };
  }

  // 投了（play / scoring どちらでも可能）
  if (action.type === 'resign') {
    const resigning = state.players[actorIdx];
    const winner = state.players[actorIdx === 0 ? 1 : 0];
    return {
      state: {
        ...state,
        winnerId: winner.id,
        finishReason: 'resign',
        phase: 'finished',
        lastLog: `${resigning.name} が投了。${winner.name} の中押し勝ち`,
      },
    };
  }

  // 死活確認・終局合意フェーズ
  if (state.subPhase === 'scoring') {
    if (action.type === 'toggleDead') {
      const payload = (action.payload as { row?: number; col?: number }) ?? {};
      const row = payload.row;
      const col = payload.col;
      const n = state.board.length;
      if (
        typeof row !== 'number' ||
        typeof col !== 'number' ||
        !Number.isInteger(row) ||
        !Number.isInteger(col) ||
        row < 0 ||
        row >= n ||
        col < 0 ||
        col >= n
      ) {
        return { state, error: '無効な座標です' };
      }
      if (state.board[row][col] === 0) {
        return { state, error: '石がある交点を指定してください' };
      }

      const group = getGroupAndLiberties(state.board, row, col);
      const clickedKey = coordKey(row, col);
      const deadSet = new Set(state.deadStones);
      const isCurrentlyDead = deadSet.has(clickedKey);

      for (const s of group.stones) {
        const key = coordKey(s.row, s.col);
        if (isCurrentlyDead) {
          deadSet.delete(key);
        } else {
          deadSet.add(key);
        }
      }

      const nextDeadStones = Array.from(deadSet);
      const nextScore = computeIgoScore(state.board, nextDeadStones, state.rules.komi);
      const nextPlayers: [IgoPlayerState, IgoPlayerState] = [
        { ...state.players[0], scoringAgreed: false },
        { ...state.players[1], scoringAgreed: false },
      ];

      return {
        state: {
          ...state,
          players: nextPlayers,
          deadStones: nextDeadStones,
          scoreSummary: nextScore,
          lastLog: isCurrentlyDead
            ? `${group.stones.length}子の死に石指定を解除しました`
            : `${group.stones.length}子を死に石に指定しました`,
        },
      };
    }

    if (action.type === 'confirmScore') {
      const payload = (action.payload as { forceAll?: boolean } | undefined) ?? {};
      const forceAll = payload.forceAll === true;

      const nextPlayers: [IgoPlayerState, IgoPlayerState] = [
        { ...state.players[0] },
        { ...state.players[1] },
      ];
      if (forceAll) {
        nextPlayers[0].scoringAgreed = true;
        nextPlayers[1].scoringAgreed = true;
      } else {
        nextPlayers[actorIdx].scoringAgreed = true;
      }

      const otherIdx = actorIdx === 0 ? 1 : 0;
      const bothAgreed =
        (nextPlayers[0].scoringAgreed && nextPlayers[1].scoringAgreed) ||
        (nextPlayers[actorIdx].scoringAgreed && nextPlayers[otherIdx].isBot);

      const summary =
        state.scoreSummary ?? computeIgoScore(state.board, state.deadStones, state.rules.komi);

      if (bothAgreed) {
        nextPlayers[0].scoringAgreed = true;
        nextPlayers[1].scoringAgreed = true;

        let winnerId: string | 'draw';
        let resultLog: string;
        const diff = roundHalf(Math.abs(summary.blackTotal - summary.whiteTotal));

        if (summary.blackTotal > summary.whiteTotal) {
          winnerId = nextPlayers[0].id;
          resultLog = `終局：黒 ${summary.blackTotal}目 対 白 ${summary.whiteTotal}目（黒の${diff}目勝ち）`;
        } else if (summary.whiteTotal > summary.blackTotal) {
          winnerId = nextPlayers[1].id;
          resultLog = `終局：黒 ${summary.blackTotal}目 対 白 ${summary.whiteTotal}目（白の${diff}目勝ち）`;
        } else {
          winnerId = 'draw';
          resultLog = `終局：黒 ${summary.blackTotal}目 対 白 ${summary.whiteTotal}目（持碁・引き分け）`;
        }

        return {
          state: {
            ...state,
            players: nextPlayers,
            scoreSummary: summary,
            winnerId,
            finishReason: 'score',
            phase: 'finished',
            lastLog: resultLog,
          },
        };
      }

      return {
        state: {
          ...state,
          players: nextPlayers,
          scoreSummary: summary,
          lastLog: `${nextPlayers[actorIdx].name} が終局に合意しました（相手の確認待ち）`,
        },
      };
    }

    if (action.type === 'resumePlay') {
      const nextPlayers: [IgoPlayerState, IgoPlayerState] = [
        { ...state.players[0], scoringAgreed: false },
        { ...state.players[1], scoringAgreed: false },
      ];
      return {
        state: {
          ...state,
          players: nextPlayers,
          subPhase: 'play',
          consecutivePasses: 0,
          koPoint: null,
          deadStones: [],
          scoreSummary: null,
          lastLog: `${nextPlayers[actorIdx].name} が対局を再開しました。次は ${nextPlayers[state.turnIndex].name} の手番`,
        },
      };
    }

    return { state, error: '死活確認フェーズではこの操作はできません' };
  }

  // 通常対局フェーズ (subPhase === 'play')
  const current = state.players[state.turnIndex];
  if (current.id !== playerId) {
    return { state, error: 'あなたの手番ではありません' };
  }

  if (action.type === 'pass') {
    const nextPasses = state.consecutivePasses + 1;
    const nextTurnIdx: 0 | 1 = state.turnIndex === 0 ? 1 : 0;

    if (nextPasses >= 2) {
      const summary = computeIgoScore(state.board, [], state.rules.komi);
      const nextPlayers: [IgoPlayerState, IgoPlayerState] = [
        { ...state.players[0], scoringAgreed: false },
        { ...state.players[1], scoringAgreed: false },
      ];
      return {
        state: {
          ...state,
          players: nextPlayers,
          turnIndex: nextTurnIdx,
          consecutivePasses: nextPasses,
          koPoint: null,
          lastMove: { row: -1, col: -1, pass: true },
          subPhase: 'scoring',
          deadStones: [],
          scoreSummary: summary,
          lastLog: '両者パスにより終局確認へ移行しました。死に石を指定して確定してください',
        },
      };
    }

    return {
      state: {
        ...state,
        turnIndex: nextTurnIdx,
        consecutivePasses: nextPasses,
        koPoint: null,
        lastMove: { row: -1, col: -1, pass: true },
        lastLog: `${current.name} がパス。次は ${state.players[nextTurnIdx].name} の手番`,
      },
    };
  }

  if (action.type === 'place') {
    const payload = (action.payload as { row?: number; col?: number }) ?? {};
    const row = payload.row;
    const col = payload.col;
    if (typeof row !== 'number' || typeof col !== 'number') {
      return { state, error: '座標が指定されていません' };
    }

    const check = canPlaceIgoStone(state, row, col, current.color);
    if (!check.ok || !check.nextBoard || !check.nextBoardKey) {
      return { state, error: check.reason ?? 'そこには打てません' };
    }

    const captured = check.capturedCount ?? 0;
    const nextPlayers: [IgoPlayerState, IgoPlayerState] = [
      { ...state.players[0] },
      { ...state.players[1] },
    ];
    nextPlayers[state.turnIndex].captures += captured;

    const nextTurnIdx: 0 | 1 = state.turnIndex === 0 ? 1 : 0;
    const label = formatCoordLabel(row, col, state.board.length);
    const captureMsg = captured > 0 ? `（${captured}子取り）` : '';

    return {
      state: {
        ...state,
        players: nextPlayers,
        board: check.nextBoard,
        turnIndex: nextTurnIdx,
        consecutivePasses: 0,
        koPoint: check.koPoint ?? null,
        boardHistory: [...state.boardHistory, check.nextBoardKey],
        lastMove: { row, col },
        lastLog: `${current.name} が ${label} に着手${captureMsg}。次は ${nextPlayers[nextTurnIdx].name}`,
      },
    };
  }

  return { state, error: '不明なアクションです' };
}

function isTrueEye(board: IgoCell[][], row: number, col: number, color: 1 | 2): boolean {
  const n = board.length;
  // 4近傍がすべて自分の石（盤外は許容）
  for (const [dr, dc] of ORTHO_DIRS) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < n && nc >= 0 && nc < n && board[nr][nc] !== color) {
      return false;
    }
  }

  // 斜め4近傍のうち盤内にあるものをチェック
  let inBoundsDiag = 0;
  let ownDiag = 0;
  for (const [dr, dc] of DIAG_DIRS) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < n && nc >= 0 && nc < n) {
      inBoundsDiag++;
      if (board[nr][nc] === color) {
        ownDiag++;
      }
    }
  }

  // 隅や辺（斜め盤内が1〜2）はすべて自石、中央（斜め盤内4）は3つ以上自石なら真眼とみなす
  if (inBoundsDiag <= 2) {
    return ownDiag === inBoundsDiag;
  }
  return ownDiag >= 3;
}

function getStarPointSet(n: number): Set<string> {
  const set = new Set<string>();
  if (n === 9) {
    const pts = [
      [2, 2],
      [2, 6],
      [6, 2],
      [6, 6],
      [4, 4],
    ];
    for (const [r, c] of pts) set.add(coordKey(r, c));
  } else if (n === 13) {
    const pts = [
      [3, 3],
      [3, 9],
      [9, 3],
      [9, 9],
      [6, 6],
    ];
    for (const [r, c] of pts) set.add(coordKey(r, c));
  } else if (n === 19) {
    const coords = [3, 9, 15];
    for (const r of coords) {
      for (const c of coords) {
        set.add(coordKey(r, c));
      }
    }
  }
  return set;
}

export function computeIgoBotAction(
  state: IgoInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;

  if (state.subPhase === 'scoring') {
    const pendingBot = state.players.find((p) => p.isBot && !p.scoringAgreed);
    if (pendingBot) {
      return { type: 'confirmScore' };
    }
    return null;
  }

  const bot = state.players[state.turnIndex];
  const color = bot.color;
  const opp: 1 | 2 = color === 1 ? 2 : 1;
  const n = state.board.length;
  const moveCount = Math.max(0, state.boardHistory.length - 1);
  const starSet = getStarPointSet(n);

  let stoneCount = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (state.board[r][c] !== 0) stoneCount++;
    }
  }

  // 盤面が十分進んだ後のパス上限目安
  const maxUsefulMoves = Math.floor(n * n * 1.45);
  if (moveCount >= maxUsefulMoves) {
    return { type: 'pass' };
  }

  // 着手前の隣接グループ情報キャッシュ（高速化）
  const beforeGroupCache = new Map<string, GroupInfo>();
  const getBeforeGroup = (r: number, c: number): GroupInfo => {
    const key = coordKey(r, c);
    const cached = beforeGroupCache.get(key);
    if (cached) return cached;
    const info = getGroupAndLiberties(state.board, r, c);
    for (const s of info.stones) {
      beforeGroupCache.set(coordKey(s.row, s.col), info);
    }
    return info;
  };

  let bestMove: { row: number; col: number } | null = null;
  let bestScore = -Infinity;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (state.board[r][c] !== 0) continue;

      // 自分の真眼は潰さない
      if (isTrueEye(state.board, r, c, color)) continue;

      const res = canPlaceIgoStone(state, r, c, color);
      if (!res.ok || !res.nextBoard) continue;

      let score = 0;
      const captured = res.capturedCount ?? 0;

      // 1. 相手石の打ち上げ
      if (captured > 0) {
        score += 140 + captured * 45;
      }

      // 2. 着手後の自分の連の呼吸点評価
      const ownAfter = getGroupAndLiberties(res.nextBoard, r, c);
      if (ownAfter.liberties === 1) {
        // 即アタリになる手は原則悪手（複数取り除く）
        score -= captured >= 2 ? 15 : 95;
      } else if (ownAfter.liberties === 2) {
        score += 10;
      } else {
        score += Math.min(ownAfter.liberties, 5) * 6;
      }

      // 3. 隣接する自分の連（アタリ回避・補強）＆相手の連（アタリ・ダメ詰め）
      const seenOwnBefore = new Set<GroupInfo>();
      const seenOppAfter = new Set<string>();
      let adjOwn = 0;
      let adjOpp = 0;

      for (const [dr, dc] of ORTHO_DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        const cellBefore = state.board[nr][nc];

        if (cellBefore === color) {
          adjOwn++;
          const gBefore = getBeforeGroup(nr, nc);
          if (!seenOwnBefore.has(gBefore)) {
            seenOwnBefore.add(gBefore);
            if (gBefore.liberties === 1 && ownAfter.liberties >= 2) {
              // アタリを助ける手
              score += 115 + gBefore.stones.length * 25;
            } else if (gBefore.liberties === 2 && ownAfter.liberties >= 3) {
              // 呼吸点を伸ばす手
              score += 24;
            }
          }
        } else if (cellBefore === opp) {
          adjOpp++;
          if (res.nextBoard[nr][nc] === opp) {
            const oKey = coordKey(nr, nc);
            if (!seenOppAfter.has(oKey)) {
              const gAfter = getGroupAndLiberties(res.nextBoard, nr, nc);
              for (const s of gAfter.stones) seenOppAfter.add(coordKey(s.row, s.col));
              if (gAfter.liberties === 1) {
                // 相手をアタリにする手
                score += 65 + gAfter.stones.length * 14;
              } else if (gAfter.liberties === 2) {
                score += 22;
              } else {
                score += 8;
              }
            }
          }
        }
      }

      // 4. 序盤の布石（星・小目・3〜4線重視、1線回避）
      const edgeDist = Math.min(r, n - 1 - r, c, n - 1 - c);
      if (stoneCount < n * 1.2) {
        if (starSet.has(coordKey(r, c))) {
          score += 36;
        } else if (edgeDist === 2 || edgeDist === 3) {
          score += 20;
        } else if (edgeDist === 1) {
          score += 4;
        } else if (edgeDist === 0) {
          score -= 22;
        }
      } else {
        if (edgeDist === 0 && adjOpp === 0 && captured === 0) {
          score -= 16;
        }
      }

      // 5. 相手の直前着手への応手・近傍展開
      if (state.lastMove && !state.lastMove.pass && state.lastMove.row >= 0) {
        const dist = Math.abs(r - state.lastMove.row) + Math.abs(c - state.lastMove.col);
        if (dist === 1) score += 20;
        else if (dist === 2) score += 16;
        else if (dist === 3) score += 8;
      }

      // 6. 自分の石だけで固まりすぎた空き地（自陣詰め）を少し減点
      if (adjOwn >= 3 && adjOpp === 0 && captured === 0) {
        score -= 24;
      }

      // わずかなランダム揺らぎ
      score += Math.random() * 4;

      if (score > bestScore) {
        bestScore = score;
        bestMove = { row: r, col: c };
      }
    }
  }

  if (!bestMove) {
    return { type: 'pass' };
  }

  // 相手がパスしていて、こちらにも大場（高スコア手）がなければパスで終局に同意
  if (state.consecutivePasses >= 1 && bestScore < 42) {
    return { type: 'pass' };
  }

  // 終盤で有益な手がほぼ残っていない場合はパス
  if (stoneCount >= Math.floor(n * n * 0.65) && bestScore < 12) {
    return { type: 'pass' };
  }

  return { type: 'place', payload: bestMove };
}

export function sanitizeIgoState(state: IgoInternalState, playerId: string): IgoClientState {
  return { ...state, myId: playerId };
}
