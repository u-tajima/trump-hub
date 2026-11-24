import type { PlayerInfo, WordWolfRules } from '../types/game';

export type WordWolfTeam = 'citizen' | 'wolf';

export type WordWolfSubPhase = 'wordReveal' | 'discussion' | 'voting' | 'reversal';

export interface WordWolfTopicPair {
  category: string;
  a: string;
  b: string;
}

/** 厳選した日本語お題ペア（66組） */
export const WORD_WOLF_TOPICS: WordWolfTopicPair[] = [
  // 食べ物
  { category: '食べ物', a: 'うどん', b: 'そば' },
  { category: '食べ物', a: 'ラーメン', b: 'つけ麺' },
  { category: '食べ物', a: 'カレーライス', b: 'ハヤシライス' },
  { category: '食べ物', a: 'おにぎり', b: 'サンドイッチ' },
  { category: '食べ物', a: 'たこ焼き', b: 'お好み焼き' },
  { category: '食べ物', a: '餃子', b: '焼売' },
  { category: '食べ物', a: '焼肉', b: 'しゃぶしゃぶ' },
  { category: '食べ物', a: '寿司', b: '刺身' },
  { category: '食べ物', a: 'ピザ', b: 'パスタ' },
  { category: '食べ物', a: '唐揚げ', b: 'とんかつ' },
  { category: '食べ物', a: 'りんご', b: 'みかん' },
  { category: '食べ物', a: 'いちご', b: 'さくらんぼ' },
  { category: '食べ物', a: 'ショートケーキ', b: 'チーズケーキ' },
  { category: '食べ物', a: 'プリン', b: 'ゼリー' },
  { category: '食べ物', a: 'ポテトチップス', b: 'ポップコーン' },
  { category: '食べ物', a: 'アイスクリーム', b: 'かき氷' },
  { category: '食べ物', a: 'パンケーキ', b: 'フレンチトースト' },
  { category: '食べ物', a: '牛丼', b: '親子丼' },
  // 飲み物
  { category: '飲み物', a: 'コーヒー', b: '紅茶' },
  { category: '飲み物', a: '緑茶', b: '麦茶' },
  { category: '飲み物', a: 'コーラ', b: 'サイダー' },
  { category: '飲み物', a: 'オレンジジュース', b: 'りんごジュース' },
  { category: '飲み物', a: 'ビール', b: 'ハイボール' },
  { category: '飲み物', a: 'カフェラテ', b: 'ミルクティー' },
  // 動物
  { category: '動物', a: '犬', b: '猫' },
  { category: '動物', a: 'ライオン', b: 'トラ' },
  { category: '動物', a: 'パンダ', b: 'コアラ' },
  { category: '動物', a: 'イルカ', b: 'クジラ' },
  { category: '動物', a: 'ペンギン', b: 'アザラシ' },
  { category: '動物', a: 'ハムスター', b: 'うさぎ' },
  // スポーツ
  { category: 'スポーツ', a: '野球', b: 'サッカー' },
  { category: 'スポーツ', a: 'テニス', b: 'バドミントン' },
  { category: 'スポーツ', a: 'バスケットボール', b: 'バレーボール' },
  { category: 'スポーツ', a: 'スキー', b: 'スノーボード' },
  { category: 'スポーツ', a: '水泳', b: 'マラソン' },
  { category: 'スポーツ', a: '卓球', b: 'ボウリング' },
  // 学校・勉強
  { category: '学校', a: '体育祭', b: '文化祭' },
  { category: '学校', a: '夏休み', b: '冬休み' },
  { category: '学校', a: '修学旅行', b: '遠足' },
  { category: '学校', a: 'シャープペンシル', b: 'ボールペン' },
  { category: '学校', a: '数学', b: '理科' },
  { category: '学校', a: '国語', b: '英語' },
  // 旅行・レジャー
  { category: 'レジャー', a: '海', b: 'プール' },
  { category: 'レジャー', a: 'ディズニーランド', b: 'USJ' },
  { category: 'レジャー', a: '温泉', b: '銭湯' },
  { category: 'レジャー', a: '動物園', b: '水族館' },
  { category: 'レジャー', a: 'キャンプ', b: 'バーベキュー' },
  { category: 'レジャー', a: '新幹線', b: '飛行機' },
  { category: 'レジャー', a: 'ホテル', b: '旅館' },
  // 季節・イベント
  { category: '季節', a: '夏祭り', b: '花火大会' },
  { category: '季節', a: 'クリスマス', b: 'ハロウィン' },
  { category: '季節', a: 'お正月', b: '大晦日' },
  { category: '季節', a: '花見', b: '紅葉狩り' },
  { category: '季節', a: 'バレンタイン', b: 'ホワイトデー' },
  // 日常・SNS・エンタメ
  { category: '日常', a: 'LINE', b: 'X (Twitter)' },
  { category: '日常', a: 'YouTube', b: 'TikTok' },
  { category: '日常', a: '映画館', b: 'カラオケ' },
  { category: '日常', a: '漫画', b: 'アニメ' },
  { category: '日常', a: 'スマートフォン', b: 'タブレット' },
  { category: '日常', a: 'イヤホン', b: 'ヘッドホン' },
  { category: '日常', a: 'コンビニ', b: 'スーパー' },
  { category: '日常', a: '自転車', b: 'バイク' },
  { category: '日常', a: '朝風呂', b: '夜風呂' },
  { category: '日常', a: 'きのこの山', b: 'たけのこの里' },
  { category: '日常', a: '腕時計', b: '目覚まし時計' },
  { category: '日常', a: 'スニーカー', b: 'サンダル' },
];

