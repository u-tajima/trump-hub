/**
 * スマホの指弾き（フリック）操作から、手のブレ・スワイプ速度・方向をリアルに読み取るユーティリティ。
 * 長い照準点線で100%狙い通りに撃つパチンコ方式ではなく、
 * 実際に指を弾いた軌跡の最終区間ベクトル＋直前の横ブレ成分をそのまま発射ベクトルへ変換する。
 */

/** 指が動き出してからスワイプを読み取る時間ウィンドウ（0.16秒＝コンマ数秒） */
export const FLICK_CAPTURE_MS = 160;

/** 「弾き始め」を検知する論理座標上の最小移動距離 */
export const FLICK_MOVE_START_DIST = 6;

export interface FlickSample {
  x: number; // 盤面論理座標X
  y: number; // 盤面論理座標Y
  t: number; // performance.now() ミリ秒
}

export interface FlickResult {
  vx: number;
  vy: number;
  speed: number;
  angle: number;
  powerRatio: number; // 0..1
  /** スワイプ中の手のブレ量（度）。UIでのフィードバック等に利用可能 */
  wobbleDeg: number;
}

export interface FlickComputeOptions {
  minSpeed: number;
  maxSpeed: number;
  /** 論理座標上の最低スワイプ距離（これ未満は誤タップとしてキャンセル） */
  minDistance: number;
  /** 最大パワーに到達するスワイプ速度（論理px / ms） */
  maxSwipeVelocity: number;
  /** 最低パワーの基準スワイプ速度（論理px / ms） */
  minSwipeVelocity?: number;
  /** 読み取り上限時間（ミリ秒）。未指定時は FLICK_CAPTURE_MS (160ms) */
  captureWindowMs?: number;
}

/**
 * 記録されたポインタ軌跡（論理座標）から、動き出し後のコンマ数秒間（既定160ms）のスワイプだけを使って発射速度ベクトルを算出する。
 * - 速度: ウィンドウ内リリース直前区間の実測移動速度をベースに算出
 * - 角度: ウィンドウ内の実測方向をベースに、直前セグメントとの角度差（手のブレ）を自然に反映
 */
export function computeFlickVelocity(
  rawSamples: FlickSample[],
  options: FlickComputeOptions
): FlickResult | null {
  if (rawSamples.length < 2) return null;

  // 動き出しサンプルを特定し、そこから captureWindowMs 以内のサンプルだけを切り出す
  const captureMs = options.captureWindowMs ?? FLICK_CAPTURE_MS;
  const origin = rawSamples[0];
  let startIdx = 0;
  for (let i = 1; i < rawSamples.length; i++) {
    if (Math.hypot(rawSamples[i].x - origin.x, rawSamples[i].y - origin.y) >= FLICK_MOVE_START_DIST) {
      startIdx = i - 1;
      break;
    }
  }
  const startTime = rawSamples[startIdx].t;
  const samples: FlickSample[] = [];
  for (let i = startIdx; i < rawSamples.length; i++) {
    if (rawSamples[i].t - startTime <= captureMs + 16 || samples.length < 2) {
      samples.push(rawSamples[i]);
    } else {
      break;
    }
  }
  if (samples.length < 2) return null;

  const first = samples[0];
  const last = samples[samples.length - 1];
  const totalDx = last.x - first.x;
  const totalDy = last.y - first.y;
  const totalDist = Math.hypot(totalDx, totalDy);

  if (totalDist < options.minDistance) {
    return null;
  }

  // リリース直前 ~48ms の区間を抽出（素早いスマホフリックでも離し際の勢いと手のブレを忠実に拾う）
  const WINDOW_MS = 48;
  let anchorIdx = samples.length - 2;
  for (let i = samples.length - 2; i >= 0; i--) {
    anchorIdx = i;
    if (last.t - samples[i].t >= WINDOW_MS) {
      break;
    }
  }
  // 全体が48ms以内の超高速フリックでも3点以上あれば中盤以降を基準にして抜き際のブレを拾う
  if (anchorIdx === 0 && samples.length >= 3) {
    anchorIdx = Math.floor(samples.length / 2);
  }

  const anchor = samples[anchorIdx];
  let dx = last.x - anchor.x;
  let dy = last.y - anchor.y;
  let segDist = Math.hypot(dx, dy);
  let dt = Math.max(12, last.t - anchor.t);

  // リリース直前に指が止まってしまった場合は全体ストロークからフォールバック（ただし速度は低めになる）
  if (segDist < options.minDistance * 0.35) {
    dx = totalDx;
    dy = totalDy;
    segDist = totalDist;
    dt = Math.max(24, last.t - first.t);
  }

  // 直前ストロークの進行方向
  const recentAngle = Math.atan2(dy, dx);
  const overallAngle = Math.atan2(totalDy, totalDx);

  // 全体方向とリリース直前方向のズレ（＝手のブレ・曲がり）を算出
  let angleDiff = recentAngle - overallAngle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  // 最終発射角度：リリース直前の実測角度を主軸にしつつ、ブレ成分をそのまま残す
  // （急な手首の返りがあるとその方向へわずかに引っ張られるリアルな挙動）
  const clampedWobble = Math.max(-0.45, Math.min(0.45, angleDiff));
  const finalAngle = recentAngle + clampedWobble * 0.25;

  // スワイプ速度（論理px / ms）からパワー比率 0..1 へマッピング
  const swipeVel = segDist / dt;
  const minVel = options.minSwipeVelocity ?? options.maxSwipeVelocity * 0.14;
  // 短い距離でゆっくり動かした時は弱く、素早く弾いた時は強いカーブ
  const rawRatio = (swipeVel - minVel) / Math.max(0.01, options.maxSwipeVelocity - minVel);
  const distFactor = Math.min(1, totalDist / (options.minDistance * 3.2));
  const powerRatio = Math.max(0.04, Math.min(1, rawRatio * 0.82 + distFactor * 0.18));

  const speed = options.minSpeed + powerRatio * (options.maxSpeed - options.minSpeed);

  return {
    vx: Math.cos(finalAngle) * speed,
    vy: Math.sin(finalAngle) * speed,
    speed,
    angle: finalAngle,
    powerRatio,
    wobbleDeg: Math.abs((angleDiff * 180) / Math.PI),
  };
}
