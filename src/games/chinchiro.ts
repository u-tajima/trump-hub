import type { ChinchiroRules, PlayerInfo } from '../types/game';

export type ChinchiroRank =
  | 'pinzoro'   // 1-1-1 (5x)
  | 'arashi'    // 2-2-2 .. 6-6-6 (3x)
  | 'shigoro'   // 4-5-6 (2x)
  | 'normal'    // pair + single (1x)
  | 'menashi'   // no pair (lose 1x)
  | 'shonben'   // out of bowl (lose 1x)
  | 'hifumi';   // 1-2-3 (lose 2x)

export interface ChinchiroHand {
  dice: [number, number, number];
  rank: ChinchiroRank;
  strength: number; // higher is stronger
  multiplier: number;
  label: string;
}

export interface ChinchiroPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  points: number;
  stake: number;        // 子の張り額（賭け点）
  stakeSet: boolean;    // この局で張り額を調整済みか（CPU用）
  rollsLeft: number;
  currentHand: ChinchiroHand | null;
  doneThisRound: boolean;
  lastDelta: number;
}

export interface ChinchiroInternalState {
  rules: ChinchiroRules;
  players: ChinchiroPlayerState[];
  round: number;
  dealerIndex: number;
  turnIndex: number;
  rollSeq: number;
  lastRolledPlayerId: string | null;
  lastRolledHand: ChinchiroHand | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface ChinchiroClientState extends ChinchiroInternalState {
  myId: string;
}

export function evaluateChinchiroDice(
  dice: [number, number, number],
  isShonben = false
): ChinchiroHand {
  if (isShonben) {
    return { dice, rank: 'shonben', strength: -1, multiplier: 1, label: 'ションベン' };
  }
  const sorted = [...dice].sort((a, b) => a - b) as [number, number, number];
  const [a, b, c] = sorted;

  if (a === 1 && b === 1 && c === 1) {
    return { dice: sorted, rank: 'pinzoro', strength: 100, multiplier: 5, label: 'ピンゾロ (5倍)' };
  }
  if (a === b && b === c) {
    return { dice: sorted, rank: 'arashi', strength: 80 + a, multiplier: 3, label: `アラシ ${a} (3倍)` };
  }
  if (a === 4 && b === 5 && c === 6) {
    return { dice: sorted, rank: 'shigoro', strength: 70, multiplier: 2, label: 'シゴロ (2倍)' };
  }
  if (a === 1 && b === 2 && c === 3) {
    return { dice: sorted, rank: 'hifumi', strength: -20, multiplier: 2, label: 'ヒフミ (2倍払)' };
  }
  if (a === b) {
    return { dice: sorted, rank: 'normal', strength: 10 + c, multiplier: 1, label: `${c} の目` };
  }
  if (b === c) {
    return { dice: sorted, rank: 'normal', strength: 10 + a, multiplier: 1, label: `${a} の目` };
  }
  return { dice: sorted, rank: 'menashi', strength: 0, multiplier: 1, label: '目なし' };
}

export function initChinchiro(playersInfo: PlayerInfo[], rules: ChinchiroRules): ChinchiroInternalState {
  const defaultStake = Math.min(10, rules.startPoints);
  const players: ChinchiroPlayerState[] = playersInfo.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    points: rules.startPoints,
    stake: defaultStake,
    stakeSet: false,
    rollsLeft: 3,
    currentHand: null,
    doneThisRound: false,
    lastDelta: 0,
  }));

  return {
    rules,
    players,
    round: 1,
    dealerIndex: 0,
    turnIndex: 0,
    rollSeq: 0,
    lastRolledPlayerId: null,
    lastRolledHand: null,
    phase: 'playing',
    lastLog: `第1局スタート！親は ${players[0].name} です`,
  };
}

export function getChinchiroMaxStake(points: number): number {
  return Math.max(10, Math.floor(points));
}

function settleRound(state: ChinchiroInternalState): ChinchiroInternalState {
  const players = state.players.map((p) => ({ ...p, lastDelta: 0 }));
  const dealer = players[state.dealerIndex];
  const dHand = dealer.currentHand!;

  for (let i = 0; i < players.length; i++) {
    if (i === state.dealerIndex) continue;
    const child = players[i];
    const cHand = child.currentHand!;
    const stake = Math.max(5, child.stake);

    if (cHand.strength > dHand.strength) {
      const amt = stake * cHand.multiplier;
      child.points += amt;
      child.lastDelta += amt;
      dealer.points -= amt;
      dealer.lastDelta -= amt;
    } else if (cHand.strength < dHand.strength) {
      const amt = stake * Math.max(dHand.multiplier, cHand.rank === 'hifumi' ? 2 : 1);
      child.points -= amt;
      child.lastDelta -= amt;
      dealer.points += amt;
      dealer.lastDelta += amt;
    }
  }

  if (state.round >= state.rules.rounds) {
    const sorted = [...players].sort((a, b) => b.points - a.points);
    return {
      ...state,
      players,
      phase: 'finished',
      lastLog: `全${state.rules.rounds}局終了！ 1位: ${sorted[0].name} (${sorted[0].points}点)`,
    };
  }

  const nextDealer = (state.dealerIndex + 1) % players.length;
  const resetPlayers = players.map((p) => ({
    ...p,
    stake: Math.min(10, getChinchiroMaxStake(p.points)),
    stakeSet: false,
    rollsLeft: 3,
    currentHand: null,
    doneThisRound: false,
  }));

  return {
    ...state,
    players: resetPlayers,
    round: state.round + 1,
    dealerIndex: nextDealer,
    turnIndex: nextDealer,
    lastLog: `第${state.round}局精算完了！第${state.round + 1}局 親: ${resetPlayers[nextDealer].name}`,
  };
}

