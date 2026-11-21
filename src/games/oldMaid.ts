import { type Card, formatCardShort } from '../types/card';
import type { OldMaidRules, PlayerInfo } from '../types/game';
import { createDeck, dealCards, shuffle } from '../utils/deck';

export interface OldMaidPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  hand: Card[];
  finishRank: number | null;
}

export interface OldMaidInternalState {
  rules: OldMaidRules;
  players: OldMaidPlayerState[];
  removedJiji: Card | null;
  turnIndex: number;
  targetIndex: number;
  finishedOrder: string[];
  loserId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface OldMaidClientState {
  rules: OldMaidRules;
  myId: string;
  myHand: Card[];
  players: {
    id: string;
    name: string;
    isBot: boolean;
    handCount: number;
    finishRank: number | null;
  }[];
  turnPlayerId: string;
  targetPlayerId: string;
  removedJiji: Card | null;
  loserId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

function removePairs(hand: Card[]): { remaining: Card[]; removedCount: number } {
  const byRank = new Map<number, Card[]>();
  const jokers: Card[] = [];
  for (const c of hand) {
    if (c.suit === 'joker') {
      jokers.push(c);
    } else {
      const list = byRank.get(c.rank) ?? [];
      list.push(c);
      byRank.set(c.rank, list);
    }
  }
  const remaining: Card[] = [...jokers];
  let removedCount = 0;
  for (const list of byRank.values()) {
    if (list.length % 2 === 1) {
      remaining.push(list[list.length - 1]);
    }
    removedCount += Math.floor(list.length / 2);
  }
  return { remaining: shuffle(remaining), removedCount };
}

function findPrevActive(players: OldMaidPlayerState[], fromIdx: number): number {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIdx - step + n) % n;
    if (players[idx].finishRank === null && players[idx].hand.length > 0) {
      return idx;
    }
  }
  return fromIdx;
}

function findNextActive(players: OldMaidPlayerState[], fromIdx: number): number {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIdx + step) % n;
    if (players[idx].finishRank === null && players[idx].hand.length > 0) {
      return idx;
    }
  }
  return fromIdx;
}

export function initOldMaid(playersInfo: PlayerInfo[], rules: OldMaidRules): OldMaidInternalState {
  let deck = shuffle(createDeck(rules.mode === 'baba' ? 1 : 0));
  let removedJiji: Card | null = null;
  if (rules.mode === 'jiji') {
    removedJiji = deck.pop()!;
  }

  const dealt = dealCards(deck, playersInfo.length);
  const finishedOrder: string[] = [];
  const players: OldMaidPlayerState[] = playersInfo.map((p, idx) => {
    const { remaining } = removePairs(dealt[idx]);
    return {
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      hand: remaining,
      finishRank: null,
    };
  });

  players.forEach((p) => {
    if (p.hand.length === 0) {
      p.finishRank = finishedOrder.length + 1;
      finishedOrder.push(p.id);
    }
  });

  const turnIndex = players.findIndex((p) => p.finishRank === null);
  const safeTurn = turnIndex >= 0 ? turnIndex : 0;
  const targetIndex = findPrevActive(players, safeTurn);

  const remainingCount = players.filter((p) => p.finishRank === null).length;
  if (remainingCount <= 1) {
    const loser = players.find((p) => p.finishRank === null);
    if (loser) {
      loser.finishRank = players.length;
      finishedOrder.push(loser.id);
    }
    return {
      rules,
      players,
      removedJiji,
      turnIndex: 0,
      targetIndex: 0,
      finishedOrder,
      loserId: loser?.id ?? null,
      phase: 'finished',
      lastLog: 'ペアを捨てた時点で決着がつきました！',
    };
  }

  return {
    rules,
    players,
    removedJiji,
    turnIndex: safeTurn,
    targetIndex,
    finishedOrder,
    loserId: null,
    phase: 'playing',
    lastLog: `${rules.mode === 'baba' ? 'ばば抜き' : 'ジジ抜き'}スタート！ ペアを捨てました。`,
  };
}

