import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// I'm using my personal firebase project for this app and I've enabled the email and google sign-in providers.
const firebaseConfig = {
  apiKey: "AIzaSyBdHG0-Q1NF8Wgthh4qda_nQfJnyrASocQ",
  authDomain: "carbontrack-96fe6.firebaseapp.com",
  projectId: "carbontrack-96fe6",
  storageBucket: "carbontrack-96fe6.firebasestorage.app",
  messagingSenderId: "767260395342",
  appId: "1:767260395342:web:8e12819696bc7cc595801f",
  measurementId: "G-QQ81XK1F4N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const firestore = getFirestore(app);

export default app;