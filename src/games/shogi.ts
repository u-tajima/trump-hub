import type { PlayerInfo, ShogiRules } from '../types/game';

export type ShogiPieceType = 'K' | 'R' | 'B' | 'G' | 'S' | 'N' | 'L' | 'P';
export type ShogiHandPieceType = Exclude<ShogiPieceType, 'K'>;

export interface ShogiPiece {
  type: ShogiPieceType;
  owner: 1 | 2;
  promoted: boolean;
}

export type ShogiHand = Record<ShogiHandPieceType, number>;

export interface ShogiPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  side: 1 | 2;
  hand: ShogiHand;
}

export type ShogiMove =
  | {
      kind: 'move';
      fromRow: number;
      fromCol: number;
      toRow: number;
      toCol: number;
      promote: boolean;
    }
  | {
      kind: 'drop';
      pieceType: ShogiHandPieceType;
      toRow: number;
      toCol: number;
    };

export interface ShogiInternalState {
  rules: ShogiRules;
  players: [ShogiPlayerState, ShogiPlayerState];
  board: (ShogiPiece | null)[][];
  turnIndex: 0 | 1;
  inCheck: boolean;
  lastMove: { fromRow?: number; fromCol?: number; toRow: number; toCol: number } | null;
  positionHistory: { key: string; checkedSide: 0 | 1 | 2 }[];
  winnerId: string | 'draw' | null;
  finishReason: 'checkmate' | 'sennichite' | 'perpetualCheck' | 'resign' | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface ShogiClientState extends ShogiInternalState {
  myId: string;
  legalMoves: ShogiMove[];
}

export const HAND_PIECE_ORDER: ShogiHandPieceType[] = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];

const KANJI_ROWS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const PIECE_NAMES: Record<ShogiPieceType, string> = {
  K: '玉',
  R: '飛',
  B: '角',
  G: '金',
  S: '銀',
  N: '桂',
  L: '香',
  P: '歩',
};
const PROMOTED_NAMES: Partial<Record<ShogiPieceType, string>> = {
  R: '龍',
  B: '馬',
  S: '成銀',
  N: '成桂',
  L: '成香',
  P: 'と',
};

function createEmptyHand(): ShogiHand {
  return { R: 0, B: 0, G: 0, S: 0, N: 0, L: 0, P: 0 };
}

function cloneHand(hand: ShogiHand): ShogiHand {
  return {
    R: hand.R,
    B: hand.B,
    G: hand.G,
    S: hand.S,
    N: hand.N,
    L: hand.L,
    P: hand.P,
  };
}

function cloneBoard(board: (ShogiPiece | null)[][]): (ShogiPiece | null)[][] {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function createInitialBoard(): (ShogiPiece | null)[][] {
  const board: (ShogiPiece | null)[][] = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => null)
  );
  const backRank: ShogiPieceType[] = ['L', 'N', 'S', 'G', 'K', 'G', 'S', 'N', 'L'];

  // 後手 (side 2, top, row 0..2)
  for (let c = 0; c < 9; c++) {
    board[0][c] = { type: backRank[c], owner: 2, promoted: false };
    board[2][c] = { type: 'P', owner: 2, promoted: false };
  }
  board[1][1] = { type: 'R', owner: 2, promoted: false };
  board[1][7] = { type: 'B', owner: 2, promoted: false };

  // 先手 (side 1, bottom, row 6..8)
  for (let c = 0; c < 9; c++) {
    board[8][c] = { type: backRank[c], owner: 1, promoted: false };
    board[6][c] = { type: 'P', owner: 1, promoted: false };
  }
  board[7][1] = { type: 'B', owner: 1, promoted: false };
  board[7][7] = { type: 'R', owner: 1, promoted: false };

  return board;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 9 && c >= 0 && c < 9;
}

function inPromoZone(side: 1 | 2, row: number): boolean {
  return side === 1 ? row <= 2 : row >= 6;
}

function canPiecePromote(piece: ShogiPiece): boolean {
  return !piece.promoted && piece.type !== 'K' && piece.type !== 'G';
}

function mustPromote(type: ShogiPieceType, side: 1 | 2, toRow: number): boolean {
  if (type === 'P' || type === 'L') {
    return side === 1 ? toRow === 0 : toRow === 8;
  }
  if (type === 'N') {
    return side === 1 ? toRow <= 1 : toRow >= 7;
  }
  return false;
}

function encodePositionKey(
  board: (ShogiPiece | null)[][],
  hand1: ShogiHand,
  hand2: ShogiHand,
  turnIndex: 0 | 1
): string {
  let s = '';
  for (let r = 0; r < 9; r++) {
    const row = board[r];
    for (let c = 0; c < 9; c++) {
      const p = row[c];
      if (!p) {
        s += '.';
      } else {
        s += (p.owner === 1 ? '1' : '2') + (p.promoted ? '+' : '') + p.type;
      }
    }
    s += '/';
  }
  s += '|';
  for (const pt of HAND_PIECE_ORDER) {
    s += hand1[pt];
  }
  s += '|';
  for (const pt of HAND_PIECE_ORDER) {
    s += hand2[pt];
  }
  s += '|' + turnIndex;
  return s;
}

