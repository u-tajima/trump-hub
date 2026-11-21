import type { PlayerInfo, RouletteRules } from '../types/game';

// ヨーロピアンルーレットの公式37ポケット配列（時計回り）
export const EUROPEAN_WHEEL_ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const RED_NUMBERS = new Set<number>([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type RouletteColor = 'green' | 'red' | 'black';

export function getRouletteColor(n: number): RouletteColor {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

export type RouletteBetKind =
  | 'red'
  | 'black'
  | 'even'
  | 'odd'
  | 'low'    // 1-18
  | 'high'   // 19-36
  | 'dozen1' // 1-12
  | 'dozen2' // 13-24
  | 'dozen3' // 25-36
  | 'straight'; // 単一数字 0-36

export interface RouletteBet {
  kind: RouletteBetKind;
  value?: number; // straight の場合 0..36
  amount: number;
}

export interface RoulettePlayerState {
  id: string;
  name: string;
  isBot: boolean;
  chips: number;
  bets: RouletteBet[];
  confirmed: boolean;
  lastWin: number;    // 払戻総額
  lastNet: number;    // 純増減（払戻 - ベット合計）
}

export interface RouletteInternalState {
  rules: RouletteRules;
  players: RoulettePlayerState[];
  round: number;
  subPhase: 'betting' | 'readyToSpin' | 'result';
  spinnerPlayerId: string;
  spinSeq: number;
  lastNumber: number | null;
  history: number[];
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface RouletteClientState extends RouletteInternalState {
  myId: string;
}

export function getBetPayoutMultiplier(kind: RouletteBetKind): number {
  switch (kind) {
    case 'straight':
      return 36; // 35:1 + 元金
    case 'dozen1':
    case 'dozen2':
    case 'dozen3':
      return 3; // 2:1 + 元金
    default:
      return 2; // 1:1 + 元金
  }
}

export function isBetWin(bet: RouletteBet, winningNumber: number): boolean {
  switch (bet.kind) {
    case 'straight':
      return bet.value === winningNumber;
    case 'red':
      return winningNumber !== 0 && RED_NUMBERS.has(winningNumber);
    case 'black':
      return winningNumber !== 0 && !RED_NUMBERS.has(winningNumber);
    case 'even':
      return winningNumber !== 0 && winningNumber % 2 === 0;
    case 'odd':
      return winningNumber !== 0 && winningNumber % 2 === 1;
    case 'low':
      return winningNumber >= 1 && winningNumber <= 18;
    case 'high':
      return winningNumber >= 19 && winningNumber <= 36;
    case 'dozen1':
      return winningNumber >= 1 && winningNumber <= 12;
    case 'dozen2':
      return winningNumber >= 13 && winningNumber <= 24;
    case 'dozen3':
      return winningNumber >= 25 && winningNumber <= 36;
  }
}

export function formatBetLabel(bet: RouletteBet): string {
  switch (bet.kind) {
    case 'red':
      return '赤 (2倍)';
    case 'black':
      return '黒 (2倍)';
    case 'even':
      return '偶数 (2倍)';
    case 'odd':
      return '奇数 (2倍)';
    case 'low':
      return '1-18 (2倍)';
    case 'high':
      return '19-36 (2倍)';
    case 'dozen1':
      return '1-12 (3倍)';
    case 'dozen2':
      return '13-24 (3倍)';
    case 'dozen3':
      return '25-36 (3倍)';
    case 'straight':
      return `#${bet.value ?? 0} (36倍)`;
  }
}

function pickSpinnerId(players: RoulettePlayerState[], round: number): string {
  const humans = players.filter((p) => !p.isBot);
  if (humans.length === 0) return players[0].id;
  return humans[(round - 1) % humans.length].id;
}

export function initRoulette(playersInfo: PlayerInfo[], rules: RouletteRules): RouletteInternalState {
  const players: RoulettePlayerState[] = playersInfo.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    chips: rules.startChips,
    bets: [],
    confirmed: false,
    lastWin: 0,
    lastNet: 0,
  }));

  return {
    rules,
    players,
    round: 1,
    subPhase: 'betting',
    spinnerPlayerId: pickSpinnerId(players, 1),
    spinSeq: 0,
    lastNumber: null,
    history: [],
    phase: 'playing',
    lastLog: '第1ラウンド：チップを賭けて「ベット確定」を押してください',
  };
}

export function applyRouletteAction(
  state: RouletteInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: RouletteInternalState; error?: string } {
  if (state.phase !== 'playing') return { state, error: 'ゲームは終了しています' };

  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return { state, error: 'プレイヤーが見つかりません' };
  const player = state.players[playerIdx];

  if (action.type === 'placeBet') {
    if (state.subPhase !== 'betting') return { state, error: '現在はベットできません' };
    if (player.confirmed) return { state, error: 'すでにベット確定済みです' };

    const payload = action.payload as { kind?: RouletteBetKind; value?: number; amount?: number } | undefined;
    if (!payload?.kind) return { state, error: 'ベット種別が不正です' };
    const amount = Math.floor(payload.amount ?? state.rules.minBet);
    if (amount <= 0) return { state, error: 'ベット額が不正です' };
    if (player.chips < amount) return { state, error: 'チップが不足しています' };

    if (payload.kind === 'straight') {
      const v = payload.value;
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 36) {
        return { state, error: '数字は 0〜36 で指定してください' };
      }
    }

    const existingIdx = player.bets.findIndex(
      (b) => b.kind === payload.kind && (b.kind !== 'straight' || b.value === payload.value)
    );
    const nextBets =
      existingIdx >= 0
        ? player.bets.map((b, i) => (i === existingIdx ? { ...b, amount: b.amount + amount } : b))
        : [
            ...player.bets,
            {
              kind: payload.kind,
              value: payload.kind === 'straight' ? payload.value : undefined,
              amount,
            },
          ];

    const players = state.players.map((p, i) =>
      i === playerIdx ? { ...p, chips: p.chips - amount, bets: nextBets } : p
    );
    return { state: { ...state, players } };
  }

  if (action.type === 'clearBets') {
    if (state.subPhase !== 'betting') return { state, error: '現在は取り消しできません' };
    if (player.confirmed) return { state, error: '確定後は取り消しできません' };
    const refund = player.bets.reduce((sum, b) => sum + b.amount, 0);
    const players = state.players.map((p, i) =>
      i === playerIdx ? { ...p, chips: p.chips + refund, bets: [] } : p
    );
    return { state: { ...state, players } };
  }

  if (action.type === 'confirmBets') {
    if (state.subPhase !== 'betting') return { state, error: '現在は確定できません' };
    if (player.confirmed) return { state };

    const players = state.players.map((p, i) =>
      i === playerIdx ? { ...p, confirmed: true } : p
    );
    const allConfirmed = players.every((p) => p.confirmed);
    const spinner = players.find((p) => p.id === state.spinnerPlayerId) ?? players[0];

    return {
      state: {
        ...state,
        players,
        subPhase: allConfirmed ? 'readyToSpin' : 'betting',
        lastLog: allConfirmed
          ? `全員のベット確定！${spinner.name} が玉を投げます`
          : `${player.name} がベットを確定しました`,
      },
    };
  }

  if (action.type === 'resolveSpin') {
    if (state.subPhase !== 'readyToSpin') return { state, error: 'スピン待機中ではありません' };
    if (playerId !== state.spinnerPlayerId && !state.players[0].isBot && playerId !== state.players[0].id) {
      return { state, error: 'このラウンドのスピナーではありません' };
    }

    const payload = action.payload as { number?: number } | undefined;
    const validNum =
      typeof payload?.number === 'number' &&
      Number.isInteger(payload.number) &&
      payload.number >= 0 &&
      payload.number <= 36;

    const winningNumber = validNum
      ? payload!.number!
      : EUROPEAN_WHEEL_ORDER[Math.floor(Math.random() * EUROPEAN_WHEEL_ORDER.length)];

    const players = state.players.map((p) => {
      const totalBet = p.bets.reduce((s, b) => s + b.amount, 0);
      let totalWin = 0;
      for (const bet of p.bets) {
        if (isBetWin(bet, winningNumber)) {
          totalWin += bet.amount * getBetPayoutMultiplier(bet.kind);
        }
      }
      return {
        ...p,
        chips: p.chips + totalWin,
        lastWin: totalWin,
        lastNet: totalWin - totalBet,
      };
    });

    const color = getRouletteColor(winningNumber);
    const colorJa = color === 'green' ? '緑' : color === 'red' ? '赤' : '黒';

    return {
      state: {
        ...state,
        players,
        subPhase: 'result',
        spinSeq: state.spinSeq + 1,
        lastNumber: winningNumber,
        history: [winningNumber, ...state.history].slice(0, 12),
        lastLog: `結果: ${winningNumber} (${colorJa})`,
      },
    };
  }

  if (action.type === 'nextRound') {
    if (state.subPhase !== 'result') return { state, error: '結果表示中ではありません' };

    if (state.rules.rounds > 0 && state.round >= state.rules.rounds) {
      const sorted = [...state.players].sort((a, b) => b.chips - a.chips);
      return {
        state: {
          ...state,
          phase: 'finished',
          lastLog: `全${state.rules.rounds}ラウンド終了！ 1位: ${sorted[0].name} (${sorted[0].chips}チップ)`,
        },
      };
    }

    const nextRound = state.round + 1;
    const players = state.players.map((p) => ({
      ...p,
      // 破産救済: チップ0なら最小ベット分だけリバイ補充して遊び続けられる
      chips: p.chips <= 0 ? state.rules.minBet * 2 : p.chips,
      bets: [],
      confirmed: false,
      lastWin: 0,
      lastNet: 0,
    }));

    return {
      state: {
        ...state,
        players,
        round: nextRound,
        subPhase: 'betting',
        spinnerPlayerId: pickSpinnerId(players, nextRound),
        lastLog: `第${nextRound}ラウンド：チップを賭けてください`,
      },
    };
  }

  return { state, error: '不明なアクションです' };
}

