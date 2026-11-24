import type { BackgammonRules, PlayerInfo } from '../types/game';

export interface BackgammonPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  side: 0 | 1; // 0: + (0->23->off), 1: - (23->0->off)
}

export interface BackgammonMove {
  from: number | 'bar';
  to: number | 'off';
  dieUsed: number;
  isHit: boolean;
}

export interface BackgammonInternalState {
  rules: BackgammonRules;
  players: [BackgammonPlayerState, BackgammonPlayerState];
  points: number[]; // length 24: >0 = P0 stones, <0 = P1 stones
  bar: [number, number];
  borneOff: [number, number];
  scores: [number, number];
  round: number;
  turnIndex: 0 | 1;
  subPhase: 'roll' | 'move';
  dice: [number, number] | null;
  remainingDice: number[];
  lastMove: { from: number | 'bar'; to: number | 'off'; side: 0 | 1 } | null;
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface BackgammonClientState extends BackgammonInternalState {
  myId: string;
  validMoves: BackgammonMove[];
  pipCounts: [number, number];
}

function createInitialPoints(): number[] {
  const pts = Array<number>(24).fill(0);
  // Player 0 (+, 0 -> 23 -> off)
  pts[0] = 2;
  pts[11] = 5;
  pts[16] = 3;
  pts[18] = 5;
  // Player 1 (-, 23 -> 0 -> off)
  pts[23] = -2;
  pts[12] = -5;
  pts[7] = -3;
  pts[5] = -5;
  return pts;
}

function isOwnedBy(val: number, side: 0 | 1): boolean {
  return side === 0 ? val > 0 : val < 0;
}

function opponentCountAt(points: number[], idx: number, side: 0 | 1): number {
  const val = points[idx];
  return side === 0 ? (val < 0 ? -val : 0) : val > 0 ? val : 0;
}

function canBearOff(points: number[], bar: [number, number], side: 0 | 1): boolean {
  if (bar[side] > 0) return false;
  if (side === 0) {
    // P0 インナーボードは 18..23 なので 0..17 に自駒がなければOK
    for (let i = 0; i < 18; i++) {
      if (points[i] > 0) return false;
    }
    return true;
  } else {
    // P1 インナーボードは 0..5 なので 6..23 に自駒がなければOK
    for (let i = 6; i < 24; i++) {
      if (points[i] < 0) return false;
    }
    return true;
  }
}

function hasCheckerBehindInHome(points: number[], fromIdx: number, side: 0 | 1): boolean {
  if (side === 0) {
    for (let i = 18; i < fromIdx; i++) {
      if (points[i] > 0) return true;
    }
    return false;
  } else {
    for (let i = fromIdx + 1; i <= 5; i++) {
      if (points[i] < 0) return true;
    }
    return false;
  }
}

export function getBackgammonValidMoves(
  points: number[],
  bar: [number, number],
  side: 0 | 1,
  remainingDice: number[]
): BackgammonMove[] {
  if (remainingDice.length === 0) return [];
  const uniqueDice = Array.from(new Set(remainingDice)).sort((a, b) => a - b);
  const moves: BackgammonMove[] = [];
  const seen = new Set<string>();

  // バーに自駒がある場合は必ずエンターのみ
  if (bar[side] > 0) {
    for (const die of uniqueDice) {
      const to = side === 0 ? die - 1 : 24 - die;
      const oppCount = opponentCountAt(points, to, side);
      if (oppCount <= 1) {
        const key = `bar->${to}`;
        if (!seen.has(key)) {
          seen.add(key);
          moves.push({ from: 'bar', to, dieUsed: die, isHit: oppCount === 1 });
        }
      }
    }
    return moves;
  }

  const bearOffReady = canBearOff(points, bar, side);

  for (let from = 0; from < 24; from++) {
    if (!isOwnedBy(points[from], side)) continue;

    for (const die of uniqueDice) {
      const target = side === 0 ? from + die : from - die;
      if (target >= 0 && target < 24) {
        const oppCount = opponentCountAt(points, target, side);
        if (oppCount <= 1) {
          const key = `${from}->${target}`;
          if (!seen.has(key)) {
            seen.add(key);
            moves.push({ from, to: target, dieUsed: die, isHit: oppCount === 1 });
          }
        }
      } else if (bearOffReady) {
        const exactDie = side === 0 ? 24 - from : from + 1;
        if (die === exactDie || (die > exactDie && !hasCheckerBehindInHome(points, from, side))) {
          const key = `${from}->off`;
          if (!seen.has(key)) {
            seen.add(key);
            // ちょうどの目がある場合はそちらを優先登録するため uniqueDice は昇順
            moves.push({ from, to: 'off', dieUsed: die, isHit: false });
          }
        }
      }
    }
  }

  return moves;
}

function computePipCounts(points: number[], bar: [number, number]): [number, number] {
  let p0 = bar[0] * 25;
  let p1 = bar[1] * 25;
  for (let i = 0; i < 24; i++) {
    const v = points[i];
    if (v > 0) p0 += v * (24 - i);
    else if (v < 0) p1 += -v * (i + 1);
  }
  return [p0, p1];
}

function rollOneDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function evaluateGamePoints(
  points: number[],
  bar: [number, number],
  borneOff: [number, number],
  winnerSide: 0 | 1
): { pts: 1 | 2 | 3; label: string } {
  const loserSide: 0 | 1 = winnerSide === 0 ? 1 : 0;
  if (borneOff[loserSide] > 0) {
    return { pts: 1, label: 'シングル勝利 (1pt)' };
  }
  // ギャモン以上: 相手の駒がバーまたは勝者のインナーボードに残っていればバックギャモン
  let inWinnerHome = false;
  if (winnerSide === 0) {
    for (let i = 18; i < 24; i++) {
      if (points[i] < 0) {
        inWinnerHome = true;
        break;
      }
    }
  } else {
    for (let i = 0; i < 6; i++) {
      if (points[i] > 0) {
        inWinnerHome = true;
        break;
      }
    }
  }

  if (bar[loserSide] > 0 || inWinnerHome) {
    return { pts: 3, label: 'バックギャモン！(3pt)' };
  }
  return { pts: 2, label: 'ギャモン！(2pt)' };
}

export function initBackgammon(
  playersInfo: PlayerInfo[],
  rules: BackgammonRules
): BackgammonInternalState {
  const p0 = playersInfo[0] ?? {
    id: 'p0',
    name: 'プレイヤー1',
    isHost: true,
    isBot: false,
    connected: true,
  };
  const p1 = playersInfo[1] ?? {
    id: 'bot-1',
    name: 'CPU',
    isHost: false,
    isBot: true,
    connected: true,
  };

  const players: [BackgammonPlayerState, BackgammonPlayerState] = [
    { id: p0.id, name: p0.name, isBot: p0.isBot, side: 0 },
    { id: p1.id, name: p1.name, isBot: p1.isBot, side: 1 },
  ];

  return {
    rules,
    players,
    points: createInitialPoints(),
    bar: [0, 0],
    borneOff: [0, 0],
    scores: [0, 0],
    round: 1,
    turnIndex: 0,
    subPhase: 'roll',
    dice: null,
    remainingDice: [],
    lastMove: null,
    winnerId: null,
    phase: 'playing',
    lastLog: `${players[0].name} のターン！ダイスを振ってください`,
  };
}

export function applyBackgammonAction(
  state: BackgammonInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: BackgammonInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }
  const current = state.players[state.turnIndex];
  if (current.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }

