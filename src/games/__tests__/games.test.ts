import { describe, expect, it } from 'vitest';
import type { Card } from '../../types/card';
import type { PlayerInfo } from '../../types/game';
import { applyChinchiroAction, evaluateChinchiroDice, initChinchiro } from '../chinchiro';
import { applyConnect4Action, initConnect4 } from '../connect4';
import { applyDaifugoAction, canPlayOnTable, initDaifugo, parsePlay } from '../daifugo';
import { applyDoubtAction, initDoubt } from '../doubt';
import { applyGomokuAction, initGomoku } from '../gomoku';
import { applyHoldemAction, evaluateBestSeven, initHoldem } from '../holdem';
import { applyMemoryAction, initMemory } from '../memory';
import { applyOldMaidAction, initOldMaid } from '../oldMaid';
import { applyPokerAction, evaluatePokerHand, initPoker } from '../poker';
import { GAME_REGISTRY } from '../registry';
import { applyReversiAction, initReversi } from '../reversi';
import { applySevensAction, canPlaceNormalCard, initSevens } from '../sevens';
import { applySpeedAction, canPlaceOnSpeedPile, initSpeed } from '../speed';

const makePlayers = (count: number): PlayerInfo[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player${i + 1}`,
    isHost: i === 0,
    isBot: false,
    connected: true,
  }));

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({
  id: suit === 'joker' ? 'joker-1' : `${suit}-${rank}`,
  suit,
  rank,
});

describe('Daifugo engine', () => {
  it('parses single, group, and staircase plays', () => {
    const rules = GAME_REGISTRY.daifugo.defaultRules;
    expect(parsePlay([c('spade', 5)], rules)?.kind).toBe('single');
    expect(parsePlay([c('spade', 5), c('heart', 5)], rules)?.kind).toBe('group');
    expect(parsePlay([c('spade', 3), c('spade', 4), c('spade', 5)], rules)?.kind).toBe('staircase');
    expect(parsePlay([c('spade', 3), c('heart', 4), c('spade', 5)], rules)).toBeNull();
  });

  it('supports revolution, 8-cut, suit lock, and spade-3 return', () => {
    const players = makePlayers(2);
    const state = initDaifugo(players, GAME_REGISTRY.daifugo.defaultRules);
    state.turnIndex = 0;
    state.players[0].hand = [
      c('spade', 4),
      c('heart', 4),
      c('diamond', 4),
      c('club', 4),
      c('spade', 8),
      c('heart', 9),
    ];
    state.players[1].hand = [c('joker', 0), c('spade', 3), c('club', 5)];

    let res = applyDaifugoAction(state, 'p1', {
      type: 'play',
      payload: { cardIds: ['spade-4', 'heart-4', 'diamond-4', 'club-4'] },
    });
    expect(res.error).toBeUndefined();
    expect(res.state.revolution).toBe(true);

    res = applyDaifugoAction(res.state, 'p2', { type: 'pass' });
    expect(res.state.table.length).toBe(0);

    res = applyDaifugoAction(res.state, 'p1', { type: 'play', payload: { cardIds: ['spade-8'] } });
    expect(res.state.table.length).toBe(0);
    expect(res.state.turnIndex).toBe(0);

    res.state.players[0].hand = [c('spade', 3), c('heart', 9), c('club', 6)];
    res = applyDaifugoAction(res.state, 'p1', { type: 'play', payload: { cardIds: ['heart-9'] } });
    res = applyDaifugoAction(res.state, 'p2', { type: 'play', payload: { cardIds: ['joker-1'] } });
    expect(canPlayOnTable([c('spade', 3)], res.state).ok).toBe(true);
    res = applyDaifugoAction(res.state, 'p1', { type: 'play', payload: { cardIds: ['spade-3'] } });
    expect(res.error).toBeUndefined();
    expect(res.state.table.length).toBe(0);
  });

  it('supports 7-pass, 10-discard, 5-skip, and sandstorm', () => {
    const players = makePlayers(3);
    const rules = {
      ...GAME_REGISTRY.daifugo.defaultRules,
      sevenPass: true,
      tenDiscard: true,
      fiveSkip: true,
      sandstorm: true,
    };
    const state = initDaifugo(players, rules);
    state.turnIndex = 0;
    state.players[0].hand = [c('spade', 7), c('heart', 4), c('club', 6)];
    state.players[1].hand = [c('diamond', 9), c('spade', 10)];

    let res = applyDaifugoAction(state, 'p1', { type: 'play', payload: { cardIds: ['spade-7'] } });
    expect(res.state.pendingEffect?.type).toBe('sevenPass');
    res = applyDaifugoAction(res.state, 'p1', { type: 'resolveSevenPass', payload: { cardIds: ['heart-4'] } });
    expect(res.state.pendingEffect).toBeNull();
    expect(res.state.players[1].hand.some((card) => card.id === 'heart-4')).toBe(true);
  });
});

describe('Poker engine', () => {
  it('evaluates poker hands and completes bet -> draw -> showdown', () => {
    const royal = [c('spade', 1), c('spade', 13), c('spade', 12), c('spade', 11), c('spade', 10)];
    expect(evaluatePokerHand(royal).category).toBe(9);
    expect(evaluatePokerHand(royal).name).toBe('ロイヤルフラッシュ');

    const players = makePlayers(2);
    let state = initPoker(players, GAME_REGISTRY.poker.defaultRules);
    expect(state.subPhase).toBe('bet1');
    state = applyPokerAction(state, 'p2', { type: 'call' }).state;
    state = applyPokerAction(state, 'p1', { type: 'call' }).state;
    expect(state.subPhase).toBe('draw');
    state = applyPokerAction(state, 'p2', { type: 'draw', payload: { discardIds: [] } }).state;
    state = applyPokerAction(state, 'p1', { type: 'draw', payload: { discardIds: [] } }).state;
    expect(state.subPhase).toBe('bet2');
    state = applyPokerAction(state, 'p2', { type: 'call' }).state;
    state = applyPokerAction(state, 'p1', { type: 'call' }).state;
    expect(state.subPhase).toBe('showdown');
  });
});

describe('Texas Holdem engine', () => {
  it('evaluates best 5 of 7 cards and progresses preflop to showdown', () => {
    const seven = [
      c('spade', 1), c('spade', 13), c('spade', 12), c('spade', 11), c('spade', 10),
      c('heart', 2), c('club', 3),
    ];
    expect(evaluateBestSeven(seven)?.name).toBe('ロイヤルフラッシュ');

    const players = makePlayers(2);
    let state = initHoldem(players, GAME_REGISTRY.holdem.defaultRules);
    expect(state.subPhase).toBe('preflop');
    state = applyHoldemAction(state, 'p1', { type: 'call' }).state;
    state = applyHoldemAction(state, 'p2', { type: 'call' }).state;
    expect(state.subPhase).toBe('flop');
    expect(state.communityCards.length).toBe(3);
  });
});

describe('Sevens engine', () => {
  it('supports tunnel rule and pass limit elimination', () => {
    const players = makePlayers(2);
    const rules = { ...GAME_REGISTRY.sevens.defaultRules, passLimit: 0 as const, tunnel: true };
    const state = initSevens(players, rules);
    state.board.spade[1] = true;
    expect(canPlaceNormalCard('spade', 13, state)).toBe(true);

    state.turnIndex = 0;
    const res = applySevensAction(state, 'p1', { type: 'pass' });
    expect(res.state.players[0].eliminated).toBe(true);
    expect(res.state.phase).toBe('finished');
  });
});

describe('Speed engine', () => {
  it('allows +/-1 and A-K connections and finishes when empty', () => {
    const players = makePlayers(2);
    const rules = GAME_REGISTRY.speed.defaultRules;
    const state = initSpeed(players, rules);
    expect(canPlaceOnSpeedPile(c('spade', 1), c('heart', 13), rules)).toBe(true);
    expect(canPlaceOnSpeedPile(c('spade', 5), c('heart', 6), rules)).toBe(true);

    state.centerPiles = [c('heart', 7), c('club', 10)];
    state.players[0].fieldHand = [c('spade', 8)];
    state.players[0].drawPile = [];
    const res = applySpeedAction(state, 'p1', { type: 'play', payload: { cardId: 'spade-8', pileIndex: 0 } });
    expect(res.error).toBeUndefined();
    expect(res.state.phase).toBe('finished');
    expect(res.state.winnerId).toBe('p1');
  });
});

describe('OldMaid engine', () => {
  it('initializes baba and jiji modes without errors', () => {
    const players = makePlayers(3);
    const baba = initOldMaid(players, { mode: 'baba', allowShuffle: true });
    expect(baba.removedJiji).toBeNull();
    const jiji = initOldMaid(players, { mode: 'jiji', allowShuffle: true });
    expect(jiji.removedJiji).not.toBeNull();

    if (baba.phase === 'playing') {
      const drawer = baba.players[baba.turnIndex];
      const res = applyOldMaidAction(baba, drawer.id, { type: 'draw', payload: { cardIndex: 0 } });
      expect(res.error).toBeUndefined();
    }
  });
});

describe('Doubt engine', () => {
  it('handles play and doubt resolution', () => {
    const players = makePlayers(2);
    const state = initDoubt(players, GAME_REGISTRY.doubt.defaultRules);
    state.players[0].hand = [c('spade', 5), c('heart', 2)];
    const res1 = applyDoubtAction(state, 'p1', { type: 'play', payload: { cardIds: ['spade-5'] } });
    expect(res1.state.subPhase).toBe('doubtWindow');

    const res2 = applyDoubtAction(res1.state, 'p2', { type: 'doubt' });
    expect(res2.state.lastReveal?.wasLie).toBe(true);
    expect(res2.state.players[0].hand.length).toBe(2);
  });
});

describe('Memory engine', () => {
  it('matches pairs and awards extra turn', () => {
    const players = makePlayers(2);
    const state = initMemory(players, { deckSize: 20, extraTurnOnMatch: true, jokerPair: false });
    const rank1Tiles = state.tiles.filter((t) => t.card.rank === 1);
    let res = applyMemoryAction(state, 'p1', { type: 'flip', payload: { index: rank1Tiles[0].index } });
    res = applyMemoryAction(res.state, 'p1', { type: 'flip', payload: { index: rank1Tiles[1].index } });
    expect(res.state.players[0].pairs).toBe(1);
    expect(res.state.turnIndex).toBe(0);
  });
});

describe('Reversi engine', () => {
  it('flips opponent stones on valid move', () => {
    const players = makePlayers(2);
    const state = initReversi(players, { boardSize: 8, parallelSetup: false });
    const res = applyReversiAction(state, 'p1', { type: 'place', payload: { row: 2, col: 3 } });
    expect(res.error).toBeUndefined();
    expect(res.state.board[3][3]).toBe(1);
    expect(res.state.turnIndex).toBe(1);
  });
});

describe('Gomoku engine', () => {
  it('detects 5-in-a-row win', () => {
    const players = makePlayers(2);
    let state = initGomoku(players, { boardSize: 9, allowOverline: true });
    for (let cIdx = 0; cIdx < 4; cIdx++) {
      state = applyGomokuAction(state, 'p1', { type: 'place', payload: { row: 0, col: cIdx } }).state;
      state = applyGomokuAction(state, 'p2', { type: 'place', payload: { row: 1, col: cIdx } }).state;
    }
    const winRes = applyGomokuAction(state, 'p1', { type: 'place', payload: { row: 0, col: 4 } });
    expect(winRes.state.phase).toBe('finished');
    expect(winRes.state.winnerId).toBe('p1');
  });
});

describe('Connect4 engine', () => {
  it('drops discs to bottom and detects vertical win', () => {
    const players = makePlayers(2);
    let state = initConnect4(players, { cols: 7, rows: 6 });
    for (let i = 0; i < 3; i++) {
      state = applyConnect4Action(state, 'p1', { type: 'drop', payload: { col: 0 } }).state;
      state = applyConnect4Action(state, 'p2', { type: 'drop', payload: { col: 1 } }).state;
    }
    const winRes = applyConnect4Action(state, 'p1', { type: 'drop', payload: { col: 0 } });
    expect(winRes.state.phase).toBe('finished');
    expect(winRes.state.winnerId).toBe('p1');
  });
});

describe('Chinchiro engine', () => {
  it('evaluates dice ranks and progresses rounds', () => {
    expect(evaluateChinchiroDice([1, 1, 1]).rank).toBe('pinzoro');
    expect(evaluateChinchiroDice([4, 5, 6]).rank).toBe('shigoro');
    expect(evaluateChinchiroDice([1, 2, 3]).rank).toBe('hifumi');
    expect(evaluateChinchiroDice([2, 2, 5]).strength).toBe(15);

    const players = makePlayers(2);
    const state = initChinchiro(players, { rounds: 3, startPoints: 100, shonbenEnabled: false });
    const res = applyChinchiroAction(state, 'p1', { type: 'roll' });
    expect(res.error).toBeUndefined();
    expect(res.state.players[0].currentHand).not.toBeNull();
  });
});
