import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseAppName = "rawaj-syria";

const configuredFirebase = {
  apiKey: import.meta.env.VITE_SYRIA_FIREBASE_API_KEY?.trim() ?? "",
  authDomain: import.meta.env.VITE_SYRIA_FIREBASE_AUTH_DOMAIN?.trim() ?? "",
  projectId: import.meta.env.VITE_SYRIA_FIREBASE_PROJECT_ID?.trim() ?? "",
  messagingSenderId: import.meta.env.VITE_SYRIA_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "",
  appId: import.meta.env.VITE_SYRIA_FIREBASE_APP_ID?.trim() ?? "",
};

export const firebaseAuthAvailable = Object.values(configuredFirebase).every(Boolean);

const firebaseConfig = firebaseAuthAvailable
  ? configuredFirebase
  : {
      apiKey: "rawaj-syria-auth-pending",
      authDomain: "rawaj-syria-auth-pending.firebaseapp.com",
      projectId: "rawaj-syria-auth-pending",
      messagingSenderId: "0",
      appId: "1:0:web:rawaj-syria-auth-pending",
    };

const app =
  getApps().find((candidate) => candidate.name === firebaseAppName) ??
  initializeApp(firebaseConfig, firebaseAppName);

export const firebaseAuth = getAuth(app);
