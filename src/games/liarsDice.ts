import type { LiarsDiceRules, PlayerInfo } from '../types/game';

export interface LiarsDiceBid {
  quantity: number;
  face: number; // 1..6
}

export interface LiarsDicePlayerState {
  id: string;
  name: string;
  isBot: boolean;
  diceCount: number; // remaining dice for next round (0 = eliminated)
  dice: number[]; // dice rolled for the current round (hidden for others during 'bidding')
  eliminated: boolean;
}

export interface LiarsDiceRevealInfo {
  challengerId: string;
  challengerName: string;
  bidderId: string;
  bidderName: string;
  bid: LiarsDiceBid;
  actualCount: number;
  challengeSucceeded: boolean;
  loserId: string;
  loserName: string;
  loserEliminated: boolean;
}

export interface LiarsDiceInternalState {
  rules: LiarsDiceRules;
  players: LiarsDicePlayerState[];
  round: number;
  subPhase: 'bidding' | 'reveal';
  turnIndex: number;
  currentBid: LiarsDiceBid | null;
  lastBidderIndex: number | null;
  revealInfo: LiarsDiceRevealInfo | null;
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface LiarsDiceClientState extends LiarsDiceInternalState {
  myId: string;
}

function rollDice(count: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(Math.floor(Math.random() * 6) + 1);
  }
  return result.sort((a, b) => a - b);
}

export function isDieMatchingFace(die: number, targetFace: number, onesWild: boolean): boolean {
  if (die === targetFace) return true;
  if (onesWild && targetFace !== 1 && die === 1) return true;
  return false;
}

export function countMatchingDice(
  players: LiarsDicePlayerState[],
  targetFace: number,
  onesWild: boolean
): number {
  let total = 0;
  for (const p of players) {
    for (const d of p.dice) {
      if (isDieMatchingFace(d, targetFace, onesWild)) {
        total += 1;
      }
    }
  }
  return total;
}

export function getTotalActiveDice(players: LiarsDicePlayerState[]): number {
  return players.reduce((acc, p) => acc + p.diceCount, 0);
}

export function isValidNextBid(
  currentBid: LiarsDiceBid | null,
  nextBid: LiarsDiceBid,
  maxQuantity: number
): boolean {
  if (!Number.isInteger(nextBid.quantity) || !Number.isInteger(nextBid.face)) return false;
  if (nextBid.face < 1 || nextBid.face > 6) return false;
  if (nextBid.quantity < 1 || nextBid.quantity > Math.max(1, maxQuantity)) return false;
  if (!currentBid) return true;
  if (nextBid.quantity > currentBid.quantity) return true;
  if (nextBid.quantity === currentBid.quantity && nextBid.face > currentBid.face) return true;
  return false;
}

function findNextAliveIndex(players: LiarsDicePlayerState[], fromIndex: number): number {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    if (!players[idx].eliminated && players[idx].diceCount > 0) {
      return idx;
    }
  }
  return fromIndex;
}

export function initLiarsDice(
  playersInfo: PlayerInfo[],
  rules: LiarsDiceRules
): LiarsDiceInternalState {
  const players: LiarsDicePlayerState[] = playersInfo.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    diceCount: rules.startDice,
    dice: rollDice(rules.startDice),
    eliminated: false,
  }));

  return {
    rules,
    players,
    round: 1,
    subPhase: 'bidding',
    turnIndex: 0,
    currentBid: null,
    lastBidderIndex: null,
    revealInfo: null,
    winnerId: null,
    phase: 'playing',
    lastLog: `第1ラウンド開始！ ${players[0]?.name ?? ''} から宣言してください`,
  };
}

