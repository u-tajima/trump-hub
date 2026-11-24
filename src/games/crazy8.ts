import type { Card, Suit } from '../types/card';
import { SUIT_SYMBOLS, formatCardShort } from '../types/card';
import type { Crazy8Rules, PlayerInfo } from '../types/game';
import { createDeck, shuffle, sortCardsByRank } from '../utils/deck';

export type Crazy8Suit = Exclude<Suit, 'joker'>;

export interface Crazy8PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  hand: Card[];
}

export interface Crazy8InternalState {
  rules: Crazy8Rules;
  players: Crazy8PlayerState[];
  deck: Card[];
  discardPile: Card[];
  currentSuit: Crazy8Suit;
  direction: 1 | -1;
  turnIndex: number;
  pendingDraw: number;
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface Crazy8ClientState {
  rules: Crazy8Rules;
  myId: string;
  myHand: Card[];
  players: {
    id: string;
    name: string;
    isBot: boolean;
    handCount: number;
  }[];
  topCard: Card;
  currentSuit: Crazy8Suit;
  deckCount: number;
  direction: 1 | -1;
  pendingDraw: number;
  turnPlayerId: string;
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

const VALID_SUITS: readonly Crazy8Suit[] = ['spade', 'heart', 'diamond', 'club'];

function isValidSuit(s: unknown): s is Crazy8Suit {
  return typeof s === 'string' && (VALID_SUITS as readonly string[]).includes(s);
}

export function canPlayCrazy8Card(
  card: Card,
  topCard: Card,
  currentSuit: Crazy8Suit,
  pendingDraw: number,
  rules: Crazy8Rules
): boolean {
  if (pendingDraw > 0 && rules.drawTwoEnabled) {
    return card.rank === 2;
  }
  if (card.rank === 8) return true;
  if (card.suit === currentSuit) return true;
  if (card.rank === topCard.rank) return true;
  return false;
}

function replenishDeck(
  deck: Card[],
  discardPile: Card[]
): { deck: Card[]; discardPile: Card[] } {
  if (deck.length > 0 || discardPile.length <= 1) {
    return { deck, discardPile };
  }
  const top = discardPile[discardPile.length - 1];
  const recycled = shuffle(discardPile.slice(0, -1));
  return {
    deck: recycled,
    discardPile: [top],
  };
}

function drawFromDeck(
  deckIn: Card[],
  discardIn: Card[],
  count: number
): { drawn: Card[]; deck: Card[]; discardPile: Card[] } {
  let deck = [...deckIn];
  let discardPile = [...discardIn];
  const drawn: Card[] = [];

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      const refilled = replenishDeck(deck, discardPile);
      deck = refilled.deck;
      discardPile = refilled.discardPile;
    }
    if (deck.length === 0) break;
    drawn.push(deck.shift()!);
  }

  return { drawn, deck, discardPile };
}

function advanceIndex(current: number, step: number, direction: 1 | -1, total: number): number {
  return (((current + direction * step) % total) + total) % total;
}

export function initCrazy8(playersInfo: PlayerInfo[], rules: Crazy8Rules): Crazy8InternalState {
  const deck = shuffle(createDeck(0));
  const initialCount = playersInfo.length >= 5 ? 5 : 7;

  let cursor = 0;
  const players: Crazy8PlayerState[] = playersInfo.map((p) => {
    const hand = sortCardsByRank(deck.slice(cursor, cursor + initialCount));
    cursor += initialCount;
    return {
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      hand,
    };
  });

  const remaining = deck.slice(cursor);
  // 最初の場札は可能なら8以外の通常カードを選ぶ
  let firstIdx = remaining.findIndex((c) => c.rank !== 8 && c.rank !== 2 && c.rank !== 11 && c.rank !== 12);
  if (firstIdx < 0) firstIdx = remaining.findIndex((c) => c.rank !== 8);
  if (firstIdx < 0) firstIdx = 0;

  const [firstCard] = remaining.splice(firstIdx, 1);
  const currentSuit: Crazy8Suit = isValidSuit(firstCard.suit) ? firstCard.suit : 'spade';

  return {
    rules,
    players,
    deck: remaining,
    discardPile: [firstCard],
    currentSuit,
    direction: 1,
    turnIndex: 0,
    pendingDraw: 0,
    winnerId: null,
    phase: 'playing',
    lastLog: `ゲーム開始！場札は ${formatCardShort(firstCard)}（${players[0]?.name ?? ''} のターン）`,
  };
}

