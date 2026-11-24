import type { CheckersRules, PlayerInfo } from '../types/game';

export interface CheckersPiece {
  owner: 0 | 1;
  king: boolean;
}

export interface CheckersCoord {
  row: number;
  col: number;
}

export interface CheckersMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  captured: CheckersCoord | null;
}

export interface CheckersPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  side: 0 | 1; // 0: 赤 (下から上), 1: 白銀/黒 (上から下)
}

export interface CheckersInternalState {
  rules: CheckersRules;
  players: [CheckersPlayerState, CheckersPlayerState];
  board: (CheckersPiece | null)[][];
  turnIndex: 0 | 1;
  mustContinueFrom: CheckersCoord | null;
  lastMove: {
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
    captured: CheckersCoord | null;
  } | null;
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface CheckersClientState extends CheckersInternalState {
  myId: string;
  validMoves: CheckersMove[];
  counts: [number, number];
}

const BOARD_SIZE = 8;

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function getMoveDirs(piece: CheckersPiece): readonly [number, number][] {
  if (piece.king) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  }
  return piece.owner === 0
    ? [
        [-1, -1],
        [-1, 1],
      ]
    : [
        [1, -1],
        [1, 1],
      ];
}

export function getCapturesFrom(
  board: (CheckersPiece | null)[][],
  row: number,
  col: number
): CheckersMove[] {
  const piece = board[row]?.[col];
  if (!piece) return [];
  const opp: 0 | 1 = piece.owner === 0 ? 1 : 0;
  const moves: CheckersMove[] = [];

  for (const [dr, dc] of getMoveDirs(piece)) {
    const midR = row + dr;
    const midC = col + dc;
    const toR = row + dr * 2;
    const toC = col + dc * 2;
    if (!inBounds(toR, toC)) continue;
    const midPiece = board[midR][midC];
    if (midPiece && midPiece.owner === opp && board[toR][toC] === null) {
      moves.push({
        fromRow: row,
        fromCol: col,
        toRow: toR,
        toCol: toC,
        captured: { row: midR, col: midC },
      });
    }
  }
  return moves;
}

function getSimpleMovesFrom(
  board: (CheckersPiece | null)[][],
  row: number,
  col: number
): CheckersMove[] {
  const piece = board[row]?.[col];
  if (!piece) return [];
  const moves: CheckersMove[] = [];

  for (const [dr, dc] of getMoveDirs(piece)) {
    const toR = row + dr;
    const toC = col + dc;
    if (inBounds(toR, toC) && board[toR][toC] === null) {
      moves.push({
        fromRow: row,
        fromCol: col,
        toRow: toR,
        toCol: toC,
        captured: null,
      });
    }
  }
  return moves;
}

export function getCheckersValidMoves(
  board: (CheckersPiece | null)[][],
  owner: 0 | 1,
  forcedCapture: boolean,
  mustContinueFrom: CheckersCoord | null
): CheckersMove[] {
  if (mustContinueFrom) {
    return getCapturesFrom(board, mustContinueFrom.row, mustContinueFrom.col);
  }

  const captures: CheckersMove[] = [];
  const simples: CheckersMove[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c];
      if (!p || p.owner !== owner) continue;
      captures.push(...getCapturesFrom(board, r, c));
      simples.push(...getSimpleMovesFrom(board, r, c));
    }
  }

  if (forcedCapture && captures.length > 0) {
    return captures;
  }
  return [...captures, ...simples];
}

function countPieces(board: (CheckersPiece | null)[][]): [number, number] {
  let c0 = 0;
  let c1 = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c];
      if (p?.owner === 0) c0++;
      else if (p?.owner === 1) c1++;
    }
  }
  return [c0, c1];
}

