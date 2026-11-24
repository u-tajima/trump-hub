import type { Card, Suit } from '../types/card';
import { formatCardShort } from '../types/card';
import type { IndianPokerRules, PlayerInfo } from '../types/game';
import { createDeck, shuffle } from '../utils/deck';

export type IndianPokerSubPhase = 'betting' | 'showdown';

export interface IndianPokerPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  chips: number;
  card: Card | null;
  currentBet: number;
  totalCommitted: number;
  folded: boolean;
  eliminated: boolean;
  actedThisRound: boolean;
}

export interface IndianPokerInternalState {
  rules: IndianPokerRules;
  players: IndianPokerPlayerState[];
  pot: number;
  highestBet: number;
  round: number;
  dealerIndex: number;
  turnIndex: number;
  subPhase: IndianPokerSubPhase;
  roundWinnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface IndianPokerClientState {
  rules: IndianPokerRules;
  myId: string;
  players: {
    id: string;
    name: string;
    isBot: boolean;
    chips: number;
    card: Card | null; // betting中は自分のみnull、他全員は表向き公開！showdownで全員公開
    currentBet: number;
    folded: boolean;
    eliminated: boolean;
  }[];
  pot: number;
  highestBet: number;
  round: number;
  dealerIndex: number;
  turnPlayerId: string;
  subPhase: IndianPokerSubPhase;
  roundWinnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

const SUIT_STRENGTH: Record<Suit, number> = {
  spade: 4,
  heart: 3,
  diamond: 2,
  club: 1,
  joker: 0,
};

export function indianPokerCardScore(card: Card): number {
  const rankVal = card.rank === 1 ? 14 : card.rank; // A(14) > K(13) > ... > 2
  return rankVal * 10 + SUIT_STRENGTH[card.suit];
}

function nextActiveIndex(
  players: IndianPokerPlayerState[],
  fromIdx: number,
  requireChips = false
): number {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIdx + step) % n;
    const p = players[idx];
    if (!p.folded && !p.eliminated && (!requireChips || p.chips > 0)) {
      return idx;
    }
  }
  for (let step = 1; step <= n; step++) {
    const idx = (fromIdx + step) % n;
    const p = players[idx];
    if (!p.folded && !p.eliminated) {
      return idx;
    }
  }
  return fromIdx;
}

function resolveShowdown(state: IndianPokerInternalState): IndianPokerInternalState {
  const active = state.players.filter((p) => !p.folded && !p.eliminated);

  const pickBest = (candidates: IndianPokerPlayerState[]): IndianPokerPlayerState | undefined => {
    let best = candidates[0];
    for (const p of candidates) {
      if (
        p.card &&
        (!best?.card || indianPokerCardScore(p.card) > indianPokerCardScore(best.card))
      ) {
        best = p;
      }
    }
    return best;
  };

  const mainWinner = pickBest(active);
  const payouts = new Map<string, number>();

  const levels = Array.from(
    new Set(state.players.filter((p) => p.totalCommitted > 0).map((p) => p.totalCommitted))
  ).sort((a, b) => a - b);

  let prevLevel = 0;
  for (const level of levels) {
    const delta = level - prevLevel;
    const contributors = state.players.filter((p) => p.totalCommitted >= level);
    const layerPot = delta * contributors.length;
    const eligible = contributors.filter((p) => !p.folded && !p.eliminated);
    const contenders = eligible.length > 0 ? eligible : active;
    const layerWinner = pickBest(contenders);
    if (layerWinner && layerPot > 0) {
      payouts.set(layerWinner.id, (payouts.get(layerWinner.id) ?? 0) + layerPot);
    }
    prevLevel = level;
  }

  const players = state.players.map((p) => {
    const won = payouts.get(p.id) ?? 0;
    return won > 0 ? { ...p, chips: p.chips + won } : { ...p };
  });

  const survivors = players.filter((p) => p.chips > 0);
  const isFinalRound = state.rules.rounds > 0 && state.round >= state.rules.rounds;
  const finished = isFinalRound || survivors.length <= 1;

  const winCardText = mainWinner?.card ? ` (${formatCardShort(mainWinner.card)})` : '';
  const payoutEntries = state.players
    .filter((p) => (payouts.get(p.id) ?? 0) > 0)
    .map((p) => `${p.name} +${payouts.get(p.id)}`);

  const log =
    active.length === 1 && mainWinner
      ? `${mainWinner.name} が全員フォールドでポット ${state.pot} を獲得！`
      : mainWinner && payoutEntries.length > 1
      ? `ショーダウン！${mainWinner.name}${winCardText} が最強（精算: ${payoutEntries.join(' / ')}）`
      : mainWinner
      ? `ショーダウン！${mainWinner.name}${winCardText} が最強でポット ${state.pot} を獲得！`
      : 'ショーダウン終了';

  return {
    ...state,
    players,
    subPhase: 'showdown',
    roundWinnerId: mainWinner?.id ?? null,
    phase: finished ? 'finished' : 'playing',
    lastLog: log,
  };
}