function findKing(board: (ShogiPiece | null)[][], side: 1 | 2): { r: number; c: number } | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p && p.owner === side && p.type === 'K') {
        return { r, c };
      }
    }
  }
  return null;
}

function isGoldLike(p: ShogiPiece): boolean {
  if (p.type === 'G') return true;
  if (p.promoted && (p.type === 'S' || p.type === 'N' || p.type === 'L' || p.type === 'P')) {
    return true;
  }
  return false;
}

export function isKingInCheck(board: (ShogiPiece | null)[][], side: 1 | 2): boolean {
  const king = findKing(board, side);
  if (!king) return false;
  const { r: kr, c: kc } = king;
  const opp: 1 | 2 = side === 1 ? 2 : 1;
  // Direction the opponent advances (+1 for side 2, -1 for side 1)
  const oppFwd = opp === 1 ? -1 : 1;
  // Relative row offset from king toward where opponent's forward-attacking pieces sit
  const backFromOpp = -oppFwd;

  // 1. Pawn directly attacking king
  const pr = kr + backFromOpp;
  if (inBounds(pr, kc)) {
    const p = board[pr][kc];
    if (p && p.owner === opp && p.type === 'P' && !p.promoted) return true;
  }

  // 2. Knight jumps
  const nr = kr + 2 * backFromOpp;
  if (inBounds(nr, kc - 1)) {
    const p = board[nr][kc - 1];
    if (p && p.owner === opp && p.type === 'N' && !p.promoted) return true;
  }
  if (inBounds(nr, kc + 1)) {
    const p = board[nr][kc + 1];
    if (p && p.owner === opp && p.type === 'N' && !p.promoted) return true;
  }

  // 3. Adjacent 8 squares (King, Gold-like, Silver, Promoted R/B)
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = kr + dr;
      const cc = kc + dc;
      if (!inBounds(rr, cc)) continue;
      const p = board[rr][cc];
      if (!p || p.owner !== opp) continue;

      if (p.type === 'K') return true;

      const isDiag = dr !== 0 && dc !== 0;
      if (isDiag) {
        if (p.type === 'R' && p.promoted) return true;
        if (p.type === 'B') return true;
        if (p.type === 'S' && !p.promoted) return true; // silver attacks all 4 diagonals
        if (isGoldLike(p) && dr === backFromOpp) return true; // gold attacks forward diagonals
      } else {
        // Orthogonal adjacent
        if (p.type === 'R') return true;
        if (p.type === 'B' && p.promoted) return true;
        if (isGoldLike(p)) return true; // gold attacks all 4 orthogonals
        if (p.type === 'S' && !p.promoted && dr === backFromOpp && dc === 0) return true;
      }
    }
  }

  // 4. Orthogonal sliding rays (Rook, Dragon, Lance)
  const orthoDirs: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of orthoDirs) {
    let rr = kr + dr;
    let cc = kc + dc;
    while (inBounds(rr, cc)) {
      const p = board[rr][cc];
      if (p) {
        if (p.owner === opp) {
          if (p.type === 'R') return true;
          if (p.type === 'L' && !p.promoted && dr === backFromOpp && dc === 0) return true;
        }
        break;
      }
      rr += dr;
      cc += dc;
    }
  }

  // 5. Diagonal sliding rays (Bishop, Horse)
  const diagDirs: [number, number][] = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  for (const [dr, dc] of diagDirs) {
    let rr = kr + dr;
    let cc = kc + dc;
    while (inBounds(rr, cc)) {
      const p = board[rr][cc];
      if (p) {
        if (p.owner === opp && p.type === 'B') return true;
        break;
      }
      rr += dr;
      cc += dc;
    }
  }

  return false;
}

function getPieceTargetSquares(
  board: (ShogiPiece | null)[][],
  r: number,
  c: number,
  piece: ShogiPiece
): [number, number][] {
  const targets: [number, number][] = [];
  const f = piece.owner === 1 ? -1 : 1;

  const pushStep = (dr: number, dc: number) => {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(nr, nc)) return;
    const target = board[nr][nc];
    if (!target || target.owner !== piece.owner) {
      targets.push([nr, nc]);
    }
  };

  const pushRay = (dr: number, dc: number) => {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc)) {
      const target = board[nr][nc];
      if (!target) {
        targets.push([nr, nc]);
      } else {
        if (target.owner !== piece.owner) {
          targets.push([nr, nc]);
        }
        break;
      }
      nr += dr;
      nc += dc;
    }
  };

  if (piece.type === 'K') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr !== 0 || dc !== 0) pushStep(dr, dc);
      }
    }
    return targets;
  }

  if (isGoldLike(piece)) {
    pushStep(f, -1);
    pushStep(f, 0);
    pushStep(f, 1);
    pushStep(0, -1);
    pushStep(0, 1);
    pushStep(-f, 0);
    return targets;
  }

  if (piece.type === 'S') {
    pushStep(f, -1);
    pushStep(f, 0);
    pushStep(f, 1);
    pushStep(-f, -1);
    pushStep(-f, 1);
    return targets;
  }

  if (piece.type === 'N') {
    pushStep(2 * f, -1);
    pushStep(2 * f, 1);
    return targets;
  }

  if (piece.type === 'P') {
    pushStep(f, 0);
    return targets;
  }

  if (piece.type === 'L') {
    pushRay(f, 0);
    return targets;
  }

  if (piece.type === 'R') {
    pushRay(-1, 0);
    pushRay(1, 0);
    pushRay(0, -1);
    pushRay(0, 1);
    if (piece.promoted) {
      pushStep(-1, -1);
      pushStep(-1, 1);
      pushStep(1, -1);
      pushStep(1, 1);
    }
    return targets;
  }

  if (piece.type === 'B') {
    pushRay(-1, -1);
    pushRay(-1, 1);
    pushRay(1, -1);
    pushRay(1, 1);
    if (piece.promoted) {
      pushStep(-1, 0);
      pushStep(1, 0);
      pushStep(0, -1);
      pushStep(0, 1);
    }
    return targets;
  }

  return targets;
}

