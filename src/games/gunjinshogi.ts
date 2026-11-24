import type { GunjinShogiRules, PlayerInfo } from '../types/game';

export type GunjinPieceType =
  | 'taisho'
  | 'chujo'
  | 'shosho'
  | 'taisa'
  | 'chusa'
  | 'shosa'
  | 'taii'
  | 'hikoki'
  | 'tank'
  | 'kihei'
  | 'kohei'
  | 'spy'
  | 'jirai'
  | 'gunki';

export type GunjinVisiblePieceType = GunjinPieceType | 'hidden';

export interface GunjinPiece {
  owner: 0 | 1; // 0: 下側 (row 4..7), 1: 上側 (row 0..3)
  type: GunjinPieceType;
}

export interface GunjinVisiblePiece {
  owner: 0 | 1;
  type: GunjinVisiblePieceType;
}

export interface GunjinCoord {
  row: number;
  col: number;
}

export interface GunjinMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export interface GunjinPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  side: 0 | 1;
  setupConfirmed: boolean;
}

export interface GunjinBattleInfo {
  attackerSide: 0 | 1;
  row: number;
  col: number;
  outcome: 'attackerWin' | 'defenderWin' | 'draw';
}

export interface GunjinShogiInternalState {
  rules: GunjinShogiRules;
  players: [GunjinPlayerState, GunjinPlayerState];
  board: (GunjinPiece | null)[][]; // 8 rows x 6 cols
  subPhase: 'setup' | 'battle';
  turnIndex: 0 | 1;
  lastMove: GunjinMove | null;
  lastBattle: GunjinBattleInfo | null;
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface GunjinShogiClientState {
  rules: GunjinShogiRules;
  players: [GunjinPlayerState, GunjinPlayerState];
  board: (GunjinVisiblePiece | null)[][];
  subPhase: 'setup' | 'battle';
  turnIndex: 0 | 1;
  lastMove: GunjinMove | null;
  lastBattle: GunjinBattleInfo | null;
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
  myId: string;
  mySide: 0 | 1 | null;
  validMoves: GunjinMove[];
  remainingCounts: [number, number];
}

export const GUNJIN_ROWS = 8;
export const GUNJIN_COLS = 6;
export const BRIDGE_COLS = [1, 4] as const;

export const PIECE_LABELS: Record<GunjinPieceType, { name: string; short: string; rankText: string }> = {
  taisho: { name: '大将', short: '大将', rankText: '最高階級（スパイにのみ負ける）' },
  chujo: { name: '中将', short: '中将', rankText: '将官（大将に次ぐ強さ）' },
  shosho: { name: '少将', short: '少将', rankText: '将官（飛行機・タンクに勝つ）' },
  taisa: { name: '大佐', short: '大佐', rankText: '佐官（中佐以下に勝つ）' },
  chusa: { name: '中佐', short: '中佐', rankText: '佐官（少佐以下に勝つ）' },
  shosa: { name: '少佐', short: '少佐', rankText: '佐官（大尉以下に勝つ）' },
  taii: { name: '大尉', short: '大尉', rankText: '尉官（工兵・スパイに勝つ）' },
  hikoki: { name: '飛行機', short: '飛行', rankText: '縦何マスでも飛ぶ（佐官以下に勝つ）' },
  tank: { name: 'タンク', short: '戦車', rankText: '前2マス進める（佐官以下に勝つ）' },
  kihei: { name: '騎兵', short: '騎兵', rankText: '前2マス進める（尉官・工兵に勝つ）' },
  kohei: { name: '工兵', short: '工兵', rankText: '前後左右何マスでも直進・地雷に勝つ' },
  spy: { name: 'スパイ', short: '間諜', rankText: '大将にのみ勝つ（他すべてに負ける）' },
  jirai: { name: '地雷', short: '地雷', rankText: '移動不可・工兵以外を道連れ撃破' },
  gunki: { name: '軍旗', short: '軍旗', rankText: '移動不可・後ろの自駒と同じ強さ' },
};

const INITIAL_ARMY: GunjinPieceType[] = [
  'taisho',
  'chujo',
  'shosho',
  'taisa',
  'chusa',
  'shosa',
  'taii',
  'hikoki',
  'tank',
  'kihei',
  'kohei',
  'kohei',
  'spy',
  'jirai',
  'jirai',
  'gunki',
];

const LINEAR_RANK: Partial<Record<GunjinPieceType, number>> = {
  taisho: 9,
  chujo: 8,
  shosho: 7,
  taisa: 6,
  chusa: 5,
  shosa: 4,
  taii: 3,
  kihei: 2,
  kohei: 1,
  spy: 0,
};

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < GUNJIN_ROWS && c >= 0 && c < GUNJIN_COLS;
}

