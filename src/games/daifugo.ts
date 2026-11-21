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

  // 特殊効果解決フェーズ (7渡し / 10捨て / Qボンバー)
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

    // 革命 / 階段革命
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

    // 7渡し / 10捨て / Qボンバー (手札が残っている場合)
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

    // 5飛び
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

function getCardTacticalValue(card: Card, state: DaifugoInternalState, rankCounts: Map<number, number>): number {
  if (card.suit === 'joker') return 200;
  const rev = isReversed(state);
  const baseStrength = daifugoStrength(card.rank);
  let val = rev ? (18 - baseStrength) * 8 : baseStrength * 8;

  if (state.rules.eightCut && card.rank === 8) val += 75;
  if (state.rules.elevenBack && card.rank === 11) val += 35;
  if (state.rules.fiveSkip && card.rank === 5) val += 30;
  if (state.rules.tenDiscard && card.rank === 10) val += 25;
  if (state.rules.sevenPass && card.rank === 7) val += 25;
  if (state.rules.queenBomber && card.rank === 12) val += 25;
  if (state.rules.spade3Return && card.suit === 'spade' && card.rank === 3) val += 50;
  if (state.rules.sandstorm && card.rank === 3 && (rankCounts.get(3) ?? 0) >= 2) val += 65;

  const count = rankCounts.get(card.rank) ?? 1;
  if (count >= 4) val += 90;
  else if (count === 3) val += 45;
  else if (count === 2) val += 22;

  return val;
}

function generateDaifugoCandidates(hand: Card[], state: DaifugoInternalState): Card[][] {
  const candidates: Card[][] = [];
  const jokers = hand.filter((c) => c.suit === 'joker');
  const normals = hand.filter((c) => c.suit !== 'joker');

  // 1. 単騎出し
  for (const c of hand) {
    candidates.push([c]);
  }

  // 2. 同数字ペア・3枚・4枚（ジョーカー補助含む）
  const byRank = new Map<number, Card[]>();
  for (const c of normals) {
    const list = byRank.get(c.rank) ?? [];
    list.push(c);
    byRank.set(c.rank, list);
  }
  for (const list of byRank.values()) {
    if (list.length >= 2) candidates.push(list.slice(0, 2));
    if (list.length >= 3) candidates.push(list.slice(0, 3));
    if (list.length >= 4) candidates.push(list.slice(0, 4));
    if (jokers.length >= 1) {
      if (list.length >= 1) candidates.push([list[0], jokers[0]]);
      if (list.length >= 2) candidates.push([list[0], list[1], jokers[0]]);
      if (list.length >= 3) candidates.push([list[0], list[1], list[2], jokers[0]]);
    }
  }
  if (jokers.length >= 2) {
    candidates.push(jokers.slice(0, 2));
  }

  // 3. 階段（3〜5枚、ジョーカー1枚補完含む）
  if (state.rules.staircase) {
    const bySuit = new Map<Suit, Card[]>();
    for (const c of normals) {
      const list = bySuit.get(c.suit) ?? [];
      list.push(c);
      bySuit.set(c.suit, list);
    }
    for (const list of bySuit.values()) {
      const sorted = [...list].sort((a, b) => daifugoStrength(a.rank) - daifugoStrength(b.rank));
      for (let i = 0; i < sorted.length; i++) {
        const seq: Card[] = [sorted[i]];
        for (let j = i + 1; j < sorted.length; j++) {
          const prevS = daifugoStrength(seq[seq.length - 1].rank);
          const curS = daifugoStrength(sorted[j].rank);
          if (curS === prevS + 1) {
            seq.push(sorted[j]);
            if (seq.length >= 3) {
              candidates.push([...seq]);
              if (jokers.length >= 1 && seq.length === 3) {
                candidates.push([...seq, jokers[0]]);
              }
            }
          } else if (curS > prevS + 1) {
            break;
          }
        }
        // ジョーカーで1枚飛びを埋める3枚・4枚階段
        if (jokers.length >= 1 && i + 1 < sorted.length) {
          const s0 = daifugoStrength(sorted[i].rank);
          const s1 = daifugoStrength(sorted[i + 1].rank);
          if (s1 === s0 + 2) {
            candidates.push([sorted[i], sorted[i + 1], jokers[0]]);
            if (i + 2 < sorted.length && daifugoStrength(sorted[i + 2].rank) === s1 + 1) {
              candidates.push([sorted[i], sorted[i + 1], sorted[i + 2], jokers[0]]);
            }
          }
        }
      }
    }
  }

  return candidates;
}

function willPlayClearTable(cards: Card[], parsed: Omit<TablePlay, 'playerId'>, state: DaifugoInternalState): boolean {
  const prevTop = state.table.length > 0 ? state.table[state.table.length - 1] : null;
  if (state.rules.eightCut && cards.some((c) => c.rank === 8)) return true;
  if (
    state.rules.spade3Return &&
    prevTop?.isJokerSingle &&
    cards.length === 1 &&
    cards[0].suit === 'spade' &&
    cards[0].rank === 3
  ) {
    return true;
  }
  if (isSandstormPlay(cards, state.rules)) return true;
  if (parsed.isJokerSingle && !state.rules.spade3Return) return true;
  const rev = isReversed(state);
  if (!rev && parsed.effectiveRank >= 15 && state.rules.jokerCount === 0) return true;
  if (rev && parsed.effectiveRank <= 3 && state.rules.jokerCount === 0) return true;
  return false;
}

