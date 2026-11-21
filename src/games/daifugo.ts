import { type Card, type Suit, formatCardShort } from '../types/card';
import type { DaifugoRules, PlayerInfo } from '../types/game';
import { createDeck, daifugoStrength, dealCards, shuffle, sortCardsByRank } from '../utils/deck';

export type PlayKind = 'single' | 'group' | 'staircase';

export interface TablePlay {
  playerId: string;
  cards: Card[];
  kind: PlayKind;
  effectiveRank: number;
  length: number;
  suits: Suit[];
  isJokerSingle: boolean;
}

export interface DaifugoPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  hand: Card[];
  passed: boolean;
  finishRank: number | null;
  foulFinish: boolean;
}

export interface DaifugoInternalState {
  rules: DaifugoRules;
  players: DaifugoPlayerState[];
  turnIndex: number;
  table: TablePlay[];
  revolution: boolean;
  elevenBack: boolean;
  suitLock: Suit[] | null;
  lastPlayerId: string | null;
  finishedOrder: string[];
  foulOrder: string[];
  winnerIdsLastGame: string[];
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface DaifugoViewPlayer {
  id: string;
  name: string;
  isBot: boolean;
  handCount: number;
  passed: boolean;
  finishRank: number | null;
  foulFinish: boolean;
}

export interface DaifugoClientState {
  rules: DaifugoRules;
  myId: string;
  myHand: Card[];
  players: DaifugoViewPlayer[];
  turnPlayerId: string;
  tableTop: TablePlay | null;
  tableCount: number;
  revolution: boolean;
  elevenBack: boolean;
  suitLock: Suit[] | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export function initDaifugo(
  playersInfo: PlayerInfo[],
  rules: DaifugoRules,
  previousFinishedOrder: string[] = []
): DaifugoInternalState {
  const deck = shuffle(createDeck(rules.jokerCount));
  const dealt = dealCards(deck, playersInfo.length);

  const players: DaifugoPlayerState[] = playersInfo.map((p, idx) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    hand: sortCardsByRank(dealt[idx], true),
    passed: false,
    finishRank: null,
    foulFinish: false,
  }));

  let startIdx = players.findIndex((p) => p.hand.some((c) => c.suit === 'diamond' && c.rank === 3));
  if (startIdx < 0) startIdx = 0;

  return {
    rules,
    players,
    turnIndex: startIdx,
    table: [],
    revolution: false,
    elevenBack: false,
    suitLock: null,
    lastPlayerId: null,
    finishedOrder: [],
    foulOrder: [],
    winnerIdsLastGame: previousFinishedOrder,
    phase: 'playing',
    lastLog: `${players[startIdx].name} のターンからスタート！`,
  };
}

function isReversed(state: DaifugoInternalState): boolean {
  return state.revolution !== state.elevenBack;
}

export function parsePlay(cards: Card[], rules: DaifugoRules): Omit<TablePlay, 'playerId'> | null {
  if (cards.length === 0) return null;
  const normals = cards.filter((c) => c.suit !== 'joker');

  if (cards.length === 1) {
    const c = cards[0];
    if (c.suit === 'joker') {
      return {
        cards,
        kind: 'single',
        effectiveRank: 99,
        length: 1,
        suits: [],
        isJokerSingle: true,
      };
    }
    return {
      cards,
      kind: 'single',
      effectiveRank: daifugoStrength(c.rank),
      length: 1,
      suits: [c.suit],
      isJokerSingle: false,
    };
  }

  if (normals.length === 0) {
    return {
      cards,
      kind: 'group',
      effectiveRank: 99,
      length: cards.length,
      suits: [],
      isJokerSingle: false,
    };
  }

  const allSameRank = normals.every((c) => c.rank === normals[0].rank);
  if (allSameRank) {
    return {
      cards,
      kind: 'group',
      effectiveRank: daifugoStrength(normals[0].rank),
      length: cards.length,
      suits: normals.map((c) => c.suit).sort(),
      isJokerSingle: false,
    };
  }

  if (rules.staircase && cards.length >= 3 && normals.length >= 1) {
    const suit = normals[0].suit;
    if (!normals.every((c) => c.suit === suit)) return null;

    const strengths = normals.map((c) => daifugoStrength(c.rank)).sort((a, b) => a - b);
    for (let i = 1; i < strengths.length; i++) {
      if (strengths[i] === strengths[i - 1]) return null;
    }

    const minS = strengths[0];
    const maxS = strengths[strengths.length - 1];
    const span = maxS - minS + 1;
    if (span > cards.length) return null;

    const remainingJokers = cards.length - span;
    const lowestPossible = Math.max(3, minS - remainingJokers);
    return {
      cards: [...cards].sort((a, b) => daifugoStrength(a.rank) - daifugoStrength(b.rank)),
      kind: 'staircase',
      effectiveRank: lowestPossible,
      length: cards.length,
      suits: [suit],
      isJokerSingle: false,
    };
  }

  return null;
}