export function isBridgeCol(c: number): boolean {
  return c === 1 || c === 4;
}

export function isHeadquarters(r: number, c: number, side: 0 | 1): boolean {
  const hqRow = side === 0 ? 7 : 0;
  return r === hqRow && (c === 2 || c === 3);
}

function isOwnTerritory(r: number, side: 0 | 1): boolean {
  return side === 0 ? r >= 4 && r <= 7 : r >= 0 && r <= 3;
}

function crossesRiver(r1: number, r2: number): boolean {
  return (r1 <= 3 && r2 >= 4) || (r1 >= 4 && r2 <= 3);
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * 自陣（4行×6列=24マス）に16駒を戦略的にランダム配置する。
 * 総司令部(hqRow, col 2/3)付近に地雷や軍旗・強駒がバランスよく収まるよう配置。
 */
function populateSideRandomly(board: (GunjinPiece | null)[][], side: 0 | 1): void {
  const rows = side === 0 ? [4, 5, 6, 7] : [3, 2, 1, 0]; // rows[0]が前線, rows[3]が最後列
  for (const r of rows) {
    for (let c = 0; c < GUNJIN_COLS; c++) {
      board[r][c] = null;
    }
  }

  const cells: GunjinCoord[] = [];
  for (const r of rows) {
    for (let c = 0; c < GUNJIN_COLS; c++) {
      cells.push({ row: r, col: c });
    }
  }

  const shuffledCells = shuffleArray(cells);
  const shuffledArmy = shuffleArray(INITIAL_ARMY);

  // 軍旗はなるべく中〜後列（後ろに駒を置きやすい行）に配置
  const gunkiIdx = shuffledArmy.indexOf('gunki');
  const preferredGunki = shuffledCells.findIndex(
    (pos) => pos.row === rows[1] || pos.row === rows[2]
  );
  if (gunkiIdx >= 0 && preferredGunki >= 0) {
    [shuffledCells[gunkiIdx], shuffledCells[preferredGunki]] = [
      shuffledCells[preferredGunki],
      shuffledCells[gunkiIdx],
    ];
  }

  for (let i = 0; i < shuffledArmy.length; i++) {
    const pos = shuffledCells[i];
    board[pos.row][pos.col] = { owner: side, type: shuffledArmy[i] };
  }
}

export function getGunjinValidMovesForPiece(
  board: (GunjinPiece | null)[][],
  row: number,
  col: number
): GunjinMove[] {
  const piece = board[row]?.[col];
  if (!piece) return [];
  if (piece.type === 'jirai' || piece.type === 'gunki') return [];

  const moves: GunjinMove[] = [];
  const forwardDr = piece.owner === 0 ? -1 : 1;

  const canStepOnto = (tr: number, tc: number): boolean => {
    if (!inBounds(tr, tc)) return false;
    const target = board[tr][tc];
    return !target || target.owner !== piece.owner;
  };

  const canCross = (r1: number, r2: number, colIdx: number): boolean => {
    if (!crossesRiver(r1, r2)) return true;
    return isBridgeCol(colIdx);
  };

  if (piece.type === 'hikoki') {
    // 縦に何マスでも飛べる（川も駒も飛び越せる）
    for (let tr = 0; tr < GUNJIN_ROWS; tr++) {
      if (tr !== row && canStepOnto(tr, col)) {
        moves.push({ fromRow: row, fromCol: col, toRow: tr, toCol: col });
      }
    }
    // 左右は1マス
    for (const dc of [-1, 1]) {
      const tc = col + dc;
      if (canStepOnto(row, tc)) {
        moves.push({ fromRow: row, fromCol: col, toRow: row, toCol: tc });
      }
    }
    return moves;
  }

  if (piece.type === 'kohei') {
    // 前後左右に何マスでも直進（間の駒は飛び越せない、川は橋のみ）
    const dirs: [number, number][] = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of dirs) {
      let curR = row;
      let curC = col;
      while (true) {
        const nr = curR + dr;
        const nc = curC + dc;
        if (!inBounds(nr, nc)) break;
        if (dr !== 0 && !canCross(curR, nr, nc)) break;
        const target = board[nr][nc];
        if (!target) {
          moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc });
          curR = nr;
          curC = nc;
        } else {
          if (target.owner !== piece.owner) {
            moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc });
          }
          break;
        }
      }
    }
    return moves;
  }

  if (piece.type === 'tank' || piece.type === 'kihei') {
    // 前方に最大2マス（間の駒飛び越し不可、川は橋のみ）
    const f1 = row + forwardDr;
    if (inBounds(f1, col) && canCross(row, f1, col)) {
      const t1 = board[f1][col];
      if (!t1) {
        moves.push({ fromRow: row, fromCol: col, toRow: f1, toCol: col });
        const f2 = row + forwardDr * 2;
        if (inBounds(f2, col) && canCross(f1, f2, col) && canStepOnto(f2, col)) {
          moves.push({ fromRow: row, fromCol: col, toRow: f2, toCol: col });
        }
      } else if (t1.owner !== piece.owner) {
        moves.push({ fromRow: row, fromCol: col, toRow: f1, toCol: col });
      }
    }
    // 後ろ1マス
    const b1 = row - forwardDr;
    if (inBounds(b1, col) && canCross(row, b1, col) && canStepOnto(b1, col)) {
      moves.push({ fromRow: row, fromCol: col, toRow: b1, toCol: col });
    }
    // 左右1マス
    for (const dc of [-1, 1]) {
      const tc = col + dc;
      if (canStepOnto(row, tc)) {
        moves.push({ fromRow: row, fromCol: col, toRow: row, toCol: tc });
      }
    }
    return moves;
  }

  // 通常駒: 前後左右1マス（川は橋のみ）
  const dirs: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of dirs) {
    const nr = row + dr;
    const nc = col + dc;
    if (!inBounds(nr, nc)) continue;
    if (dr !== 0 && !canCross(row, nr, nc)) continue;
    if (canStepOnto(nr, nc)) {
      moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc });
    }
  }
  return moves;
}

