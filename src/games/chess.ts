import type { ChessRules, PlayerInfo } from '../types/game';

export type ChessPieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
export type ChessColor = 'w' | 'b';

export interface ChessPiece {
  type: ChessPieceType;
  color: ChessColor;
}

export interface ChessPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  color: ChessColor;
  captured: ChessPieceType[];
}

export interface ChessMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  promotion?: 'q' | 'r' | 'b' | 'n';
  isCastle?: 'K' | 'Q';
  isEnPassant?: boolean;
}

export interface ChessCastlingRights {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

export type ChessFinishReason =
  | 'checkmate'
  | 'stalemate'
  | 'threefold'
  | 'fiftyMove'
  | 'insufficientMaterial'
  | 'resign'
  | null;

export interface ChessInternalState {
  rules: ChessRules;
  players: [ChessPlayerState, ChessPlayerState];
  board: (ChessPiece | null)[][];
  turnIndex: 0 | 1;
  castling: ChessCastlingRights;
  enPassantTarget: { row: number; col: number } | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  positionCounts: Record<string, number>;
  inCheck: boolean;
  lastMove: { fromRow: number; fromCol: number; toRow: number; toCol: number } | null;
  winnerId: string | 'draw' | null;
  finishReason: ChessFinishReason;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface ChessClientState extends ChessInternalState {
  myId: string;
  legalMoves: ChessMove[];
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const PROMOTION_TYPES: readonly ('q' | 'r' | 'b' | 'n')[] = ['q', 'r', 'b', 'n'];

const CAPTURE_SORT_ORDER: Record<ChessPieceType, number> = {
  q: 0,
  r: 1,
  b: 2,
  n: 3,
  p: 4,
  k: 5,
};

const PIECE_NAME_JA: Record<ChessPieceType, string> = {
  k: 'キング',
  q: 'クイーン',
  r: 'ルーク',
  b: 'ビショップ',
  n: 'ナイト',
  p: 'ポーン',
};

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function oppositeColor(color: ChessColor): ChessColor {
  return color === 'w' ? 'b' : 'w';
}

function squareName(row: number, col: number): string {
  return `${FILES[col]}${8 - row}`;
}

function cloneBoard(board: (ChessPiece | null)[][]): (ChessPiece | null)[][] {
  return board.map((row) => row.map((cell) => (cell ? { type: cell.type, color: cell.color } : null)));
}

function createInitialBoard(): (ChessPiece | null)[][] {
  const backRank: ChessPieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const board: (ChessPiece | null)[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null)
  );

  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: backRank[c], color: 'b' };
    board[1][c] = { type: 'p', color: 'b' };
    board[6][c] = { type: 'p', color: 'w' };
    board[7][c] = { type: backRank[c], color: 'w' };
  }
  return board;
}

