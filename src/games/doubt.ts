import { type Card, formatCardShort, formatRank } from '../types/card';
import type { DoubtRules, PlayerInfo } from '../types/game';
import { createDeck, dealCards, shuffle, sortCardsByRank } from '../utils/deck';

export interface DoubtPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  hand: Card[];
}

export interface DoubtLastPlay {
  playerId: string;
  cards: Card[];
  declaredRank: number; // 1..13
}

export interface DoubtInternalState {
  rules: DoubtRules;
  players: DoubtPlayerState[];
  turnIndex: number;
  expectedRank: number; // 1..13
  pile: Card[];
  lastPlay: DoubtLastPlay | null;
  subPhase: 'play' | 'doubtWindow' | 'reveal';
  windowEndsAt: number;
  botDecidedIds?: string[];
  lastReveal: {
    callerId: string;
    callerName: string;
    targetName: string;
    cards: Card[];
    declaredRank: number;
    wasLie: boolean;
  } | null;
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface DoubtClientState {
  rules: DoubtRules;
  myId: string;
  myHand: Card[];
  players: {
    id: string;
    name: string;
    isBot: boolean;
    handCount: number;
  }[];
  turnPlayerId: string;
  expectedRank: number;
  pileCount: number;
  lastPlayMeta: {
    playerId: string;
    playerName: string;
    count: number;
    declaredRank: number;
  } | null;
  subPhase: 'play' | 'doubtWindow' | 'reveal';
  windowEndsAt: number;
  lastReveal: DoubtInternalState['lastReveal'];
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export function initDoubt(playersInfo: PlayerInfo[], rules: DoubtRules): DoubtInternalState {
  const deck = shuffle(createDeck(rules.jokerEnabled ? 2 : 0));
  const dealt = dealCards(deck, playersInfo.length);
  const players: DoubtPlayerState[] = playersInfo.map((p, idx) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    hand: sortCardsByRank(dealt[idx]),
  }));

  return {
    rules,
    players,
    turnIndex: 0,
    expectedRank: 1,
    pile: [],
    lastPlay: null,
    subPhase: 'play',
    windowEndsAt: 0,
    lastReveal: null,
    winnerId: null,
    phase: 'playing',
    lastLog: `${players[0].name} から「A (1)」でスタート！`,
  };
}

function isLiePlay(cards: Card[], declaredRank: number, jokerEnabled: boolean): boolean {
  return cards.some((c) => {
    if (c.suit === 'joker' && jokerEnabled) return false;
    return c.rank !== declaredRank;
  });
}

