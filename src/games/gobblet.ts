import type { GobbletRules, PlayerInfo } from '../types/game';

export type GobbletSize = 1 | 2 | 3;

export interface GobbletPiece {
  owner: 0 | 1;
  size: GobbletSize;
}

export interface GobbletCoord {
  row: number;
  col: number;
}

export interface GobbletPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  side: 0 | 1; // 0: アンバー/オレンジ, 1: スカイブルー
}

export type GobbletReserves = {
  1: number;
  2: number;
  3: number;
};

export interface GobbletVisibleCell {
  top: GobbletPiece | null;
  depth: number;
}

export interface GobbletLastMove {
  kind: 'place' | 'move';
  owner: 0 | 1;
  size: GobbletSize;
  from: GobbletCoord | null;
  to: GobbletCoord;
}

export interface GobbletInternalState {
  rules: GobbletRules;
  players: [GobbletPlayerState, GobbletPlayerState];
  board: GobbletPiece[][][]; // 3x3, stack bottom -> top
  reserves: [GobbletReserves, GobbletReserves];
  turnIndex: 0 | 1;
  moveCount: number;
  lastMove: GobbletLastMove | null;
  winningLine: GobbletCoord[];
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface GobbletClientState extends Omit<GobbletInternalState, 'board'> {
  visibleBoard: GobbletVisibleCell[][];
  myId: string;
}

const BOARD_SIZE = 3;

const WIN_LINES: readonly [GobbletCoord, GobbletCoord, GobbletCoord][] = [
  // 横
  [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
  ],
  [
    { row: 1, col: 0 },
    { row: 1, col: 1 },
    { row: 1, col: 2 },
  ],
  [
    { row: 2, col: 0 },
    { row: 2, col: 1 },
    { row: 2, col: 2 },
  ],
  // 縦
  [
    { row: 0, col: 0 },
    { row: 1, col: 0 },
    { row: 2, col: 0 },
  ],
  [
    { row: 0, col: 1 },
    { row: 1, col: 1 },
    { row: 2, col: 1 },
  ],
  [
    { row: 0, col: 2 },
    { row: 1, col: 2 },
    { row: 2, col: 2 },
  ],
  // 斜め
  [
    { row: 0, col: 0 },
    { row: 1, col: 1 },
    { row: 2, col: 2 },
  ],
  [
    { row: 0, col: 2 },
    { row: 1, col: 1 },
    { row: 2, col: 0 },
  ],
];

const SIZE_LABEL: Record<GobbletSize, string> = {
  1: '小',
  2: '中',
  3: '大',
};

function isValidCoord(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < BOARD_SIZE;
}

function isValidSize(v: unknown): v is GobbletSize {
  return v === 1 || v === 2 || v === 3;
}

function getTop(board: GobbletPiece[][][], r: number, c: number): GobbletPiece | null {
  const stack = board[r][c];
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

function cloneBoard(board: GobbletPiece[][][]): GobbletPiece[][][] {
  return board.map((row) => row.map((stack) => stack.map((p) => ({ ...p }))));
}

function cloneReserves(
  reserves: [GobbletReserves, GobbletReserves]
): [GobbletReserves, GobbletReserves] {
  return [{ ...reserves[0] }, { ...reserves[1] }];
}

function findWinningLine(board: GobbletPiece[][][], owner: 0 | 1): GobbletCoord[] | null {
  for (const line of WIN_LINES) {
    if (
      line.every(({ row, col }) => {
        const top = getTop(board, row, col);
        return top !== null && top.owner === owner;
      })
    ) {
      return line.map((c) => ({ ...c }));
    }
  }
  return null;
}

type GobbletMoveAction =
  | { type: 'place'; payload: { size: GobbletSize; toRow: number; toCol: number } }
  | {
      type: 'move';
      payload: { fromRow: number; fromCol: number; toRow: number; toCol: number };
    };

function getLegalActionsFor(
  board: GobbletPiece[][][],
  reserves: [GobbletReserves, GobbletReserves],
  side: 0 | 1,
  allowBoardMove: boolean
): GobbletMoveAction[] {
  const actions: GobbletMoveAction[] = [];

  // 1. 控え駒を配置
  for (const size of [1, 2, 3] as GobbletSize[]) {
    if (reserves[side][size] <= 0) continue;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const top = getTop(board, r, c);
        if (!top || top.size < size) {
          actions.push({ type: 'place', payload: { size, toRow: r, toCol: c } });
        }
      }
    }
  }