function findKing(board: (ChessPiece | null)[][], color: ChessColor): { row: number; col: number } | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color && piece.type === 'k') {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

function isSquareAttacked(
  board: (ChessPiece | null)[][],
  row: number,
  col: number,
  byColor: ChessColor
): boolean {
  // Pawn attacks
  const pawnSourceRow = byColor === 'w' ? row + 1 : row - 1;
  if (inBounds(pawnSourceRow, col - 1)) {
    const p = board[pawnSourceRow][col - 1];
    if (p && p.color === byColor && p.type === 'p') return true;
  }
  if (inBounds(pawnSourceRow, col + 1)) {
    const p = board[pawnSourceRow][col + 1];
    if (p && p.color === byColor && p.type === 'p') return true;
  }

  // Knight attacks
  const knightOffsets: readonly [number, number][] = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ];
  for (const [dr, dc] of knightOffsets) {
    const nr = row + dr;
    const nc = col + dc;
    if (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p && p.color === byColor && p.type === 'n') return true;
    }
  }

  // King attacks
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p && p.color === byColor && p.type === 'k') return true;
      }
    }
  }

  // Bishop / Queen diagonal rays
  const diagDirs: readonly [number, number][] = [
    [-1, -1], [-1, 1], [1, -1], [1, 1],
  ];
  for (const [dr, dc] of diagDirs) {
    let nr = row + dr;
    let nc = col + dc;
    while (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p) {
        if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  // Rook / Queen orthogonal rays
  const orthoDirs: readonly [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
  ];
  for (const [dr, dc] of orthoDirs) {
    let nr = row + dr;
    let nc = col + dc;
    while (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p) {
        if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  return false;
}

function isKingInCheck(board: (ChessPiece | null)[][], color: ChessColor): boolean {
  const king = findKing(board, color);
  if (!king) return false;
  return isSquareAttacked(board, king.row, king.col, oppositeColor(color));
}

function applyMoveOnBoard(board: (ChessPiece | null)[][], move: ChessMove): (ChessPiece | null)[][] {
  const next = cloneBoard(board);
  const moving = next[move.fromRow][move.fromCol];
  if (!moving) return next;

  next[move.fromRow][move.fromCol] = null;

  if (move.isEnPassant) {
    next[move.fromRow][move.toCol] = null;
  }

  if (move.isCastle) {
    const rank = moving.color === 'w' ? 7 : 0;
    if (move.isCastle === 'K') {
      next[rank][5] = next[rank][7];
      next[rank][7] = null;
    } else {
      next[rank][3] = next[rank][0];
      next[rank][0] = null;
    }
  }

  next[move.toRow][move.toCol] = {
    type: move.promotion ?? moving.type,
    color: moving.color,
  };

  return next;
}

function generateLegalMovesForPosition(
  board: (ChessPiece | null)[][],
  color: ChessColor,
  castling: ChessCastlingRights,
  enPassantTarget: { row: number; col: number } | null
): ChessMove[] {
  const pseudo: ChessMove[] = [];
  const opp = oppositeColor(color);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;

      switch (piece.type) {
        case 'p': {
          const dir = color === 'w' ? -1 : 1;
          const startRow = color === 'w' ? 6 : 1;
          const promoRow = color === 'w' ? 0 : 7;
          const oneStep = r + dir;

          if (inBounds(oneStep, c) && !board[oneStep][c]) {
            if (oneStep === promoRow) {
              for (const promo of PROMOTION_TYPES) {
                pseudo.push({ fromRow: r, fromCol: c, toRow: oneStep, toCol: c, promotion: promo });
              }
            } else {
              pseudo.push({ fromRow: r, fromCol: c, toRow: oneStep, toCol: c });
              const twoStep = r + dir * 2;
              if (r === startRow && inBounds(twoStep, c) && !board[twoStep][c]) {
                pseudo.push({ fromRow: r, fromCol: c, toRow: twoStep, toCol: c });
              }
            }
          }

          for (const dc of [-1, 1]) {
            const nc = c + dc;
            if (!inBounds(oneStep, nc)) continue;
            const target = board[oneStep][nc];
            if (target && target.color === opp) {
              if (oneStep === promoRow) {
                for (const promo of PROMOTION_TYPES) {
                  pseudo.push({ fromRow: r, fromCol: c, toRow: oneStep, toCol: nc, promotion: promo });
                }
              } else {
                pseudo.push({ fromRow: r, fromCol: c, toRow: oneStep, toCol: nc });
              }
            } else if (
              enPassantTarget &&
              enPassantTarget.row === oneStep &&
              enPassantTarget.col === nc
            ) {
              const capturedPawn = board[r][nc];
              if (capturedPawn && capturedPawn.color === opp && capturedPawn.type === 'p') {
                pseudo.push({
                  fromRow: r,
                  fromCol: c,
                  toRow: oneStep,
                  toCol: nc,
                  isEnPassant: true,
                });
              }
            }
          }
          break;
        }

        case 'n': {
          const offsets: readonly [number, number][] = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1],
          ];
          for (const [dr, dc] of offsets) {
            const nr = r + dr;
            const nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            const target = board[nr][nc];
            if (!target || target.color === opp) {
              pseudo.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
            }
          }
          break;
        }

        case 'b':
        case 'r':
        case 'q': {
          const dirs: [number, number][] = [];
          if (piece.type === 'b' || piece.type === 'q') {
            dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
          }
          if (piece.type === 'r' || piece.type === 'q') {
            dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
          }
          for (const [dr, dc] of dirs) {
            let nr = r + dr;
            let nc = c + dc;
            while (inBounds(nr, nc)) {
              const target = board[nr][nc];
              if (!target) {
                pseudo.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
              } else {
                if (target.color === opp) {
                  pseudo.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
                }
                break;
              }
              nr += dr;
              nc += dc;
            }
          }
          break;
        }

        case 'k': {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = r + dr;
              const nc = c + dc;
              if (!inBounds(nr, nc)) continue;
              const target = board[nr][nc];
              if (!target || target.color === opp) {
                pseudo.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
              }
            }
          }

          // Castling
          const homeRank = color === 'w' ? 7 : 0;
          if (r === homeRank && c === 4 && !isSquareAttacked(board, homeRank, 4, opp)) {
            const canK = color === 'w' ? castling.wK : castling.bK;
            const canQ = color === 'w' ? castling.wQ : castling.bQ;

            if (canK) {
              const rook = board[homeRank][7];
              if (
                rook &&
                rook.color === color &&
                rook.type === 'r' &&
                !board[homeRank][5] &&
                !board[homeRank][6] &&
                !isSquareAttacked(board, homeRank, 5, opp) &&
                !isSquareAttacked(board, homeRank, 6, opp)
              ) {
                pseudo.push({
                  fromRow: homeRank,
                  fromCol: 4,
                  toRow: homeRank,
                  toCol: 6,
                  isCastle: 'K',
                });
              }
            }

            if (canQ) {
              const rook = board[homeRank][0];
              if (
                rook &&
                rook.color === color &&
                rook.type === 'r' &&
                !board[homeRank][3] &&
                !board[homeRank][2] &&
                !board[homeRank][1] &&
                !isSquareAttacked(board, homeRank, 3, opp) &&
                !isSquareAttacked(board, homeRank, 2, opp)
              ) {
                pseudo.push({
                  fromRow: homeRank,
                  fromCol: 4,
                  toRow: homeRank,
                  toCol: 2,
                  isCastle: 'Q',
                });
              }
            }
          }
          break;
        }
      }
    }
  }

  // Filter moves that leave own king in check
  const legal: ChessMove[] = [];
  for (const move of pseudo) {
    const nextBoard = applyMoveOnBoard(board, move);
    if (!isKingInCheck(nextBoard, color)) {
      legal.push(move);
    }
  }
  return legal;
}

