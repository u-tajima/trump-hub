// 紛らわしい文字 (0, O, 1, I, L) を除いた5文字の部屋コード
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PEER_PREFIX = 'trump-hub-v1-';

export function generateRoomCode(length = 5): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function roomCodeToPeerId(code: string): string {
  return `${PEER_PREFIX}${normalizeRoomCode(code)}`;
}

export function buildInviteUrl(code: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', normalizeRoomCode(code));
  return url.toString();
}

export function getRoomCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('room');
  if (!raw) return null;
  const normalized = normalizeRoomCode(raw);
  return normalized.length >= 4 ? normalized : null;
}
