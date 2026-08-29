import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { gameRooms } from "../../../db/schema";
import {
  cleanName,
  cleanSkin,
  makeRoomCode,
  parseGameState,
  roomError,
} from "./shared";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name?: string;
      skin?: string;
      state?: unknown;
    };
    const state = parseGameState(payload.state);
    if (!state) {
      return Response.json({ error: "게임 상태가 올바르지 않습니다." }, { status: 400 });
    }

    const hostName = cleanName(payload.name, "방장");
    const hostSkin = cleanSkin(payload.skin, "diamond");
    state.mode = "online";
    state.players[0] = { ...state.players[0], name: hostName, skin: hostSkin };
    state.players[1] = { ...state.players[1], name: "상대 입장 대기", skin: "fox" };
    state.phase = "waiting";
    state.current = 0;
    state.message = "상대가 방 코드로 들어오기를 기다리고 있습니다.";
    state.lastEvent = "온라인 상대 대기 중";
    state.log = [`${hostName} 온라인 방 생성`, ...state.log].slice(0, 6);

    const db = getDb();
    const hostToken = crypto.randomUUID();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = makeRoomCode();
      const duplicate = await db.select({ code: gameRooms.code })
        .from(gameRooms)
        .where(eq(gameRooms.code, code))
        .limit(1);
      if (duplicate.length > 0) continue;

      await db.insert(gameRooms).values({
        code,
        hostToken,
        stateJson: JSON.stringify(state),
        status: "waiting",
        version: 1,
      });
      return Response.json({
        code,
        token: hostToken,
        playerId: 0,
        status: "waiting",
        version: 1,
        state,
      }, { status: 201 });
    }

    return Response.json({ error: "방 코드를 만들지 못했습니다. 다시 시도해 주세요." }, { status: 503 });
  } catch (error) {
    return Response.json({ error: roomError(error) }, { status: 500 });
  }
}