export function applyChinchiroAction(
  state: ChinchiroInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: ChinchiroInternalState; error?: string } {
  if (state.phase !== 'playing') return { state, error: 'ゲームは終了しています' };

  if (action.type === 'setStake') {
    const idx = state.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return { state, error: 'プレイヤーが見つかりません' };
    if (idx === state.dealerIndex) return { state, error: '親は張り額を設定できません' };
    const target = state.players[idx];
    if (target.rollsLeft < 3 || target.doneThisRound) {
      return { state, error: '振った後は張り額を変更できません' };
    }
    const raw = (action.payload as { amount?: number })?.amount;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return { state, error: '張り額が不正です' };
    }
    const maxStake = getChinchiroMaxStake(target.points);
    const clamped = Math.max(5, Math.min(maxStake, Math.round(raw / 5) * 5));
    const players = state.players.map((p, i) =>
      i === idx ? { ...p, stake: clamped, stakeSet: true } : p
    );
    return {
      state: {
        ...state,
        players,
        lastLog: `${target.name} が張り額を ${clamped}点 に設定`,
      },
    };
  }

  const current = state.players[state.turnIndex];
  if (current.id !== playerId) return { state, error: 'あなたのターンではありません' };
  if (action.type !== 'roll') return { state, error: '不明なアクションです' };

  const payload = action.payload as { dice?: [number, number, number]; isShonben?: boolean } | undefined;
  const validPayloadDice =
    Array.isArray(payload?.dice) &&
    payload.dice.length === 3 &&
    payload.dice.every((n) => Number.isInteger(n) && n >= 1 && n <= 6);

  const isShonben = validPayloadDice
    ? Boolean(state.rules.shonbenEnabled && payload?.isShonben)
    : typeof payload?.isShonben === 'boolean'
    ? state.rules.shonbenEnabled && payload.isShonben
    : state.rules.shonbenEnabled && Math.random() < 0.03;

  const dice: [number, number, number] = validPayloadDice
    ? [payload!.dice![0], payload!.dice![1], payload!.dice![2]]
    : [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ];
  const hand = evaluateChinchiroDice(dice, isShonben);
  const rollsLeft = current.rollsLeft - 1;
  const isConfirmed = hand.rank !== 'menashi' || rollsLeft <= 0;

  const players = state.players.map((p, idx) =>
    idx === state.turnIndex
      ? { ...p, rollsLeft, currentHand: hand, doneThisRound: isConfirmed }
      : p
  );

  let nextState: ChinchiroInternalState = {
    ...state,
    players,
    rollSeq: state.rollSeq + 1,
    lastRolledPlayerId: current.id,
    lastRolledHand: hand,
    lastLog: `${current.name}: [${hand.dice.join('-')}] → ${hand.label}`,
  };

  if (!isConfirmed) {
    return { state: nextState };
  }

  // まだ振っていないプレイヤーがいるか
  const allDone = players.every((p) => p.doneThisRound);
  if (allDone) {
    return { state: settleRound(nextState) };
  }

  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (state.turnIndex + step) % n;
    if (!players[idx].doneThisRound) {
      nextState.turnIndex = idx;
      break;
    }
  }

  return { state: nextState };
}

export function computeChinchiroBotAction(
  state: ChinchiroInternalState
): { type: string; payload?: unknown } | null {
  const bot = state.players[state.turnIndex];
  if (bot.doneThisRound) return null;

  // 子のCPUは振る前に親の出目と点差状況から最適期待値（ケリー基準風）で張り額を調整する
  if (state.turnIndex !== state.dealerIndex && bot.rollsLeft === 3 && !bot.stakeSet) {
    const dealerHand = state.players[state.dealerIndex]?.currentHand;
    const maxStake = getChinchiroMaxStake(bot.points);
    const maxLeaderPoints = Math.max(...state.players.map((p) => p.points));
    const deficit = Math.max(0, maxLeaderPoints - bot.points);
    const isFinalRound = state.round >= state.rules.rounds;

    let desired = 10;
    if (dealerHand) {
      if (dealerHand.strength <= 0) {
        // 親がヒフミ・ションベン・目なし：圧倒的有利なので最大張り（75%〜100%）
        desired = Math.round((maxStake * 0.85) / 5) * 5;
      } else if (dealerHand.strength === 11) {
        // 親が1の目：引き分け以上が濃厚なため強気（60%〜75%）
        desired = Math.round((maxStake * 0.65) / 5) * 5;
      } else if (dealerHand.strength === 12) {
        // 親が2の目：期待値プラス（40%〜50%）
        desired = Math.round((maxStake * 0.45) / 5) * 5;
      } else if (dealerHand.strength === 13) {
        // 親が3の目：微有利〜互角（20%〜30%）
        desired = Math.round((maxStake * 0.25) / 5) * 5;
      } else if (isFinalRound && deficit > 15 && dealerHand.strength <= 15) {
        // オーラスで逆転が必要な場面では4・5の目相手でも逆転に必要な額を勝負張り
        desired = Math.min(maxStake, Math.max(15, Math.ceil(deficit / 5) * 5));
      } else {
        // 親が4の目以上（不利）：最小額の5点に絞って失点を最小化
        desired = 5;
      }
    }
    const clamped = Math.max(5, Math.min(maxStake, desired));
    return { type: 'setStake', payload: { amount: clamped } };
  }

  return { type: 'roll' };
}

export function sanitizeChinchiroState(state: ChinchiroInternalState, playerId: string): ChinchiroClientState {
  return { ...state, myId: playerId };
}