function startNewRound(
  playersIn: IndianPokerPlayerState[],
  rules: IndianPokerRules,
  round: number,
  dealerIndex: number
): IndianPokerInternalState {
  const deck = shuffle(createDeck(0));
  let cursor = 0;
  let pot = 0;

  const players: IndianPokerPlayerState[] = playersIn.map((p) => {
    if (p.chips <= 0) {
      return {
        ...p,
        card: null,
        currentBet: 0,
        totalCommitted: 0,
        folded: true,
        eliminated: true,
        actedThisRound: true,
      };
    }
    const antePaid = Math.min(p.chips, Math.max(1, rules.ante));
    pot += antePaid;
    const card = deck[cursor++];
    return {
      ...p,
      chips: p.chips - antePaid,
      card,
      currentBet: 0,
      totalCommitted: antePaid,
      folded: false,
      eliminated: false,
      actedThisRound: false,
    };
  });

  const roundLabel = rules.rounds > 0 ? `${round}/${rules.rounds}` : `${round}`;
  const turnIndex = nextActiveIndex(players, dealerIndex, true);

  const baseState: IndianPokerInternalState = {
    rules,
    players,
    pot,
    highestBet: 0,
    round,
    dealerIndex,
    turnIndex,
    subPhase: 'betting',
    roundWinnerId: null,
    phase: 'playing',
    lastLog: `ラウンド ${roundLabel} 開始（アンティ ${rules.ante}）— 相手のカードを見て駆け引き！`,
  };

  // ベット可能なプレイヤーが1人以下なら即ショーダウン
  const active = players.filter((p) => !p.folded && !p.eliminated);
  const canBet = active.filter((p) => p.chips > 0);
  if (active.length <= 1 || canBet.length <= 1) {
    return resolveShowdown(baseState);
  }

  return baseState;
}

export function initIndianPoker(
  playersInfo: PlayerInfo[],
  rules: IndianPokerRules
): IndianPokerInternalState {
  const players: IndianPokerPlayerState[] = playersInfo.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    chips: rules.startChips,
    card: null,
    currentBet: 0,
    totalCommitted: 0,
    folded: false,
    eliminated: false,
    actedThisRound: false,
  }));

  return startNewRound(players, rules, 1, 0);
}

function advanceBetOrShowdown(state: IndianPokerInternalState): IndianPokerInternalState {
  const active = state.players.filter((p) => !p.folded && !p.eliminated);
  if (active.length <= 1) {
    return resolveShowdown(state);
  }

  const activeWithChips = active.filter((p) => p.chips > 0);
  const everyoneSettled =
    activeWithChips.length === 0 ||
    activeWithChips.every((p) => p.actedThisRound && p.currentBet === state.highestBet);

  if (everyoneSettled) {
    return resolveShowdown(state);
  }

  return {
    ...state,
    turnIndex: nextActiveIndex(state.players, state.turnIndex, true),
  };
}

