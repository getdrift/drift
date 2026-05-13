/**
 * Server-only session helpers. Used by /app pages and server actions to
 * derive the current workspace_id from the session cookie.
 *
 * Edge-runtime-safe — uses auth.ts Web Crypto helpers, no node modules.
 */
import { cookies } from "next/headers";
import {
  authDisabled,
  OWNER_WORKSPACE_ID,
  SESSION_COOKIE,
  verifySession,
  type Session,
} from "./auth";

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

/**
 * Returns the workspace_id for the current request, or throws.
 * If auth is disabled (no DRIFT_PASSWORD set), assumes owner workspace.
 */
export async function requireWorkspaceId(): Promise<number> {
  if (authDisabled()) return OWNER_WORKSPACE_ID;
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session.workspace_id;
}