export function applyCrazy8Action(
  state: Crazy8InternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: Crazy8InternalState; error?: string } {
  if (state.phase === 'finished') {
    return { state, error: 'ゲームは終了しています' };
  }

  const current = state.players[state.turnIndex];
  if (!current || current.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }

  const topCard = state.discardPile[state.discardPile.length - 1];
  const n = state.players.length;

  if (action.type === 'draw') {
    const drawCount = state.pendingDraw > 0 ? state.pendingDraw : 1;
    const { drawn, deck, discardPile } = drawFromDeck(state.deck, state.discardPile, drawCount);
    const players = state.players.map((p, idx) =>
      idx === state.turnIndex
        ? { ...p, hand: sortCardsByRank([...p.hand, ...drawn]) }
        : p
    );
    const nextTurn = advanceIndex(state.turnIndex, 1, state.direction, n);
    const log =
      state.pendingDraw > 0
        ? `${current.name} がドロー累積で ${drawn.length}枚 引きました`
        : drawn.length > 0
        ? `${current.name} が山札から1枚引きました`
        : `${current.name} は山札が空のためパスしました`;

    return {
      state: {
        ...state,
        players,
        deck,
        discardPile,
        pendingDraw: 0,
        turnIndex: nextTurn,
        lastLog: log,
      },
    };
  }

  if (action.type === 'play') {
    const payload = (action.payload ?? {}) as { cardId?: string; chosenSuit?: unknown };
    const card = current.hand.find((c) => c.id === payload.cardId);
    if (!card) {
      return { state, error: '手札にそのカードがありません' };
    }
    if (!canPlayCrazy8Card(card, topCard, state.currentSuit, state.pendingDraw, state.rules)) {
      return {
        state,
        error:
          state.pendingDraw > 0
            ? `ドロー累積中（+${state.pendingDraw}）は「2」のみ出せます`
            : 'そのカードは場に出せません',
      };
    }

    const nextHand = current.hand.filter((c) => c.id !== card.id);
    const players = state.players.map((p, idx) =>
      idx === state.turnIndex ? { ...p, hand: nextHand } : p
    );
    const discardPile = [...state.discardPile, card];

    // 勝利判定
    if (nextHand.length === 0) {
      const nextSuit: Crazy8Suit =
        card.rank === 8 && isValidSuit(payload.chosenSuit)
          ? payload.chosenSuit
          : isValidSuit(card.suit)
          ? card.suit
          : state.currentSuit;
      return {
        state: {
          ...state,
          players,
          discardPile,
          currentSuit: nextSuit,
          pendingDraw: 0,
          winnerId: current.id,
          phase: 'finished',
          lastLog: `${current.name} が ${formatCardShort(card)} を出して上がり！勝利！`,
        },
      };
    }

    let nextSuit: Crazy8Suit = isValidSuit(card.suit) ? card.suit : state.currentSuit;
    let nextDirection = state.direction;
    let nextPendingDraw = state.pendingDraw;
    let step = 1;
    const effectNotes: string[] = [];

    if (card.rank === 8) {
      nextSuit = isValidSuit(payload.chosenSuit) ? payload.chosenSuit : nextSuit;
      effectNotes.push(`スート指定 ${SUIT_SYMBOLS[nextSuit]}`);
    }

    if (card.rank === 2 && state.rules.drawTwoEnabled) {
      nextPendingDraw += 2;
      effectNotes.push(`ドロー +${nextPendingDraw}`);
    }

    if (card.rank === 11 && state.rules.skipJackEnabled) {
      step = 2;
      effectNotes.push('スキップ');
    }

    if (card.rank === 12 && state.rules.reverseQueenEnabled) {
      if (n === 2) {
        step = 2;
        effectNotes.push('リバース(スキップ)');
      } else {
        nextDirection = state.direction === 1 ? -1 : 1;
        effectNotes.push('リバース');
      }
    }

    const nextTurn = advanceIndex(state.turnIndex, step, nextDirection, n);
    const suffix = effectNotes.length > 0 ? `（${effectNotes.join(' / ')}）` : '';

    return {
      state: {
        ...state,
        players,
        discardPile,
        currentSuit: nextSuit,
        direction: nextDirection,
        pendingDraw: nextPendingDraw,
        turnIndex: nextTurn,
        lastLog: `${current.name} が ${formatCardShort(card)} を出しました${suffix}`,
      },
    };
  }

  return { state, error: '不明なアクションです' };
}

