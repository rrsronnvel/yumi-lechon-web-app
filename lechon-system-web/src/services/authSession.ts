export const TOKEN_STORAGE_KEY = "lechon_auth_token";
export const USER_STORAGE_KEY = "lechon_auth_user";

export interface UserProfile {
  id?: number;
  username: string;
  fullName: string;
  role: string;
}

interface AuthSession {
  token: string;
  user: UserProfile;
  expiresAt: number;
}

function decodeJwtPart(part: string) {
  const bytes = Uint8Array.from(atob(part.replace(/-/g, "+").replace(/_/g, "/")), (byte) => byte.charCodeAt(0));
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export function getJwtExpiry(token: string | null): number | null {
  const parts = token?.split(".");
  if (!parts || parts.length !== 3 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part) && part.length % 4 !== 1)) {
    return null;
  }

  try {
    const header = decodeJwtPart(parts[0]);
    const payload = decodeJwtPart(parts[1]);
    if (typeof header?.alg !== "string" || !header.alg || header.alg.toLowerCase() === "none" ||
        typeof payload?.exp !== "number" || !Number.isFinite(payload.exp * 1000)) {
      return null;
    }
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export function clearAuthSession(storage: Storage = localStorage) {
  storage.removeItem(TOKEN_STORAGE_KEY);
  storage.removeItem(USER_STORAGE_KEY);
}

export function readAuthSession(storage: Storage = localStorage): AuthSession | null {
  const token = storage.getItem(TOKEN_STORAGE_KEY);
  const expiresAt = getJwtExpiry(token);
  if (token && expiresAt !== null && Date.now() < expiresAt) {
    try {
      const user: UserProfile | null = JSON.parse(storage.getItem(USER_STORAGE_KEY) ?? "null");
      if (user && typeof user.username === "string" && user.username &&
          typeof user.fullName === "string" && typeof user.role === "string" && user.role) {
        return { token, user, expiresAt };
      }
    } catch {
      // Clear corrupt profile data with its token.
    }
  }
  clearAuthSession(storage);
  return null;
}
