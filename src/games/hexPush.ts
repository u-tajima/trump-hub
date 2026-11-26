import type { HexPushRules, PlayerInfo } from '../types/game';

export type HexPushCell = 0 | 1 | 2; // 0: empty, 1: P0 (white / bottom), 2: P1 (black / top)

export interface HexPushCoord {
  q: number;
  r: number;
}

export interface HexPushPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  color: 1 | 2;
  pushedOut: number; // 場外に押し出した相手玉の数
}

export interface HexPushMove {
  marbles: HexPushCoord[];
  dirIndex: number;
}

export interface HexPushInternalState {
  rules: HexPushRules;
  players: [HexPushPlayerState, HexPushPlayerState];
  board: Record<string, HexPushCell>; // key: "q,r"
  turnIndex: 0 | 1;
  moveCount: number;
  lastMove: {
    movedTo: HexPushCoord[];
    pushedTo: HexPushCoord[];
    pushedOut: boolean;
    dirIndex: number;
  } | null;
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface HexPushClientState extends HexPushInternalState {
  myId: string;
}

export const HEX_PUSH_RADIUS = 4;

// 6方向ベクトル: (1,0), (-1,0), (0,1), (0,-1), (1,-1), (-1,1)
export const HEX_PUSH_DIRS: readonly [number, number][] = [
  [1, 0],   // 0: 右
  [-1, 0],  // 1: 左
  [0, 1],   // 2: 右下
  [0, -1],  // 3: 左上
  [1, -1],  // 4: 右上
  [-1, 1],  // 5: 左下
];

export const HEX_PUSH_CELLS: readonly HexPushCoord[] = (() => {
  const cells: HexPushCoord[] = [];
  for (let r = -HEX_PUSH_RADIUS; r <= HEX_PUSH_RADIUS; r++) {
    for (let q = -HEX_PUSH_RADIUS; q <= HEX_PUSH_RADIUS; q++) {
      if (Math.abs(q + r) <= HEX_PUSH_RADIUS) {
        cells.push({ q, r });
      }
    }
  }
  return cells;
})();

export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function isInHexBoard(q: number, r: number): boolean {
  return (
    Math.abs(q) <= HEX_PUSH_RADIUS &&
    Math.abs(r) <= HEX_PUSH_RADIUS &&
    Math.abs(q + r) <= HEX_PUSH_RADIUS
  );
}

export function hexDistFromCenter(q: number, r: number): number {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

function createInitialBoard(): Record<string, HexPushCell> {
  const board: Record<string, HexPushCell> = {};
  for (const { q, r } of HEX_PUSH_CELLS) {
    board[hexKey(q, r)] = 0;
  }

  // P1 (黒/上側, color=2): r = -4 全5マス, r = -3 全6マス, r = -2 の q = 0, 1, 2 (計14玉)
  for (const { q, r } of HEX_PUSH_CELLS) {
    if (r === -4 || r === -3 || (r === -2 && q >= 0 && q <= 2)) {
      board[hexKey(q, r)] = 2;
    }
  }

  // P0 (白/下側, color=1): r = 4 全5マス, r = 3 全6マス, r = 2 の q = -2, -1, 0 (計14玉)
  for (const { q, r } of HEX_PUSH_CELLS) {
    if (r === 4 || r === 3 || (r === 2 && q >= -2 && q <= 0)) {
      board[hexKey(q, r)] = 1;
    }
  }

  return board;
}

export function initHexPush(
  playersInfo: PlayerInfo[],
  rules: HexPushRules
): HexPushInternalState {
  const p0 = playersInfo[0] ?? {
    id: 'p0',
    name: 'プレイヤー1',
    isHost: true,
    isBot: false,
    connected: true,
  };
  const p1 = playersInfo[1] ?? {
    id: 'bot-1',
    name: 'CPU',
    isHost: false,
    isBot: true,
    connected: true,
  };

  const players: [HexPushPlayerState, HexPushPlayerState] = [
    { id: p0.id, name: p0.name, isBot: p0.isBot, color: 1, pushedOut: 0 },
    { id: p1.id, name: p1.name, isBot: p1.isBot, color: 2, pushedOut: 0 },
  ];

  return {
    rules,
    players,
    board: createInitialBoard(),
    turnIndex: 0,
    moveCount: 0,
    lastMove: null,
    winnerId: null,
    phase: 'playing',
    lastLog: `${players[0].name}（白）のターン。玉を1〜3個選んで動かそう`,
  };
}

/**
 * 1〜3個の玉が一直線に隣接しているか検証し、整列済みの座標配列と軸方向ベクトルを返す。
 */
export function validateLineSelection(
  marbles: HexPushCoord[]
): { ordered: HexPushCoord[]; axisDir: [number, number] | null } | null {
  if (marbles.length < 1 || marbles.length > 3) return null;

  // 重複チェック
  const seen = new Set<string>();
  for (const m of marbles) {
    if (!Number.isInteger(m.q) || !Number.isInteger(m.r) || !isInHexBoard(m.q, m.r)) {
      return null;
    }
    const k = hexKey(m.q, m.r);
    if (seen.has(k)) return null;
    seen.add(k);
  }

  if (marbles.length === 1) {
    return { ordered: [marbles[0]], axisDir: null };
  }

  // 3つの正方向軸のいずれかに沿って並んでいるかチェック
  const positiveAxes: readonly [number, number][] = [
    [1, 0],
    [0, 1],
    [1, -1],
  ];

  for (const [dq, dr] of positiveAxes) {
    // 軸への射影値でソート（dq!=0 なら q、そうでなければ r）
    const sorted = [...marbles].sort((a, b) => (dq !== 0 ? a.q - b.q : a.r - b.r));
    let ok = true;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1].q - sorted[i].q !== dq || sorted[i + 1].r - sorted[i].r !== dr) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return { ordered: sorted, axisDir: [dq, dr] };
    }
  }

  return null;
}

