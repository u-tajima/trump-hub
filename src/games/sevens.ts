import { type Card, formatCardShort } from '../types/card';
import type { PlayerInfo, SevensRules } from '../types/game';
import { createDeck, dealCards, shuffle, sortCardsByRank } from '../utils/deck';

type NormalSuit = 'spade' | 'heart' | 'diamond' | 'club';
const NORMAL_SUITS: NormalSuit[] = ['spade', 'heart', 'diamond', 'club'];

export interface SevensPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  hand: Card[];
  passesUsed: number;
  eliminated: boolean; // パス上限ドボン
  finishRank: number | null;
}

export interface SevensInternalState {
  rules: SevensRules;
  players: SevensPlayerState[];
  board: Record<NormalSuit, boolean[]>; // index 1..13 (true = placed)
  jokerSlots: Record<string, string>; // key: `${suit}-${rank}`, value: joker card id
  turnIndex: number;
  finishedOrder: string[];
  eliminatedOrder: string[]; // reverse order for ranking
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface SevensClientState {
  rules: SevensRules;
  myId: string;
  myHand: Card[];
  players: {
    id: string;
    name: string;
    isBot: boolean;
    handCount: number;
    passesUsed: number;
    eliminated: boolean;
    finishRank: number | null;
  }[];
  board: Record<NormalSuit, boolean[]>;
  jokerSlots: Record<string, string>;
  turnPlayerId: string;
  phase: 'playing' | 'finished';
  lastLog: string;
}

function createEmptyBoard(): Record<NormalSuit, boolean[]> {
  return {
    spade: Array(14).fill(false),
    heart: Array(14).fill(false),
    diamond: Array(14).fill(false),
    club: Array(14).fill(false),
  };
}

export function initSevens(playersInfo: PlayerInfo[], rules: SevensRules): SevensInternalState {
  const deck = shuffle(createDeck(rules.jokerEnabled ? 1 : 0));
  const dealt = dealCards(deck, playersInfo.length);
  const board = createEmptyBoard();

  let startIdx = 0;
  const players: SevensPlayerState[] = playersInfo.map((p, idx) => {
    const rawHand = dealt[idx];
    const hasDiamond7 = rawHand.some((c) => c.suit === 'diamond' && c.rank === 7);
    if (hasDiamond7) startIdx = idx;

    // 7をすべて自動で場に出す
    const hand = rawHand.filter((c) => {
      if (c.rank === 7 && c.suit !== 'joker') {
        board[c.suit as NormalSuit][7] = true;
        return false;
      }
      return true;
    });

    return {
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      hand: sortCardsByRank(hand),
      passesUsed: 0,
      eliminated: false,
      finishRank: null,
    };
  });

  // 7を出しただけで上がった人がいる場合の確認（稀）
  const finishedOrder: string[] = [];
  players.forEach((p) => {
    if (p.hand.length === 0) {
      p.finishRank = finishedOrder.length + 1;
      finishedOrder.push(p.id);
    }
  });

  if (players[startIdx].finishRank !== null) {
    const next = players.findIndex((p) => p.finishRank === null);
    if (next >= 0) startIdx = next;
  }

  return {
    rules,
    players,
    board,
    jokerSlots: {},
    turnIndex: startIdx,
    finishedOrder,
    eliminatedOrder: [],
    phase: 'playing',
    lastLog: '全ての7を場に並べてスタート！',
  };
}

export function canPlaceNormalCard(suit: NormalSuit, rank: number, state: SevensInternalState): boolean {
  const row = state.board[suit];
  if (row[rank]) return false;
  if (rank === 7) return true;
  if (rank > 7 && row[rank - 1]) return true;
  if (rank < 7 && row[rank + 1]) return true;

  if (state.rules.tunnel) {
    if (rank === 1 && row[13]) return true;
    if (rank === 13 && row[1]) return true;
  }
  return false;
}

export function getPlayablePositionsForJoker(state: SevensInternalState): { suit: NormalSuit; rank: number }[] {
  const positions: { suit: NormalSuit; rank: number }[] = [];
  for (const suit of NORMAL_SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      if (canPlaceNormalCard(suit, rank, state)) {
        positions.push({ suit, rank });
      }
    }
  }
  return positions;
}