export function getAllGunjinValidMoves(
  board: (GunjinPiece | null)[][],
  side: 0 | 1
): GunjinMove[] {
  const moves: GunjinMove[] = [];
  for (let r = 0; r < GUNJIN_ROWS; r++) {
    for (let c = 0; c < GUNJIN_COLS; c++) {
      if (board[r][c]?.owner === side) {
        moves.push(...getGunjinValidMovesForPiece(board, r, c));
      }
    }
  }
  return moves;
}

/**
 * 2駒の衝突審判。
 * 軍旗は「後ろの自駒と同じ強さ（後ろに自駒がなければ最弱）」として評価する。
 */
function resolveCombat(
  attacker: GunjinPiece,
  defender: GunjinPiece,
  board: (GunjinPiece | null)[][],
  defRow: number,
  defCol: number
): 'attackerWin' | 'defenderWin' | 'draw' {
  const aType = attacker.type;
  let dType: GunjinPieceType | 'flagWeak' = defender.type;

  // 軍旗の後ろの自駒を調べる
  if (dType === 'gunki') {
    const behindRow = defender.owner === 0 ? defRow + 1 : defRow - 1;
    const behindPiece = inBounds(behindRow, defCol) ? board[behindRow][defCol] : null;
    if (behindPiece && behindPiece.owner === defender.owner && behindPiece.type !== 'gunki') {
      dType = behindPiece.type;
    } else {
      dType = 'flagWeak';
    }
  }

  // 後ろに駒がない軍旗は最弱
  if (dType === 'flagWeak') {
    return 'attackerWin';
  }

  // 地雷: 工兵のみ勝つ、その他はすべて両者消滅（地雷が撃破して消費される）
  if (dType === 'jirai') {
    return aType === 'kohei' ? 'attackerWin' : 'draw';
  }

  // 同じ駒同士は相打ち
  if (aType === dType) {
    return 'draw';
  }

  // スパイの特例: 大将にのみ勝ち、それ以外すべてに負ける
  if (aType === 'spy') {
    return dType === 'taisho' ? 'attackerWin' : 'defenderWin';
  }
  if (dType === 'spy') {
    return aType === 'taisho' ? 'defenderWin' : 'attackerWin';
  }

  // 飛行機: 将官(大将/中将/少将)に負け、それ以外（佐官以下・タンク・騎兵・工兵）に勝つ
  const isGeneral = (t: GunjinPieceType) =>
    t === 'taisho' || t === 'chujo' || t === 'shosho';

  if (aType === 'hikoki') {
    return isGeneral(dType) ? 'defenderWin' : 'attackerWin';
  }
  if (dType === 'hikoki') {
    return isGeneral(aType) ? 'attackerWin' : 'defenderWin';
  }

  // タンク: 将官・飛行機に負け、佐官以下に勝つ
  if (aType === 'tank') {
    return isGeneral(dType) ? 'defenderWin' : 'attackerWin';
  }
  if (dType === 'tank') {
    return isGeneral(aType) ? 'attackerWin' : 'defenderWin';
  }

  // 将官・佐官・尉官・騎兵・工兵の階級比較
  const rankA = LINEAR_RANK[aType] ?? 0;
  const rankD = LINEAR_RANK[dType] ?? 0;
  if (rankA > rankD) return 'attackerWin';
  if (rankA < rankD) return 'defenderWin';
  return 'draw';
}

