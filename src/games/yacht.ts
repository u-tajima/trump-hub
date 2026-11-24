import type { PlayerInfo, YachtRules } from '../types/game';

export type YachtCategory =
  | 'ones'
  | 'twos'
  | 'threes'
  | 'fours'
  | 'fives'
  | 'sixes'
  | 'choice'
  | 'fourOfAKind'
  | 'fullHouse'
  | 'smallStraight'
  | 'largeStraight'
  | 'yacht';

export const YACHT_UPPER_CATEGORIES: YachtCategory[] = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
];

export const YACHT_LOWER_CATEGORIES: YachtCategory[] = [
  'choice',
  'fourOfAKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'yacht',
];

export const YACHT_CATEGORIES: YachtCategory[] = [
  ...YACHT_UPPER_CATEGORIES,
  ...YACHT_LOWER_CATEGORIES,
];

export const YACHT_CATEGORY_LABELS: Record<YachtCategory, string> = {
  ones: 'エース (1)',
  twos: 'デュース (2)',
  threes: 'トレイ (3)',
  fours: 'フォー (4)',
  fives: 'ファイブ (5)',
  sixes: 'シックス (6)',
  choice: 'チョイス',
  fourOfAKind: 'フォーダイス',
  fullHouse: 'フルハウス',
  smallStraight: 'Sストレート',
  largeStraight: 'Lストレート',
  yacht: 'ヨット',
};

export const YACHT_UPPER_BONUS_POINTS = 35;

export interface YachtPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  scores: Partial<Record<YachtCategory, number>>;
  upperSum: number;
  bonus: number;
  total: number;
}

export interface YachtLastScored {
  playerId: string;
  category: YachtCategory;
  score: number;
}

export interface YachtInternalState {
  rules: YachtRules;
  players: YachtPlayerState[];
  round: number; // 1..12
  turnIndex: number;
  dice: number[]; // length 5, values 1..6
  held: boolean[]; // length 5
  rollsUsed: number; // 0..3
  rollSeq: number;
  lastScored: YachtLastScored | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface YachtClientState extends YachtInternalState {
  myId: string;
}

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function getFaceCounts(dice: number[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) {
    if (d >= 1 && d <= 6) counts[d] += 1;
  }
  return counts;
}

export function evaluateYachtCategory(dice: number[], category: YachtCategory): number {
  const counts = getFaceCounts(dice);
  const sum = dice.reduce((acc, d) => acc + d, 0);

  switch (category) {
    case 'ones':
      return counts[1] * 1;
    case 'twos':
      return counts[2] * 2;
    case 'threes':
      return counts[3] * 3;
    case 'fours':
      return counts[4] * 4;
    case 'fives':
      return counts[5] * 5;
    case 'sixes':
      return counts[6] * 6;
    case 'choice':
      return sum;
    case 'fourOfAKind': {
      for (let f = 1; f <= 6; f++) {
        if (counts[f] >= 4) return sum;
      }
      return 0;
    }
    case 'fullHouse': {
      let hasThree = false;
      let hasTwo = false;
      let hasFive = false;
      for (let f = 1; f <= 6; f++) {
        if (counts[f] === 5) hasFive = true;
        else if (counts[f] === 3) hasThree = true;
        else if (counts[f] === 2) hasTwo = true;
      }
      return hasFive || (hasThree && hasTwo) ? sum : 0;
    }
    case 'smallStraight': {
      const has = (n: number) => counts[n] >= 1;
      const ok =
        (has(1) && has(2) && has(3) && has(4)) ||
        (has(2) && has(3) && has(4) && has(5)) ||
        (has(3) && has(4) && has(5) && has(6));
      return ok ? 15 : 0;
    }
    case 'largeStraight': {
      const has = (n: number) => counts[n] >= 1;
      const ok =
        (has(1) && has(2) && has(3) && has(4) && has(5)) ||
        (has(2) && has(3) && has(4) && has(5) && has(6));
      return ok ? 30 : 0;
    }
    case 'yacht': {
      for (let f = 1; f <= 6; f++) {
        if (counts[f] === 5) return 50;
      }
      return 0;
    }
  }
}

export function calcYachtUpperSum(scores: Partial<Record<YachtCategory, number>>): number {
  let total = 0;
  for (const cat of YACHT_UPPER_CATEGORIES) {
    total += scores[cat] ?? 0;
  }
  return total;
}

export function calcYachtBonus(upperSum: number, bonusThreshold: number): number {
  return upperSum >= bonusThreshold ? YACHT_UPPER_BONUS_POINTS : 0;
}

export function calcYachtTotal(
  scores: Partial<Record<YachtCategory, number>>,
  bonusThreshold: number
): { upperSum: number; bonus: number; total: number } {
  const upperSum = calcYachtUpperSum(scores);
  const bonus = calcYachtBonus(upperSum, bonusThreshold);
  let lowerSum = 0;
  for (const cat of YACHT_LOWER_CATEGORIES) {
    lowerSum += scores[cat] ?? 0;
  }
  return {
    upperSum,
    bonus,
    total: upperSum + bonus + lowerSum,
  };
}

export function initYacht(playersInfo: PlayerInfo[], rules: YachtRules): YachtInternalState {
  const players: YachtPlayerState[] = playersInfo.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    scores: {},
    upperSum: 0,
    bonus: 0,
    total: 0,
  }));

  return {
    rules,
    players,
    round: 1,
    turnIndex: 0,
    dice: [1, 2, 3, 4, 5],
    held: [false, false, false, false, false],
    rollsUsed: 0,
    rollSeq: 0,
    lastScored: null,
    phase: 'playing',
    lastLog: `第1ラウンド開始！ ${players[0]?.name ?? ''} のターンです`,
  };
}