function buildPositionKey(
  board: (ChessPiece | null)[][],
  turnColor: ChessColor,
  castling: ChessCastlingRights,
  enPassantTarget: { row: number; col: number } | null,
  legalMovesForTurn: ChessMove[]
): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let rowStr = '';
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) {
        empty++;
      } else {
        if (empty > 0) {
          rowStr += String(empty);
          empty = 0;
        }
        rowStr += p.color === 'w' ? p.type.toUpperCase() : p.type;
      }
    }
    if (empty > 0) rowStr += String(empty);
    rows.push(rowStr);
  }

  const castleStr =
    (castling.wK ? 'K' : '') +
    (castling.wQ ? 'Q' : '') +
    (castling.bK ? 'k' : '') +
    (castling.bQ ? 'q' : '') || '-';

  // FIDE rule: en passant square is only part of position identity if an en passant capture is legally available
  const hasLegalEp =
    enPassantTarget !== null && legalMovesForTurn.some((m) => m.isEnPassant);
  const epStr = hasLegalEp && enPassantTarget ? squareName(enPassantTarget.row, enPassantTarget.col) : '-';

  return `${rows.join('/')} ${turnColor} ${castleStr} ${epStr}`;
}

function isInsufficientMaterial(board: (ChessPiece | null)[][]): boolean {
  const minorPieces: { type: ChessPieceType; color: ChessColor; squareColor: number }[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.type === 'k') continue;
      if (p.type === 'p' || p.type === 'r' || p.type === 'q') {
        return false;
      }
      minorPieces.push({ type: p.type, color: p.color, squareColor: (r + c) % 2 });
    }
  }

  // K vs K
  if (minorPieces.length === 0) return true;
  // K+B vs K or K+N vs K
  if (minorPieces.length === 1) return true;
  // K+B vs K+B on same-colored squares
  if (
    minorPieces.length === 2 &&
    minorPieces[0].type === 'b' &&
    minorPieces[1].type === 'b' &&
    minorPieces[0].color !== minorPieces[1].color &&
    minorPieces[0].squareColor === minorPieces[1].squareColor
  ) {
    return true;
  }

  return false;
}