export function computeRouletteBotAction(
  state: RouletteInternalState,
  botId: string
): { type: string; payload?: unknown } | null {
  if (state.subPhase !== 'betting') return null;
  const bot = state.players.find((p) => p.id === botId);
  if (!bot || !bot.isBot || bot.confirmed) return null;

  const unit = state.rules.minBet;
  if (bot.chips < unit) {
    return { type: 'confirmBets' };
  }

  const totalCurrentBet = bot.bets.reduce((s, b) => s + b.amount, 0);
  const effectiveStack = bot.chips + totalCurrentBet;
  const leaderChips = Math.max(
    ...state.players.map((p) => p.chips + p.bets.reduce((s, b) => s + b.amount, 0))
  );
  const deficit = Math.max(0, leaderChips - effectiveStack);
  const isFinalRound = state.rules.rounds > 0 && state.round >= state.rules.rounds;

  // トップ独走中の最終ラウンドは最小ベットで手堅く逃げ切る
  if (isFinalRound && deficit === 0 && bot.bets.length === 0) {
    return {
      type: 'placeBet',
      payload: { kind: Math.random() < 0.5 ? 'red' : 'black', amount: unit },
    };
  }

  // 1手目：メインのベースベット（2ダズン戦術の1つ目、または2倍アウトサイド）
  if (bot.bets.length === 0) {
    if (deficit > unit * 4) {
      // 差をつけられている時は3倍配当のダズンを厚めに狙う
      const dozens: RouletteBetKind[] = ['dozen1', 'dozen2', 'dozen3'];
      const pick = dozens[Math.floor(Math.random() * dozens.length)];
      const mult = Math.min(5, Math.max(2, Math.floor(bot.chips / unit / 3)));
      return {
        type: 'placeBet',
        payload: { kind: pick, amount: Math.min(bot.chips, unit * mult) },
      };
    }
    const outside: RouletteBetKind[] = ['red', 'black', 'even', 'odd', 'low', 'high'];
    const pick = outside[Math.floor(Math.random() * outside.length)];
    const mult = Math.min(4, Math.max(1, Math.floor(bot.chips / unit / 4)));
    return {
      type: 'placeBet',
      payload: { kind: pick, amount: Math.min(bot.chips, unit * mult) },
    };
  }

  // 2手目：異なるダズンまたはストレート1点張りを組み合わせてカバー率・爆発力を高める
  if (bot.bets.length === 1 && bot.chips >= unit * 2) {
    const firstKind = bot.bets[0].kind;
    if (firstKind === 'dozen1' || firstKind === 'dozen2' || firstKind === 'dozen3') {
      // 2ダズンカバー戦術（37枠中24枠＝約64.9%の勝率で利益を出す定番戦術）
      const otherDozens = (['dozen1', 'dozen2', 'dozen3'] as RouletteBetKind[]).filter(
        (k) => k !== firstKind
      );
      const secondDozen = otherDozens[Math.floor(Math.random() * otherDozens.length)];
      const amount = Math.min(bot.chips, bot.bets[0].amount);
      return {
        type: 'placeBet',
        payload: { kind: secondDozen, amount },
      };
    }
    // アウトサイド＋36倍ストレートのお守り1点狙い
    const luckyNumber = Math.floor(Math.random() * 37);
    return {
      type: 'placeBet',
      payload: { kind: 'straight', value: luckyNumber, amount: unit },
    };
  }

  return { type: 'confirmBets' };
}

export function sanitizeRouletteState(
  state: RouletteInternalState,
  playerId: string
): RouletteClientState {
  return { ...state, myId: playerId };
}
