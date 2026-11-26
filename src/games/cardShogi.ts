import type { CardShogiRules, PlayerInfo } from '../types/game';

export interface MoveCardDef {
  id: string;
  name: string;
  accent: string;
  /** P0視点（上方向が前: dr < 0）の相対移動ベクトル [dr, dc] */
  moves: readonly [number, number][];
}

export const CARD_SHOGI_DECK: readonly MoveCardDef[] = [
  { id: 'tiger', name: '虎', accent: '#f59e0b', moves: [[-2, 0], [1, 0]] },
  {
    id: 'dragon',
    name: '龍',
    accent: '#ef4444',
    moves: [
      [-1, -2],
      [-1, 2],
      [1, -1],
      [1, 1],
    ],
  },
  {
    id: 'frog',
    name: '蛙',
    accent: '#22c55e',
    moves: [
      [0, -2],
      [-1, -1],
      [1, 1],
    ],
  },
  {
    id: 'rabbit',
    name: '兎',
    accent: '#38bdf8',
    moves: [
      [0, 2],
      [-1, 1],
      [1, -1],
    ],
  },
  {
    id: 'crab',
    name: '蟹',
    accent: '#fb923c',
    moves: [
      [-1, 0],
      [0, -2],
      [0, 2],
    ],
  },
  {
    id: 'elephant',
    name: '象',
    accent: '#a78bfa',
    moves: [
      [-1, -1],
      [-1, 1],
      [0, -1],
      [0, 1],
    ],
  },
  {
    id: 'goose',
    name: '鵞鳥',
    accent: '#34d399',
    moves: [
      [0, -1],
      [-1, -1],
      [0, 1],
      [1, 1],
    ],
  },
  {
    id: 'rooster',
    name: '雄鶏',
    accent: '#f43f5e',
    moves: [
      [0, -1],
      [1, -1],
      [0, 1],
      [-1, 1],
    ],
  },
  {
    id: 'monkey',
    name: '猿',
    accent: '#eab308',
    moves: [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ],
  },
  {
    id: 'mantis',
    name: '蟷螂',
    accent: '#84cc16',
    moves: [
      [-1, -1],
      [-1, 1],
      [1, 0],
    ],
  },
  {
    id: 'horse',
    name: '馬',
    accent: '#f97316',
    moves: [
      [-1, 0],
      [0, -1],
      [1, 0],
    ],
  },
  {
    id: 'ox',
    name: '牛',
    accent: '#60a5fa',
    moves: [
      [-1, 0],
      [0, 1],
      [1, 0],
    ],
  },
  {
    id: 'crane',
    name: '鶴',
    accent: '#e2e8f0',
    moves: [
      [-1, 0],
      [1, -1],
      [1, 1],
    ],
  },
  {
    id: 'boar',
    name: '猪',
    accent: '#d97706',
    moves: [
      [-1, 0],
      [0, -1],
      [0, 1],
    ],
  },
  {
    id: 'eel',
    name: '鰻',
    accent: '#06b6d4',
    moves: [
      [-1, -1],
      [1, -1],
      [0, 1],
    ],
  },
  {
    id: 'cobra',
    name: 'コブラ',
    accent: '#ec4899',
    moves: [
      [0, -1],
      [-1, 1],
      [1, 1],
    ],
  },
];

const CARD_MAP = new Map<string, MoveCardDef>(CARD_SHOGI_DECK.map((c) => [c.id, c]));

export function getMoveCardDef(cardId: string): MoveCardDef | undefined {
  return CARD_MAP.get(cardId);
}

export interface CardShogiPiece {
  owner: 0 | 1;
  role: 'master' | 'student';
}

export interface CardShogiPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  side: 0 | 1; // 0: 下側 (row 4 初期), 1: 上側 (row 0 初期)
  cards: [string, string];
}