function advanceTurnAndCheckEnd(state: SevensInternalState): SevensInternalState {
  const active = state.players.filter((p) => p.finishRank === null && !p.eliminated);
  if (active.length <= 1) {
    const players = state.players.map((p) => ({ ...p }));
    const finishedOrder = [...state.finishedOrder];
    if (active.length === 1) {
      finishedOrder.push(active[0].id);
    }
    const fullOrder = [...finishedOrder, ...state.eliminatedOrder];
    fullOrder.forEach((id, idx) => {
      const p = players.find((pl) => pl.id === id);
      if (p) p.finishRank = idx + 1;
    });
    return {
      ...state,
      players,
      finishedOrder: fullOrder,
      phase: 'finished',
      lastLog: `ゲーム終了！ 1位: ${players.find((p) => p.finishRank === 1)?.name ?? ''}`,
    };
  }

  const n = state.players.length;
  let nextIdx = state.turnIndex;
  for (let step = 1; step <= n; step++) {
    const idx = (state.turnIndex + step) % n;
    if (state.players[idx].finishRank === null && !state.players[idx].eliminated) {
      nextIdx = idx;
      break;
    }
  }
  return { ...state, turnIndex: nextIdx };
}

export function applySevensAction(
  state: SevensInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: SevensInternalState; error?: string } {
  if (state.phase !== 'playing') return { state, error: 'ゲームは終了しています' };
  const current = state.players[state.turnIndex];
  if (current.id !== playerId) return { state, error: 'あなたのターンではありません' };

  if (action.type === 'pass') {
    const passesUsed = current.passesUsed + 1;
    const isEliminated = state.rules.passLimit < 99 && passesUsed > state.rules.passLimit;
    const board: Record<NormalSuit, boolean[]> = {
      spade: [...state.board.spade],
      heart: [...state.board.heart],
      diamond: [...state.board.diamond],
      club: [...state.board.club],
    };
    const eliminatedOrder = [...state.eliminatedOrder];

    const players = state.players.map((p, idx) => {
      if (idx !== state.turnIndex) return p;
      if (isEliminated) {
        // 残りの手札をすべてオープン
        p.hand.forEach((c) => {
          if (c.suit !== 'joker') {
            board[c.suit as NormalSuit][c.rank] = true;
          }
        });
        eliminatedOrder.unshift(p.id);
        return { ...p, passesUsed, eliminated: true, hand: [] };
      }
      return { ...p, passesUsed };
    });

    const log = isEliminated
      ? `💀 ${current.name} はパス上限を超えドボン！（手札が全て開かれました）`
      : `${current.name} がパス (${passesUsed}/${state.rules.passLimit === 99 ? '∞' : state.rules.passLimit})`;

    return {
      state: advanceTurnAndCheckEnd({
        ...state,
        players,
        board,
        eliminatedOrder,
        lastLog: log,
      }),
    };
  }

  if (action.type === 'play') {
    const { cardId, targetSuit, targetRank } = (action.payload as {
      cardId: string;
      targetSuit?: NormalSuit;
      targetRank?: number;
    }) ?? {};

    const card = current.hand.find((c) => c.id === cardId);
    if (!card) return { state, error: 'カードが見つかりません' };

    const board: Record<NormalSuit, boolean[]> = {
      spade: [...state.board.spade],
      heart: [...state.board.heart],
      diamond: [...state.board.diamond],
      club: [...state.board.club],
    };
    const jokerSlots = { ...state.jokerSlots };

    let logText = '';
    if (card.suit === 'joker') {
      if (!targetSuit || !targetRank || !canPlaceNormalCard(targetSuit, targetRank, state)) {
        return { state, error: 'ジョーカーを置く位置が無効です' };
      }
      board[targetSuit][targetRank] = true;
      jokerSlots[`${targetSuit}-${targetRank}`] = card.id;
      logText = `${current.name} が ジョーカー を ${targetSuit} ${targetRank} の位置に出しました`;
    } else {
      const suit = card.suit as NormalSuit;
      const slotKey = `${suit}-${card.rank}`;
      const isReplacingJoker = Boolean(jokerSlots[slotKey]);
      if (!isReplacingJoker && !canPlaceNormalCard(suit, card.rank, state)) {
        return { state, error: 'そのカードはまだ出せません' };
      }
      board[suit][card.rank] = true;
      if (isReplacingJoker) {
        delete jokerSlots[slotKey];
      }
      logText = `${current.name} が ${formatCardShort(card)} を出しました`;
    }

    const newHand = current.hand.filter((c) => c.id !== cardId);
    const finishedOrder = [...state.finishedOrder];
    let finishRank: number | null = null;
    if (newHand.length === 0) {
      finishRank = finishedOrder.length + 1;
      finishedOrder.push(current.id);
      logText += ` 🎉${finishRank}位上がり！`;
    }

    const players = state.players.map((p, idx) =>
      idx === state.turnIndex ? { ...p, hand: newHand, finishRank } : p
    );

    return {
      state: advanceTurnAndCheckEnd({
        ...state,
        players,
        board,
        jokerSlots,
        finishedOrder,
        lastLog: logText,
      }),
    };
  }

  return { state, error: '不明なアクションです' };
}

