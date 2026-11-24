import type { Card } from '../types/card';
import type { BlackjackRules, PlayerInfo } from '../types/game';
import { createDeck, shuffle } from '../utils/deck';

export type BlackjackSubPhase = 'betting' | 'playing' | 'roundEnd';

export type BlackjackPlayerStatus =
  | 'waiting'
  | 'playing'
  | 'stand'
  | 'bust'
  | 'blackjack'
  | 'out';

export type BlackjackResult = 'bj' | 'win' | 'push' | 'bust' | 'lose' | null;

export interface BlackjackHandEval {
  total: number;
  isSoft: boolean;
  isBlackjack: boolean;
  isBust: boolean;
}

export interface BlackjackPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  chips: number;
  bet: number;
  betConfirmed: boolean;
  hand: Card[];
  status: BlackjackPlayerStatus;
  result: BlackjackResult;
  lastPayout: number;
  lastNet: number;
}

export interface BlackjackInternalState {
  rules: BlackjackRules;
  players: BlackjackPlayerState[];
  dealerHand: Card[];
  shoe: Card[];
  round: number;
  turnIndex: number;
  subPhase: BlackjackSubPhase;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface BlackjackClientState {
  rules: BlackjackRules;
  myId: string;
  players: {
    id: string;
    name: string;
    isBot: boolean;
    chips: number;
    bet: number;
    betConfirmed: boolean;
    hand: Card[];
    eval: BlackjackHandEval;
    status: BlackjackPlayerStatus;
    result: BlackjackResult;
    lastPayout: number;
    lastNet: number;
  }[];
  dealerHand: Card[];
  dealerHoleHidden: boolean;
  dealerEval: BlackjackHandEval;
  round: number;
  turnPlayerId: string;
  subPhase: BlackjackSubPhase;
  phase: 'playing' | 'finished';
  lastLog: string;
}

function createShoe(deckCount = 4): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < deckCount; d++) {
    const oneDeck = createDeck(0);
    for (const c of oneDeck) {
      cards.push({ ...c, id: `d${d}-${c.id}` });
    }
  }
  return shuffle(cards);
}

function drawCard(shoe: Card[]): { card: Card; shoe: Card[] } {
  const nextShoe = shoe.length > 0 ? [...shoe] : createShoe(4);
  const card = nextShoe.shift()!;
  return { card, shoe: nextShoe };
}

export function evaluateBlackjackHand(cards: Card[]): BlackjackHandEval {
  let total = 0;
  let aces = 0;

  for (const c of cards) {
    if (c.rank === 1) {
      total += 11;
      aces += 1;
    } else if (c.rank >= 10) {
      total += 10;
    } else {
      total += c.rank;
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  const isSoft = aces > 0;
  const isBlackjack = cards.length === 2 && total === 21;
  const isBust = total > 21;

  return { total, isSoft, isBlackjack, isBust };
}

function prepareBettingRound(
  playersIn: BlackjackPlayerState[],
  shoeIn: Card[],
  rules: BlackjackRules,
  round: number
): BlackjackInternalState {
  const shoe = shoeIn.length < 30 ? createShoe(4) : [...shoeIn];
  const players: BlackjackPlayerState[] = playersIn.map((p) => {
    const out = p.chips <= 0;
    return {
      ...p,
      bet: 0,
      betConfirmed: out,
      hand: [],
      status: out ? 'out' : 'waiting',
      result: null,
      lastPayout: 0,
      lastNet: 0,
    };
  });

  const firstUnconfirmed = players.findIndex((p) => !p.betConfirmed);
  const roundLabel = rules.rounds > 0 ? `${round}/${rules.rounds}` : `${round}`;

  return {
    rules,
    players,
    dealerHand: [],
    shoe,
    round,
    turnIndex: firstUnconfirmed >= 0 ? firstUnconfirmed : 0,
    subPhase: 'betting',
    phase: 'playing',
    lastLog: `ラウンド ${roundLabel}：ベット額を決めて確定してください`,
  };
}

export function initBlackjack(
  playersInfo: PlayerInfo[],
  rules: BlackjackRules
): BlackjackInternalState {
  const players: BlackjackPlayerState[] = playersInfo.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    chips: rules.startChips,
    bet: 0,
    betConfirmed: false,
    hand: [],
    status: 'waiting',
    result: null,
    lastPayout: 0,
    lastNet: 0,
  }));

  return prepareBettingRound(players, createShoe(4), rules, 1);
}

