import React, { useMemo, useState } from 'react';
import {
  Clock,
  Crown,
  History,
  Plus,
  RotateCcw,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  listSavedScoreBoards,
  type ScoreBoardOp,
  type ScoreBoardState,
} from '../../utils/scoreBoard';
import './ScoreBoardPanel.css';

interface ScoreBoardPanelProps {
  board: ScoreBoardState;
  onOp: (op: ScoreBoardOp) => void;
  isRoomMode?: boolean;
  canRestoreSaved?: boolean;
  roomPlayerNames?: string[];
}

export const ScoreBoardPanel: React.FC<ScoreBoardPanelProps> = ({
  board,
  onOp,
  isRoomMode = false,
  canRestoreSaved = true,
  roomPlayerNames,
}) => {
  const [newName, setNewName] = useState('');
  const [customByEntry, setCustomByEntry] = useState<Record<string, string>>({});
  const [showSavedPicker, setShowSavedPicker] = useState(false);

  const savedBoards = useMemo(() => {
    if (!showSavedPicker) return [];
    return listSavedScoreBoards().filter((b) => b.id !== board.id && b.entries.length > 0);
  }, [showSavedPicker, board.id]);

  // 順位計算（同点は同順位）
  const rankById = useMemo(() => {
    const sorted = [...board.entries].sort((a, b) => b.score - a.score);
    const map = new Map<string, number>();
    let rank = 1;
    sorted.forEach((entry, idx) => {
      if (idx > 0 && entry.score < sorted[idx - 1].score) {
        rank = idx + 1;
      }
      map.set(entry.id, rank);
    });
    return map;
  }, [board.entries]);

  const remainHours = Math.max(1, Math.ceil((board.expiresAt - Date.now()) / (60 * 60 * 1000)));
  const remainDaysText =
    remainHours >= 24
      ? `約${Math.ceil(remainHours / 24)}日間保持`
      : `残り約${remainHours}時間保持`;

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onOp({ type: 'addEntry', name: trimmed });
    setNewName('');
  };

  const handleCustomApply = (entryId: string, mode: 'add' | 'sub' | 'set') => {
    const raw = Number(customByEntry[entryId]);
    if (!Number.isFinite(raw)) return;
    const val = Math.trunc(raw);
    if (mode === 'set') {
      onOp({ type: 'setScore', entryId, score: val });
    } else if (val !== 0) {
      onOp({ type: 'addDelta', entryId, delta: mode === 'add' ? Math.abs(val) : -Math.abs(val) });
    }
    setCustomByEntry((prev) => ({ ...prev, [entryId]: '' }));
  };

  const handleSyncRoomMembers = () => {
    if (!roomPlayerNames || roomPlayerNames.length === 0) return;
    const existingNames = new Set(board.entries.map((e) => e.name));
    for (const name of roomPlayerNames) {
      if (!existingNames.has(name)) {
        onOp({ type: 'addEntry', name });
      }
    }
  };

  return (
    <div className="scoreboard-wrap">
      <div className="scoreboard-meta-bar">
        <div className="scoreboard-badge-row">
          {isRoomMode && (
            <span className="flag-badge info">
              <Users size={11} /> 全員で同時編集OK
            </span>
          )}
          <span className="flag-badge warn">
            <Clock size={11} /> {isRoomMode ? `ホスト端末に${remainDaysText}` : `ブラウザに${remainDaysText}`}
          </span>
        </div>
        <div className="scoreboard-badge-row">
          {canRestoreSaved && (
            <button
              type="button"
              className="chip-btn"
              onClick={() => setShowSavedPicker((v) => !v)}
            >
              <History size={12} />
              履歴復元
            </button>
          )}
          <button
            type="button"
            className="chip-btn"
            disabled={board.entries.length === 0}
            onClick={() => onOp({ type: 'resetScores' })}
          >
            <RotateCcw size={12} />
            0点に戻す
          </button>
        </div>
      </div>

      {showSavedPicker && (
        <div className="card-panel">
          <div className="panel-title" style={{ fontSize: 12, marginBottom: 6 }}>
            3日以内に保存された得点表から読み込み
          </div>
          {savedBoards.length === 0 ? (
            <div className="text-muted-sm">他の保存済み得点表はありません</div>
          ) : (
            <div className="scoreboard-restore-list">
              {savedBoards.map((sb) => (
                <button
                  key={sb.id}
                  type="button"
                  className="chip-btn accent"
                  onClick={() => {
                    onOp({ type: 'replaceEntries', entries: sb.entries });
                    setShowSavedPicker(false);
                  }}
                >
                  {sb.title} ({sb.entries.length}名)
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* メンバー追加 */}
      <form className="scoreboard-add-row" onSubmit={handleAddMember}>
        <input
          type="text"
          className="tool-item-input"
          maxLength={14}
          placeholder="メンバー名を入力…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="chip-btn accent" disabled={!newName.trim()}>
          <Plus size={14} />
          追加
        </button>
        {isRoomMode && roomPlayerNames && roomPlayerNames.length > 0 && (
          <button
            type="button"
            className="chip-btn"
            onClick={handleSyncRoomMembers}
            title="部屋の参加メンバーを追加"
          >
            <UserPlus size={14} />
            参加者反映
          </button>
        )}
      </form>

      {/* 得点リスト */}
      <div className="scoreboard-entry-list">
        {board.entries.length === 0 ? (
          <div className="card-panel text-muted-sm" style={{ textAlign: 'center' }}>
            メンバーを追加して得点管理を始めましょう
          </div>
        ) : (
          board.entries.map((entry) => {
            const rank = rankById.get(entry.id) ?? 1;
            const isTop = rank === 1 && entry.score > 0;
            const customVal = customByEntry[entry.id] ?? '';
            return (
              <div key={entry.id} className={`scoreboard-entry ${isTop ? 'top-rank' : ''}`}>
                <div className="scoreboard-entry-head">
                  <div className="scoreboard-entry-left">
                    <span className={`scoreboard-rank ${isTop ? 'first' : ''}`}>
                      {isTop ? <Crown size={13} /> : rank}
                    </span>
                    <input
                      type="text"
                      className="scoreboard-name-input"
                      maxLength={14}
                      defaultValue={entry.name}
                      key={`${entry.id}-${entry.name}`}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val && val !== entry.name) {
                          onOp({ type: 'renameEntry', entryId: entry.id, name: val });
                        }
                      }}
                    />
                  </div>
                  <div
                    className={`scoreboard-score-val ${
                      entry.score > 0 ? 'plus' : entry.score < 0 ? 'minus' : ''
                    }`}
                  >
                    {entry.score}
                  </div>
                  <button
                    type="button"
                    className="icon-danger-btn"
                    onClick={() => onOp({ type: 'removeEntry', entryId: entry.id })}
                    aria-label={`${entry.name} を削除`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* クイック加減点 */}
                <div className="scoreboard-quick-row">
                  {[-10, -1, 1, 5, 10].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`score-delta-btn ${d > 0 ? 'plus' : 'minus'}`}
                      onClick={() => onOp({ type: 'addDelta', entryId: entry.id, delta: d })}
                    >
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                </div>

                {/* 任意数値入力 */}
                <div className="scoreboard-custom-row">
                  <input
                    type="number"
                    inputMode="numeric"
                    className="scoreboard-custom-input"
                    placeholder="任意点数"
                    value={customVal}
                    onChange={(e) =>
                      setCustomByEntry((prev) => ({ ...prev, [entry.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="chip-btn"
                    disabled={!customVal}
                    onClick={() => handleCustomApply(entry.id, 'sub')}
                  >
                    減算
                  </button>
                  <button
                    type="button"
                    className="chip-btn accent"
                    disabled={!customVal}
                    onClick={() => handleCustomApply(entry.id, 'add')}
                  >
                    加算
                  </button>
                  <button
                    type="button"
                    className="chip-btn"
                    disabled={!customVal}
                    onClick={() => handleCustomApply(entry.id, 'set')}
                  >
                    直接設定
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 変更ログ */}
      {board.logs.length > 0 && (
        <div className="card-panel">
          <div className="panel-title" style={{ fontSize: 12, marginBottom: 6 }}>
            編集履歴
          </div>
          <div className="scoreboard-log-list">
            {board.logs.slice(0, 12).map((log) => (
              <div key={log.id} className="scoreboard-log-item">
                <span>
                  <strong>{log.actor}</strong>: {log.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
