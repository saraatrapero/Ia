// Compatible con el runtime Edge (middleware): solo usa jose.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "trapero_session";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET no está configurado o es demasiado corto (mínimo 32 caracteres).");
  return new TextEncoder().encode(s);
}

export async function signSessionToken(sessionId: string, expiresAt: Date) {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return typeof payload.sid === "string" ? payload.sid : null;
  } catch {
    return null;
  }
}