function countRemainingPieces(board: (GunjinPiece | null)[][]): [number, number] {
  let c0 = 0;
  let c1 = 0;
  for (let r = 0; r < GUNJIN_ROWS; r++) {
    for (let c = 0; c < GUNJIN_COLS; c++) {
      const p = board[r][c];
      if (p?.owner === 0) c0++;
      else if (p?.owner === 1) c1++;
    }
  }
  return [c0, c1];
}

export function initGunjinShogi(
  playersInfo: PlayerInfo[],
  rules: GunjinShogiRules
): GunjinShogiInternalState {
  const board: (GunjinPiece | null)[][] = Array.from({ length: GUNJIN_ROWS }, () =>
    Array<GunjinPiece | null>(GUNJIN_COLS).fill(null)
  );
  populateSideRandomly(board, 0);
  populateSideRandomly(board, 1);

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

  const players: [GunjinPlayerState, GunjinPlayerState] = [
    { id: p0.id, name: p0.name, isBot: p0.isBot, side: 0, setupConfirmed: p0.isBot },
    { id: p1.id, name: p1.name, isBot: p1.isBot, side: 1, setupConfirmed: p1.isBot },
  ];

  const bothReady = players[0].setupConfirmed && players[1].setupConfirmed;

  return {
    rules,
    players,
    board,
    subPhase: bothReady ? 'battle' : 'setup',
    turnIndex: 0,
    lastMove: null,
    lastBattle: null,
    winnerId: null,
    phase: 'playing',
    lastLog: bothReady
      ? `開戦！${players[0].name} のターン`
      : '作戦配置フェーズ：駒を入れ替えて配置完了を押してください',
  };
}