export function canPlayOnTable(cards: Card[], state: DaifugoInternalState): { ok: boolean; reason?: string; parsed?: Omit<TablePlay, 'playerId'> } {
  const parsed = parsePlay(cards, state.rules);
  if (!parsed) {
    return { ok: false, reason: 'その組み合わせでは出せません' };
  }

  const top = state.table.length > 0 ? state.table[state.table.length - 1] : null;
  if (!top) {
    return { ok: true, parsed };
  }

  if (
    state.rules.spade3Return &&
    top.isJokerSingle &&
    parsed.kind === 'single' &&
    cards[0].suit === 'spade' &&
    cards[0].rank === 3
  ) {
    return { ok: true, parsed };
  }

  if (parsed.kind !== top.kind || parsed.length !== top.length) {
    return { ok: false, reason: '場と同じ枚数・出し方（単体/複数/階段）で出してください' };
  }

  if (state.suitLock && state.suitLock.length > 0 && !parsed.isJokerSingle) {
    if (parsed.kind === 'staircase') {
      if (parsed.suits[0] !== state.suitLock[0]) {
        return { ok: false, reason: `スートしばり中（${state.suitLock.join(',')}）です` };
      }
    } else {
      const normalSuits = cards.filter((c) => c.suit !== 'joker').map((c) => c.suit);
      const allMatch = normalSuits.every((s) => state.suitLock!.includes(s));
      if (!allMatch) {
        return { ok: false, reason: 'スートしばり中です' };
      }
    }
  }

  const rev = isReversed(state);
  if (parsed.isJokerSingle) {
    return { ok: true, parsed };
  }
  if (top.isJokerSingle) {
    return { ok: false, reason: 'ジョーカーには♠3返しのみ出せます' };
  }

  const stronger = rev
    ? parsed.effectiveRank < top.effectiveRank
    : parsed.effectiveRank > top.effectiveRank;

  if (!stronger) {
    return { ok: false, reason: rev ? '場より弱い（数字が小さい）カードが必要です' : '場より強いカードが必要です' };
  }

  return { ok: true, parsed };
}

function isFoulFinishCards(cards: Card[], state: DaifugoInternalState): boolean {
  if (!state.rules.banFinishStrong) return false;
  const rev = isReversed(state);
  for (const c of cards) {
    if (c.suit === 'joker') return true;
    if (state.rules.eightCut && c.rank === 8) return true;
    if (!rev && c.rank === 2) return true;
    if (rev && c.rank === 3) return true;
  }
  const top = state.table.length > 0 ? state.table[state.table.length - 1] : null;
  if (state.rules.spade3Return && top?.isJokerSingle && cards.length === 1 && cards[0].suit === 'spade' && cards[0].rank === 3) {
    return true;
  }
  return false;
}

function clearTable(state: DaifugoInternalState, nextTurnIdx: number, log: string): DaifugoInternalState {
  const players = state.players.map((p) => ({
    ...p,
    passed: false,
  }));
  return {
    ...state,
    players,
    table: [],
    elevenBack: false,
    suitLock: null,
    lastPlayerId: null,
    turnIndex: nextTurnIdx,
    lastLog: log,
  };
}

function findNextActivePlayerIndex(state: DaifugoInternalState, fromIdx: number, includePassed = false): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIdx + step) % n;
    const p = state.players[idx];
    if (p.finishRank === null && !p.foulFinish && (includePassed || !p.passed)) {
      return idx;
    }
  }
  return fromIdx;
}