export function applyDoubtAction(
  state: DoubtInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: DoubtInternalState; error?: string } {
  if (state.phase !== 'playing') return { state, error: 'ゲームは終了しています' };

  if (action.type === 'play' && state.subPhase === 'play') {
    const current = state.players[state.turnIndex];
    if (current.id !== playerId) return { state, error: 'あなたのターンではありません' };

    const cardIds = (action.payload as { cardIds?: string[] })?.cardIds ?? [];
    if (cardIds.length < 1 || cardIds.length > 4) {
      return { state, error: '1〜4枚を選んで出してください' };
    }

    const played = cardIds
      .map((id) => current.hand.find((c) => c.id === id))
      .filter((c): c is Card => Boolean(c));
    if (played.length !== cardIds.length) return { state, error: '無効なカード選択です' };

    const players = state.players.map((p, idx) =>
      idx === state.turnIndex
        ? { ...p, hand: p.hand.filter((c) => !cardIds.includes(c.id)) }
        : p
    );

    const declaredRank = state.expectedRank;
    const rankStr = formatRank(declaredRank as Card['rank']);

    return {
      state: {
        ...state,
        players,
        pile: [...state.pile, ...played],
        lastPlay: { playerId: current.id, cards: played, declaredRank },
        subPhase: 'doubtWindow',
        windowEndsAt: Date.now() + state.rules.doubtWindowSec * 1000,
        botDecidedIds: [],
        lastReveal: null,
        lastLog: `${current.name} が「${rankStr}」を ${played.length}枚 出しました！ダウトする？`,
      },
    };
  }

  if (action.type === 'passDoubt' && state.subPhase === 'doubtWindow') {
    const decided = state.botDecidedIds ?? [];
    if (decided.includes(playerId)) return { state };
    return {
      state: {
        ...state,
        botDecidedIds: [...decided, playerId],
      },
    };
  }

  if (action.type === 'doubt' && state.subPhase === 'doubtWindow' && state.lastPlay) {
    if (playerId === state.lastPlay.playerId) {
      return { state, error: '自分にはダウトできません' };
    }
    const caller = state.players.find((p) => p.id === playerId);
    const target = state.players.find((p) => p.id === state.lastPlay!.playerId);
    if (!caller || !target) return { state, error: 'プレイヤーが見つかりません' };

    const wasLie = isLiePlay(state.lastPlay.cards, state.lastPlay.declaredRank, state.rules.jokerEnabled);
    const penaltyPlayerId = wasLie ? target.id : caller.id;

    const players = state.players.map((p) =>
      p.id === penaltyPlayerId ? { ...p, hand: sortCardsByRank([...p.hand, ...state.pile]) } : p
    );

    const cardsText = state.lastPlay.cards.map(formatCardShort).join(' ');
    const log = wasLie
      ? `💥 ダウト成功！(${cardsText}) ${target.name} が山札 ${state.pile.length}枚 を引き取りました！`
      : `😅 ダウト失敗！本当でした(${cardsText})。${caller.name} が ${state.pile.length}枚 を引き取りました！`;

    // 本当で出した本人の手札が0ならそのまま勝利
    const targetAfter = players.find((p) => p.id === target.id);
    const winner = !wasLie && targetAfter && targetAfter.hand.length === 0 ? targetAfter : null;
    if (winner) {
      return {
        state: {
          ...state,
          players,
          pile: [],
          lastPlay: null,
          subPhase: 'reveal',
          lastReveal: {
            callerId: caller.id,
            callerName: caller.name,
            targetName: target.name,
            cards: state.lastPlay.cards,
            declaredRank: state.lastPlay.declaredRank,
            wasLie,
          },
          winnerId: winner.id,
          phase: 'finished',
          lastLog: `${log} 🏆 ${winner.name} の勝利！`,
        },
      };
    }

    const nextTurn = (state.turnIndex + 1) % players.length;
    const nextRank = (state.expectedRank % 13) + 1;

    return {
      state: {
        ...state,
        players,
        pile: [],
        lastPlay: null,
        turnIndex: nextTurn,
        expectedRank: nextRank,
        subPhase: 'play',
        lastReveal: {
          callerId: caller.id,
          callerName: caller.name,
          targetName: target.name,
          cards: state.lastPlay.cards,
          declaredRank: state.lastPlay.declaredRank,
          wasLie,
        },
        lastLog: log,
      },
    };
  }

  if (action.type === 'proceedWindow' && state.subPhase === 'doubtWindow') {
    // 誰もダウトせず猶予終了 → 出した人が0枚なら勝利確定
    const lastPlayer = state.players.find((p) => p.id === state.lastPlay?.playerId);
    if (lastPlayer && lastPlayer.hand.length === 0) {
      return {
        state: {
          ...state,
          winnerId: lastPlayer.id,
          phase: 'finished',
          lastLog: `🏆 ${lastPlayer.name} が手札を出し切り勝利！`,
        },
      };
    }
    const nextTurn = (state.turnIndex + 1) % state.players.length;
    const nextRank = (state.expectedRank % 13) + 1;
    return {
      state: {
        ...state,
        turnIndex: nextTurn,
        expectedRank: nextRank,
        subPhase: 'play',
        lastLog: `次は ${state.players[nextTurn].name} のターン（「${formatRank(nextRank as Card['rank'])}」）`,
      },
    };
  }

  return { state, error: '操作できません' };
}