function hasUnpromotedPawnInCol(board: (ShogiPiece | null)[][], side: 1 | 2, col: number): boolean {
  for (let r = 0; r < 9; r++) {
    const p = board[r][col];
    if (p && p.owner === side && p.type === 'P' && !p.promoted) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if `side` has at least one legal move (ignoring uchifuzume check,
 * used both for uchifuzume detection and checkmate detection).
 */
function hasAnyLegalResponse(
  board: (ShogiPiece | null)[][],
  hand: ShogiHand,
  side: 1 | 2
): boolean {
  // 1. Try board moves
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (!piece || piece.owner !== side) continue;
      const targets = getPieceTargetSquares(board, r, c, piece);
      for (const [nr, nc] of targets) {
        const captured = board[nr][nc];
        board[nr][nc] = piece;
        board[r][c] = null;
        const stillInCheck = isKingInCheck(board, side);
        board[r][c] = piece;
        board[nr][nc] = captured;
        if (!stillInCheck) return true;
      }
    }
  }

  // 2. Try drops
  for (const pt of HAND_PIECE_ORDER) {
    if (hand[pt] <= 0) continue;
    for (let r = 0; r < 9; r++) {
      if (mustPromote(pt, side, r)) continue;
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== null) continue;
        if (pt === 'P' && hasUnpromotedPawnInCol(board, side, c)) continue;
        board[r][c] = { type: pt, owner: side, promoted: false };
        const stillInCheck = isKingInCheck(board, side);
        board[r][c] = null;
        if (!stillInCheck) return true;
      }
    }
  }

  return false;
}

function generateLegalMovesInternal(
  board: (ShogiPiece | null)[][],
  myHand: ShogiHand,
  oppHand: ShogiHand,
  side: 1 | 2,
  uchifuzumeBan: boolean
): ShogiMove[] {
  const moves: ShogiMove[] = [];
  const opp: 1 | 2 = side === 1 ? 2 : 1;
  const f = side === 1 ? -1 : 1;

  // 1. Board moves
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (!piece || piece.owner !== side) continue;
      const targets = getPieceTargetSquares(board, r, c, piece);
      for (const [nr, nc] of targets) {
        const captured = board[nr][nc];
        board[nr][nc] = piece;
        board[r][c] = null;
        const selfCheck = isKingInCheck(board, side);
        board[r][c] = piece;
        board[nr][nc] = captured;
        if (selfCheck) continue;

        const canPromo =
          canPiecePromote(piece) && (inPromoZone(side, r) || inPromoZone(side, nr));
        const forcedPromo = !piece.promoted && mustPromote(piece.type, side, nr);

        if (forcedPromo) {
          moves.push({ kind: 'move', fromRow: r, fromCol: c, toRow: nr, toCol: nc, promote: true });
        } else if (canPromo) {
          moves.push({ kind: 'move', fromRow: r, fromCol: c, toRow: nr, toCol: nc, promote: true });
          moves.push({ kind: 'move', fromRow: r, fromCol: c, toRow: nr, toCol: nc, promote: false });
        } else {
          moves.push({ kind: 'move', fromRow: r, fromCol: c, toRow: nr, toCol: nc, promote: false });
        }
      }
    }
  }

  // 2. Drops
  const oppKing = uchifuzumeBan ? findKing(board, opp) : null;

  for (const pt of HAND_PIECE_ORDER) {
    if (myHand[pt] <= 0) continue;
    for (let r = 0; r < 9; r++) {
      if (mustPromote(pt, side, r)) continue;
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== null) continue;
        if (pt === 'P' && hasUnpromotedPawnInCol(board, side, c)) continue;

        board[r][c] = { type: pt, owner: side, promoted: false };
        const selfCheck = isKingInCheck(board, side);
        if (!selfCheck) {
          let isUchifuzume = false;
          // Uchifuzume can only happen if a pawn is dropped directly in front of opponent's king
          if (
            uchifuzumeBan &&
            pt === 'P' &&
            oppKing &&
            r + f === oppKing.r &&
            c === oppKing.c
          ) {
            if (!hasAnyLegalResponse(board, oppHand, opp)) {
              isUchifuzume = true;
            }
          }
          if (!isUchifuzume) {
            moves.push({ kind: 'drop', pieceType: pt, toRow: r, toCol: c });
          }
        }
        board[r][c] = null;
      }
    }
  }

  return moves;
}

