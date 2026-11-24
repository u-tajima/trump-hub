import type { InsiderRules, PlayerInfo } from '../types/game';

export type InsiderRole = 'master' | 'insider' | 'common';

export type InsiderTeam = 'commons' | 'insider' | 'none';

export type InsiderSubPhase = 'roleReveal' | 'question' | 'discussion' | 'voting';

export interface InsiderWordEntry {
  category: string;
  word: string;
}

/** 厳選した日本語お題ワード（88語） */
export const INSIDER_WORDS: InsiderWordEntry[] = [
  // 動物 (12)
  { category: '動物', word: 'ペンギン' },
  { category: '動物', word: 'キリン' },
  { category: '動物', word: '象' },
  { category: '動物', word: 'イルカ' },
  { category: '動物', word: 'カンガルー' },
  { category: '動物', word: 'パンダ' },
  { category: '動物', word: 'ライオン' },
  { category: '動物', word: 'フクロウ' },
  { category: '動物', word: 'カメレオン' },
  { category: '動物', word: 'クジラ' },
  { category: '動物', word: 'チーター' },
  { category: '動物', word: 'カブトムシ' },
  // 食べ物 (14)
  { category: '食べ物', word: '寿司' },
  { category: '食べ物', word: 'ラーメン' },
  { category: '食べ物', word: 'カレーライス' },
  { category: '食べ物', word: 'たこ焼き' },
  { category: '食べ物', word: 'ピザ' },
  { category: '食べ物', word: 'オムライス' },
  { category: '食べ物', word: 'ハンバーガー' },
  { category: '食べ物', word: 'ソフトクリーム' },
  { category: '食べ物', word: 'スイカ' },
  { category: '食べ物', word: 'バナナ' },
  { category: '食べ物', word: 'ドーナツ' },
  { category: '食べ物', word: '納豆' },
  { category: '食べ物', word: 'おにぎり' },
  { category: '食べ物', word: 'チョコレート' },
  // 職業 (10)
  { category: '職業', word: '医者' },
  { category: '職業', word: '消防士' },
  { category: '職業', word: 'パイロット' },
  { category: '職業', word: '宇宙飛行士' },
  { category: '職業', word: '警察官' },
  { category: '職業', word: 'パティシエ' },
  { category: '職業', word: '弁護士' },
  { category: '職業', word: 'YouTuber' },
  { category: '職業', word: '漫画家' },
  { category: '職業', word: '美容師' },
  // 場所 (12)
  { category: '場所', word: '図書館' },
  { category: '場所', word: '水族館' },
  { category: '場所', word: '遊園地' },
  { category: '場所', word: '映画館' },
  { category: '場所', word: '病院' },
  { category: '場所', word: '空港' },
  { category: '場所', word: '温泉' },
  { category: '場所', word: '神社' },
  { category: '場所', word: 'コンビニ' },
  { category: '場所', word: 'スタジアム' },
  { category: '場所', word: '東京タワー' },
  { category: '場所', word: '富士山' },
  // 日用品・道具 (14)
  { category: '日用品', word: '傘' },
  { category: '日用品', word: '冷蔵庫' },
  { category: '日用品', word: '歯ブラシ' },
  { category: '日用品', word: '眼鏡' },
  { category: '日用品', word: 'スマートフォン' },
  { category: '日用品', word: 'ドライヤー' },
  { category: '日用品', word: '目覚まし時計' },
  { category: '日用品', word: '電子レンジ' },
  { category: '日用品', word: 'ハサミ' },
  { category: '日用品', word: 'ランドセル' },
  { category: '日用品', word: 'キーボード' },
  { category: '日用品', word: '掃除機' },
  { category: '日用品', word: '地球儀' },
  { category: '日用品', word: '望遠鏡' },
  // 自然・現象 (8)
  { category: '自然', word: '虹' },
  { category: '自然', word: '雪だるま' },
  { category: '自然', word: '台風' },
  { category: '自然', word: 'オーロラ' },
  { category: '自然', word: '火山' },
  { category: '自然', word: '流れ星' },
  { category: '自然', word: 'ひまわり' },
  { category: '自然', word: '桜' },
  // スポーツ・遊び (10)
  { category: 'スポーツ', word: 'サッカー' },
  { category: 'スポーツ', word: '野球' },
  { category: 'スポーツ', word: 'ボウリング' },
  { category: 'スポーツ', word: '将棋' },
  { category: 'スポーツ', word: '卓球' },
  { category: 'スポーツ', word: 'フィギュアスケート' },
  { category: 'スポーツ', word: '相撲' },
  { category: 'スポーツ', word: 'マラソン' },
  { category: 'スポーツ', word: 'ジェットコースター' },
  { category: 'スポーツ', word: 'カラオケ' },
  // 乗り物・その他 (8)
  { category: '乗り物', word: '新幹線' },
  { category: '乗り物', word: '救急車' },
  { category: '乗り物', word: 'ヘリコプター' },
  { category: '乗り物', word: '潜水艦' },
  { category: '乗り物', word: '観覧車' },
  { category: '乗り物', word: '自転車' },
  { category: 'イベント', word: '花火大会' },
  { category: 'イベント', word: 'クリスマスツリー' },
];

