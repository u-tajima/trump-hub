import {
  applyAirHockeyAction,
  type AirHockeyInternalState,
  initAirHockey,
  sanitizeAirHockeyState,
} from './airhockey';
import {
  applyBackgammonAction,
  type BackgammonInternalState,
  computeBackgammonBotAction,
  initBackgammon,
  sanitizeBackgammonState,
} from './backgammon';
import {
  applyBattleshipAction,
  type BattleshipInternalState,
  computeBattleshipBotAction,
  initBattleship,
  sanitizeBattleshipState,
} from './battleship';
import {
  applyBlackjackAction,
  type BlackjackInternalState,
  computeBlackjackBotAction,
  initBlackjack,
  sanitizeBlackjackState,
} from './blackjack';
import {
  applyCarromAction,
  type CarromInternalState,
  computeCarromBotAction,
  initCarrom,
  sanitizeCarromState,
} from './carrom';
import {
  applyCheckersAction,
  type CheckersInternalState,
  computeCheckersBotAction,
  initCheckers,
  sanitizeCheckersState,
} from './checkers';
import {
  applyChessAction,
  type ChessInternalState,
  computeChessBotAction,
  initChess,
  sanitizeChessState,
} from './chess';
import {
  applyChinchiroAction,
  type ChinchiroInternalState,
  computeChinchiroBotAction,
  initChinchiro,
  sanitizeChinchiroState,
} from './chinchiro';
import {
  applyCoinSoccerAction,
  type CoinSoccerInternalState,
  computeCoinSoccerBotAction,
  initCoinSoccer,
  sanitizeCoinSoccerState,
} from './coinSoccer';
import {
  applyConnect4Action,
  computeConnect4BotAction,
  type Connect4InternalState,
  initConnect4,
  sanitizeConnect4State,
} from './connect4';
import {
  applyCrazy8Action,
  computeCrazy8BotAction,
  type Crazy8InternalState,
  initCrazy8,
  sanitizeCrazy8State,
} from './crazy8';
import {
  applyCrokinoleAction,
  computeCrokinoleBotAction,
  type CrokinoleInternalState,
  initCrokinole,
  sanitizeCrokinoleState,
} from './crokinole';
import {
  applyDaifugoAction,
  computeDaifugoBotAction,
  type DaifugoInternalState,
  initDaifugo,
  sanitizeDaifugoState,
} from './daifugo';
import {
  applyDotsAndBoxesAction,
  computeDotsAndBoxesBotAction,
  type DotsAndBoxesInternalState,
  initDotsAndBoxes,
  sanitizeDotsAndBoxesState,
} from './dotsAndBoxes';
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
  applyGunjinShogiAction,
  computeGunjinShogiBotAction,
  type GunjinShogiInternalState,
  initGunjinShogi,
  sanitizeGunjinShogiState,
} from './gunjinshogi';
import {
  applyHexAction,
  computeHexBotAction,
  type HexInternalState,
  initHex,
  sanitizeHexState,
} from './hex';
import {
  applyHitAndBlowAction,
  computeHitAndBlowBotAction,
  type HitAndBlowInternalState,
  initHitAndBlow,
  sanitizeHitAndBlowState,
} from './hitAndBlow';
import {
  applyHoldemAction,
  computeHoldemBotAction,
  type HoldemInternalState,
  initHoldem,
  sanitizeHoldemState,
} from './holdem';
import {
  applyIgoAction,
  computeIgoBotAction,
  type IgoInternalState,
  initIgo,
  sanitizeIgoState,
} from './igo';
import {
  applyIndianPokerAction,
  computeIndianPokerBotAction,
  type IndianPokerInternalState,
  initIndianPoker,
  sanitizeIndianPokerState,
} from './indianPoker';
import {
  applyInsiderAction,
  type InsiderInternalState,
  initInsider,
  sanitizeInsiderState,
} from './insider';
import {
  applyLiarsDiceAction,
  computeLiarsDiceBotAction,
  type LiarsDiceInternalState,
  initLiarsDice,
  sanitizeLiarsDiceState,
} from './liarsDice';
import {
  applyMancalaAction,
  computeMancalaBotAction,
  type MancalaInternalState,
  initMancala,
  sanitizeMancalaState,
} from './mancala';
import {
  applyMemoryAction,
  computeMemoryBotAction,
  initMemory,
  type MemoryInternalState,
  sanitizeMemoryState,
} from './memory';
import {
  applyOneNightAction,
  initOneNight,
  type OneNightInternalState,
  sanitizeOneNightState,
} from './oneNight';
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
  applyShogiAction,
  computeShogiBotAction,
  initShogi,
  sanitizeShogiState,
  type ShogiInternalState,
} from './shogi';
import {
  applySpeedAction,
  computeSpeedBotAction,
  initSpeed,
  sanitizeSpeedState,
  type SpeedInternalState,
} from './speed';
import {
  applyWerewolfAction,
  initWerewolf,
  sanitizeWerewolfState,
  type WerewolfInternalState,
} from './werewolf';
import {
  applyWordWolfAction,
  initWordWolf,
  sanitizeWordWolfState,
  type WordWolfInternalState,
} from './wordWolf';
import {
  applyYachtAction,
  computeYachtBotAction,
  initYacht,
  sanitizeYachtState,
  type YachtInternalState,
} from './yacht';
import type {
  AirHockeyRules,
  BackgammonRules,
  BattleshipRules,
  BlackjackRules,
  CarromRules,
  CheckersRules,
  ChessRules,
  ChinchiroRules,
  CoinSoccerRules,
  Connect4Rules,
  Crazy8Rules,
  CrokinoleRules,
  DaifugoRules,
  DotsAndBoxesRules,
  DoubtRules,
  GameId,
  GameRulesMap,
  GomokuRules,
  GunjinShogiRules,
  HexRules,
  HitAndBlowRules,
  HoldemRules,
  IgoRules,
  IndianPokerRules,
  InsiderRules,
  LiarsDiceRules,
  MancalaRules,
  MemoryRules,
  OldMaidRules,
  OneNightRules,
  PlayerInfo,
  PokerRules,
  ReversiRules,
  RouletteRules,
  ScoreBoardRoomRules,
  SevensRules,
  ShogiRules,
  SpeedRules,
  WerewolfRules,
  WordWolfRules,
  YachtRules,
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
  | Crazy8InternalState
  | BlackjackInternalState
  | IndianPokerInternalState
  | ReversiInternalState
  | GomokuInternalState
  | Connect4InternalState
  | ShogiInternalState
  | ChessInternalState
  | IgoInternalState
  | MancalaInternalState
  | DotsAndBoxesInternalState
  | BattleshipInternalState
  | HitAndBlowInternalState
  | HexInternalState
  | CheckersInternalState
  | BackgammonInternalState
  | GunjinShogiInternalState
  | CarromInternalState
  | AirHockeyInternalState
  | CoinSoccerInternalState
  | CrokinoleInternalState
  | WerewolfInternalState
  | OneNightInternalState
  | WordWolfInternalState
  | InsiderInternalState
  | ChinchiroInternalState
  | RouletteInternalState
  | YachtInternalState
  | LiarsDiceInternalState;

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
    case 'crazy8':
      return initCrazy8(players, rules as Crazy8Rules);
    case 'blackjack':
      return initBlackjack(players, rules as BlackjackRules);
    case 'indianpoker':
      return initIndianPoker(players, rules as IndianPokerRules);
    case 'reversi':
      return initReversi(players, rules as ReversiRules);
    case 'gomoku':
      return initGomoku(players, rules as GomokuRules);
    case 'connect4':
      return initConnect4(players, rules as Connect4Rules);
    case 'shogi':
      return initShogi(players, rules as ShogiRules);
    case 'chess':
      return initChess(players, rules as ChessRules);
    case 'igo':
      return initIgo(players, rules as IgoRules);
    case 'mancala':
      return initMancala(players, rules as MancalaRules);
    case 'dotsandboxes':
      return initDotsAndBoxes(players, rules as DotsAndBoxesRules);
    case 'battleship':
      return initBattleship(players, rules as BattleshipRules);
    case 'hitandblow':
      return initHitAndBlow(players, rules as HitAndBlowRules);
    case 'hex':
      return initHex(players, rules as HexRules);
    case 'checkers':
      return initCheckers(players, rules as CheckersRules);
    case 'backgammon':
      return initBackgammon(players, rules as BackgammonRules);
    case 'gunjinshogi':
      return initGunjinShogi(players, rules as GunjinShogiRules);
    case 'carrom':
      return initCarrom(players, rules as CarromRules);
    case 'airhockey':
      return initAirHockey(players, rules as AirHockeyRules);
    case 'coinsoccer':
      return initCoinSoccer(players, rules as CoinSoccerRules);
    case 'crokinole':
      return initCrokinole(players, rules as CrokinoleRules);
    case 'werewolf':
      return initWerewolf(players, rules as WerewolfRules);
    case 'onenight':
      return initOneNight(players, rules as OneNightRules);
    case 'wordwolf':
      return initWordWolf(players, rules as WordWolfRules);
    case 'insider':
      return initInsider(players, rules as InsiderRules);
    case 'chinchiro':
      return initChinchiro(players, rules as ChinchiroRules);
    case 'roulette':
      return initRoulette(players, rules as RouletteRules);
    case 'yacht':
      return initYacht(players, rules as YachtRules);
    case 'liarsdice':
      return initLiarsDice(players, rules as LiarsDiceRules);
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
    case 'crazy8':
      return applyCrazy8Action(state as Crazy8InternalState, playerId, action);
    case 'blackjack':
      return applyBlackjackAction(state as BlackjackInternalState, playerId, action);
    case 'indianpoker':
      return applyIndianPokerAction(state as IndianPokerInternalState, playerId, action);
    case 'reversi':
      return applyReversiAction(state as ReversiInternalState, playerId, action);
    case 'gomoku':
      return applyGomokuAction(state as GomokuInternalState, playerId, action);
    case 'connect4':
      return applyConnect4Action(state as Connect4InternalState, playerId, action);
    case 'shogi':
      return applyShogiAction(state as ShogiInternalState, playerId, action);
    case 'chess':
      return applyChessAction(state as ChessInternalState, playerId, action);
    case 'igo':
      return applyIgoAction(state as IgoInternalState, playerId, action);
    case 'mancala':
      return applyMancalaAction(state as MancalaInternalState, playerId, action);
    case 'dotsandboxes':
      return applyDotsAndBoxesAction(state as DotsAndBoxesInternalState, playerId, action);
    case 'battleship':
      return applyBattleshipAction(state as BattleshipInternalState, playerId, action);
    case 'hitandblow':
      return applyHitAndBlowAction(state as HitAndBlowInternalState, playerId, action);
    case 'hex':
      return applyHexAction(state as HexInternalState, playerId, action);
    case 'checkers':
      return applyCheckersAction(state as CheckersInternalState, playerId, action);
    case 'backgammon':
      return applyBackgammonAction(state as BackgammonInternalState, playerId, action);
    case 'gunjinshogi':
      return applyGunjinShogiAction(state as GunjinShogiInternalState, playerId, action);
    case 'carrom':
      return applyCarromAction(state as CarromInternalState, playerId, action);
    case 'airhockey':
      return applyAirHockeyAction(state as AirHockeyInternalState, playerId, action);
    case 'coinsoccer':
      return applyCoinSoccerAction(state as CoinSoccerInternalState, playerId, action);
    case 'crokinole':
      return applyCrokinoleAction(state as CrokinoleInternalState, playerId, action);
    case 'werewolf':
      return applyWerewolfAction(state as WerewolfInternalState, playerId, action);
    case 'onenight':
      return applyOneNightAction(state as OneNightInternalState, playerId, action);
    case 'wordwolf':
      return applyWordWolfAction(state as WordWolfInternalState, playerId, action);
    case 'insider':
      return applyInsiderAction(state as InsiderInternalState, playerId, action);
    case 'chinchiro':
      return applyChinchiroAction(state as ChinchiroInternalState, playerId, action);
    case 'roulette':
      return applyRouletteAction(state as RouletteInternalState, playerId, action);
    case 'yacht':
      return applyYachtAction(state as YachtInternalState, playerId, action);
    case 'liarsdice':
      return applyLiarsDiceAction(state as LiarsDiceInternalState, playerId, action);
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
    case 'crazy8':
      return sanitizeCrazy8State(state as Crazy8InternalState, playerId);
    case 'blackjack':
      return sanitizeBlackjackState(state as BlackjackInternalState, playerId);
    case 'indianpoker':
      return sanitizeIndianPokerState(state as IndianPokerInternalState, playerId);
    case 'reversi':
      return sanitizeReversiState(state as ReversiInternalState, playerId);
    case 'gomoku':
      return sanitizeGomokuState(state as GomokuInternalState, playerId);
    case 'connect4':
      return sanitizeConnect4State(state as Connect4InternalState, playerId);
    case 'shogi':
      return sanitizeShogiState(state as ShogiInternalState, playerId);
    case 'chess':
      return sanitizeChessState(state as ChessInternalState, playerId);
    case 'igo':
      return sanitizeIgoState(state as IgoInternalState, playerId);
    case 'mancala':
      return sanitizeMancalaState(state as MancalaInternalState, playerId);
    case 'dotsandboxes':
      return sanitizeDotsAndBoxesState(state as DotsAndBoxesInternalState, playerId);
    case 'battleship':
      return sanitizeBattleshipState(state as BattleshipInternalState, playerId);
    case 'hitandblow':
      return sanitizeHitAndBlowState(state as HitAndBlowInternalState, playerId);
    case 'hex':
      return sanitizeHexState(state as HexInternalState, playerId);
    case 'checkers':
      return sanitizeCheckersState(state as CheckersInternalState, playerId);
    case 'backgammon':
      return sanitizeBackgammonState(state as BackgammonInternalState, playerId);
    case 'gunjinshogi':
      return sanitizeGunjinShogiState(state as GunjinShogiInternalState, playerId);
    case 'carrom':
      return sanitizeCarromState(state as CarromInternalState, playerId);
    case 'airhockey':
      return sanitizeAirHockeyState(state as AirHockeyInternalState, playerId);
    case 'coinsoccer':
      return sanitizeCoinSoccerState(state as CoinSoccerInternalState, playerId);
    case 'crokinole':
      return sanitizeCrokinoleState(state as CrokinoleInternalState, playerId);
    case 'werewolf':
      return sanitizeWerewolfState(state as WerewolfInternalState, playerId);
    case 'onenight':
      return sanitizeOneNightState(state as OneNightInternalState, playerId);
    case 'wordwolf':
      return sanitizeWordWolfState(state as WordWolfInternalState, playerId);
    case 'insider':
      return sanitizeInsiderState(state as InsiderInternalState, playerId);
    case 'chinchiro':
      return sanitizeChinchiroState(state as ChinchiroInternalState, playerId);
    case 'roulette':
      return sanitizeRouletteState(state as RouletteInternalState, playerId);
    case 'yacht':
      return sanitizeYachtState(state as YachtInternalState, playerId);
    case 'liarsdice':
      return sanitizeLiarsDiceState(state as LiarsDiceInternalState, playerId);
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
    case 'shogi': {
      const s = state as ShogiInternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeShogiBotAction(s);
      if (!act) return null;
      return applyShogiAction(s, current.id, act).state;
    }
    case 'chess': {
      const s = state as ChessInternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeChessBotAction(s);
      if (!act) return null;
      return applyChessAction(s, current.id, act).state;
    }
    case 'igo': {
      const s = state as IgoInternalState;
      if (s.subPhase === 'scoring') {
        const bot = s.players.find((p) => p.isBot && !p.scoringAgreed);
        if (!bot) return null;
        const act = computeIgoBotAction(s);
        if (!act) return null;
        return applyIgoAction(s, bot.id, act).state;
      }
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeIgoBotAction(s);
      if (!act) return null;
      return applyIgoAction(s, current.id, act).state;
    }
    case 'werewolf':
      return null;
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
    case 'crazy8': {
      const s = state as Crazy8InternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeCrazy8BotAction(s);
      if (!act) return null;
      return applyCrazy8Action(s, current.id, act).state;
    }
    case 'blackjack': {
      const s = state as BlackjackInternalState;
      if (s.subPhase === 'roundEnd') return null;
      if (s.subPhase === 'betting') {
        const bot = s.players.find((p) => p.isBot && !p.betConfirmed && p.status !== 'out');
        if (!bot) return null;
        const act = computeBlackjackBotAction(s, bot.id);
        if (!act) return null;
        return applyBlackjackAction(s, bot.id, act).state;
      }
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeBlackjackBotAction(s, current.id);
      if (!act) return null;
      return applyBlackjackAction(s, current.id, act).state;
    }
    case 'indianpoker': {
      const s = state as IndianPokerInternalState;
      if (s.subPhase === 'showdown') return null;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeIndianPokerBotAction(s);
      if (!act) return null;
      return applyIndianPokerAction(s, current.id, act).state;
    }
    case 'mancala': {
      const s = state as MancalaInternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeMancalaBotAction(s);
      if (!act) return null;
      return applyMancalaAction(s, current.id, act).state;
    }
    case 'dotsandboxes': {
      const s = state as DotsAndBoxesInternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeDotsAndBoxesBotAction(s);
      if (!act) return null;
      return applyDotsAndBoxesAction(s, current.id, act).state;
    }
    case 'battleship': {
      const s = state as BattleshipInternalState;
      if (s.subPhase === 'setup') {
        const bot = s.players.find((p) => p.isBot && !p.setupConfirmed);
        if (!bot) return null;
        return applyBattleshipAction(s, bot.id, { type: 'confirmSetup' }).state;
      }
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeBattleshipBotAction(s);
      if (!act) return null;
      return applyBattleshipAction(s, current.id, act).state;
    }
    case 'hitandblow': {
      const s = state as HitAndBlowInternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeHitAndBlowBotAction(s);
      if (!act) return null;
      return applyHitAndBlowAction(s, current.id, act).state;
    }
    case 'carrom': {
      const s = state as CarromInternalState;
      if (Date.now() < s.nextBotActionAt) return null;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeCarromBotAction(s);
      if (!act) return null;
      return applyCarromAction(s, current.id, act).state;
    }
    case 'airhockey':
      return null;
    case 'yacht': {
      const s = state as YachtInternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeYachtBotAction(s);
      if (!act) return null;
      return applyYachtAction(s, current.id, act).state;
    }
    case 'liarsdice': {
      const s = state as LiarsDiceInternalState;
      if (s.subPhase === 'reveal') return null;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeLiarsDiceBotAction(s);
      if (!act) return null;
      return applyLiarsDiceAction(s, current.id, act).state;
    }
    case 'hex': {
      const s = state as HexInternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeHexBotAction(s);
      if (!act) return null;
      return applyHexAction(s, current.id, act).state;
    }
    case 'checkers': {
      const s = state as CheckersInternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeCheckersBotAction(s);
      if (!act) return null;
      return applyCheckersAction(s, current.id, act).state;
    }
    case 'backgammon': {
      const s = state as BackgammonInternalState;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeBackgammonBotAction(s);
      if (!act) return null;
      return applyBackgammonAction(s, current.id, act).state;
    }
    case 'gunjinshogi': {
      const s = state as GunjinShogiInternalState;
      if (s.subPhase === 'setup') {
        const bot = s.players.find((p) => p.isBot && !p.setupConfirmed);
        if (!bot) return null;
        return applyGunjinShogiAction(s, bot.id, { type: 'confirmSetup' }).state;
      }
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeGunjinShogiBotAction(s);
      if (!act) return null;
      return applyGunjinShogiAction(s, current.id, act).state;
    }
    case 'coinsoccer': {
      const s = state as CoinSoccerInternalState;
      if (Date.now() < s.nextBotActionAt) return null;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeCoinSoccerBotAction(s);
      if (!act) return null;
      return applyCoinSoccerAction(s, current.id, act).state;
    }
    case 'crokinole': {
      const s = state as CrokinoleInternalState;
      if (Date.now() < s.nextBotActionAt) return null;
      const current = s.players[s.turnIndex];
      if (!current?.isBot) return null;
      const act = computeCrokinoleBotAction(s);
      if (!act) return null;
      return applyCrokinoleAction(s, current.id, act).state;
    }
    case 'onenight':
    case 'wordwolf':
    case 'insider':
      return null;
  }
}
