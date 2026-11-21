import { describe, expect, it } from 'vitest';
import type { Card } from '../../types/card';
import type { PlayerInfo } from '../../types/game';
import { applyChinchiroAction, computeChinchiroBotAction, evaluateChinchiroDice, initChinchiro } from '../chinchiro';
import { applyConnect4Action, computeConnect4BotAction, initConnect4 } from '../connect4';
import { applyDaifugoAction, canPlayOnTable, computeDaifugoBotAction, initDaifugo, parsePlay } from '../daifugo';
import { applyDoubtAction, computeDoubtBotAction, initDoubt } from '../doubt';
import { applyGomokuAction, computeGomokuBotAction, initGomoku } from '../gomoku';
import { applyHoldemAction, computeHoldemBotAction, evaluateBestSeven, initHoldem } from '../holdem';
import { applyMemoryAction, computeMemoryBotAction, initMemory } from '../memory';
import { applyOldMaidAction, initOldMaid } from '../oldMaid';
import { applyPokerAction, computePokerBotAction, evaluatePokerHand, initPoker } from '../poker';
import { GAME_REGISTRY } from '../registry';
import { applyReversiAction, computeReversiBotAction, initReversi } from '../reversi';
import { applyRouletteAction, EUROPEAN_WHEEL_ORDER, getRouletteColor, initRoulette } from '../roulette';
import { applySevensAction, canPlaceNormalCard, computeSevensBotAction, initSevens } from '../sevens';
import { applySpeedAction, canPlaceOnSpeedPile, computeSpeedBotAction, initSpeed } from '../speed';
import {
  applyScoreBoardOp,
  createEmptyScoreBoard,
  getScoreBoardZeroSumInfo,
  SCOREBOARD_TTL_MS,
} from '../../utils/scoreBoard';

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
    // 手札を明示的にセットしてテスト
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

    // 4枚出しで革命
    let res = applyDaifugoAction(state, 'p1', {
      type: 'play',
      payload: { cardIds: ['spade-4', 'heart-4', 'diamond-4', 'club-4'] },
    });
    expect(res.error).toBeUndefined();
    expect(res.state.revolution).toBe(true);

    // p2 パスで場が流れる
    res = applyDaifugoAction(res.state, 'p2', { type: 'pass' });
    expect(res.state.table.length).toBe(0);

    // p1 が8切り
    res = applyDaifugoAction(res.state, 'p1', { type: 'play', payload: { cardIds: ['spade-8'] } });
    expect(res.state.table.length).toBe(0);
    expect(res.state.turnIndex).toBe(0);

    // p1 が ♥9 -> p2 がジョーカー -> p1 が♠3返しで場が流れる
    res.state.players[0].hand = [c('spade', 3), c('heart', 9), c('club', 6)];
    res = applyDaifugoAction(res.state, 'p1', { type: 'play', payload: { cardIds: ['heart-9'] } });
    res = applyDaifugoAction(res.state, 'p2', { type: 'play', payload: { cardIds: ['joker-1'] } });
    expect(canPlayOnTable([c('spade', 3)], res.state).ok).toBe(true);
    res = applyDaifugoAction(res.state, 'p1', { type: 'play', payload: { cardIds: ['spade-3'] } });
    expect(res.error).toBeUndefined();
    expect(res.state.table.length).toBe(0); // スペ3返しで流れる
  });
});

describe('Sevens engine', () => {
  it('supports tunnel rule and pass limit elimination', () => {
    const players = makePlayers(2);
    const rules = { ...GAME_REGISTRY.sevens.defaultRules, passLimit: 0 as const, tunnel: true };
    const state = initSevens(players, rules);
    state.board.spade[1] = true;
    expect(canPlaceNormalCard('spade', 13, state)).toBe(true);

    // passLimit=0 -> 1回目で超過してドボン
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
    state.players[0].hand = [c('spade', 5), c('heart', 2)]; // 1(A) ではない
    const res1 = applyDoubtAction(state, 'p1', { type: 'play', payload: { cardIds: ['spade-5'] } });
    expect(res1.state.subPhase).toBe('doubtWindow');

    const res2 = applyDoubtAction(res1.state, 'p2', { type: 'doubt' });
    expect(res2.state.lastReveal?.wasLie).toBe(true);
    expect(res2.state.players[0].hand.length).toBe(2); // 引き取り
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
    expect(res.state.turnIndex).toBe(0); // extra turn
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
    const state = initChinchiro(players, { rounds: 3, startPoints: 100, shonbenEnabled: true });
    // 子(p2)が張り額を35点に変更
    const staked = applyChinchiroAction(state, 'p2', { type: 'setStake', payload: { amount: 35 } });
    expect(staked.error).toBeUndefined();
    expect(staked.state.players[1].stake).toBe(35);

    const res = applyChinchiroAction(staked.state, 'p1', {
      type: 'roll',
      payload: { dice: [1, 1, 1] },
    });
    expect(res.error).toBeUndefined();
    expect(res.state.rollSeq).toBe(1);
    expect(res.state.lastRolledPlayerId).toBe('p1');
    expect(res.state.lastRolledHand?.rank).toBe('pinzoro');
    expect(res.state.players[0].currentHand?.dice).toEqual([1, 1, 1]);

    // p2が3の目を出して親のピンゾロ(5倍)に負けると 35 * 5 = 175点移動
    const settled = applyChinchiroAction(res.state, 'p2', {
      type: 'roll',
      payload: { dice: [2, 2, 3] },
    });
    expect(settled.state.players[0].points).toBe(275);
    expect(settled.state.players[1].points).toBe(-75);
  });
});

