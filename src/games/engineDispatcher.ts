import {
  applyDaifugoAction,
  computeDaifugoBotAction,
  type DaifugoInternalState,
  initDaifugo,
  sanitizeDaifugoState,
} from './daifugo';
import {
  applyDoubtAction,
  computeDoubtBotAction,
  type DoubtInternalState,
  initDoubt,
  sanitizeDoubtState,
} from './doubt';
import {
  applyMemoryAction,
  computeMemoryBotAction,
  initMemory,
  type MemoryInternalState,
  sanitizeMemoryState,
} from './memory';
import {
  applyOldMaidAction,
  computeOldMaidBotAction,
  initOldMaid,
  type OldMaidInternalState,
  sanitizeOldMaidState,
} from './oldMaid';
import {
  applySevensAction,
  computeSevensBotAction,
  initSevens,
  sanitizeSevensState,
  type SevensInternalState,
} from './sevens';
import {
  applySpeedAction,
  computeSpeedBotAction,
  initSpeed,
  sanitizeSpeedState,
  type SpeedInternalState,
} from './speed';
import type {
  DaifugoRules,
  DoubtRules,
  GameId,
  GameRulesMap,
  MemoryRules,
  OldMaidRules,
  PlayerInfo,
  SevensRules,
  SpeedRules,
} from '../types/game';

export type AnyInternalState =
  | DaifugoInternalState
  | SevensInternalState
  | SpeedInternalState
  | OldMaidInternalState
  | DoubtInternalState
  | MemoryInternalState;

export function initGameEngine(
  gameId: GameId,
  players: PlayerInfo[],
  rules: GameRulesMap[GameId]
): AnyInternalState {
  switch (gameId) {
    case 'daifugo':
      return initDaifugo(players, rules as DaifugoRules);
    case 'sevens':
      return initSevens(players, rules as SevensRules);
    case 'speed':
      return initSpeed(players, rules as SpeedRules);
    case 'oldmaid':
      return initOldMaid(players, rules as OldMaidRules);
    case 'doubt':
      return initDoubt(players, rules as DoubtRules);
    case 'memory':
      return initMemory(players, rules as MemoryRules);
  }
}

export function applyGameAction(
  gameId: GameId,
  state: AnyInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: AnyInternalState; error?: string } {
  switch (gameId) {
    case 'daifugo':
      return applyDaifugoAction(state as DaifugoInternalState, playerId, action);
    case 'sevens':
      return applySevensAction(state as SevensInternalState, playerId, action);
    case 'speed':
      return applySpeedAction(state as SpeedInternalState, playerId, action);
    case 'oldmaid':
      return applyOldMaidAction(state as OldMaidInternalState, playerId, action);
    case 'doubt':
      return applyDoubtAction(state as DoubtInternalState, playerId, action);
    case 'memory':
      return applyMemoryAction(state as MemoryInternalState, playerId, action);
  }
}

export function sanitizeGameState(gameId: GameId, state: AnyInternalState, playerId: string): unknown {
  switch (gameId) {
    case 'daifugo':
      return sanitizeDaifugoState(state as DaifugoInternalState, playerId);
    case 'sevens':
      return sanitizeSevensState(state as SevensInternalState, playerId);
    case 'speed':
      return sanitizeSpeedState(state as SpeedInternalState, playerId);
    case 'oldmaid':
      return sanitizeOldMaidState(state as OldMaidInternalState, playerId);
    case 'doubt':
      return sanitizeDoubtState(state as DoubtInternalState, playerId);
    case 'memory':
      return sanitizeMemoryState(state as MemoryInternalState, playerId);
  }
}

export function tickGameEngine(gameId: GameId, state: AnyInternalState): AnyInternalState | null {
  if (state.phase !== 'playing') return null;

  switch (gameId) {
    case 'daifugo': {
      const s = state as DaifugoInternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeDaifugoBotAction(s);
      return applyDaifugoAction(s, current.id, act).state;
    }
    case 'sevens': {
      const s = state as SevensInternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeSevensBotAction(s);
      return applySevensAction(s, current.id, act).state;
    }
    case 'oldmaid': {
      const s = state as OldMaidInternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeOldMaidBotAction(s);
      return applyOldMaidAction(s, current.id, act).state;
    }
    case 'speed': {
      const s = state as SpeedInternalState;
      const bot = s.players.find((p) => p.isBot);
      if (!bot) return null;
      const act = computeSpeedBotAction(s, bot.id);
      if (!act) return null;
      return applySpeedAction(s, bot.id, act).state;
    }
    case 'doubt': {
      const s = state as DoubtInternalState;
      if (s.subPhase === 'doubtWindow') {
        for (const p of s.players) {
          if (p.isBot && p.id !== s.lastPlay?.playerId) {
            const act = computeDoubtBotAction(s, p.id);
            if (act) return applyDoubtAction(s, p.id, act).state;
          }
        }
        if (Date.now() >= s.windowEndsAt) {
          return applyDoubtAction(s, s.players[0].id, { type: 'proceedWindow' }).state;
        }
        return null;
      }
      if (s.subPhase === 'play') {
        const current = s.players[s.turnIndex];
        if (!current?.isBot) return null;
        const act = computeDoubtBotAction(s, current.id);
        if (!act) return null;
        return applyDoubtAction(s, current.id, act).state;
      }
      return null;
    }
    case 'memory': {
      const s = state as MemoryInternalState;
      if (s.awaitingReset) {
        return applyMemoryAction(s, s.players[0].id, { type: 'resetMismatch' }).state;
      }
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeMemoryBotAction(s);
      if (!act) return null;
      return applyMemoryAction(s, current.id, act).state;
    }
  }
}
