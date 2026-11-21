export type GameId = 'daifugo' | 'sevens' | 'speed' | 'oldmaid' | 'doubt' | 'memory';

export interface DaifugoRules {
  jokerCount: 0 | 1 | 2;
  revolution: boolean;       // 革命 (4枚以上同数/階段)
  eightCut: boolean;         // 8切り
  staircase: boolean;        // 階段 (同スート3枚以上)
  suitLock: boolean;         // しばり (スート縛り)
  elevenBack: boolean;       // イレブンバック (Jで一時逆転)
  spade3Return: boolean;     // スペ3返し (ジョーカー単体に♠3)
  miyakoochi: boolean;       // 都落ち (2戦目以降・前大富豪が1位以外なら大貧民)
  banFinishStrong: boolean;  // 反則上がり禁止 (2 / ジョーカー / 8 / スペ3返しでの上がり禁止)
}

export interface SevensRules {
  passLimit: 0 | 3 | 5 | 99; // 99 = 無制限
  tunnel: boolean;           // A-Kトンネル
  jokerEnabled: boolean;     // ジョーカーあり
}

export interface SpeedRules {
  akConnect: boolean;        // AとKをつなげる
  sameRankAllowed: boolean;  // 同じ数字も出せる
  autoRefill: boolean;       // 場に出したら自動補充
}

export interface OldMaidRules {
  mode: 'baba' | 'jiji';     // ばば抜き / ジジ抜き
  allowShuffle: boolean;     // 相手が引く前にシャッフルボタンを使える
}

export interface DoubtRules {
  jokerEnabled: boolean;     // ジョーカー（ワイルドカード）あり
  doubtWindowSec: 3 | 5 | 8; // ダウト宣言の猶予時間（秒）
}

export interface MemoryRules {
  deckSize: 20 | 26 | 52;    // クイック20枚 / ハーフ26枚 / フル52枚
  extraTurnOnMatch: boolean; // 当てたら連続ターン
  jokerPair: boolean;        // ジョーカー2枚を入れる
}

export type GameRulesMap = {
  daifugo: DaifugoRules;
  sevens: SevensRules;
  speed: SpeedRules;
  oldmaid: OldMaidRules;
  doubt: DoubtRules;
  memory: MemoryRules;
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
