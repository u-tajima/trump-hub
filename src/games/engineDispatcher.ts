import {
  applyChinchiroAction,
  type ChinchiroInternalState,
  computeChinchiroBotAction,
  initChinchiro,
  sanitizeChinchiroState,
} from './chinchiro';
import {
  applyConnect4Action,
  computeConnect4BotAction,
  type Connect4InternalState,
  initConnect4,
  sanitizeConnect4State,
} from './connect4';
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
  applyGomokuAction,
  computeGomokuBotAction,
  type GomokuInternalState,
  initGomoku,
  sanitizeGomokuState,
} from './gomoku';
import {
  applyHoldemAction,
  computeHoldemBotAction,
  type HoldemInternalState,
  initHoldem,
  sanitizeHoldemState,
} from './holdem';
import {
  applyMemoryAction,
  computeMemoryBotAction,
  initMemory,
  type MemoryInternalState,
  sanitizeMemoryState,
} from './memory';
import {
  applyPokerAction,
  computePokerBotAction,
  initPoker,
  type PokerInternalState,
  sanitizePokerState,
} from './poker';
import {
  applyOldMaidAction,
  computeOldMaidBotAction,
  initOldMaid,
  type OldMaidInternalState,
  sanitizeOldMaidState,
} from './oldMaid';
import {
  applyReversiAction,
  computeReversiBotAction,
  initReversi,
  type ReversiInternalState,
  sanitizeReversiState,
} from './reversi';
import {
  applyRouletteAction,
  computeRouletteBotAction,
  initRoulette,
  type RouletteInternalState,
  sanitizeRouletteState,
} from './roulette';
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
  ChinchiroRules,
  Connect4Rules,
  DaifugoRules,
  DoubtRules,
  GameId,
  GameRulesMap,
  GomokuRules,
  HoldemRules,
  MemoryRules,
  OldMaidRules,
  PlayerInfo,
  PokerRules,
  ReversiRules,
  RouletteRules,
  ScoreBoardRoomRules,
  SevensRules,
  SpeedRules,
} from '../types/game';

export interface ScoreBoardGameInternalState {
  rules: ScoreBoardRoomRules;
  phase: 'playing';
}

export type AnyInternalState =
  | ScoreBoardGameInternalState
  | DaifugoInternalState
  | SevensInternalState
  | SpeedInternalState
  | OldMaidInternalState
  | DoubtInternalState
  | MemoryInternalState
  | PokerInternalState
  | HoldemInternalState
  | ReversiInternalState
  | GomokuInternalState
  | Connect4InternalState
  | ChinchiroInternalState
  | RouletteInternalState;

export function initGameEngine(
  gameId: GameId,
  players: PlayerInfo[],
  rules: GameRulesMap[GameId],
  prevState?: AnyInternalState | null
): AnyInternalState {
  switch (gameId) {
    case 'scoreboard':
      return { rules: rules as ScoreBoardRoomRules, phase: 'playing' };
    case 'daifugo': {
      const prevDaifugo =
        prevState && 'finishedOrder' in prevState && 'revolution' in prevState
          ? (prevState as DaifugoInternalState)
          : null;
      return initDaifugo(players, rules as DaifugoRules, prevDaifugo?.finishedOrder ?? []);
    }
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
    case 'poker':
      return initPoker(players, rules as PokerRules);
    case 'holdem':
      return initHoldem(players, rules as HoldemRules);
    case 'reversi':
      return initReversi(players, rules as ReversiRules);
    case 'gomoku':
      return initGomoku(players, rules as GomokuRules);
    case 'connect4':
      return initConnect4(players, rules as Connect4Rules);
    case 'chinchiro':
      return initChinchiro(players, rules as ChinchiroRules);
    case 'roulette':
      return initRoulette(players, rules as RouletteRules);
  }
}

export function applyGameAction(
  gameId: GameId,
  state: AnyInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: AnyInternalState; error?: string } {
  switch (gameId) {
    case 'scoreboard':
      return { state };
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
    case 'poker':
      return applyPokerAction(state as PokerInternalState, playerId, action);
    case 'holdem':
      return applyHoldemAction(state as HoldemInternalState, playerId, action);
    case 'reversi':
      return applyReversiAction(state as ReversiInternalState, playerId, action);
    case 'gomoku':
      return applyGomokuAction(state as GomokuInternalState, playerId, action);
    case 'connect4':
      return applyConnect4Action(state as Connect4InternalState, playerId, action);
    case 'chinchiro':
      return applyChinchiroAction(state as ChinchiroInternalState, playerId, action);
    case 'roulette':
      return applyRouletteAction(state as RouletteInternalState, playerId, action);
  }
}

