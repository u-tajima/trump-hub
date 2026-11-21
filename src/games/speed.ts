import { type Card, formatCardShort } from '../types/card';
import type { PlayerInfo, SpeedRules } from '../types/game';
import { createDeck, shuffle } from '../utils/deck';

export interface SpeedPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  fieldHand: Card[];
  drawPile: Card[];
  readyFlip: boolean;
}

export interface SpeedInternalState {
  rules: SpeedRules;
  players: [SpeedPlayerState, SpeedPlayerState];
  centerPiles: [Card, Card];
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface SpeedClientState {
  rules: SpeedRules;
  myId: string;
  me: {
    id: string;
    name: string;
    fieldHand: Card[];
    drawPileCount: number;
    readyFlip: boolean;
  };
  opponent: {
    id: string;
    name: string;
    isBot: boolean;
    fieldHandCount: number;
    drawPileCount: number;
    readyFlip: boolean;
  };
  centerPiles: [Card, Card];
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export function initSpeed(playersInfo: PlayerInfo[], rules: SpeedRules): SpeedInternalState {
  const deck = shuffle(createDeck(0));
  const p1Cards = deck.slice(0, 26);
  const p2Cards = deck.slice(26, 52);

  const center0 = p1Cards[0];
  const center1 = p2Cards[0];

  const p1: SpeedPlayerState = {
    id: playersInfo[0].id,
    name: playersInfo[0].name,
    isBot: playersInfo[0].isBot,
    fieldHand: p1Cards.slice(1, 5),
    drawPile: p1Cards.slice(5),
    readyFlip: false,
  };

  const p2: SpeedPlayerState = {
    id: playersInfo[1].id,
    name: playersInfo[1].name,
    isBot: playersInfo[1].isBot,
    fieldHand: p2Cards.slice(1, 5),
    drawPile: p2Cards.slice(5),
    readyFlip: false,
  };

  return {
    rules,
    players: [p1, p2],
    centerPiles: [center0, center1],
    winnerId: null,
    phase: 'playing',
    lastLog: 'スピード開始！台札の±1のカードを素早く出そう！',
  };
}

export function canPlaceOnSpeedPile(card: Card, pileCard: Card, rules: SpeedRules): boolean {
  const diff = Math.abs(card.rank - pileCard.rank);
  if (diff === 1) return true;
  if (rules.sameRankAllowed && diff === 0) return true;
  if (rules.akConnect && ((card.rank === 1 && pileCard.rank === 13) || (card.rank === 13 && pileCard.rank === 1))) {
    return true;
  }
  return false;
}

function refillHand(p: SpeedPlayerState): SpeedPlayerState {
  const fieldHand = [...p.fieldHand];
  const drawPile = [...p.drawPile];
  while (fieldHand.length < 4 && drawPile.length > 0) {
    const next = drawPile.shift()!;
    fieldHand.push(next);
  }
  return { ...p, fieldHand, drawPile };
}

export function applySpeedAction(
  state: SpeedInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: SpeedInternalState; error?: string } {
  if (state.phase !== 'playing') return { state, error: 'ゲームは終了しています' };
  const pIdx = state.players.findIndex((p) => p.id === playerId);
  if (pIdx < 0) return { state, error: 'プレイヤーが見つかりません' };

  const players: [SpeedPlayerState, SpeedPlayerState] = [
    { ...state.players[0], fieldHand: [...state.players[0].fieldHand], drawPile: [...state.players[0].drawPile] },
    { ...state.players[1], fieldHand: [...state.players[1].fieldHand], drawPile: [...state.players[1].drawPile] },
  ];

  if (action.type === 'refill') {
    players[pIdx] = refillHand(players[pIdx]);
    return { state: { ...state, players } };
  }

  if (action.type === 'play') {
    const { cardId, pileIndex } = (action.payload as { cardId: string; pileIndex: 0 | 1 }) ?? {};
    const me = players[pIdx];
    const cardIdx = me.fieldHand.findIndex((c) => c.id === cardId);
    if (cardIdx < 0) return { state, error: 'カードが手元にありません' };

    const card = me.fieldHand[cardIdx];
    const targetPile = state.centerPiles[pileIndex];
    if (!canPlaceOnSpeedPile(card, targetPile, state.rules)) {
      return { state, error: 'その台札には出せません' };
    }

    me.fieldHand.splice(cardIdx, 1);
    if (state.rules.autoRefill) {
      players[pIdx] = refillHand(me);
    }
    players[0].readyFlip = false;
    players[1].readyFlip = false;

    const centerPiles: [Card, Card] = [...state.centerPiles] as [Card, Card];
    centerPiles[pileIndex] = card;

    if (players[pIdx].fieldHand.length === 0 && players[pIdx].drawPile.length === 0) {
      return {
        state: {
          ...state,
          players,
          centerPiles,
          winnerId: players[pIdx].id,
          phase: 'finished',
          lastLog: `🏆 ${players[pIdx].name} の勝利！`,
        },
      };
    }

    return {
      state: {
        ...state,
        players,
        centerPiles,
        lastLog: `${players[pIdx].name} が ${formatCardShort(card)} を出した！`,
      },
    };
  }

  if (action.type === 'readyFlip') {
    players[pIdx].readyFlip = !players[pIdx].readyFlip;

    const otherIdx = pIdx === 0 ? 1 : 0;
    if (players[otherIdx].isBot && !hasAnyPlayableCard(players[otherIdx], state.centerPiles, state.rules)) {
      players[otherIdx].readyFlip = true;
    }

    if (players[0].readyFlip && players[1].readyFlip) {
      const centerPiles: [Card, Card] = [...state.centerPiles] as [Card, Card];
      for (let i = 0; i < 2; i++) {
        if (players[i].drawPile.length > 0) {
          centerPiles[i] = players[i].drawPile.shift()!;
        } else if (players[i].fieldHand.length > 1) {
          centerPiles[i] = players[i].fieldHand.shift()!;
        }
        players[i].readyFlip = false;
      }
      return {
        state: {
          ...state,
          players,
          centerPiles,
          lastLog: '⚡ せーの！で台札をめくりました！',
        },
      };
    }

    return {
      state: {
        ...state,
        players,
        lastLog: `${players[pIdx].name} が「せーの！」待機中…`,
      },
    };
  }

  return { state, error: '不明なアクションです' };
}

function hasAnyPlayableCard(p: SpeedPlayerState, centerPiles: [Card, Card], rules: SpeedRules): boolean {
  return p.fieldHand.some(
    (c) => canPlaceOnSpeedPile(c, centerPiles[0], rules) || canPlaceOnSpeedPile(c, centerPiles[1], rules)
  );
}

export function computeSpeedBotAction(state: SpeedInternalState, botId: string): { type: string; payload?: unknown } | null {
  const bot = state.players.find((p) => p.id === botId);
  if (!bot) return null;

  if (!state.rules.autoRefill && bot.fieldHand.length < 4 && bot.drawPile.length > 0) {
    return { type: 'refill' };
  }

  for (const c of bot.fieldHand) {
    if (canPlaceOnSpeedPile(c, state.centerPiles[0], state.rules)) {
      return { type: 'play', payload: { cardId: c.id, pileIndex: 0 } };
    }
    if (canPlaceOnSpeedPile(c, state.centerPiles[1], state.rules)) {
      return { type: 'play', payload: { cardId: c.id, pileIndex: 1 } };
    }
  }

  if (!bot.readyFlip) {
    return { type: 'readyFlip' };
  }
  return null;
}

export function sanitizeSpeedState(state: SpeedInternalState, playerId: string): SpeedClientState {
  const meIdx = state.players[0].id === playerId ? 0 : 1;
  const oppIdx = meIdx === 0 ? 1 : 0;
  const me = state.players[meIdx];
  const opp = state.players[oppIdx];

  return {
    rules: state.rules,
    myId: playerId,
    me: {
      id: me.id,
      name: me.name,
      fieldHand: me.fieldHand,
      drawPileCount: me.drawPile.length,
      readyFlip: me.readyFlip,
    },
    opponent: {
      id: opp.id,
      name: opp.name,
      isBot: opp.isBot,
      fieldHandCount: opp.fieldHand.length,
      drawPileCount: opp.drawPile.length,
      readyFlip: opp.readyFlip,
    },
    centerPiles: state.centerPiles,
    winnerId: state.winnerId,
    phase: state.phase,
    lastLog: state.lastLog,
  };
}
