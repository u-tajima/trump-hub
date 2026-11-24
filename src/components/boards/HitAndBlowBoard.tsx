import React, { useState } from 'react';
import { Check, Delete, Lock, RotateCcw, Unlock } from 'lucide-react';
import type { HitAndBlowClientState } from '../../games/hitAndBlow';

interface HitAndBlowBoardProps {
  state: HitAndBlowClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

export const HitAndBlowBoard: React.FC<HitAndBlowBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [input, setInput] = useState<number[]>([]);
  const digitsCount = state.rules.digits;
  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const isSolo = state.players.length === 1;
  const winner = state.players.find((p) => p.id === state.winnerId);

  const handleDigit = (d: number) => {
    if (!isMyTurn) return;
    if (input.length >= digitsCount) return;
    if (input.includes(d)) return;
    setInput((prev) => [...prev, d]);
  };

  const handleBackspace = () => {
    setInput((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setInput([]);
  };

  const handleSubmit = () => {
    if (!isMyTurn || input.length !== digitsCount) return;
    onAction({ type: 'guess', payload: { digits: input } });
    setInput([]);
  };

  const reversedHistory = [...state.history].reverse();

  return (
    <div className="board-container">
      {/* プレイヤーバー */}
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && current.id === p.id;
          const remainText =
            state.rules.maxAttempts > 0
              ? `${p.attempts} / ${state.rules.maxAttempts}回`
              : `${p.attempts}回`;
          return (
            <div
              key={p.id}
              className={`opp-pill ${active ? 'active' : ''} ${
                !isLocalPassAndPlay && p.id === state.myId ? 'me' : ''
              }`}
            >
              <div className="opp-name">{p.name}</div>
              <div className="opp-meta">推理 {remainText}</div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* 秘密のコード / 入力スロット */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.34)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: 16,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 800,
            color: state.phase === 'finished' ? '#fde68a' : '#94a3b8',
            letterSpacing: '0.06em',
          }}
        >
          {state.phase === 'finished' ? (
            <>
              <Unlock size={13} /> 正解のナンバー
            </>
          ) : (
            <>
              <Lock size={13} /> {digitsCount}桁の秘密の数字（重複なし）
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {Array.from({ length: digitsCount }, (_, idx) => {
            const val =
              state.phase === 'finished' && state.revealedSecret
                ? state.revealedSecret[idx]
                : input[idx];
            const filled = val !== undefined;
            return (
              <div
                key={idx}
                style={{
                  width: 54,
                  height: 62,
                  borderRadius: 12,
                  background:
                    state.phase === 'finished'
                      ? 'rgba(245, 158, 11, 0.22)'
                      : filled
                      ? 'rgba(16, 185, 129, 0.22)'
                      : 'rgba(255, 255, 255, 0.05)',
                  border:
                    state.phase === 'finished'
                      ? '2px solid #f59e0b'
                      : filled
                      ? '2px solid #10b981'
                      : idx === input.length && isMyTurn
                      ? '2px dashed rgba(245, 158, 11, 0.7)'
                      : '1.5px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  fontWeight: 900,
                  color:
                    state.phase === 'finished'
                      ? '#fde68a'
                      : filled
                      ? '#f8fafc'
                      : 'rgba(255, 255, 255, 0.2)',
                }}
              >
                {filled ? val : '-'}
              </div>
            );
          })}
        </div>
      </div>

      {/* 推理履歴リスト */}
      <div
        style={{
          flex: 1,
          minHeight: 120,
          maxHeight: 240,
          overflowY: 'auto',
          background: 'rgba(0, 0, 0, 0.26)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 14,
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {reversedHistory.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#94a3b8',
              padding: 16,
            }}
          >
            下のテンキーから {digitsCount}桁を選んで推理しましょう
          </div>
        ) : (
          reversedHistory.map((h) => (
            <div
              key={h.attempt}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '7px 10px',
                borderRadius: 10,
                background:
                  h.hit === digitsCount
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(255, 255, 255, 0.05)',
                border:
                  h.hit === digitsCount
                    ? '1px solid rgba(16, 185, 129, 0.6)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#94a3b8',
                    minWidth: 24,
                  }}
                >
                  #{h.attempt}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {h.guess.map((d, i) => (
                    <span
                      key={i}
                      style={{
                        width: 26,
                        height: 28,
                        borderRadius: 6,
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.16)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        fontWeight: 900,
                        color: '#f8fafc',
                      }}
                    >
                      {d}
                    </span>
                  ))}
                </div>
                {!isSolo && (
                  <span
                    style={{
                      fontSize: 11,
                      color: '#cbd5e1',
                      fontWeight: 700,
                      maxWidth: 68,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h.playerName}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background:
                      h.hit > 0
                        ? 'rgba(16, 185, 129, 0.28)'
                        : 'rgba(255, 255, 255, 0.08)',
                    color: h.hit > 0 ? '#6ee7b7' : '#94a3b8',
                    border:
                      h.hit > 0
                        ? '1px solid rgba(16, 185, 129, 0.55)'
                        : '1px solid transparent',
                  }}
                >
                  {h.hit} HIT
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background:
                      h.blow > 0
                        ? 'rgba(245, 158, 11, 0.25)'
                        : 'rgba(255, 255, 255, 0.08)',
                    color: h.blow > 0 ? '#fde68a' : '#94a3b8',
                    border:
                      h.blow > 0
                        ? '1px solid rgba(245, 158, 11, 0.5)'
                        : '1px solid transparent',
                  }}
                >
                  {h.blow} BLOW
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* テンキーパネル */}
      {state.phase === 'playing' && (
        <div
          style={{
            marginTop: 'auto',
            background: 'rgba(0, 0, 0, 0.36)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
              gap: 6,
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
              const used = input.includes(d);
              const disabled = !isMyTurn || used || input.length >= digitsCount;
              return (
                <button
                  key={d}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDigit(d)}
                  style={{
                    height: 46,
                    borderRadius: 10,
                    border: used
                      ? '1px solid rgba(16, 185, 129, 0.5)'
                      : '1px solid rgba(255, 255, 255, 0.16)',
                    background: used
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(255, 255, 255, 0.09)',
                    color: used ? '#6ee7b7' : '#f8fafc',
                    fontSize: 20,
                    fontWeight: 900,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: !isMyTurn ? 0.4 : used ? 0.45 : 1,
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="action-bar">
            <button
              type="button"
              className="secondary-btn"
              disabled={!isMyTurn || input.length === 0}
              onClick={handleClear}
              aria-label="クリア"
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={!isMyTurn || input.length === 0}
              onClick={handleBackspace}
              aria-label="1文字削除"
            >
              <Delete size={16} /> 消す
            </button>
            <button
              type="button"
              className="primary-btn flex-1"
              disabled={!isMyTurn || input.length !== digitsCount}
              onClick={handleSubmit}
            >
              <Check size={16} /> 推理する
            </button>
          </div>
        </div>
      )}

      {state.phase === 'finished' && (
        <div className="result-card">
          <h3>
            {state.winnerId === 'draw'
              ? '引き分け！'
              : state.winnerId === 'lose'
              ? '残念…手数上限です'
              : isSolo
              ? `${state.history.length}手でクリア！`
              : isLocalPassAndPlay
              ? `${winner?.name ?? ''} の勝利！`
              : state.winnerId === state.myId
              ? 'あなたの勝利！'
              : '相手の勝利…'}
          </h3>
          {state.revealedSecret && (
            <p className="panel-desc">
              正解の数字: {state.revealedSecret.join('')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