export function sanitizeCrazy8State(
  state: Crazy8InternalState,
  playerId: string
): Crazy8ClientState {
  const me = state.players.find((p) => p.id === playerId);
  const topCard = state.discardPile[state.discardPile.length - 1];

  return {
    rules: state.rules,
    myId: playerId,
    myHand: me ? me.hand : [],
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      handCount: p.hand.length,
    })),
    topCard,
    currentSuit: state.currentSuit,
    deckCount: state.deck.length,
    direction: state.direction,
    pendingDraw: state.pendingDraw,
    turnPlayerId: state.players[state.turnIndex]?.id ?? '',
    winnerId: state.winnerId,
    phase: state.phase,
    lastLog: state.lastLog,
  };
}

function chooseBestSuitForBot(hand: Card[], excludeCardId: string): Crazy8Suit {
  const counts: Record<Crazy8Suit, number> = {
    spade: 0,
    heart: 0,
    diamond: 0,
    club: 0,
  };
  for (const c of hand) {
    if (c.id === excludeCardId) continue;
    if (isValidSuit(c.suit)) {
      counts[c.suit] += 1;
    }
  }
  let best: Crazy8Suit = 'spade';
  let bestCount = -1;
  for (const s of VALID_SUITS) {
    if (counts[s] > bestCount) {
      bestCount = counts[s];
      best = s;
    }
  }
  return best;
}

export function computeCrazy8BotAction(
  state: Crazy8InternalState
): { type: string; payload?: unknown } {
  const bot = state.players[state.turnIndex];
  const topCard = state.discardPile[state.discardPile.length - 1];
  const playable = bot.hand.filter((c) =>
    canPlayCrazy8Card(c, topCard, state.currentSuit, state.pendingDraw, state.rules)
  );

  if (playable.length === 0) {
    return { type: 'draw' };
  }

  // 8以外の出せるカードを優先
  const nonEights = playable.filter((c) => c.rank !== 8);
  if (nonEights.length > 0) {
    // 特殊カード（2 / J / Q）を優先的に活用
    const scored = [...nonEights].sort((a, b) => {
      const score = (c: Card) => {
        if (c.rank === 2 && state.rules.drawTwoEnabled) return 30;
        if (c.rank === 11 && state.rules.skipJackEnabled) return 20;
        if (c.rank === 12 && state.rules.reverseQueenEnabled) return 18;
        return 10;
      };
      return score(b) - score(a);
    });
    return { type: 'play', payload: { cardId: scored[0].id } };
  }

  // 8しかない場合は最も枚数の多いスートを指定して出す
  const eight = playable[0];
  const chosenSuit = chooseBestSuitForBot(bot.hand, eight.id);
  return { type: 'play', payload: { cardId: eight.id, chosenSuit } };
}