function evaluateSevensPlacement(
  suit: NormalSuit,
  rank: number,
  hand: Card[],
  state: SevensInternalState
): { score: number; myDownstream: number; oppDownstream: number } {
  const row = state.board[suit];
  const downstreamRanks: number[] = [];

  if (rank < 7) {
    for (let r = rank - 1; r >= 1; r--) {
      if (!row[r]) downstreamRanks.push(r);
    }
    if (state.rules.tunnel && !row[13]) {
      for (let r = 13; r >= 8; r--) {
        if (!row[r]) downstreamRanks.push(r);
        else break;
      }
    }
  } else if (rank > 7) {
    for (let r = rank + 1; r <= 13; r++) {
      if (!row[r]) downstreamRanks.push(r);
    }
    if (state.rules.tunnel && !row[1]) {
      for (let r = 1; r <= 6; r++) {
        if (!row[r]) downstreamRanks.push(r);
        else break;
      }
    }
  }

  let myDownstream = 0;
  let myExtremeWeight = 0;
  for (const r of downstreamRanks) {
    if (hand.some((c) => c.suit === suit && c.rank === r)) {
      myDownstream++;
      myExtremeWeight += Math.abs(r - 7);
    }
  }
  const oppDownstream = Math.max(0, downstreamRanks.length - myDownstream);

  const nextImmediateRank =
    rank < 7
      ? rank > 1
        ? rank - 1
        : state.rules.tunnel
        ? 13
        : -1
      : rank < 13
      ? rank + 1
      : state.rules.tunnel
      ? 1
      : -1;
  const iHaveNextImmediate =
    nextImmediateRank >= 1 && hand.some((c) => c.suit === suit && c.rank === nextImmediateRank);

  let score = 0;
  // 自分の奥のカード（AやK側）を救出できるラインを最優先で開拓する
  score += myDownstream * 42 + myExtremeWeight * 8;
  // 直後の隣を自分が持っていれば、相手に手番を渡してもその列を相手に使われない
  if (iHaveNextImmediate) score += 35;

  // 自分が奥に1枚も持っていないのに相手だけ持っているラインは徹底的に止める（ロック戦術）
  if (myDownstream === 0 && oppDownstream > 0) {
    score -= oppDownstream * 48 + 30;
  } else {
    score -= oppDownstream * 14;
  }

  return { score, myDownstream, oppDownstream };
}

