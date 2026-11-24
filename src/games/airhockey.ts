import type { AirHockeyRules, PlayerInfo } from '../types/game';

export interface AirHockeyPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  side: 'bottom' | 'top';
}

export interface AirHockeySyncSnapshot {
  puckX: number;
  puckY: number;
  puckVx: number;
  puckVy: number;
  mallet0X: number;
  mallet0Y: number;
  mallet1X: number;
  mallet1Y: number;
  updatedAt: number;
}

export interface AirHockeyInternalState {
  rules: AirHockeyRules;
  players: [AirHockeyPlayerState, AirHockeyPlayerState];
  scores: [number, number];
  rallyCount: number;
  lastGoalBy: string | null;
  lastGoalSeq: number;
  syncSnapshot: AirHockeySyncSnapshot | null;
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface AirHockeyClientState extends AirHockeyInternalState {
  myId: string;
}

export function initAirHockey(
  playersInfo: PlayerInfo[],
  rules: AirHockeyRules
): AirHockeyInternalState {
  const players: [AirHockeyPlayerState, AirHockeyPlayerState] = [
    {
      id: playersInfo[0].id,
      name: playersInfo[0].name,
      isBot: playersInfo[0].isBot,
      side: 'bottom',
    },
    {
      id: playersInfo[1].id,
      name: playersInfo[1].name,
      isBot: playersInfo[1].isBot,
      side: 'top',
    },
  ];

  return {
    rules,
    players,
    scores: [0, 0],
    rallyCount: 0,
    lastGoalBy: null,
    lastGoalSeq: 0,
    syncSnapshot: null,
    winnerId: null,
    phase: 'playing',
    lastLog: `${rules.winScore}点先取！フェイスオフ！`,
  };
}

export function applyAirHockeyAction(
  state: AirHockeyInternalState,
  _playerId: string,
  action: { type: string; payload?: unknown }
): { state: AirHockeyInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }

  if (action.type === 'goal') {
    const payload = action.payload as { scorerIndex?: number; rallyCount?: number } | undefined;
    if (!payload || (payload.scorerIndex !== 0 && payload.scorerIndex !== 1)) {
      return { state, error: '得点プレイヤーが不正です' };
    }

    const scorerIndex = payload.scorerIndex as 0 | 1;
    const nextScores: [number, number] = [state.scores[0], state.scores[1]];
    nextScores[scorerIndex] += 1;

    const scorer = state.players[scorerIndex];
    const rallyCount =
      typeof payload.rallyCount === 'number' && Number.isFinite(payload.rallyCount)
        ? Math.max(0, Math.floor(payload.rallyCount))
        : state.rallyCount;

    const won = nextScores[scorerIndex] >= state.rules.winScore;
    const winnerId = won ? scorer.id : null;
    const phase: 'playing' | 'finished' = won ? 'finished' : 'playing';
    const lastLog = won
      ? `${scorer.name} が ${nextScores[0]} - ${nextScores[1]} で勝利！`
      : `GOAL! ${scorer.name} が得点 (${nextScores[0]} - ${nextScores[1]})`;

    return {
      state: {
        ...state,
        scores: nextScores,
        rallyCount,
        lastGoalBy: scorer.id,
        lastGoalSeq: state.lastGoalSeq + 1,
        winnerId,
        phase,
        lastLog,
      },
    };
  }

  if (action.type === 'syncState') {
    const payload = action.payload as Partial<AirHockeySyncSnapshot> | undefined;
    if (!payload) return { state };

    const prev = state.syncSnapshot ?? {
      puckX: 300,
      puckY: 480,
      puckVx: 0,
      puckVy: 0,
      mallet0X: 300,
      mallet0Y: 800,
      mallet1X: 300,
      mallet1Y: 160,
      updatedAt: Date.now(),
    };

    const nextSnapshot: AirHockeySyncSnapshot = {
      puckX: typeof payload.puckX === 'number' ? payload.puckX : prev.puckX,
      puckY: typeof payload.puckY === 'number' ? payload.puckY : prev.puckY,
      puckVx: typeof payload.puckVx === 'number' ? payload.puckVx : prev.puckVx,
      puckVy: typeof payload.puckVy === 'number' ? payload.puckVy : prev.puckVy,
      mallet0X: typeof payload.mallet0X === 'number' ? payload.mallet0X : prev.mallet0X,
      mallet0Y: typeof payload.mallet0Y === 'number' ? payload.mallet0Y : prev.mallet0Y,
      mallet1X: typeof payload.mallet1X === 'number' ? payload.mallet1X : prev.mallet1X,
      mallet1Y: typeof payload.mallet1Y === 'number' ? payload.mallet1Y : prev.mallet1Y,
      updatedAt: Date.now(),
    };

    return {
      state: {
        ...state,
        syncSnapshot: nextSnapshot,
      },
    };
  }

  return { state, error: '不明なアクションです' };
}

export function sanitizeAirHockeyState(
  state: AirHockeyInternalState,
  playerId: string
): AirHockeyClientState {
  return {
    ...state,
    myId: playerId,
  };
}

/**
 * エアホッケーのCPUはクライアント側Canvasの60fpsループで滑らかに制御するため null を返す
 */
export function computeAirHockeyBotAction(
  _state: AirHockeyInternalState
): { type: string; payload?: unknown } | null {
  return null;
}
