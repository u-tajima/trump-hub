import type { HitAndBlowRules, PlayerInfo } from '../types/game';

export interface HitAndBlowPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  attempts: number;
}

export interface HitAndBlowEntry {
  attempt: number;
  playerId: string;
  playerName: string;
  guess: number[];
  hit: number;
  blow: number;
}

export interface HitAndBlowInternalState {
  rules: HitAndBlowRules;
  players: HitAndBlowPlayerState[];
  secret: number[];
  history: HitAndBlowEntry[];
  turnIndex: number;
  winnerId: string | 'draw' | 'lose' | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface HitAndBlowClientState {
  rules: HitAndBlowRules;
  players: HitAndBlowPlayerState[];
  history: HitAndBlowEntry[];
  turnIndex: number;
  winnerId: string | 'draw' | 'lose' | null;
  phase: 'playing' | 'finished';
  lastLog: string;
  myId: string;
  /** 決着時のみ公開される秘密の数字列 */
  revealedSecret: number[] | null;
}

function generateSecret(digits: number): number[] {
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, digits);
}

export function evaluateHitAndBlow(
  secret: number[],
  guess: number[]
): { hit: number; blow: number } {
  let hit = 0;
  let blow = 0;
  for (let i = 0; i < secret.length; i++) {
    if (guess[i] === secret[i]) {
      hit++;
    } else if (secret.includes(guess[i])) {
      blow++;
    }
  }
  return { hit, blow };
}

export function initHitAndBlow(
  playersInfo: PlayerInfo[],
  rules: HitAndBlowRules
): HitAndBlowInternalState {
  const players: HitAndBlowPlayerState[] = playersInfo.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    attempts: 0,
  }));

  const secret = generateSecret(rules.digits);

  return {
    rules,
    players,
    secret,
    history: [],
    turnIndex: 0,
    winnerId: null,
    phase: 'playing',
    lastLog:
      players.length === 1
        ? `重複なしの ${rules.digits}桁の数字を当ててください`
        : `${players[0].name} の推理からスタート（${rules.digits}桁）`,
  };
}

export function applyHitAndBlowAction(
  state: HitAndBlowInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: HitAndBlowInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }
  const current = state.players[state.turnIndex];
  if (current.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }
  if (action.type !== 'guess') {
    return { state, error: '不明なアクションです' };
  }

  const { digits } = (action.payload as { digits?: number[] }) ?? {};
  if (!Array.isArray(digits) || digits.length !== state.rules.digits) {
    return { state, error: `${state.rules.digits}桁の数字を入力してください` };
  }
  const seen = new Set<number>();
  for (const d of digits) {
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 9) {
      return { state, error: '0〜9の数字を入力してください' };
    }
    if (seen.has(d)) {
      return { state, error: '同じ数字は重複して使えません' };
    }
    seen.add(d);
  }

  const { hit, blow } = evaluateHitAndBlow(state.secret, digits);
  const entry: HitAndBlowEntry = {
    attempt: state.history.length + 1,
    playerId: current.id,
    playerName: current.name,
    guess: [...digits],
    hit,
    blow,
  };

  const history = [...state.history, entry];
  const players = state.players.map((p, idx) =>
    idx === state.turnIndex ? { ...p, attempts: p.attempts + 1 } : p
  );

  const guessStr = digits.join('');

  // 完全一致で勝利
  if (hit === state.rules.digits) {
    return {
      state: {
        ...state,
        players,
        history,
        winnerId: current.id,
        phase: 'finished',
        lastLog: `${current.name} が「${guessStr}」で完全一致！クリア！`,
      },
    };
  }

  // 最大試行回数チェック
  const maxPerPlayer = state.rules.maxAttempts;
  if (maxPerPlayer > 0) {
    const allExhausted = players.every((p) => p.attempts >= maxPerPlayer);
    if (allExhausted) {
      const isSolo = players.length === 1;
      return {
        state: {
          ...state,
          players,
          history,
          winnerId: isSolo ? 'lose' : 'draw',
          phase: 'finished',
          lastLog: isSolo
            ? `手数上限に到達しました。正解は「${state.secret.join('')}」`
            : `引き分け！正解は「${state.secret.join('')}」`,
        },
      };
    }
  }

  const nextTurnIndex = (state.turnIndex + 1) % players.length;
  const nextPlayer = players[nextTurnIndex];
  const log =
    players.length === 1
      ? `${guessStr} -> ${hit} HIT / ${blow} BLOW`
      : `${current.name}: ${guessStr} (${hit}H ${blow}B) / 次は ${nextPlayer.name}`;

  return {
    state: {
      ...state,
      players,
      history,
      turnIndex: nextTurnIndex,
      lastLog: log,
    },
  };
}

function generateAllPermutations(digits: number): number[][] {
  const result: number[][] = [];
  const used = new Array<boolean>(10).fill(false);
  const current: number[] = [];

  function backtrack() {
    if (current.length === digits) {
      result.push([...current]);
      return;
    }
    for (let d = 0; d <= 9; d++) {
      if (used[d]) continue;
      used[d] = true;
      current.push(d);
      backtrack();
      current.pop();
      used[d] = false;
    }
  }

  backtrack();
  return result;
}

export function computeHitAndBlowBotAction(
  state: HitAndBlowInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  const current = state.players[state.turnIndex];
  if (!current?.isBot) return null;

  // 初手はランダムに生成
  if (state.history.length === 0) {
    return { type: 'guess', payload: { digits: generateSecret(state.rules.digits) } };
  }

  // 全候補から過去の全履歴に矛盾しない候補を絞り込む
  const all = generateAllPermutations(state.rules.digits);
  const consistent = all.filter((candidate) =>
    state.history.every((h) => {
      const res = evaluateHitAndBlow(candidate, h.guess);
      return res.hit === h.hit && res.blow === h.blow;
    })
  );

  const pick =
    consistent.length > 0
      ? consistent[Math.floor(Math.random() * consistent.length)]
      : generateSecret(state.rules.digits);

  return { type: 'guess', payload: { digits: pick } };
}

export function sanitizeHitAndBlowState(
  state: HitAndBlowInternalState,
  playerId: string
): HitAndBlowClientState {
  return {
    rules: state.rules,
    players: state.players,
    history: state.history,
    turnIndex: state.turnIndex,
    winnerId: state.winnerId,
    phase: state.phase,
    lastLog: state.lastLog,
    myId: playerId,
    revealedSecret: state.phase === 'finished' ? [...state.secret] : null,
  };
}
