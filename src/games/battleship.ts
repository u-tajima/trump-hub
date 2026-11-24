import type { BattleshipRules, PlayerInfo } from '../types/game';

export type ShotCell = 'hit' | 'miss' | null;

export interface BattleshipShip {
  id: string;
  name: string;
  length: number;
  row: number;
  col: number;
  horizontal: boolean;
  sunk: boolean;
}

export interface BattleshipPlayerInternal {
  id: string;
  name: string;
  isBot: boolean;
  ships: BattleshipShip[];
  setupConfirmed: boolean;
  shotsReceived: ShotCell[][];
}

export interface BattleshipInternalState {
  rules: BattleshipRules;
  players: [BattleshipPlayerInternal, BattleshipPlayerInternal];
  subPhase: 'setup' | 'battle';
  turnIndex: 0 | 1;
  lastShot: {
    shooterId: string;
    targetId: string;
    row: number;
    col: number;
    result: 'hit' | 'sunk' | 'miss';
    shipName?: string;
  } | null;
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
}

export interface BattleshipPlayerSummary {
  id: string;
  name: string;
  isBot: boolean;
  setupConfirmed: boolean;
  remainingShips: number;
  totalShips: number;
}

export interface BattleshipClientState {
  rules: BattleshipRules;
  players: [BattleshipPlayerSummary, BattleshipPlayerSummary];
  subPhase: 'setup' | 'battle';
  turnIndex: 0 | 1;
  lastShot: BattleshipInternalState['lastShot'];
  winnerId: string | null;
  phase: 'playing' | 'finished';
  lastLog: string;
  myId: string;
  myShips: BattleshipShip[];
  myShotsReceived: ShotCell[][];
  mySetupConfirmed: boolean;
  opponentShotsReceived: ShotCell[][];
  opponentRevealedShips: BattleshipShip[];
  opponentRemainingLengths: number[];
}

function getFleetSpec(boardSize: 8 | 10): { id: string; name: string; length: number }[] {
  if (boardSize === 8) {
    return [
      { id: 'battleship', name: '戦艦', length: 4 },
      { id: 'cruiser', name: '巡洋艦', length: 3 },
      { id: 'submarine', name: '潜水艦', length: 3 },
      { id: 'destroyer', name: '駆逐艦', length: 2 },
    ];
  }
  return [
    { id: 'carrier', name: '空母', length: 5 },
    { id: 'battleship', name: '戦艦', length: 4 },
    { id: 'cruiser', name: '巡洋艦', length: 3 },
    { id: 'submarine', name: '潜水艦', length: 3 },
    { id: 'destroyer', name: '駆逐艦', length: 2 },
  ];
}

export function getShipCells(ship: BattleshipShip): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = [];
  for (let i = 0; i < ship.length; i++) {
    cells.push({
      row: ship.horizontal ? ship.row : ship.row + i,
      col: ship.horizontal ? ship.col + i : ship.col,
    });
  }
  return cells;
}

function canPlaceShip(
  boardSize: number,
  otherShips: BattleshipShip[],
  row: number,
  col: number,
  length: number,
  horizontal: boolean
): boolean {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  if (row < 0 || col < 0 || row >= boardSize || col >= boardSize) return false;
  if (horizontal && col + length > boardSize) return false;
  if (!horizontal && row + length > boardSize) return false;

  const occupied = new Set<string>();
  for (const s of otherShips) {
    for (const c of getShipCells(s)) {
      occupied.add(`${c.row},${c.col}`);
    }
  }

  for (let i = 0; i < length; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;
    if (occupied.has(`${r},${c}`)) return false;
  }
  return true;
}

function generateRandomFleet(boardSize: 8 | 10): BattleshipShip[] {
  const specs = getFleetSpec(boardSize);
  const ships: BattleshipShip[] = [];

  for (const spec of specs) {
    let placed = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      const horizontal = Math.random() < 0.5;
      const maxRow = horizontal ? boardSize : boardSize - spec.length + 1;
      const maxCol = horizontal ? boardSize - spec.length + 1 : boardSize;
      const row = Math.floor(Math.random() * maxRow);
      const col = Math.floor(Math.random() * maxCol);
      if (canPlaceShip(boardSize, ships, row, col, spec.length, horizontal)) {
        ships.push({
          id: spec.id,
          name: spec.name,
          length: spec.length,
          row,
          col,
          horizontal,
          sunk: false,
        });
        placed = true;
        break;
      }
    }
    if (!placed) {
      // フォールバック: 走査で必ず配置
      outer: for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
          for (const horizontal of [true, false]) {
            if (canPlaceShip(boardSize, ships, r, c, spec.length, horizontal)) {
              ships.push({
                id: spec.id,
                name: spec.name,
                length: spec.length,
                row: r,
                col: c,
                horizontal,
                sunk: false,
              });
              break outer;
            }
          }
        }
      }
    }
  }

  return ships;
}

