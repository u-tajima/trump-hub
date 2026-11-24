import React, { useMemo, useState } from 'react';
import {
  canPlaceIgoStone,
  type IgoCell,
  type IgoClientState,
} from '../../games/igo';
import './IgoBoard.css';

export interface IgoBoardProps {
  state: IgoClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

const ORTHO_DIRS: readonly [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function getStarPoints(n: number): { row: number; col: number }[] {
  if (n === 9) {
    return [
      { row: 2, col: 2 },
      { row: 2, col: 6 },
      { row: 6, col: 2 },
      { row: 6, col: 6 },
      { row: 4, col: 4 },
    ];
  }
  if (n === 13) {
    return [
      { row: 3, col: 3 },
      { row: 3, col: 9 },
      { row: 9, col: 3 },
      { row: 9, col: 9 },
      { row: 6, col: 6 },
    ];
  }
  if (n === 19) {
    const pts: { row: number; col: number }[] = [];
    for (const r of [3, 9, 15]) {
      for (const c of [3, 9, 15]) {
        pts.push({ row: r, col: c });
      }
    }
    return pts;
  }
  return [];
}

/** scoringフェーズ時に空点の帰属（1=黒地, 2=白地, 0=ダメ）を可視化用に計算 */
function computeTerritoryMap(board: IgoCell[][], deadSet: Set<string>): Map<string, 1 | 2> {
  const n = board.length;
  const evalBoard: IgoCell[][] = board.map((row, r) =>
    row.map((cell, c) => (cell !== 0 && deadSet.has(`${r},${c}`) ? 0 : cell))
  );

  const visited = new Set<string>();
  const territory = new Map<string, 1 | 2>();

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (evalBoard[r][c] !== 0) continue;
      const startKey = `${r},${c}`;
      if (visited.has(startKey)) continue;

      const region: { row: number; col: number }[] = [];
      const queue: { row: number; col: number }[] = [{ row: r, col: c }];
      visited.add(startKey);
      let touchesBlack = false;
      let touchesWhite = false;

      let head = 0;
      while (head < queue.length) {
        const cur = queue[head++];
        region.push(cur);

        for (const [dr, dc] of ORTHO_DIRS) {
          const nr = cur.row + dr;
          const nc = cur.col + dc;
          if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;

          const cell = evalBoard[nr][nc];
          if (cell === 1) touchesBlack = true;
          else if (cell === 2) touchesWhite = true;
          else {
            const key = `${nr},${nc}`;
            if (!visited.has(key)) {
              visited.add(key);
              queue.push({ row: nr, col: nc });
            }
          }
        }
      }

      if (touchesBlack && !touchesWhite) {
        for (const pt of region) territory.set(`${pt.row},${pt.col}`, 1);
      } else if (touchesWhite && !touchesBlack) {
        for (const pt of region) territory.set(`${pt.row},${pt.col}`, 2);
      }
    }
  }

  return territory;
}

