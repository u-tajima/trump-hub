import type { Card } from '../types/card';
import type { PlayerInfo, PokerRules } from '../types/game';
import { createDeck, shuffle, sortCardsByRank } from '../utils/deck';

export type PokerHandCategory =
  | 9 // Straight Flush / Royal
  | 8 // Four of a Kind
  | 7 // Full House
  | 6 // Flush
  | 5 // Straight
  | 4 // Three of a Kind
  | 3 // Two Pair
  | 2 // One Pair
  | 1; // High Card

export interface EvaluatedPokerHand {
  category: PokerHandCategory;
  tiebreakers: number[];
  name: string;
  score: number; // comparable numeric score
}

export interface PokerPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  chips: number;
  hand: Card[];
  currentBet: number;
  folded: boolean;
  actedThisRound: boolean;
  evaluated: EvaluatedPokerHand | null;
}

export type PokerSubPhase = 'bet1' | 'draw' | 'bet2' | 'showdown';

export interface PokerInternalState {
  rules: PokerRules;
  players: PokerPlayerState[];
  deck: Card[];
  pot: number;
  highestBet: number;
  round: number;
  dealerIndex: number;
  turnIndex: number;
  subPhase: PokerSubPhase;
  handWinners: string[];
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface PokerClientState {
  rules: PokerRules;
  myId: string;
  myHand: Card[];
  players: {
    id: string;
    name: string;
    isBot: boolean;
    chips: number;
    handCount: number;
    currentBet: number;
    folded: boolean;
    revealedHand: Card[] | null;
    evaluated: EvaluatedPokerHand | null;
  }[];
  pot: number;
  highestBet: number;
  round: number;
  dealerIndex: number;
  turnPlayerId: string;
  subPhase: PokerSubPhase;
  handWinners: string[];
  phase: 'playing' | 'finished';
  lastLog: string;
}

function rankVal(r: number): number {
  return r === 1 ? 14 : r;
}

function evaluateFiveNormal(cards: Card[]): EvaluatedPokerHand {
  const ranks = cards.map((c) => rankVal(c.rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  const uniqueRanks = Array.from(new Set(ranks));
  let isStraight = false;
  let straightHigh = 0;
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) {
      isStraight = true;
      straightHigh = uniqueRanks[0];
    } else if (
      uniqueRanks[0] === 14 &&
      uniqueRanks[1] === 5 &&
      uniqueRanks[2] === 4 &&
      uniqueRanks[3] === 3 &&
      uniqueRanks[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  let category: PokerHandCategory = 1;
  let tiebreakers: number[] = ranks;
  let name = 'ハイカード';

  if (isFlush && isStraight) {
    category = 9;
    tiebreakers = [straightHigh];
    name = straightHigh === 14 ? 'ロイヤルフラッシュ' : 'ストレートフラッシュ';
  } else if (groups[0][1] === 4) {
    category = 8;
    tiebreakers = [groups[0][0], groups[1][0]];
    name = 'フォーカード';
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    category = 7;
    tiebreakers = [groups[0][0], groups[1][0]];
    name = 'フルハウス';
  } else if (isFlush) {
    category = 6;
    tiebreakers = ranks;
    name = 'フラッシュ';
  } else if (isStraight) {
    category = 5;
    tiebreakers = [straightHigh];
    name = 'ストレート';
  } else if (groups[0][1] === 3) {
    category = 4;
    tiebreakers = [groups[0][0], ...groups.slice(1).map((g) => g[0])];
    name = 'スリーカード';
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    category = 3;
    tiebreakers = [groups[0][0], groups[1][0], groups[2][0]];
    name = 'ツーペア';
  } else if (groups[0][1] === 2) {
    category = 2;
    tiebreakers = [groups[0][0], ...groups.slice(1).map((g) => g[0])];
    name = 'ワンペア';
  }

  const score =
    category * 1e10 +
    (tiebreakers[0] ?? 0) * 1e8 +
    (tiebreakers[1] ?? 0) * 1e6 +
    (tiebreakers[2] ?? 0) * 1e4 +
    (tiebreakers[3] ?? 0) * 1e2 +
    (tiebreakers[4] ?? 0);

  return { category, tiebreakers, name, score };
}

export function evaluatePokerHand(cards: Card[]): EvaluatedPokerHand {
  const jokers = cards.filter((c) => c.suit === 'joker');
  if (jokers.length === 0) return evaluateFiveNormal(cards);

  const normals = cards.filter((c) => c.suit !== 'joker');
  const suits: Card['suit'][] = ['spade', 'heart', 'diamond', 'club'];
  let best: EvaluatedPokerHand | null = null;

  for (const s of suits) {
    for (let r = 1; r <= 13; r++) {
      const sub: Card = { id: `wild-${s}-${r}`, suit: s, rank: r as Card['rank'] };
      const ev = evaluateFiveNormal([...normals, sub]);
      if (!best || ev.score > best.score) best = ev;
    }
  }
  return best!;
}

function startNewHand(
  playersIn: PokerPlayerState[],
  rules: PokerRules,
  round: number,
  dealerIndex: number
): PokerInternalState {
  const deck = shuffle(createDeck(rules.jokerEnabled ? 1 : 0));
  let cursor = 0;
  let pot = 0;

  const players: PokerPlayerState[] = playersIn.map((p) => {
    const antePaid = Math.min(p.chips, rules.ante);
    pot += antePaid;
    const hand = sortCardsByRank(deck.slice(cursor, cursor + 5));
    cursor += 5;
    return {
      ...p,
      chips: p.chips - antePaid,
      hand,
      currentBet: 0,
      folded: false,
      actedThisRound: false,
      evaluated: null,
    };
  });

  const turnIndex = (dealerIndex + 1) % players.length;

  return {
    rules,
    players,
    deck: deck.slice(cursor),
    pot,
    highestBet: 0,
    round,
    dealerIndex,
    turnIndex,
    subPhase: 'bet1',
    handWinners: [],
    phase: 'playing',
    lastLog: `ハンド ${round}/${rules.rounds} 開始（アンティ ${rules.ante}）`,
  };
}

export function initPoker(playersInfo: PlayerInfo[], rules: PokerRules): PokerInternalState {
  const players: PokerPlayerState[] = playersInfo.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    chips: rules.startChips,
    hand: [],
    currentBet: 0,
    folded: false,
    actedThisRound: false,
    evaluated: null,
  }));
  return startNewHand(players, rules, 1, 0);
}

function nextActiveIndex(players: PokerPlayerState[], fromIdx: number): number {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIdx + step) % n;
    if (!players[idx].folded) return idx;
  }
  return fromIdx;
}

