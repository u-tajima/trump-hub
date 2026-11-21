export type GameId =
  | 'daifugo'
  | 'sevens'
  | 'speed'
  | 'oldmaid'
  | 'doubt'
  | 'memory'
  | 'poker'
  | 'reversi'
  | 'gomoku'
  | 'connect4'
  | 'chinchiro';

export interface DaifugoRules {
  jokerCount: 0 | 1 | 2;
  revolution: boolean;
  kaidanRevolution: boolean;
  eightCut: boolean;
  staircase: boolean;
  suitLock: boolean;
  numberLock: boolean;
  elevenBack: boolean;
  spade3Return: boolean;
  fiveSkip: boolean;
  sevenPass: boolean;
  tenDiscard: boolean;
  queenBomber: boolean;
  sandstorm: boolean;
  miyakoochi: boolean;
  banFinishStrong: boolean;
}

export interface SevensRules {
  passLimit: 0 | 3 | 5 | 99;
  tunnel: boolean;
  jokerEnabled: boolean;
}

export interface SpeedRules {
  akConnect: boolean;
  sameRankAllowed: boolean;
  autoRefill: boolean;
}

export interface OldMaidRules {
  mode: 'baba' | 'jiji';
  allowShuffle: boolean;
}

export interface DoubtRules {
  jokerEnabled: boolean;
  doubtWindowSec: 3 | 5 | 8;
}

export interface MemoryRules {
  deckSize: 20 | 26 | 52;
  extraTurnOnMatch: boolean;
  jokerPair: boolean;
}

export interface PokerRules {
  rounds: 3 | 5 | 10;
  startChips: 500 | 1000;
  ante: 10 | 20;
  jokerEnabled: boolean;
}

export interface ReversiRules {
  boardSize: 6 | 8;
  parallelSetup: boolean;
}

export interface GomokuRules {
  boardSize: 9 | 13 | 15;
  allowOverline: boolean;
}

export interface Connect4Rules {
  cols: 7 | 8;
  rows: 6 | 7;
}

export interface ChinchiroRules {
  rounds: 3 | 5 | 10;
  startPoints: 100 | 300;
  shonbenEnabled: boolean;
}

export type GameRulesMap = {
  daifugo: DaifugoRules;
  sevens: SevensRules;
  speed: SpeedRules;
  oldmaid: OldMaidRules;
  doubt: DoubtRules;
  memory: MemoryRules;
  poker: PokerRules;
  reversi: ReversiRules;
  gomoku: GomokuRules;
  connect4: Connect4Rules;
  chinchiro: ChinchiroRules;
};

export interface PlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
}

export interface RoomConfig {
  roomCode: string;
  gameId: GameId;
  rules: GameRulesMap[GameId];
}

export type RoomPhase = 'lobby' | 'playing';

export interface LobbyState {
  phase: RoomPhase;
  config: RoomConfig;
  players: PlayerInfo[];
}

export interface ClientGameAction {
  type: string;
  payload?: unknown;
}

export type PeerToHostMessage =
  | { kind: 'join'; name: string; playerId: string }
  | { kind: 'action'; playerId: string; action: ClientGameAction }
  | { kind: 'ping'; ts: number };

export type HostToPeerMessage =
  | { kind: 'welcome'; playerId: string; lobby: LobbyState }
  | { kind: 'lobby'; lobby: LobbyState }
  | { kind: 'gameState'; gameId: GameId; state: unknown }
  | { kind: 'error'; message: string }
  | { kind: 'pong'; ts: number };