function finalizeIfGameOver(state: DaifugoInternalState): DaifugoInternalState {
  const remaining = state.players.filter((p) => p.finishRank === null && !p.foulFinish);
  if (remaining.length <= 1) {
    const players = [...state.players];
    const finishedOrder = [...state.finishedOrder];
    if (remaining.length === 1) {
      const last = remaining[0];
      finishedOrder.push(last.id);
    }
    const fullOrder = [...finishedOrder, ...state.foulOrder];
    fullOrder.forEach((id, idx) => {
      const p = players.find((pl) => pl.id === id);
      if (p) p.finishRank = idx + 1;
    });
    return {
      ...state,
      players,
      finishedOrder: fullOrder,
      phase: 'finished',
      lastLog: `ゲーム終了！ 1位(大富豪): ${players.find((p) => p.finishRank === 1)?.name ?? ''}`,
    };
  }
  return state;
}

export function applyDaifugoAction(
  state: DaifugoInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: DaifugoInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }

  const currentPlayer = state.players[state.turnIndex];
  if (currentPlayer.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }

  if (action.type === 'pass') {
    const players = state.players.map((p, idx) =>
      idx === state.turnIndex ? { ...p, passed: true } : p
    );
    let nextState: DaifugoInternalState = {
      ...state,
      players,
      lastLog: `${currentPlayer.name} がパスしました`,
    };

    const activeUnpassed = players.filter(
      (p) => p.finishRank === null && !p.foulFinish && !p.passed
    );

    if (activeUnpassed.length === 0 || (activeUnpassed.length === 1 && activeUnpassed[0].id === state.lastPlayerId)) {
      const lastIdx = players.findIndex((p) => p.id === state.lastPlayerId);
      let resumeIdx = lastIdx >= 0 ? lastIdx : state.turnIndex;
      if (players[resumeIdx].finishRank !== null || players[resumeIdx].foulFinish) {
        resumeIdx = findNextActivePlayerIndex(nextState, resumeIdx, true);
      }
      nextState = clearTable(nextState, resumeIdx, `場が流れました！ ${players[resumeIdx].name} のターン`);
      return { state: nextState };
    }

    const nextIdx = findNextActivePlayerIndex(nextState, state.turnIndex, false);
    nextState.turnIndex = nextIdx;
    return { state: nextState };
  }

  if (action.type === 'play') {
    const cardIds = (action.payload as { cardIds?: string[] })?.cardIds ?? [];
    const selectedCards = cardIds
      .map((id) => currentPlayer.hand.find((c) => c.id === id))
      .filter((c): c is Card => Boolean(c));

    if (selectedCards.length !== cardIds.length || selectedCards.length === 0) {
      return { state, error: '無効なカード選択です' };
    }

    const check = canPlayOnTable(selectedCards, state);
    if (!check.ok || !check.parsed) {
      return { state, error: check.reason };
    }

    const parsed = check.parsed;
    const prevTop = state.table.length > 0 ? state.table[state.table.length - 1] : null;

    const newHand = currentPlayer.hand.filter((c) => !cardIds.includes(c.id));
    let players = state.players.map((p, idx) =>
      idx === state.turnIndex ? { ...p, hand: newHand } : p
    );

    let revolution = state.revolution;
    let elevenBack = state.elevenBack;
    let suitLock = state.suitLock;
    let finishedOrder = [...state.finishedOrder];
    let foulOrder = [...state.foulOrder];
    const logs: string[] = [`${currentPlayer.name}: ${selectedCards.map(formatCardShort).join(' ')}`];

    if (state.rules.revolution && selectedCards.length >= 4) {
      revolution = !revolution;
      logs.push(revolution ? '🔥革命！' : '🔥革命返し！');
    }

    if (state.rules.elevenBack && selectedCards.some((c) => c.rank === 11)) {
      elevenBack = true;
      logs.push('🔄11バック！');
    }

    if (state.rules.suitLock && prevTop && !suitLock && !parsed.isJokerSingle && !prevTop.isJokerSingle) {
      if (parsed.suits.length > 0 && parsed.suits.length === prevTop.suits.length) {
        const sameSuits = parsed.suits.every((s, i) => s === prevTop.suits[i]);
        if (sameSuits) {
          suitLock = parsed.suits;
          logs.push('🔒しばり発生！');
        }
      }
    }

    const playerFinished = newHand.length === 0;
    let miyakoochiTriggered = false;
    if (playerFinished) {
      if (isFoulFinishCards(selectedCards, state)) {
        players[state.turnIndex].foulFinish = true;
        foulOrder.unshift(currentPlayer.id);
        logs.push('💀反則上がり！');
      } else {
        const rank = finishedOrder.length + 1;
        players[state.turnIndex].finishRank = rank;
        finishedOrder.push(currentPlayer.id);
        logs.push(`🎉${rank}位上がり！`);

        if (
          state.rules.miyakoochi &&
          rank === 1 &&
          state.winnerIdsLastGame.length > 0 &&
          state.winnerIdsLastGame[0] !== currentPlayer.id
        ) {
          const prevKing = players.find((p) => p.id === state.winnerIdsLastGame[0]);
          if (prevKing && prevKing.finishRank === null && !prevKing.foulFinish) {
            prevKing.foulFinish = true;
            foulOrder.unshift(prevKing.id);
            miyakoochiTriggered = true;
            logs.push(`⚡${prevKing.name} が都落ち！`);
          }
        }
      }
    }

    const playEntry: TablePlay = { ...parsed, playerId: currentPlayer.id };
    let nextState: DaifugoInternalState = {
      ...state,
      players,
      table: [...state.table, playEntry],
      revolution,
      elevenBack,
      suitLock,
      lastPlayerId: currentPlayer.id,
      finishedOrder,
      foulOrder,
      lastLog: logs.join(' '),
    };

    const isEightCut = state.rules.eightCut && selectedCards.some((c) => c.rank === 8);
    const isSpade3 =
      state.rules.spade3Return &&
      prevTop?.isJokerSingle &&
      selectedCards.length === 1 &&
      selectedCards[0].suit === 'spade' &&
      selectedCards[0].rank === 3;

    nextState = finalizeIfGameOver(nextState);
    if (nextState.phase === 'finished') {
      return { state: nextState };
    }

    if (isEightCut || isSpade3) {
      const reason = isSpade3 ? '♠3返し！' : '✂️8切り！';
      let resumeIdx = state.turnIndex;
      if (players[resumeIdx].finishRank !== null || players[resumeIdx].foulFinish) {
        resumeIdx = findNextActivePlayerIndex(nextState, resumeIdx, true);
      }
      nextState = clearTable(nextState, resumeIdx, `${logs.join(' ')} ${reason} 場が流れます`);
      return { state: nextState };
    }

    const nextIdx = findNextActivePlayerIndex(nextState, state.turnIndex, false);
    nextState.turnIndex = nextIdx;
    if (miyakoochiTriggered) {
      nextState = finalizeIfGameOver(nextState);
    }
    return { state: nextState };
  }

  return { state, error: '不明なアクションです' };
}

