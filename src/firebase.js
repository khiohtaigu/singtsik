import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBN4hLA8zB-kmgxf6ZWbAqlFmRNKQzofpo",
  authDomain: "singtsik.firebaseapp.com",
  projectId: "singtsik",
  storageBucket: "singtsik.firebasestorage.app",
  messagingSenderId: "370696529508",
  appId: "1:370696529508:web:3ed9749be2a974fff6a171",
  measurementId: "G-92S2K1414C"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// --- 修正點：強制每次登入都要顯示「選取帳號」視窗 ---
googleProvider.setCustomParameters({
  prompt: 'select_account'
});