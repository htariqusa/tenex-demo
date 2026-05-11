import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// In-memory store replaces SQLite for portability (works locally + Vercel serverless)
interface SessionRow {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  picture: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  iv: string;
  expires_at: number;
  created_at: number;
}

interface PendingActionRow {
  id: string;
  session_id: string;
  type: string;
  payload: string;
  description: string;
  created_at: number;
}

const sessions = new Map<string, SessionRow>();
const pendingActionsStore = new Map<string, PendingActionRow>();

export function initDb() {
  // Clean expired sessions
  const now = Math.floor(Date.now() / 1000);
  for (const [id, session] of sessions) {
    if (session.expires_at < now) {
      sessions.delete(id);
      // Cascade delete pending actions
      for (const [actionId, action] of pendingActionsStore) {
        if (action.session_id === id) {
          pendingActionsStore.delete(actionId);
        }
      }
    }
  }
  console.log('Database initialized (in-memory)');
}

// DB-like interface used by session service
export function getDb() {
  return {
    prepare(sql: string) {
      return {
        run(...params: unknown[]) {
          if (sql.includes('INSERT INTO sessions')) {
            const [id, user_id, email, name, picture, access_token_encrypted, refresh_token_encrypted, iv, expires_at] = params as [string, string, string, string | null, string | null, string, string, string, number];
            sessions.set(id, {
              id, user_id, email, name, picture,
              access_token_encrypted, refresh_token_encrypted, iv,
              expires_at,
              created_at: Math.floor(Date.now() / 1000),
            });
          } else if (sql.includes('UPDATE sessions')) {
            if (sql.includes('access_token_encrypted')) {
              const [access_token_encrypted, refresh_token_encrypted, iv, id] = params as [string, string, string, string];
              const session = sessions.get(id);
              if (session) {
                session.access_token_encrypted = access_token_encrypted;
                session.refresh_token_encrypted = refresh_token_encrypted;
                session.iv = iv;
              }
            }
          } else if (sql.includes('DELETE FROM sessions WHERE id')) {
            const id = params[0] as string;
            sessions.delete(id);
            for (const [actionId, action] of pendingActionsStore) {
              if (action.session_id === id) {
                pendingActionsStore.delete(actionId);
              }
            }
          } else if (sql.includes('DELETE FROM sessions WHERE expires_at')) {
            const now = Math.floor(Date.now() / 1000);
            for (const [id, session] of sessions) {
              if (session.expires_at < now) {
                sessions.delete(id);
              }
            }
          }
        },
        get(...params: unknown[]): SessionRow | undefined {
          if (sql.includes('SELECT * FROM sessions')) {
            const id = params[0] as string;
            const session = sessions.get(id);
            if (!session) return undefined;
            const now = Math.floor(Date.now() / 1000);
            if (session.expires_at <= now) {
              sessions.delete(id);
              return undefined;
            }
            return session;
          }
          return undefined;
        },
      };
    },
  };
}

// Encryption helpers
const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters');
  }
  return Buffer.from(secret.slice(0, 32), 'utf-8');
}

export function encrypt(text: string): { encrypted: string; iv: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted + ':' + authTag.toString('hex'),
    iv: iv.toString('hex'),
  };
}

export function decrypt(encrypted: string, ivHex: string): string {
  const parts = encrypted.split(':');
  const encryptedText = parts[0];
  const authTagHex = parts[1];

  if (!encryptedText || !authTagHex) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