export interface InsiderRoleMeta {
  role: InsiderRole;
  name: string;
  teamLabel: string;
  summary: string;
}

export const INSIDER_ROLE_META: Record<InsiderRole, InsiderRoleMeta> = {
  master: {
    role: 'master',
    name: 'マスター',
    teamLabel: 'マスター＆庶民',
    summary: '秘密のお題を知っている進行役です。質問に「はい」「いいえ」「わからない」で答え、最後にインサイダーを見つけましょう。',
  },
  insider: {
    role: 'insider',
    name: 'インサイダー',
    teamLabel: '裏切り者',
    summary: '秘密のお題を知っています！庶民のふりをして時間内に正解へ導き、その後の投票で正体がバレなければ単独勝利です。',
  },
  common: {
    role: 'common',
    name: '庶民',
    teamLabel: 'マスター＆庶民',
    summary: 'マスターに質問して秘密のお題を当てましょう。当てた後は、正解へ不自然に導いたインサイダーを見つけ出します。',
  },
};

export interface InsiderPlayerInternal {
  id: string;
  name: string;
  isHost: boolean;
  role: InsiderRole;
  ready: boolean;
}

export interface InsiderVoteEntry {
  voterId: string;
  voterName: string;
  targetId: string;
  targetName: string;
}

export interface InsiderVoteResult {
  accusedId: string;
  accusedName: string;
  wasRunoff: boolean;
  reason: string;
  votes: InsiderVoteEntry[];
  tally: { targetId: string; targetName: string; count: number }[];
}

export interface InsiderInternalState {
  rules: InsiderRules;
  players: InsiderPlayerInternal[];
  secretWord: string;
  category: string;
  masterId: string;
  insiderId: string;
  subPhase: InsiderSubPhase;
  phase: 'playing' | 'finished';
  winnerTeam: InsiderTeam | null;
  winnerIds: string[];
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  solvedElapsedSec: number | null;
  solverId: string | null;
  solverName: string | null;
  timedOut: boolean;
  discussionEndsAt: number | null;
  votes: Record<string, string>;
  isRunoff: boolean;
  runoffCandidateIds: string[];
  voteResult: InsiderVoteResult | null;
  timeline: string[];
  lastLog: string;
}

export interface InsiderClientPlayer {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  hasVoted: boolean;
  isMaster: boolean;
  /** 決着時のみ公開 */
  role?: InsiderRole;
}

