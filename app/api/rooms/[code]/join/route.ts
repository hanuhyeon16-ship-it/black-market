import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { gameRooms } from "../../../../../db/schema";
import { cleanName, cleanSkin, parseGameState, roomError } from "../../shared";

type RouteContext = { params: Promise<{ code: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = rawCode.trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(code)) {
      return Response.json({ error: "방 코드는 영문과 숫자 6자리입니다." }, { status: 400 });
    }

    const db = getDb();
    const [room] = await db.select().from(gameRooms).where(eq(gameRooms.code, code)).limit(1);
    if (!room) return Response.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
    if (room.guestToken || room.status !== "waiting") {
      return Response.json({ error: "이미 두 명이 들어간 방입니다." }, { status: 409 });
    }

    const payload = (await request.json()) as { name?: string; skin?: string };
    const guestName = cleanName(payload.name, "도전자");
    const guestSkin = cleanSkin(payload.skin, "crown");
    const state = parseGameState(JSON.parse(room.stateJson));
    if (!state) return Response.json({ error: "방의 게임 상태가 손상되었습니다." }, { status: 500 });

    state.players[1] = { ...state.players[1], name: guestName, skin: guestSkin };
    state.phase = "roll";
    state.message = `${state.players[0].name} 차례 · 주사위를 굴리세요.`;
    state.lastEvent = "온라인 상대 입장 완료";
    state.log = [`${guestName} 방 입장`, ...state.log].slice(0, 6);
    const guestToken = crypto.randomUUID();
    const nextVersion = room.version + 1;
    const updated = await db.update(gameRooms)
      .set({
        guestToken,
        stateJson: JSON.stringify(state),
        status: "playing",
        version: nextVersion,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(gameRooms.code, code), isNull(gameRooms.guestToken)))
      .returning({ code: gameRooms.code });

    if (updated.length === 0) {
      return Response.json({ error: "다른 플레이어가 먼저 입장했습니다." }, { status: 409 });
    }

    return Response.json({
      code,
      token: guestToken,
      playerId: 1,
      status: "playing",
      version: nextVersion,
      state,
    });
  } catch (error) {
    return Response.json({ error: roomError(error) }, { status: 500 });
  }
}