export function applyLiarsDiceAction(
  state: LiarsDiceInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: LiarsDiceInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }

  if (action.type === 'nextRound') {
    if (state.subPhase !== 'reveal') {
      return { state, error: '現在は次のラウンドへ進めません' };
    }
    const alivePlayers = state.players.filter((p) => !p.eliminated && p.diceCount > 0);
    if (alivePlayers.length <= 1) {
      const winner = alivePlayers[0] ?? state.players[0];
      return {
        state: {
          ...state,
          winnerId: winner?.id ?? null,
          phase: 'finished',
          lastLog: `決着！ 勝者: ${winner?.name ?? ''}`,
        },
      };
    }

    const loserIdx = state.revealInfo
      ? state.players.findIndex((p) => p.id === state.revealInfo!.loserId)
      : state.turnIndex;

    const nextStarter =
      loserIdx >= 0 && !state.players[loserIdx].eliminated && state.players[loserIdx].diceCount > 0
        ? loserIdx
        : findNextAliveIndex(state.players, Math.max(0, loserIdx));

    const nextPlayers = state.players.map((p) => ({
      ...p,
      dice: p.eliminated || p.diceCount <= 0 ? [] : rollDice(p.diceCount),
    }));

    const nextRound = state.round + 1;
    return {
      state: {
        ...state,
        players: nextPlayers,
        round: nextRound,
        subPhase: 'bidding',
        turnIndex: nextStarter,
        currentBid: null,
        lastBidderIndex: null,
        revealInfo: null,
        lastLog: `第${nextRound}ラウンド開始！ ${nextPlayers[nextStarter].name} から宣言`,
      },
    };
  }

  if (state.subPhase !== 'bidding') {
    return { state, error: '結果確認中です。「次のラウンドへ」を押してください' };
  }

  const current = state.players[state.turnIndex];
  if (!current || current.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }

  if (action.type === 'bid') {
    const payload = action.payload as { quantity?: number; face?: number } | undefined;
    const quantity = payload?.quantity;
    const face = payload?.face;
    if (typeof quantity !== 'number' || typeof face !== 'number') {
      return { state, error: '宣言の内容が不正です' };
    }

    const totalDice = getTotalActiveDice(state.players);
    const nextBid: LiarsDiceBid = { quantity, face };
    if (!isValidNextBid(state.currentBid, nextBid, totalDice)) {
      return { state, error: '現在の宣言より強い宣言をしてください' };
    }

    const nextTurnIndex = findNextAliveIndex(state.players, state.turnIndex);
    const nextPlayer = state.players[nextTurnIndex];

    return {
      state: {
        ...state,
        currentBid: nextBid,
        lastBidderIndex: state.turnIndex,
        turnIndex: nextTurnIndex,
        lastLog: `${current.name} の宣言: 「${face}の目が ${quantity}個以上」 → 次は ${nextPlayer.name}`,
      },
    };
  }

  if (action.type === 'challenge') {
    if (!state.currentBid || state.lastBidderIndex === null) {
      return { state, error: '最初のプレイヤーはダウトできません' };
    }

    const bidder = state.players[state.lastBidderIndex];
    const bid = state.currentBid;
    const actualCount = countMatchingDice(state.players, bid.face, state.rules.onesWild);
    const challengeSucceeded = actualCount < bid.quantity;
    const loserIndex = challengeSucceeded ? state.lastBidderIndex : state.turnIndex;

    const nextPlayers = state.players.map((p, idx) => {
      if (idx !== loserIndex) return p;
      const nextCount = Math.max(0, p.diceCount - 1);
      return {
        ...p,
        diceCount: nextCount,
        eliminated: nextCount <= 0,
      };
    });

    const loser = nextPlayers[loserIndex];
    const revealInfo: LiarsDiceRevealInfo = {
      challengerId: current.id,
      challengerName: current.name,
      bidderId: bidder.id,
      bidderName: bidder.name,
      bid,
      actualCount,
      challengeSucceeded,
      loserId: loser.id,
      loserName: loser.name,
      loserEliminated: loser.eliminated,
    };

    const resultText = challengeSucceeded
      ? `ダウト成功！ 実際は ${actualCount}個 → ${loser.name} がダイス-1${loser.eliminated ? '（脱落）' : ''}`
      : `ダウト失敗！ 実際は ${actualCount}個 → ${loser.name} がダイス-1${loser.eliminated ? '（脱落）' : ''}`;

    return {
      state: {
        ...state,
        players: nextPlayers,
        subPhase: 'reveal',
        revealInfo,
        lastLog: `${current.name} がダウト！ ${resultText}`,
      },
    };
  }

  return { state, error: '不明なアクションです' };
}