export function getShogiLegalMoves(state: ShogiInternalState, side?: 1 | 2): ShogiMove[] {
  if (state.phase !== 'playing') return [];
  const targetSide = side ?? state.players[state.turnIndex].side;
  const myPlayer = state.players.find((p) => p.side === targetSide);
  const oppPlayer = state.players.find((p) => p.side !== targetSide);
  if (!myPlayer || !oppPlayer) return [];

  // Work on a shallow-cloned board to guarantee purity
  const boardCopy = cloneBoard(state.board);
  return generateLegalMovesInternal(
    boardCopy,
    myPlayer.hand,
    oppPlayer.hand,
    targetSide,
    state.rules.uchifuzumeBan
  );
}

export function initShogi(playersInfo: PlayerInfo[], rules: ShogiRules): ShogiInternalState {
  const p1Info = playersInfo[0] ?? {
    id: 'p1',
    name: '先手',
    isHost: true,
    isBot: false,
    connected: true,
  };
  const p2Info = playersInfo[1] ?? {
    id: 'p2',
    name: '後手',
    isHost: false,
    isBot: true,
    connected: true,
  };

  const p1: ShogiPlayerState = {
    id: p1Info.id,
    name: p1Info.name,
    isBot: p1Info.isBot,
    side: 1,
    hand: createEmptyHand(),
  };
  const p2: ShogiPlayerState = {
    id: p2Info.id,
    name: p2Info.name,
    isBot: p2Info.isBot,
    side: 2,
    hand: createEmptyHand(),
  };

  const board = createInitialBoard();
  const initialKey = encodePositionKey(board, p1.hand, p2.hand, 0);

  return {
    rules: { ...rules },
    players: [p1, p2],
    board,
    turnIndex: 0,
    inCheck: false,
    lastMove: null,
    positionHistory: [{ key: initialKey, checkedSide: 0 }],
    winnerId: null,
    finishReason: null,
    phase: 'playing',
    lastLog: `対局開始！ ${p1.name}（先手）の番です`,
  };
}

function formatCoord(row: number, col: number): string {
  const file = 9 - col;
  const rank = KANJI_ROWS[row] ?? String(row + 1);
  return `${file}${rank}`;
}

function formatMoveLog(
  player: ShogiPlayerState,
  move: ShogiMove,
  movedPiece: ShogiPiece | null,
  inCheckAfter: boolean
): string {
  const sideLabel = player.side === 1 ? '先手' : '後手';
  const dest = formatCoord(move.toRow, move.toCol);
  let desc: string;
  if (move.kind === 'drop') {
    desc = `${dest}${PIECE_NAMES[move.pieceType]}打`;
  } else {
    const pType = movedPiece?.type ?? 'P';
    const wasPromoted = movedPiece?.promoted ?? false;
    const baseName = wasPromoted ? (PROMOTED_NAMES[pType] ?? PIECE_NAMES[pType]) : PIECE_NAMES[pType];
    desc = `${dest}${baseName}${move.promote ? '成' : ''}`;
  }
  return `${player.name}（${sideLabel}）: ${desc}${inCheckAfter ? '（王手）' : ''}`;
}

function detectSennichite(
  history: { key: string; checkedSide: 0 | 1 | 2 }[]
): { kind: 'none' } | { kind: 'sennichite' } | { kind: 'perpetualCheck'; loserSide: 1 | 2 } {
  const last = history[history.length - 1];
  const indices: number[] = [];
  for (let i = 0; i < history.length; i++) {
    if (history[i].key === last.key) {
      indices.push(i);
    }
  }
  if (indices.length < 4) return { kind: 'none' };

  const firstIdx = indices[0];
  let hasSide1Turn = false;
  let allSide1InCheck = true;
  let hasSide2Turn = false;
  let allSide2InCheck = true;

  for (let i = firstIdx; i < history.length; i++) {
    // Index 0 is side 1's turn, index 1 is side 2's turn, etc.
    const turnSide: 1 | 2 = i % 2 === 0 ? 1 : 2;
    if (turnSide === 1) {
      hasSide1Turn = true;
      if (history[i].checkedSide !== 1) allSide1InCheck = false;
    } else {
      hasSide2Turn = true;
      if (history[i].checkedSide !== 2) allSide2InCheck = false;
    }
  }

  // Side 1 continuously checked Side 2 -> Side 1 loses
  const side1Perpetual = hasSide2Turn && allSide2InCheck;
  // Side 2 continuously checked Side 1 -> Side 2 loses
  const side2Perpetual = hasSide1Turn && allSide1InCheck;

  if (side1Perpetual && !side2Perpetual) {
    return { kind: 'perpetualCheck', loserSide: 1 };
  }
  if (side2Perpetual && !side1Perpetual) {
    return { kind: 'perpetualCheck', loserSide: 2 };
  }
  return { kind: 'sennichite' };
}

function isSameMove(a: ShogiMove, b: ShogiMove): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'drop' && b.kind === 'drop') {
    return a.pieceType === b.pieceType && a.toRow === b.toRow && a.toCol === b.toCol;
  }
  if (a.kind === 'move' && b.kind === 'move') {
    return (
      a.fromRow === b.fromRow &&
      a.fromCol === b.fromCol &&
      a.toRow === b.toRow &&
      a.toCol === b.toCol &&
      a.promote === b.promote
    );
  }
  return false;
}