function updateCastlingRights(
  castling: ChessCastlingRights,
  move: ChessMove,
  movingPiece: ChessPiece
): ChessCastlingRights {
  const next: ChessCastlingRights = { ...castling };

  if (movingPiece.type === 'k') {
    if (movingPiece.color === 'w') {
      next.wK = false;
      next.wQ = false;
    } else {
      next.bK = false;
      next.bQ = false;
    }
  }

  // Moving from rook start squares
  if (move.fromRow === 7 && move.fromCol === 7) next.wK = false;
  if (move.fromRow === 7 && move.fromCol === 0) next.wQ = false;
  if (move.fromRow === 0 && move.fromCol === 7) next.bK = false;
  if (move.fromRow === 0 && move.fromCol === 0) next.bQ = false;

  // Capturing on rook start squares
  if (move.toRow === 7 && move.toCol === 7) next.wK = false;
  if (move.toRow === 7 && move.toCol === 0) next.wQ = false;
  if (move.toRow === 0 && move.toCol === 7) next.bK = false;
  if (move.toRow === 0 && move.toCol === 0) next.bQ = false;

  return next;
}

export function initChess(playersInfo: PlayerInfo[], rules: ChessRules): ChessInternalState {
  const p0 = playersInfo[0] ?? {
    id: 'p1',
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

  const players: [ChessPlayerState, ChessPlayerState] = [
    { id: p0.id, name: p0.name, isBot: p0.isBot, color: 'w', captured: [] },
    { id: p1.id, name: p1.name, isBot: p1.isBot, color: 'b', captured: [] },
  ];

  const board = createInitialBoard();
  const castling: ChessCastlingRights = { wK: true, wQ: true, bK: true, bQ: true };
  const initialLegal = generateLegalMovesForPosition(board, 'w', castling, null);
  const initialKey = buildPositionKey(board, 'w', castling, null, initialLegal);

  return {
    rules: { ...rules },
    players,
    board,
    turnIndex: 0,
    castling,
    enPassantTarget: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    positionCounts: { [initialKey]: 1 },
    inCheck: false,
    lastMove: null,
    winnerId: null,
    finishReason: null,
    phase: 'playing',
    lastLog: `対局開始。${players[0].name}（白）の手番です`,
  };
}

export function getChessLegalMoves(state: ChessInternalState): ChessMove[] {
  if (state.phase !== 'playing') return [];
  const color = state.players[state.turnIndex].color;
  return generateLegalMovesForPosition(state.board, color, state.castling, state.enPassantTarget);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function applyChessAction(
  state: ChessInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: ChessInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: '対局はすでに終了しています' };
  }

  if (action.type === 'resign') {
    const actorIdx = state.players.findIndex((p) => p.id === playerId);
    if (actorIdx === -1) {
      return { state, error: '対局プレイヤーではありません' };
    }
    const winner = state.players[actorIdx === 0 ? 1 : 0];
    const resigner = state.players[actorIdx];
    return {
      state: {
        ...state,
        phase: 'finished',
        winnerId: winner.id,
        finishReason: 'resign',
        lastLog: `${resigner.name}が投了しました。${winner.name}の勝利です`,
      },
    };
  }

  if (action.type !== 'move') {
    return { state, error: '不明なアクションです' };
  }

  const currentPlayer = state.players[state.turnIndex];
  if (currentPlayer.id !== playerId) {
    return { state, error: 'あなたの手番ではありません' };
  }

  if (!isRecord(action.payload)) {
    return { state, error: '移動データが不正です' };
  }

  const fromRow = action.payload.fromRow;
  const fromCol = action.payload.fromCol;
  const toRow = action.payload.toRow;
  const toCol = action.payload.toCol;
  const promotionRaw = action.payload.promotion;

  if (
    typeof fromRow !== 'number' ||
    typeof fromCol !== 'number' ||
    typeof toRow !== 'number' ||
    typeof toCol !== 'number'
  ) {
    return { state, error: '座標が不正です' };
  }

  const promotion =
    promotionRaw === 'q' || promotionRaw === 'r' || promotionRaw === 'b' || promotionRaw === 'n'
      ? promotionRaw
      : undefined;

  const legalMoves = getChessLegalMoves(state);
  const matched = legalMoves.find(
    (m) =>
      m.fromRow === fromRow &&
      m.fromCol === fromCol &&
      m.toRow === toRow &&
      m.toCol === toCol &&
      m.promotion === promotion
  );

  if (!matched) {
    return { state, error: 'その手は指せません' };
  }

  const movingPiece = state.board[matched.fromRow][matched.fromCol];
  if (!movingPiece) {
    return { state, error: '移動元に駒がありません' };
  }

  const capturedPiece: ChessPiece | null = matched.isEnPassant
    ? state.board[matched.fromRow][matched.toCol]
    : state.board[matched.toRow][matched.toCol];

  const nextBoard = applyMoveOnBoard(state.board, matched);
  const nextCastling = updateCastlingRights(state.castling, matched, movingPiece);

  let nextEnPassant: { row: number; col: number } | null = null;
  if (movingPiece.type === 'p' && Math.abs(matched.toRow - matched.fromRow) === 2) {
    nextEnPassant = {
      row: (matched.fromRow + matched.toRow) / 2,
      col: matched.fromCol,
    };
  }

  const nextHalfMoveClock =
    movingPiece.type === 'p' || capturedPiece !== null ? 0 : state.halfMoveClock + 1;
  const nextFullMoveNumber =
    movingPiece.color === 'b' ? state.fullMoveNumber + 1 : state.fullMoveNumber;

  const nextPlayers: [ChessPlayerState, ChessPlayerState] = [
    { ...state.players[0], captured: [...state.players[0].captured] },
    { ...state.players[1], captured: [...state.players[1].captured] },
  ];
  if (capturedPiece) {
    nextPlayers[state.turnIndex].captured.push(capturedPiece.type);
    nextPlayers[state.turnIndex].captured.sort(
      (a, b) => CAPTURE_SORT_ORDER[a] - CAPTURE_SORT_ORDER[b]
    );
  }

  const nextTurnIndex: 0 | 1 = state.turnIndex === 0 ? 1 : 0;
  const nextColor = nextPlayers[nextTurnIndex].color;
  const nextInCheck = isKingInCheck(nextBoard, nextColor);
  const nextLegalMoves = generateLegalMovesForPosition(
    nextBoard,
    nextColor,
    nextCastling,
    nextEnPassant
  );

  const posKey = buildPositionKey(
    nextBoard,
    nextColor,
    nextCastling,
    nextEnPassant,
    nextLegalMoves
  );
  const nextPositionCounts: Record<string, number> = {
    ...state.positionCounts,
    [posKey]: (state.positionCounts[posKey] ?? 0) + 1,
  };

  // Build move description
  const colorLabel = movingPiece.color === 'w' ? '白' : '黒';
  let moveText = '';
  if (matched.isCastle === 'K') {
    moveText = `${colorLabel}: キャスリング (O-O)`;
  } else if (matched.isCastle === 'Q') {
    moveText = `${colorLabel}: キャスリング (O-O-O)`;
  } else {
    const fromSq = squareName(matched.fromRow, matched.fromCol);
    const toSq = squareName(matched.toRow, matched.toCol);
    const pieceJa = PIECE_NAME_JA[movingPiece.type];
    const sep = capturedPiece ? 'x' : '-';
    const promoSuffix = matched.promotion ? ` (${PIECE_NAME_JA[matched.promotion]}に昇格)` : '';
    const epSuffix = matched.isEnPassant ? ' (アンパッサン)' : '';
    moveText = `${colorLabel}: ${pieceJa} ${fromSq}${sep}${toSq}${promoSuffix}${epSuffix}`;
  }

  let phase: 'playing' | 'finished' = 'playing';
  let winnerId: string | 'draw' | null = null;
  let finishReason: ChessFinishReason = null;
  let lastLog = moveText;

  if (nextLegalMoves.length === 0) {
    phase = 'finished';
    if (nextInCheck) {
      winnerId = currentPlayer.id;
      finishReason = 'checkmate';
      lastLog = `${moveText} — チェックメイト！ ${currentPlayer.name}の勝利`;
    } else {
      winnerId = 'draw';
      finishReason = 'stalemate';
      lastLog = `${moveText} — ステイルメイト（引き分け）`;
    }
  } else if (isInsufficientMaterial(nextBoard)) {
    phase = 'finished';
    winnerId = 'draw';
    finishReason = 'insufficientMaterial';
    lastLog = `${moveText} — 不足戦力のため引き分け`;
  } else if (state.rules.threefoldRepetition && nextPositionCounts[posKey] >= 3) {
    phase = 'finished';
    winnerId = 'draw';
    finishReason = 'threefold';
    lastLog = `${moveText} — 同形三復のため引き分け`;
  } else if (state.rules.fiftyMoveRule && nextHalfMoveClock >= 100) {
    phase = 'finished';
    winnerId = 'draw';
    finishReason = 'fiftyMove';
    lastLog = `${moveText} — 50手ルールにより引き分け`;
  } else if (nextInCheck) {
    lastLog = `${moveText} — チェック！`;
  }

  return {
    state: {
      ...state,
      players: nextPlayers,
      board: nextBoard,
      turnIndex: nextTurnIndex,
      castling: nextCastling,
      enPassantTarget: nextEnPassant,
      halfMoveClock: nextHalfMoveClock,
      fullMoveNumber: nextFullMoveNumber,
      positionCounts: nextPositionCounts,
      inCheck: nextInCheck,
      lastMove: {
        fromRow: matched.fromRow,
        fromCol: matched.fromCol,
        toRow: matched.toRow,
        toCol: matched.toCol,
      },
      winnerId,
      finishReason,
      phase,
      lastLog,
    },
  };
}

