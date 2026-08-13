import { generateKeyPair, exportJWK, SignJWT } from "jose";

export async function createFirebaseAuthFixture() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const kid = crypto.randomUUID();
  const projectId = "rawaj-test-project";
  const issuer = `https://securetoken.google.com/${projectId}`;
  const jwks = JSON.stringify({ keys: [{ ...publicJwk, alg: "RS256", kid, use: "sig" }] });

  return {
    workerArgs: [
      "--var",
      `FIREBASE_PROJECT_ID:${projectId}`,
      "--var",
      `FIREBASE_AUTH_TEST_JWKS:${jwks}`,
    ],
    async session(label, overrides = {}) {
      const userId = overrides.sub ?? crypto.randomUUID();
      const email = overrides.email ?? `${label}-${userId}@example.test`;
      const issuedAt = overrides.iat ?? Math.floor(Date.now() / 1000);
      const expiresAt = overrides.exp ?? issuedAt + 3600;
      const token = await new SignJWT({
        email,
        email_verified: overrides.email_verified ?? true,
        name: overrides.name ?? `${label} user`,
        firebase: {
          identities: { email: [email] },
          sign_in_provider: overrides.sign_in_provider ?? "password",
        },
      })
        .setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
        .setIssuer(overrides.iss ?? issuer)
        .setAudience(overrides.aud ?? projectId)
        .setSubject(userId)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAt)
        .setJti(overrides.jti ?? crypto.randomUUID())
        .sign(overrides.privateKey ?? privateKey);
      return { token, userId, email };
    },
    async invalidSignatureSession(label) {
      const other = await generateKeyPair("RS256");
      return this.session(label, { privateKey: other.privateKey });
    },
  };
}

