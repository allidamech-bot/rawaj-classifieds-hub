import { exportJWK, generateKeyPair, SignJWT } from "jose";

export async function createSupabaseAuthFixture() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const kid = crypto.randomUUID();
  const projectUrl = "https://rawaj-test-project.supabase.co";
  const issuer = `${projectUrl}/auth/v1`;
  const jwks = JSON.stringify({ keys: [{ ...publicJwk, alg: "RS256", kid, use: "sig" }] });

  return {
    workerArgs: ["--var", `SUPABASE_URL:${projectUrl}`, "--var", `SUPABASE_AUTH_TEST_JWKS:${jwks}`],
    async session(label, overrides = {}) {
      const userId = overrides.sub ?? crypto.randomUUID();
      const email = overrides.email ?? `${label}-${userId}@example.test`;
      const issuedAt = overrides.iat ?? Math.floor(Date.now() / 1000);
      const expiresAt = overrides.exp ?? issuedAt + 3600;
      const sessionId = overrides.session_id ?? crypto.randomUUID();
      const token = await new SignJWT({
        email,
        role: overrides.role ?? "authenticated",
        aal: "aal1",
        session_id: sessionId,
        is_anonymous: false,
        user_metadata: {
          display_name: overrides.name ?? `${label} user`,
        },
        app_metadata: { provider: overrides.provider ?? "email" },
      })
        .setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
        .setIssuer(overrides.iss ?? issuer)
        .setAudience(overrides.aud ?? "authenticated")
        .setSubject(userId)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAt)
        .setJti(overrides.jti ?? crypto.randomUUID())
        .sign(overrides.privateKey ?? privateKey);
      return { token, userId, email, sessionId };
    },
    async invalidSignatureSession(label) {
      const other = await generateKeyPair("RS256");
      return this.session(label, { privateKey: other.privateKey });
    },
  };
}