export function sanitizeChessState(state: ChessInternalState, playerId: string): ChessClientState {
  const isTurnPlayer =
    state.phase === 'playing' && state.players[state.turnIndex].id === playerId;
  return {
    ...state,
    myId: playerId,
    legalMoves: isTurnPlayer ? getChessLegalMoves(state) : [],
  };
}

// ============================================================================
// CPU AI (Alpha-Beta with Piece-Square Tables, MVV-LVA Ordering & Quiescence)
// ============================================================================

const PIECE_VALUES: Record<ChessPieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-Square Tables from White's perspective (row 0 = 8th rank, row 7 = 1st rank)
const PST_PAWN: readonly number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 27, 27, 10, 5, 5],
  [0, 0, 0, 24, 24, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const PST_KNIGHT: readonly number[][] = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const PST_BISHOP: readonly number[][] = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 5, 5, 10, 10, 5, 5, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];

const PST_ROOK: readonly number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [5, 10, 10, 10, 10, 10, 10, 5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [0, 0, 0, 5, 5, 0, 0, 0],
];

const PST_QUEEN: readonly number[][] = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 5, 5, 5, 0, -10],
  [-5, 0, 5, 5, 5, 5, 0, -5],
  [0, 0, 5, 5, 5, 5, 0, -5],
  [-10, 5, 5, 5, 5, 5, 0, -10],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
];