function resolveShowdown(state: PokerInternalState): PokerInternalState {
  const active = state.players.filter((p) => !p.folded);
  const players = state.players.map((p) => ({
    ...p,
    evaluated: p.folded ? null : evaluatePokerHand(p.hand),
  }));

  let bestScore = -1;
  for (const p of players) {
    if (!p.folded && p.evaluated && p.evaluated.score > bestScore) {
      bestScore = p.evaluated.score;
    }
  }

  const winners = players.filter((p) => !p.folded && p.evaluated?.score === bestScore);
  const share = Math.floor(state.pot / Math.max(1, winners.length));
  winners.forEach((w) => {
    const target = players.find((p) => p.id === w.id);
    if (target) target.chips += share;
  });

  const winnerNames = winners.map((w) => `${w.name}(${w.evaluated?.name})`).join(' & ');
  const isFinalRound = state.round >= state.rules.rounds;

  return {
    ...state,
    players,
    subPhase: 'showdown',
    handWinners: winners.map((w) => w.id),
    phase: isFinalRound ? 'finished' : 'playing',
    lastLog:
      active.length === 1
        ? `${winners[0].name} が総取り (+${state.pot})`
        : `ショーダウン: ${winnerNames} がポット ${state.pot} を獲得！`,
  };
}

function advanceBetOrPhase(state: PokerInternalState): PokerInternalState {
  const active = state.players.filter((p) => !p.folded);
  if (active.length <= 1) {
    return resolveShowdown(state);
  }

  const everyoneSettled = active.every(
    (p) => p.actedThisRound && (p.currentBet === state.highestBet || p.chips === 0)
  );

  if (everyoneSettled) {
    if (state.subPhase === 'bet1') {
      const players = state.players.map((p) => ({ ...p, currentBet: 0, actedThisRound: false }));
      return {
        ...state,
        players,
        highestBet: 0,
        subPhase: 'draw',
        turnIndex: nextActiveIndex(players, state.dealerIndex),
        lastLog: 'カード交換フェーズ：不要なカードを選んで交換してください',
      };
    }
    return resolveShowdown(state);
  }

  return {
    ...state,
    turnIndex: nextActiveIndex(state.players, state.turnIndex),
  };
}

