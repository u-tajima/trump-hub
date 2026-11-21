import type { Card } from '../types/card';
import type { PlayerInfo, PokerRules } from '../types/game';
import { createDeck, shuffle, sortCardsByRank } from '../utils/deck';

export type PokerHandCategory =
  | 10 // Five of a Kind (with Joker)
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
  // 同じランク4枚 + ジョーカー = ファイブカード
  if (normals.length === 4 && normals.every((c) => c.rank === normals[0].rank)) {
    const rv = rankVal(normals[0].rank);
    return {
      category: 10,
      tiebreakers: [rv],
      name: 'ファイブカード',
      score: 10 * 1e10 + rv * 1e8,
    };
  }

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

function nextActiveIndex(players: PokerPlayerState[], fromIdx: number, requireChips = false): number {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIdx + step) % n;
    if (!players[idx].folded && (!requireChips || players[idx].chips > 0)) return idx;
  }
  for (let step = 1; step <= n; step++) {
    const idx = (fromIdx + step) % n;
    if (!players[idx].folded) return idx;
  }
  return fromIdx;
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
    // チップ0で破産したプレイヤーは救済アンティ（ante * 2）を付与して全ハンド参加可能にする
    const effectiveChips = p.chips <= 0 ? rules.ante * 2 : p.chips;
    const antePaid = Math.min(effectiveChips, rules.ante);
    pot += antePaid;
    const hand = sortCardsByRank(deck.slice(cursor, cursor + 5));
    cursor += 5;
    return {
      ...p,
      chips: effectiveChips - antePaid,
      hand,
      currentBet: 0,
      folded: false,
      actedThisRound: false,
      evaluated: null,
    };
  });

  const turnIndex = nextActiveIndex(players, dealerIndex, true);

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

  const winners = players.filter((p) => !p.folded && (active.length === 1 || p.evaluated?.score === bestScore));
  const winCount = Math.max(1, winners.length);
  const share = Math.floor(state.pot / winCount);
  const remainder = state.pot - share * winCount;
  winners.forEach((w, idx) => {
    const target = players.find((p) => p.id === w.id);
    if (target) target.chips += share + (idx === 0 ? remainder : 0);
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

  const activeWithChips = active.filter((p) => p.chips > 0);
  const everyoneSettled =
    activeWithChips.length === 0 ||
    activeWithChips.every((p) => p.actedThisRound && p.currentBet === state.highestBet);

  if (everyoneSettled) {
    if (state.subPhase === 'bet1') {
      const players = state.players.map((p) => ({ ...p, currentBet: 0, actedThisRound: false }));
      return {
        ...state,
        players,
        highestBet: 0,
        subPhase: 'draw',
        turnIndex: nextActiveIndex(players, state.dealerIndex, false),
        lastLog: 'カード交換フェーズ：不要なカードを選んで交換してください',
      };
    }
    return resolveShowdown(state);
  }

  return {
    ...state,
    turnIndex: nextActiveIndex(state.players, state.turnIndex, true),
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
  if (action.type === 'nextHand') {
    return { state };
  }

  const current = state.players[state.turnIndex];
  if (current.id !== playerId) return { state, error: 'あなたのターンではありません' };

  if (state.subPhase === 'draw') {
    if (action.type !== 'draw') return { state, error: '交換するカードを選んでください' };
    const discardIds = (action.payload as { discardIds?: string[] })?.discardIds ?? [];
    const kept = current.hand.filter((c) => !discardIds.includes(c.id));
    const drawCount = current.hand.length - kept.length;

    let poolDeck = [...state.deck];
    if (poolDeck.length < drawCount) {
      const inUseIds = new Set<string>();
      state.players.forEach((p, idx) => {
        const cards = idx === state.turnIndex ? kept : p.hand;
        cards.forEach((c) => inUseIds.add(c.id));
      });
      poolDeck.forEach((c) => inUseIds.add(c.id));
      const recycled = shuffle(
        createDeck(state.rules.jokerEnabled ? 1 : 0).filter((c) => !inUseIds.has(c.id))
      );
      poolDeck = [...poolDeck, ...recycled];
    }

    const drawn = poolDeck.slice(0, drawCount);
    const nextDeck = poolDeck.slice(drawCount);

    const players = state.players.map((p, idx) =>
      idx === state.turnIndex
        ? { ...p, hand: sortCardsByRank([...kept, ...drawn]), actedThisRound: true }
        : p
    );

    const active = players.filter((p) => !p.folded);
    if (active.every((p) => p.actedThisRound)) {
      const resetPlayers = players.map((p) => ({ ...p, currentBet: 0, actedThisRound: false }));
      const canBetCount = resetPlayers.filter((p) => !p.folded && p.chips > 0).length;
      if (canBetCount <= 1) {
        return {
          state: resolveShowdown({
            ...state,
            players: resetPlayers,
            deck: nextDeck,
            highestBet: 0,
          }),
        };
      }
      return {
        state: {
          ...state,
          players: resetPlayers,
          deck: nextDeck,
          highestBet: 0,
          subPhase: 'bet2',
          turnIndex: nextActiveIndex(resetPlayers, state.dealerIndex, true),
          lastLog: `${current.name} が${drawCount}枚交換 → 最終ベット開始`,
        },
      };
    }

    return {
      state: {
        ...state,
        players,
        deck: nextDeck,
        turnIndex: nextActiveIndex(players, state.turnIndex, false),
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
      players.forEach((p, idx) => {
        if (idx !== state.turnIndex && !p.folded && p.chips > 0) {
          p.actedThisRound = false;
        }
      });
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

function choosePokerDrawDiscards(hand: Card[]): string[] {
  const ev = evaluatePokerHand(hand);
  // ストレート以上が完成していれば交換なし（スタンドパット）
  if (ev.category >= 5) return [];

  const normals = hand.filter((c) => c.suit !== 'joker');
  const counts = new Map<number, number>();
  for (const c of normals) {
    counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  }

  // ペア・ツーペア・スリーカード・フォーカードがある場合：役を構成するカード（＋ジョーカー）を残す
  const hasNaturalMeld = Array.from(counts.values()).some((cnt) => cnt >= 2);
  if (hasNaturalMeld) {
    const singletons = normals
      .filter((c) => (counts.get(c.rank) ?? 0) === 1)
      .sort((a, b) => rankVal(a.rank) - rankVal(b.rank)); // 弱い順

    // ワンペアでエース(A)のキッカーがある場合はAも残して2枚交換（ツーペア・トリプス狙い）
    if (ev.category === 2 && singletons.length === 3 && rankVal(singletons[2].rank) === 14) {
      return [singletons[0].id, singletons[1].id];
    }
    return singletons.map((c) => c.id);
  }

  // ジョーカー1枚＋バラ4枚（ワンペア判定）の場合
  const hasJoker = hand.some((c) => c.suit === 'joker');
  if (hasJoker) {
    // 同じスートが3枚あればフラッシュドロー（1枚だけ交換）
    const suitCounts = new Map<Card['suit'], Card[]>();
    for (const c of normals) {
      const list = suitCounts.get(c.suit) ?? [];
      list.push(c);
      suitCounts.set(c.suit, list);
    }
    for (const [suit, list] of suitCounts.entries()) {
      if (list.length >= 3) {
        return normals.filter((c) => c.suit !== suit).map((c) => c.id);
      }
    }
    // それ以外はジョーカー＋最強カード1枚を残して3枚交換
    const sorted = [...normals].sort((a, b) => rankVal(b.rank) - rankVal(a.rank));
    return sorted.slice(1).map((c) => c.id);
  }

  // ハイカード（バラ5枚）：4枚フラッシュドローの確認
  const suitCounts = new Map<Card['suit'], Card[]>();
  for (const c of normals) {
    const list = suitCounts.get(c.suit) ?? [];
    list.push(c);
    suitCounts.set(c.suit, list);
  }
  for (const [suit, list] of suitCounts.entries()) {
    if (list.length === 4) {
      const outlier = normals.find((c) => c.suit !== suit);
      if (outlier) return [outlier.id];
    }
  }

  // 4枚ストレートドロー（4枚のランク幅が4以内）の確認
  const sortedByVal = [...normals].sort((a, b) => rankVal(a.rank) - rankVal(b.rank));
  if (rankVal(sortedByVal[3].rank) - rankVal(sortedByVal[0].rank) <= 4) {
    return [sortedByVal[4].id];
  }
  if (rankVal(sortedByVal[4].rank) - rankVal(sortedByVal[1].rank) <= 4) {
    return [sortedByVal[0].id];
  }

  // ドロー目がなければ上位1〜2枚（AやKなど）を残して3〜4枚交換
  const desc = [...normals].sort((a, b) => rankVal(b.rank) - rankVal(a.rank));
  if (rankVal(desc[0].rank) >= 13 && rankVal(desc[1].rank) >= 12) {
    return desc.slice(2).map((c) => c.id);
  }
  return desc.slice(1).map((c) => c.id);
}

function evaluatePokerHandStrength(hand: Card[], subPhase: PokerSubPhase): number {
  const ev = evaluatePokerHand(hand);
  const topRank = ev.tiebreakers[0] ?? 2;

  if (ev.category >= 7) return 0.99; // フルハウス以上
  if (ev.category === 6) return 0.95; // フラッシュ
  if (ev.category === 5) return 0.90; // ストレート
  if (ev.category === 4) return 0.83 + (topRank / 14) * 0.05; // スリーカード
  if (ev.category === 3) return 0.68 + (topRank / 14) * 0.10; // ツーペア
  if (ev.category === 2) {
    // ワンペア：J〜Aのハイペアとローペアを明確に区別
    if (topRank >= 11) {
      return 0.48 + ((topRank - 10) / 4) * 0.16; // 0.52 .. 0.64
    }
    return 0.28 + (topRank / 10) * 0.16; // 0.31 .. 0.44
  }

  // ハイカード：ドロー前の4枚フラッシュ/ストレートドローは期待値を加算
  if (subPhase === 'bet1') {
    const discards = choosePokerDrawDiscards(hand);
    if (discards.length === 1) return 0.42;
  }
  return 0.12 + (topRank / 14) * 0.12;
}

export function computePokerBotAction(state: PokerInternalState): { type: string; payload?: unknown } | null {
  if (state.subPhase === 'showdown') return null;
  const bot = state.players[state.turnIndex];

  if (state.subPhase === 'draw') {
    const discardIds = choosePokerDrawDiscards(bot.hand);
    return { type: 'draw', payload: { discardIds } };
  }

  const ante = Math.max(5, state.rules.ante);
  const toCall = Math.max(0, state.highestBet - bot.currentBet);
  const activeOpponents = state.players.filter(
    (p, idx) => idx !== state.turnIndex && !p.folded
  ).length;

  if (activeOpponents === 0 || bot.chips === 0) {
    return { type: 'call' };
  }

  const strength = evaluatePokerHandStrength(bot.hand, state.subPhase);
  const potOdds = toCall > 0 ? toCall / (state.pot + toCall) : 0;

  const snapBet = (raw: number) => {
    const step = Math.max(5, Math.floor(ante / 2));
    const snapped = Math.round(raw / step) * step;
    return Math.max(ante, Math.min(bot.chips - toCall, snapped));
  };

  // チェック可能な場面 (toCall === 0)
  if (toCall === 0) {
    if (bot.chips < ante) return { type: 'call' };

    if (strength >= 0.68) {
      const mult = state.subPhase === 'bet2' ? 0.75 : 0.55;
      return { type: 'raise', payload: { amount: snapBet(state.pot * mult) } };
    }
    if (strength >= 0.50 && Math.random() < 0.75) {
      return { type: 'raise', payload: { amount: snapBet(state.pot * 0.45) } };
    }
    // ドロー後のチェック回りに対する計算されたブラフ
    if (state.subPhase === 'bet2' && strength < 0.30 && Math.random() < 0.16) {
      return { type: 'raise', payload: { amount: snapBet(state.pot * 0.4) } };
    }
    return { type: 'call' };
  }

  // ベット・レイズに直面している場面 (toCall > 0)
  if (
    strength >= 0.78 &&
    bot.chips > toCall + ante &&
    state.highestBet < state.rules.startChips * 0.55
  ) {
    const raiseAmt = snapBet(Math.max(ante * 2, (state.pot + toCall) * 0.55));
    return { type: 'raise', payload: { amount: raiseAmt } };
  }

  const drawBonus = state.subPhase === 'bet1' ? 0.10 : 0;
  const heavyBet = toCall >= ante * 3 || toCall > bot.chips * 0.4;
  const minRequired = state.subPhase === 'bet2' && heavyBet ? 0.44 : 0.28;

  if (strength + drawBonus >= potOdds + 0.08 && strength >= minRequired) {
    return { type: 'call' };
  }

  if (toCall <= ante && strength >= 0.32) {
    return { type: 'call' };
  }

  return { type: 'fold' };
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