export function applyShogiAction(
  state: ShogiInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: ShogiInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: '対局はすでに終了しています' };
  }

  if (action.type === 'resign') {
    const resignIdx = state.players.findIndex((p) => p.id === playerId);
    if (resignIdx === -1) {
      return { state, error: '対局者が見つかりません' };
    }
    const resignPlayer = state.players[resignIdx];
    const winner = state.players[resignIdx === 0 ? 1 : 0];
    return {
      state: {
        ...state,
        phase: 'finished',
        winnerId: winner.id,
        finishReason: 'resign',
        lastLog: `${resignPlayer.name} が投了しました。${winner.name} の勝利！`,
      },
    };
  }

  const currentPlayer = state.players[state.turnIndex];
  if (currentPlayer.id !== playerId) {
    return { state, error: 'あなたの手番ではありません' };
  }

  let candidateMove: ShogiMove | null = null;
  if (action.type === 'move') {
    const p = action.payload as {
      fromRow?: unknown;
      fromCol?: unknown;
      toRow?: unknown;
      toCol?: unknown;
      promote?: unknown;
    } | null;
    if (
      !p ||
      typeof p.fromRow !== 'number' ||
      typeof p.fromCol !== 'number' ||
      typeof p.toRow !== 'number' ||
      typeof p.toCol !== 'number'
    ) {
      return { state, error: '不正な移動データです' };
    }
    candidateMove = {
      kind: 'move',
      fromRow: p.fromRow,
      fromCol: p.fromCol,
      toRow: p.toRow,
      toCol: p.toCol,
      promote: Boolean(p.promote),
    };
  } else if (action.type === 'drop') {
    const p = action.payload as {
      pieceType?: unknown;
      toRow?: unknown;
      toCol?: unknown;
    } | null;
    if (
      !p ||
      typeof p.pieceType !== 'string' ||
      !HAND_PIECE_ORDER.includes(p.pieceType as ShogiHandPieceType) ||
      typeof p.toRow !== 'number' ||
      typeof p.toCol !== 'number'
    ) {
      return { state, error: '不正な打ちデータです' };
    }
    candidateMove = {
      kind: 'drop',
      pieceType: p.pieceType as ShogiHandPieceType,
      toRow: p.toRow,
      toCol: p.toCol,
    };
  } else {
    return { state, error: '未対応のアクションです' };
  }

  const legalMoves = getShogiLegalMoves(state, currentPlayer.side);
  const matched = legalMoves.find((m) => isSameMove(m, candidateMove));
  if (!matched) {
    return { state, error: '反則手または非合法な手です' };
  }

  const nextBoard = cloneBoard(state.board);
  const nextPlayers: [ShogiPlayerState, ShogiPlayerState] = [
    { ...state.players[0], hand: cloneHand(state.players[0].hand) },
    { ...state.players[1], hand: cloneHand(state.players[1].hand) },
  ];
  const mover = nextPlayers[state.turnIndex];
  const nextTurnIndex: 0 | 1 = state.turnIndex === 0 ? 1 : 0;
  const opponent = nextPlayers[nextTurnIndex];

  let movedPieceBefore: ShogiPiece | null = null;
  let lastMove: ShogiInternalState['lastMove'];

  if (matched.kind === 'move') {
    const piece = nextBoard[matched.fromRow][matched.fromCol]!;
    movedPieceBefore = { ...piece };
    const captured = nextBoard[matched.toRow][matched.toCol];
    if (captured && captured.type !== 'K') {
      mover.hand[captured.type] += 1;
    }
    nextBoard[matched.toRow][matched.toCol] = {
      type: piece.type,
      owner: piece.owner,
      promoted: piece.promoted || matched.promote,
    };
    nextBoard[matched.fromRow][matched.fromCol] = null;
    lastMove = {
      fromRow: matched.fromRow,
      fromCol: matched.fromCol,
      toRow: matched.toRow,
      toCol: matched.toCol,
    };
  } else {
    mover.hand[matched.pieceType] -= 1;
    nextBoard[matched.toRow][matched.toCol] = {
      type: matched.pieceType,
      owner: mover.side,
      promoted: false,
    };
    lastMove = {
      toRow: matched.toRow,
      toCol: matched.toCol,
    };
  }

  const nextInCheck = isKingInCheck(nextBoard, opponent.side);
  const nextKey = encodePositionKey(nextBoard, nextPlayers[0].hand, nextPlayers[1].hand, nextTurnIndex);
  const nextHistory = [
    ...state.positionHistory,
    { key: nextKey, checkedSide: (nextInCheck ? opponent.side : 0) as 0 | 1 | 2 },
  ];

  const baseLog = formatMoveLog(mover, matched, movedPieceBefore, nextInCheck);

  // Check checkmate (opponent has 0 legal moves)
  const opponentLegalMoves = generateLegalMovesInternal(
    cloneBoard(nextBoard),
    opponent.hand,
    mover.hand,
    opponent.side,
    state.rules.uchifuzumeBan
  );

  if (opponentLegalMoves.length === 0) {
    return {
      state: {
        ...state,
        players: nextPlayers,
        board: nextBoard,
        turnIndex: nextTurnIndex,
        inCheck: nextInCheck,
        lastMove,
        positionHistory: nextHistory,
        winnerId: mover.id,
        finishReason: 'checkmate',
        phase: 'finished',
        lastLog: `${baseLog} — 詰み！ ${mover.name} の勝利！`,
      },
    };
  }

  // Check sennichite & perpetual check
  if (state.rules.sennichiteRule) {
    const rep = detectSennichite(nextHistory);
    if (rep.kind === 'perpetualCheck') {
      const winner = nextPlayers.find((p) => p.side !== rep.loserSide)!;
      const loser = nextPlayers.find((p) => p.side === rep.loserSide)!;
      return {
        state: {
          ...state,
          players: nextPlayers,
          board: nextBoard,
          turnIndex: nextTurnIndex,
          inCheck: nextInCheck,
          lastMove,
          positionHistory: nextHistory,
          winnerId: winner.id,
          finishReason: 'perpetualCheck',
          phase: 'finished',
          lastLog: `連続王手の千日手により ${loser.name} の反則負け。${winner.name} の勝利！`,
        },
      };
    }
    if (rep.kind === 'sennichite') {
      return {
        state: {
          ...state,
          players: nextPlayers,
          board: nextBoard,
          turnIndex: nextTurnIndex,
          inCheck: nextInCheck,
          lastMove,
          positionHistory: nextHistory,
          winnerId: 'draw',
          finishReason: 'sennichite',
          phase: 'finished',
          lastLog: '千日手成立（同一局面4回）により引き分け！',
        },
      };
    }
  }

  return {
    state: {
      ...state,
      players: nextPlayers,
      board: nextBoard,
      turnIndex: nextTurnIndex,
      inCheck: nextInCheck,
      lastMove,
      positionHistory: nextHistory,
      winnerId: null,
      finishReason: null,
      phase: 'playing',
      lastLog: baseLog,
    },
  };
}