export function computeSevensBotAction(state: SevensInternalState): { type: string; payload?: unknown } {
  const bot = state.players[state.turnIndex];
  const hand = bot.hand;

  // 最後の1枚が出せるなら迷わず出して上がる
  const normalPlayable = hand.filter((c) => {
    if (c.suit === 'joker') return false;
    const suit = c.suit as NormalSuit;
    const isReplacingJoker = Boolean(state.jokerSlots[`${suit}-${c.rank}`]);
    return isReplacingJoker || canPlaceNormalCard(suit, c.rank, state);
  });

  if (hand.length === 1 && normalPlayable.length === 1) {
    return { type: 'play', payload: { cardId: normalPlayable[0].id } };
  }

  const joker = hand.find((c) => c.suit === 'joker');
  if (hand.length === 1 && joker) {
    const positions = getPlayablePositionsForJoker(state);
    if (positions.length > 0) {
      return {
        type: 'play',
        payload: { cardId: joker.id, targetSuit: positions[0].suit, targetRank: positions[0].rank },
      };
    }
  }

  const remainingPasses =
    state.rules.passLimit >= 99 ? 99 : Math.max(0, state.rules.passLimit - bot.passesUsed);

  const scoredNormals = normalPlayable.map((c) => {
    const evalRes = evaluateSevensPlacement(c.suit as NormalSuit, c.rank, hand, state);
    return { card: c, ...evalRes };
  });
  scoredNormals.sort((a, b) => b.score - a.score);

  // ジョーカーの最適配置候補を計算
  let bestJokerAction: {
    suit: NormalSuit;
    rank: number;
    score: number;
    myDownstream: number;
  } | null = null;
  if (joker) {
    const positions = getPlayablePositionsForJoker(state);
    for (const pos of positions) {
      const evalRes = evaluateSevensPlacement(pos.suit, pos.rank, hand, state);
      // 自分がその位置の実カードも持っていれば後で回収・上書きできるのでボーナス
      const iHaveExact = hand.some((c) => c.suit === pos.suit && c.rank === pos.rank);
      const jScore = evalRes.score + (iHaveExact ? 25 : 0);
      if (!bestJokerAction || jScore > bestJokerAction.score) {
        bestJokerAction = {
          suit: pos.suit,
          rank: pos.rank,
          score: jScore,
          myDownstream: evalRes.myDownstream,
        };
      }
    }
  }

  // 自分が奥に複数枚抱えて詰まっている列をジョーカーで開通できるなら積極活用
  if (
    joker &&
    bestJokerAction &&
    bestJokerAction.myDownstream >= 2 &&
    (scoredNormals.length === 0 || bestJokerAction.score > scoredNormals[0].score + 35)
  ) {
    return {
      type: 'play',
      payload: {
        cardId: joker.id,
        targetSuit: bestJokerAction.suit,
        targetRank: bestJokerAction.rank,
      },
    };
  }

  if (scoredNormals.length > 0) {
    const best = scoredNormals[0];
    // 戦略的パス：出せるカードがすべて「自分は奥に0枚で相手のカードだけを2枚以上解放する悪手」であり、
    // パス回数に十分な余裕がある場合は意図的にパスして相手をロックする
    if (
      best.myDownstream === 0 &&
      best.oppDownstream >= 2 &&
      remainingPasses >= 2 &&
      hand.length >= 3
    ) {
      return { type: 'pass' };
    }
    return { type: 'play', payload: { cardId: best.card.id } };
  }

  // 通常カードが出せない場合、パス上限が迫っているか自分の列を開拓できるならジョーカーを使う
  if (joker && bestJokerAction && (remainingPasses <= 1 || bestJokerAction.myDownstream >= 1)) {
    return {
      type: 'play',
      payload: {
        cardId: joker.id,
        targetSuit: bestJokerAction.suit,
        targetRank: bestJokerAction.rank,
      },
    };
  }

  return { type: 'pass' };
}

export function sanitizeSevensState(state: SevensInternalState, playerId: string): SevensClientState {
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
      passesUsed: p.passesUsed,
      eliminated: p.eliminated,
      finishRank: p.finishRank,
    })),
    board: state.board,
    jokerSlots: state.jokerSlots,
    turnPlayerId: state.players[state.turnIndex]?.id ?? '',
    phase: state.phase,
    lastLog: state.lastLog,
  };
}
