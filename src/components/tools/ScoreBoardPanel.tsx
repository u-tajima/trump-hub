import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Crown,
  History,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
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
  const [customByEntry, setCustomByEntry] = useState<Record<string, string>>({});
  const [showSavedPicker, setShowSavedPicker] = useState(false);

  // 「自分」として操作する対象エントリーID（未指定時は myPlayerName と一致するメンバーを自動選択）
  const [manualMyId, setManualMyId] = useState<string | null>(null);
  // 自分の変動値入力用ステート
  const [myDeltaInput, setMyDeltaInput] = useState<string>('');
  const [counterpartyId, setCounterpartyId] = useState<string>('');

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

  const zeroSumInfo = useMemo(() => getScoreBoardZeroSumInfo(board), [board]);

  const step = Math.max(1, unitStep);
  const quickMagnitudes = useMemo(() => [1 * step, 5 * step, 10 * step, 50 * step], [step]);
  const rowQuickDeltas = useMemo(
    () => [-10 * step, -1 * step, 1 * step, 5 * step, 10 * step],
    [step]
  );

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

  const handleApplyMyDelta = (signedDelta: number) => {
    if (!myEntry || !Number.isFinite(signedDelta) || signedDelta === 0) return;
    const val = Math.trunc(signedDelta);
    if (counterpartyId && counterpartyId !== myEntry.id) {
      const targetExists = board.entries.some((e) => e.id === counterpartyId);
      if (targetExists) {
        // 自分が +val なら相手から自分へ val 移動、自分が -val なら自分から相手へ |val| 移動
        if (val > 0) {
          onOp({
            type: 'transferScore',
            fromEntryId: counterpartyId,
            toEntryId: myEntry.id,
            amount: val,
          });
        } else {
          onOp({
            type: 'transferScore',
            fromEntryId: myEntry.id,
            toEntryId: counterpartyId,
            amount: Math.abs(val),
          });
        }
        return;
      }
    }
    onOp({ type: 'addDelta', entryId: myEntry.id, delta: val });
  };

  const handleMyCustomCommit = (sign: 1 | -1) => {
    const raw = Number(myDeltaInput);
    if (!Number.isFinite(raw) || raw === 0) return;
    const absVal = Math.abs(Math.trunc(raw));
    handleApplyMyDelta(sign * absVal);
    setMyDeltaInput('');
  };

  const handleBumpMyInput = (addAmt: number) => {
    const cur = Number(myDeltaInput) || 0;
    const next = Math.max(0, Math.trunc(cur) + addAmt);
    setMyDeltaInput(next > 0 ? String(next) : '');
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

  const myNetFromBase = myEntry ? myEntry.score - zeroSumInfo.baseScore : 0;
  const parsedMyInput = Math.abs(Math.trunc(Number(myDeltaInput) || 0));

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
            {zeroSumInfo.baseScore !== 0 ? `${zeroSumInfo.baseScore}点に戻す` : '0点に戻す'}
          </button>
        </div>
      </div>

      {/* ゼロサムチェック警告 / 一致ステータス */}
      {zeroSumCheck && board.entries.length > 0 && (
        <div
          className={`scoreboard-zerosum-alert ${
            zeroSumInfo.isZeroSum ? 'ok' : 'warning'
          }`}
          role="status"
        >
          {zeroSumInfo.isZeroSum ? (
            <div className="zerosum-ok-row">
              <CheckCircle2 size={16} />
              <span>
                ゼロサム一致（全員の収支合計 ±0
                {zeroSumInfo.baseScore !== 0
                  ? ` / 基準 ${zeroSumInfo.baseScore}点×${board.entries.length}名`
                  : ''}
                ）
              </span>
            </div>
          ) : (
            <div className="zerosum-warn-content">
              <div className="zerosum-warn-head">
                <AlertTriangle size={18} />
                <span>
                  ゼロサムになっていません！（合計差額:{' '}
                  <strong>
                    {zeroSumInfo.totalDelta > 0
                      ? `+${zeroSumInfo.totalDelta}`
                      : zeroSumInfo.totalDelta}
                    点
                  </strong>
                  ）
                </span>
              </div>
              <div className="zerosum-warn-desc">
                {zeroSumInfo.totalDelta > 0
                  ? `全体でプラスが +${zeroSumInfo.totalDelta} 点超過しています。マイナス側の入力漏れや加算ミスがないか確認してください。`
                  : `全体でマイナスが ${zeroSumInfo.totalDelta} 点超過しています。プラス側の入力漏れや減算ミスがないか確認してください。`}
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
                  自分の得点（{myEntry.name}）に差額{' '}
                  {-zeroSumInfo.totalDelta > 0
                    ? `+${-zeroSumInfo.totalDelta}`
                    : -zeroSumInfo.totalDelta}
                  点 を反映してゼロサムにする
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 自分の得点変動クイック入力パネル */}
      {myEntry && (
        <div className="my-score-hero-card">
          <div className="my-score-hero-top">
            <div className="my-score-title-group">
              <span className="my-score-label-badge">
                <UserCheck size={13} /> 自分の得点変動を入力
              </span>
              {board.entries.length > 1 && (
                <select
                  className="my-score-member-select"
                  value={myEntry.id}
                  onChange={(e) => setManualMyId(e.target.value)}
                  aria-label="自分のメンバーを選択"
                >
                  {board.entries.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}（自分）
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="my-score-current-box">
              <span className="my-score-rank-chip">
                {rankById.get(myEntry.id) ?? 1}位
              </span>
              <span
                className={`my-score-big-num ${
                  myNetFromBase > 0 ? 'plus' : myNetFromBase < 0 ? 'minus' : ''
                }`}
              >
                {myEntry.score}
                <small>点</small>
              </span>
              {zeroSumInfo.baseScore !== 0 && (
                <span className="my-score-net-sub">
                  ({myNetFromBase > 0 ? `+${myNetFromBase}` : myNetFromBase})
                </span>
              )}
            </div>
          </div>

          {/* 相手を指定して同時ゼロサム移動（任意） */}
          {board.entries.length > 1 && (
            <div className="my-score-transfer-bar">
              <span className="my-score-transfer-label">
                <ArrowRightLeft size={12} /> 連動精算:
              </span>
              <select
                className="my-score-counterparty-select"
                value={counterpartyId}
                onChange={(e) => setCounterpartyId(e.target.value)}
              >
                <option value="">自分のみ変動（各自が自分のスマホで入力）</option>
                {board.entries
                  .filter((e) => e.id !== myEntry.id)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} とゼロサム移動（相手も自動で逆変動）
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* ワンタップ即時変動ボタン（プラス段・マイナス段） */}
          <div className="my-score-instant-grid">
            <div className="my-score-instant-row">
              {quickMagnitudes.map((m) => (
                <button
                  key={`plus-${m}`}
                  type="button"
                  className="my-instant-btn plus"
                  onClick={() => handleApplyMyDelta(m)}
                >
                  +{m}
                </button>
              ))}
            </div>
            <div className="my-score-instant-row">
              {quickMagnitudes.map((m) => (
                <button
                  key={`minus-${m}`}
                  type="button"
                  className="my-instant-btn minus"
                  onClick={() => handleApplyMyDelta(-m)}
                >
                  -{m}
                </button>
              ))}
            </div>
          </div>

          {/* 変動値を数値入力・積み上げして一括反映 */}
          <div className="my-score-calc-box">
            <div className="my-score-calc-input-row">
              <input
                type="number"
                inputMode="numeric"
                className="my-score-delta-input"
                placeholder="変動点数を入力 (例: 30)"
                value={myDeltaInput}
                onChange={(e) => setMyDeltaInput(e.target.value)}
              />
              {quickMagnitudes.slice(0, 3).map((m) => (
                <button
                  key={`bump-${m}`}
                  type="button"
                  className="chip-btn"
                  onClick={() => handleBumpMyInput(m)}
                  title={`入力欄に +${m}`}
                >
                  +{m}
                </button>
              ))}
              {myDeltaInput && (
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => setMyDeltaInput('')}
                >
                  クリア
                </button>
              )}
            </div>
            <div className="my-score-commit-row">
              <button
                type="button"
                className="my-commit-btn minus"
                disabled={parsedMyInput === 0}
                onClick={() => handleMyCustomCommit(-1)}
              >
                <Minus size={15} />
                {parsedMyInput > 0 ? `${parsedMyInput}点 減らす (-${parsedMyInput})` : '減点する'}
              </button>
              <button
                type="button"
                className="my-commit-btn plus"
                disabled={parsedMyInput === 0}
                onClick={() => handleMyCustomCommit(1)}
              >
                <Plus size={15} />
                {parsedMyInput > 0 ? `${parsedMyInput}点 増やす (+${parsedMyInput})` : '加点する'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          placeholder="メンバー名を追加…"
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

      {/* 全メンバー得点リスト */}
      <div className="scoreboard-entry-list">
        {board.entries.length === 0 ? (
          <div className="card-panel text-muted-sm" style={{ textAlign: 'center' }}>
            メンバーを追加して得点管理を始めましょう
          </div>
        ) : (
          board.entries.map((entry) => {
            const rank = rankById.get(entry.id) ?? 1;
            const isTop = rank === 1 && entry.score > zeroSumInfo.baseScore;
            const isMe = myEntry?.id === entry.id;
            const net = entry.score - zeroSumInfo.baseScore;
            const customVal = customByEntry[entry.id] ?? '';
            return (
              <div
                key={entry.id}
                className={`scoreboard-entry ${isTop ? 'top-rank' : ''} ${
                  isMe ? 'is-my-entry' : ''
                }`}
              >
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
                    {isMe ? (
                      <span className="badge me">自分</span>
                    ) : (
                      <button
                        type="button"
                        className="set-me-mini-btn"
                        onClick={() => setManualMyId(entry.id)}
                      >
                        自分に設定
                      </button>
                    )}
                  </div>
                  <div
                    className={`scoreboard-score-val ${
                      net > 0 ? 'plus' : net < 0 ? 'minus' : ''
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
                  {rowQuickDeltas.map((d) => (
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
            {board.logs.slice(0, 14).map((log) => (
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
