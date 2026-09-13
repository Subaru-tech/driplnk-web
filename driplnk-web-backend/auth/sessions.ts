import "server-only";

import { auth, clerkClient } from "@clerk/nextjs/server";
import type { SessionRecord } from "@/lib/types";

/**
 * Maps backend session activity to a human device label.
 * Best-effort by design — an unknown browser still renders something honest.
 */
function deviceFromActivity(
  browserName?: string,
  deviceType?: string,
  isMobile?: boolean,
): string {
  const browser = browserName ?? "Browser";
  const device = deviceType
    ? deviceType.charAt(0).toUpperCase() + deviceType.slice(1)
    : isMobile
      ? "Mobile"
      : "Desktop";
  return `${browser} · ${device}`;
}

/**
 * Lists the signed-in Clerk user's active sessions, newest first, flagging the
 * one this request came through as current. Returns an empty array for
 * Supabase-authenticated or signed-out users — Supabase's SDK has no
 * client-callable "list my sessions" API, so that side keeps its honest empty
 * state.
 */
export async function getClerkSessions(): Promise<SessionRecord[]> {
  try {
    const { userId, sessionId: activeSessionId } = await auth();
    if (!userId) return [];

    const clerk = await clerkClient();
    const { data: sessions } = await clerk.sessions.getSessionList({
      userId,
      status: "active",
    });

    return sessions
      .map((session) => ({
        id: session.id,
        device: deviceFromActivity(
          session.latestActivity?.browserName,
          session.latestActivity?.deviceType,
          session.latestActivity?.isMobile,
        ),
        last_active_at: new Date(session.lastActiveAt).toISOString(),
        is_current: session.id === activeSessionId,
      }))
      .sort(
        (a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime(),
      );
  } catch (err) {
    console.warn("getClerkSessions failed:", err);
    return [];
  }
}