export function computeDaifugoBotAction(state: DaifugoInternalState): { type: string; payload?: unknown } {
  // 特殊効果（7渡し・10捨て・Qボンバー）の最適選択
  if (state.pendingEffect) {
    const eff = state.pendingEffect;
    const actor = state.players.find((p) => p.id === eff.playerId)!;
    const rankCounts = new Map<number, number>();
    for (const c of actor.hand) {
      if (c.suit !== 'joker') rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);
    }

    if (eff.type === 'sevenPass' || eff.type === 'tenDiscard') {
      const need = Math.min(eff.count, actor.hand.length);
      // すべて渡せば・捨てれば即上がりの場合は全選択
      if (need >= actor.hand.length) {
        return {
          type: eff.type === 'sevenPass' ? 'resolveSevenPass' : 'resolveTenDiscard',
          payload: { cardIds: actor.hand.map((c) => c.id) },
        };
      }
      // 戦術価値が低い（孤立した弱い）カードから優先して手放す
      const sortedToDump = [...actor.hand].sort(
        (a, b) => getCardTacticalValue(a, state, rankCounts) - getCardTacticalValue(b, state, rankCounts)
      );
      const ids = sortedToDump.slice(0, need).map((c) => c.id);
      return {
        type: eff.type === 'sevenPass' ? 'resolveSevenPass' : 'resolveTenDiscard',
        payload: { cardIds: ids },
      };
    }

    // Qボンバー：自分の手札が1種類のみ（ジョーカーなし）ならそれを爆破して即勝利
    const myRanks = Array.from(rankCounts.keys());
    const hasJoker = actor.hand.some((c) => c.suit === 'joker');
    if (!hasJoker && myRanks.length === 1) {
      return { type: 'resolveQueenBomber', payload: { rank: myRanks[0] } };
    }

    // 自分が持っておらず、かつ強力なランク（2, A, 8, K または革命時は 3, 4, 8, 5）を優先爆破
    const rev = isReversed(state);
    const targetPriority = rev
      ? [3, 4, 8, 5, 6, 7, 11, 10, 9, 12, 13, 1, 2]
      : [2, 1, 8, 13, 12, 11, 10, 7, 9, 6, 5, 4, 3];
    for (const r of targetPriority) {
      if (!rankCounts.has(r)) {
        return { type: 'resolveQueenBomber', payload: { rank: r } };
      }
    }
    return { type: 'resolveQueenBomber', payload: { rank: targetPriority[0] } };
  }

  const bot = state.players[state.turnIndex];
  const hand = bot.hand;
  const candidates = generateDaifugoCandidates(hand, state);

  const validPlays: { cards: Card[]; parsed: Omit<TablePlay, 'playerId'> }[] = [];
  for (const cards of candidates) {
    const res = canPlayOnTable(cards, state);
    if (res.ok && res.parsed) {
      validPlays.push({ cards, parsed: res.parsed });
    }
  }

  if (validPlays.length === 0) {
    return { type: 'pass' };
  }

  const activeOpponents = state.players.filter(
    (p, idx) => idx !== state.turnIndex && p.finishRank === null && !p.foulFinish
  );
  const minOppCards =
    activeOpponents.length > 0 ? Math.min(...activeOpponents.map((p) => p.hand.length)) : 99;

  const rankCounts = new Map<number, number>();
  for (const c of hand) {
    if (c.suit !== 'joker') rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);
  }

  const rev = isReversed(state);
  const prevTop = state.table.length > 0 ? state.table[state.table.length - 1] : null;

  let bestPlay = validPlays[0].cards;
  let bestScore = -Infinity;

  for (const { cards, parsed } of validPlays) {
    let score = 0;
    const isLast = cards.length === hand.length;
    const usedIds = new Set(cards.map((c) => c.id));
    const remaining = hand.filter((c) => !usedIds.has(c.id));
    const usesJoker = cards.some((c) => c.suit === 'joker');

    // 1. 即上がり判定（反則上がり回避）
    if (isLast) {
      if (isFoulFinishCards(cards, state)) {
        score -= 200000;
      } else {
        score += 200000;
      }
    } else {
      // 残り手札が反則上がりカードだけになるのを強く避ける
      if (state.rules.banFinishStrong && remaining.every((c) => isFoulFinishCards([c], state))) {
        score -= 12000;
      }

      // 2. 2手詰め（場を流せる手＋残りが1手で合法に上がれる形）は超高評価
      const clears = willPlayClearTable(cards, parsed, state);
      const remParsed = parsePlay(remaining, state.rules);
      if (clears && remParsed && !isFoulFinishCards(remaining, state)) {
        score += 75000;
      } else if (remParsed && !isFoulFinishCards(remaining, state)) {
        score += 4500;
      }
    }

    // 3. 基本温存スコア：なるべく弱いカードから消化し、切り札を温存する
    const effRank = parsed.isJokerSingle ? (rev ? 1 : 17) : parsed.effectiveRank;
    const relativePower = rev ? 17 - effRank : effRank - 2; // 1 (最弱) .. 15 (最強)

    if (minOppCards <= 2) {
      // 相手が上がり寸前の時は強い手や場流し・複数枚出しを惜しまない
      score += relativePower * 10;
      if (willPlayClearTable(cards, parsed, state)) score += 350;
      if (!prevTop && cards.length >= 2) score += cards.length * 140;
    } else {
      // 通常時は弱いカードから計画的に消化
      score -= relativePower * 18;
      if (usesJoker && !isLast) score -= 240;
    }

    // 4. 親（空場）では複数枚出しや階段で手札を一気に減らす
    if (!prevTop) {
      score += cards.length * 65;
      if (parsed.kind === 'staircase') score += 90;
    } else {
      // 場のカードに対してギリギリ勝てる手を好む
      score += cards.length * 20;
    }

    // 5. ペア・トリプル・4枚組を崩して単騎出しするペナルティ
    if (cards.length === 1 && !usesJoker && !isLast) {
      const cnt = rankCounts.get(cards[0].rank) ?? 1;
      if (cnt >= 4 && state.rules.revolution) score -= 220;
      else if (cnt === 3) score -= 110;
      else if (cnt === 2) score -= 55;
    }

    // 6. 革命・11バックの損得判定
    const triggersRev =
      (parsed.kind === 'group' && state.rules.revolution && cards.length >= 4) ||
      (parsed.kind === 'staircase' && state.rules.kaidanRevolution && cards.length >= 4);
    const triggers11Back = state.rules.elevenBack && cards.some((c) => c.rank === 11);

    if ((triggersRev || triggers11Back) && remaining.length > 0) {
      const remNormals = remaining.filter((c) => c.suit !== 'joker');
      if (remNormals.length > 0) {
        const avgStr =
          remNormals.reduce((s, c) => s + daifugoStrength(c.rank), 0) / remNormals.length;
        const nextRev = triggersRev ? !state.revolution : state.revolution;
        const nextEffectiveRev = nextRev !== (triggers11Back || state.elevenBack);
        // 逆転状態なら平均強度が低い（3〜7が多い）ほど有利
        if (nextEffectiveRev && avgStr <= 8.5) score += 260;
        else if (!nextEffectiveRev && avgStr >= 9.5) score += 260;
        else if (minOppCards > 2) score -= 180;
      }
    }

    // 7. スペ3返し・砂嵐・8切り・しばり・特殊効果の評価
    if (
      state.rules.spade3Return &&
      prevTop?.isJokerSingle &&
      cards.length === 1 &&
      cards[0].suit === 'spade' &&
      cards[0].rank === 3
    ) {
      score += 1200; // ジョーカーをスペ3で撃墜できる絶好機
    }
    if (isSandstormPlay(cards, state.rules) && prevTop) {
      score += 650;
    }
    if (state.rules.eightCut && cards.some((c) => c.rank === 8)) {
      if (prevTop && (minOppCards <= 3 || relativePower >= 10 || remaining.length <= 3)) {
        score += 180;
      } else if (!prevTop && remaining.length > 2) {
        // 空場でいきなり8単騎を切るのは勿体ない（他に手がある場合）
        score -= 90;
      }
    }
    if (state.rules.tenDiscard && cards.some((c) => c.rank === 10)) score += 85;
    if (state.rules.sevenPass && cards.some((c) => c.rank === 7)) score += 80;
    if (state.rules.queenBomber && cards.some((c) => c.rank === 12)) score += 75;
    if (state.rules.fiveSkip && cards.some((c) => c.rank === 5)) score += 70;

    // スートしばり・激しばを発動させた時、自分も追撃牌を持っていれば加点
    if (
      state.rules.suitLock &&
      prevTop &&
      !state.suitLock &&
      !parsed.isJokerSingle &&
      !prevTop.isJokerSingle &&
      parsed.suits.length > 0 &&
      parsed.suits.length === prevTop.suits.length &&
      parsed.suits.every((s, i) => s === prevTop.suits[i])
    ) {
      const hasFollowUp = remaining.some((c) => c.suit === 'joker' || parsed.suits.includes(c.suit));
      score += hasFollowUp || minOppCards <= 2 ? 95 : -20;
    }

    if (score > bestScore) {
      bestScore = score;
      bestPlay = cards;
    }
  }

  // 空場でない時、反則上がりしか手がない、または序盤で切り札（ジョーカーやペア崩し2）を無理に吐くだけなら戦略的パス
  if (prevTop && bestScore < -210 && minOppCards >= 4 && hand.length >= 5) {
    return { type: 'pass' };
  }
  if (prevTop && bestScore <= -100000) {
    return { type: 'pass' };
  }

  return { type: 'play', payload: { cardIds: bestPlay.map((c) => c.id) } };
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