export function computeDoubtBotAction(state: DoubtInternalState, botId: string): { type: string; payload?: unknown } | null {
  if (state.subPhase === 'play') {
    const current = state.players[state.turnIndex];
    if (current.id !== botId) return null;

    const exactMatches = current.hand.filter((c) => c.rank === state.expectedRank);
    const jokers = state.rules.jokerEnabled ? current.hand.filter((c) => c.suit === 'joker') : [];

    // 正直に出して今すぐ手札をすべて使い切れるなら全出しで即勝利を狙う
    if (
      exactMatches.length + jokers.length >= current.hand.length &&
      current.hand.length <= 4
    ) {
      return { type: 'play', payload: { cardIds: current.hand.map((c) => c.id) } };
    }

    // 該当する正規の数字を持っている場合：正規カードをすべて出す（ジョーカーは次の苦しい手番用に温存）
    if (exactMatches.length > 0) {
      return {
        type: 'play',
        payload: { cardIds: exactMatches.slice(0, 4).map((c) => c.id) },
      };
    }

    // 正規カードがないがジョーカーがある場合：場の山札が多くてダウトされると痛い時はジョーカーで安全に切り抜ける
    if (jokers.length > 0 && (state.pile.length >= 5 || current.hand.length <= 2)) {
      return { type: 'play', payload: { cardIds: [jokers[0].id] } };
    }

    // ウソをつく場合：今後数巡のうちに自分の手番で回ってくる予定の数字（futureMyRanks）は温存し、
    // 自分の手番で当面回ってこない不要な数字から優先して捨てる
    const playerCount = state.players.length;
    const futureMyRanks = new Set<number>();
    for (let turnAhead = 1; turnAhead <= 4; turnAhead++) {
      const r = ((state.expectedRank - 1 + turnAhead * playerCount) % 13) + 1;
      futureMyRanks.add(r);
    }

    const normals = current.hand.filter((c) => c.suit !== 'joker');
    const pool = normals.length > 0 ? normals : current.hand;
    const rankCounts = new Map<number, number>();
    for (const c of pool) {
      rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);
    }

    // 自分の将来手番に該当しないカードを高優先度で選ぶ
    const sortedToBluff = [...pool].sort((a, b) => {
      const aFuture = futureMyRanks.has(a.rank) ? 1 : 0;
      const bFuture = futureMyRanks.has(b.rank) ? 1 : 0;
      if (aFuture !== bFuture) return aFuture - bFuture;
      // 複数枚ダブっていて処分に困る非将来ランクを優先
      return (rankCounts.get(b.rank) ?? 0) - (rankCounts.get(a.rank) ?? 0);
    });

    const primary = sortedToBluff[0];
    // 山札が少なく、同じ非将来ランクが複数枚ダブっている時のみまれに2枚ブラフ、基本は怪しまれにくい1枚出し
    if (
      state.pile.length <= 3 &&
      !futureMyRanks.has(primary.rank) &&
      (rankCounts.get(primary.rank) ?? 0) >= 2 &&
      Math.random() < 0.25
    ) {
      const sameRankCards = sortedToBluff.filter((c) => c.rank === primary.rank).slice(0, 2);
      return { type: 'play', payload: { cardIds: sameRankCards.map((c) => c.id) } };
    }

    return { type: 'play', payload: { cardIds: [primary.id] } };
  }

  if (state.subPhase === 'doubtWindow' && state.lastPlay && state.lastPlay.playerId !== botId) {
    if ((state.botDecidedIds ?? []).includes(botId)) return null;
    const bot = state.players.find((p) => p.id === botId);
    const target = state.players.find((p) => p.id === state.lastPlay!.playerId);
    if (!bot || !target) return null;

    const declaredRank = state.lastPlay.declaredRank;
    const playedCount = state.lastPlay.cards.length;

    // 1. 相手が手札0枚になった場合：見逃せばその場で相手の勝ちが確定するため必ずダウトで阻止！
    if (target.hand.length === 0) {
      return { type: 'doubt' };
    }

    // 2. 自分の手札にある同名カード＋ジョーカー枚数から論理的に不可能な枚数なら100%ダウト
    const mySame = bot.hand.filter((c) => c.rank === declaredRank).length;
    const myJokers = bot.hand.filter((c) => c.suit === 'joker').length;
    const maxPossibleValid = 4 - mySame + (state.rules.jokerEnabled ? 2 - myJokers : 0);
    if (playedCount > maxPossibleValid) {
      return { type: 'doubt' };
    }

    // ジョーカーありでも正規4枚を超えていれば極めて怪しい
    if (mySame + playedCount > 4) {
      return { type: 'doubt' };
    }

    // 3. ベイズ的疑わしさスコアと山札リスクの比較
    let suspicion =
      playedCount === 1 ? 0.12 : playedCount === 2 ? 0.36 : playedCount === 3 ? 0.72 : 0.92;
    suspicion += mySame * 0.24;

    // 相手の手札が残り1〜2枚の時はピンポイントでその数字を持っている確率が低いため警戒度アップ
    if (target.hand.length <= 2) {
      suspicion += 0.28;
    }

    // 山札が大量に溜まっている時は失敗時のダメージが大きいため慎重にする
    if (state.pile.length >= 12 && target.hand.length >= 3) {
      suspicion -= 0.22;
    } else if (state.pile.length <= 3) {
      suspicion += 0.08;
    }

    if (suspicion >= 0.72 || (suspicion >= 0.45 && Math.random() < suspicion * 0.65)) {
      return { type: 'doubt' };
    }
  }
  return null;
}

export function sanitizeDoubtState(state: DoubtInternalState, playerId: string): DoubtClientState {
  const me = state.players.find((p) => p.id === playerId);
  const lastOwner = state.lastPlay ? state.players.find((p) => p.id === state.lastPlay!.playerId) : null;
  return {
    rules: state.rules,
    myId: playerId,
    myHand: me ? me.hand : [],
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      handCount: p.hand.length,
    })),
    turnPlayerId: state.players[state.turnIndex]?.id ?? '',
    expectedRank: state.expectedRank,
    pileCount: state.pile.length,
    lastPlayMeta: state.lastPlay
      ? {
          playerId: state.lastPlay.playerId,
          playerName: lastOwner?.name ?? '',
          count: state.lastPlay.cards.length,
          declaredRank: state.lastPlay.declaredRank,
        }
      : null,
    subPhase: state.subPhase,
    windowEndsAt: state.windowEndsAt,
    lastReveal: state.lastReveal,
    winnerId: state.winnerId,
    phase: state.phase,
    lastLog: state.lastLog,
  };
}