export function applyGunjinShogiAction(
  state: GunjinShogiInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: GunjinShogiInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }

  const pIdx = state.players.findIndex((p) => p.id === playerId);
  if (pIdx === -1) {
    return { state, error: 'プレイヤーが見つかりません' };
  }
  const actor = state.players[pIdx];

  // ===== SETUP PHASE =====
  if (state.subPhase === 'setup') {
    if (actor.setupConfirmed) {
      return { state, error: 'すでに配置完了しています' };
    }

    if (action.type === 'autoSetup') {
      if (!state.rules.autoSetupAllowed) {
        return { state, error: 'このルールではランダム再配置は無効です' };
      }
      const board = state.board.map((r) => r.map((c) => (c ? { ...c } : null)));
      populateSideRandomly(board, actor.side);
      return {
        state: {
          ...state,
          board,
          lastLog: `${actor.name} が陣形を再配置しました`,
        },
      };
    }

    if (action.type === 'swapSetup') {
      const payload = action.payload as {
        r1?: unknown;
        c1?: unknown;
        r2?: unknown;
        c2?: unknown;
      } | null;
      const r1 = payload?.r1;
      const c1 = payload?.c1;
      const r2 = payload?.r2;
      const c2 = payload?.c2;
      if (
        typeof r1 !== 'number' ||
        typeof c1 !== 'number' ||
        typeof r2 !== 'number' ||
        typeof c2 !== 'number' ||
        !Number.isInteger(r1) ||
        !Number.isInteger(c1) ||
        !Number.isInteger(r2) ||
        !Number.isInteger(c2) ||
        !inBounds(r1, c1) ||
        !inBounds(r2, c2) ||
        !isOwnTerritory(r1, actor.side) ||
        !isOwnTerritory(r2, actor.side)
      ) {
        return { state, error: '自陣のマスを選択してください' };
      }
      const board = state.board.map((r) => r.map((c) => (c ? { ...c } : null)));
      const tmp = board[r1][c1];
      board[r1][c1] = board[r2][c2];
      board[r2][c2] = tmp;
      return {
        state: {
          ...state,
          board,
        },
      };
    }

    if (action.type === 'confirmSetup') {
      const players: [GunjinPlayerState, GunjinPlayerState] = [
        { ...state.players[0] },
        { ...state.players[1] },
      ];
      players[pIdx].setupConfirmed = true;
      const bothReady = players[0].setupConfirmed && players[1].setupConfirmed;

      return {
        state: {
          ...state,
          players,
          subPhase: bothReady ? 'battle' : 'setup',
          lastLog: bothReady
            ? `両軍配置完了！開戦！${players[0].name} のターン`
            : `${actor.name} が配置を完了しました（相手の準備待ち）`,
        },
      };
    }

    return { state, error: '配置フェーズではその操作はできません' };
  }

  // ===== BATTLE PHASE =====
  const current = state.players[state.turnIndex];
  if (current.id !== playerId) {
    return { state, error: 'あなたのターンではありません' };
  }
  if (action.type !== 'move') {
    return { state, error: '不明なアクションです' };
  }

  const payload = action.payload as {
    fromRow?: unknown;
    fromCol?: unknown;
    toRow?: unknown;
    toCol?: unknown;
  } | null;
  const fromRow = payload?.fromRow;
  const fromCol = payload?.fromCol;
  const toRow = payload?.toRow;
  const toCol = payload?.toCol;

  if (
    typeof fromRow !== 'number' ||
    typeof fromCol !== 'number' ||
    typeof toRow !== 'number' ||
    typeof toCol !== 'number' ||
    !Number.isInteger(fromRow) ||
    !Number.isInteger(fromCol) ||
    !Number.isInteger(toRow) ||
    !Number.isInteger(toCol) ||
    !inBounds(fromRow, fromCol) ||
    !inBounds(toRow, toCol)
  ) {
    return { state, error: '不正な座標です' };
  }

  const piece = state.board[fromRow][fromCol];
  if (!piece || piece.owner !== current.side) {
    return { state, error: '自分の駒を選択してください' };
  }

  const legal = getGunjinValidMovesForPiece(state.board, fromRow, fromCol);
  const isLegal = legal.some((m) => m.toRow === toRow && m.toCol === toCol);
  if (!isLegal) {
    return { state, error: 'そこには移動できません' };
  }

  const board = state.board.map((r) => r.map((c) => (c ? { ...c } : null)));
  const attacker = board[fromRow][fromCol]!;
  const defender = board[toRow][toCol];
  board[fromRow][fromCol] = null;

  const nextIndex: 0 | 1 = state.turnIndex === 0 ? 1 : 0;
  const nextPlayer = state.players[nextIndex];
  const oppSide: 0 | 1 = current.side === 0 ? 1 : 0;

  let lastBattle: GunjinBattleInfo | null = null;
  let occupiedDest = false;
  let battleLog = `${current.name} が駒を進軍させました。次は ${nextPlayer.name}`;

  if (!defender) {
    board[toRow][toCol] = attacker;
    occupiedDest = true;
  } else {
    const outcome = resolveCombat(attacker, defender, board, toRow, toCol);
    lastBattle = {
      attackerSide: current.side,
      row: toRow,
      col: toCol,
      outcome,
    };

    if (outcome === 'attackerWin') {
      board[toRow][toCol] = attacker;
      occupiedDest = true;
      battleLog = `審判結果：${current.name} の駒が勝利しました！次は ${nextPlayer.name}`;
    } else if (outcome === 'defenderWin') {
      // 防御側が残り、攻撃側は消滅
      occupiedDest = false;
      battleLog = `審判結果：${current.name} の駒は撃退されました！次は ${nextPlayer.name}`;
    } else {
      // 相打ち（両者消滅）
      board[toRow][toCol] = null;
      occupiedDest = false;
      battleLog = `審判結果：相打ち（両者消滅）になりました！次は ${nextPlayer.name}`;
    }
  }

  const lastMove: GunjinMove = { fromRow, fromCol, toRow, toCol };

  // 勝利条件1: 相手の総司令部を占領
  if (occupiedDest && isHeadquarters(toRow, toCol, oppSide)) {
    return {
      state: {
        ...state,
        board,
        lastMove,
        lastBattle,
        winnerId: current.id,
        phase: 'finished',
        lastLog: `${current.name} が敵総司令部を占領し勝利！全駒を公開します`,
      },
    };
  }

  // 勝利条件2: 相手の動かせる駒が0になった
  const oppMoves = getAllGunjinValidMoves(board, oppSide);
  if (oppMoves.length === 0) {
    return {
      state: {
        ...state,
        board,
        lastMove,
        lastBattle,
        winnerId: current.id,
        phase: 'finished',
        lastLog: `${nextPlayer.name} の動かせる駒が全滅！${current.name} の勝利！`,
      },
    };
  }

  // 逆に自分の動かせる駒が0になった（相打ち・自爆で最後の可動駒を失った場合）
  const myMoves = getAllGunjinValidMoves(board, current.side);
  if (myMoves.length === 0) {
    return {
      state: {
        ...state,
        board,
        lastMove,
        lastBattle,
        winnerId: nextPlayer.id,
        phase: 'finished',
        lastLog: `${current.name} の動かせる駒が全滅！${nextPlayer.name} の勝利！`,
      },
    };
  }

  return {
    state: {
      ...state,
      board,
      turnIndex: nextIndex,
      lastMove,
      lastBattle,
      lastLog: battleLog,
    },
  };
}