function createEmptyGrid(n: number): ShotCell[][] {
  return Array.from({ length: n }, () => Array<ShotCell>(n).fill(null));
}

export function initBattleship(
  playersInfo: PlayerInfo[],
  rules: BattleshipRules
): BattleshipInternalState {
  const p0: BattleshipPlayerInternal = {
    id: playersInfo[0].id,
    name: playersInfo[0].name,
    isBot: playersInfo[0].isBot,
    ships: generateRandomFleet(rules.boardSize),
    setupConfirmed: playersInfo[0].isBot,
    shotsReceived: createEmptyGrid(rules.boardSize),
  };
  const p1: BattleshipPlayerInternal = {
    id: playersInfo[1].id,
    name: playersInfo[1].name,
    isBot: playersInfo[1].isBot,
    ships: generateRandomFleet(rules.boardSize),
    setupConfirmed: playersInfo[1].isBot,
    shotsReceived: createEmptyGrid(rules.boardSize),
  };

  const bothReady = p0.setupConfirmed && p1.setupConfirmed;

  return {
    rules,
    players: [p0, p1],
    subPhase: bothReady ? 'battle' : 'setup',
    turnIndex: 0,
    lastShot: null,
    winnerId: null,
    phase: 'playing',
    lastLog: bothReady
      ? `海戦開始！${p0.name} の砲撃からスタート`
      : '艦隊を配置して「配置完了」を押してください',
  };
}

