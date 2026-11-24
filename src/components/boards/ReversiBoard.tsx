import React from 'react';
import type { ReversiClientState } from '../../games/reversi';

interface ReversiBoardProps {
  state: ReversiClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

export const ReversiBoard: React.FC<ReversiBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const n = state.board.length;
  const winner = state.players.find((p) => p.id === state.winnerId);

  const isValid = (r: number, c: number) =>
    isMyTurn && state.validMoves.some((m) => m.row === r && m.col === c);

  return (
    <div className="board-container">
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && current.id === p.id;
          const count = p.color === 1 ? state.counts.black : state.counts.white;
          return (
            <div
              key={p.id}
              className={`opp-pill ${active ? 'active' : ''} ${!isLocalPassAndPlay && p.id === state.myId ? 'me' : ''}`}
            >
              <div className="opp-name">
                <span className={`mini-dot ${p.color === 1 ? 'black' : 'white'}`} /> {p.name}
              </div>
              <div className="opp-meta">{count}枚</div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      <div className="board-center-wrap">
        <div
          className="reversi-grid"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {state.board.map((row, r) =>
            row.map((cell, c) => {
              const valid = isValid(r, c);
              const isLast = state.lastMove?.row === r && state.lastMove?.col === c;
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  disabled={!valid}
                  onClick={() => valid && onAction({ type: 'place', payload: { row: r, col: c } })}
                  className={`reversi-cell ${valid ? 'valid' : ''} ${isLast ? 'last' : ''}`}
                  aria-label={`行${r + 1} 列${c + 1}`}
                >
                  {cell !== 0 && <span className={`reversi-stone ${cell === 1 ? 'black' : 'white'}`} />}
                  {cell === 0 && valid && <span className="reversi-hint" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      {state.phase === 'finished' && (
        <div className="result-card">
          <h3>
            {state.winnerId === 'draw'
              ? '引き分け！'
              : isLocalPassAndPlay
              ? `${winner?.name ?? ''} の勝利！`
              : state.winnerId === state.myId
              ? 'あなたの勝利！'
              : '相手の勝利…'}
          </h3>
          <p className="panel-desc">
            黒 {state.counts.black} 枚 / 白 {state.counts.white} 枚
          </p>
        </div>
      )}
    </div>
  );
};
