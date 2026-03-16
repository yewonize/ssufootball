// src/firebase.js
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "ssufootball.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: "ssufootball.firebasestorage.app",
  messagingSenderId: "448182371519",
  appId: "1:448182371519:web:ba0acffe4f676278e7320a",
};

const app = initializeApp(firebaseConfig);

// 오프라인 캐시를 적용한 최신 방식의 Firestore 초기화
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});
