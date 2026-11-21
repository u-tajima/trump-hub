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
  declaredRank: number;
}

export interface DoubtInternalState {
  rules: DoubtRules;
  players: DoubtPlayerState[];
  turnIndex: number;
  expectedRank: number;
  pile: Card[];
  lastPlay: DoubtLastPlay | null;
  subPhase: 'play' | 'doubtWindow' | 'reveal';
  windowEndsAt: number;
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
        lastReveal: null,
        lastLog: `${current.name} が「${rankStr}」を ${played.length}枚 出しました！ダウトする？`,
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

    const winner = players.find((p) => p.hand.length === 0);
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
    const matching = current.hand.filter(
      (c) => c.rank === state.expectedRank || (state.rules.jokerEnabled && c.suit === 'joker')
    );
    if (matching.length > 0) {
      return { type: 'play', payload: { cardIds: matching.slice(0, 4).map((c) => c.id) } };
    }
    const count = current.hand.length >= 2 && Math.random() < 0.35 ? 2 : 1;
    return { type: 'play', payload: { cardIds: current.hand.slice(0, count).map((c) => c.id) } };
  }

  if (state.subPhase === 'doubtWindow' && state.lastPlay && state.lastPlay.playerId !== botId) {
    const bot = state.players.find((p) => p.id === botId);
    if (!bot) return null;
    const mySame = bot.hand.filter((c) => c.rank === state.lastPlay!.declaredRank).length;
    const impossible = mySame + state.lastPlay.cards.length > 4 && !state.rules.jokerEnabled;
    if (impossible || (state.lastPlay.cards.length >= 3 && Math.random() < 0.4) || Math.random() < 0.12) {
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