export function applyOldMaidAction(
  state: OldMaidInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: OldMaidInternalState; error?: string } {
  if (state.phase !== 'playing') return { state, error: 'ゲームは終了しています' };

  if (action.type === 'shuffle') {
    if (!state.rules.allowShuffle) return { state, error: 'シャッフルは無効です' };
    const players = state.players.map((p) =>
      p.id === playerId ? { ...p, hand: shuffle(p.hand) } : p
    );
    const pName = players.find((p) => p.id === playerId)?.name ?? '';
    return {
      state: { ...state, players, lastLog: `${pName} が手札をシャッフルしました` },
    };
  }

  if (action.type === 'draw') {
    const drawer = state.players[state.turnIndex];
    if (drawer.id !== playerId) return { state, error: 'あなたのターンではありません' };

    const target = state.players[state.targetIndex];
    const cardIndex = (action.payload as { cardIndex?: number })?.cardIndex ?? 0;
    if (cardIndex < 0 || cardIndex >= target.hand.length) {
      return { state, error: '無効なカード位置です' };
    }

    const players = state.players.map((p) => ({ ...p, hand: [...p.hand] }));
    const drawnCard = players[state.targetIndex].hand.splice(cardIndex, 1)[0];
    players[state.turnIndex].hand.push(drawnCard);

    const { remaining, removedCount } = removePairs(players[state.turnIndex].hand);
    players[state.turnIndex].hand = remaining;

    const finishedOrder = [...state.finishedOrder];
    const logs: string[] = [`${drawer.name} が ${target.name} から1枚引きました`];
    if (removedCount > 0) logs.push('✨ペア成立！');

    if (players[state.targetIndex].hand.length === 0 && players[state.targetIndex].finishRank === null) {
      const rank = finishedOrder.length + 1;
      players[state.targetIndex].finishRank = rank;
      finishedOrder.push(players[state.targetIndex].id);
      logs.push(`🎉 ${players[state.targetIndex].name} が ${rank}位上がり！`);
    }

    if (players[state.turnIndex].hand.length === 0 && players[state.turnIndex].finishRank === null) {
      const rank = finishedOrder.length + 1;
      players[state.turnIndex].finishRank = rank;
      finishedOrder.push(players[state.turnIndex].id);
      logs.push(`🎉 ${players[state.turnIndex].name} が ${rank}位上がり！`);
    }

    const activePlayers = players.filter((p) => p.finishRank === null);
    if (activePlayers.length <= 1) {
      let loserId: string | null = null;
      if (activePlayers.length === 1) {
        loserId = activePlayers[0].id;
        activePlayers[0].finishRank = players.length;
        finishedOrder.push(loserId);
        const lastCard = activePlayers[0].hand[0];
        logs.push(
          `💀 ${activePlayers[0].name} が負け！（残り: ${lastCard ? formatCardShort(lastCard) : ''}）`
        );
      }
      return {
        state: {
          ...state,
          players,
          finishedOrder,
          loserId,
          phase: 'finished',
          lastLog: logs.join(' '),
        },
      };
    }

    const nextTurn = findNextActive(players, state.turnIndex);
    const nextTarget = findPrevActive(players, nextTurn);

    return {
      state: {
        ...state,
        players,
        turnIndex: nextTurn,
        targetIndex: nextTarget,
        finishedOrder,
        lastLog: logs.join(' '),
      },
    };
  }

  return { state, error: '不明なアクションです' };
}

export function computeOldMaidBotAction(state: OldMaidInternalState): { type: string; payload?: unknown } {
  const target = state.players[state.targetIndex];
  const cardIndex = Math.floor(Math.random() * target.hand.length);
  return { type: 'draw', payload: { cardIndex } };
}

export function sanitizeOldMaidState(state: OldMaidInternalState, playerId: string): OldMaidClientState {
  const me = state.players.find((p) => p.id === playerId);
  return {
    rules: state.rules,
    myId: playerId,
    myHand: me ? me.hand : [],
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      handCount: p.hand.length,
      finishRank: p.finishRank,
    })),
    turnPlayerId: state.players[state.turnIndex]?.id ?? '',
    targetPlayerId: state.players[state.targetIndex]?.id ?? '',
    removedJiji: state.phase === 'finished' ? state.removedJiji : null,
    loserId: state.loserId,
    phase: state.phase,
    lastLog: state.lastLog,
  };
}