export function initCheckers(
  playersInfo: PlayerInfo[],
  rules: CheckersRules
): CheckersInternalState {
  const board: (CheckersPiece | null)[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array<CheckersPiece | null>(BOARD_SIZE).fill(null)
  );

  // 暗マス (r + c) % 2 === 1 に配置
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((r + c) % 2 === 1) {
        board[r][c] = { owner: 1, king: false };
      }
    }
  }
  for (let r = 5; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((r + c) % 2 === 1) {
        board[r][c] = { owner: 0, king: false };
      }
    }
  }

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

  const players: [CheckersPlayerState, CheckersPlayerState] = [
    { id: p0.id, name: p0.name, isBot: p0.isBot, side: 0 },
    { id: p1.id, name: p1.name, isBot: p1.isBot, side: 1 },
  ];

  return {
    rules,
    players,
    board,
    turnIndex: 0,
    mustContinueFrom: null,
    lastMove: null,
    winnerId: null,
    phase: 'playing',
    lastLog: `${players[0].name} (赤) のターンからスタート！`,
  };
}

export function applyCheckersAction(
  state: CheckersInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: CheckersInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }
  const current = state.players[state.turnIndex];
  if (current.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }
  if (action.type !== 'move') {
    return { state, error: '不明なアクションです' };
  }

  const payload = action.payload as {
    fromRow?: unknown;
    fromCol?: unknown;
    toRow?: unknown;
    toCol?: unknown;
  } | null;

  const fromRow = payload?.fromRow;
  const fromCol = payload?.fromCol;
  const toRow = payload?.toRow;
  const toCol = payload?.toCol;

  if (
    typeof fromRow !== 'number' ||
    typeof fromCol !== 'number' ||
    typeof toRow !== 'number' ||
    typeof toCol !== 'number' ||
    !Number.isInteger(fromRow) ||
    !Number.isInteger(fromCol) ||
    !Number.isInteger(toRow) ||
    !Number.isInteger(toCol)
  ) {
    return { state, error: '不正な座標です' };
  }

  const validMoves = getCheckersValidMoves(
    state.board,
    current.side,
    state.rules.forcedCapture,
    state.mustContinueFrom
  );

  const chosen = validMoves.find(
    (m) =>
      m.fromRow === fromRow &&
      m.fromCol === fromCol &&
      m.toRow === toRow &&
      m.toCol === toCol
  );

  if (!chosen) {
    return { state, error: 'その手は指せません' };
  }

  const board = state.board.map((r) => r.map((cell) => (cell ? { ...cell } : null)));
  const moving = board[fromRow][fromCol]!;
  board[fromRow][fromCol] = null;

  if (chosen.captured) {
    board[chosen.captured.row][chosen.captured.col] = null;
  }

  // 敵陣最終段到達でキング昇格
  const reachedBackRow =
    (moving.owner === 0 && toRow === 0) || (moving.owner === 1 && toRow === BOARD_SIZE - 1);
  const justPromoted = !moving.king && reachedBackRow;
  if (justPromoted) {
    moving.king = true;
  }
  board[toRow][toCol] = moving;

  const lastMove = {
    fromRow,
    fromCol,
    toRow,
    toCol,
    captured: chosen.captured,
  };

  // 捕獲した場合、昇格直後でなければ連続ジャンプ可能か判定
  if (chosen.captured && !justPromoted) {
    const furtherCaptures = getCapturesFrom(board, toRow, toCol);
    if (furtherCaptures.length > 0) {
      return {
        state: {
          ...state,
          board,
          mustContinueFrom: { row: toRow, col: toCol },
          lastMove,
          lastLog: `${current.name} が捕獲！さらに連続ジャンプできます`,
        },
      };
    }
  }

  // 相手側へ手番移行＆勝敗判定
  const nextIndex: 0 | 1 = state.turnIndex === 0 ? 1 : 0;
  const nextPlayer = state.players[nextIndex];
  const counts = countPieces(board);
  const oppMoves = getCheckersValidMoves(board, nextPlayer.side, state.rules.forcedCapture, null);

  if (counts[nextPlayer.side] === 0 || oppMoves.length === 0) {
    const reason =
      counts[nextPlayer.side] === 0 ? '相手の駒を全滅させて' : '相手に動ける手がなくなり';
    return {
      state: {
        ...state,
        board,
        mustContinueFrom: null,
        lastMove,
        winnerId: current.id,
        phase: 'finished',
        lastLog: `${current.name} が${reason}勝利！`,
      },
    };
  }

  const moveDesc = justPromoted
    ? 'キングに昇格しました！'
    : chosen.captured
    ? '相手の駒を飛び越して取りました！'
    : '駒を進めました。';

  return {
    state: {
      ...state,
      board,
      turnIndex: nextIndex,
      mustContinueFrom: null,
      lastMove,
      lastLog: `${current.name} が${moveDesc} 次は ${nextPlayer.name}`,
    },
  };
}