  const nextIndex: 0 | 1 = state.turnIndex === 0 ? 1 : 0;
  const nextPlayer = state.players[nextIndex];

  if (action.type === 'roll') {
    if (state.subPhase !== 'roll') {
      return { state, error: 'すでにダイスを振っています' };
    }
    const d1 = rollOneDie();
    const d2 = rollOneDie();
    const remainingDice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
    const moves = getBackgammonValidMoves(state.points, state.bar, current.side, remainingDice);

    if (moves.length === 0) {
      return {
        state: {
          ...state,
          dice: [d1, d2],
          remainingDice: [],
          turnIndex: nextIndex,
          subPhase: 'roll',
          lastLog: `${current.name} は [${d1}, ${d2}] を出しましたが動ける手がなくパス！次は ${nextPlayer.name}`,
        },
      };
    }

    const doubleText = d1 === d2 ? '（ゾロ目！4回動かせます）' : '';
    return {
      state: {
        ...state,
        dice: [d1, d2],
        remainingDice,
        subPhase: 'move',
        lastLog: `${current.name} のダイス: [${d1}, ${d2}]${doubleText}`,
      },
    };
  }

  if (action.type !== 'move') {
    return { state, error: '不明なアクションです' };
  }

  if (state.subPhase !== 'move') {
    return { state, error: '先にダイスを振ってください' };
  }