export function applyBattleshipAction(
  state: BattleshipInternalState,
  playerId: string,
  action: { type: string; payload?: unknown }
): { state: BattleshipInternalState; error?: string } {
  if (state.phase !== 'playing') {
    return { state, error: 'ゲームは終了しています' };
  }

  const pIdx = state.players.findIndex((p) => p.id === playerId);
  if (pIdx === -1) {
    return { state, error: 'プレイヤーが見つかりません' };
  }

  // ===== SETUP PHASE =====
  if (state.subPhase === 'setup') {
    const me = state.players[pIdx];
    if (me.setupConfirmed) {
      return { state, error: 'すでに配置を確定しています' };
    }

    if (action.type === 'autoPlace') {
      const nextPlayers: [BattleshipPlayerInternal, BattleshipPlayerInternal] = [
        { ...state.players[0] },
        { ...state.players[1] },
      ];
      nextPlayers[pIdx] = {
        ...me,
        ships: generateRandomFleet(state.rules.boardSize),
      };
      return {
        state: {
          ...state,
          players: nextPlayers,
          lastLog: `${me.name} が艦隊をランダム再配置しました`,
        },
      };
    }

    if (action.type === 'placeShip') {
      const { shipId, row, col, horizontal } = (action.payload as {
        shipId?: string;
        row?: number;
        col?: number;
        horizontal?: boolean;
      }) ?? {};
      const targetShip = me.ships.find((s) => s.id === shipId);
      if (
        !targetShip ||
        typeof row !== 'number' ||
        typeof col !== 'number' ||
        typeof horizontal !== 'boolean'
      ) {
        return { state, error: '不正な配置指定です' };
      }

      const others = me.ships.filter((s) => s.id !== shipId);
      if (!canPlaceShip(state.rules.boardSize, others, row, col, targetShip.length, horizontal)) {
        return { state, error: 'そこには配置できません' };
      }

      const nextShips = me.ships.map((s) =>
        s.id === shipId ? { ...s, row, col, horizontal } : s
      );
      const nextPlayers: [BattleshipPlayerInternal, BattleshipPlayerInternal] = [
        { ...state.players[0] },
        { ...state.players[1] },
      ];
      nextPlayers[pIdx] = { ...me, ships: nextShips };
      return {
        state: {
          ...state,
          players: nextPlayers,
        },
      };
    }

    if (action.type === 'confirmSetup') {
      const nextPlayers: [BattleshipPlayerInternal, BattleshipPlayerInternal] = [
        { ...state.players[0] },
        { ...state.players[1] },
      ];
      nextPlayers[pIdx] = { ...me, setupConfirmed: true };

      const bothReady = nextPlayers[0].setupConfirmed && nextPlayers[1].setupConfirmed;
      return {
        state: {
          ...state,
          players: nextPlayers,
          subPhase: bothReady ? 'battle' : 'setup',
          turnIndex: 0,
          lastLog: bothReady
            ? `両軍配置完了！${nextPlayers[0].name} の砲撃から開始`
            : `${me.name} が配置完了。相手の準備を待っています`,
        },
      };
    }

    return { state, error: '配置フェーズではその操作はできません' };
  }

  // ===== BATTLE PHASE =====
  if (action.type !== 'fire') {
    return { state, error: '不明なアクションです' };
  }

  if (state.turnIndex !== pIdx) {
    return { state, error: 'あなたのターンではありません' };
  }

  const { row, col } = (action.payload as { row?: number; col?: number }) ?? {};
  const n = state.rules.boardSize;
  if (
    typeof row !== 'number' ||
    typeof col !== 'number' ||
    !Number.isInteger(row) ||
    !Number.isInteger(col) ||
    row < 0 ||
    row >= n ||
    col < 0 ||
    col >= n
  ) {
    return { state, error: '範囲外の座標です' };
  }

  const oppIdx: 0 | 1 = pIdx === 0 ? 1 : 0;
  const shooter = state.players[pIdx];
  const target = state.players[oppIdx];

  if (target.shotsReceived[row][col] !== null) {
    return { state, error: 'すでに攻撃済みのマスです' };
  }

  const nextShots = target.shotsReceived.map((r) => [...r]);
  let hitShip: BattleshipShip | null = null;
  for (const s of target.ships) {
    if (getShipCells(s).some((c) => c.row === row && c.col === col)) {
      hitShip = s;
      break;
    }
  }

  let result: 'hit' | 'sunk' | 'miss' = 'miss';
  let sunkName: string | undefined;

  const nextTargetShips = target.ships.map((s) => ({ ...s }));
  if (hitShip) {
    nextShots[row][col] = 'hit';
    result = 'hit';
    const updatedShip = nextTargetShips.find((s) => s.id === hitShip!.id)!;
    const allHit = getShipCells(updatedShip).every((c) => nextShots[c.row][c.col] === 'hit');
    if (allHit) {
      updatedShip.sunk = true;
      result = 'sunk';
      sunkName = updatedShip.name;
    }
  } else {
    nextShots[row][col] = 'miss';
  }

  const nextPlayers: [BattleshipPlayerInternal, BattleshipPlayerInternal] = [
    { ...state.players[0] },
    { ...state.players[1] },
  ];
  nextPlayers[oppIdx] = {
    ...target,
    ships: nextTargetShips,
    shotsReceived: nextShots,
  };

  const allSunk = nextTargetShips.every((s) => s.sunk);
  const coordLabel = `${String.fromCharCode(65 + col)}${row + 1}`;

  if (allSunk) {
    return {
      state: {
        ...state,
        players: nextPlayers,
        lastShot: {
          shooterId: shooter.id,
          targetId: target.id,
          row,
          col,
          result: 'sunk',
          shipName: sunkName,
        },
        winnerId: shooter.id,
        phase: 'finished',
        lastLog: `${shooter.name} が ${target.name} の全艦を撃沈！勝利！`,
      },
    };
  }

  const keepTurn = state.rules.extraTurnOnHit && (result === 'hit' || result === 'sunk');
  const nextTurnIndex: 0 | 1 = keepTurn ? (pIdx as 0 | 1) : oppIdx;
  const nextActor = nextPlayers[nextTurnIndex];

  let log: string;
  if (result === 'sunk') {
    log = keepTurn
      ? `${shooter.name} が ${coordLabel} で「${sunkName}」を撃沈！連続攻撃`
      : `${shooter.name} が ${coordLabel} で「${sunkName}」を撃沈！次は ${nextActor.name}`;
  } else if (result === 'hit') {
    log = keepTurn
      ? `${shooter.name} が ${coordLabel} に命中！連続攻撃`
      : `${shooter.name} が ${coordLabel} に命中！次は ${nextActor.name}`;
  } else {
    log = `${shooter.name} の ${coordLabel} は外れ。次は ${nextActor.name}`;
  }

  return {
    state: {
      ...state,
      players: nextPlayers,
      turnIndex: nextTurnIndex,
      lastShot: {
        shooterId: shooter.id,
        targetId: target.id,
        row,
        col,
        result,
        shipName: sunkName,
      },
      lastLog: log,
    },
  };
}

