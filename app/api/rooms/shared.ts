export const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ALLOWED_SKINS = new Set(["diamond", "cat", "crown", "robot", "ghost", "fox"]);

export type StoredPlayer = {
  id: 0 | 1;
  name: string;
  skin: string;
  [key: string]: unknown;
};

export type StoredGameState = {
  mode: string;
  players: [StoredPlayer, StoredPlayer];
  phase: string;
  current: 0 | 1;
  message: string;
  lastEvent: string;
  log: string[];
  [key: string]: unknown;
};

export function makeRoomCode() {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export function cleanName(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, 12) || fallback;
}

export function cleanSkin(value: unknown, fallback: string) {
  return typeof value === "string" && ALLOWED_SKINS.has(value) ? value : fallback;
}

export function parseGameState(value: unknown): StoredGameState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<StoredGameState>;
  if (!Array.isArray(state.players) || state.players.length !== 2) return null;
  if (!Array.isArray(state.log)) return null;
  return value as StoredGameState;
}

export function roomError(error: unknown) {
  const message = error instanceof Error ? error.message : "알 수 없는 오류";
  if (message.includes("no such table") || message.includes("game_rooms")) {
    return "온라인 방 저장소를 준비하는 중입니다. 잠시 후 다시 시도해 주세요.";
  }
  return "온라인 방을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