export interface EvaluatedHexPushMove {
  valid: boolean;
  isInline: boolean;
  isSumito: boolean;
  pushesOut: boolean;
  pushedCount: number;
  movedTo: HexPushCoord[];
  pushedTo: HexPushCoord[];
  nextBoard?: Record<string, HexPushCell>;
}

/**
 * 指定された玉群と方向での移動が合法か評価し、合法なら移動後の盤面情報を返す。
 */
export function evaluateHexPushMove(
  board: Record<string, HexPushCell>,
  marbles: HexPushCoord[],
  dirIndex: number,
  myColor: 1 | 2,
  buildBoard = false
): EvaluatedHexPushMove {
  const invalid: EvaluatedHexPushMove = {
    valid: false,
    isInline: false,
    isSumito: false,
    pushesOut: false,
    pushedCount: 0,
    movedTo: [],
    pushedTo: [],
  };

  if (!Number.isInteger(dirIndex) || dirIndex < 0 || dirIndex >= HEX_PUSH_DIRS.length) {
    return invalid;
  }

  const line = validateLineSelection(marbles);
  if (!line) return invalid;

  for (const m of line.ordered) {
    if (board[hexKey(m.q, m.r)] !== myColor) return invalid;
  }

  const [dq, dr] = HEX_PUSH_DIRS[dirIndex];
  const oppColor: 1 | 2 = myColor === 1 ? 2 : 1;
  const k = line.ordered.length;

  const isInline =
    k === 1 ||
    (line.axisDir !== null &&
      ((line.axisDir[0] === dq && line.axisDir[1] === dr) ||
        (line.axisDir[0] === -dq && line.axisDir[1] === -dr)));

  if (isInline) {
    // 移動方向に沿って最後尾 -> 先頭の順に整列
    let ordered = line.ordered;
    if (k > 1 && line.axisDir && line.axisDir[0] === -dq && line.axisDir[1] === -dr) {
      ordered = [...line.ordered].reverse();
    }

    const front = ordered[k - 1];
    const nextQ = front.q + dq;
    const nextR = front.r + dr;

    // 自玉を場外へ動かすことはできない
    if (!isInHexBoard(nextQ, nextR)) return invalid;

    const frontCell = board[hexKey(nextQ, nextR)];
    if (frontCell === myColor) return invalid;

    if (frontCell === 0) {
      // 通常インライン前進
      const movedTo = ordered.map((m) => ({ q: m.q + dq, r: m.r + dr }));
      let nextBoard: Record<string, HexPushCell> | undefined;
      if (buildBoard) {
        nextBoard = { ...board };
        nextBoard[hexKey(ordered[0].q, ordered[0].r)] = 0;
        nextBoard[hexKey(nextQ, nextR)] = myColor;
      }
      return {
        valid: true,
        isInline: true,
        isSumito: false,
        pushesOut: false,
        pushedCount: 0,
        movedTo,
        pushedTo: [],
        nextBoard,
      };
    }

    // 相手玉に接触 -> スミト（押し出し）判定
    if (k === 1) return invalid; // 1玉では押し出せない

    const oppMarbles: HexPushCoord[] = [];
    let cq = nextQ;
    let cr = nextR;
    while (isInHexBoard(cq, cr) && board[hexKey(cq, cr)] === oppColor) {
      oppMarbles.push({ q: cq, r: cr });
      cq += dq;
      cr += dr;
      if (oppMarbles.length >= k) {
        // 同数以上の相手玉は押せない
        return invalid;
      }
    }

    // 相手列の奥のマス (cq, cr) を確認
    const pushesOut = !isInHexBoard(cq, cr);
    if (!pushesOut && board[hexKey(cq, cr)] !== 0) {
      // 奥が自玉で塞がれている
      return invalid;
    }

    const movedTo = ordered.map((m) => ({ q: m.q + dq, r: m.r + dr }));
    const pushedTo: HexPushCoord[] = [];
    for (const om of oppMarbles) {
      const pq = om.q + dq;
      const pr = om.r + dr;
      if (isInHexBoard(pq, pr)) {
        pushedTo.push({ q: pq, r: pr });
      }
    }

    let nextBoard: Record<string, HexPushCell> | undefined;
    if (buildBoard) {
      nextBoard = { ...board };
      // 最後尾の自玉を空にする
      nextBoard[hexKey(ordered[0].q, ordered[0].r)] = 0;
      // 先頭の前（相手先頭だった位置）を自玉にする
      nextBoard[hexKey(nextQ, nextR)] = myColor;
      // 押し出された相手列の奥が盤内なら相手玉を置く
      if (!pushesOut) {
        nextBoard[hexKey(cq, cr)] = oppColor;
      }
    }

    return {
      valid: true,
      isInline: true,
      isSumito: true,
      pushesOut,
      pushedCount: oppMarbles.length,
      movedTo,
      pushedTo,
      nextBoard,
    };
  }

  // ブロードサイド移動（2〜3玉を横スライド、押し出し不可）
  const movedTo: HexPushCoord[] = [];
  for (const m of line.ordered) {
    const tq = m.q + dq;
    const tr = m.r + dr;
    if (!isInHexBoard(tq, tr) || board[hexKey(tq, tr)] !== 0) {
      return invalid;
    }
    movedTo.push({ q: tq, r: tr });
  }

  let nextBoard: Record<string, HexPushCell> | undefined;
  if (buildBoard) {
    nextBoard = { ...board };
    for (const m of line.ordered) {
      nextBoard[hexKey(m.q, m.r)] = 0;
    }
    for (const dst of movedTo) {
      nextBoard[hexKey(dst.q, dst.r)] = myColor;
    }
  }

  return {
    valid: true,
    isInline: false,
    isSumito: false,
    pushesOut: false,
    pushedCount: 0,
    movedTo,
    pushedTo: [],
    nextBoard,
  };
}

