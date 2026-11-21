import React from 'react';
import type { Connect4ClientState } from '../../games/connect4';

interface Connect4BoardProps {
  state: Connect4ClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

export const Connect4Board: React.FC<Connect4BoardProps> = ({ state, onAction }) => {
  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const cols = state.rules.cols;

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
                <span className={`mini-dot ${p.disc === 1 ? 'red' : 'yellow'}`} /> {p.name}
              </div>
              <div className="opp-meta">
                {active ? (p.id === state.myId ? 'あなたの番' : '相手の番') : '待機'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      <div className="board-center-wrap">
        <div
          className="connect4-board"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {state.board.map((row, r) =>
            row.map((cell, c) => {
              const canDrop = isMyTurn && state.board[0][c] === 0;
              const win = isWinCell(r, c);
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  disabled={!canDrop}
                  onClick={() => canDrop && onAction({ type: 'drop', payload: { col: c } })}
                  className={`connect4-slot ${win ? 'win' : ''}`}
                  aria-label={`列${c + 1}に落とす`}
                >
                  <span
                    className={`connect4-disc ${
                      cell === 1 ? 'red' : cell === 2 ? 'yellow' : 'empty'
                    }`}
                  />
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
              : state.winnerId === state.myId
              ? 'あなたの勝利！'
              : '相手の勝利…'}
          </h3>
        </div>
      )}
    </div>
  );
};