export interface CardShogiMove {
  cardId: string;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export interface CardShogiLastMove {
  kind: 'move' | 'pass';
  side: 0 | 1;
  cardId: string;
  fromRow?: number;
  fromCol?: number;
  toRow?: number;
  toCol?: number;
}

export interface CardShogiInternalState {
  rules: CardShogiRules;
  players: [CardShogiPlayerState, CardShogiPlayerState];
  board: (CardShogiPiece | null)[][]; // 5x5
  centerCard: string;
  turnIndex: 0 | 1;
  moveCount: number;
  lastMove: CardShogiLastMove | null;
  winReason: 'capture' | 'temple' | null;
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface CardShogiClientState extends CardShogiInternalState {
  myId: string;
  validMoves: CardShogiMove[];
  canPass: boolean;
}

const BOARD_SIZE = 5;

function isValidCoord(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < BOARD_SIZE;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function cloneBoard(board: (CardShogiPiece | null)[][]): (CardShogiPiece | null)[][] {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

/**
 * 指定プレイヤー視点の移動ベクトルを返す（P1は180度反転）
 */
export function getCardVectorsForSide(cardId: string, side: 0 | 1): [number, number][] {
  const def = CARD_MAP.get(cardId);
  if (!def) return [];
  if (side === 0) {
    return def.moves.map(([dr, dc]) => [dr, dc]);
  }
  return def.moves.map(([dr, dc]) => [-dr, -dc]);
}

export function getLegalMovesForSide(
  board: (CardShogiPiece | null)[][],
  cards: readonly [string, string],
  side: 0 | 1
): CardShogiMove[] {
  const moves: CardShogiMove[] = [];
  for (const cardId of cards) {
    const vectors = getCardVectorsForSide(cardId, side);
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = board[r][c];
        if (!piece || piece.owner !== side) continue;
        for (const [dr, dc] of vectors) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const target = board[nr][nc];
          if (target && target.owner === side) continue;
          moves.push({ cardId, fromRow: r, fromCol: c, toRow: nr, toCol: nc });
        }
      }
    }
  }
  return moves;
}

function shuffleIds(): string[] {
  const ids = CARD_SHOGI_DECK.map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export function initCardShogi(
  playersInfo: PlayerInfo[],
  rules: CardShogiRules
): CardShogiInternalState {
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

  const board: (CardShogiPiece | null)[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array<CardShogiPiece | null>(BOARD_SIZE).fill(null)
  );

  for (let c = 0; c < BOARD_SIZE; c++) {
    board[0][c] = { owner: 1, role: c === 2 ? 'master' : 'student' };
    board[4][c] = { owner: 0, role: c === 2 ? 'master' : 'student' };
  }

  const picked = shuffleIds().slice(0, 5);

  return {
    rules: { allowTempleWin: rules.allowTempleWin ?? true },
    players: [
      {
        id: p0.id,
        name: p0.name,
        isBot: p0.isBot,
        side: 0,
        cards: [picked[0], picked[1]],
      },
      {
        id: p1.id,
        name: p1.name,
        isBot: p1.isBot,
        side: 1,
        cards: [picked[2], picked[3]],
      },
    ],
    board,
    centerCard: picked[4],
    turnIndex: 0,
    moveCount: 0,
    lastMove: null,
    winReason: null,
    winnerId: null,
    phase: 'playing',
    lastLog: `${p0.name} の先手で対局開始！`,
  };
}

export function applyCardShogiAction(
  state: CardShogiInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: CardShogiInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: '対局はすでに終了しています' };
  }

  const current = state.players[state.turnIndex];
  if (current.id !== playerId) {
    return { state, error: 'あなたの手番ではありません' };
  }

  const side = current.side;
  const oppSide: 0 | 1 = side === 0 ? 1 : 0;

  if (action.type === 'pass') {
    const payload = action.payload as { cardId?: unknown } | undefined;
    if (!payload || typeof payload.cardId !== 'string') {
      return { state, error: '交換するカードを指定してください' };
    }
    const cardIdx = current.cards.indexOf(payload.cardId);
    if (cardIdx === -1) {
      return { state, error: 'そのカードは手元にありません' };
    }
    const legal = getLegalMovesForSide(state.board, current.cards, side);
    if (legal.length > 0) {
      return { state, error: '動かせる手があるためパスできません' };
    }

    const nextPlayers: [CardShogiPlayerState, CardShogiPlayerState] = [
      { ...state.players[0], cards: [...state.players[0].cards] as [string, string] },
      { ...state.players[1], cards: [...state.players[1].cards] as [string, string] },
    ];
    const usedCard = payload.cardId;
    nextPlayers[side].cards[cardIdx] = state.centerCard;
    const cardName = CARD_MAP.get(usedCard)?.name ?? usedCard;

    return {
      state: {
        ...state,
        players: nextPlayers,
        centerCard: usedCard,
        turnIndex: oppSide,
        moveCount: state.moveCount + 1,
        lastMove: { kind: 'pass', side, cardId: usedCard },
        lastLog: `${current.name} は合法手がなく「${cardName}」を中央と交換しました`,
      },
    };
  }