export function sanitizeGameState(gameId: GameId, state: AnyInternalState, playerId: string): unknown {
  switch (gameId) {
    case 'scoreboard':
      return { ...(state as ScoreBoardGameInternalState), myId: playerId };
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
    case 'poker':
      return sanitizePokerState(state as PokerInternalState, playerId);
    case 'holdem':
      return sanitizeHoldemState(state as HoldemInternalState, playerId);
    case 'reversi':
      return sanitizeReversiState(state as ReversiInternalState, playerId);
    case 'gomoku':
      return sanitizeGomokuState(state as GomokuInternalState, playerId);
    case 'connect4':
      return sanitizeConnect4State(state as Connect4InternalState, playerId);
    case 'chinchiro':
      return sanitizeChinchiroState(state as ChinchiroInternalState, playerId);
    case 'roulette':
      return sanitizeRouletteState(state as RouletteInternalState, playerId);
  }
}

/**
 * ホスト側で定期的に呼ばれ、Botの思考やタイムアウト処理を進める
 */
export function tickGameEngine(gameId: GameId, state: AnyInternalState): AnyInternalState | null {
  if (state.phase !== 'playing') return null;

  switch (gameId) {
    case 'scoreboard':
      return null;
    case 'daifugo': {
      const s = state as DaifugoInternalState;
      const actorId = s.pendingEffect ? s.pendingEffect.playerId : s.players[s.turnIndex]?.id;
      const actor = s.players.find((p) => p.id === actorId);
      if (!actor?.isBot) return null;
      const act = computeDaifugoBotAction(s);
      return applyDaifugoAction(s, actor.id, act).state;
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
        const decided = s.botDecidedIds ?? [];
        // Bot のダウト判定（1回のウィンドウにつき各Botは1度だけ判定する）
        for (const p of s.players) {
          if (p.isBot && p.id !== s.lastPlay?.playerId && !decided.includes(p.id)) {
            const act = computeDoubtBotAction(s, p.id);
            if (act) return applyDoubtAction(s, p.id, act).state;
            return applyDoubtAction(s, p.id, { type: 'passDoubt' }).state;
          }
        }
        // 時間切れで次へ
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
        if (s.resetAt && Date.now() < s.resetAt) return null;
        return applyMemoryAction(s, s.players[0].id, { type: 'resetMismatch' }).state;
      }
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeMemoryBotAction(s);
      if (!act) return null;
      return applyMemoryAction(s, current.id, act).state;
    }
    case 'poker': {
      const s = state as PokerInternalState;
      if (s.subPhase === 'showdown') return null;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computePokerBotAction(s);
      if (!act) return null;
      return applyPokerAction(s, current.id, act).state;
    }
    case 'holdem': {
      const s = state as HoldemInternalState;
      if (s.subPhase === 'showdown') return null;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeHoldemBotAction(s);
      if (!act) return null;
      return applyHoldemAction(s, current.id, act).state;
    }
    case 'reversi': {
      const s = state as ReversiInternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeReversiBotAction(s);
      if (!act) return null;
      return applyReversiAction(s, current.id, act).state;
    }
    case 'gomoku': {
      const s = state as GomokuInternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeGomokuBotAction(s);
      if (!act) return null;
      return applyGomokuAction(s, current.id, act).state;
    }
    case 'connect4': {
      const s = state as Connect4InternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeConnect4BotAction(s);
      if (!act) return null;
      return applyConnect4Action(s, current.id, act).state;
    }
    case 'chinchiro': {
      const s = state as ChinchiroInternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeChinchiroBotAction(s);
      if (!act) return null;
      return applyChinchiroAction(s, current.id, act).state;
    }
    case 'roulette': {
      const s = state as RouletteInternalState;
      if (s.subPhase === 'readyToSpin') {
        const spinner = s.players.find((p) => p.id === s.spinnerPlayerId);
        if (spinner?.isBot) {
          return applyRouletteAction(s, spinner.id, { type: 'resolveSpin' }).state;
        }
        return null;
      }
      if (s.subPhase !== 'betting') return null;
      const bot = s.players.find((p) => p.isBot && !p.confirmed);
      if (!bot) return null;
      const act = computeRouletteBotAction(s, bot.id);
      if (!act) return null;
      return applyRouletteAction(s, bot.id, act).state;
    }
  }
}