export interface InsiderClientState {
  myId: string;
  rules: InsiderRules;
  players: InsiderClientPlayer[];
  category: string;
  /** question フェーズ以降に公開 */
  masterId: string | null;
  masterName: string | null;
  subPhase: InsiderSubPhase;
  phase: 'playing' | 'finished';
  winnerTeam: InsiderTeam | null;
  winnerIds: string[];
  questionEndsAt: number | null;
  solvedElapsedSec: number | null;
  solverId: string | null;
  solverName: string | null;
  timedOut: boolean;
  discussionEndsAt: number | null;
  isRunoff: boolean;
  runoffCandidateIds: string[];
  voteResult: InsiderVoteResult | null;
  /** 正解後（discussion / voting）または決着時に公開 */
  revealedWord: string | null;
  timeline: string[];
  lastLog: string;
  // 自分専用の秘密情報（観戦者視点では null）
  myRole: InsiderRole | null;
  mySecretWord: string | null;
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

export function initInsider(
  playersInfo: PlayerInfo[],
  rules: InsiderRules
): InsiderInternalState {
  const entry = INSIDER_WORDS[Math.floor(Math.random() * INSIDER_WORDS.length)];
  const indices = shuffleArray(playersInfo.map((_, idx) => idx));
  const masterIdx = indices[0] ?? 0;
  const insiderIdx = indices[1] ?? (playersInfo.length > 1 ? 1 : 0);

  const players: InsiderPlayerInternal[] = playersInfo.map((p, idx) => {
    let role: InsiderRole = 'common';
    if (idx === masterIdx) role = 'master';
    else if (idx === insiderIdx) role = 'insider';
    return {
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      role,
      ready: false,
    };
  });

  const masterId = players[masterIdx]?.id ?? players[0].id;
  const insiderId = players[insiderIdx]?.id ?? players[0].id;

  return {
    rules: { ...rules },
    players,
    secretWord: entry.word,
    category: entry.category,
    masterId,
    insiderId,
    subPhase: 'roleReveal',
    phase: 'playing',
    winnerTeam: null,
    winnerIds: [],
    questionStartedAt: null,
    questionEndsAt: null,
    solvedElapsedSec: null,
    solverId: null,
    solverName: null,
    timedOut: false,
    discussionEndsAt: null,
    votes: {},
    isRunoff: false,
    runoffCandidateIds: [],
    voteResult: null,
    timeline: ['ゲーム開始：各自の役職を確認してください'],
    lastLog: '役職が配られました。全員が役職を確認したら質問タイムが始まります',
  };
}

function enterQuestionPhase(state: InsiderInternalState): InsiderInternalState {
  const now = Date.now();
  const endsAt = state.rules.questionSec > 0 ? now + state.rules.questionSec * 1000 : null;
  const masterName = state.players.find((p) => p.id === state.masterId)?.name ?? 'マスター';
  const log = `質問タイム開始！マスターは「${masterName}」です。はい／いいえで答えられる質問でお題を当てましょう`;
  return {
    ...state,
    subPhase: 'question',
    questionStartedAt: now,
    questionEndsAt: endsAt,
    timeline: [...state.timeline, log],
    lastLog: log,
  };
}

function resolveInsiderVotes(state: InsiderInternalState): InsiderInternalState {
  const candidates = state.isRunoff
    ? state.players.filter((p) => state.runoffCandidateIds.includes(p.id))
    : state.players.filter((p) => p.id !== state.masterId);

  const tallyMap = new Map<string, number>();
  for (const c of candidates) {
    tallyMap.set(c.id, 0);
  }

  const voteEntries: InsiderVoteEntry[] = [];
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

  let accusedTarget = topCandidates[0] ?? tally[0];
  let reason = '最多得票により告発';
  if (topCandidates.length > 1) {
    accusedTarget = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    reason = '決選投票でも同票のためランダムで告発';
  }

  const accusedPlayer =
    state.players.find((p) => p.id === accusedTarget.targetId) ?? state.players[0];

  const voteResult: InsiderVoteResult = {
    accusedId: accusedPlayer.id,
    accusedName: accusedPlayer.name,
    wasRunoff: state.isRunoff,
    reason,
    votes: voteEntries,
    tally,
  };

  const caughtInsider = accusedPlayer.id === state.insiderId;
  const insiderName = state.players.find((p) => p.id === state.insiderId)?.name ?? '';

  if (caughtInsider) {
    const winLog = `告発成功！${accusedPlayer.name} はインサイダーでした！マスター＆庶民チームの勝利！`;
    return {
      ...state,
      phase: 'finished',
      winnerTeam: 'commons',
      winnerIds: state.players.filter((p) => p.role !== 'insider').map((p) => p.id),
      voteResult,
      timeline: [...state.timeline, `投票結果：${accusedPlayer.name} を告発`, winLog],
      lastLog: winLog,
    };
  }

  const winLog = `告発失敗！${accusedPlayer.name} は庶民でした（真のインサイダーは ${insiderName}）。インサイダーの単独勝利！`;
  return {
    ...state,
    phase: 'finished',
    winnerTeam: 'insider',
    winnerIds: [state.insiderId],
    voteResult,
    timeline: [...state.timeline, `投票結果：${accusedPlayer.name} を告発`, winLog],
    lastLog: winLog,
  };
}

export function applyInsiderAction(
  state: InsiderInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: InsiderInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームはすでに終了しています' };
  }