  if (action.type === 'move') {
    const payload = action.payload as
      | {
          cardId?: unknown;
          fromRow?: unknown;
          fromCol?: unknown;
          toRow?: unknown;
          toCol?: unknown;
        }
      | undefined;
    if (
      !payload ||
      typeof payload.cardId !== 'string' ||
      !isValidCoord(payload.fromRow) ||
      !isValidCoord(payload.fromCol) ||
      !isValidCoord(payload.toRow) ||
      !isValidCoord(payload.toCol)
    ) {
      return { state, error: '移動パラメータが不正です' };
    }

    const { cardId, fromRow, fromCol, toRow, toCol } = payload;
    const cardIdx = current.cards.indexOf(cardId);
    if (cardIdx === -1) {
      return { state, error: 'そのカードは手元にありません' };
    }

    const piece = state.board[fromRow][fromCol];
    if (!piece || piece.owner !== side) {
      return { state, error: '移動元に自分の駒がありません' };
    }

    const vectors = getCardVectorsForSide(cardId, side);
    const dr = toRow - fromRow;
    const dc = toCol - fromCol;
    if (!vectors.some(([vr, vc]) => vr === dr && vc === dc)) {
      return { state, error: '選択したカードではそこへ移動できません' };
    }

    const target = state.board[toRow][toCol];
    if (target && target.owner === side) {
      return { state, error: '自分の駒があるマスには移動できません' };
    }

    const nextBoard = cloneBoard(state.board);
    nextBoard[fromRow][fromCol] = null;
    nextBoard[toRow][toCol] = { ...piece };

    const nextPlayers: [CardShogiPlayerState, CardShogiPlayerState] = [
      { ...state.players[0], cards: [...state.players[0].cards] as [string, string] },
      { ...state.players[1], cards: [...state.players[1].cards] as [string, string] },
    ];
    nextPlayers[side].cards[cardIdx] = state.centerCard;

    const cardName = CARD_MAP.get(cardId)?.name ?? cardId;
    const lastMove: CardShogiLastMove = {
      kind: 'move',
      side,
      cardId,
      fromRow,
      fromCol,
      toRow,
      toCol,
    };

    // 勝利判定 1: 相手の王を捕獲
    if (target && target.owner === oppSide && target.role === 'master') {
      return {
        state: {
          ...state,
          players: nextPlayers,
          board: nextBoard,
          centerCard: cardId,
          moveCount: state.moveCount + 1,
          lastMove,
          winReason: 'capture',
          winnerId: current.id,
          phase: 'finished',
          lastLog: `${current.name} が「${cardName}」で相手の王を討ち取り勝利！`,
        },
      };
    }

    // 勝利判定 2: 自分の王が相手の初期王座へ到達
    const enemyTempleRow = side === 0 ? 0 : 4;
    if (
      state.rules.allowTempleWin &&
      piece.role === 'master' &&
      toRow === enemyTempleRow &&
      toCol === 2
    ) {
      return {
        state: {
          ...state,
          players: nextPlayers,
          board: nextBoard,
          centerCard: cardId,
          moveCount: state.moveCount + 1,
          lastMove,
          winReason: 'temple',
          winnerId: current.id,
          phase: 'finished',
          lastLog: `${current.name} の王が「${cardName}」で相手王座へ到達し勝利！`,
        },
      };
    }

    const captureText = target ? '（弟子を捕獲）' : '';
    return {
      state: {
        ...state,
        players: nextPlayers,
        board: nextBoard,
        centerCard: cardId,
        turnIndex: oppSide,
        moveCount: state.moveCount + 1,
        lastMove,
        lastLog: `${current.name} が「${cardName}」で移動${captureText}`,
      },
    };
  }

