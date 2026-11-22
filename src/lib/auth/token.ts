// Compatible con el runtime Edge (middleware): solo usa jose.
import { SignJWT, jwtVerify } from "jose";
import { authSecretMaterial } from "../env";

export const SESSION_COOKIE = "trapero_session";

let cached: Uint8Array | null = null;

/** Clave HMAC de 32 bytes derivada del material secreto (SHA-256). */
async function secret() {
  if (cached) return cached;
  const material = authSecretMaterial();
  if (!material) throw new Error("No hay secreto de sesión: configura AUTH_SECRET o conecta Supabase.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  cached = new Uint8Array(digest);
  return cached;
}

export async function signSessionToken(sessionId: string, expiresAt: Date) {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(await secret());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, await secret(), { algorithms: ["HS256"] });
    return typeof payload.sid === "string" ? payload.sid : null;
  } catch {
    return null;
  }
}
