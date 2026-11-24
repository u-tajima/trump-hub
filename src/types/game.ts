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
  | 'crazy8'
  | 'blackjack'
  | 'indianpoker'
  | 'reversi'
  | 'gomoku'
  | 'connect4'
  | 'shogi'
  | 'chess'
  | 'igo'
  | 'mancala'
  | 'dotsandboxes'
  | 'battleship'
  | 'hitandblow'
  | 'hex'
  | 'checkers'
  | 'backgammon'
  | 'gunjinshogi'
  | 'carrom'
  | 'airhockey'
  | 'coinsoccer'
  | 'crokinole'
  | 'werewolf'
  | 'onenight'
  | 'wordwolf'
  | 'insider'
  | 'chinchiro'
  | 'roulette'
  | 'yacht'
  | 'liarsdice';

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

export interface WerewolfRules {
  werewolfCount: number;        // 人狼の数
  seerCount: number;            // 占い師の数
  mediumCount: number;          // 霊媒師の数
  bodyguardCount: number;       // 騎士（狩人）の数
  madmanCount: number;          // 狂人の数
  foxCount: number;             // 妖狐の数
  discussionSec: number;        // 昼の議論時間（秒、0 = 上限なし）
  firstNightFortune: 'randomWhite' | 'free' | 'none'; // 初日占いルール
  consecutiveGuard: boolean;    // 騎士の連続護衛を許可するか
  tieBreak: 'runoff' | 'random' | 'noExecution';      // 同票時の処理
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

export interface CarromRules {
  piecesPerSide: 5 | 9;      // 各色のパック数（5個クイック / 9個本格）
  queenBonus: number;        // クイーン（赤）のボーナス点
}

export interface AirHockeyRules {
  winScore: number;          // 先取勝利点（例: 5 / 7 / 10）
  puckSpeed: 'normal' | 'fast'; // パックのスピード設定
}

export interface Crazy8Rules {
  drawTwoEnabled: boolean;   // 2で次の人に+2枚ドロー
  skipJackEnabled: boolean;  // Jで次の人をスキップ
  reverseQueenEnabled: boolean; // Qで順番リバース
}

export interface BlackjackRules {
  rounds: number;            // ラウンド数（0 = 上限なし）
  startChips: number;        // 初期チップ
  minBet: number;            // 最小ベット額
  dealerHitsSoft17: boolean; // ディーラーがソフト17でヒットするか
}

export interface IndianPokerRules {
  rounds: number;            // ラウンド数（0 = 上限なし）
  startChips: number;        // 初期チップ
  ante: number;              // 参加費
}

export interface MancalaRules {
  initialStones: 3 | 4;      // 各穴の初期石数（3個クイック / 4個標準）
  captureRule: boolean;      // 空穴着地で向かい側の石を横取り
}

export interface DotsAndBoxesRules {
  gridSize: 3 | 4 | 5;       // ボックスの縦横数（3x3 / 4x4 / 5x5）
}

export interface BattleshipRules {
  boardSize: 8 | 10;         // 盤面サイズ（8x8クイック / 10x10標準）
  extraTurnOnHit: boolean;   // 命中時に連続攻撃できるか
}

export interface HitAndBlowRules {
  digits: 3 | 4;             // 桁数（3桁 / 4桁）
  maxAttempts: number;       // 最大試行回数（ソロ時・引き分け上限）
}

export interface YachtRules {
  bonusThreshold: number;    // 上段ボーナス達成ライン（標準63点）
}

export interface LiarsDiceRules {
  startDice: 3 | 5;          // 初期サイコロ数（3個クイック / 5個標準）
  onesWild: boolean;         // 1の目をワイルド扱いするか
}

export interface HexRules {
  boardSize: 7 | 9 | 11;     // 六角盤面サイズ（7x7クイック / 9x9スマホ推奨 / 11x11標準）
  swapRule: boolean;         // パイルール（2手目に後手が初手を奪える）
}

export interface CheckersRules {
  forcedCapture: boolean;    // 飛び越し取り強制（公式ルール）
}

export interface BackgammonRules {
  targetPoints: 1 | 3;       // 勝利目標ポイント（1ゲーム勝負 / 3ptマッチ）
}

export interface GunjinShogiRules {
  autoSetupAllowed: boolean; // 自動配置ボタンを許可するか
}

export interface CoinSoccerRules {
  winScore: 3 | 5;           // 先取ゴール数（3点 / 5点）
}

export interface CrokinoleRules {
  discsPerPlayer: 6 | 8;     // 1ラウンドあたりのディスク枚数
  targetScore: 60 | 100;     // 勝利目標点（60点クイック / 100点公式）
}

export interface OneNightRules {
  werewolfCount: 2;          // 人狼カード枚数（標準2枚）
  includeThief: boolean;     // 怪盗を入れるか
  includeTanner: boolean;    // てるてる坊主を入れるか
  discussionSec: number;     // 議論時間（秒、0 = 上限なし）
}

export interface WordWolfRules {
  wolfCount: 1 | 2;          // 少数派（ウルフ）の人数
  discussionSec: number;     // 議論時間（秒、0 = 上限なし）
  allowReversal: boolean;    // ウルフ処刑時に多数派お題を当てたら逆転勝ち
}

export interface InsiderRules {
  questionSec: number;       // お題当て質問タイム（秒）
  discussionSec: number;     // 告発議論タイム（秒）
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
  crazy8: Crazy8Rules;
  blackjack: BlackjackRules;
  indianpoker: IndianPokerRules;
  reversi: ReversiRules;
  gomoku: GomokuRules;
  connect4: Connect4Rules;
  shogi: ShogiRules;
  chess: ChessRules;
  igo: IgoRules;
  mancala: MancalaRules;
  dotsandboxes: DotsAndBoxesRules;
  battleship: BattleshipRules;
  hitandblow: HitAndBlowRules;
  hex: HexRules;
  checkers: CheckersRules;
  backgammon: BackgammonRules;
  gunjinshogi: GunjinShogiRules;
  carrom: CarromRules;
  airhockey: AirHockeyRules;
  coinsoccer: CoinSoccerRules;
  crokinole: CrokinoleRules;
  werewolf: WerewolfRules;
  onenight: OneNightRules;
  wordwolf: WordWolfRules;
  insider: InsiderRules;
  chinchiro: ChinchiroRules;
  roulette: RouletteRules;
  yacht: YachtRules;
  liarsdice: LiarsDiceRules;
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