export function applyHexPushAction(
  state: HexPushInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: HexPushInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }
  const current = state.players[state.turnIndex];
  if (current.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }
  if (action.type !== 'move') {
    return { state, error: '不明なアクションです' };
  }

  const payload = action.payload as { marbles?: unknown; dirIndex?: unknown } | undefined;
  if (!payload || !Array.isArray(payload.marbles) || typeof payload.dirIndex !== 'number') {
    return { state, error: '不正な移動データです' };
  }
  if (!Number.isInteger(payload.dirIndex) || payload.dirIndex < 0 || payload.dirIndex > 5) {
    return { state, error: '不正な移動方向です' };
  }

  const marbles: HexPushCoord[] = [];
  for (const item of payload.marbles) {
    const c = item as { q?: unknown; r?: unknown } | null;
    if (
      !c ||
      typeof c.q !== 'number' ||
      typeof c.r !== 'number' ||
      !Number.isInteger(c.q) ||
      !Number.isInteger(c.r)
    ) {
      return { state, error: '不正な座標です' };
    }
    marbles.push({ q: c.q, r: c.r });
  }

  const result = evaluateHexPushMove(state.board, marbles, payload.dirIndex, current.color, true);
  if (!result.valid || !result.nextBoard) {
    return { state, error: 'その方向には移動できません' };
  }

  const nextPlayers: [HexPushPlayerState, HexPushPlayerState] = [
    { ...state.players[0] },
    { ...state.players[1] },
  ];
  if (result.pushesOut) {
    nextPlayers[state.turnIndex].pushedOut += 1;
  }

  const myPushedOut = nextPlayers[state.turnIndex].pushedOut;
  const moveCount = state.moveCount + 1;
  const lastMove = {
    movedTo: result.movedTo,
    pushedTo: result.pushedTo,
    pushedOut: result.pushesOut,
    dirIndex: payload.dirIndex,
  };

  if (myPushedOut >= state.rules.pushOutTarget) {
    return {
      state: {
        ...state,
        players: nextPlayers,
        board: result.nextBoard,
        moveCount,
        lastMove,
        winnerId: current.id,
        phase: 'finished',
        lastLog: `${current.name} が${state.rules.pushOutTarget}個目の玉を場外へ押し出して勝利！`,
      },
    };
  }

  const nextIndex: 0 | 1 = state.turnIndex === 0 ? 1 : 0;
  const nextPlayer = nextPlayers[nextIndex];
  const nextColorLabel = nextPlayer.color === 1 ? '白' : '黒';

  let logMsg = `${current.name} が玉を${marbles.length}個動かしました。次は ${nextPlayer.name}（${nextColorLabel}）`;
  if (result.pushesOut) {
    logMsg = `${current.name} が相手の玉を場外へ押し出した！（${myPushedOut}/${state.rules.pushOutTarget}）次は ${nextPlayer.name}（${nextColorLabel}）`;
  } else if (result.isSumito) {
    logMsg = `${current.name} が相手の玉を${result.pushedCount}個押し込んだ！次は ${nextPlayer.name}（${nextColorLabel}）`;
  }

  return {
    state: {
      ...state,
      players: nextPlayers,
      board: result.nextBoard,
      turnIndex: nextIndex,
      moveCount,
      lastMove,
      lastLog: logMsg,
    },
  };
}