export function applyIndianPokerAction(
  state: IndianPokerInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: IndianPokerInternalState; error?: string } {
  if (state.phase === 'finished') {
    return { state, error: 'ゲームは終了しています' };
  }

  if (state.subPhase === 'showdown') {
    if (action.type === 'nextRound' || action.type === 'nextHand') {
      const nextDealer = (state.dealerIndex + 1) % state.players.length;
      return {
        state: startNewRound(state.players, state.rules, state.round + 1, nextDealer),
      };
    }
    return { state, error: '次のラウンドへ進んでください' };
  }

  if (action.type === 'nextRound' || action.type === 'nextHand') {
    return { state };
  }

  const current = state.players[state.turnIndex];
  if (!current || current.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }

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
  } else if (action.type === 'check') {
    if (toCall > 0) {
      return { state, error: 'コールまたはフォールド・レイズを選んでください' };
    }
    me.actedThisRound = true;
    log = `${me.name} がチェックしました`;
  } else if (action.type === 'call') {
    const paid = Math.min(me.chips, toCall);
    me.chips -= paid;
    me.currentBet += paid;
    me.totalCommitted += paid;
    me.actedThisRound = true;
    pot += paid;
    log = toCall === 0 ? `${me.name} がチェックしました` : `${me.name} がコール (${paid})`;
  } else if (action.type === 'raise') {
    const hasOpponentWithChips = players.some(
      (p, idx) => idx !== state.turnIndex && !p.folded && !p.eliminated && p.chips > 0
    );
    if (!hasOpponentWithChips) {
      return { state, error: '相手全員がオールインのため追加レイズできません' };
    }
    const rawAdd = Number((action.payload as { amount?: number })?.amount ?? state.rules.ante);
    if (!Number.isFinite(rawAdd)) {
      return { state, error: '不正なベット額です' };
    }
    const add = Math.max(1, Math.floor(rawAdd));
    const totalPay = Math.min(me.chips, toCall + add);
    const actualAdd = Math.max(0, totalPay - toCall);
    me.chips -= totalPay;
    me.currentBet += totalPay;
    me.totalCommitted += totalPay;
    me.actedThisRound = true;
    pot += totalPay;

    if (me.currentBet > highestBet) {
      highestBet = me.currentBet;
      players.forEach((p, idx) => {
        if (idx !== state.turnIndex && !p.folded && !p.eliminated && p.chips > 0) {
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
    state: advanceBetOrShowdown({
      ...state,
      players,
      pot,
      highestBet,
      lastLog: log,
    }),
  };
}

export function sanitizeIndianPokerState(
  state: IndianPokerInternalState,
  playerId: string
): IndianPokerClientState {
  const revealAll = state.subPhase === 'showdown' || state.phase === 'finished';
  const isParticipant = state.players.some((p) => p.id === playerId);

  return {
    rules: state.rules,
    myId: playerId,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      chips: p.chips,
      // インディアンポーカーの核心：betting中は自分のカードのみ null で隠し、非参加者には全員分を隠す
      card: revealAll ? p.card : !isParticipant || p.id === playerId ? null : p.card,
      currentBet: p.currentBet,
      folded: p.folded,
      eliminated: p.eliminated,
    })),
    pot: state.pot,
    highestBet: state.highestBet,
    round: state.round,
    dealerIndex: state.dealerIndex,
    turnPlayerId: state.players[state.turnIndex]?.id ?? '',
    subPhase: state.subPhase,
    roundWinnerId: state.roundWinnerId,
    phase: state.phase,
    lastLog: state.lastLog,
  };
}

export function computeIndianPokerBotAction(
  state: IndianPokerInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing' || state.subPhase !== 'betting') return null;
  const bot = state.players[state.turnIndex];
  if (!bot || !bot.isBot) return null;

  const ante = Math.max(1, state.rules.ante);
  const toCall = Math.max(0, state.highestBet - bot.currentBet);

  // Botも自分のカードは見ず、他プレイヤーの公開カードだけから勝率を推定する
  const activeOpponents = state.players.filter(
    (p, idx) => idx !== state.turnIndex && !p.folded && !p.eliminated && p.card !== null
  );

  if (activeOpponents.length === 0 || bot.chips === 0) {
    return toCall === 0 ? { type: 'check' } : { type: 'call' };
  }

  let maxOppScore = 0;
  for (const opp of activeOpponents) {
    if (opp.card) {
      const sc = indianPokerCardScore(opp.card);
      if (sc > maxOppScore) maxOppScore = sc;
    }
  }

  // 相手最強カードのランク値 (2..14) からおおよその勝率を見積もる
  const maxOppRank = Math.floor(maxOppScore / 10); // 2..14
  const estimatedWinProb = Math.max(0.05, Math.min(0.95, (14 - maxOppRank) / 13));
  const maxRaise = Math.max(0, bot.chips - toCall);
  const canRaise =
    maxRaise >= ante &&
    state.players.some(
      (p, idx) => idx !== state.turnIndex && !p.folded && !p.eliminated && p.chips > 0
    );

  if (toCall === 0) {
    // 相手全員が弱いカード（7以下）なら強気にベット
    if (estimatedWinProb >= 0.55 && canRaise && Math.random() < 0.72) {
      const mult = estimatedWinProb >= 0.75 ? 2 : 1;
      return { type: 'raise', payload: { amount: Math.min(maxRaise, ante * mult) } };
    }
    // 時々ブラフベット
    if (estimatedWinProb < 0.25 && canRaise && Math.random() < 0.14) {
      return { type: 'raise', payload: { amount: Math.min(maxRaise, ante) } };
    }
    return { type: 'check' };
  }

  // ベットに直面している場合
  const potOdds = toCall / Math.max(1, state.pot + toCall);

  // 相手のカードが極端に弱い（2〜5）ならリレイズ
  if (
    estimatedWinProb >= 0.72 &&
    canRaise &&
    state.highestBet < ante * 4 &&
    Math.random() < 0.45
  ) {
    return { type: 'raise', payload: { amount: Math.min(maxRaise, ante) } };
  }

  // 相手がKやAを持っていてベット額が大きい場合はフォールド寄り
  if (estimatedWinProb + 0.08 >= potOdds) {
    return { type: 'call' };
  }

  // 安いベットなら時々コールで勝負
  if (toCall <= ante && Math.random() < 0.28) {
    return { type: 'call' };
  }

  return { type: 'fold' };
}