  // 2. 盤上の自駒を移動
  if (allowBoardMove) {
    for (let fr = 0; fr < BOARD_SIZE; fr++) {
      for (let fc = 0; fc < BOARD_SIZE; fc++) {
        const fromTop = getTop(board, fr, fc);
        if (!fromTop || fromTop.owner !== side) continue;
        for (let tr = 0; tr < BOARD_SIZE; tr++) {
          for (let tc = 0; tc < BOARD_SIZE; tc++) {
            if (fr === tr && fc === tc) continue;
            const toTop = getTop(board, tr, tc);
            if (!toTop || toTop.size < fromTop.size) {
              actions.push({
                type: 'move',
                payload: { fromRow: fr, fromCol: fc, toRow: tr, toCol: tc },
              });
            }
          }
        }
      }
    }
  }

  return actions;
}

export function initGobblet(
  playersInfo: PlayerInfo[],
  rules: GobbletRules
): GobbletInternalState {
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

  const board: GobbletPiece[][][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => [])
  );

  return {
    rules: { allowBoardMove: rules.allowBoardMove ?? true },
    players: [
      { id: p0.id, name: p0.name, isBot: p0.isBot, side: 0 },
      { id: p1.id, name: p1.name, isBot: p1.isBot, side: 1 },
    ],
    board,
    reserves: [
      { 1: 2, 2: 2, 3: 2 },
      { 1: 2, 2: 2, 3: 2 },
    ],
    turnIndex: 0,
    moveCount: 0,
    lastMove: null,
    winningLine: [],
    winnerId: null,
    phase: 'playing',
    lastLog: `${p0.name} の先手で対局開始！`,
  };
}