export function computeGunjinShogiBotAction(
  state: GunjinShogiInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;

  if (state.subPhase === 'setup') {
    const unconfirmedBot = state.players.find((p) => p.isBot && !p.setupConfirmed);
    if (unconfirmedBot) return { type: 'confirmSetup' };
    return null;
  }

  const bot = state.players[state.turnIndex];
  const oppSide: 0 | 1 = bot.side === 0 ? 1 : 0;
  const moves = getAllGunjinValidMoves(state.board, bot.side);
  if (moves.length === 0) return null;

  const targetHqRow = oppSide === 0 ? 7 : 0;
  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const m of moves) {
    const piece = state.board[m.fromRow][m.fromCol]!;
    const target = state.board[m.toRow][m.toCol];
    let score = 0;

    // 敵総司令部へ突入できるなら最優先
    if (isHeadquarters(m.toRow, m.toCol, oppSide)) {
      score += target ? 140 : 500;
    }

    // 敵総司令部への距離が縮まる動きを評価
    const curDist = Math.abs(m.fromRow - targetHqRow) + Math.min(Math.abs(m.fromCol - 2), Math.abs(m.fromCol - 3));
    const nextDist = Math.abs(m.toRow - targetHqRow) + Math.min(Math.abs(m.toCol - 2), Math.abs(m.toCol - 3));
    score += (curDist - nextDist) * 14;

    // 敵駒との衝突評価（Botも不完全情報なので相手の正体は見ずに自分の強さで判断）
    if (target) {
      const attackStrength: Record<GunjinPieceType, number> = {
        taisho: 26,
        chujo: 28,
        shosho: 25,
        hikoki: 24,
        tank: 22,
        taisa: 18,
        chusa: 15,
        shosa: 12,
        kihei: 10,
        taii: 8,
        kohei: 16, // 地雷処理役として突撃価値あり
        spy: 14,
        jirai: 0,
        gunki: 0,
      };
      score += attackStrength[piece.type] ?? 10;
    }

    // 橋の確保を少し優遇
    if (isBridgeCol(m.toCol) && (m.toRow === 3 || m.toRow === 4)) {
      score += 8;
    }

    score += Math.random() * 5;
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }

  return {
    type: 'move',
    payload: {
      fromRow: bestMove.fromRow,
      fromCol: bestMove.fromCol,
      toRow: bestMove.toRow,
      toCol: bestMove.toCol,
    },
  };
}

