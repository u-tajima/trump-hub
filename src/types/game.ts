import type { ScoreBoardOp, ScoreBoardState } from '../utils/scoreBoard';

export type GameId =
  | 'scoreboard'
  | 'daifugo'
  | 'sevens'
  | 'speed'
  | 'oldmaid'
  | 'doubt'
  | 'memory'
  | 'poker'
  | 'holdem'
  | 'reversi'
  | 'gomoku'
  | 'connect4'
  | 'shogi'
  | 'chess'
  | 'igo'
  | 'chinchiro'
  | 'roulette';

export interface ScoreBoardRoomRules {
  startScore: number;                 // 初期持ち点（基準点、任意入力可）
  unitStep: 1 | 5 | 10 | 100 | 1000;  // 数値増減の単位
  zeroSumCheck: boolean;              // ゼロサム不一致時の警告表示
}

export interface DaifugoRules {
  jokerCount: 0 | 1 | 2;
  revolution: boolean;       // 革命 (同数4枚以上)
  kaidanRevolution: boolean; // 階段革命 (階段4枚以上で革命)
  eightCut: boolean;         // 8切り
  staircase: boolean;        // 階段 (同スート3枚以上)
  suitLock: boolean;         // スートしばり
  numberLock: boolean;       // 数しばり (激しば: 連番が出たら連番限定)
  elevenBack: boolean;       // 11バック (Jで一時逆転)
  spade3Return: boolean;     // スペ3返し (ジョーカー単体に♠3)
  fiveSkip: boolean;         // 5飛び (5の枚数分スキップ)
  sevenPass: boolean;        // 7渡し (7の枚数分、次の人にカードを渡す)
  tenDiscard: boolean;       // 10捨て (10の枚数分、手札から捨てる)
  queenBomber: boolean;      // Qボンバー (指定した数字を全員捨てる)
  sandstorm: boolean;        // 砂嵐 (3の3枚出しで場が流れる)
  miyakoochi: boolean;       // 都落ち (2戦目以降)
  banFinishStrong: boolean;  // 反則上がり禁止 (2 / ジョーカー / 8 / スペ3返し)
}

export interface SevensRules {
  passLimit: number;         // パス上限（99 = 上限なし、任意入力可）
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
  doubtWindowSec: number;    // ダウト宣言の猶予時間（秒、任意入力可）
}

export interface MemoryRules {
  deckSize: 20 | 26 | 52;    // クイック20枚 / ハーフ26枚 / フル52枚
  extraTurnOnMatch: boolean; // 当てたら連続ターン
  jokerPair: boolean;        // ジョーカー2枚を入れる
}

export interface PokerRules {
  rounds: number;            // ラウンド数（0 = 上限なし、任意入力可）
  startChips: number;        // 初期チップ（任意入力可）
  ante: number;              // 参加費（任意入力可）
  jokerEnabled: boolean;     // ジョーカー（ワイルド）あり
}

export interface HoldemRules {
  rounds: number;            // ラウンド数（0 = 上限なし、任意入力可）
  startChips: number;        // 初期チップ（任意入力可）
  bigBlind: number;          // ビッグブラインド（任意入力可）
}

export interface ReversiRules {
  boardSize: 6 | 8;          // 6x6 クイック / 8x8 標準
  parallelSetup: boolean;    // 並行配置（通常はクロス配置）
}

export interface GomokuRules {
  boardSize: 9 | 13 | 15;    // 盤面サイズ
  allowOverline: boolean;    // 6目以上（長連）を勝ちとするか
}

export interface Connect4Rules {
  cols: 7 | 8;               // 横列数
  rows: 6 | 7;               // 縦行数
}

export interface ShogiRules {
  sennichiteRule: boolean;      // 千日手・連続王手の千日手判定
  uchifuzumeBan: boolean;       // 打ち歩詰め禁止
}

export interface ChessRules {
  fiftyMoveRule: boolean;       // 50手ルール（100ハーフムーブ）引き分け
  threefoldRepetition: boolean; // 同形三復（千日手）引き分け
}

export interface IgoRules {
  boardSize: 9 | 13 | 19;       // 盤面サイズ（9路 / 13路 / 19路）
  komi: number;                 // コミ（白への加算目数、デフォルト 6.5）
  superko: boolean;             // スーパーコウ（同形反復）禁止
}

export interface ChinchiroRules {
  rounds: number;            // ラウンド数（0 = 上限なし、任意入力可）
  startPoints: number;       // 初期持ち点（任意入力可）
  shonbenEnabled: boolean;   // ションベン（振り直し扱い/即負け）あり
}

export interface RouletteRules {
  rounds: number;            // ラウンド数（0 = 上限なし、任意入力可）
  startChips: number;        // 初期チップ（任意入力可）
  minBet: number;            // 最小ベット単位（任意入力可）
}

export type GameRulesMap = {
  scoreboard: ScoreBoardRoomRules;
  daifugo: DaifugoRules;
  sevens: SevensRules;
  speed: SpeedRules;
  oldmaid: OldMaidRules;
  doubt: DoubtRules;
  memory: MemoryRules;
  poker: PokerRules;
  holdem: HoldemRules;
  reversi: ReversiRules;
  gomoku: GomokuRules;
  connect4: Connect4Rules;
  shogi: ShogiRules;
  chess: ChessRules;
  igo: IgoRules;
  chinchiro: ChinchiroRules;
  roulette: RouletteRules;
};

export interface PlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  isLocal?: boolean;
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
  | { kind: 'scoreOp'; playerId: string; actorName: string; op: ScoreBoardOp }
  | { kind: 'ping'; ts: number };

export type HostToPeerMessage =
  | { kind: 'welcome'; playerId: string; lobby: LobbyState }
  | { kind: 'lobby'; lobby: LobbyState }
  | { kind: 'gameState'; gameId: GameId; state: unknown }
  | { kind: 'scoreBoard'; board: ScoreBoardState }
  | { kind: 'error'; message: string }
  | { kind: 'pong'; ts: number };