// ===== CPU AI (Depth-2 Alpha-Beta Search) =====

const BOARD_VALUE: Record<ShogiPieceType, number> = {
  P: 100,
  L: 340,
  N: 400,
  S: 540,
  G: 600,
  B: 860,
  R: 1000,
  K: 15000,
};

const PROMOTED_VALUE: Record<ShogiPieceType, number> = {
  P: 540,
  L: 540,
  N: 550,
  S: 580,
  G: 600,
  B: 1160,
  R: 1320,
  K: 15000,
};

const HAND_VALUE: Record<ShogiHandPieceType, number> = {
  P: 115,
  L: 370,
  N: 430,
  S: 580,
  G: 650,
  B: 930,
  R: 1080,
};

function evaluatePosition(
  board: (ShogiPiece | null)[][],
  hand1: ShogiHand,
  hand2: ShogiHand,
  botSide: 1 | 2
): number {
  let score = 0;
  let k1r = -1;
  let k1c = -1;
  let k2r = -1;
  let k2c = -1;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (!p) continue;
      const sign = p.owner === botSide ? 1 : -1;
      const val = p.promoted ? PROMOTED_VALUE[p.type] : BOARD_VALUE[p.type];
      let posBonus = 0;

      if (p.type === 'K') {
        if (p.owner === 1) {
          k1r = r;
          k1c = c;
        } else {
          k2r = r;
          k2c = c;
        }
        // King prefers staying on home 2 ranks and away from center file 4
        const homeDist = p.owner === 1 ? 8 - r : r;
        posBonus = homeDist <= 1 ? 35 : -homeDist * 18;
        if (c <= 2 || c >= 6) posBonus += 25;
      } else {
        // Advancement toward enemy camp
        const progress = p.owner === 1 ? 8 - r : r;
        posBonus += progress * (p.promoted ? 8 : 5);
        // Central control bonus
        const centerDist = Math.abs(4 - c);
        posBonus += (4 - centerDist) * 4;
      }

      score += sign * (val + posBonus);
    }
  }

  // Hand material
  for (const pt of HAND_PIECE_ORDER) {
    const v = HAND_VALUE[pt];
    score += (botSide === 1 ? 1 : -1) * hand1[pt] * v;
    score += (botSide === 2 ? 1 : -1) * hand2[pt] * v;
  }

  // King safety: friendly gold/silver guards adjacent to king
  const evalKingSafety = (kr: number, kc: number, owner: 1 | 2) => {
    if (kr === -1) return 0;
    let guards = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = kr + dr;
        const nc = kc + dc;
        if (!inBounds(nr, nc)) continue;
        const p = board[nr][nc];
        if (p && p.owner === owner && (p.type === 'G' || p.type === 'S' || p.promoted)) {
          guards += 1;
        }
      }
    }
    return guards * 32;
  };

  score += (botSide === 1 ? 1 : -1) * evalKingSafety(k1r, k1c, 1);
  score += (botSide === 2 ? 1 : -1) * evalKingSafety(k2r, k2c, 2);

  // Check bonus / penalty
  const oppSide: 1 | 2 = botSide === 1 ? 2 : 1;
  if (isKingInCheck(board, oppSide)) score += 45;
  if (isKingInCheck(board, botSide)) score -= 50;

  return score;
}