  const actor = state.players.find((p) => p.id === playerId);
  if (!actor) {
    return { state, error: '参加者が見つかりません' };
  }

  // 1. 役職確認フェーズ
  if (state.subPhase === 'roleReveal') {
    if (action.type === 'confirmRole') {
      const nextPlayers = state.players.map((p) =>
        p.id === playerId ? { ...p, ready: true } : p
      );
      const nextState: InsiderInternalState = { ...state, players: nextPlayers };
      if (nextPlayers.every((p) => p.ready)) {
        return { state: enterQuestionPhase(nextState) };
      }
      const readyCount = nextPlayers.filter((p) => p.ready).length;
      return {
        state: {
          ...nextState,
          lastLog: `役職確認中（${readyCount}/${nextPlayers.length}人 完了）`,
        },
      };
    }

    if (action.type === 'advancePhase') {
      if (!actor.isHost) {
        return { state, error: 'ホストのみ進行できます' };
      }
      const nextPlayers = state.players.map((p) => ({ ...p, ready: true }));
      return { state: enterQuestionPhase({ ...state, players: nextPlayers }) };
    }

    return { state, error: '役職確認フェーズではこの操作はできません' };
  }

  // 2. お題当て質問フェーズ
  if (state.subPhase === 'question') {
    const canControlQuestion = actor.isHost || actor.role === 'master';

    if (action.type === 'markSolved') {
      if (!canControlQuestion) {
        return { state, error: 'マスターまたはホストのみ正解を確定できます' };
      }
      const solverId = (action.payload as { solverId?: string | null })?.solverId ?? null;
      const solver = solverId ? state.players.find((p) => p.id === solverId && p.id !== state.masterId) : null;
      const elapsedSec = state.questionStartedAt
        ? Math.max(1, Math.round((Date.now() - state.questionStartedAt) / 1000))
        : null;
      const discussionEndsAt =
        state.rules.discussionSec > 0 ? Date.now() + state.rules.discussionSec * 1000 : null;

      const solverLabel = solver ? `${solver.name} がお題「${state.secretWord}」を正解！` : `お題「${state.secretWord}」が当てられました！`;
      const log = `${solverLabel} 告発議論を開始し、インサイダーを見つけ出しましょう`;

      return {
        state: {
          ...state,
          subPhase: 'discussion',
          questionEndsAt: null,
          solvedElapsedSec: elapsedSec,
          solverId: solver?.id ?? null,
          solverName: solver?.name ?? null,
          discussionEndsAt,
          timeline: [...state.timeline, log],
          lastLog: log,
        },
      };
    }

    if (action.type === 'markTimeout') {
      if (!canControlQuestion) {
        return { state, error: 'マスターまたはホストのみ時間切れを確定できます' };
      }
      const log = `時間切れ！お題「${state.secretWord}」を当てられなかったため全員敗北です`;
      return {
        state: {
          ...state,
          phase: 'finished',
          winnerTeam: 'none',
          winnerIds: [],
          timedOut: true,
          questionEndsAt: null,
          timeline: [...state.timeline, log],
          lastLog: log,
        },
      };
    }

    return { state, error: '質問タイムではこの操作はできません' };
  }