  const payload = action.payload as { from?: unknown; to?: unknown } | undefined;
  const from = payload?.from;
  const to = payload?.to;

  const validFrom =
    from === 'bar' ||
    (typeof from === 'number' && Number.isInteger(from) && from >= 0 && from < 24);
  const validTo =
    to === 'off' || (typeof to === 'number' && Number.isInteger(to) && to >= 0 && to < 24);

  if (!validFrom || !validTo) {
    return { state, error: '不正な移動指定です' };
  }

  const validMoves = getBackgammonValidMoves(
    state.points,
    state.bar,
    current.side,
    state.remainingDice
  );
  const chosen = validMoves.find((m) => m.from === from && m.to === to);
  if (!chosen) {
    return { state, error: 'その手は指せません' };
  }

  const points = [...state.points];
  const bar: [number, number] = [state.bar[0], state.bar[1]];
  const borneOff: [number, number] = [state.borneOff[0], state.borneOff[1]];
  const sign = current.side === 0 ? 1 : -1;
  const oppSide: 0 | 1 = current.side === 0 ? 1 : 0;

  // 移動元から減算
  if (chosen.from === 'bar') {
    bar[current.side] -= 1;
  } else {
    points[chosen.from] -= sign;
  }

  // 移動先へ加算（ヒット処理含む）
  if (chosen.to === 'off') {
    borneOff[current.side] += 1;
  } else {
    if (chosen.isHit) {
      points[chosen.to] = 0;
      bar[oppSide] += 1;
    }
    points[chosen.to] += sign;
  }

  // 使用したダイスを1つ消費
  const remainingDice = [...state.remainingDice];
  const dieIdx = remainingDice.indexOf(chosen.dieUsed);
  if (dieIdx >= 0) remainingDice.splice(dieIdx, 1);

  const lastMove = { from: chosen.from, to: chosen.to, side: current.side };

  // 全駒ベアオフチェック
  if (borneOff[current.side] >= 15) {
    const result = evaluateGamePoints(points, bar, borneOff, current.side);
    const scores: [number, number] = [state.scores[0], state.scores[1]];
    scores[current.side] += result.pts;

    if (scores[current.side] >= state.rules.targetPoints) {
      return {
        state: {
          ...state,
          points,
          bar,
          borneOff,
          scores,
          remainingDice: [],
          lastMove,
          winnerId: current.id,
          phase: 'finished',
          lastLog: `${current.name} が ${result.label} でマッチ勝利！（${scores[0]} - ${scores[1]}）`,
        },
      };
    }

    // 次のゲーム（ラウンド）を開始
    return {
      state: {
        ...state,
        points: createInitialPoints(),
        bar: [0, 0],
        borneOff: [0, 0],
        scores,
        round: state.round + 1,
        turnIndex: nextIndex,
        subPhase: 'roll',
        dice: null,
        remainingDice: [],
        lastMove: null,
        lastLog: `${current.name} が ${result.label} 獲得！（${scores[0]} - ${scores[1]}）第${state.round + 1}戦：${nextPlayer.name} の番`,
      },
    };
  }