export function applyYachtAction(
  state: YachtInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: YachtInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }

  const current = state.players[state.turnIndex];
  if (!current || current.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }

  if (action.type === 'roll') {
    if (state.rollsUsed >= 3) {
      return { state, error: 'これ以上ロールできません。役を選択してください' };
    }

    const isFirstRoll = state.rollsUsed === 0;
    const nextHeld = isFirstRoll ? [false, false, false, false, false] : [...state.held];
    const nextDice = state.dice.map((d, idx) => (nextHeld[idx] ? d : rollDie()));
    const nextRollsUsed = state.rollsUsed + 1;

    return {
      state: {
        ...state,
        dice: nextDice,
        held: nextHeld,
        rollsUsed: nextRollsUsed,
        rollSeq: state.rollSeq + 1,
        lastLog: `${current.name} がダイスを振った (${nextRollsUsed}/3回目): [${nextDice.join('-')}]`,
      },
    };
  }

  if (action.type === 'toggleHold') {
    if (state.rollsUsed === 0) {
      return { state, error: '最初のロール前はホールドできません' };
    }
    if (state.rollsUsed >= 3) {
      return { state, error: '3回目ロール後はホールドを変更できません' };
    }
    const index = (action.payload as { index?: number } | undefined)?.index;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= 5) {
      return { state, error: 'ダイスの指定が不正です' };
    }
    const nextHeld = state.held.map((h, i) => (i === index ? !h : h));
    return {
      state: {
        ...state,
        held: nextHeld,
      },
    };
  }

  if (action.type === 'selectCategory') {
    if (state.rollsUsed === 0) {
      return { state, error: '先にサイコロを振ってください' };
    }
    const category = (action.payload as { category?: YachtCategory } | undefined)?.category;
    if (!category || !YACHT_CATEGORIES.includes(category)) {
      return { state, error: '無効なカテゴリです' };
    }
    if (current.scores[category] !== undefined) {
      return { state, error: 'そのカテゴリはすでに埋まっています' };
    }

    const score = evaluateYachtCategory(state.dice, category);
    const nextScores: Partial<Record<YachtCategory, number>> = {
      ...current.scores,
      [category]: score,
    };
    const { upperSum, bonus, total } = calcYachtTotal(nextScores, state.rules.bonusThreshold);

    const nextPlayers = state.players.map((p, idx) =>
      idx === state.turnIndex
        ? { ...p, scores: nextScores, upperSum, bonus, total }
        : p
    );

    const allDone = nextPlayers.every((p) =>
      YACHT_CATEGORIES.every((cat) => p.scores[cat] !== undefined)
    );

    const label = YACHT_CATEGORY_LABELS[category];
    const lastScored: YachtLastScored = {
      playerId: current.id,
      category,
      score,
    };

    if (allDone) {
      const ranked = [...nextPlayers].sort((a, b) => b.total - a.total);
      let finishLog: string;
      if (nextPlayers.length === 1) {
        finishLog = `ゲーム終了！スコア: ${ranked[0].total}点`;
      } else {
        const topScore = ranked[0].total;
        const winners = ranked.filter((p) => p.total === topScore);
        if (winners.length > 1) {
          finishLog = `全12ラウンド終了！ 同点優勝: ${winners.map((w) => w.name).join('・')} (${topScore}点)`;
        } else {
          finishLog = `全12ラウンド終了！ 優勝: ${winners[0].name} (${topScore}点)`;
        }
      }
      return {
        state: {
          ...state,
          players: nextPlayers,
          lastScored,
          phase: 'finished',
          lastLog: finishLog,
        },
      };
    }

    const nextTurnIndex = (state.turnIndex + 1) % nextPlayers.length;
    const nextRound = nextTurnIndex === 0 ? state.round + 1 : state.round;
    const nextPlayer = nextPlayers[nextTurnIndex];

    return {
      state: {
        ...state,
        players: nextPlayers,
        round: nextRound,
        turnIndex: nextTurnIndex,
        held: [false, false, false, false, false],
        rollsUsed: 0,
        lastScored,
        lastLog: `${current.name} が「${label}」で ${score}点 獲得！ 次は ${nextPlayer.name}`,
      },
    };
  }

  return { state, error: '不明なアクションです' };
}

