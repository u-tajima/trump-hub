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
    const rawAdd = (action.payload as { amount?: number })?.amount ?? state.rules.bigBlind;
    const add = Math.max(1, Math.floor(rawAdd));
    const paid = Math.min(me.chips, toCall + add);
    const actualAdd = Math.max(0, paid - toCall);
    me.chips -= paid;
    me.currentBet += paid;
    me.actedThisRound = true;
    pot += paid;
    if (me.currentBet > highestBet) highestBet = me.currentBet;
    log =
      me.chips === 0
        ? `${me.name} がオールイン (${paid})`
        : toCall === 0
        ? `${me.name} がベット (${actualAdd})`
        : `${me.name} がレイズ (+${actualAdd})`;
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

function estimateHoldemEquity(
  holeCards: Card[],
  communityCards: Card[],
  activeOpponents: number,
  iterations = 44
): number {
  if (holeCards.length < 2) return 0.5;
  const oppCount = Math.max(1, activeOpponents);
  const knownIds = new Set<string>([...holeCards.map((c) => c.id), ...communityCards.map((c) => c.id)]);
  const unknownPool = createDeck(0).filter((c) => !knownIds.has(c.id));
  const neededBoard = Math.max(0, 5 - communityCards.length);
  const totalNeeded = neededBoard + oppCount * 2;

  let equitySum = 0;

  for (let iter = 0; iter < iterations; iter++) {
    // 必要な枚数だけ部分Fisher-Yatesシャッフルで高速抽出
    for (let i = 0; i < totalNeeded; i++) {
      const r = i + Math.floor(Math.random() * (unknownPool.length - i));
      const tmp = unknownPool[i];
      unknownPool[i] = unknownPool[r];
      unknownPool[r] = tmp;
    }

    const simBoard =
      neededBoard > 0
        ? [...communityCards, ...unknownPool.slice(0, neededBoard)]
        : communityCards;
    const myEval = evaluateBestSeven([...holeCards, ...simBoard]);
    const myScore = myEval ? myEval.score : 0;

    let bestOppScore = -1;
    let tieCount = 1;
    for (let o = 0; o < oppCount; o++) {
      const offset = neededBoard + o * 2;
      const oppHole = [unknownPool[offset], unknownPool[offset + 1]];
      const oppEval = evaluateBestSeven([...oppHole, ...simBoard]);
      const oppScore = oppEval ? oppEval.score : 0;
      if (oppScore > bestOppScore) {
        bestOppScore = oppScore;
      }
      if (oppScore === myScore) {
        tieCount++;
      }
    }

    if (myScore > bestOppScore) {
      equitySum += 1;
    } else if (myScore === bestOppScore) {
      equitySum += 1 / tieCount;
    }
  }

  return equitySum / iterations;
}

export function computeHoldemBotAction(state: HoldemInternalState): { type: string; payload?: unknown } | null {
  if (state.subPhase === 'showdown') return null;
  const bot = state.players[state.turnIndex];
  const bb = Math.max(5, state.rules.bigBlind);
  const toCall = Math.max(0, state.highestBet - bot.currentBet);
  const activeOpponents = state.players.filter(
    (p, idx) => idx !== state.turnIndex && !p.folded
  ).length;

  if (activeOpponents === 0 || bot.chips === 0) {
    return { type: 'call' };
  }

  const equity = estimateHoldemEquity(bot.holeCards, state.communityCards, activeOpponents, 44);
  const fairShare = 1 / (activeOpponents + 1);
  const relativeStrength = equity / fairShare; // 1.0 = 平均的, 1.4+ = 有利, 1.75+ = 圧倒的
  const potOdds = toCall > 0 ? toCall / (state.pot + toCall) : 0;

  const snapBet = (raw: number) => {
    const step = Math.max(5, Math.floor(bb / 2));
    const snapped = Math.round(raw / step) * step;
    return Math.max(bb, Math.min(bot.chips - toCall, snapped));
  };

  // チェック可能な場面 (toCall === 0)
  if (toCall === 0) {
    if (bot.chips < bb) return { type: 'call' };

    // 非常に強いハンド：バリューベット（ポットの60%〜85%）
    if (equity >= 0.72 || relativeStrength >= 1.65) {
      const mult = state.subPhase === 'river' ? 0.8 : 0.6;
      const betAmt = snapBet(state.pot * mult);
      return { type: 'raise', payload: { amount: betAmt } };
    }

    // 有利なハンド：プロテクション＆バリューベット（ポットの50%）
    if (relativeStrength >= 1.28 && Math.random() < 0.78) {
      const betAmt = snapBet(state.pot * 0.5);
      return { type: 'raise', payload: { amount: betAmt } };
    }

    // フロップでのセミブラフ / コンティニュエーションベット
    if (state.subPhase === 'flop' && relativeStrength >= 0.95 && Math.random() < 0.25) {
      const betAmt = snapBet(state.pot * 0.45);
      return { type: 'raise', payload: { amount: betAmt } };
    }

    return { type: 'call' };
  }

  // ベット・レイズに直面している場面 (toCall > 0)
  // 1. プリフロップでBB以下の少額コール（ブラインド補完やリンプ）
  if (state.subPhase === 'preflop' && toCall <= bb) {
    if (relativeStrength >= 1.42 && bot.chips >= toCall + bb * 2) {
      return { type: 'raise', payload: { amount: snapBet(bb * 2) } };
    }
    if (relativeStrength >= 0.78 || toCall <= Math.floor(bb / 2)) {
      return { type: 'call' };
    }
    return { type: 'fold' };
  }

  // 2. モンスターハンドならリレイズでポットを膨らませる
  if (
    (equity >= 0.74 || relativeStrength >= 1.75) &&
    bot.chips > toCall + bb &&
    state.highestBet < state.rules.startChips * 0.55
  ) {
    const raiseAmt = snapBet(Math.max(bb * 2, (state.pot + toCall) * 0.6));
    return { type: 'raise', payload: { amount: raiseAmt } };
  }

  // 3. ポットオッズとインプライドオッズに基づくコール/フォールド判定
  const impliedBonus =
    state.subPhase === 'preflop' ? 0.06 : state.subPhase === 'flop' ? 0.05 : state.subPhase === 'turn' ? 0.03 : 0;

  // スタックの大部分を要求される大勝負では平均以上の勝率も要求
  const heavyCommit = toCall > bot.chips * 0.45;
  const minStrengthRequired = heavyCommit ? 1.05 : 0.82;

  if (equity + impliedBonus >= potOdds && relativeStrength >= minStrengthRequired) {
    return { type: 'call' };
  }

  // リバーや小額ベットに対して十分な勝率がある場合はコール
  if (toCall <= bb && relativeStrength >= 0.92) {
    return { type: 'call' };
  }

  return { type: 'fold' };
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
