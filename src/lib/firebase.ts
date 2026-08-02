import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseAppName = "rawaj-saudi";

function readFirebaseEnv(key: string) {
  return ((import.meta.env[key] as string | undefined) ?? "").trim();
}

const configuredFirebase = {
  apiKey: readFirebaseEnv("VITE_SAUDI_FIREBASE_API_KEY"),
  authDomain: readFirebaseEnv("VITE_SAUDI_FIREBASE_AUTH_DOMAIN"),
  projectId: readFirebaseEnv("VITE_SAUDI_FIREBASE_PROJECT_ID"),
  messagingSenderId: readFirebaseEnv("VITE_SAUDI_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readFirebaseEnv("VITE_SAUDI_FIREBASE_APP_ID"),
};

export const firebaseAuthAvailable = Object.values(configuredFirebase).every(Boolean);

const firebaseConfig = firebaseAuthAvailable
  ? configuredFirebase
  : {
      apiKey: "rawaj-saudi-auth-pending",
      authDomain: "rawaj-saudi-auth-pending.firebaseapp.com",
      projectId: "rawaj-saudi-auth-pending",
      messagingSenderId: "0",
      appId: "1:0:web:rawaj-saudi-auth-pending",
    };

const app =
  getApps().find((candidate) => candidate.name === firebaseAppName) ??
  initializeApp(firebaseConfig, firebaseAppName);

export const firebaseAuth = getAuth(app);