function getUpperCategoryForFace(face: number): YachtCategory {
  return YACHT_UPPER_CATEGORIES[face - 1];
}

function computeBestCategoryToScore(
  dice: number[],
  player: YachtPlayerState,
  bonusThreshold: number
): YachtCategory {
  const openCategories = YACHT_CATEGORIES.filter((cat) => player.scores[cat] === undefined);
  let bestCat = openCategories[0];
  let bestVal = -Infinity;

  const filledUpperCount = YACHT_UPPER_CATEGORIES.filter(
    (c) => player.scores[c] !== undefined
  ).length;
  const bonusStillPossible =
    player.bonus === 0 && filledUpperCount < 6;

  // Opportunity cost of burning a category for 0 or low score
  const baselineValue: Record<YachtCategory, number> = {
    ones: 3,
    twos: 6,
    threes: 9,
    fours: 12,
    fives: 15,
    sixes: 18,
    choice: 20,
    fourOfAKind: 18,
    fullHouse: 19,
    smallStraight: 13,
    largeStraight: 20,
    yacht: 16,
  };

  for (const cat of openCategories) {
    const score = evaluateYachtCategory(dice, cat);
    let value = score - baselineValue[cat] * 0.55;

    // Strong reward for hitting yacht or large straight
    if (cat === 'yacht' && score === 50) value += 40;
    if (cat === 'largeStraight' && score === 30) value += 22;
    if (cat === 'smallStraight' && score === 15) value += 8;
    if (cat === 'fullHouse' && score >= 20) value += 8;

    // Upper section bonus progress valuation
    const upperIdx = YACHT_UPPER_CATEGORIES.indexOf(cat);
    if (upperIdx >= 0 && bonusStillPossible) {
      const face = upperIdx + 1;
      const newUpper = player.upperSum + score;
      if (newUpper >= bonusThreshold) {
        value += YACHT_UPPER_BONUS_POINTS;
      } else if (score >= face * 3) {
        value += 7 + (score - face * 3) * 1.2;
      }
    }

    // Avoid wasting Choice on a weak roll if other low-cost dumps exist
    if (cat === 'choice' && score < 18) {
      value -= 8;
    }

    if (value > bestVal) {
      bestVal = value;
      bestCat = cat;
    }
  }

  return bestCat;
}