const PST_KING_MID: readonly number[][] = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20],
];

const PST_KING_END: readonly number[][] = [
  [-50, -40, -30, -20, -20, -30, -40, -50],
  [-30, -20, -10, 0, 0, -10, -20, -30],
  [-30, -10, 20, 30, 30, 20, -10, -30],
  [-30, -10, 30, 40, 40, 30, -10, -30],
  [-30, -10, 30, 40, 40, 30, -10, -30],
  [-30, -10, 20, 30, 30, 20, -10, -30],
  [-30, -30, 0, 0, 0, 0, -30, -30],
  [-50, -30, -30, -30, -30, -30, -30, -50],
];

function evaluateBoard(board: (ChessPiece | null)[][], perspective: ChessColor): number {
  let whiteMaterial = 0;
  let blackMaterial = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.type === 'k') continue;
      if (p.color === 'w') whiteMaterial += PIECE_VALUES[p.type];
      else blackMaterial += PIECE_VALUES[p.type];
    }
  }

  const isEndgame = whiteMaterial <= 1300 && blackMaterial <= 1300;
  let whiteScore = 0;
  let blackScore = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const pr = p.color === 'w' ? r : 7 - r;
      let bonus = 0;
      switch (p.type) {
        case 'p': bonus = PST_PAWN[pr][c]; break;
        case 'n': bonus = PST_KNIGHT[pr][c]; break;
        case 'b': bonus = PST_BISHOP[pr][c]; break;
        case 'r': bonus = PST_ROOK[pr][c]; break;
        case 'q': bonus = PST_QUEEN[pr][c]; break;
        case 'k': bonus = isEndgame ? PST_KING_END[pr][c] : PST_KING_MID[pr][c]; break;
      }
      const total = PIECE_VALUES[p.type] + bonus;
      if (p.color === 'w') whiteScore += total;
      else blackScore += total;
    }
  }

  const diff = whiteScore - blackScore;
  return perspective === 'w' ? diff : -diff;
}