export function sanitizeGunjinShogiState(
  state: GunjinShogiInternalState,
  playerId: string
): GunjinShogiClientState {
  const myPlayer = state.players.find((p) => p.id === playerId) ?? null;
  const mySide: 0 | 1 | null = myPlayer ? myPlayer.side : null;
  const isFinished = state.phase === 'finished';

  // 秘密情報隔離: 決着前、自駒以外は完全に 'hidden' にする（観戦者は全駒 'hidden'）
  const board: (GunjinVisiblePiece | null)[][] = state.board.map((row) =>
    row.map((cell) => {
      if (!cell) return null;
      if (isFinished || (mySide !== null && cell.owner === mySide)) {
        return { owner: cell.owner, type: cell.type };
      }
      return { owner: cell.owner, type: 'hidden' };
    })
  );

  const current = state.players[state.turnIndex];
  const validMoves =
    state.phase === 'playing' &&
    state.subPhase === 'battle' &&
    mySide !== null &&
    current.side === mySide
      ? getAllGunjinValidMoves(state.board, mySide)
      : [];

  return {
    rules: state.rules,
    players: state.players,
    board,
    subPhase: state.subPhase,
    turnIndex: state.turnIndex,
    lastMove: state.lastMove,
    lastBattle: state.lastBattle,
    winnerId: state.winnerId,
    phase: state.phase,
    lastLog: state.lastLog,
    myId: playerId,
    mySide,
    validMoves,
    remainingCounts: countRemainingPieces(state.board),
  };
}
