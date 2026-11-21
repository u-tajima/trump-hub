import { type Card, type Suit, formatCardShort, formatRank } from '../types/card';
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

export type DaifugoPendingEffect =
  | { type: 'sevenPass'; playerId: string; count: number }
  | { type: 'tenDiscard'; playerId: string; count: number }
  | { type: 'queenBomber'; playerId: string };

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
  numberLock: boolean;
  pendingEffect: DaifugoPendingEffect | null;
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
  numberLock: boolean;
  pendingEffect: DaifugoPendingEffect | null;
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
    numberLock: false,
    pendingEffect: null,
    lastPlayerId: null,
    finishedOrder: [],
    foulOrder: [],
    winnerIdsLastGame: previousFinishedOrder,
    phase: 'playing',
    lastLog: `${players[startIdx].name} のターンからスタート`,
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

function isSandstormPlay(cards: Card[], rules: DaifugoRules): boolean {
  if (!rules.sandstorm || cards.length !== 3) return false;
  return cards.every((c) => c.suit === 'joker' || c.rank === 3) && cards.some((c) => c.rank === 3);
}

export function canPlayOnTable(
  cards: Card[],
  state: DaifugoInternalState
): { ok: boolean; reason?: string; parsed?: Omit<TablePlay, 'playerId'> } {
  const parsed = parsePlay(cards, state.rules);
  if (!parsed) {
    return { ok: false, reason: 'その組み合わせでは出せません' };
  }

  const top = state.table.length > 0 ? state.table[state.table.length - 1] : null;
  if (!top) {
    return { ok: true, parsed };
  }

  if (isSandstormPlay(cards, state.rules)) {
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
    return { ok: false, reason: '場と同じ枚数・出し方で出してください' };
  }

  if (state.suitLock && state.suitLock.length > 0 && !parsed.isJokerSingle) {
    if (parsed.kind === 'staircase') {
      if (parsed.suits[0] !== state.suitLock[0]) {
        return { ok: false, reason: 'スートしばり中です' };
      }
    } else {
      const normalSuits = cards.filter((c) => c.suit !== 'joker').map((c) => c.suit);
      if (!normalSuits.every((s) => state.suitLock!.includes(s))) {
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

  if (state.numberLock) {
    const expectedRank = rev ? top.effectiveRank - 1 : top.effectiveRank + 1;
    if (parsed.effectiveRank !== expectedRank) {
      return { ok: false, reason: '激しば（数しばり）中です！連番のみ出せます' };
    }
    return { ok: true, parsed };
  }

  const stronger = rev
    ? parsed.effectiveRank < top.effectiveRank
    : parsed.effectiveRank > top.effectiveRank;

  if (!stronger) {
    return { ok: false, reason: rev ? '場より弱いカードが必要です' : '場より強いカードが必要です' };
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
  if (
    state.rules.spade3Return &&
    top?.isJokerSingle &&
    cards.length === 1 &&
    cards[0].suit === 'spade' &&
    cards[0].rank === 3
  ) {
    return true;
  }
  return false;
}

function clearTable(state: DaifugoInternalState, nextTurnIdx: number, log: string): DaifugoInternalState {
  const players = state.players.map((p) => ({ ...p, passed: false }));
  return {
    ...state,
    players,
    table: [],
    elevenBack: false,
    suitLock: null,
    numberLock: false,
    pendingEffect: null,
    lastPlayerId: null,
    turnIndex: nextTurnIdx,
    lastLog: log,
  };
}

function findNextActivePlayerIndex(
  state: DaifugoInternalState,
  fromIdx: number,
  includePassed = false,
  skipSteps = 1
): number {
  const n = state.players.length;
  let cur = fromIdx;
  for (let k = 0; k < skipSteps; k++) {
    for (let step = 1; step <= n; step++) {
      const idx = (cur + step) % n;
      const p = state.players[idx];
      if (p.finishRank === null && !p.foulFinish && (includePassed || !p.passed)) {
        cur = idx;
        break;
      }
    }
  }
  return cur;
}

function finalizeIfGameOver(state: DaifugoInternalState): DaifugoInternalState {
  const remaining = state.players.filter((p) => p.finishRank === null && !p.foulFinish);
  if (remaining.length <= 1) {
    const players = [...state.players];
    const finishedOrder = [...state.finishedOrder];
    if (remaining.length === 1) {
      finishedOrder.push(remaining[0].id);
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
      pendingEffect: null,
      phase: 'finished',
      lastLog: `ゲーム終了！ 大富豪: ${players.find((p) => p.finishRank === 1)?.name ?? ''}`,
    };
  }
  return state;
}

function checkPlayerFinish(
  state: DaifugoInternalState,
  playerIdx: number
): DaifugoInternalState {
  const p = state.players[playerIdx];
  if (p.hand.length > 0 || p.finishRank !== null || p.foulFinish) return state;

  const players = state.players.map((pl) => ({ ...pl }));
  const finishedOrder = [...state.finishedOrder];
  const rank = finishedOrder.length + 1;
  players[playerIdx].finishRank = rank;
  finishedOrder.push(p.id);
  return finalizeIfGameOver({
    ...state,
    players,
    finishedOrder,
    lastLog: `${state.lastLog} / ${p.name} ${rank}位上がり`,
  });
}

export function applyDaifugoAction(
  state: DaifugoInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: DaifugoInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }

  if (state.pendingEffect) {
    const eff = state.pendingEffect;
    if (eff.playerId !== playerId) {
      return { state, error: '効果の選択待ちです' };
    }
    const actorIdx = state.players.findIndex((p) => p.id === playerId);
    const actor = state.players[actorIdx];

    if (eff.type === 'sevenPass' && action.type === 'resolveSevenPass') {
      const cardIds = (action.payload as { cardIds?: string[] })?.cardIds ?? [];
      const need = Math.min(eff.count, actor.hand.length);
      if (cardIds.length !== need) {
        return { state, error: `渡すカードを ${need}枚 選んでください` };
      }
      const nextReceiverIdx = findNextActivePlayerIndex(state, actorIdx, true, 1);
      const passedCards = actor.hand.filter((c) => cardIds.includes(c.id));
      const players = state.players.map((p, idx) => {
        if (idx === actorIdx) return { ...p, hand: p.hand.filter((c) => !cardIds.includes(c.id)) };
        if (idx === nextReceiverIdx) return { ...p, hand: sortCardsByRank([...p.hand, ...passedCards], true) };
        return p;
      });
      let nextState: DaifugoInternalState = {
        ...state,
        players,
        pendingEffect: null,
        lastLog: `${actor.name} が ${players[nextReceiverIdx].name} に ${passedCards.length}枚 渡しました`,
      };
      nextState = checkPlayerFinish(nextState, actorIdx);
      if (nextState.phase === 'finished') return { state: nextState };
      nextState.turnIndex = findNextActivePlayerIndex(nextState, actorIdx, false, 1);
      return { state: nextState };
    }

    if (eff.type === 'tenDiscard' && action.type === 'resolveTenDiscard') {
      const cardIds = (action.payload as { cardIds?: string[] })?.cardIds ?? [];
      const need = Math.min(eff.count, actor.hand.length);
      if (cardIds.length !== need) {
        return { state, error: `捨てるカードを ${need}枚 選んでください` };
      }
      const players = state.players.map((p, idx) =>
        idx === actorIdx ? { ...p, hand: p.hand.filter((c) => !cardIds.includes(c.id)) } : p
      );
      let nextState: DaifugoInternalState = {
        ...state,
        players,
        pendingEffect: null,
        lastLog: `${actor.name} が10捨てで ${need}枚 捨てました`,
      };
      nextState = checkPlayerFinish(nextState, actorIdx);
      if (nextState.phase === 'finished') return { state: nextState };
      nextState.turnIndex = findNextActivePlayerIndex(nextState, actorIdx, false, 1);
      return { state: nextState };
    }

    if (eff.type === 'queenBomber' && action.type === 'resolveQueenBomber') {
      const targetRank = (action.payload as { rank?: number })?.rank;
      if (!targetRank || targetRank < 1 || targetRank > 13) {
        return { state, error: '1〜13の数字を選んでください' };
      }
      let removedTotal = 0;
      const players = state.players.map((p) => {
        const nextHand = p.hand.filter((c) => c.rank !== targetRank);
        removedTotal += p.hand.length - nextHand.length;
        return { ...p, hand: nextHand };
      });
      let nextState: DaifugoInternalState = {
        ...state,
        players,
        pendingEffect: null,
        lastLog: `Qボンバー発動！ 「${formatRank(targetRank as Card['rank'])}」を計 ${removedTotal}枚 爆破しました`,
      };
      for (let i = 0; i < players.length; i++) {
        nextState = checkPlayerFinish(nextState, i);
        if (nextState.phase === 'finished') return { state: nextState };
      }
      nextState.turnIndex = findNextActivePlayerIndex(nextState, actorIdx, false, 1);
      return { state: nextState };
    }

    return { state, error: '特殊効果の選択を完了してください' };
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
        resumeIdx = findNextActivePlayerIndex(nextState, resumeIdx, true, 1);
      }
      nextState = clearTable(nextState, resumeIdx, `場が流れました！ ${players[resumeIdx].name} のターン`);
      return { state: nextState };
    }

    nextState.turnIndex = findNextActivePlayerIndex(nextState, state.turnIndex, false, 1);
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
    const revBefore = isReversed(state);

    const newHand = currentPlayer.hand.filter((c) => !cardIds.includes(c.id));
    const players = state.players.map((p, idx) =>
      idx === state.turnIndex ? { ...p, hand: newHand } : p
    );

    let revolution = state.revolution;
    let elevenBack = state.elevenBack;
    let suitLock = state.suitLock;
    let numberLock = state.numberLock;
    const finishedOrder = [...state.finishedOrder];
    const foulOrder = [...state.foulOrder];
    const logs: string[] = [`${currentPlayer.name}: ${selectedCards.map(formatCardShort).join(' ')}`];

    const isRevTrigger =
      (parsed.kind === 'group' && state.rules.revolution && selectedCards.length >= 4) ||
      (parsed.kind === 'staircase' && state.rules.kaidanRevolution && selectedCards.length >= 4);
    if (isRevTrigger) {
      revolution = !revolution;
      logs.push(revolution ? '[革命]' : '[革命返し]');
    }

    if (state.rules.elevenBack && selectedCards.some((c) => c.rank === 11)) {
      elevenBack = true;
      logs.push('[11バック]');
    }

    if (state.rules.suitLock && prevTop && !suitLock && !parsed.isJokerSingle && !prevTop.isJokerSingle) {
      if (parsed.suits.length > 0 && parsed.suits.length === prevTop.suits.length) {
        if (parsed.suits.every((s, i) => s === prevTop.suits[i])) {
          suitLock = parsed.suits;
          logs.push('[スートしばり]');
        }
      }
    }

    if (state.rules.numberLock && prevTop && !numberLock && !parsed.isJokerSingle && !prevTop.isJokerSingle) {
      const expectedStep = revBefore ? prevTop.effectiveRank - 1 : prevTop.effectiveRank + 1;
      if (parsed.effectiveRank === expectedStep) {
        numberLock = true;
        logs.push('[激しば]');
      }
    }

    const playerFinished = newHand.length === 0;
    let miyakoochiTriggered = false;
    if (playerFinished) {
      if (isFoulFinishCards(selectedCards, state)) {
        players[state.turnIndex].foulFinish = true;
        foulOrder.unshift(currentPlayer.id);
        logs.push('[反則上がり]');
      } else {
        const rank = finishedOrder.length + 1;
        players[state.turnIndex].finishRank = rank;
        finishedOrder.push(currentPlayer.id);
        logs.push(`[${rank}位上がり]`);

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
            logs.push(`[${prevKing.name} 都落ち]`);
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
      numberLock,
      lastPlayerId: currentPlayer.id,
      finishedOrder,
      foulOrder,
      lastLog: logs.join(' '),
    };

    nextState = finalizeIfGameOver(nextState);
    if (nextState.phase === 'finished') {
      return { state: nextState };
    }

    const isEightCut = state.rules.eightCut && selectedCards.some((c) => c.rank === 8);
    const isSpade3 =
      state.rules.spade3Return &&
      prevTop?.isJokerSingle &&
      selectedCards.length === 1 &&
      selectedCards[0].suit === 'spade' &&
      selectedCards[0].rank === 3;
    const isSandstorm = isSandstormPlay(selectedCards, state.rules);

    if (isEightCut || isSpade3 || isSandstorm) {
      const reason = isSandstorm ? '[砂嵐]' : isSpade3 ? '[スペ3返し]' : '[8切り]';
      let resumeIdx = state.turnIndex;
      if (players[resumeIdx].finishRank !== null || players[resumeIdx].foulFinish) {
        resumeIdx = findNextActivePlayerIndex(nextState, resumeIdx, true, 1);
      }
      nextState = clearTable(nextState, resumeIdx, `${logs.join(' ')} ${reason} 場が流れます`);
      return { state: nextState };
    }

    if (newHand.length > 0) {
      const sevenCount = selectedCards.filter((c) => c.rank === 7).length;
      if (state.rules.sevenPass && sevenCount > 0) {
        nextState.pendingEffect = { type: 'sevenPass', playerId: currentPlayer.id, count: sevenCount };
        nextState.lastLog = `${logs.join(' ')} → 7渡し：渡すカードを${Math.min(sevenCount, newHand.length)}枚選択`;
        return { state: nextState };
      }

      const tenCount = selectedCards.filter((c) => c.rank === 10).length;
      if (state.rules.tenDiscard && tenCount > 0) {
        nextState.pendingEffect = { type: 'tenDiscard', playerId: currentPlayer.id, count: tenCount };
        nextState.lastLog = `${logs.join(' ')} → 10捨て：捨てるカードを${Math.min(tenCount, newHand.length)}枚選択`;
        return { state: nextState };
      }

      const queenCount = selectedCards.filter((c) => c.rank === 12).length;
      if (state.rules.queenBomber && queenCount > 0) {
        nextState.pendingEffect = { type: 'queenBomber', playerId: currentPlayer.id };
        nextState.lastLog = `${logs.join(' ')} → Qボンバー：爆破する数字を選択`;
        return { state: nextState };
      }
    }

    const fiveCount = state.rules.fiveSkip ? selectedCards.filter((c) => c.rank === 5).length : 0;
    const stepCount = 1 + fiveCount;
    nextState.turnIndex = findNextActivePlayerIndex(nextState, state.turnIndex, false, stepCount);
    if (miyakoochiTriggered) {
      nextState = finalizeIfGameOver(nextState);
    }
    return { state: nextState };
  }

  return { state, error: '不明なアクションです' };
}

export function computeDaifugoBotAction(state: DaifugoInternalState): { type: string; payload?: unknown } {
  if (state.pendingEffect) {
    const eff = state.pendingEffect;
    const actor = state.players.find((p) => p.id === eff.playerId)!;
    if (eff.type === 'sevenPass') {
      const ids = actor.hand.slice(0, Math.min(eff.count, actor.hand.length)).map((c) => c.id);
      return { type: 'resolveSevenPass', payload: { cardIds: ids } };
    }
    if (eff.type === 'tenDiscard') {
      const ids = actor.hand.slice(0, Math.min(eff.count, actor.hand.length)).map((c) => c.id);
      return { type: 'resolveTenDiscard', payload: { cardIds: ids } };
    }
    return { type: 'resolveQueenBomber', payload: { rank: actor.hand[0]?.rank || 3 } };
  }

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
    numberLock: state.numberLock,
    pendingEffect: state.pendingEffect,
    phase: state.phase,
    lastLog: state.lastLog,
  };
}