function scoreMoveForOrdering(board: (ChessPiece | null)[][], move: ChessMove): number {
  let score = 0;
  const attacker = board[move.fromRow][move.fromCol];
  const victim = move.isEnPassant
    ? board[move.fromRow][move.toCol]
    : board[move.toRow][move.toCol];

  if (victim && attacker) {
    score += PIECE_VALUES[victim.type] * 10 - PIECE_VALUES[attacker.type];
  }
  if (move.promotion) {
    score += PIECE_VALUES[move.promotion] * 8;
  }
  if (move.isCastle) {
    score += 60;
  }
  return score;
}

interface SearchContext {
  nodes: number;
  maxNodes: number;
  deadline: number;
  aborted: boolean;
}

function quiescence(
  board: (ChessPiece | null)[][],
  color: ChessColor,
  castling: ChessCastlingRights,
  enPassantTarget: { row: number; col: number } | null,
  alpha: number,
  beta: number,
  qDepth: number,
  ctx: SearchContext
): number {
  ctx.nodes++;
  if (ctx.nodes >= ctx.maxNodes || Date.now() >= ctx.deadline) {
    ctx.aborted = true;
    return evaluateBoard(board, color);
  }

  const standPat = evaluateBoard(board, color);
  if (qDepth <= 0) return standPat;
  if (standPat >= beta) return beta;
  let localAlpha = Math.max(alpha, standPat);

  const moves = generateLegalMovesForPosition(board, color, castling, enPassantTarget);
  const tactical = moves.filter((m) => {
    if (m.promotion) return true;
    if (m.isEnPassant) return true;
    return board[m.toRow][m.toCol] !== null;
  });

  tactical.sort((a, b) => scoreMoveForOrdering(board, b) - scoreMoveForOrdering(board, a));

  for (const move of tactical) {
    const movingPiece = board[move.fromRow][move.fromCol];
    if (!movingPiece) continue;
    const nextBoard = applyMoveOnBoard(board, move);
    const nextCastling = updateCastlingRights(castling, move, movingPiece);
    const score = -quiescence(
      nextBoard,
      oppositeColor(color),
      nextCastling,
      null,
      -beta,
      -localAlpha,
      qDepth - 1,
      ctx
    );
    if (ctx.aborted) return localAlpha;
    if (score >= beta) return beta;
    if (score > localAlpha) localAlpha = score;
  }

  return localAlpha;
}