export interface WordWolfPlayerInternal {
  id: string;
  name: string;
  isHost: boolean;
  isWolf: boolean;
  word: string;
  ready: boolean;
}

export interface WordWolfVoteEntry {
  voterId: string;
  voterName: string;
  targetId: string;
  targetName: string;
}

export interface WordWolfVoteResult {
  executedId: string;
  executedName: string;
  wasRunoff: boolean;
  reason: string;
  votes: WordWolfVoteEntry[];
  tally: { targetId: string; targetName: string; count: number }[];
}

export interface WordWolfInternalState {
  rules: WordWolfRules;
  players: WordWolfPlayerInternal[];
  category: string;
  majorityWord: string;
  minorityWord: string;
  wolfCount: number;
  subPhase: WordWolfSubPhase;
  phase: 'playing' | 'finished';
  winnerTeam: WordWolfTeam | null;
  winnerIds: string[];
  reversalSuccess: boolean | null;
  reversalWordRevealed: boolean;
  discussionEndsAt: number | null;
  votes: Record<string, string>;
  isRunoff: boolean;
  runoffCandidateIds: string[];
  voteResult: WordWolfVoteResult | null;
  timeline: string[];
  lastLog: string;
}

export interface WordWolfClientPlayer {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  hasVoted: boolean;
  /** 決着時のみ公開 */
  isWolf?: boolean;
  /** 決着時のみ公開 */
  word?: string;
}

