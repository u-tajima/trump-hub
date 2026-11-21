import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  Edit3,
  History,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  getScoreBoardZeroSumInfo,
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
  myPlayerName?: string;
  unitStep?: number;
  zeroSumCheck?: boolean;
}

export const ScoreBoardPanel: React.FC<ScoreBoardPanelProps> = ({
  board,
  onOp,
  isRoomMode = false,
  canRestoreSaved = true,
  roomPlayerNames,
  myPlayerName,
  unitStep = 1,
  zeroSumCheck = true,
}) => {
  const [newName, setNewName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSavedPicker, setShowSavedPicker] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // 「自分」としてマークするエントリーID（未指定時は myPlayerName と一致するメンバーを自動選択）
  const [manualMyId, setManualMyId] = useState<string | null>(null);

  // 点数を押して展開中のエントリーID（null のときは全行閉じてスッキリ表示）
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

  // 点数操作パネル内の入力ステート
  const [deltaInput, setDeltaInput] = useState<string>('');
  const [counterpartyId, setCounterpartyId] = useState<string>('');
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameDraft, setEditingNameDraft] = useState<string>('');

  const myEntry = useMemo(() => {
    if (board.entries.length === 0) return null;
    if (manualMyId) {
      const found = board.entries.find((e) => e.id === manualMyId);
      if (found) return found;
    }
    if (myPlayerName?.trim()) {
      const clean = myPlayerName.trim();
      const byName = board.entries.find((e) => e.name === clean);
      if (byName) return byName;
    }
    return board.entries[0];
  }, [board.entries, manualMyId, myPlayerName]);

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

  // 自分の行を先頭に、他は現在の並び順で表示
  const orderedEntries = useMemo(() => {
    if (!myEntry) return board.entries;
    const mine = board.entries.filter((e) => e.id === myEntry.id);
    const others = board.entries.filter((e) => e.id !== myEntry.id);
    return [...mine, ...others];
  }, [board.entries, myEntry]);

  const zeroSumInfo = useMemo(() => getScoreBoardZeroSumInfo(board), [board]);

  const step = Math.max(1, unitStep);
  const quickMagnitudes = useMemo(() => [1 * step, 5 * step, 10 * step, 50 * step], [step]);

  const remainHours = Math.max(1, Math.ceil((board.expiresAt - Date.now()) / (60 * 60 * 1000)));
  const remainDaysText =
    remainHours >= 24 ? `${Math.ceil(remainHours / 24)}日保存` : `${remainHours}時間保存`;

  const toggleActiveEntry = (entryId: string) => {
    if (activeEntryId === entryId) {
      setActiveEntryId(null);
      setEditingNameId(null);
    } else {
      setActiveEntryId(entryId);
      setDeltaInput('');
      setCounterpartyId('');
      setEditingNameId(null);
    }
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onOp({ type: 'addEntry', name: trimmed });
    setNewName('');
    setShowAddForm(false);
  };

  const handleApplyDelta = (targetEntryId: string, signedDelta: number) => {
    if (!Number.isFinite(signedDelta) || signedDelta === 0) return;
    const val = Math.trunc(signedDelta);
    if (counterpartyId && counterpartyId !== targetEntryId) {
      const targetExists = board.entries.some((e) => e.id === counterpartyId);
      if (targetExists) {
        if (val > 0) {
          onOp({
            type: 'transferScore',
            fromEntryId: counterpartyId,
            toEntryId: targetEntryId,
            amount: val,
          });
        } else {
          onOp({
            type: 'transferScore',
            fromEntryId: targetEntryId,
            toEntryId: counterpartyId,
            amount: Math.abs(val),
          });
        }
        return;
      }
    }
    onOp({ type: 'addDelta', entryId: targetEntryId, delta: val });
  };

  const handleCustomCommit = (targetEntryId: string, mode: 'add' | 'sub' | 'set') => {
    const raw = Number(deltaInput);
    if (!Number.isFinite(raw)) return;
    const val = Math.trunc(raw);
    if (mode === 'set') {
      onOp({ type: 'setScore', entryId: targetEntryId, score: val });
    } else if (val !== 0) {
      const absVal = Math.abs(val);
      handleApplyDelta(targetEntryId, mode === 'add' ? absVal : -absVal);
    }
    setDeltaInput('');
  };

  const handleBumpInput = (addAmt: number) => {
    const cur = Number(deltaInput) || 0;
    const next = Math.max(0, Math.trunc(cur) + addAmt);
    setDeltaInput(next > 0 ? String(next) : '');
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

  const missingRoomMembersCount = useMemo(() => {
    if (!isRoomMode || !roomPlayerNames || roomPlayerNames.length === 0) return 0;
    const existingNames = new Set(board.entries.map((e) => e.name));
    return roomPlayerNames.filter((n) => !existingNames.has(n)).length;
  }, [isRoomMode, roomPlayerNames, board.entries]);

  const parsedInput = Math.abs(Math.trunc(Number(deltaInput) || 0));
  const hasRawInput = deltaInput.trim() !== '' && Number.isFinite(Number(deltaInput));

  return (
    <div className="scoreboard-wrap">
      {/* ゼロサム不一致のときだけ目立つ警告バナーを表示 */}
      {zeroSumCheck && board.entries.length > 0 && !zeroSumInfo.isZeroSum && (
        <div className="scoreboard-zerosum-alert warning" role="status">
          <div className="zerosum-warn-content">
            <div className="zerosum-warn-head">
              <AlertTriangle size={16} />
              <span>
                ゼロサム不一致（合計差額:{' '}
                <strong>
                  {zeroSumInfo.totalDelta > 0
                    ? `+${zeroSumInfo.totalDelta}`
                    : zeroSumInfo.totalDelta}
                  点
                </strong>
                ）
              </span>
            </div>
            {myEntry && (
              <button
                type="button"
                className="zerosum-fix-btn"
                onClick={() =>
                  onOp({
                    type: 'addDelta',
                    entryId: myEntry.id,
                    delta: -zeroSumInfo.totalDelta,
                  })
                }
              >
                {myEntry.name} に差額{' '}
                {-zeroSumInfo.totalDelta > 0
                  ? `+${-zeroSumInfo.totalDelta}`
                  : -zeroSumInfo.totalDelta}
                点 を反映して精算
              </button>
            )}
          </div>
        </div>
      )}

      {/* コンパクトな上部ステータス＆アクションバー */}
      <div className="scoreboard-toolbar">
        <div className="scoreboard-status-chips">
          {zeroSumCheck && board.entries.length > 0 && zeroSumInfo.isZeroSum && (
            <span className="sb-mini-pill ok">
              <CheckCircle2 size={12} /> ゼロサム ±0
            </span>
          )}
          <span className="sb-mini-pill muted">
            <Clock size={11} /> {remainDaysText}
          </span>
        </div>

        <div className="scoreboard-action-chips">
          <button
            type="button"
            className={`sb-tool-btn ${showAddForm ? 'active' : ''}`}
            onClick={() => setShowAddForm((v) => !v)}
          >
            <Plus size={13} /> メンバー追加
          </button>
          {missingRoomMembersCount > 0 && (
            <button
              type="button"
              className="sb-tool-btn accent"
              onClick={handleSyncRoomMembers}
            >
              <UserPlus size={13} /> 参加者反映({missingRoomMembersCount})
            </button>
          )}
          {canRestoreSaved && (
            <button
              type="button"
              className={`sb-tool-btn ${showSavedPicker ? 'active' : ''}`}
              onClick={() => setShowSavedPicker((v) => !v)}
              title="保存済みデータから復元"
            >
              <History size={13} /> 復元
            </button>
          )}
          {board.entries.length > 0 && (
            <button
              type="button"
              className="sb-tool-btn"
              onClick={() => onOp({ type: 'resetScores' })}
              title="全員の点数を初期値に戻す"
            >
              <RotateCcw size={13} /> リセット
            </button>
          )}
        </div>
      </div>

      {/* 折りたたみ：メンバー追加フォーム */}
      {showAddForm && (
        <form className="scoreboard-add-row" onSubmit={handleAddMember}>
          <input
            type="text"
            className="tool-item-input"
            maxLength={14}
            placeholder="追加するメンバー名…"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="chip-btn accent" disabled={!newName.trim()}>
            追加
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => setShowAddForm(false)}
          >
            閉じる
          </button>
        </form>
      )}

      {/* 折りたたみ：履歴復元ピッカー */}
      {showSavedPicker && (
        <div className="sb-sub-panel">
          <div className="sb-sub-panel-title">3日以内に保存された得点表から読み込み</div>
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

      {/* 操作ヒント（まだ誰も開いていないときのみ控えめに1行表示） */}
      {board.entries.length > 0 && !activeEntryId && (
        <div className="sb-tap-guide">点数をタップすると加減点パネルが開きます</div>
      )}

      {/* スッキリした得点一覧（点数をタップするとその下に操作ドロワーが展開） */}
      <div className="scoreboard-entry-list">
        {orderedEntries.length === 0 ? (
          <div className="sb-empty-box">
            <div>メンバーがまだ登録されていません</div>
            <button
              type="button"
              className="chip-btn accent"
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={14} /> メンバーを追加する
            </button>
          </div>
        ) : (
          orderedEntries.map((entry) => {
            const rank = rankById.get(entry.id) ?? 1;
            const isTop = rank === 1 && entry.score > zeroSumInfo.baseScore;
            const isMe = myEntry?.id === entry.id;
            const isOpen = activeEntryId === entry.id;
            const net = entry.score - zeroSumInfo.baseScore;
            const isEditingName = editingNameId === entry.id;

            return (
              <div
                key={entry.id}
                className={`sb-card ${isMe ? 'is-me' : ''} ${isTop ? 'is-top' : ''} ${
                  isOpen ? 'is-open' : ''
                }`}
              >
                {/* 1行メイン行：順位・名前・点数ボタン */}
                <div className="sb-card-main">
                  <div className="sb-card-identity">
                    <span className={`sb-rank-badge ${isTop ? 'first' : ''}`}>
                      {isTop ? <Crown size={13} /> : rank}
                    </span>

                    <div className="sb-name-wrap">
                      <span className="sb-player-name">{entry.name}</span>
                      {isMe && <span className="sb-me-chip">自分</span>}
                    </div>
                  </div>

                  {/* 点数ボタン（ここを押すと操作パネルが開閉） */}
                  <button
                    type="button"
                    className={`sb-score-trigger ${
                      net > 0 ? 'plus' : net < 0 ? 'minus' : ''
                    } ${isOpen ? 'active' : ''}`}
                    onClick={() => toggleActiveEntry(entry.id)}
                    aria-expanded={isOpen}
                    title="タップして点数を操作"
                  >
                    <div className="sb-score-num-group">
                      <span className="sb-score-number">{entry.score.toLocaleString()}</span>
                      <span className="sb-score-unit">点</span>
                      {zeroSumInfo.baseScore !== 0 && (
                        <span className="sb-score-diff">
                          ({net > 0 ? `+${net}` : net})
                        </span>
                      )}
                    </div>
                    <span className="sb-score-caret">
                      {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </button>
                </div>

                {/* 点数を押したときだけ出てくる操作ドロワー */}
                {isOpen && (
                  <div className="sb-drawer">
                    {/* クイック加減点ボタン（上段：加点 / 下段：減点） */}
                    <div className="sb-quick-grid">
                      <div className="sb-quick-row">
                        {quickMagnitudes.map((m) => (
                          <button
                            key={`plus-${m}`}
                            type="button"
                            className="sb-quick-btn plus"
                            onClick={() => handleApplyDelta(entry.id, m)}
                          >
                            +{m}
                          </button>
                        ))}
                      </div>
                      <div className="sb-quick-row">
                        {quickMagnitudes.map((m) => (
                          <button
                            key={`minus-${m}`}
                            type="button"
                            className="sb-quick-btn minus"
                            onClick={() => handleApplyDelta(entry.id, -m)}
                          >
                            -{m}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 任意の点数入力＆加減算 */}
                    <div className="sb-custom-box">
                      <div className="sb-custom-input-row">
                        <input
                          type="number"
                          inputMode="numeric"
                          className="sb-delta-input"
                          placeholder="点数を入力 (例: 30)"
                          value={deltaInput}
                          onChange={(e) => setDeltaInput(e.target.value)}
                        />
                        {quickMagnitudes.slice(0, 3).map((m) => (
                          <button
                            key={`bump-${m}`}
                            type="button"
                            className="sb-bump-btn"
                            onClick={() => handleBumpInput(m)}
                          >
                            +{m}
                          </button>
                        ))}
                        {deltaInput && (
                          <button
                            type="button"
                            className="sb-bump-btn"
                            onClick={() => setDeltaInput('')}
                            aria-label="入力クリア"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      <div className="sb-commit-row">
                        <button
                          type="button"
                          className="sb-commit-btn minus"
                          disabled={parsedInput === 0}
                          onClick={() => handleCustomCommit(entry.id, 'sub')}
                        >
                          <Minus size={14} />
                          {parsedInput > 0 ? `-${parsedInput} 減らす` : '減らす'}
                        </button>
                        <button
                          type="button"
                          className="sb-commit-btn plus"
                          disabled={parsedInput === 0}
                          onClick={() => handleCustomCommit(entry.id, 'add')}
                        >
                          <Plus size={14} />
                          {parsedInput > 0 ? `+${parsedInput} 増やす` : '増やす'}
                        </button>
                        <button
                          type="button"
                          className="sb-commit-btn neutral"
                          disabled={!hasRawInput}
                          onClick={() => handleCustomCommit(entry.id, 'set')}
                          title="入力した数値に直接変更"
                        >
                          直接設定
                        </button>
                      </div>
                    </div>

                    {/* 相手との連動ゼロサム移動（2人以上のとき） */}
                    {board.entries.length > 1 && (
                      <div className="sb-transfer-row">
                        <span className="sb-transfer-label">
                          <ArrowRightLeft size={12} /> 相手と同時精算:
                        </span>
                        <select
                          className="sb-transfer-select"
                          value={counterpartyId}
                          onChange={(e) => setCounterpartyId(e.target.value)}
                        >
                          <option value="">なし（この人のみ変動）</option>
                          {board.entries
                            .filter((e) => e.id !== entry.id)
                            .map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name} とゼロサム移動
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    {/* サブ操作フッター（自分に設定・名前変更・削除・閉じる） */}
                    <div className="sb-drawer-footer">
                      {isEditingName ? (
                        <div className="sb-rename-inline">
                          <input
                            type="text"
                            className="sb-rename-input"
                            maxLength={14}
                            value={editingNameDraft}
                            autoFocus
                            onChange={(e) => setEditingNameDraft(e.target.value)}
                          />
                          <button
                            type="button"
                            className="sb-sub-btn accent"
                            onClick={() => {
                              const trimmed = editingNameDraft.trim();
                              if (trimmed && trimmed !== entry.name) {
                                onOp({ type: 'renameEntry', entryId: entry.id, name: trimmed });
                              }
                              setEditingNameId(null);
                            }}
                          >
                            <Check size={12} /> 保存
                          </button>
                          <button
                            type="button"
                            className="sb-sub-btn"
                            onClick={() => setEditingNameId(null)}
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="sb-drawer-sub-left">
                            {!isMe && (
                              <button
                                type="button"
                                className="sb-sub-btn"
                                onClick={() => setManualMyId(entry.id)}
                              >
                                <UserCheck size={12} /> 自分に設定
                              </button>
                            )}
                            <button
                              type="button"
                              className="sb-sub-btn"
                              onClick={() => {
                                setEditingNameId(entry.id);
                                setEditingNameDraft(entry.name);
                              }}
                            >
                              <Edit3 size={12} /> 名前変更
                            </button>
                            <button
                              type="button"
                              className="sb-sub-btn danger"
                              onClick={() => {
                                onOp({ type: 'removeEntry', entryId: entry.id });
                                setActiveEntryId(null);
                              }}
                            >
                              <Trash2 size={12} /> 削除
                            </button>
                          </div>
                          <button
                            type="button"
                            className="sb-sub-btn"
                            onClick={() => setActiveEntryId(null)}
                          >
                            閉じる
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 編集履歴（折りたたみで普段は1行のみ） */}
      {board.logs.length > 0 && (
        <div className="sb-history-section">
          <button
            type="button"
            className="sb-history-toggle"
            onClick={() => setShowLogs((v) => !v)}
          >
            <span className="sb-history-latest">
              <History size={12} />
              最新: <strong>{board.logs[0].actor}</strong> — {board.logs[0].text}
            </span>
            <span className="sb-history-more">
              {showLogs ? '閉じる' : `履歴(${board.logs.length})`}
            </span>
          </button>

          {showLogs && (
            <div className="scoreboard-log-list">
              {board.logs.slice(0, 16).map((log) => (
                <div key={log.id} className="scoreboard-log-item">
                  <span>
                    <strong>{log.actor}</strong>: {log.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