function resolveDealerAndSettle(state: BlackjackInternalState): BlackjackInternalState {
  let shoe = [...state.shoe];
  const dealerHand = [...state.dealerHand];

  const hasNonBustPlayer = state.players.some(
    (p) => p.bet > 0 && p.status !== 'bust' && p.status !== 'out'
  );

  // 全員バーストしていない場合、ディーラーが規定ルールで引く
  if (hasNonBustPlayer) {
    while (true) {
      const ev = evaluateBlackjackHand(dealerHand);
      const shouldHit =
        ev.total < 17 ||
        (state.rules.dealerHitsSoft17 && ev.total === 17 && ev.isSoft);
      if (!shouldHit) break;
      const drawn = drawCard(shoe);
      dealerHand.push(drawn.card);
      shoe = drawn.shoe;
    }
  }

  const dealerEval = evaluateBlackjackHand(dealerHand);

  const players = state.players.map((p) => {
    if (p.bet <= 0 || p.status === 'out') {
      return { ...p, result: null as BlackjackResult, lastPayout: 0, lastNet: 0 };
    }

    const pEval = evaluateBlackjackHand(p.hand);
    let result: BlackjackResult = 'lose';
    let payout = 0;

    if (p.status === 'bust' || pEval.isBust) {
      result = 'bust';
      payout = 0;
    } else if (pEval.isBlackjack && !dealerEval.isBlackjack) {
      result = 'bj';
      payout = p.bet + Math.floor(p.bet * 1.5);
    } else if (pEval.isBlackjack && dealerEval.isBlackjack) {
      result = 'push';
      payout = p.bet;
    } else if (!pEval.isBlackjack && dealerEval.isBlackjack) {
      result = 'lose';
      payout = 0;
    } else if (dealerEval.isBust || pEval.total > dealerEval.total) {
      result = 'win';
      payout = p.bet * 2;
    } else if (pEval.total === dealerEval.total) {
      result = 'push';
      payout = p.bet;
    } else {
      result = 'lose';
      payout = 0;
    }

    return {
      ...p,
      chips: p.chips + payout,
      result,
      lastPayout: payout,
      lastNet: payout - p.bet,
    };
  });

  const isFinalRound = state.rules.rounds > 0 && state.round >= state.rules.rounds;
  const allBroke = players.every((p) => p.chips <= 0);
  const dealerText = dealerEval.isBlackjack
    ? 'BLACKJACK (21)'
    : dealerEval.isBust
    ? `BUST (${dealerEval.total})`
    : `${dealerEval.total}`;

  return {
    ...state,
    players,
    dealerHand,
    shoe,
    subPhase: 'roundEnd',
    phase: isFinalRound || allBroke ? 'finished' : 'playing',
    lastLog: `ディーラー ${dealerText} — 精算完了！`,
  };
}

function advanceTurnOrSettle(
  state: BlackjackInternalState,
  fromIdx: number
): BlackjackInternalState {
  for (let i = fromIdx + 1; i < state.players.length; i++) {
    if (state.players[i].status === 'playing') {
      return {
        ...state,
        turnIndex: i,
      };
    }
  }
  return resolveDealerAndSettle(state);
}

function dealInitialCards(state: BlackjackInternalState): BlackjackInternalState {
  let shoe = [...state.shoe];
  const players = state.players.map((p) => {
    if (p.bet <= 0 || p.status === 'out') {
      return { ...p, hand: [], status: 'out' as BlackjackPlayerStatus };
    }
    const c1 = drawCard(shoe);
    shoe = c1.shoe;
    const c2 = drawCard(shoe);
    shoe = c2.shoe;
    const hand = [c1.card, c2.card];
    const ev = evaluateBlackjackHand(hand);
    return {
      ...p,
      hand,
      status: (ev.isBlackjack ? 'blackjack' : 'playing') as BlackjackPlayerStatus,
    };
  });

  const d1 = drawCard(shoe);
  shoe = d1.shoe;
  const d2 = drawCard(shoe);
  shoe = d2.shoe;
  const dealerHand = [d1.card, d2.card];

  const firstPlaying = players.findIndex((p) => p.status === 'playing');
  const dealtState: BlackjackInternalState = {
    ...state,
    players,
    dealerHand,
    shoe,
    subPhase: 'playing',
    turnIndex: firstPlaying >= 0 ? firstPlaying : 0,
    lastLog:
      firstPlaying >= 0
        ? `カード配布完了！${players[firstPlaying].name} のターン`
        : '全員ナチュラルBJ！ディーラーと精算します',
  };

  if (firstPlaying < 0) {
    return resolveDealerAndSettle(dealtState);
  }
  return dealtState;
}

