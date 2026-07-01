import { eq, inArray } from "drizzle-orm";
import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import { getDb } from "../db/client.server";
import { sessions } from "../db/schema";

/**
 * Cloudflare D1-backed session storage for Shopify OAuth.
 * Implements the official `SessionStorage` interface so it drops into
 * `shopifyApp({ sessionStorage })` without further adapter code.
 */
export class D1SessionStorage implements SessionStorage {
  constructor(private readonly d1: D1Database) {}

  async storeSession(session: Session): Promise<boolean> {
    const db = getDb(this.d1);
    const row = {
      id: session.id,
      shop: session.shop,
      state: session.state,
      isOnline: session.isOnline,
      scope: session.scope ?? null,
      expires: session.expires ? new Date(session.expires) : null,
      accessToken: session.accessToken ?? null,
      userId: session.onlineAccessInfo?.associated_user?.id
        ? String(session.onlineAccessInfo.associated_user.id)
        : null,
      firstName: session.onlineAccessInfo?.associated_user?.first_name ?? null,
      lastName: session.onlineAccessInfo?.associated_user?.last_name ?? null,
      email: session.onlineAccessInfo?.associated_user?.email ?? null,
      accountOwner:
        session.onlineAccessInfo?.associated_user?.account_owner ?? false,
      locale: session.onlineAccessInfo?.associated_user?.locale ?? null,
      collaborator:
        session.onlineAccessInfo?.associated_user?.collaborator ?? false,
      emailVerified:
        session.onlineAccessInfo?.associated_user?.email_verified ?? false,
    };

    await db
      .insert(sessions)
      .values(row)
      .onConflictDoUpdate({ target: sessions.id, set: row });
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const db = getDb(this.d1);
    const row = await db.select().from(sessions).where(eq(sessions.id, id)).get();
    return row ? rowToSession(row) : undefined;
  }

  async deleteSession(id: string): Promise<boolean> {
    const db = getDb(this.d1);
    await db.delete(sessions).where(eq(sessions.id, id));
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const db = getDb(this.d1);
    await db.delete(sessions).where(inArray(sessions.id, ids));
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const db = getDb(this.d1);
    const rows = await db.select().from(sessions).where(eq(sessions.shop, shop)).all();
    return rows.map(rowToSession);
  }
}

type Row = typeof sessions.$inferSelect;

function rowToSession(row: Row): Session {
  const session = new Session({
    id: row.id,
    shop: row.shop,
    state: row.state,
    isOnline: Boolean(row.isOnline),
  });
  if (row.scope) session.scope = row.scope;
  if (row.expires) session.expires = row.expires;
  if (row.accessToken) session.accessToken = row.accessToken;
  if (row.userId) {
    session.onlineAccessInfo = {
      expires_in: 0,
      associated_user_scope: row.scope ?? "",
      associated_user: {
        id: Number(row.userId),
        first_name: row.firstName ?? "",
        last_name: row.lastName ?? "",
        email: row.email ?? "",
        account_owner: Boolean(row.accountOwner),
        locale: row.locale ?? "",
        collaborator: Boolean(row.collaborator),
        email_verified: Boolean(row.emailVerified),
      },
    };
  }
  return session;
}
