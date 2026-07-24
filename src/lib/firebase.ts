import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCEx7XMl1vsLU3cvoDjrPav5WF54MFkn1U",
  authDomain: "project-af18fcaf-c46e-4ec5-93a.firebaseapp.com",
  projectId: "project-af18fcaf-c46e-4ec5-93a",
  storageBucket: "project-af18fcaf-c46e-4ec5-93a.firebasestorage.app",
  messagingSenderId: "165848071823",
  appId: "1:165848071823:web:4969d4c035ae159ddabafa",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);