export interface WordWolfClientState {
  myId: string;
  rules: WordWolfRules;
  players: WordWolfClientPlayer[];
  category: string;
  wolfCount: number;
  subPhase: WordWolfSubPhase;
  phase: 'playing' | 'finished';
  winnerTeam: WordWolfTeam | null;
  winnerIds: string[];
  reversalSuccess: boolean | null;
  reversalWordRevealed: boolean;
  discussionEndsAt: number | null;
  isRunoff: boolean;
  runoffCandidateIds: string[];
  voteResult: WordWolfVoteResult | null;
  /** 決着時、または逆転チャンスでホストが答え合わせを開いた場合のみ公開 */
  majorityWord: string | null;
  /** 決着時のみ公開 */
  minorityWord: string | null;
  timeline: string[];
  lastLog: string;
  // 自分専用の秘密情報（観戦者視点では null）
  myWord: string | null;
  myReady: boolean;
  myVotedTargetId: string | null;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function initWordWolf(
  playersInfo: PlayerInfo[],
  rules: WordWolfRules
): WordWolfInternalState {
  const topic = WORD_WOLF_TOPICS[Math.floor(Math.random() * WORD_WOLF_TOPICS.length)];
  const flip = Math.random() < 0.5;
  const majorityWord = flip ? topic.b : topic.a;
  const minorityWord = flip ? topic.a : topic.b;

  // 少数派が必ず過半数未満になるよう安全調整
  const maxWolves = Math.max(1, Math.floor((playersInfo.length - 1) / 2));
  const wolfCount = Math.max(1, Math.min(maxWolves, rules.wolfCount || 1));

  const indices = shuffleArray(playersInfo.map((_, idx) => idx));
  const wolfIndexSet = new Set(indices.slice(0, wolfCount));

  const players: WordWolfPlayerInternal[] = playersInfo.map((p, idx) => {
    const isWolf = wolfIndexSet.has(idx);
    return {
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isWolf,
      word: isWolf ? minorityWord : majorityWord,
      ready: false,
    };
  });

  return {
    rules: { ...rules },
    players,
    category: topic.category,
    majorityWord,
    minorityWord,
    wolfCount,
    subPhase: 'wordReveal',
    phase: 'playing',
    winnerTeam: null,
    winnerIds: [],
    reversalSuccess: null,
    reversalWordRevealed: false,
    discussionEndsAt: null,
    votes: {},
    isRunoff: false,
    runoffCandidateIds: [],
    voteResult: null,
    timeline: ['ゲーム開始：各自のお題を確認してください'],
    lastLog: 'お題が配られました。全員がお題を確認したら議論が始まります',
  };
}

function enterDiscussion(state: WordWolfInternalState): WordWolfInternalState {
  const endsAt =
    state.rules.discussionSec > 0 ? Date.now() + state.rules.discussionSec * 1000 : null;
  const log = '議論開始！お題について話し合い、少数派（ウルフ）を探しましょう';
  return {
    ...state,
    subPhase: 'discussion',
    discussionEndsAt: endsAt,
    votes: {},
    isRunoff: false,
    runoffCandidateIds: [],
    timeline: [...state.timeline, log],
    lastLog: log,
  };
}

function resolveWordWolfVotes(state: WordWolfInternalState): WordWolfInternalState {
  const candidates = state.isRunoff
    ? state.players.filter((p) => state.runoffCandidateIds.includes(p.id))
    : state.players;

  const tallyMap = new Map<string, number>();
  for (const c of candidates) {
    tallyMap.set(c.id, 0);
  }

  const voteEntries: WordWolfVoteEntry[] = [];
  for (const voter of state.players) {
    const targetId = state.votes[voter.id];
    if (!targetId) continue;
    const target = state.players.find((p) => p.id === targetId);
    if (!target) continue;
    tallyMap.set(targetId, (tallyMap.get(targetId) ?? 0) + 1);
    voteEntries.push({
      voterId: voter.id,
      voterName: voter.name,
      targetId: target.id,
      targetName: target.name,
    });
  }

  const tally = Array.from(tallyMap.entries())
    .map(([targetId, count]) => ({
      targetId,
      targetName: state.players.find((p) => p.id === targetId)?.name ?? '',
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const topCount = tally[0]?.count ?? 0;
  const topCandidates = tally.filter((t) => t.count === topCount && topCount > 0);

  // 同票1回目は決選投票へ
  if (topCandidates.length > 1 && !state.isRunoff) {
    const names = topCandidates.map((t) => t.targetName).join('・');
    const log = `同票（${names}）のため決選投票を行います`;
    return {
      ...state,
      votes: {},
      isRunoff: true,
      runoffCandidateIds: topCandidates.map((t) => t.targetId),
      timeline: [...state.timeline, log],
      lastLog: log,
    };
  }

  let executedTarget = topCandidates[0] ?? tally[0];
  let reason = '最多得票により処刑';
  if (topCandidates.length > 1) {
    executedTarget = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    reason = '決選投票でも同票のためランダムで処刑';
  }

  const executedPlayer =
    state.players.find((p) => p.id === executedTarget.targetId) ?? state.players[0];

  const voteResult: WordWolfVoteResult = {
    executedId: executedPlayer.id,
    executedName: executedPlayer.name,
    wasRunoff: state.isRunoff,
    reason,
    votes: voteEntries,
    tally,
  };

  // 市民が処刑された → ウルフ勝利で即決着
  if (!executedPlayer.isWolf) {
    const winLog = `${executedPlayer.name} は市民でした！ウルフ陣営の勝利！`;
    return {
      ...state,
      phase: 'finished',
      winnerTeam: 'wolf',
      winnerIds: state.players.filter((p) => p.isWolf).map((p) => p.id),
      voteResult,
      timeline: [...state.timeline, `投票結果：${executedPlayer.name} を処刑`, winLog],
      lastLog: winLog,
    };
  }

  // ウルフが処刑された & 逆転ルールあり → 逆転チャンスフェーズへ
  if (state.rules.allowReversal) {
    const revLog = `${executedPlayer.name} はウルフでした！多数派お題を当てれば逆転勝利！`;
    return {
      ...state,
      subPhase: 'reversal',
      reversalWordRevealed: false,
      voteResult,
      timeline: [...state.timeline, `投票結果：${executedPlayer.name} を処刑（ウルフ的中）`, revLog],
      lastLog: revLog,
    };
  }

  // 逆転ルールなし → 市民勝利で即決着
  const winLog = `${executedPlayer.name} はウルフでした！市民陣営の勝利！`;
  return {
    ...state,
    phase: 'finished',
    winnerTeam: 'citizen',
    winnerIds: state.players.filter((p) => !p.isWolf).map((p) => p.id),
    voteResult,
    timeline: [...state.timeline, `投票結果：${executedPlayer.name} を処刑`, winLog],
    lastLog: winLog,
  };
}

export function applyWordWolfAction(
  state: WordWolfInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: WordWolfInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームはすでに終了しています' };
  }

  const actor = state.players.find((p) => p.id === playerId);
  if (!actor) {
    return { state, error: '参加者が見つかりません' };
  }

  // 1. お題確認フェーズ
  if (state.subPhase === 'wordReveal') {
    if (action.type === 'confirmWord') {
      const nextPlayers = state.players.map((p) =>
        p.id === playerId ? { ...p, ready: true } : p
      );
      const nextState: WordWolfInternalState = { ...state, players: nextPlayers };
      if (nextPlayers.every((p) => p.ready)) {
        return { state: enterDiscussion(nextState) };
      }
      const readyCount = nextPlayers.filter((p) => p.ready).length;
      return {
        state: {
          ...nextState,
          lastLog: `お題確認中（${readyCount}/${nextPlayers.length}人 完了）`,
        },
      };
    }

    if (action.type === 'advancePhase') {
      if (!actor.isHost) {
        return { state, error: 'ホストのみ進行できます' };
      }
      const nextPlayers = state.players.map((p) => ({ ...p, ready: true }));
      return { state: enterDiscussion({ ...state, players: nextPlayers }) };
    }

    return { state, error: 'お題確認フェーズではこの操作はできません' };
  }

  // 2. 議論フェーズ
  if (state.subPhase === 'discussion') {
    if (action.type === 'extendDiscussion') {
      if (!actor.isHost) {
        return { state, error: 'ホストのみ議論時間を延長できます' };
      }
      if (state.rules.discussionSec <= 0) return { state };
      const base = Math.max(Date.now(), state.discussionEndsAt ?? Date.now());
      return {
        state: {
          ...state,
          discussionEndsAt: base + 60 * 1000,
          lastLog: '議論時間を60秒延長しました',
        },
      };
    }

    if (action.type === 'startVoting' || action.type === 'advancePhase') {
      if (!actor.isHost) {
        return { state, error: 'ホストのみ投票へ進められます' };
      }
      const log = '投票フェーズ：少数派（ウルフ）だと思う人を選んでください';
      return {
        state: {
          ...state,
          subPhase: 'voting',
          discussionEndsAt: null,
          votes: {},
          isRunoff: false,
          runoffCandidateIds: [],
          timeline: [...state.timeline, log],
          lastLog: log,
        },
      };
    }

    return { state, error: '議論フェーズではこの操作はできません' };
  }

  // 3. 投票フェーズ
  if (state.subPhase === 'voting') {
    if (action.type === 'castVote') {
      const targetId = (action.payload as { targetId?: string })?.targetId;
      if (!targetId) {
        return { state, error: '投票先を選んでください' };
      }
      if (targetId === actor.id) {
        return { state, error: '自分自身には投票できません' };
      }
      const target = state.players.find((p) => p.id === targetId);
      if (!target) {
        return { state, error: '無効な投票先です' };
      }
      if (state.isRunoff && !state.runoffCandidateIds.includes(targetId)) {
        return { state, error: '決選投票の候補者から選んでください' };
      }

      const nextVotes = { ...state.votes, [actor.id]: targetId };
      const nextState: WordWolfInternalState = { ...state, votes: nextVotes };

      if (state.players.every((p) => Boolean(nextVotes[p.id]))) {
        return { state: resolveWordWolfVotes(nextState) };
      }

      const votedCount = Object.keys(nextVotes).length;
      return {
        state: {
          ...nextState,
          lastLog: `${state.isRunoff ? '決選投票中' : '投票中'}（${votedCount}/${state.players.length}人 完了）`,
        },
      };
    }

    return { state, error: '投票フェーズではこの操作はできません' };
  }

  // 4. 逆転チャンスフェーズ
  if (state.subPhase === 'reversal') {
    if (action.type === 'revealReversalWord') {
      if (!actor.isHost) {
        return { state, error: 'ホストのみ答え合わせを開けます' };
      }
      return {
        state: {
          ...state,
          reversalWordRevealed: true,
          lastLog: `答え合わせ：多数派のお題は「${state.majorityWord}」です`,
        },
      };
    }

    if (action.type === 'judgeReversal') {
      if (!actor.isHost) {
        return { state, error: 'ホストのみ逆転判定を行えます' };
      }
      const correct = Boolean((action.payload as { correct?: boolean })?.correct);
      if (correct) {
        const winLog = `ウルフが多数派お題「${state.majorityWord}」を的中！ウルフの逆転勝利！`;
        return {
          state: {
            ...state,
            phase: 'finished',
            winnerTeam: 'wolf',
            winnerIds: state.players.filter((p) => p.isWolf).map((p) => p.id),
            reversalSuccess: true,
            reversalWordRevealed: true,
            timeline: [...state.timeline, winLog],
            lastLog: winLog,
          },
        };
      }
      const winLog = `逆転失敗！多数派お題は「${state.majorityWord}」でした。市民陣営の勝利！`;
      return {
        state: {
          ...state,
          phase: 'finished',
          winnerTeam: 'citizen',
          winnerIds: state.players.filter((p) => !p.isWolf).map((p) => p.id),
          reversalSuccess: false,
          reversalWordRevealed: true,
          timeline: [...state.timeline, winLog],
          lastLog: winLog,
        },
      };
    }

    return { state, error: '逆転判定フェーズではこの操作はできません' };
  }

  return { state, error: '不明なアクションです' };
}

export function sanitizeWordWolfState(
  state: WordWolfInternalState,
  playerId: string
): WordWolfClientState {
  const me = state.players.find((p) => p.id === playerId) ?? null;
  const isFinished = state.phase === 'finished';

  const clientPlayers: WordWolfClientPlayer[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    ready: p.ready,
    hasVoted: Boolean(state.votes[p.id]),
    ...(isFinished ? { isWolf: p.isWolf, word: p.word } : {}),
  }));

  return {
    myId: playerId,
    rules: state.rules,
    players: clientPlayers,
    category: state.category,
    wolfCount: state.wolfCount,
    subPhase: state.subPhase,
    phase: state.phase,
    winnerTeam: state.winnerTeam,
    winnerIds: state.winnerIds,
    reversalSuccess: state.reversalSuccess,
    reversalWordRevealed: state.reversalWordRevealed,
    discussionEndsAt: state.discussionEndsAt,
    isRunoff: state.isRunoff,
    runoffCandidateIds: state.runoffCandidateIds,
    voteResult: state.voteResult,
    majorityWord: isFinished || state.reversalWordRevealed ? state.majorityWord : null,
    minorityWord: isFinished ? state.minorityWord : null,
    timeline: state.timeline,
    lastLog: state.lastLog,
    myWord: me?.word ?? null,
    myReady: me?.ready ?? false,
    myVotedTargetId: me ? (state.votes[me.id] ?? null) : null,
  };
}

export function computeWordWolfBotAction(
  _state: WordWolfInternalState,
  _botId: string
): { type: string; payload?: unknown } | null {
  return null;
}