function scoreMoveForOrdering(
  board: (ShogiPiece | null)[][],
  move: ShogiMove,
  side: 1 | 2,
  oppKing: { r: number; c: number } | null,
  myKing: { r: number; c: number } | null
): number {
  if (move.kind === 'move') {
    const mover = board[move.fromRow][move.fromCol];
    const target = board[move.toRow][move.toCol];
    let s = 140;

    if (target) {
      const targetVal = target.promoted ? PROMOTED_VALUE[target.type] : BOARD_VALUE[target.type];
      const moverVal = mover
        ? mover.type === 'K'
          ? 200
          : mover.promoted
            ? PROMOTED_VALUE[mover.type]
            : BOARD_VALUE[mover.type]
        : 100;
      s += 860 + targetVal * 2 - moverVal * 0.1;
    }

    if (move.promote) {
      s += 450;
    }

    if (mover) {
      const moverVal =
        mover.type === 'K'
          ? 250
          : mover.promoted
            ? PROMOTED_VALUE[mover.type]
            : BOARD_VALUE[mover.type];
      s += Math.min(moverVal * 0.08, 90);
    }

    const forwardDelta = side === 1 ? move.fromRow - move.toRow : move.toRow - move.fromRow;
    s += Math.max(-25, Math.min(60, forwardDelta * 20));
    s += (4 - Math.abs(4 - move.toCol)) * 6;

    if (oppKing) {
      const distOpp = Math.max(Math.abs(move.toRow - oppKing.r), Math.abs(move.toCol - oppKing.c));
      if (distOpp <= 2) {
        s += (3 - distOpp) * 55;
      }
    }

    return s;
  }

  // Drop move: keep base score modest so board moves are not crowded out,
  // while prioritizing tactical drops near either king or along major lines.
  let s = 40 + HAND_VALUE[move.pieceType] * 0.06;

  if (oppKing) {
    const dr = Math.abs(move.toRow - oppKing.r);
    const dc = Math.abs(move.toCol - oppKing.c);
    const distOpp = Math.max(dr, dc);
    if (distOpp === 1) {
      s += 190;
    } else if (distOpp === 2) {
      s += 95;
    } else if (
      (move.pieceType === 'R' && (dr === 0 || dc === 0)) ||
      (move.pieceType === 'B' && dr === dc) ||
      (move.pieceType === 'L' &&
        dc === 0 &&
        ((side === 1 && move.toRow > oppKing.r) || (side === 2 && move.toRow < oppKing.r)))
    ) {
      s += 60;
    }
  }

  if (myKing) {
    const distMy = Math.max(Math.abs(move.toRow - myKing.r), Math.abs(move.toCol - myKing.c));
    if (distMy === 1) {
      s += 120;
    } else if (distMy === 2) {
      s += 55;
    }
  }

  if (inPromoZone(side, move.toRow)) {
    s += 35;
  }

  return s;
}

function applyMoveInPlace(
  board: (ShogiPiece | null)[][],
  hand: ShogiHand,
  side: 1 | 2,
  move: ShogiMove
): { captured: ShogiPiece | null; prevPromoted: boolean } {
  if (move.kind === 'move') {
    const piece = board[move.fromRow][move.fromCol]!;
    const captured = board[move.toRow][move.toCol];
    const prevPromoted = piece.promoted;
    if (captured && captured.type !== 'K') {
      hand[captured.type] += 1;
    }
    board[move.toRow][move.toCol] = {
      type: piece.type,
      owner: side,
      promoted: prevPromoted || move.promote,
    };
    board[move.fromRow][move.fromCol] = null;
    return { captured, prevPromoted };
  } else {
    hand[move.pieceType] -= 1;
    board[move.toRow][move.toCol] = {
      type: move.pieceType,
      owner: side,
      promoted: false,
    };
    return { captured: null, prevPromoted: false };
  }
}

function undoMoveInPlace(
  board: (ShogiPiece | null)[][],
  hand: ShogiHand,
  side: 1 | 2,
  move: ShogiMove,
  undo: { captured: ShogiPiece | null; prevPromoted: boolean }
): void {
  if (move.kind === 'move') {
    const moved = board[move.toRow][move.toCol]!;
    board[move.fromRow][move.fromCol] = {
      type: moved.type,
      owner: side,
      promoted: undo.prevPromoted,
    };
    board[move.toRow][move.toCol] = undo.captured;
    if (undo.captured && undo.captured.type !== 'K') {
      hand[undo.captured.type] -= 1;
    }
  } else {
    board[move.toRow][move.toCol] = null;
    hand[move.pieceType] += 1;
  }
}

