import type { GameId, GameRulesMap } from '../types/game';

export interface RuleFieldDef<K extends string = string> {
  key: K;
  label: string;
  description: string;
  type: 'boolean' | 'select';
  options?: { value: string | number; label: string }[];
}

export interface GameMeta<T extends GameId = GameId> {
  id: T;
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
};

export const GAME_LIST: GameMeta[] = Object.values(GAME_REGISTRY);