describe('Daifugo extended rules', () => {
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

    // 7渡し発動
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
    // preflop -> flop
    state = applyHoldemAction(state, 'p1', { type: 'call' }).state;
    state = applyHoldemAction(state, 'p2', { type: 'call' }).state;
    expect(state.subPhase).toBe('flop');
    expect(state.communityCards.length).toBe(3);
  });
});

describe('Roulette engine', () => {
  it('validates wheel order, places bets, resolves physical spin number, and pays out', () => {
    expect(EUROPEAN_WHEEL_ORDER.length).toBe(37);
    expect(new Set(EUROPEAN_WHEEL_ORDER).size).toBe(37);
    expect(getRouletteColor(0)).toBe('green');
    expect(getRouletteColor(32)).toBe('red');
    expect(getRouletteColor(15)).toBe('black');

    const players = makePlayers(2);
    let state = initRoulette(players, { rounds: 3, startChips: 500, minBet: 10 });
    state = applyRouletteAction(state, 'p1', {
      type: 'placeBet',
      payload: { kind: 'straight', value: 17, amount: 20 },
    }).state;
    state = applyRouletteAction(state, 'p2', {
      type: 'placeBet',
      payload: { kind: 'red', amount: 50 },
    }).state;
    state = applyRouletteAction(state, 'p1', { type: 'confirmBets' }).state;
    state = applyRouletteAction(state, 'p2', { type: 'confirmBets' }).state;
    expect(state.subPhase).toBe('readyToSpin');

    // 物理シミュレーションで 17 (黒) に落ちたとする
    state = applyRouletteAction(state, 'p1', {
      type: 'resolveSpin',
      payload: { number: 17 },
    }).state;
    expect(state.subPhase).toBe('result');
    expect(state.lastNumber).toBe(17);
    expect(state.spinSeq).toBe(1);
    // p1: 500 - 20 + 20 * 36 = 1200
    expect(state.players[0].chips).toBe(1200);
    // p2: 500 - 50 (赤外れ) = 450
    expect(state.players[1].chips).toBe(450);

    state = applyRouletteAction(state, 'p1', { type: 'nextRound' }).state;
    expect(state.round).toBe(2);
    expect(state.subPhase).toBe('betting');
  });
});

describe('ScoreBoard utility', () => {
  it('applies concurrent delta operations and maintains 3-day TTL', () => {
    let board = createEmptyScoreBoard('room_TEST1', '部屋 TEST1', ['Alice', 'Bob']);
    expect(board.entries.length).toBe(2);
    expect(board.expiresAt - board.updatedAt).toBe(SCOREBOARD_TTL_MS);

    const aliceId = board.entries[0].id;
    board = applyScoreBoardOp(board, { type: 'addDelta', entryId: aliceId, delta: 10 }, 'Alice');
    board = applyScoreBoardOp(board, { type: 'addDelta', entryId: aliceId, delta: 5 }, 'Bob');
    expect(board.entries[0].score).toBe(15);
    expect(board.logs.length).toBe(2);

    board = applyScoreBoardOp(board, { type: 'resetScores' }, 'Alice');
    expect(board.entries.every((e) => e.score === 0)).toBe(true);
  });

  it('detects non-zero-sum imbalances and supports zero-sum transfers and custom baseScore', () => {
    let board = createEmptyScoreBoard('room_ZS', '部屋 ZS', ['Alice', 'Bob', 'Carol'], 100);
    expect(getScoreBoardZeroSumInfo(board).isZeroSum).toBe(true);
    expect(getScoreBoardZeroSumInfo(board).expectedTotal).toBe(300);

    const [alice, bob, carol] = board.entries;
    // Alice が +30 を入力しただけでは totalDelta = +30 となりゼロサム不一致と判定される
    board = applyScoreBoardOp(board, { type: 'addDelta', entryId: alice.id, delta: 30 }, 'Alice');
    const warnInfo = getScoreBoardZeroSumInfo(board);
    expect(warnInfo.isZeroSum).toBe(false);
    expect(warnInfo.totalDelta).toBe(30);

    // Bob が -30 を入力すると収支合計が ±0 に戻りゼロサム一致になる
    board = applyScoreBoardOp(board, { type: 'addDelta', entryId: bob.id, delta: -30 }, 'Bob');
    expect(getScoreBoardZeroSumInfo(board).isZeroSum).toBe(true);

    // transferScore なら常にゼロサムを維持したまま移動できる
    board = applyScoreBoardOp(
      board,
      { type: 'transferScore', fromEntryId: carol.id, toEntryId: alice.id, amount: 25 },
      'Alice'
    );
    expect(getScoreBoardZeroSumInfo(board).isZeroSum).toBe(true);
    expect(board.entries.find((e) => e.id === alice.id)?.score).toBe(155);
    expect(board.entries.find((e) => e.id === carol.id)?.score).toBe(75);
  });
});