  return { state, error: '未対応のアクションです' };
}

export function sanitizeCardShogiState(
  state: CardShogiInternalState,
  playerId: string
): CardShogiClientState {
  const current = state.players[state.turnIndex];
  const isTurnPlayer = state.phase === 'playing' && current.id === playerId;
  const validMoves = isTurnPlayer
    ? getLegalMovesForSide(state.board, current.cards, current.side)
    : [];

  return {
    ...state,
    myId: playerId,
    validMoves,
    canPass: isTurnPlayer && validMoves.length === 0,
  };
}

function evaluateBoard(
  board: (CardShogiPiece | null)[][],
  botSide: 0 | 1,
  allowTempleWin: boolean
): number {
  const oppSide: 0 | 1 = botSide === 0 ? 1 : 0;
  const botGoalRow = botSide === 0 ? 0 : 4;
  const oppGoalRow = oppSide === 0 ? 0 : 4;
  let score = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c];
      if (!p) continue;
      const centerBonus = 4 - (Math.abs(r - 2) + Math.abs(c - 2));
      if (p.owner === botSide) {
        if (p.role === 'master') {
          score += 500 + centerBonus * 3;
          if (allowTempleWin) {
            const distToTemple = Math.abs(r - botGoalRow) + Math.abs(c - 2);
            score += (6 - distToTemple) * 6;
          }
        } else {
          score += 100 + centerBonus * 5;
        }
      } else {
        if (p.role === 'master') {
          score -= 500 + centerBonus * 3;
          if (allowTempleWin) {
            const distToTemple = Math.abs(r - oppGoalRow) + Math.abs(c - 2);
            score -= (6 - distToTemple) * 6;
          }
        } else {
          score -= 100 + centerBonus * 5;
        }
      }
    }
  }

  return score;
}

export function computeCardShogiBotAction(
  state: CardShogiInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  const bot = state.players[state.turnIndex];
  if (!bot.isBot) return null;

  const botSide = bot.side;
  const oppSide: 0 | 1 = botSide === 0 ? 1 : 0;
  const legal = getLegalMovesForSide(state.board, bot.cards, botSide);

  if (legal.length === 0) {
    return { type: 'pass', payload: { cardId: bot.cards[0] } };
  }

  let bestMove = legal[0];
  let bestScore = -Infinity;

  for (const m of legal) {
    const res = applyCardShogiAction(state, bot.id, { type: 'move', payload: m });
    if (res.error) continue;
    const next = res.state;

    // 1. 即勝利手なら即決
    if (next.phase === 'finished' && next.winnerId === bot.id) {
      return { type: 'move', payload: m };
    }

    // 2. 相手の反撃（1手先ミニマックス）を評価
    const oppMoves = getLegalMovesForSide(next.board, next.players[oppSide].cards, oppSide);
    let worstForBot = evaluateBoard(next.board, botSide, state.rules.allowTempleWin);

    if (oppMoves.length > 0) {
      let oppBestThreat = Infinity;
      for (const om of oppMoves) {
        const target = next.board[om.toRow][om.toCol];
        const mover = next.board[om.fromRow][om.fromCol];
        // 相手が王を取る or 王座到達できるなら即敗北ライン
        if (target && target.owner === botSide && target.role === 'master') {
          oppBestThreat = -100000;
          break;
        }
        const oppGoalRow = oppSide === 0 ? 0 : 4;
        if (
          state.rules.allowTempleWin &&
          mover?.role === 'master' &&
          om.toRow === oppGoalRow &&
          om.toCol === 2
        ) {
          oppBestThreat = -100000;
          break;
        }

        // 簡易1手先評価
        let val = worstForBot;
        if (target && target.owner === botSide) {
          val -= 95;
        }
        if (val < oppBestThreat) oppBestThreat = val;
      }
      worstForBot = oppBestThreat;
    }

    // 捕獲ボーナス＋微小ランダム性
    const captured = state.board[m.toRow][m.toCol];
    const score = worstForBot + (captured ? 12 : 0) + Math.random() * 2.5;

    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }

  return { type: 'move', payload: bestMove };
}
