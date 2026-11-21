import type { Card } from '../types/card';
import type { HoldemRules, PlayerInfo } from '../types/game';
import { createDeck, shuffle } from '../utils/deck';
import { type EvaluatedPokerHand, evaluatePokerHand } from './poker';

export type HoldemSubPhase = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface HoldemPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  chips: number;
  holeCards: Card[];
  currentBet: number;
  folded: boolean;
  actedThisRound: boolean;
  evaluated: EvaluatedPokerHand | null;
}

export interface HoldemInternalState {
  rules: HoldemRules;
  players: HoldemPlayerState[];
  deck: Card[];
  communityCards: Card[];
  pot: number;
  highestBet: number;
  round: number;
  dealerIndex: number;
  turnIndex: number;
  subPhase: HoldemSubPhase;
  handWinners: string[];
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface HoldemClientState {
  rules: HoldemRules;
  myId: string;
  myHoleCards: Card[];
  communityCards: Card[];
  players: {
    id: string;
    name: string;
    isBot: boolean;
    chips: number;
    currentBet: number;
    folded: boolean;
    revealedHole: Card[] | null;
    evaluated: EvaluatedPokerHand | null;
  }[];
  pot: number;
  highestBet: number;
  round: number;
  dealerIndex: number;
  turnPlayerId: string;
  subPhase: HoldemSubPhase;
  handWinners: string[];
  phase: 'playing' | 'finished';
  lastLog: string;
}

export function evaluateBestSeven(cards: Card[]): EvaluatedPokerHand | null {
  if (cards.length < 5) return null;
  if (cards.length === 5) return evaluatePokerHand(cards);

  let best: EvaluatedPokerHand | null = null;
  const n = cards.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        for (let l = k + 1; l < n; l++) {
          for (let m = l + 1; m < n; m++) {
            const ev = evaluatePokerHand([cards[i], cards[j], cards[k], cards[l], cards[m]]);
            if (!best || ev.score > best.score) best = ev;
          }
        }
      }
    }
  }
  return best;
}

function nextActiveIndex(players: HoldemPlayerState[], fromIdx: number): number {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIdx + step) % n;
    if (!players[idx].folded) return idx;
  }
  return fromIdx;
}

function startNewHoldemHand(
  playersIn: HoldemPlayerState[],
  rules: HoldemRules,
  round: number,
  dealerIndex: number
): HoldemInternalState {
  const deck = shuffle(createDeck(0));
  let cursor = 0;

  const players: HoldemPlayerState[] = playersIn.map((p) => {
    const holeCards = deck.slice(cursor, cursor + 2);
    cursor += 2;
    return {
      ...p,
      holeCards,
      currentBet: 0,
      folded: false,
      actedThisRound: false,
      evaluated: null,
    };
  });

  const n = players.length;
  const sbIdx = n === 2 ? dealerIndex : (dealerIndex + 1) % n;
  const bbIdx = (sbIdx + 1) % n;
  const sbAmt = Math.min(players[sbIdx].chips, Math.floor(rules.bigBlind / 2));
  const bbAmt = Math.min(players[bbIdx].chips, rules.bigBlind);

  players[sbIdx].chips -= sbAmt;
  players[sbIdx].currentBet = sbAmt;
  players[bbIdx].chips -= bbAmt;
  players[bbIdx].currentBet = bbAmt;

  const pot = sbAmt + bbAmt;
  const highestBet = Math.max(sbAmt, bbAmt);
  const turnIndex = nextActiveIndex(players, bbIdx);

  return {
    rules,
    players,
    deck: deck.slice(cursor),
    communityCards: [],
    pot,
    highestBet,
    round,
    dealerIndex,
    turnIndex,
    subPhase: 'preflop',
    handWinners: [],
    phase: 'playing',
    lastLog: `ハンド ${round}/${rules.rounds} プリフロップ開始（BB ${rules.bigBlind}）`,
  };
}

export function initHoldem(playersInfo: PlayerInfo[], rules: HoldemRules): HoldemInternalState {
  const players: HoldemPlayerState[] = playersInfo.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    chips: rules.startChips,
    holeCards: [],
    currentBet: 0,
    folded: false,
    actedThisRound: false,
    evaluated: null,
  }));
  return startNewHoldemHand(players, rules, 1, 0);
}

function resolveHoldemShowdown(state: HoldemInternalState): HoldemInternalState {
  const active = state.players.filter((p) => !p.folded);
  const players = state.players.map((p) => ({
    ...p,
    evaluated: p.folded ? null : evaluateBestSeven([...p.holeCards, ...state.communityCards]),
  }));

  let bestScore = -1;
  for (const p of players) {
    if (!p.folded && p.evaluated && p.evaluated.score > bestScore) {
      bestScore = p.evaluated.score;
    }
  }

  const winners = players.filter((p) => !p.folded && (active.length === 1 || p.evaluated?.score === bestScore));
  const share = Math.floor(state.pot / Math.max(1, winners.length));
  winners.forEach((w) => {
    const target = players.find((p) => p.id === w.id);
    if (target) target.chips += share;
  });

  const isFinal = state.round >= state.rules.rounds;
  const winnerNames = winners.map((w) => (w.evaluated ? `${w.name}(${w.evaluated.name})` : w.name)).join(' & ');

  return {
    ...state,
    players,
    subPhase: 'showdown',
    handWinners: winners.map((w) => w.id),
    phase: isFinal ? 'finished' : 'playing',
    lastLog:
      active.length === 1
        ? `${winners[0].name} がポット ${state.pot} を獲得`
        : `ショーダウン: ${winnerNames} がポット ${state.pot} を獲得`,
  };
}