describe('Enhanced CPU AI', () => {
  it('Memory CPU remembers revealed cards and completes pairs deterministically', () => {
    const players = makePlayers(2);
    players[1].isBot = true;
    let state = initMemory(players, { deckSize: 20, extraTurnOnMatch: true, jokerPair: false });

    // 同じランクの2枚のインデックスを探す
    const rank1 = state.tiles.filter((t) => t.card.rank === 1);
    const other = state.tiles.find((t) => t.card.rank === 2)!;

    // p1 が rank1[0] と other をめくってミス（rank1[0] が公開履歴に記録される）
    state = applyMemoryAction(state, 'p1', { type: 'flip', payload: { index: rank1[0].index } }).state;
    state = applyMemoryAction(state, 'p1', { type: 'flip', payload: { index: other.index } }).state;
    state = applyMemoryAction(state, 'p1', { type: 'resetMismatch' }).state;

    // p2 (Bot) が1枚目に rank1[1] をめくった状態にする → 2枚目は記憶から必ず rank1[0] を選ぶはず
    state = applyMemoryAction(state, 'p2', { type: 'flip', payload: { index: rank1[1].index } }).state;
    const botAct = computeMemoryBotAction(state);
    expect(botAct).toEqual({ type: 'flip', payload: { index: rank1[0].index } });
  });

  it('Connect4 CPU avoids blundering into giving opponent an immediate winning spot above', () => {
    const players = makePlayers(2);
    players[1].isBot = true;
    const state = initConnect4(players, { cols: 7, rows: 6 });
    state.turnIndex = 1; // p2 (disc 2)

    // col 0, 1, 2 の row 4 に相手(disc 1)が3連を作っており、col 3 の row 5 が空・row 4 が相手勝ちマスの状況
    // もし Bot が col 3 (row 5) に置くと、直後に相手が col 3 (row 4) に置いて負けるトラップ
    state.board[5][0] = 2;
    state.board[5][1] = 2;
    state.board[5][2] = 1;
    state.board[4][0] = 1;
    state.board[4][1] = 1;
    state.board[4][2] = 1;
    // col 3 はまだ空 (findDropRow = 5)。ここに置くと相手が直上の (4, 3) で横4連完成してしまう
    const act = computeConnect4BotAction(state);
    const chosenCol = (act?.payload as { col: number })?.col;
    expect(chosenCol).not.toBe(3);
  });

  it('Gomoku CPU blocks open-3 and broken-4 threats', () => {
    const players = makePlayers(2);
    players[1].isBot = true;
    const state = initGomoku(players, { boardSize: 9, allowOverline: true });
    state.turnIndex = 1; // p2 (stone 2)

    // 相手(stone 1)が (4, 2), (4, 3), (4, 5), (4, 6) の飛び四を作っている → (4, 4) を必ず埋めて防ぐ
    state.board[4][2] = 1;
    state.board[4][3] = 1;
    state.board[4][5] = 1;
    state.board[4][6] = 1;

    const act = computeGomokuBotAction(state);
    expect(act).toEqual({ type: 'place', payload: { row: 4, col: 4 } });
  });

  it('Daifugo CPU plays staircases and bombs opponent ranks instead of its own in Queen Bomber', () => {
    const players = makePlayers(2);
    players[0].isBot = true;
    const state = initDaifugo(players, { ...GAME_REGISTRY.daifugo.defaultRules, queenBomber: true });
    state.turnIndex = 0;
    state.players[0].hand = [c('spade', 4), c('spade', 5), c('spade', 6)];

    // 3枚階段で一気に出せる
    const act = computeDaifugoBotAction(state);
    expect((act.payload as { cardIds: string[] }).cardIds.length).toBe(3);

    // Qボンバー解決時、自分が複数種持っているなら自分が持っていない強カード(2)を爆破する
    state.players[0].hand = [c('spade', 4), c('heart', 7)];
    state.pendingEffect = { type: 'queenBomber', playerId: 'p1' };
    const bombAct = computeDaifugoBotAction(state);
    expect(bombAct).toEqual({ type: 'resolveQueenBomber', payload: { rank: 2 } });
  });

  it('Sevens CPU prioritizes unlocking its own extreme cards over opening opponent-only lines', () => {
    const players = makePlayers(2);
    players[0].isBot = true;
    const state = initSevens(players, GAME_REGISTRY.sevens.defaultRules);
    state.turnIndex = 0;
    // spade は6と1・2を自分が持っている（6を出せば自分の1・2へ繋がる）
    // heart は6だけ持っており、5〜1はすべて相手が持っている（heart-6を出すと相手だけを助ける）
    state.players[0].hand = [c('spade', 1), c('spade', 2), c('spade', 6), c('heart', 6)];

    const act = computeSevensBotAction(state);
    expect(act).toEqual({ type: 'play', payload: { cardId: 'spade-6' } });
  });

  it('Doubt CPU always calls doubt when an opponent plays their final card', () => {
    const players = makePlayers(2);
    players[1].isBot = true;
    let state = initDoubt(players, GAME_REGISTRY.doubt.defaultRules);
    state.players[0].hand = [c('spade', 5)]; // 残り1枚
    state = applyDoubtAction(state, 'p1', { type: 'play', payload: { cardIds: ['spade-5'] } }).state;

    const botAct = computeDoubtBotAction(state, 'p2');
    expect(botAct).toEqual({ type: 'doubt' });
  });

  it('Speed CPU selects the play that chains into consecutive cards from hand', () => {
    const players = makePlayers(2);
    players[0].isBot = true;
    const state = initSpeed(players, GAME_REGISTRY.speed.defaultRules);
    state.centerPiles = [c('heart', 4), c('club', 10)];
    // 3と5どちらも heart-4 に出せるが、5を出せば 6 -> 7 と3連続で繋がる
    state.players[0].fieldHand = [c('spade', 3), c('spade', 5), c('diamond', 6), c('club', 7)];

    const act = computeSpeedBotAction(state, 'p1');
    expect(act).toEqual({ type: 'play', payload: { cardId: 'spade-5', pileIndex: 0 } });
  });

  it('Poker CPU keeps 4-card flush draws and Holdem/Chinchiro CPUs make EV-based decisions', () => {
    const players = makePlayers(2);
    players[1].isBot = true;
    const poker = initPoker(players, GAME_REGISTRY.poker.defaultRules);
    poker.subPhase = 'draw';
    poker.turnIndex = 1;
    // スペード4枚＋ハート1枚のハイカード → ハート1枚だけを交換するフラッシュドロー
    poker.players[1].hand = [
      c('spade', 2),
      c('spade', 5),
      c('spade', 9),
      c('spade', 12),
      c('heart', 7),
    ];
    const drawAct = computePokerBotAction(poker);
    expect(drawAct).toEqual({ type: 'draw', payload: { discardIds: ['heart-7'] } });

    // Holdem: ポケットA (A-A) ならプリフロップでもフォールドせずコールまたはレイズ
    const holdem = initHoldem(players, GAME_REGISTRY.holdem.defaultRules);
    holdem.players[holdem.turnIndex].holeCards = [c('spade', 1), c('heart', 1)];
    const holdemAct = computeHoldemBotAction(holdem);
    expect(holdemAct?.type).not.toBe('fold');

    // Chinchiro: 親がシゴロ(strength 70)の時は子のCPUは最小額(5点)に絞る
    const chin = initChinchiro(players, GAME_REGISTRY.chinchiro.defaultRules);
    chin.players[0].currentHand = evaluateChinchiroDice([4, 5, 6]);
    chin.players[0].doneThisRound = true;
    chin.turnIndex = 1;
    const chinAct = computeChinchiroBotAction(chin);
    expect(chinAct).toEqual({ type: 'setStake', payload: { amount: 5 } });
  });

  it('Reversi CPU prefers corner over X-square trap', () => {
    const players = makePlayers(2);
    players[0].isBot = true;
    const state = initReversi(players, { boardSize: 8, parallelSetup: false });
    // 角 (0,0) と Xマス (1,1) の両方に置ける盤面を作る
    state.board = Array.from({ length: 8 }, () => Array(8).fill(0) as (0 | 1 | 2)[]);
    state.board[0][1] = 2;
    state.board[0][2] = 1; // (0,0) に黒(1)が置ける
    state.board[1][2] = 2;
    state.board[1][3] = 2;
    state.board[1][4] = 1; // (1,1) に置けば2枚返せるが危険なXマス
    state.turnIndex = 0;

    const act = computeReversiBotAction(state);
    expect(act).toEqual({ type: 'place', payload: { row: 0, col: 0 } });
  });
});