function computeDesiredHold(dice: number[], player: YachtPlayerState): boolean[] {
  const counts = getFaceCounts(dice);
  const open = (cat: YachtCategory) => player.scores[cat] === undefined;

  // Find face with highest count (tie-break: higher face)
  let maxFace = 1;
  let maxCount = 0;
  for (let f = 1; f <= 6; f++) {
    if (counts[f] > maxCount || (counts[f] === maxCount && f > maxFace)) {
      maxCount = counts[f];
      maxFace = f;
    }
  }

  // 5 of a kind -> keep all
  if (maxCount === 5) {
    return [true, true, true, true, true];
  }

  // 4 of a kind -> keep those 4 (hunt for Yacht or 4-of-a-kind / upper)
  if (maxCount === 4) {
    return dice.map((d) => d === maxFace);
  }

  // Full house (3 + 2)
  const hasPair = counts.some((c) => c === 2);
  if (maxCount === 3 && hasPair) {
    if (open('fullHouse')) {
      return [true, true, true, true, true];
    }
    return dice.map((d) => d === maxFace);
  }

  // Straight check: 4 unique dice inside a 5-straight window when large/small straight is open
  if (open('largeStraight') || open('smallStraight')) {
    const windows = [
      [1, 2, 3, 4, 5],
      [2, 3, 4, 5, 6],
    ];
    for (const w of windows) {
      const matched = w.filter((n) => counts[n] >= 1);
      if (matched.length === 5) {
        return [true, true, true, true, true];
      }
      if (matched.length === 4) {
        const seen = new Set<number>();
        return dice.map((d) => {
          if (w.includes(d) && !seen.has(d)) {
            seen.add(d);
            return true;
          }
          return false;
        });
      }
    }
  }

  // 3 of a kind -> keep the triple
  if (maxCount === 3) {
    return dice.map((d) => d === maxFace);
  }

  // Two pairs -> if fullHouse is open, hold both pairs
  const pairs: number[] = [];
  for (let f = 6; f >= 1; f--) {
    if (counts[f] === 2) pairs.push(f);
  }
  if (pairs.length === 2) {
    if (open('fullHouse')) {
      return dice.map((d) => d === pairs[0] || d === pairs[1]);
    }
    // Otherwise hold the better pair (prefer open upper category or higher face)
    const target = open(getUpperCategoryForFace(pairs[0])) ? pairs[0] : pairs[1];
    return dice.map((d) => d === target);
  }

  // Single pair -> hold the pair (unless straight is strongly favored)
  if (pairs.length === 1) {
    const pairFace = pairs[0];
    if (
      pairFace <= 2 &&
      (open('smallStraight') || open('largeStraight')) &&
      [2, 3, 4, 5].filter((n) => counts[n] >= 1).length >= 3
    ) {
      const seen = new Set<number>();
      return dice.map((d) => {
        if (d >= 2 && d <= 5 && !seen.has(d)) {
          seen.add(d);
          return true;
        }
        return false;
      });
    }
    return dice.map((d) => d === pairFace);
  }

  // No pairs (5 distinct dice, not a 4-straight): check 3-in-a-row for straights
  if (open('smallStraight') || open('largeStraight')) {
    const mid = [2, 3, 4, 5];
    if (mid.filter((n) => counts[n] >= 1).length >= 3) {
      return dice.map((d) => d >= 2 && d <= 5);
    }
  }

  // Fallback: hold 6s or 5s if present
  return dice.map((d) => d >= 5);
}

export function computeYachtBotAction(
  state: YachtInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  const bot = state.players[state.turnIndex];
  if (!bot) return null;

  // Must roll first
  if (state.rollsUsed === 0) {
    return { type: 'roll' };
  }

  // After 3rd roll, must select a category
  if (state.rollsUsed >= 3) {
    const category = computeBestCategoryToScore(state.dice, bot, state.rules.bonusThreshold);
    return { type: 'selectCategory', payload: { category } };
  }

  // Early lock-in for top-tier hands
  const open = (cat: YachtCategory) => bot.scores[cat] === undefined;
  if (open('yacht') && evaluateYachtCategory(state.dice, 'yacht') === 50) {
    return { type: 'selectCategory', payload: { category: 'yacht' } };
  }
  if (open('largeStraight') && evaluateYachtCategory(state.dice, 'largeStraight') === 30) {
    return { type: 'selectCategory', payload: { category: 'largeStraight' } };
  }
  if (open('fullHouse') && evaluateYachtCategory(state.dice, 'fullHouse') >= 22) {
    return { type: 'selectCategory', payload: { category: 'fullHouse' } };
  }

  const desiredHold = computeDesiredHold(state.dice, bot);

  // If all 5 dice are desired to be held, just score right away
  if (desiredHold.every(Boolean)) {
    const category = computeBestCategoryToScore(state.dice, bot, state.rules.bonusThreshold);
    return { type: 'selectCategory', payload: { category } };
  }

  // Toggle first mismatched hold slot so UI reflects hold choices cleanly
  for (let i = 0; i < 5; i++) {
    if (state.held[i] !== desiredHold[i]) {
      return { type: 'toggleHold', payload: { index: i } };
    }
  }

  return { type: 'roll' };
}

export function sanitizeYachtState(
  state: YachtInternalState,
  playerId: string
): YachtClientState {
  return {
    ...state,
    myId: playerId,
  };
}
