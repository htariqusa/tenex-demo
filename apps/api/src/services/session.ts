import { randomUUID } from 'crypto';
import { getDb, encrypt, decrypt } from '../db/index.js';

interface SessionData {
  userId: string;
  email: string;
  name?: string;
  picture?: string;
  accessToken: string;
  refreshToken: string;
}

interface StoredSession {
  id: string;
  userId: string;
  email: string;
  name?: string;
  picture?: string;
  accessToken: string;
  refreshToken: string;
}

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export function createSession(data: SessionData): string {
  const db = getDb();
  const sessionId = randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;

  // Encrypt tokens - each gets its own IV stored with the ciphertext
  const { encrypted: accessTokenEncrypted, iv: accessIv } = encrypt(data.accessToken);
  const { encrypted: refreshTokenEncrypted, iv: refreshIv } = encrypt(data.refreshToken);

  // Store IVs concatenated: accessIv:refreshIv
  const combinedIv = `${accessIv}:${refreshIv}`;

  db.prepare(`
    INSERT INTO sessions (id, user_id, email, name, picture, access_token_encrypted, refresh_token_encrypted, iv, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    data.userId,
    data.email,
    data.name || null,
    data.picture || null,
    accessTokenEncrypted,
    refreshTokenEncrypted,
    combinedIv,
    expiresAt
  );

  return sessionId;
}

export function getSession(sessionId: string): StoredSession | null {
  const db = getDb();

  const row = db.prepare(`
    SELECT * FROM sessions WHERE id = ? AND expires_at > unixepoch()
  `).get(sessionId) as {
    id: string;
    user_id: string;
    email: string;
    name: string | null;
    picture: string | null;
    access_token_encrypted: string;
    refresh_token_encrypted: string;
    iv: string;
  } | undefined;

  if (!row) return null;

  try {
    // Parse combined IVs: accessIv:refreshIv
    const [accessIv, refreshIv] = row.iv.split(':');
    if (!accessIv || !refreshIv) {
      throw new Error('Invalid IV format');
    }

    const accessToken = decrypt(row.access_token_encrypted, accessIv);
    const refreshToken = decrypt(row.refresh_token_encrypted, refreshIv);

    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      name: row.name || undefined,
      picture: row.picture || undefined,
      accessToken,
      refreshToken,
    };
  } catch (err) {
    // Decryption failed, session is invalid
    console.error('[Session] Decryption failed:', err);
    deleteSession(sessionId);
    return null;
  }
}

export function updateSessionTokens(
  sessionId: string,
  accessToken: string,
  refreshToken?: string
): void {
  const db = getDb();
  const session = getSession(sessionId);

  if (!session) return;

  const { encrypted: accessEncrypted, iv: accessIv } = encrypt(accessToken);
  const { encrypted: refreshEncrypted, iv: refreshIv } = encrypt(refreshToken || session.refreshToken);
  const combinedIv = `${accessIv}:${refreshIv}`;

  db.prepare(`
    UPDATE sessions
    SET access_token_encrypted = ?, refresh_token_encrypted = ?, iv = ?
    WHERE id = ?
  `).run(accessEncrypted, refreshEncrypted, combinedIv, sessionId);
}

export function deleteSession(sessionId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function cleanExpiredSessions(): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE expires_at < unixepoch()').run();
}