export const IgoBoard: React.FC<IgoBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [zoomed, setZoomed] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const n = state.board.length;
  const current = state.players[state.turnIndex];
  const me = state.players.find((p) => p.id === state.myId) ?? state.players[0];
  const isPlaying = state.phase === 'playing';
  const isScoring = isPlaying && state.subPhase === 'scoring';
  const isMyTurn = isPlaying && state.subPhase === 'play' && current.id === state.myId;

  const deadSet = useMemo(() => new Set(state.deadStones), [state.deadStones]);
  const starPoints = useMemo(() => getStarPoints(n), [n]);

  const territoryMap = useMemo(() => {
    if (!isScoring && !(state.phase === 'finished' && state.finishReason === 'score')) {
      return null;
    }
    return computeTerritoryMap(state.board, deadSet);
  }, [isScoring, state.phase, state.finishReason, state.board, deadSet]);

  const winner = state.players.find((p) => p.id === state.winnerId);

  const pad = n === 19 ? 0.9 : 0.8;
  const viewSize = n - 1 + pad * 2;
  const lineThin = n === 19 ? 0.055 : n === 13 ? 0.048 : 0.042;
  const lineOuter = lineThin * 1.45;
  const starRadius = n === 19 ? 0.14 : n === 13 ? 0.125 : 0.115;
  const stoneRadius = 0.455;

  const handleIntersectionClick = (row: number, col: number) => {
    if (!isPlaying) return;
    setConfirmResign(false);

    if (isScoring) {
      if (state.board[row][col] !== 0) {
        setNotice(null);
        onAction({ type: 'toggleDead', payload: { row, col } });
      }
      return;
    }

    if (!isMyTurn) return;
    if (state.board[row][col] !== 0) return;

    const check = canPlaceIgoStone(state, row, col, current.color);
    if (!check.ok) {
      setNotice(check.reason ?? 'そこには打てません');
      return;
    }

    setNotice(null);
    onAction({ type: 'place', payload: { row, col } });
  };

  const handlePass = () => {
    if (!isMyTurn) return;
    setConfirmResign(false);
    setNotice(null);
    onAction({ type: 'pass' });
  };

  const handleResignClick = () => {
    if (!isPlaying) return;
    if (!confirmResign) {
      setConfirmResign(true);
      return;
    }
    setConfirmResign(false);
    setNotice(null);
    onAction({ type: 'resign' });
  };

  const handleConfirmScore = () => {
    if (!isScoring) return;
    setNotice(null);
    onAction({
      type: 'confirmScore',
      payload: isLocalPassAndPlay ? { forceAll: true } : undefined,
    });
  };

  const handleResumePlay = () => {
    if (!isScoring) return;
    setNotice(null);
    onAction({ type: 'resumePlay' });
  };

  const scoreDiff = state.scoreSummary
    ? Math.round(Math.abs(state.scoreSummary.blackTotal - state.scoreSummary.whiteTotal) * 10) / 10
    : 0;

  return (
    <div className="board-container igo-board-container">
      {/* プレイヤー情報バー */}
      <div className="opponents-bar igo-players-bar">
        {state.players.map((p) => {
          const active = isPlaying && state.subPhase === 'play' && current.id === p.id;
          const isMe = !isLocalPassAndPlay && p.id === state.myId;
          return (
            <div
              key={p.id}
              className={`opp-pill igo-player-pill ${active ? 'active' : ''} ${isMe ? 'me' : ''}`}
            >
              <div className="igo-player-head">
                <span
                  className={`igo-stone-dot ${p.color === 1 ? 'black' : 'white'}`}
                  aria-hidden="true"
                />
                <span className="opp-name">{p.name}</span>
              </div>
              <div className="igo-player-meta">
                <span>アゲハマ {p.captures}</span>
                <span className="igo-player-status">
                  {state.phase === 'finished'
                    ? state.winnerId === p.id
                      ? '勝利'
                      : state.winnerId === 'draw'
                      ? '持碁'
                      : '終了'
                    : isScoring
                    ? p.scoringAgreed
                      ? '合意済'
                      : '確認中'
                    : active
                    ? '手番'
                    : '待機'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ルール・状態バナー */}
      <div className="igo-meta-row">
        <span className="igo-rule-chip">{n}路盤</span>
        <span className="igo-rule-chip">コミ {state.rules.komi}</span>
        {state.rules.superko && <span className="igo-rule-chip">スーパーコウ禁止</span>}
        {state.consecutivePasses === 1 && !isScoring && (
          <span className="igo-rule-chip warn">連続パスまであと1回</span>
        )}
      </div>

      <div className={`log-banner ${notice ? 'igo-log-warn' : ''}`}>
        {notice ?? state.lastLog}
      </div>

      {/* 本格交点型碁盤 */}
      <div className={`igo-board-scroll ${zoomed ? 'is-zoomed' : ''}`}>
        <div className={`igo-board-frame ${zoomed ? 'is-zoomed' : ''}`}>
          <svg
            className="igo-board-svg"
            viewBox={`0 0 ${viewSize} ${viewSize}`}
            role="grid"
            aria-label={`${n}路囲碁盤`}
          >
            <defs>
              <radialGradient id="igo-black-grad" cx="35%" cy="30%" r="65%">
                <stop offset="0%" stopColor="#4b5563" />
                <stop offset="35%" stopColor="#1f2937" />
                <stop offset="100%" stopColor="#090d16" />
              </radialGradient>
              <radialGradient id="igo-white-grad" cx="34%" cy="28%" r="68%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="68%" stopColor="#ecebe4" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </radialGradient>
              <filter id="igo-stone-shadow" x="-15%" y="-15%" width="135%" height="135%">
                <feDropShadow dx="0.04" dy="0.06" stdDeviation="0.055" floodColor="#1c1104" floodOpacity="0.48" />
              </filter>
            </defs>

            {/* 盤面グリッド線 */}
            <g className="igo-grid-lines">
              {Array.from({ length: n }, (_, i) => {
                const pos = pad + i;
                const isEdge = i === 0 || i === n - 1;
                const sw = isEdge ? lineOuter : lineThin;
                return (
                  <React.Fragment key={i}>
                    <line
                      x1={pad}
                      y1={pos}
                      x2={pad + n - 1}
                      y2={pos}
                      stroke="#2a1c0c"
                      strokeWidth={sw}
                      strokeLinecap="square"
                    />
                    <line
                      x1={pos}
                      y1={pad}
                      x2={pos}
                      y2={pad + n - 1}
                      stroke="#2a1c0c"
                      strokeWidth={sw}
                      strokeLinecap="square"
                    />
                  </React.Fragment>
                );
              })}
            </g>

            {/* 星・天元 */}
            <g className="igo-star-points">
              {starPoints.map((pt) => (
                <circle
                  key={`star-${pt.row}-${pt.col}`}
                  cx={pad + pt.col}
                  cy={pad + pt.row}
                  r={starRadius}
                  fill="#231608"
                />
              ))}
            </g>

            {/* 地合いマーカー（scoring / 終局時） */}
            {territoryMap && (
              <g className="igo-territory-layer" pointerEvents="none">
                {Array.from(territoryMap.entries()).map(([key, owner]) => {
                  const [rStr, cStr] = key.split(',');
                  const r = Number(rStr);
                  const c = Number(cStr);
                  const cx = pad + c;
                  const cy = pad + r;
                  const size = 0.28;
                  return (
                    <rect
                      key={`terr-${key}`}
                      x={cx - size / 2}
                      y={cy - size / 2}
                      width={size}
                      height={size}
                      rx={0.04}
                      fill={owner === 1 ? 'rgba(15, 23, 42, 0.78)' : 'rgba(255, 255, 255, 0.88)'}
                      stroke={owner === 1 ? 'rgba(255, 255, 255, 0.45)' : 'rgba(15, 23, 42, 0.55)'}
                      strokeWidth={0.04}
                    />
                  );
                })}
              </g>
            )}

            {/* コウ禁止点マーカー */}
            {isPlaying && state.subPhase === 'play' && state.koPoint && (
              <g className="igo-ko-marker" pointerEvents="none">
                {(() => {
                  const cx = pad + state.koPoint.col;
                  const cy = pad + state.koPoint.row;
                  const d = 0.22;
                  return (
                    <>
                      <line
                        x1={cx - d}
                        y1={cy - d}
                        x2={cx + d}
                        y2={cy + d}
                        stroke="rgba(185, 28, 28, 0.72)"
                        strokeWidth={0.085}
                        strokeLinecap="round"
                      />
                      <line
                        x1={cx + d}
                        y1={cy - d}
                        x2={cx - d}
                        y2={cy + d}
                        stroke="rgba(185, 28, 28, 0.72)"
                        strokeWidth={0.085}
                        strokeLinecap="round"
                      />
                    </>
                  );
                })()}
              </g>
            )}

            {/* 石とタップ領域 */}
            {state.board.map((rowArr, r) =>
              rowArr.map((cell, c) => {
                const cx = pad + c;
                const cy = pad + r;
                const key = `${r},${c}`;
                const isDead = deadSet.has(key);
                const isLast =
                  !state.lastMove?.pass &&
                  state.lastMove?.row === r &&
                  state.lastMove?.col === c;
                const canTap =
                  (isMyTurn && cell === 0) || (isScoring && cell !== 0);

                return (
                  <g
                    key={key}
                    className={`igo-intersection ${canTap ? 'clickable' : ''}`}
                    onClick={() => handleIntersectionClick(r, c)}
                  >
                    <rect
                      x={cx - 0.5}
                      y={cy - 0.5}
                      width={1}
                      height={1}
                      fill="transparent"
                    />
                    {cell !== 0 && (
                      <g opacity={isDead ? 0.34 : 1}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={stoneRadius}
                          fill={cell === 1 ? 'url(#igo-black-grad)' : 'url(#igo-white-grad)'}
                          stroke={cell === 1 ? '#020617' : '#94a3b8'}
                          strokeWidth={0.03}
                          filter="url(#igo-stone-shadow)"
                        />
                        {isLast && !isScoring && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={0.19}
                            fill="none"
                            stroke={cell === 1 ? '#f8fafc' : '#0f172a'}
                            strokeWidth={0.075}
                          />
                        )}
                      </g>
                    )}
                    {cell !== 0 && isDead && (
                      <g pointerEvents="none">
                        <line
                          x1={cx - 0.24}
                          y1={cy - 0.24}
                          x2={cx + 0.24}
                          y2={cy + 0.24}
                          stroke="#dc2626"
                          strokeWidth={0.1}
                          strokeLinecap="round"
                        />
                        <line
                          x1={cx + 0.24}
                          y1={cy - 0.24}
                          x2={cx - 0.24}
                          y2={cy + 0.24}
                          stroke="#dc2626"
                          strokeWidth={0.1}
                          strokeLinecap="round"
                        />
                      </g>
                    )}
                  </g>
                );
              })
            )}
          </svg>
        </div>
      </div>

      {/* 対局中の操作バー */}
      {isPlaying && state.subPhase === 'play' && (
        <div className="igo-action-bar">
          <button
            type="button"
            className="secondary-btn igo-btn"
            disabled={!isMyTurn}
            onClick={handlePass}
          >
            パス
          </button>
          {n >= 13 && (
            <button
              type="button"
              className={`secondary-btn igo-btn ${zoomed ? 'igo-btn-active' : ''}`}
              onClick={() => setZoomed((v) => !v)}
            >
              {zoomed ? '全体表示' : '拡大表示'}
            </button>
          )}
          <button
            type="button"
            className={`secondary-btn igo-btn ${confirmResign ? 'igo-btn-danger' : ''}`}
            onClick={handleResignClick}
          >
            {confirmResign ? '本当に投了する' : '投了'}
          </button>
        </div>
      )}

      {/* 死活確認・終局合意パネル */}
      {isScoring && state.scoreSummary && (
        <div className="igo-scoring-panel">
          <div className="igo-scoring-header">
            <span className="igo-scoring-title">死活確認・地合い計算（中国ルール）</span>
            {n >= 13 && (
              <button
                type="button"
                className="chip-btn"
                onClick={() => setZoomed((v) => !v)}
              >
                {zoomed ? '全体' : '拡大'}
              </button>
            )}
          </div>
          <p className="igo-scoring-hint">
            死に石をタップすると連単位で指定・解除できます。確認後に終局を確定してください。
          </p>

          <div className="igo-score-grid">
            <div className="igo-score-box">
              <div className="igo-score-label">
                <span className="igo-stone-dot black" aria-hidden="true" /> 黒
              </div>
              <div className="igo-score-total">{state.scoreSummary.blackTotal}目</div>
              <div className="igo-score-detail">
                石 {state.scoreSummary.blackStones} + 地 {state.scoreSummary.blackTerritory}
              </div>
            </div>
            <div className="igo-score-box">
              <div className="igo-score-label">
                <span className="igo-stone-dot white" aria-hidden="true" /> 白
              </div>
              <div className="igo-score-total">{state.scoreSummary.whiteTotal}目</div>
              <div className="igo-score-detail">
                石 {state.scoreSummary.whiteStones} + 地 {state.scoreSummary.whiteTerritory} + コミ {state.scoreSummary.komi}
              </div>
            </div>
          </div>

          <div className="igo-scoring-lead">
            {state.scoreSummary.blackTotal > state.scoreSummary.whiteTotal
              ? `現在 黒が ${scoreDiff}目 優勢`
              : state.scoreSummary.whiteTotal > state.scoreSummary.blackTotal
              ? `現在 白が ${scoreDiff}目 優勢`
              : '現在 持碁（同点）'}
          </div>

          <div className="igo-action-bar">
            <button
              type="button"
              className="primary-btn igo-btn flex-1"
              disabled={!isLocalPassAndPlay && me.scoringAgreed}
              onClick={handleConfirmScore}
            >
              {!isLocalPassAndPlay && me.scoringAgreed ? '相手の合意待ち…' : '終局を確定'}
            </button>
            <button
              type="button"
              className="secondary-btn igo-btn"
              onClick={handleResumePlay}
            >
              対局再開
            </button>
          </div>
        </div>
      )}

      {/* 終局結果カード */}
      {state.phase === 'finished' && (
        <div className="result-card igo-result-card">
          <h3>
            {state.winnerId === 'draw'
              ? '持碁（引き分け）'
              : isLocalPassAndPlay
              ? `${winner?.name ?? ''} の勝利`
              : state.winnerId === state.myId
              ? 'あなたの勝利'
              : `${winner?.name ?? '相手'} の勝利`}
          </h3>
          <div className="igo-result-reason">
            {state.finishReason === 'resign' ? '中押し勝ち（投了）' : '中国ルール地合い判定'}
          </div>
          {state.scoreSummary && (
            <div className="igo-score-grid mt-8">
              <div className="igo-score-box">
                <div className="igo-score-label">
                  <span className="igo-stone-dot black" aria-hidden="true" /> 黒
                </div>
                <div className="igo-score-total">{state.scoreSummary.blackTotal}目</div>
                <div className="igo-score-detail">
                  石 {state.scoreSummary.blackStones} + 地 {state.scoreSummary.blackTerritory}
                </div>
              </div>
              <div className="igo-score-box">
                <div className="igo-score-label">
                  <span className="igo-stone-dot white" aria-hidden="true" /> 白
                </div>
                <div className="igo-score-total">{state.scoreSummary.whiteTotal}目</div>
                <div className="igo-score-detail">
                  石 {state.scoreSummary.whiteStones} + 地 {state.scoreSummary.whiteTerritory} + コミ {state.scoreSummary.komi}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
