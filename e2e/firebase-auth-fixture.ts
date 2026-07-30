type FixtureUser = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  getIdToken(forceRefresh?: boolean): Promise<string>;
};

type FixtureAuth = {
  currentUser: FixtureUser | null;
};

type TokenListener = (user: FixtureUser | null) => void;

const STORAGE_KEY = "rawaj:e2e:firebase-user";
const FIXTURE_UID = "00000000-0000-4000-8000-000000000020";
const FIXTURE_TOKEN = "rawaj-e2e-firebase-token";
const listeners = new Set<TokenListener>();

function createFixtureUser(
  email = "browser-smoke@rawa-j.test",
  displayName = "مستخدم رواج التجريبي",
): FixtureUser {
  return {
    uid: FIXTURE_UID,
    email,
    emailVerified: true,
    displayName,
    photoURL: null,
    async getIdToken(forceRefresh?: boolean) {
      void forceRefresh;
      return FIXTURE_TOKEN;
    },
  };
}

function readPersistedUser(): FixtureUser | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { email?: unknown; displayName?: unknown };
    const email = typeof parsed.email === "string" ? parsed.email : undefined;
    const displayName = typeof parsed.displayName === "string" ? parsed.displayName : undefined;
    return createFixtureUser(email, displayName);
  } catch {
    return null;
  }
}

function persistUser(user: FixtureUser | null): void {
  if (typeof window === "undefined") return;
  if (!user) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ email: user.email, displayName: user.displayName }),
  );
}

function emit(user: FixtureUser | null): void {
  fixtureAuth.currentUser = user;
  persistUser(user);
  queueMicrotask(() => {
    for (const listener of listeners) listener(user);
  });
}

const fixtureAuth: FixtureAuth = {
  currentUser: readPersistedUser(),
};

export function getAuth(): FixtureAuth {
  if (typeof window !== "undefined" && !fixtureAuth.currentUser) {
    fixtureAuth.currentUser = readPersistedUser();
  }
  return fixtureAuth;
}

export function onIdTokenChanged(auth: FixtureAuth, listener: TokenListener): () => void {
  listeners.add(listener);
  queueMicrotask(() => listener(auth.currentUser ?? readPersistedUser()));
  return () => listeners.delete(listener);
}

export async function signInWithEmailAndPassword(
  auth: FixtureAuth,
  email: string,
  password: string,
): Promise<{ user: FixtureUser }> {
  void auth;
  void password;
  const user = createFixtureUser(email.trim().toLowerCase());
  emit(user);
  return { user };
}

export async function createUserWithEmailAndPassword(
  auth: FixtureAuth,
  email: string,
  password: string,
): Promise<{ user: FixtureUser }> {
  void auth;
  void password;
  const user = createFixtureUser(email.trim().toLowerCase(), "");
  emit(user);
  return { user };
}

export async function updateProfile(
  user: FixtureUser,
  profile: { displayName?: string | null; photoURL?: string | null },
): Promise<void> {
  user.displayName = profile.displayName ?? user.displayName;
  user.photoURL = profile.photoURL ?? user.photoURL;
  emit(user);
}

export async function signOut(auth: FixtureAuth): Promise<void> {
  void auth;
  emit(null);
}

export class GoogleAuthProvider {
  setCustomParameters(parameters: Record<string, string>): void {
    void parameters;
  }
}

export async function signInWithPopup(
  auth: FixtureAuth,
  provider: GoogleAuthProvider,
): Promise<{ user: FixtureUser }> {
  void auth;
  void provider;
  const user = createFixtureUser("google-browser-smoke@rawa-j.test", "مستخدم غوغل التجريبي");
  emit(user);
  return { user };
}

export async function sendPasswordResetEmail(...arguments_: unknown[]): Promise<void> {
  void arguments_;
}

export async function verifyPasswordResetCode(...arguments_: unknown[]): Promise<string> {
  void arguments_;
  return "browser-smoke@rawa-j.test";
}

export async function confirmPasswordReset(...arguments_: unknown[]): Promise<void> {
  void arguments_;
}

export const EmailAuthProvider = {
  credential(email: string, password: string) {
    return { email, password };
  },
};

export async function reauthenticateWithCredential(...arguments_: unknown[]): Promise<void> {
  void arguments_;
}

export async function updatePassword(...arguments_: unknown[]): Promise<void> {
  void arguments_;
}

export type User = FixtureUser;