export function computeDaifugoBotAction(state: DaifugoInternalState): { type: string; payload?: unknown } {
  const bot = state.players[state.turnIndex];
  const hand = bot.hand;

  const candidates: Card[][] = [];
  for (const c of hand) {
    candidates.push([c]);
  }
  const byRank = new Map<number, Card[]>();
  for (const c of hand) {
    if (c.suit === 'joker') continue;
    const list = byRank.get(c.rank) ?? [];
    list.push(c);
    byRank.set(c.rank, list);
  }
  for (const list of byRank.values()) {
    if (list.length >= 2) candidates.push(list.slice(0, 2));
    if (list.length >= 3) candidates.push(list.slice(0, 3));
    if (list.length >= 4) candidates.push(list.slice(0, 4));
  }

  const valid = candidates.filter((cards) => canPlayOnTable(cards, state).ok);
  if (valid.length === 0) {
    return { type: 'pass' };
  }

  valid.sort((a, b) => {
    const aIsLast = a.length === hand.length;
    const bIsLast = b.length === hand.length;
    if (aIsLast && isFoulFinishCards(a, state)) return 1;
    if (bIsLast && isFoulFinishCards(b, state)) return -1;
    if (state.table.length === 0 && a.length !== b.length) {
      return b.length - a.length;
    }
    const rev = isReversed(state);
    const sa = daifugoStrength(a[0].rank);
    const sb = daifugoStrength(b[0].rank);
    return rev ? sb - sa : sa - sb;
  });

  return { type: 'play', payload: { cardIds: valid[0].map((c) => c.id) } };
}

export function sanitizeDaifugoState(state: DaifugoInternalState, playerId: string): DaifugoClientState {
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
      passed: p.passed,
      finishRank: p.finishRank,
      foulFinish: p.foulFinish,
    })),
    turnPlayerId: state.players[state.turnIndex]?.id ?? '',
    tableTop: state.table.length > 0 ? state.table[state.table.length - 1] : null,
    tableCount: state.table.length,
    revolution: state.revolution,
    elevenBack: state.elevenBack,
    suitLock: state.suitLock,
    phase: state.phase,
    lastLog: state.lastLog,
  };
}
