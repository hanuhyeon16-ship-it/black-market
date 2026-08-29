import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { gameRooms } from "../../../../db/schema";
import { parseGameState, roomError } from "../shared";

type RouteContext = { params: Promise<{ code: string }> };

async function findRoom(code: string) {
  const db = getDb();
  const [room] = await db.select().from(gameRooms).where(eq(gameRooms.code, code)).limit(1);
  return room ?? null;
}

function playerForToken(room: NonNullable<Awaited<ReturnType<typeof findRoom>>>, token: string | null) {
  if (token && token === room.hostToken) return 0 as const;
  if (token && room.guestToken && token === room.guestToken) return 1 as const;
  return null;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = rawCode.trim().toUpperCase();
    const room = await findRoom(code);
    if (!room) return Response.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
    const playerId = playerForToken(room, request.headers.get("x-player-token"));
    if (playerId === null) return Response.json({ error: "이 방에 접속할 권한이 없습니다." }, { status: 403 });

    return Response.json({
      code,
      playerId,
      status: room.status,
      version: room.version,
      state: JSON.parse(room.stateJson),
    });
  } catch (error) {
    return Response.json({ error: roomError(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = rawCode.trim().toUpperCase();
    const room = await findRoom(code);
    if (!room) return Response.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
    const playerId = playerForToken(room, request.headers.get("x-player-token"));
    if (playerId === null) return Response.json({ error: "이 방에 접속할 권한이 없습니다." }, { status: 403 });
    if (room.status !== "playing") {
      return Response.json({ error: "아직 상대가 입장하지 않았습니다." }, { status: 409 });
    }

    const payload = (await request.json()) as { expectedVersion?: number; state?: unknown };
    const state = parseGameState(payload.state);
    if (!state || state.mode !== "online") {
      return Response.json({ error: "게임 상태가 올바르지 않습니다." }, { status: 400 });
    }
    if (JSON.stringify(state).length > 80_000) {
      return Response.json({ error: "게임 상태가 너무 큽니다." }, { status: 413 });
    }
    if (payload.expectedVersion !== room.version) {
      return Response.json({
        error: "다른 플레이어의 상태가 먼저 반영되었습니다.",
        version: room.version,
        state: JSON.parse(room.stateJson),
      }, { status: 409 });
    }

    const db = getDb();
    const nextVersion = room.version + 1;
    const updated = await db.update(gameRooms)
      .set({
        stateJson: JSON.stringify(state),
        version: nextVersion,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(gameRooms.code, code), eq(gameRooms.version, room.version)))
      .returning({ version: gameRooms.version });

    if (updated.length === 0) {
      const latest = await findRoom(code);
      return Response.json({
        error: "다른 플레이어의 상태가 먼저 반영되었습니다.",
        version: latest?.version ?? room.version,
        state: latest ? JSON.parse(latest.stateJson) : JSON.parse(room.stateJson),
      }, { status: 409 });
    }

    return Response.json({ version: nextVersion, playerId });
  } catch (error) {
    return Response.json({ error: roomError(error) }, { status: 500 });
  }
}
