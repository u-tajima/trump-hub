import React from 'react';
import type { GomokuClientState } from '../../games/gomoku';

interface GomokuBoardProps {
  state: GomokuClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

export const GomokuBoard: React.FC<GomokuBoardProps> = ({ state, onAction }) => {
  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const n = state.board.length;

  const isWinCell = (r: number, c: number) =>
    state.winningLine.some((w) => w.row === r && w.col === c);

  return (
    <div className="board-container">
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && current.id === p.id;
          return (
            <div key={p.id} className={`opp-pill ${active ? 'active' : ''} ${p.id === state.myId ? 'me' : ''}`}>
              <div className="opp-name">
                {p.stone === 1 ? '⚫' : '⚪'} {p.name}
              </div>
              <div className="opp-meta">{active ? '思考中' : '待機'}</div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      <div className="board-center-wrap">
        <div
          className="gomoku-grid"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {state.board.map((row, r) =>
            row.map((cell, c) => {
              const isLast = state.lastMove?.row === r && state.lastMove?.col === c;
              const win = isWinCell(r, c);
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  disabled={!isMyTurn || cell !== 0}
                  onClick={() => isMyTurn && cell === 0 && onAction({ type: 'place', payload: { row: r, col: c } })}
                  className={`gomoku-cell ${isLast ? 'last' : ''} ${win ? 'win' : ''}`}
                  aria-label={`行${r + 1} 列${c + 1}`}
                >
                  {cell !== 0 && <span className={`gomoku-stone ${cell === 1 ? 'black' : 'white'}`} />}
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
              ? '🤝 引き分け！'
              : state.winnerId === state.myId
              ? '🏆 あなたの勝利！'
              : '😢 相手の勝利…'}
          </h3>
        </div>
      )}
    </div>
  );
};
