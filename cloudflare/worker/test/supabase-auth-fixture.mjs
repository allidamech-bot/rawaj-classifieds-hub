import { generateKeyPair, exportJWK, SignJWT } from "jose";

export async function createSupabaseAuthFixture() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const kid = crypto.randomUUID();
  const issuer = "http://localhost/auth/v1";
  const audience = "authenticated";
  const jwks = JSON.stringify({ keys: [{ ...publicJwk, alg: "RS256", kid, use: "sig" }] });

  return {
    workerArgs: [
      "--var",
      `SUPABASE_AUTH_ISSUER:${issuer}`,
      "--var",
      `SUPABASE_AUTH_AUDIENCE:${audience}`,
      "--var",
      `SUPABASE_AUTH_TEST_JWKS:${jwks}`,
    ],
    async session(label, overrides = {}) {
      const userId = overrides.sub ?? crypto.randomUUID();
      const sessionId = overrides.session_id ?? crypto.randomUUID();
      const email = overrides.email ?? `${label}-${userId}@example.test`;
      const issuedAt = overrides.iat ?? Math.floor(Date.now() / 1000);
      const expiresAt = overrides.exp ?? issuedAt + 3600;
      const token = await new SignJWT({
        role: overrides.role ?? "authenticated",
        email,
        session_id: sessionId,
        user_metadata: { display_name: `${label} user` },
        is_anonymous: overrides.is_anonymous ?? false,
      })
        .setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
        .setIssuer(overrides.iss ?? issuer)
        .setAudience(overrides.aud ?? audience)
        .setSubject(userId)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAt)
        .sign(overrides.privateKey ?? privateKey);
      return { token, userId, sessionId, email };
    },
    async invalidSignatureSession(label) {
      const other = await generateKeyPair("RS256");
      return this.session(label, { privateKey: other.privateKey });
    },
  };
}