function cloneBoard(board: (CheckersPiece | null)[][]): (CheckersPiece | null)[][] {
  return board.map((r) => r.map((c) => (c ? { ...c } : null)));
}

export function computeCheckersBotAction(
  state: CheckersInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  const bot = state.players[state.turnIndex];
  const oppSide: 0 | 1 = bot.side === 0 ? 1 : 0;
  const moves = getCheckersValidMoves(
    state.board,
    bot.side,
    state.rules.forcedCapture,
    state.mustContinueFrom
  );
  if (moves.length === 0) return null;
  if (moves.length === 1) {
    const m = moves[0];
    return {
      type: 'move',
      payload: { fromRow: m.fromRow, fromCol: m.fromCol, toRow: m.toRow, toCol: m.toCol },
    };
  }

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const m of moves) {
    const nextBoard = cloneBoard(state.board);
    const piece = nextBoard[m.fromRow][m.fromCol]!;
    nextBoard[m.fromRow][m.fromCol] = null;
    if (m.captured) {
      nextBoard[m.captured.row][m.captured.col] = null;
    }
    const reachedBack =
      (piece.owner === 0 && m.toRow === 0) || (piece.owner === 1 && m.toRow === BOARD_SIZE - 1);
    const justPromoted = !piece.king && reachedBack;
    if (justPromoted) piece.king = true;
    nextBoard[m.toRow][m.toCol] = piece;

    let score = 0;

    // 捕獲ボーナス
    if (m.captured) {
      const capPiece = state.board[m.captured.row][m.captured.col];
      score += capPiece?.king ? 55 : 38;
      if (!justPromoted) {
        const chain = getCapturesFrom(nextBoard, m.toRow, m.toCol);
        if (chain.length > 0) score += 28;
      }
    }

    // キング昇格ボーナス
    if (justPromoted) score += 45;

    // 前進・中央制御
    if (!piece.king) {
      const advance = piece.owner === 0 ? 7 - m.toRow : m.toRow;
      score += advance * 3.5;
    }
    const centerBonus = 3.5 - Math.abs(m.toCol - 3.5);
    score += centerBonus * 2.2;

    // 盤端（安全）のわずかなボーナス
    if (m.toCol === 0 || m.toCol === 7) score += 2;

    // 次の相手手番で取られる危険をペナルティ（連続ジャンプ継続中は除く）
    const continues = m.captured !== null && !justPromoted && getCapturesFrom(nextBoard, m.toRow, m.toCol).length > 0;
    if (!continues) {
      const oppMoves = getCheckersValidMoves(nextBoard, oppSide, state.rules.forcedCapture, null);
      const oppCaptures = oppMoves.filter((om) => om.captured !== null);
      if (oppCaptures.length > 0) {
        score -= 32;
        if (oppCaptures.some((om) => om.captured?.row === m.toRow && om.captured?.col === m.toCol)) {
          score -= piece.king ? 25 : 12;
        }
      }
      if (oppMoves.length === 0) {
        score += 1000;
      }
    }

    score += Math.random() * 1.5;

    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }

  return {
    type: 'move',
    payload: {
      fromRow: bestMove.fromRow,
      fromCol: bestMove.fromCol,
      toRow: bestMove.toRow,
      toCol: bestMove.toCol,
    },
  };
}

export function sanitizeCheckersState(
  state: CheckersInternalState,
  playerId: string
): CheckersClientState {
  const current = state.players[state.turnIndex];
  const validMoves =
    state.phase === 'playing'
      ? getCheckersValidMoves(
          state.board,
          current.side,
          state.rules.forcedCapture,
          state.mustContinueFrom
        )
      : [];

  return {
    ...state,
    myId: playerId,
    validMoves,
    counts: countPieces(state.board),
  };
}
