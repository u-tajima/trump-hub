import { type Card, type Suit, formatCardShort } from '../types/card';
import type { MemoryRules, PlayerInfo } from '../types/game';
import { shuffle } from '../utils/deck';

export interface MemoryTile {
  index: number;
  card: Card;
  matchedBy: string | null;
}

export interface MemoryPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  pairs: number;
}

export interface MemoryInternalState {
  rules: MemoryRules;
  players: MemoryPlayerState[];
  tiles: MemoryTile[];
  flippedIndices: number[];
  turnIndex: number;
  awaitingReset: boolean;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface MemoryClientTile {
  index: number;
  matchedBy: string | null;
  card: Card | null;
}

export interface MemoryClientState {
  rules: MemoryRules;
  myId: string;
  players: MemoryPlayerState[];
  tiles: MemoryClientTile[];
  flippedIndices: number[];
  turnPlayerId: string;
  awaitingReset: boolean;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export function initMemory(playersInfo: PlayerInfo[], rules: MemoryRules): MemoryInternalState {
  const pairCount = Math.floor(rules.deckSize / 2);
  const cards: Card[] = [];

  if (pairCount <= 13) {
    const suits: Suit[] = ['spade', 'heart'];
    for (let r = 1; r <= pairCount; r++) {
      for (const s of suits) {
        cards.push({ id: `${s}-${r}`, suit: s, rank: r as Card['rank'] });
      }
    }
  } else {
    const suits: Suit[] = ['spade', 'heart', 'diamond', 'club'];
    for (const s of suits) {
      for (let r = 1; r <= 13; r++) {
        cards.push({ id: `${s}-${r}`, suit: s, rank: r as Card['rank'] });
      }
    }
  }

  if (rules.jokerPair) {
    cards.push({ id: 'joker-1', suit: 'joker', rank: 0 });
    cards.push({ id: 'joker-2', suit: 'joker', rank: 0 });
  }

  const shuffled = shuffle(cards);
  const tiles: MemoryTile[] = shuffled.map((card, index) => ({
    index,
    card,
    matchedBy: null,
  }));

  const players: MemoryPlayerState[] = playersInfo.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    pairs: 0,
  }));

  return {
    rules,
    players,
    tiles,
    flippedIndices: [],
    turnIndex: 0,
    awaitingReset: false,
    phase: 'playing',
    lastLog: `${players[0].name} のターン！カードを2枚めくろう`,
  };
}

export function applyMemoryAction(
  state: MemoryInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: MemoryInternalState; error?: string } {
  if (state.phase !== 'playing') return { state, error: 'ゲームは終了しています' };

  if (action.type === 'resetMismatch') {
    if (!state.awaitingReset) return { state };
    const nextTurn = (state.turnIndex + 1) % state.players.length;
    return {
      state: {
        ...state,
        flippedIndices: [],
        awaitingReset: false,
        turnIndex: nextTurn,
        lastLog: `${state.players[nextTurn].name} のターン！`,
      },
    };
  }

  if (action.type === 'flip') {
    if (state.awaitingReset) return { state, error: '少し待ってください' };
    const current = state.players[state.turnIndex];
    if (current.id !== playerId) return { state, error: 'あなたのターンではありません' };

    const index = (action.payload as { index?: number })?.index ?? -1;
    const tile = state.tiles[index];
    if (!tile || tile.matchedBy !== null || state.flippedIndices.includes(index)) {
      return { state, error: 'そのカードはめくれません' };
    }

    const flippedIndices = [...state.flippedIndices, index];
    if (flippedIndices.length === 1) {
      return {
        state: {
          ...state,
          flippedIndices,
          lastLog: `${current.name} が1枚目をめくりました (${formatCardShort(tile.card)})`,
        },
      };
    }

    const first = state.tiles[flippedIndices[0]];
    const second = tile;
    const isMatch = first.card.rank === second.card.rank;

    if (isMatch) {
      const tiles = state.tiles.map((t, i) =>
        i === first.index || i === second.index ? { ...t, matchedBy: current.id } : t
      );
      const players = state.players.map((p, idx) =>
        idx === state.turnIndex ? { ...p, pairs: p.pairs + 1 } : p
      );

      const allMatched = tiles.every((t) => t.matchedBy !== null);
      if (allMatched) {
        const sorted = [...players].sort((a, b) => b.pairs - a.pairs);
        return {
          state: {
            ...state,
            tiles,
            players,
            flippedIndices: [],
            phase: 'finished',
            lastLog: `🏆 ゲーム終了！ 1位: ${sorted[0].name} (${sorted[0].pairs}ペア)`,
          },
        };
      }

      const nextTurn = state.rules.extraTurnOnMatch
        ? state.turnIndex
        : (state.turnIndex + 1) % players.length;

      return {
        state: {
          ...state,
          tiles,
          players,
          flippedIndices: [],
          turnIndex: nextTurn,
          lastLog: `✨ ペア成立！(${formatCardShort(first.card)}) ${
            state.rules.extraTurnOnMatch ? `${current.name} もう1回！` : `次は ${players[nextTurn].name}`
          }`,
        },
      };
    } else {
      return {
        state: {
          ...state,
          flippedIndices,
          awaitingReset: true,
          lastLog: `ざんねん！ (${formatCardShort(first.card)} / ${formatCardShort(second.card)})`,
        },
      };
    }
  }

  return { state, error: '不明なアクションです' };
}

export function computeMemoryBotAction(state: MemoryInternalState): { type: string; payload?: unknown } | null {
  if (state.awaitingReset) return null;
  const available = state.tiles.filter((t) => t.matchedBy === null && !state.flippedIndices.includes(t.index));
  if (available.length === 0) return null;
  const pick = available[Math.floor(Math.random() * available.length)];
  return { type: 'flip', payload: { index: pick.index } };
}

export function sanitizeMemoryState(state: MemoryInternalState, playerId: string): MemoryClientState {
  return {
    rules: state.rules,
    myId: playerId,
    players: state.players,
    tiles: state.tiles.map((t) => {
      const visible = t.matchedBy !== null || state.flippedIndices.includes(t.index);
      return {
        index: t.index,
        matchedBy: t.matchedBy,
        card: visible ? t.card : null,
      };
    }),
    flippedIndices: state.flippedIndices,
    turnPlayerId: state.players[state.turnIndex]?.id ?? '',
    awaitingReset: state.awaitingReset,
    phase: state.phase,
    lastLog: state.lastLog,
  };
}
