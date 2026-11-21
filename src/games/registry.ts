import type { GameId, GameRulesMap } from '../types/game';

export interface RuleFieldDef<K extends string = string> {
  key: K;
  label: string;
  description: string;
  type: 'boolean' | 'select';
  options?: { value: string | number; label: string }[];
}

export type GameCategory = 'card' | 'board' | 'dice';

export interface GameMeta<T extends GameId = GameId> {
  id: T;
  category: GameCategory;
  name: string;
  subtitle: string;
  icon: string;
  minPlayers: number;
  maxPlayers: number;
  description: string;
  defaultRules: GameRulesMap[T];
  ruleFields: RuleFieldDef[];
}

export const GAME_REGISTRY: { [K in GameId]: GameMeta<K> } = {
  daifugo: {
    id: 'daifugo',
    category: 'card',
    name: '大富豪',
    subtitle: '階級を競う王道カードバトル',
    icon: '👑',
    minPlayers: 2,
    maxPlayers: 6,
    description: '手札を早く出し切った人が勝ち！革命・8切り・しばりなど豊富なローカルルールに対応。',
    defaultRules: {
      jokerCount: 1,
      revolution: true,
      eightCut: true,
      staircase: true,
      suitLock: true,
      elevenBack: true,
      spade3Return: true,
      miyakoochi: false,
      banFinishStrong: true,
    },
    ruleFields: [
      {
        key: 'jokerCount',
        label: 'ジョーカー枚数',
        description: 'デッキに入れるジョーカーの枚数',
        type: 'select',
        options: [
          { value: 0, label: '0枚' },
          { value: 1, label: '1枚' },
          { value: 2, label: '2枚' },
        ],
      },
      { key: 'revolution', label: '革命', description: '同数4枚以上（または階段4枚以上）で強さが逆転', type: 'boolean' },
      { key: 'eightCut', label: '8切り', description: '8を含む出し方で場が流れる', type: 'boolean' },
      { key: 'staircase', label: '階段', description: '同スート3枚以上の連番を出せる', type: 'boolean' },
      { key: 'suitLock', label: 'しばり', description: '同じスートが続くとそのスート限定になる', type: 'boolean' },
      { key: 'elevenBack', label: '11バック', description: 'Jを出すと場が流れるまで強さ逆転', type: 'boolean' },
      { key: 'spade3Return', label: 'スペ3返し', description: 'ジョーカー単体に♠3を出して場を流せる', type: 'boolean' },
      { key: 'banFinishStrong', label: '禁止上がり', description: '2・ジョーカー・8での上がりを禁止する', type: 'boolean' },
      { key: 'miyakoochi', label: '都落ち（連戦時）', description: '前ゲームの大富豪が1位以外で即大貧民', type: 'boolean' },
    ],
  },
  sevens: {
    id: 'sevens',
    category: 'card',
    name: '7ならべ',
    subtitle: '7から上下につなぐ定番ゲーム',
    icon: '7️⃣',
    minPlayers: 2,
    maxPlayers: 6,
    description: '7を起点に同じスートの数字をつなげて手札をなくそう。パス回数やトンネル設定が可能。',
    defaultRules: {
      passLimit: 3,
      tunnel: false,
      jokerEnabled: false,
    },
    ruleFields: [
      {
        key: 'passLimit',
        label: 'パス上限',
        description: '上限を超えるとドボン（脱落）になります',
        type: 'select',
        options: [
          { value: 3, label: '3回まで' },
          { value: 5, label: '5回まで' },
          { value: 0, label: '0回（即ドボン）' },
          { value: 99, label: '無制限' },
        ],
      },
      { key: 'tunnel', label: 'A-Kトンネル', description: 'AとKが裏でつながる（例: Aの隣にKを出せる）', type: 'boolean' },
      { key: 'jokerEnabled', label: 'ジョーカーあり', description: '出せる場所の代わりにジョーカーを置ける', type: 'boolean' },
    ],
  },
  speed: {
    id: 'speed',
    category: 'card',
    name: 'スピード',
    subtitle: '瞬発力勝負のリアルタイム対戦',
    icon: '⚡',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'ターンなし！2人同時進行で台札の±1のカードを素早く出し切ろう（※2人専用）。',
    defaultRules: {
      akConnect: true,
      sameRankAllowed: false,
      autoRefill: true,
    },
    ruleFields: [
      { key: 'akConnect', label: 'A-Kつながり', description: 'Aの上にK、Kの上にAを出せる', type: 'boolean' },
      { key: 'sameRankAllowed', label: '同数出しOK', description: '同じ数字の上にも出せる', type: 'boolean' },
      { key: 'autoRefill', label: '自動補充', description: '手札を出したら山札から自動で補充する', type: 'boolean' },
    ],
  },
  oldmaid: {
    id: 'oldmaid',
    category: 'card',
    name: 'ばば抜き / ジジ抜き',
    subtitle: '心理戦！ババを引かずにペアを捨てろ',
    icon: '🃏',
    minPlayers: 2,
    maxPlayers: 6,
    description: '同じ数字のペアを捨てて、最後の手札が0枚になれば勝ち。ジジ抜きモードにも対応！',
    defaultRules: {
      mode: 'baba',
      allowShuffle: true,
    },
    ruleFields: [
      {
        key: 'mode',
        label: 'ゲームモード',
        description: 'ばば抜き（ジョーカー1枚）かジジ抜き（ランダム1枚抜き）',
        type: 'select',
        options: [
          { value: 'baba', label: 'ばば抜き（ジョーカー）' },
          { value: 'jiji', label: 'ジジ抜き（何がババか秘密）' },
        ],
      },
      { key: 'allowShuffle', label: '手札シャッフル', description: '引かれる前に自分の手札をシャッフルできる', type: 'boolean' },
    ],
  },
  doubt: {
    id: 'doubt',
    category: 'card',
    name: 'ダウト',
    subtitle: 'ウソを見抜け！度胸のブラフ勝負',
    icon: '🎭',
    minPlayers: 2,
    maxPlayers: 6,
    description: 'A→2→3…の順に裏向きでカードを出す。ウソだと思ったら「ダウト！」を宣言しよう。',
    defaultRules: {
      jokerEnabled: true,
      doubtWindowSec: 5,
    },
    ruleFields: [
      { key: 'jokerEnabled', label: 'ジョーカー（ワイルド）', description: 'ジョーカーはどの数字として出しても本当になる', type: 'boolean' },
      {
        key: 'doubtWindowSec',
        label: 'ダウト猶予時間',
        description: 'カードが出されてからダウトを宣言できる秒数',
        type: 'select',
        options: [
          { value: 3, label: '3秒（サクサク）' },
          { value: 5, label: '5秒（標準）' },
          { value: 8, label: '8秒（じっくり）' },
        ],
      },
    ],
  },
  memory: {
    id: 'memory',
    category: 'card',
    name: '神経衰弱',
    subtitle: '記憶力が試されるペア探し',
    icon: '🧠',
    minPlayers: 1,
    maxPlayers: 6,
    description: '裏向きのカードを2枚めくって同じ数字なら獲得！1人プレイから6人対戦まで対応。',
    defaultRules: {
      deckSize: 26,
      extraTurnOnMatch: true,
      jokerPair: false,
    },
    ruleFields: [
      {
        key: 'deckSize',
        label: 'カード枚数',
        description: '使用するカードの総数（ジョーカー除く）',
        type: 'select',
        options: [
          { value: 20, label: '20枚（クイック）' },
          { value: 26, label: '26枚（ハーフ）' },
          { value: 52, label: '52枚（フル）' },
        ],
      },
      { key: 'extraTurnOnMatch', label: '連続ターン', description: 'ペアを揃えたらもう一度めくれる', type: 'boolean' },
      { key: 'jokerPair', label: 'ジョーカーペア', description: 'ジョーカー2枚を追加する', type: 'boolean' },
    ],
  },
  reversi: {
    id: 'reversi',
    category: 'board',
    name: 'リバーシ',
    subtitle: '挟んでひっくり返す王道陣取り',
    icon: '⚫',
    minPlayers: 2,
    maxPlayers: 2,
    description: '相手の石を挟んで自分の色に変えよう！パス自動スキップや6×6クイック対戦に対応。',
    defaultRules: {
      boardSize: 8,
      parallelSetup: false,
    },
    ruleFields: [
      {
        key: 'boardSize',
        label: '盤面サイズ',
        description: '6×6は短時間決着に向いています',
        type: 'select',
        options: [
          { value: 8, label: '8×8（標準）' },
          { value: 6, label: '6×6（クイック）' },
        ],
      },
      { key: 'parallelSetup', label: '並行初期配置', description: '初期配置をクロスではなく並行（黒黒/白白）にする', type: 'boolean' },
    ],
  },
  gomoku: {
    id: 'gomoku',
    category: 'board',
    name: '五目並べ',
    subtitle: '先に5つ並べた方が勝ち！',
    icon: '⭕',
    minPlayers: 2,
    maxPlayers: 2,
    description: '縦・横・斜めのいずれかに自分の石を5つ並べよう。盤面サイズや長連ルールを選択可能。',
    defaultRules: {
      boardSize: 13,
      allowOverline: true,
    },
    ruleFields: [
      {
        key: 'boardSize',
        label: '盤面サイズ',
        description: 'スマホで見やすいサイズを選べます',
        type: 'select',
        options: [
          { value: 9, label: '9×9（ミニ）' },
          { value: 13, label: '13×13（スマホ推奨）' },
          { value: 15, label: '15×15（本格）' },
        ],
      },
      { key: 'allowOverline', label: '長連（6目以上）勝ち', description: 'OFFにするとちょうど5目のみ勝ちになります', type: 'boolean' },
    ],
  },
  connect4: {
    id: 'connect4',
    category: 'board',
    name: '四目並べ',
    subtitle: '落として揃える重力パズル対戦',
    icon: '🟡',
    minPlayers: 2,
    maxPlayers: 2,
    description: '上からコインを落として縦・横・斜めに4つ連続で並べよう！スマホ片手でサクッと遊べます。',
    defaultRules: {
      cols: 7,
      rows: 6,
    },
    ruleFields: [
      {
        key: 'cols',
        label: '横列数',
        description: 'ボードの横幅',
        type: 'select',
        options: [
          { value: 7, label: '7列（標準）' },
          { value: 8, label: '8列（ワイド）' },
        ],
      },
      {
        key: 'rows',
        label: '縦行数',
        description: 'ボードの高さ',
        type: 'select',
        options: [
          { value: 6, label: '6行（標準）' },
          { value: 7, label: '7行（ロング）' },
        ],
      },
    ],
  },
  chinchiro: {
    id: 'chinchiro',
    category: 'dice',
    name: 'チンチロリン',
    subtitle: 'サイコロ3つで役を狙う運試し',
    icon: '🎲',
    minPlayers: 2,
    maxPlayers: 6,
    description: '親と子がサイコロ3つを最大3回振って役を競う日本の伝統ダイスゲーム！',
    defaultRules: {
      rounds: 5,
      startPoints: 100,
      shonbenEnabled: true,
    },
    ruleFields: [
      {
        key: 'rounds',
        label: 'ラウンド数',
        description: '親が何周（何局）回ったら終了するか',
        type: 'select',
        options: [
          { value: 3, label: '3局（サクッと）' },
          { value: 5, label: '5局（標準）' },
          { value: 10, label: '10局（ロング）' },
        ],
      },
      {
        key: 'startPoints',
        label: '初期持ち点',
        description: 'ゲーム開始時のスコア',
        type: 'select',
        options: [
          { value: 100, label: '100点' },
          { value: 300, label: '300点' },
        ],
      },
      { key: 'shonbenEnabled', label: 'ションベンあり', description: 'まれに器からこぼれて即負け（約3%）が発生する', type: 'boolean' },
    ],
  },
};

export const GAME_LIST: GameMeta[] = Object.values(GAME_REGISTRY);
