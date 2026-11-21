export const SCOREBOARD_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3日間 (72時間)
const STORAGE_PREFIX = 'table_hub_scoreboard_v1_';

export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
}

export interface ScoreLogItem {
  id: string;
  ts: number;
  actor: string;
  text: string;
}

export interface ScoreBoardState {
  id: string;        // 'tool' または `room_${roomCode}`
  title: string;     // 例: 'ツール得点表' / '部屋 A7K2P'
  entries: ScoreEntry[];
  logs: ScoreLogItem[];
  updatedAt: number;
  expiresAt: number;
}

export type ScoreBoardOp =
  | { type: 'addEntry'; name: string }
  | { type: 'removeEntry'; entryId: string }
  | { type: 'renameEntry'; entryId: string; name: string }
  | { type: 'addDelta'; entryId: string; delta: number }
  | { type: 'setScore'; entryId: string; score: number }
  | { type: 'resetScores' }
  | { type: 'replaceEntries'; entries: ScoreEntry[] };

export function createEmptyScoreBoard(
  id: string,
  title: string,
  initialNames: string[] = []
): ScoreBoardState {
  const now = Date.now();
  const entries: ScoreEntry[] = initialNames.map((name, i) => ({
    id: `se-${now}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || `プレイヤー${i + 1}`,
    score: 0,
  }));
  return {
    id,
    title,
    entries,
    logs: [],
    updatedAt: now,
    expiresAt: now + SCOREBOARD_TTL_MS,
  };
}

export function applyScoreBoardOp(
  board: ScoreBoardState,
  op: ScoreBoardOp,
  actor = '誰か'
): ScoreBoardState {
  const now = Date.now();
  let entries = board.entries;
  let logText = '';

  switch (op.type) {
    case 'addEntry': {
      const clean = op.name.trim().slice(0, 14) || `メンバー${board.entries.length + 1}`;
      const newEntry: ScoreEntry = {
        id: `se-${now}-${Math.random().toString(36).slice(2, 7)}`,
        name: clean,
        score: 0,
      };
      entries = [...board.entries, newEntry];
      logText = `${clean} を追加`;
      break;
    }
    case 'removeEntry': {
      const target = board.entries.find((e) => e.id === op.entryId);
      if (!target) return board;
      entries = board.entries.filter((e) => e.id !== op.entryId);
      logText = `${target.name} を削除`;
      break;
    }
    case 'renameEntry': {
      const clean = op.name.trim().slice(0, 14);
      if (!clean) return board;
      entries = board.entries.map((e) => (e.id === op.entryId ? { ...e, name: clean } : e));
      logText = `名前を ${clean} に変更`;
      break;
    }
    case 'addDelta': {
      const delta = Math.trunc(op.delta);
      if (!Number.isFinite(delta) || delta === 0) return board;
      const target = board.entries.find((e) => e.id === op.entryId);
      if (!target) return board;
      entries = board.entries.map((e) =>
        e.id === op.entryId ? { ...e, score: e.score + delta } : e
      );
      logText = `${target.name} ${delta > 0 ? `+${delta}` : delta} (${target.score + delta})`;
      break;
    }
    case 'setScore': {
      const score = Math.trunc(op.score);
      if (!Number.isFinite(score)) return board;
      const target = board.entries.find((e) => e.id === op.entryId);
      if (!target) return board;
      entries = board.entries.map((e) => (e.id === op.entryId ? { ...e, score } : e));
      logText = `${target.name} を ${score}点 に設定`;
      break;
    }
    case 'resetScores': {
      entries = board.entries.map((e) => ({ ...e, score: 0 }));
      logText = '全員の得点を0にリセット';
      break;
    }
    case 'replaceEntries': {
      entries = op.entries.map((e) => ({
        id: e.id,
        name: e.name.trim().slice(0, 14) || 'メンバー',
        score: Math.trunc(e.score) || 0,
      }));
      logText = '保存済み得点表を読み込み';
      break;
    }
  }

  const nextLogs: ScoreLogItem[] = logText
    ? [
        {
          id: `sl-${now}-${Math.random().toString(36).slice(2, 6)}`,
          ts: now,
          actor,
          text: logText,
        },
        ...board.logs,
      ].slice(0, 30)
    : board.logs;

  return {
    ...board,
    entries,
    logs: nextLogs,
    updatedAt: now,
    expiresAt: now + SCOREBOARD_TTL_MS,
  };
}

export function purgeExpiredScoreBoards(): void {
  try {
    const now = Date.now();
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as Partial<ScoreBoardState>;
        if (!parsed.expiresAt || parsed.expiresAt <= now) {
          keysToRemove.push(key);
        }
      } catch {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore storage errors
  }
}

export function saveScoreBoardToStorage(board: ScoreBoardState): void {
  try {
    purgeExpiredScoreBoards();
    const withExpiry: ScoreBoardState = {
      ...board,
      updatedAt: Date.now(),
      expiresAt: Date.now() + SCOREBOARD_TTL_MS,
    };
    localStorage.setItem(`${STORAGE_PREFIX}${board.id}`, JSON.stringify(withExpiry));
  } catch {
    // ignore quota errors
  }
}

export function loadScoreBoardFromStorage(id: string): ScoreBoardState | null {
  try {
    const key = `${STORAGE_PREFIX}${id}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScoreBoardState;
    if (!parsed || !Array.isArray(parsed.entries)) return null;
    if (!parsed.expiresAt || parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function listSavedScoreBoards(): ScoreBoardState[] {
  try {
    purgeExpiredScoreBoards();
    const list: ScoreBoardState[] = [];
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as ScoreBoardState;
        if (parsed && Array.isArray(parsed.entries) && parsed.expiresAt > now) {
          list.push(parsed);
        }
      } catch {
        // skip
      }
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}