/**
 * 指定色の全合法手を列挙する。
 */
export function generateHexPushLegalMoves(
  board: Record<string, HexPushCell>,
  color: 1 | 2
): { move: HexPushMove; evalResult: EvaluatedHexPushMove }[] {
  const positiveAxes: readonly [number, number][] = [
    [1, 0],
    [0, 1],
    [1, -1],
  ];

  const groups: HexPushCoord[][] = [];
  for (const { q, r } of HEX_PUSH_CELLS) {
    if (board[hexKey(q, r)] !== color) continue;
    // 1玉
    groups.push([{ q, r }]);
    // 2玉・3玉（正方向3軸のみ走査して重複なし）
    for (const [dq, dr] of positiveAxes) {
      const q2 = q + dq;
      const r2 = r + dr;
      if (isInHexBoard(q2, r2) && board[hexKey(q2, r2)] === color) {
        groups.push([
          { q, r },
          { q: q2, r: r2 },
        ]);
        const q3 = q2 + dq;
        const r3 = r2 + dr;
        if (isInHexBoard(q3, r3) && board[hexKey(q3, r3)] === color) {
          groups.push([
            { q, r },
            { q: q2, r: r2 },
            { q: q3, r: r3 },
          ]);
        }
      }
    }
  }

  const legal: { move: HexPushMove; evalResult: EvaluatedHexPushMove }[] = [];
  for (const marbles of groups) {
    for (let dirIndex = 0; dirIndex < HEX_PUSH_DIRS.length; dirIndex++) {
      const evalResult = evaluateHexPushMove(board, marbles, dirIndex, color, false);
      if (evalResult.valid) {
        legal.push({ move: { marbles, dirIndex }, evalResult });
      }
    }
  }
  return legal;
}