export function applyBlackjackAction(
  state: BlackjackInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: BlackjackInternalState; error?: string } {
  if (state.phase === 'finished') {
    return { state, error: 'ゲームは終了しています' };
  }

  if (state.subPhase === 'roundEnd') {
    if (action.type === 'nextRound' || action.type === 'nextHand') {
      return {
        state: prepareBettingRound(state.players, state.shoe, state.rules, state.round + 1),
      };
    }
    return { state, error: '次のラウンドへ進んでください' };
  }

  if (action.type === 'nextRound' || action.type === 'nextHand') {
    return { state };
  }

  if (state.subPhase === 'betting') {
    if (action.type !== 'placeBet') {
      return { state, error: 'ベット額を確定してください' };
    }
    const pIdx = state.players.findIndex((p) => p.id === playerId);
    if (pIdx < 0) return { state, error: 'プレイヤーが見つかりません' };
    const target = state.players[pIdx];
    if (target.betConfirmed) return { state, error: 'すでにベット確定済みです' };
    if (target.chips <= 0) return { state, error: 'チップがありません' };

    const rawAmount = Number((action.payload as { amount?: number })?.amount ?? state.rules.minBet);
    const minAllowed = Math.min(target.chips, Math.max(1, state.rules.minBet));
    const amount = Math.floor(rawAmount);
    if (!Number.isFinite(amount) || amount < minAllowed || amount > target.chips) {
      return {
        state,
        error: `ベット額は ${minAllowed}〜${target.chips} の範囲で指定してください`,
      };
    }

    const players = state.players.map((p, idx) =>
      idx === pIdx
        ? {
            ...p,
            chips: p.chips - amount,
            bet: amount,
            betConfirmed: true,
          }
        : p
    );

    const nextUnconfirmed = players.findIndex((p) => !p.betConfirmed);
    const updated: BlackjackInternalState = {
      ...state,
      players,
      turnIndex: nextUnconfirmed >= 0 ? nextUnconfirmed : 0,
      lastLog: `${target.name} が ${amount} チップをベットしました`,
    };

    if (players.every((p) => p.betConfirmed)) {
      return { state: dealInitialCards(updated) };
    }
    return { state: updated };
  }

  // subPhase === 'playing'
  const current = state.players[state.turnIndex];
  if (!current || current.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }
  if (current.status !== 'playing') {
    return { state, error: 'すでに行動終了しています' };
  }

  if (action.type === 'hit') {
    const drawn = drawCard(state.shoe);
    const nextHand = [...current.hand, drawn.card];
    const ev = evaluateBlackjackHand(nextHand);
    const nextStatus: BlackjackPlayerStatus = ev.isBust
      ? 'bust'
      : ev.total === 21
      ? 'stand'
      : 'playing';

    const players = state.players.map((p, idx) =>
      idx === state.turnIndex ? { ...p, hand: nextHand, status: nextStatus } : p
    );

    const log = ev.isBust
      ? `${current.name} がヒット → ${ev.total} でバースト！`
      : ev.total === 21
      ? `${current.name} がヒット → 21 でスタンド！`
      : `${current.name} がヒット（現在 ${ev.total}）`;

    const nextState: BlackjackInternalState = {
      ...state,
      players,
      shoe: drawn.shoe,
      lastLog: log,
    };

    if (nextStatus !== 'playing') {
      return { state: advanceTurnOrSettle(nextState, state.turnIndex) };
    }
    return { state: nextState };
  }

  if (action.type === 'stand') {
    const ev = evaluateBlackjackHand(current.hand);
    const players = state.players.map((p, idx) =>
      idx === state.turnIndex ? { ...p, status: 'stand' as BlackjackPlayerStatus } : p
    );
    const nextState: BlackjackInternalState = {
      ...state,
      players,
      lastLog: `${current.name} が ${ev.total} でスタンドしました`,
    };
    return { state: advanceTurnOrSettle(nextState, state.turnIndex) };
  }

  if (action.type === 'double') {
    if (current.hand.length !== 2) {
      return { state, error: 'ダブルダウンは最初の2枚のときのみ可能です' };
    }
    if (current.chips < current.bet) {
      return { state, error: 'ダブルダウンに必要なチップが不足しています' };
    }
    const drawn = drawCard(state.shoe);
    const nextHand = [...current.hand, drawn.card];
    const ev = evaluateBlackjackHand(nextHand);
    const nextStatus: BlackjackPlayerStatus = ev.isBust ? 'bust' : 'stand';

    const players = state.players.map((p, idx) =>
      idx === state.turnIndex
        ? {
            ...p,
            chips: p.chips - p.bet,
            bet: p.bet * 2,
            hand: nextHand,
            status: nextStatus,
          }
        : p
    );

    const nextState: BlackjackInternalState = {
      ...state,
      players,
      shoe: drawn.shoe,
      lastLog: ev.isBust
        ? `${current.name} がダブルダウン → ${ev.total} でバースト！`
        : `${current.name} がダブルダウン → ${ev.total} でスタンド`,
    };
    return { state: advanceTurnOrSettle(nextState, state.turnIndex) };
  }

  return { state, error: '不明なアクションです' };
}

