import type { MancalaRules, PlayerInfo } from '../types/game';

export interface MancalaPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  seat: 0 | 1;
}

export interface MancalaInternalState {
  rules: MancalaRules;
  players: [MancalaPlayerState, MancalaPlayerState];
  /**
   * 0..5: P0の穴, 6: P0のストア
   * 7..12: P1の穴, 13: P1のストア
   */
  pits: number[];
  turnIndex: 0 | 1;
  extraTurn: boolean;
  lastPit: number | null;
  lastLandingPit: number | null;
  lastCaptured: number;
  winnerId: string | 'draw' | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface MancalaClientState extends MancalaInternalState {
  myId: string;
  validPits: number[];
}

export function getPlayerPitRange(seat: 0 | 1): [number, number] {
  return seat === 0 ? [0, 5] : [7, 12];
}

export function getPlayerStoreIndex(seat: 0 | 1): number {
  return seat === 0 ? 6 : 13;
}

export function getValidMancalaPits(pits: number[], seat: 0 | 1): number[] {
  const [start, end] = getPlayerPitRange(seat);
  const res: number[] = [];
  for (let i = start; i <= end; i++) {
    if (pits[i] > 0) res.push(i);
  }
  return res;
}

export function initMancala(playersInfo: PlayerInfo[], rules: MancalaRules): MancalaInternalState {
  const s = rules.initialStones;
  const pits = [
    s, s, s, s, s, s, 0,
    s, s, s, s, s, s, 0,
  ];

  const players: [MancalaPlayerState, MancalaPlayerState] = [
    { id: playersInfo[0].id, name: playersInfo[0].name, isBot: playersInfo[0].isBot, seat: 0 },
    { id: playersInfo[1].id, name: playersInfo[1].name, isBot: playersInfo[1].isBot, seat: 1 },
  ];

  return {
    rules,
    players,
    pits,
    turnIndex: 0,
    extraTurn: false,
    lastPit: null,
    lastLandingPit: null,
    lastCaptured: 0,
    winnerId: null,
    phase: 'playing',
    lastLog: `${players[0].name} の番からスタート`,
  };
}

interface SowResult {
  pits: number[];
  nextTurn: 0 | 1;
  extraTurn: boolean;
  landingPit: number;
  captured: number;
  finished: boolean;
}

function simulateSow(
  pitsInput: number[],
  seat: 0 | 1,
  pitIndex: number,
  captureRule: boolean
): SowResult {
  const pits = [...pitsInput];
  let stones = pits[pitIndex];
  pits[pitIndex] = 0;

  const myStore = getPlayerStoreIndex(seat);
  const oppStore = getPlayerStoreIndex(seat === 0 ? 1 : 0);
  const [myStart, myEnd] = getPlayerPitRange(seat);

  let idx = pitIndex;
  while (stones > 0) {
    idx = (idx + 1) % 14;
    if (idx === oppStore) continue;
    pits[idx]++;
    stones--;
  }

  const landingPit = idx;
  let captured = 0;
  let extraTurn = landingPit === myStore;

  if (
    captureRule &&
    !extraTurn &&
    landingPit >= myStart &&
    landingPit <= myEnd &&
    pits[landingPit] === 1
  ) {
    const oppIdx = 12 - landingPit;
    if (pits[oppIdx] > 0) {
      captured = pits[oppIdx] + 1;
      pits[myStore] += captured;
      pits[oppIdx] = 0;
      pits[landingPit] = 0;
    }
  }

  // どちらかの陣地が空になったか確認
  let p0Sum = 0;
  for (let i = 0; i <= 5; i++) p0Sum += pits[i];
  let p1Sum = 0;
  for (let i = 7; i <= 12; i++) p1Sum += pits[i];

  let finished = false;
  if (p0Sum === 0 || p1Sum === 0) {
    finished = true;
    extraTurn = false;
    if (p0Sum > 0) {
      pits[6] += p0Sum;
      for (let i = 0; i <= 5; i++) pits[i] = 0;
    }
    if (p1Sum > 0) {
      pits[13] += p1Sum;
      for (let i = 7; i <= 12; i++) pits[i] = 0;
    }
  }

  const nextTurn: 0 | 1 = extraTurn ? seat : seat === 0 ? 1 : 0;

  return {
    pits,
    nextTurn,
    extraTurn,
    landingPit,
    captured,
    finished,
  };
}

export function applyMancalaAction(
  state: MancalaInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: MancalaInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }
  const current = state.players[state.turnIndex];
  if (current.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }
  if (action.type !== 'sow') {
    return { state, error: '不明なアクションです' };
  }

  const { pitIndex } = (action.payload as { pitIndex?: number }) ?? {};
  const [start, end] = getPlayerPitRange(state.turnIndex);
  if (
    typeof pitIndex !== 'number' ||
    !Number.isInteger(pitIndex) ||
    pitIndex < start ||
    pitIndex > end
  ) {
    return { state, error: '自分の陣地の穴を選んでください' };
  }
  if (state.pits[pitIndex] <= 0) {
    return { state, error: '石が入っている穴を選んでください' };
  }