  // 残りダイスでさらに動かせるかチェック
  const furtherMoves = getBackgammonValidMoves(points, bar, current.side, remainingDice);
  if (remainingDice.length > 0 && furtherMoves.length > 0) {
    const actionText = chosen.isHit
      ? '相手の駒をヒット！'
      : chosen.to === 'off'
      ? 'ベアオフ！'
      : '駒を移動。';
    return {
      state: {
        ...state,
        points,
        bar,
        borneOff,
        remainingDice,
        lastMove,
        lastLog: `${current.name}: ${actionText} 残りダイス [${remainingDice.join(', ')}]`,
      },
    };
  }

  const endNote =
    remainingDice.length > 0
      ? '（残りの目では動かせないためターン終了）'
      : '';
  const hitNote = chosen.isHit ? 'ヒット！' : chosen.to === 'off' ? 'ベアオフ！' : '';

  return {
    state: {
      ...state,
      points,
      bar,
      borneOff,
      remainingDice: [],
      turnIndex: nextIndex,
      subPhase: 'roll',
      lastMove,
      lastLog: `${current.name} ${hitNote}${endNote} 次は ${nextPlayer.name} の番`,
    },
  };
}

export function computeBackgammonBotAction(
  state: BackgammonInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  if (state.subPhase === 'roll') {
    return { type: 'roll' };
  }

  const bot = state.players[state.turnIndex];
  const moves = getBackgammonValidMoves(state.points, state.bar, bot.side, state.remainingDice);
  if (moves.length === 0) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;
  const sign = bot.side === 0 ? 1 : -1;

  for (const m of moves) {
    let score = 0;

    // 1. ベアオフ最優先
    if (m.to === 'off') {
      score += 65;
    }

    // 2. ヒット優先
    if (m.isHit) {
      score += 48;
    }

    // 3. 移動先でポイントメイク（2個以上の安全ブロック形成）
    if (typeof m.to === 'number') {
      const curAtDest = state.points[m.to] * sign;
      if (curAtDest === 1) {
        score += 36; // ブロットをカバーして安全ブロック化
      } else if (curAtDest >= 2) {
        score += 10; // 安全なスタックへの合流
      } else if (curAtDest === 0) {
        score -= 10; // 新たなブロット露出はやや危険
      }

      // インナーボード（ゴール側）への前進
      const progress = bot.side === 0 ? m.to : 23 - m.to;
      score += progress * 0.9;
    }

    // 4. 移動元が安全ブロックを崩す場合のペナルティ / 孤立ブロット救出ボーナス
    if (typeof m.from === 'number') {
      const curAtFrom = state.points[m.from] * sign;
      if (curAtFrom === 1) {
        score += 14; // 孤立ブロットの避難
      } else if (curAtFrom === 2) {
        score -= 18; // 安全な2個ブロックを壊すとブロットが残る
      }
    } else {
      // バーからのエンターは高優先
      score += 30;
    }

    score += Math.random() * 2;
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }

  return { type: 'move', payload: { from: bestMove.from, to: bestMove.to } };
}

export function sanitizeBackgammonState(
  state: BackgammonInternalState,
  playerId: string
): BackgammonClientState {
  const current = state.players[state.turnIndex];
  const validMoves =
    state.phase === 'playing' && state.subPhase === 'move'
      ? getBackgammonValidMoves(state.points, state.bar, current.side, state.remainingDice)
      : [];

  return {
    ...state,
    myId: playerId,
    validMoves,
    pipCounts: computePipCounts(state.points, state.bar),
  };
}