function advanceHoldemPhase(state: HoldemInternalState): HoldemInternalState {
  const active = state.players.filter((p) => !p.folded);
  if (active.length <= 1) {
    return resolveHoldemShowdown(state);
  }

  const settled = active.every(
    (p) => p.actedThisRound && (p.currentBet === state.highestBet || p.chips === 0)
  );
  if (!settled) {
    return { ...state, turnIndex: nextActiveIndex(state.players, state.turnIndex) };
  }

  const resetPlayers = state.players.map((p) => ({ ...p, currentBet: 0, actedThisRound: false }));
  const nextTurn = nextActiveIndex(resetPlayers, state.dealerIndex);

  if (state.subPhase === 'preflop') {
    const flop = state.deck.slice(0, 3);
    return {
      ...state,
      players: resetPlayers,
      deck: state.deck.slice(3),
      communityCards: flop,
      highestBet: 0,
      subPhase: 'flop',
      turnIndex: nextTurn,
      lastLog: 'フロップ（3枚オープン）',
    };
  }
  if (state.subPhase === 'flop') {
    const turnCard = state.deck[0];
    return {
      ...state,
      players: resetPlayers,
      deck: state.deck.slice(1),
      communityCards: [...state.communityCards, turnCard],
      highestBet: 0,
      subPhase: 'turn',
      turnIndex: nextTurn,
      lastLog: 'ターン（4枚目オープン）',
    };
  }
  if (state.subPhase === 'turn') {
    const riverCard = state.deck[0];
    return {
      ...state,
      players: resetPlayers,
      deck: state.deck.slice(1),
      communityCards: [...state.communityCards, riverCard],
      highestBet: 0,
      subPhase: 'river',
      turnIndex: nextTurn,
      lastLog: 'リバー（5枚目オープン）',
    };
  }

  return resolveHoldemShowdown({ ...state, players: resetPlayers });
}

export function applyHoldemAction(
  state: HoldemInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: HoldemInternalState; error?: string } {
  if (state.phase === 'finished') return { state, error: 'ゲームは終了しています' };

  if (state.subPhase === 'showdown') {
    if (action.type === 'nextHand') {
      const nextDealer = (state.dealerIndex + 1) % state.players.length;
      return { state: startNewHoldemHand(state.players, state.rules, state.round + 1, nextDealer) };
    }
    return { state, error: '次のハンドへ進んでください' };
  }

  const current = state.players[state.turnIndex];
  if (current.id !== playerId) return { state, error: 'あなたのターンではありません' };

  const players = state.players.map((p) => ({ ...p }));
  const me = players[state.turnIndex];
  const toCall = Math.max(0, state.highestBet - me.currentBet);
  let pot = state.pot;
  let highestBet = state.highestBet;
  let log = '';

  if (action.type === 'fold') {
    me.folded = true;
    me.actedThisRound = true;
    log = `${me.name} がフォールド`;
  } else if (action.type === 'call') {
    const paid = Math.min(me.chips, toCall);
    me.chips -= paid;
    me.currentBet += paid;
    me.actedThisRound = true;
    pot += paid;
    log = toCall === 0 ? `${me.name} がチェック` : `${me.name} がコール (${paid})`;
  } else if (action.type === 'raise') {
    const add = (action.payload as { amount?: number })?.amount ?? state.rules.bigBlind;
    const paid = Math.min(me.chips, toCall + add);
    me.chips -= paid;
    me.currentBet += paid;
    me.actedThisRound = true;
    pot += paid;
    if (me.currentBet > highestBet) highestBet = me.currentBet;
    log = `${me.name} がレイズ (+${add})`;
  } else {
    return { state, error: '不明なアクションです' };
  }

  return {
    state: advanceHoldemPhase({
      ...state,
      players,
      pot,
      highestBet,
      lastLog: log,
    }),
  };
}

export function computeHoldemBotAction(state: HoldemInternalState): { type: string; payload?: unknown } | null {
  if (state.subPhase === 'showdown') return null;
  const bot = state.players[state.turnIndex];
  const toCall = Math.max(0, state.highestBet - bot.currentBet);

  const ev = evaluateBestSeven([...bot.holeCards, ...state.communityCards]);
  if (toCall > state.rules.bigBlind * 3 && (!ev || ev.category === 1) && Math.random() < 0.55) {
    return { type: 'fold' };
  }
  if (ev && ev.category >= 3 && Math.random() < 0.35 && bot.chips >= toCall + state.rules.bigBlind) {
    return { type: 'raise', payload: { amount: state.rules.bigBlind } };
  }
  return { type: 'call' };
}

export function sanitizeHoldemState(state: HoldemInternalState, playerId: string): HoldemClientState {
  const me = state.players.find((p) => p.id === playerId);
  const showAll = state.subPhase === 'showdown' || state.phase === 'finished';
  return {
    rules: state.rules,
    myId: playerId,
    myHoleCards: me ? me.holeCards : [],
    communityCards: state.communityCards,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      chips: p.chips,
      currentBet: p.currentBet,
      folded: p.folded,
      revealedHole: showAll && !p.folded ? p.holeCards : p.id === playerId ? p.holeCards : null,
      evaluated:
        showAll && !p.folded
          ? p.evaluated
          : p.id === playerId
          ? evaluateBestSeven([...p.holeCards, ...state.communityCards])
          : null,
    })),
    pot: state.pot,
    highestBet: state.highestBet,
    round: state.round,
    dealerIndex: state.dealerIndex,
    turnPlayerId: state.players[state.turnIndex]?.id ?? '',
    subPhase: state.subPhase,
    handWinners: state.handWinners,
    phase: state.phase,
    lastLog: state.lastLog,
  };
}