export function computeShogiBotAction(
  state: ShogiInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  const botPlayer = state.players[state.turnIndex];
  const oppIndex: 0 | 1 = state.turnIndex === 0 ? 1 : 0;
  const oppPlayer = state.players[oppIndex];
  const botSide = botPlayer.side;
  const oppSide = oppPlayer.side;

  const legalMoves = getShogiLegalMoves(state, botSide);
  if (legalMoves.length === 0) return null;

  const board = cloneBoard(state.board);
  const hand1 = cloneHand(state.players[0].hand);
  const hand2 = cloneHand(state.players[1].hand);
  const botHand = botSide === 1 ? hand1 : hand2;
  const oppHand = botSide === 1 ? hand2 : hand1;

  // Order root moves for faster alpha-beta pruning
  const rootOppKing = findKing(board, oppSide);
  const rootMyKing = findKing(board, botSide);
  legalMoves.sort(
    (a, b) =>
      scoreMoveForOrdering(board, b, botSide, rootOppKing, rootMyKing) -
      scoreMoveForOrdering(board, a, botSide, rootOppKing, rootMyKing)
  );

  // Count existing occurrences of positions for repetition avoidance
  const keyCounts = new Map<string, number>();
  for (const entry of state.positionHistory) {
    keyCounts.set(entry.key, (keyCounts.get(entry.key) ?? 0) + 1);
  }

  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const TIME_BUDGET_MS = 45;

  let bestMove = legalMoves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;

  // Cap root branching if huge number of drops exist
  const rootLimit = Math.min(legalMoves.length, 55);

  for (let i = 0; i < rootLimit; i++) {
    const move = legalMoves[i];
    const undo = applyMoveInPlace(board, botHand, botSide, move);

    let score: number;
    const oppInCheck = isKingInCheck(board, oppSide);
    const nextKey = encodePositionKey(board, hand1, hand2, oppIndex);
    const prevCount = keyCounts.get(nextKey) ?? 0;

    // Check repetition
    let repPenalty = 0;
    if (state.rules.sennichiteRule && prevCount >= 3) {
      const simHistory = [
        ...state.positionHistory,
        { key: nextKey, checkedSide: (oppInCheck ? oppSide : 0) as 0 | 1 | 2 },
      ];
      const rep = detectSennichite(simHistory);
      if (rep.kind === 'perpetualCheck') {
        score = rep.loserSide === botSide ? -900000 : 900000;
        undoMoveInPlace(board, botHand, botSide, move, undo);
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
          alpha = Math.max(alpha, score);
        }
        continue;
      } else if (rep.kind === 'sennichite') {
        score = -40; // slightly prefer non-draw unless losing
        undoMoveInPlace(board, botHand, botSide, move, undo);
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
          alpha = Math.max(alpha, score);
        }
        continue;
      }
    } else if (prevCount >= 1) {
      repPenalty = -25 * prevCount;
    }

    // Generate opponent replies (ply 2)
    const oppMoves = generateLegalMovesInternal(
      board,
      oppHand,
      botHand,
      oppSide,
      false // skip uchifuzume at ply-2 for speed
    );

    if (oppMoves.length === 0) {
      // Immediate checkmate!
      undoMoveInPlace(board, botHand, botSide, move, undo);
      return move.kind === 'move'
        ? { type: 'move', payload: { fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol, promote: move.promote } }
        : { type: 'drop', payload: { pieceType: move.pieceType, toRow: move.toRow, toCol: move.toCol } };
    }

    // Order opponent replies (captures/promotions first) for quick beta cutoff
    const replyBotKing = findKing(board, botSide);
    const replyOppKing = findKing(board, oppSide);
    oppMoves.sort(
      (a, b) =>
        scoreMoveForOrdering(board, b, oppSide, replyBotKing, replyOppKing) -
        scoreMoveForOrdering(board, a, oppSide, replyBotKing, replyOppKing)
    );
    const replyLimit = Math.min(oppMoves.length, 32);

    let minScore = Infinity;
    for (let j = 0; j < replyLimit; j++) {
      const reply = oppMoves[j];
      const undo2 = applyMoveInPlace(board, oppHand, oppSide, reply);
      const evalScore = evaluatePosition(board, hand1, hand2, botSide);
      undoMoveInPlace(board, oppHand, oppSide, reply, undo2);

      if (evalScore < minScore) {
        minScore = evalScore;
      }
      if (minScore <= alpha) {
        break; // Alpha-beta cutoff
      }
    }

    score = minScore + repPenalty + (Math.random() * 6 - 3);
    undoMoveInPlace(board, botHand, botSide, move, undo);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      alpha = Math.max(alpha, score);
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (i >= 10 && now - startTime > TIME_BUDGET_MS) {
      break;
    }
  }

  if (bestMove.kind === 'move') {
    return {
      type: 'move',
      payload: {
        fromRow: bestMove.fromRow,
        fromCol: bestMove.fromCol,
        toRow: bestMove.toRow,
        toCol: bestMove.toCol,
        promote: bestMove.promote,
      },
    };
  }
  return {
    type: 'drop',
    payload: {
      pieceType: bestMove.pieceType,
      toRow: bestMove.toRow,
      toCol: bestMove.toCol,
    },
  };
}

export function sanitizeShogiState(
  state: ShogiInternalState,
  playerId: string
): ShogiClientState {
  const currentPlayer = state.players[state.turnIndex];
  const legalMoves =
    state.phase === 'playing' && currentPlayer.id === playerId
      ? getShogiLegalMoves(state, currentPlayer.side)
      : [];

  return {
    ...state,
    myId: playerId,
    legalMoves,
  };
}