  const res = simulateSow(state.pits, state.turnIndex, pitIndex, state.rules.captureRule);

  if (res.finished) {
    const s0 = res.pits[6];
    const s1 = res.pits[13];
    let winnerId: string | 'draw' = 'draw';
    if (s0 > s1) winnerId = state.players[0].id;
    else if (s1 > s0) winnerId = state.players[1].id;

    const log =
      winnerId === 'draw'
        ? `引き分け (${s0} - ${s1})`
        : `${winnerId === state.players[0].id ? state.players[0].name : state.players[1].name} の勝利 (${s0} - ${s1})`;

    return {
      state: {
        ...state,
        pits: res.pits,
        turnIndex: res.nextTurn,
        extraTurn: false,
        lastPit: pitIndex,
        lastLandingPit: res.landingPit,
        lastCaptured: res.captured,
        winnerId,
        phase: 'finished',
        lastLog: log,
      },
    };
  }

  const nextPlayer = state.players[res.nextTurn];
  let log: string;
  if (res.extraTurn) {
    log = `${current.name} がストアにぴったり着地！もう一度 ${current.name} の番`;
  } else if (res.captured > 0) {
    log = `${current.name} が向かい側から ${res.captured}個 横取り！次は ${nextPlayer.name}`;
  } else {
    log = `${current.name} が石をまきました。次は ${nextPlayer.name}`;
  }

  return {
    state: {
      ...state,
      pits: res.pits,
      turnIndex: res.nextTurn,
      extraTurn: res.extraTurn,
      lastPit: pitIndex,
      lastLandingPit: res.landingPit,
      lastCaptured: res.captured,
      lastLog: log,
    },
  };
}

function evaluateMancala(pits: number[], botSeat: 0 | 1): number {
  const myStore = getPlayerStoreIndex(botSeat);
  const oppStore = getPlayerStoreIndex(botSeat === 0 ? 1 : 0);
  const [myStart, myEnd] = getPlayerPitRange(botSeat);
  const [oppStart, oppEnd] = getPlayerPitRange(botSeat === 0 ? 1 : 0);

  let mySide = 0;
  for (let i = myStart; i <= myEnd; i++) mySide += pits[i];
  let oppSide = 0;
  for (let i = oppStart; i <= oppEnd; i++) oppSide += pits[i];

  return (pits[myStore] - pits[oppStore]) * 10 + (mySide - oppSide) * 2;
}

function mancalaMinimax(
  pits: number[],
  turn: 0 | 1,
  botSeat: 0 | 1,
  depth: number,
  alpha: number,
  beta: number,
  captureRule: boolean
): number {
  const valid = getValidMancalaPits(pits, turn);
  if (depth <= 0 || valid.length === 0) {
    return evaluateMancala(pits, botSeat);
  }

  const maximizing = turn === botSeat;
  if (maximizing) {
    let best = -Infinity;
    for (const pit of valid) {
      const res = simulateSow(pits, turn, pit, captureRule);
      const val = res.finished
        ? (res.pits[getPlayerStoreIndex(botSeat)] - res.pits[getPlayerStoreIndex(botSeat === 0 ? 1 : 0)]) * 100
        : mancalaMinimax(res.pits, res.nextTurn, botSeat, depth - 1, alpha, beta, captureRule);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const pit of valid) {
      const res = simulateSow(pits, turn, pit, captureRule);
      const val = res.finished
        ? (res.pits[getPlayerStoreIndex(botSeat)] - res.pits[getPlayerStoreIndex(botSeat === 0 ? 1 : 0)]) * 100
        : mancalaMinimax(res.pits, res.nextTurn, botSeat, depth - 1, alpha, beta, captureRule);
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function computeMancalaBotAction(
  state: MancalaInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  const botSeat = state.turnIndex;
  const valid = getValidMancalaPits(state.pits, botSeat);
  if (valid.length === 0) return null;
  if (valid.length === 1) return { type: 'sow', payload: { pitIndex: valid[0] } };

  let bestPit = valid[0];
  let bestScore = -Infinity;

  for (const pit of valid) {
    const res = simulateSow(state.pits, botSeat, pit, state.rules.captureRule);
    const score = res.finished
      ? (res.pits[getPlayerStoreIndex(botSeat)] - res.pits[getPlayerStoreIndex(botSeat === 0 ? 1 : 0)]) * 100
      : mancalaMinimax(
          res.pits,
          res.nextTurn,
          botSeat,
          4,
          -Infinity,
          Infinity,
          state.rules.captureRule
        );
    // ストアぴったり着地に微小ボーナス
    const adjusted = score + (res.extraTurn ? 0.5 : 0);
    if (adjusted > bestScore) {
      bestScore = adjusted;
      bestPit = pit;
    }
  }

  return { type: 'sow', payload: { pitIndex: bestPit } };
}

export function sanitizeMancalaState(
  state: MancalaInternalState,
  playerId: string
): MancalaClientState {
  const validPits =
    state.phase === 'playing' ? getValidMancalaPits(state.pits, state.turnIndex) : [];
  return {
    ...state,
    myId: playerId,
    validPits,
  };
}