export function applyGobbletAction(
  state: GobbletInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: GobbletInternalState; error?: string } {
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

  const nextBoard = cloneBoard(state.board);
  const nextReserves = cloneReserves(state.reserves);
  let lastMove: GobbletLastMove;
  let actionDesc = '';

  if (action.type === 'place') {
    const payload = action.payload as
      | { size?: unknown; toRow?: unknown; toCol?: unknown }
      | undefined;
    if (!payload || !isValidSize(payload.size) || !isValidCoord(payload.toRow) || !isValidCoord(payload.toCol)) {
      return { state, error: '配置パラメータが不正です' };
    }
    const { size, toRow, toCol } = payload;
    if (nextReserves[side][size] <= 0) {
      return { state, error: `${SIZE_LABEL[size]}駒の控えがありません` };
    }
    const targetTop = getTop(nextBoard, toRow, toCol);
    if (targetTop && targetTop.size >= size) {
      return { state, error: 'より小さい駒の上か空きマスにしか置けません' };
    }

    nextReserves[side][size] -= 1;
    nextBoard[toRow][toCol].push({ owner: side, size });
    lastMove = {
      kind: 'place',
      owner: side,
      size,
      from: null,
      to: { row: toRow, col: toCol },
    };
    actionDesc = targetTop
      ? `${current.name} が ${SIZE_LABEL[size]}駒をかぶせました`
      : `${current.name} が ${SIZE_LABEL[size]}駒を置きました`;
  } else if (action.type === 'move') {
    if (!state.rules.allowBoardMove) {
      return { state, error: 'このルールでは盤上の駒を移動できません' };
    }
    const payload = action.payload as
      | { fromRow?: unknown; fromCol?: unknown; toRow?: unknown; toCol?: unknown }
      | undefined;
    if (
      !payload ||
      !isValidCoord(payload.fromRow) ||
      !isValidCoord(payload.fromCol) ||
      !isValidCoord(payload.toRow) ||
      !isValidCoord(payload.toCol)
    ) {
      return { state, error: '移動座標が不正です' };
    }
    const { fromRow, fromCol, toRow, toCol } = payload;
    if (fromRow === toRow && fromCol === toCol) {
      return { state, error: '同じマスには移動できません' };
    }
    const fromTop = getTop(nextBoard, fromRow, fromCol);
    if (!fromTop || fromTop.owner !== side) {
      return { state, error: '移動元に自分の駒がありません' };
    }
    const toTop = getTop(nextBoard, toRow, toCol);
    if (toTop && toTop.size >= fromTop.size) {
      return { state, error: 'より小さい駒の上か空きマスにしか移動できません' };
    }

    const popped = nextBoard[fromRow][fromCol].pop()!;
    nextBoard[toRow][toCol].push(popped);
    lastMove = {
      kind: 'move',
      owner: side,
      size: popped.size,
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
    };
    actionDesc = toTop
      ? `${current.name} が盤上の${SIZE_LABEL[popped.size]}駒を移動してかぶせました`
      : `${current.name} が盤上の${SIZE_LABEL[popped.size]}駒を移動しました`;
  } else {
    return { state, error: '未対応のアクションです' };
  }

  // 公式準拠の勝敗判定：相手の3目が成立していたら（両者同時でも）相手の勝利
  const oppLine = findWinningLine(nextBoard, oppSide);
  const myLine = findWinningLine(nextBoard, side);

  if (oppLine) {
    const exposedReason = myLine
      ? '同時3目成立（相手ライン露出のため相手勝利）！'
      : '下の駒が露出し相手の3目が完成！';
    return {
      state: {
        ...state,
        board: nextBoard,
        reserves: nextReserves,
        moveCount: state.moveCount + 1,
        lastMove,
        winningLine: oppLine,
        winnerId: opponent.id,
        phase: 'finished',
        lastLog: `${exposedReason} ${opponent.name} の勝利！`,
      },
    };
  }

  if (myLine) {
    return {
      state: {
        ...state,
        board: nextBoard,
        reserves: nextReserves,
        moveCount: state.moveCount + 1,
        lastMove,
        winningLine: myLine,
        winnerId: current.id,
        phase: 'finished',
        lastLog: `${current.name} が3目並べて勝利！`,
      },
    };
  }

  // 次の手番プレイヤーに合法手があるか確認
  const nextLegal = getLegalActionsFor(
    nextBoard,
    nextReserves,
    oppSide,
    state.rules.allowBoardMove
  );
  if (nextLegal.length === 0) {
    return {
      state: {
        ...state,
        board: nextBoard,
        reserves: nextReserves,
        turnIndex: oppSide,
        moveCount: state.moveCount + 1,
        lastMove,
        winningLine: [],
        winnerId: null,
        phase: 'finished',
        lastLog: '合法手がなくなったため引き分け！',
      },
    };
  }

  return {
    state: {
      ...state,
      board: nextBoard,
      reserves: nextReserves,
      turnIndex: oppSide,
      moveCount: state.moveCount + 1,
      lastMove,
      winningLine: [],
      lastLog: actionDesc,
    },
  };
}

export function sanitizeGobbletState(
  state: GobbletInternalState,
  playerId: string
): GobbletClientState {
  const { board, ...rest } = state;
  const visibleBoard: GobbletVisibleCell[][] = board.map((row) =>
    row.map((stack) => ({
      top: stack.length > 0 ? { ...stack[stack.length - 1] } : null,
      depth: stack.length,
    }))
  );
  return {
    ...rest,
    visibleBoard,
    myId: playerId,
  };
}