function binomialTailProb(n: number, k: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let prob = 0;
  let comb = 1;
  for (let i = 0; i <= n; i++) {
    if (i > 0) {
      comb = (comb * (n - i + 1)) / i;
    }
    if (i >= k) {
      prob += comb * Math.pow(p, i) * Math.pow(1 - p, n - i);
    }
  }
  return prob;
}

export function computeLiarsDiceBotAction(
  state: LiarsDiceInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  if (state.subPhase !== 'bidding') return null;

  const bot = state.players[state.turnIndex];
  if (!bot || bot.eliminated) return null;

  const totalDice = getTotalActiveDice(state.players);
  const unknownDice = Math.max(0, totalDice - bot.dice.length);
  const onesWild = state.rules.onesWild;

  const myMatches = (face: number) =>
    bot.dice.filter((d) => isDieMatchingFace(d, face, onesWild)).length;

  const dieProb = (face: number) => (onesWild && face !== 1 ? 2 / 6 : 1 / 6);

  const bidProb = (qty: number, face: number) => {
    const needed = qty - myMatches(face);
    return binomialTailProb(unknownDice, needed, dieProb(face));
  };

  // Opening bid of the round
  if (!state.currentBid) {
    const candidateFaces = onesWild ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
    let bestFace = candidateFaces[0];
    let bestScore = -1;
    for (const f of candidateFaces) {
      const score = myMatches(f) + Math.random() * 0.6;
      if (score > bestScore) {
        bestScore = score;
        bestFace = f;
      }
    }
    const expected = myMatches(bestFace) + unknownDice * dieProb(bestFace);
    const qty = Math.max(1, Math.min(totalDice, Math.floor(expected * 0.8) || 1));
    return { type: 'bid', payload: { quantity: qty, face: bestFace } };
  }

  const cur = state.currentBid;

  // If current bid is already at maximum possible, must challenge
  if (cur.quantity >= totalDice && cur.face === 6) {
    return { type: 'challenge' };
  }

  const currentSuccessProb = bidProb(cur.quantity, cur.face);
  const challengeThreshold = 0.27 + (Math.random() - 0.5) * 0.1;

  if (currentSuccessProb < challengeThreshold) {
    return { type: 'challenge' };
  }

  // Evaluate candidate raises: same quantity with higher face, or quantity + 1 with any face
  let bestRaise: LiarsDiceBid | null = null;
  let bestRaiseProb = -1;

  for (let f = cur.face + 1; f <= 6; f++) {
    const p = bidProb(cur.quantity, f);
    if (p > bestRaiseProb) {
      bestRaiseProb = p;
      bestRaise = { quantity: cur.quantity, face: f };
    }
  }

  if (cur.quantity + 1 <= totalDice) {
    const faces = onesWild ? [2, 3, 4, 5, 6, 1] : [1, 2, 3, 4, 5, 6];
    for (const f of faces) {
      const p = bidProb(cur.quantity + 1, f);
      // Slight preference for lower face when probability is similar to keep room
      const adjusted = p - f * 0.004;
      if (adjusted > bestRaiseProb) {
        bestRaiseProb = p;
        bestRaise = { quantity: cur.quantity + 1, face: f };
      }
    }
  }

  if (!bestRaise || (bestRaiseProb < 0.22 && currentSuccessProb < 0.45)) {
    return { type: 'challenge' };
  }

  return { type: 'bid', payload: bestRaise };
}

export function sanitizeLiarsDiceState(
  state: LiarsDiceInternalState,
  playerId: string
): LiarsDiceClientState {
  const hideOthers = state.phase === 'playing' && state.subPhase === 'bidding';
  const players = state.players.map((p) => {
    if (!hideOthers || p.id === playerId) {
      return { ...p, dice: [...p.dice] };
    }
    return { ...p, dice: [] };
  });

  return {
    ...state,
    players,
    myId: playerId,
  };
}