export function computeBattleshipBotAction(
  state: BattleshipInternalState
): { type: string; payload?: unknown } | null {
  if (state.phase !== 'playing') return null;

  if (state.subPhase === 'setup') {
    const unreadyBot = state.players.find((p) => p.isBot && !p.setupConfirmed);
    if (!unreadyBot) return null;
    return { type: 'confirmSetup' };
  }

  const botIdx = state.turnIndex;
  if (!state.players[botIdx].isBot) return null;

  const oppIdx: 0 | 1 = botIdx === 0 ? 1 : 0;
  const target = state.players[oppIdx];
  const n = state.rules.boardSize;
  const shots = target.shotsReceived;

  // 撃沈済み艦のマスを除外した「未撃沈の命中マス」を抽出
  const sunkSet = new Set<string>();
  for (const s of target.ships) {
    if (s.sunk) {
      for (const c of getShipCells(s)) {
        sunkSet.add(`${c.row},${c.col}`);
      }
    }
  }

  const activeHits: { row: number; col: number }[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (shots[r][c] === 'hit' && !sunkSet.has(`${r},${c}`)) {
        activeHits.push({ row: r, col: c });
      }
    }
  }

  // ターゲットモード: 未撃沈の命中マスがある場合、直線方向や隣接4方向を優先攻撃
  if (activeHits.length > 0) {
    const lineCandidates: { row: number; col: number }[] = [];
    const adjCandidates: { row: number; col: number }[] = [];

    const addIfValid = (list: { row: number; col: number }[], r: number, c: number) => {
      if (r >= 0 && r < n && c >= 0 && c < n && shots[r][c] === null) {
        if (!list.some((x) => x.row === r && x.col === c)) {
          list.push({ row: r, col: c });
        }
      }
    };

    // 同じ行・列に並ぶ命中があれば延長線上を最優先
    if (activeHits.length >= 2) {
      for (const h of activeHits) {
        const hasHorizNeighbor = activeHits.some(
          (o) => o.row === h.row && Math.abs(o.col - h.col) === 1
        );
        const hasVertNeighbor = activeHits.some(
          (o) => o.col === h.col && Math.abs(o.row - h.row) === 1
        );
        if (hasHorizNeighbor) {
          addIfValid(lineCandidates, h.row, h.col - 1);
          addIfValid(lineCandidates, h.row, h.col + 1);
        }
        if (hasVertNeighbor) {
          addIfValid(lineCandidates, h.row - 1, h.col);
          addIfValid(lineCandidates, h.row + 1, h.col);
        }
      }
    }

    if (lineCandidates.length > 0) {
      const pick = lineCandidates[Math.floor(Math.random() * lineCandidates.length)];
      return { type: 'fire', payload: pick };
    }

    for (const h of activeHits) {
      addIfValid(adjCandidates, h.row - 1, h.col);
      addIfValid(adjCandidates, h.row + 1, h.col);
      addIfValid(adjCandidates, h.row, h.col - 1);
      addIfValid(adjCandidates, h.row, h.col + 1);
    }

    if (adjCandidates.length > 0) {
      const pick = adjCandidates[Math.floor(Math.random() * adjCandidates.length)];
      return { type: 'fire', payload: pick };
    }
  }

  // ハンターモード: チェッカーボード（市松模様）を優先
  const checker: { row: number; col: number }[] = [];
  const rest: { row: number; col: number }[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (shots[r][c] === null) {
        if ((r + c) % 2 === 0) checker.push({ row: r, col: c });
        else rest.push({ row: r, col: c });
      }
    }
  }

  const pool = checker.length > 0 ? checker : rest;
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return { type: 'fire', payload: pick };
}

export function sanitizeBattleshipState(
  state: BattleshipInternalState,
  playerId: string
): BattleshipClientState {
  const myIdx = state.players.findIndex((p) => p.id === playerId);
  const effectiveMyIdx: 0 | 1 = myIdx === 1 ? 1 : 0;
  const oppIdx: 0 | 1 = effectiveMyIdx === 0 ? 1 : 0;

  const me = state.players[effectiveMyIdx];
  const opp = state.players[oppIdx];

  const summaries: [BattleshipPlayerSummary, BattleshipPlayerSummary] = [
    {
      id: state.players[0].id,
      name: state.players[0].name,
      isBot: state.players[0].isBot,
      setupConfirmed: state.players[0].setupConfirmed,
      remainingShips: state.players[0].ships.filter((s) => !s.sunk).length,
      totalShips: state.players[0].ships.length,
    },
    {
      id: state.players[1].id,
      name: state.players[1].name,
      isBot: state.players[1].isBot,
      setupConfirmed: state.players[1].setupConfirmed,
      remainingShips: state.players[1].ships.filter((s) => !s.sunk).length,
      totalShips: state.players[1].ships.length,
    },
  ];

  // ゲーム終了時は相手の全艦を公開、進行中は撃沈済みの艦のみ公開
  const opponentRevealedShips =
    state.phase === 'finished'
      ? opp.ships
      : opp.ships.filter((s) => s.sunk);

  return {
    rules: state.rules,
    players: summaries,
    subPhase: state.subPhase,
    turnIndex: state.turnIndex,
    lastShot: state.lastShot,
    winnerId: state.winnerId,
    phase: state.phase,
    lastLog: state.lastLog,
    myId: playerId,
    myShips: myIdx === -1 ? [] : me.ships,
    myShotsReceived: me.shotsReceived,
    mySetupConfirmed: me.setupConfirmed,
    opponentShotsReceived: opp.shotsReceived,
    opponentRevealedShips,
    opponentRemainingLengths: opp.ships.filter((s) => !s.sunk).map((s) => s.length),
  };
}