function evaluateGobbletBoard(
  board: GobbletPiece[][][],
  reserves: [GobbletReserves, GobbletReserves],
  botSide: 0 | 1
): number {
  const oppSide: 0 | 1 = botSide === 0 ? 1 : 0;
  let score = 0;

  // 各ラインの評価
  for (const line of WIN_LINES) {
    let myCount = 0;
    let oppCount = 0;
    let mySizeSum = 0;
    let oppSizeSum = 0;
    for (const { row, col } of line) {
      const top = getTop(board, row, col);
      if (!top) continue;
      if (top.owner === botSide) {
        myCount++;
        mySizeSum += top.size;
      } else {
        oppCount++;
        oppSizeSum += top.size;
      }
    }
    if (myCount === 2 && oppCount === 0) score += 28 + mySizeSum * 3;
    else if (myCount === 1 && oppCount === 0) score += 6 + mySizeSum;
    if (oppCount === 2 && myCount === 0) score -= 34 + oppSizeSum * 3;
    else if (oppCount === 1 && myCount === 0) score -= 5 + oppSizeSum;
  }

  // 中央・角・サイズ優位
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const top = getTop(board, r, c);
      if (!top) continue;
      const posWeight = r === 1 && c === 1 ? 14 : (r === 0 || r === 2) && (c === 0 || c === 2) ? 7 : 3;
      const val = posWeight + top.size * 5;
      score += top.owner === botSide ? val : -val;
    }
  }

  // 控えの大駒温存ボーナス（防御力）
  score += reserves[botSide][3] * 6 + reserves[botSide][2] * 2;
  score -= reserves[oppSide][3] * 5;

  return score;
}

function canSideWinInOne(state: GobbletInternalState, side: 0 | 1): boolean {
  const actions = getLegalActionsFor(
    state.board,
    state.reserves,
    side,
    state.rules.allowBoardMove
  );
  const playerId = state.players[side].id;
  for (const act of actions) {
    const res = applyGobbletAction({ ...state, turnIndex: side }, playerId, act);
    if (!res.error && res.state.phase === 'finished' && res.state.winnerId === playerId) {
      return true;
    }
  }
  return false;
}

export function computeGobbletBotAction(
  state: GobbletInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  const bot = state.players[state.turnIndex];
  if (!bot.isBot) return null;

  const botSide = bot.side;
  const oppSide: 0 | 1 = botSide === 0 ? 1 : 0;
  const legal = getLegalActionsFor(
    state.board,
    state.reserves,
    botSide,
    state.rules.allowBoardMove
  );
  if (legal.length === 0) return null;

  let bestScore = -Infinity;
  let bestActions: GobbletMoveAction[] = [];

  for (const act of legal) {
    const res = applyGobbletAction(state, bot.id, act);
    if (res.error) continue;
    const next = res.state;

    // 1. 即勝利
    if (next.phase === 'finished' && next.winnerId === bot.id) {
      return act;
    }

    // 2. 自滅手（相手即勝利）は最悪スコア
    if (next.phase === 'finished' && next.winnerId !== bot.id && next.winnerId !== null) {
      const score = -100000;
      if (score > bestScore) {
        bestScore = score;
        bestActions = [act];
      } else if (score === bestScore) {
        bestActions.push(act);
      }
      continue;
    }

    // 3. 次の相手手番で相手が即勝利できるかどうかを評価
    const oppThreat = next.phase === 'playing' && canSideWinInOne(next, oppSide);
    let score = evaluateGobbletBoard(next.board, next.reserves, botSide);
    if (oppThreat) {
      score -= 10000;
    }

    // 相手駒への被せに少しボーナス
    const targetTop = getTop(state.board, act.payload.toRow, act.payload.toCol);
    if (targetTop && targetTop.owner === oppSide) {
      score += 8;
    }

    // 微小なランダム性で同点手を分散
    score += Math.random() * 1.5;

    if (score > bestScore) {
      bestScore = score;
      bestActions = [act];
    }
  }

  return bestActions[0] ?? legal[0];
}