function negamax(
  board: (ChessPiece | null)[][],
  color: ChessColor,
  castling: ChessCastlingRights,
  enPassantTarget: { row: number; col: number } | null,
  depth: number,
  alpha: number,
  beta: number,
  ctx: SearchContext
): number {
  ctx.nodes++;
  if (ctx.nodes >= ctx.maxNodes || Date.now() >= ctx.deadline) {
    ctx.aborted = true;
    return evaluateBoard(board, color);
  }

  if (isInsufficientMaterial(board)) {
    return 0;
  }

  const moves = generateLegalMovesForPosition(board, color, castling, enPassantTarget);
  if (moves.length === 0) {
    if (isKingInCheck(board, color)) {
      return -50000 - depth * 100;
    }
    return 0;
  }

  if (depth <= 0) {
    return quiescence(board, color, castling, enPassantTarget, alpha, beta, 2, ctx);
  }

  moves.sort((a, b) => scoreMoveForOrdering(board, b) - scoreMoveForOrdering(board, a));

  let best = -Infinity;
  let localAlpha = alpha;

  for (const move of moves) {
    const movingPiece = board[move.fromRow][move.fromCol];
    if (!movingPiece) continue;

    const nextBoard = applyMoveOnBoard(board, move);
    const nextCastling = updateCastlingRights(castling, move, movingPiece);
    const nextEp =
      movingPiece.type === 'p' && Math.abs(move.toRow - move.fromRow) === 2
        ? { row: (move.fromRow + move.toRow) / 2, col: move.fromCol }
        : null;

    const score = -negamax(
      nextBoard,
      oppositeColor(color),
      nextCastling,
      nextEp,
      depth - 1,
      -beta,
      -localAlpha,
      ctx
    );

    if (score > best) best = score;
    if (score > localAlpha) localAlpha = score;
    if (localAlpha >= beta || ctx.aborted) break;
  }

  return best;
}

export function computeChessBotAction(
  state: ChessInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;

  const legalMoves = getChessLegalMoves(state);
  if (legalMoves.length === 0) return null;

  if (legalMoves.length === 1) {
    const m = legalMoves[0];
    return {
      type: 'move',
      payload: {
        fromRow: m.fromRow,
        fromCol: m.fromCol,
        toRow: m.toRow,
        toCol: m.toCol,
        ...(m.promotion ? { promotion: m.promotion } : {}),
      },
    };
  }

  const color = state.players[state.turnIndex].color;
  const ordered = [...legalMoves].sort(
    (a, b) => scoreMoveForOrdering(state.board, b) - scoreMoveForOrdering(state.board, a)
  );

  const ctx: SearchContext = {
    nodes: 0,
    maxNodes: 24000,
    deadline: Date.now() + 220,
    aborted: false,
  };

  let bestMove = ordered[0];
  let bestScore = -Infinity;

  // Iterative deepening (depth 2 then depth 3) so time budget always yields a strong move
  for (const searchDepth of [2, 3]) {
    let iterBestMove = ordered[0];
    let iterBestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    for (const move of ordered) {
      const movingPiece = state.board[move.fromRow][move.fromCol];
      if (!movingPiece) continue;

      const nextBoard = applyMoveOnBoard(state.board, move);
      const nextCastling = updateCastlingRights(state.castling, move, movingPiece);
      const nextEp =
        movingPiece.type === 'p' && Math.abs(move.toRow - move.fromRow) === 2
          ? { row: (move.fromRow + move.toRow) / 2, col: move.fromCol }
          : null;

      let score = -negamax(
        nextBoard,
        oppositeColor(color),
        nextCastling,
        nextEp,
        searchDepth - 1,
        -beta,
        -alpha,
        ctx
      );

      // Slight tie-break jitter for variety on equal positions
      if (!ctx.aborted) {
        score += (Math.random() - 0.5) * 4;
      }

      if (score > iterBestScore) {
        iterBestScore = score;
        iterBestMove = move;
      }
      if (score > alpha) {
        alpha = score;
      }
      if (ctx.aborted) break;
    }

    if (!ctx.aborted || searchDepth === 2) {
      bestMove = iterBestMove;
      bestScore = iterBestScore;
    }
    if (ctx.aborted || bestScore > 40000) break;
  }

  return {
    type: 'move',
    payload: {
      fromRow: bestMove.fromRow,
      fromCol: bestMove.fromCol,
      toRow: bestMove.toRow,
      toCol: bestMove.toCol,
      ...(bestMove.promotion ? { promotion: bestMove.promotion } : {}),
    },
  };
}
