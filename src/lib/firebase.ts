import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseAppName = "rawaj-saudi";

const firebaseConfig = {
  apiKey: "AIzaSyCEx7XMl1vsLU3cvoDjrPav5WF54MFkn1U",
  authDomain: "project-af18fcaf-c46e-4ec5-93a.firebaseapp.com",
  projectId: "project-af18fcaf-c46e-4ec5-93a",
  messagingSenderId: "165848071823",
  appId: "1:165848071823:web:4969d4c035ae159ddabafa",
};

export const firebaseAuthAvailable = true;

const app =
  getApps().find((candidate) => candidate.name === firebaseAppName) ??
  initializeApp(firebaseConfig, firebaseAppName);

export const firebaseAuth = getAuth(app);