  // 3. 告発議論フェーズ
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
      const log = '告発投票フェーズ：インサイダーだと思う人を選んでください';
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

    return { state, error: '告発議論フェーズではこの操作はできません' };
  }

  // 4. 投票フェーズ
  if (state.subPhase === 'voting') {
    if (action.type === 'castVote') {
      const targetId = (action.payload as { targetId?: string })?.targetId;
      if (!targetId) {
        return { state, error: '投票先を選んでください' };
      }
      if (targetId === actor.id) {
        return { state, error: '自分自身には投票できません' };
      }
      if (targetId === state.masterId) {
        return { state, error: 'マスターには投票できません' };
      }
      const target = state.players.find((p) => p.id === targetId);
      if (!target) {
        return { state, error: '無効な投票先です' };
      }
      if (state.isRunoff && !state.runoffCandidateIds.includes(targetId)) {
        return { state, error: '決選投票の候補者から選んでください' };
      }

      const nextVotes = { ...state.votes, [actor.id]: targetId };
      const nextState: InsiderInternalState = { ...state, votes: nextVotes };

      if (state.players.every((p) => Boolean(nextVotes[p.id]))) {
        return { state: resolveInsiderVotes(nextState) };
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

  return { state, error: '不明なアクションです' };
}

export function sanitizeInsiderState(
  state: InsiderInternalState,
  playerId: string
): InsiderClientState {
  const me = state.players.find((p) => p.id === playerId) ?? null;
  const isFinished = state.phase === 'finished';
  const masterVisible = state.subPhase !== 'roleReveal' || isFinished;
  const wordPubliclyRevealed =
    isFinished || state.subPhase === 'discussion' || state.subPhase === 'voting';

  const masterPlayer = state.players.find((p) => p.id === state.masterId) ?? null;

  const clientPlayers: InsiderClientPlayer[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    ready: p.ready,
    hasVoted: Boolean(state.votes[p.id]),
    isMaster: masterVisible && p.id === state.masterId,
    ...(isFinished ? { role: p.role } : {}),
  }));

  const knowsSecretWord = me?.role === 'master' || me?.role === 'insider';

  return {
    myId: playerId,
    rules: state.rules,
    players: clientPlayers,
    category: state.category,
    masterId: masterVisible ? state.masterId : null,
    masterName: masterVisible ? (masterPlayer?.name ?? null) : null,
    subPhase: state.subPhase,
    phase: state.phase,
    winnerTeam: state.winnerTeam,
    winnerIds: state.winnerIds,
    questionEndsAt: state.questionEndsAt,
    solvedElapsedSec: state.solvedElapsedSec,
    solverId: state.solverId,
    solverName: state.solverName,
    timedOut: state.timedOut,
    discussionEndsAt: state.discussionEndsAt,
    isRunoff: state.isRunoff,
    runoffCandidateIds: state.runoffCandidateIds,
    voteResult: state.voteResult,
    revealedWord: wordPubliclyRevealed ? state.secretWord : null,
    timeline: state.timeline,
    lastLog: state.lastLog,
    myRole: me?.role ?? null,
    mySecretWord: knowsSecretWord ? state.secretWord : null,
    myReady: me?.ready ?? false,
    myVotedTargetId: me ? (state.votes[me.id] ?? null) : null,
  };
}

export function computeInsiderBotAction(
  _state: InsiderInternalState,
  _botId: string
): { type: string; payload?: unknown } | null {
  return null;
}