export function sanitizeBlackjackState(
  state: BlackjackInternalState,
  playerId: string
): BlackjackClientState {
  const dealerHoleHidden = state.subPhase === 'playing' && state.dealerHand.length >= 2;
  const visibleDealerHand = dealerHoleHidden ? [state.dealerHand[0]] : state.dealerHand;

  const turnPlayerId =
    state.subPhase === 'betting'
      ? state.players.find((p) => !p.betConfirmed)?.id ?? ''
      : state.subPhase === 'playing'
      ? state.players[state.turnIndex]?.id ?? ''
      : '';

  return {
    rules: state.rules,
    myId: playerId,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      chips: p.chips,
      bet: p.bet,
      betConfirmed: p.betConfirmed,
      hand: p.hand,
      eval: evaluateBlackjackHand(p.hand),
      status: p.status,
      result: p.result,
      lastPayout: p.lastPayout,
      lastNet: p.lastNet,
    })),
    dealerHand: visibleDealerHand,
    dealerHoleHidden,
    dealerEval: evaluateBlackjackHand(visibleDealerHand),
    round: state.round,
    turnPlayerId,
    subPhase: state.subPhase,
    phase: state.phase,
    lastLog: state.lastLog,
  };
}

export function computeBlackjackBotAction(
  state: BlackjackInternalState,
  botId?: string
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing' || state.subPhase === 'roundEnd') return null;

  if (state.subPhase === 'betting') {
    const bot = botId
      ? state.players.find((p) => p.id === botId && p.isBot && !p.betConfirmed)
      : state.players.find((p) => p.isBot && !p.betConfirmed);
    if (!bot || bot.chips <= 0) return null;

    const minBet = Math.min(bot.chips, Math.max(1, state.rules.minBet));
    const multiplier = Math.random() < 0.25 ? 2 : 1;
    const amount = Math.min(bot.chips, Math.max(minBet, minBet * multiplier));
    return { type: 'placeBet', payload: { amount } };
  }

  const bot = state.players[state.turnIndex];
  if (!bot || !bot.isBot || bot.status !== 'playing') return null;

  const ev = evaluateBlackjackHand(bot.hand);
  const dealerUp = state.dealerHand[0];
  const dealerVal = dealerUp
    ? dealerUp.rank === 1
      ? 11
      : Math.min(10, dealerUp.rank)
    : 10;

  const canDouble = bot.hand.length === 2 && bot.chips >= bot.bet;

  // ベーシックストラテジー準拠の簡易判定
  if (ev.isSoft) {
    if (ev.total >= 19) return { type: 'stand' };
    if (ev.total === 18) {
      if (canDouble && dealerVal >= 3 && dealerVal <= 6) return { type: 'double' };
      return dealerVal >= 9 ? { type: 'hit' } : { type: 'stand' };
    }
    if (canDouble && ev.total >= 16 && dealerVal >= 4 && dealerVal <= 6) {
      return { type: 'double' };
    }
    return { type: 'hit' };
  }

  // ハードハンド
  if (ev.total >= 17) return { type: 'stand' };
  if (ev.total === 11 && canDouble) return { type: 'double' };
  if (ev.total === 10 && canDouble && dealerVal <= 9) return { type: 'double' };
  if (ev.total <= 11) return { type: 'hit' };

  // 12〜16
  if (ev.total === 12) {
    return dealerVal >= 4 && dealerVal <= 6 ? { type: 'stand' } : { type: 'hit' };
  }
  return dealerVal >= 2 && dealerVal <= 6 ? { type: 'stand' } : { type: 'hit' };
}