function evaluateBoardPosition(
  board: Record<string, HexPushCell>,
  myColor: 1 | 2
): number {
  let score = 0;

  for (const { q, r } of HEX_PUSH_CELLS) {
    const cell = board[hexKey(q, r)];
    if (cell === 0) continue;
    const dist = hexDistFromCenter(q, r);
    // 中央に近いほど高評価、端(dist=4)は危険
    const centerVal = dist === 0 ? 18 : dist === 1 ? 15 : dist === 2 ? 11 : dist === 3 ? 6 : 0;

    // 隣接する味方玉の数（結束力）
    let allies = 0;
    for (const [dq, dr] of HEX_PUSH_DIRS) {
      const nq = q + dq;
      const nr = r + dr;
      if (isInHexBoard(nq, nr) && board[hexKey(nq, nr)] === cell) {
        allies++;
      }
    }

    const totalVal = centerVal + allies * 2.4;
    if (cell === myColor) {
      score += totalVal;
    } else {
      score -= totalVal;
    }
  }

  return score;
}

export function computeHexPushBotAction(
  state: HexPushInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;
  const bot = state.players[state.turnIndex];
  const legal = generateHexPushLegalMoves(state.board, bot.color);
  if (legal.length === 0) return null;

  let bestMove = legal[0].move;
  let bestScore = -Infinity;

  for (const { move, evalResult } of legal) {
    const withBoard = evaluateHexPushMove(state.board, move.marbles, move.dirIndex, bot.color, true);
    if (!withBoard.valid || !withBoard.nextBoard) continue;

    let score = evaluateBoardPosition(withBoard.nextBoard, bot.color);

    // 場外押し出しは最優先
    if (evalResult.pushesOut) {
      score += bot.pushedOut + 1 >= state.rules.pushOutTarget ? 100000 : 180;
    } else if (evalResult.isSumito) {
      // 相手を端へ押し込むスミトを高評価
      let maxOppDist = 0;
      for (const p of evalResult.pushedTo) {
        const d = hexDistFromCenter(p.q, p.r);
        if (d > maxOppDist) maxOppDist = d;
      }
      score += 24 + evalResult.pushedCount * 8 + maxOppDist * 7;
    }

    // 複数玉でまとまって動く手をわずかに優遇
    score += move.marbles.length * 1.6;

    // わずかなランダム性で千日手を防ぐ
    score += Math.random() * 2.5;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return {
    type: 'move',
    payload: {
      marbles: bestMove.marbles,
      dirIndex: bestMove.dirIndex,
    },
  };
}

export function sanitizeHexPushState(
  state: HexPushInternalState,
  playerId: string
): HexPushClientState {
  return {
    ...state,
    myId: playerId,
  };
}