export function applyPokerAction(
  state: PokerInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: PokerInternalState; error?: string } {
  if (state.phase === 'finished') return { state, error: 'ゲームは終了しています' };

  if (state.subPhase === 'showdown') {
    if (action.type === 'nextHand') {
      const nextDealer = (state.dealerIndex + 1) % state.players.length;
      return { state: startNewHand(state.players, state.rules, state.round + 1, nextDealer) };
    }
    return { state, error: '次のハンドへ進んでください' };
  }

  const current = state.players[state.turnIndex];
  if (current.id !== playerId) return { state, error: 'あなたのターンではありません' };

  if (state.subPhase === 'draw') {
    if (action.type !== 'draw') return { state, error: '交換するカードを選んでください' };
    const discardIds = (action.payload as { discardIds?: string[] })?.discardIds ?? [];
    const kept = current.hand.filter((c) => !discardIds.includes(c.id));
    const drawCount = current.hand.length - kept.length;
    const drawn = state.deck.slice(0, drawCount);
    const nextDeck = state.deck.slice(drawCount);

    const players = state.players.map((p, idx) =>
      idx === state.turnIndex
        ? { ...p, hand: sortCardsByRank([...kept, ...drawn]), actedThisRound: true }
        : p
    );

    const active = players.filter((p) => !p.folded);
    if (active.every((p) => p.actedThisRound)) {
      const resetPlayers = players.map((p) => ({ ...p, currentBet: 0, actedThisRound: false }));
      return {
        state: {
          ...state,
          players: resetPlayers,
          deck: nextDeck,
          highestBet: 0,
          subPhase: 'bet2',
          turnIndex: nextActiveIndex(resetPlayers, state.dealerIndex),
          lastLog: `${current.name} が${drawCount}枚交換 → 最終ベット開始`,
        },
      };
    }

    return {
      state: {
        ...state,
        players,
        deck: nextDeck,
        turnIndex: nextActiveIndex(players, state.turnIndex),
        lastLog: `${current.name} が ${drawCount}枚 交換しました`,
      },
    };
  }

  // bet1 or bet2
  const players = state.players.map((p) => ({ ...p }));
  const me = players[state.turnIndex];
  const toCall = Math.max(0, state.highestBet - me.currentBet);
  let pot = state.pot;
  let highestBet = state.highestBet;
  let log = '';

  if (action.type === 'fold') {
    me.folded = true;
    me.actedThisRound = true;
    log = `${me.name} がフォールドしました`;
  } else if (action.type === 'call') {
    const paid = Math.min(me.chips, toCall);
    me.chips -= paid;
    me.currentBet += paid;
    me.actedThisRound = true;
    pot += paid;
    log = toCall === 0 ? `${me.name} がチェックしました` : `${me.name} がコール (${paid})`;
  } else if (action.type === 'raise') {
    const rawAdd = (action.payload as { amount?: number })?.amount ?? state.rules.ante * 2;
    const add = Math.max(1, Math.floor(rawAdd));
    const totalPay = Math.min(me.chips, toCall + add);
    const actualAdd = Math.max(0, totalPay - toCall);
    me.chips -= totalPay;
    me.currentBet += totalPay;
    me.actedThisRound = true;
    pot += totalPay;
    if (me.currentBet > highestBet) {
      highestBet = me.currentBet;
    }
    log =
      me.chips === 0
        ? `${me.name} がオールイン (${totalPay})`
        : toCall === 0
        ? `${me.name} がベット (${actualAdd})`
        : `${me.name} がレイズ (+${actualAdd})`;
  } else {
    return { state, error: '不明なアクションです' };
  }

  return {
    state: advanceBetOrPhase({
      ...state,
      players,
      pot,
      highestBet,
      lastLog: log,
    }),
  };
}

export function computePokerBotAction(state: PokerInternalState): { type: string; payload?: unknown } | null {
  if (state.subPhase === 'showdown') return null;
  const bot = state.players[state.turnIndex];
  if (state.subPhase === 'draw') {
    const ev = evaluatePokerHand(bot.hand);
    if (ev.category >= 4) {
      return { type: 'draw', payload: { discardIds: [] } };
    }
    // ペア以外のカードを交換
    const counts = new Map<number, number>();
    bot.hand.forEach((c) => counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1));
    const discardIds = bot.hand
      .filter((c) => c.suit !== 'joker' && (counts.get(c.rank) ?? 0) === 1)
      .slice(0, 3)
      .map((c) => c.id);
    return { type: 'draw', payload: { discardIds } };
  }

  const toCall = Math.max(0, state.highestBet - bot.currentBet);
  const ev = evaluatePokerHand(bot.hand);
  if (toCall > 40 && ev.category === 1 && Math.random() < 0.6) {
    return { type: 'fold' };
  }
  if (ev.category >= 3 && Math.random() < 0.35 && bot.chips >= toCall + 20) {
    return { type: 'raise', payload: { amount: 20 } };
  }
  return { type: 'call' };
}

export function sanitizePokerState(state: PokerInternalState, playerId: string): PokerClientState {
  const me = state.players.find((p) => p.id === playerId);
  const showAll = state.subPhase === 'showdown' || state.phase === 'finished';
  return {
    rules: state.rules,
    myId: playerId,
    myHand: me ? me.hand : [],
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      chips: p.chips,
      handCount: p.hand.length,
      currentBet: p.currentBet,
      folded: p.folded,
      revealedHand: showAll && !p.folded ? p.hand : p.id === playerId ? p.hand : null,
      evaluated: showAll ? p.evaluated : p.id === playerId ? evaluatePokerHand(p.hand) : null,
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
