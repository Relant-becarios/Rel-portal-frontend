// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// REEMPLAZA ESTO CON EL OBJETO REAL QUE TE DIO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCLUbHLHTuRaWijy93PDJwWXD_Z1y3NJzk",
  authDomain: "portal-4862a.firebaseapp.com",
  projectId: "portal-4862a",
  storageBucket: "portal-4862a.appspot.com",
  messagingSenderId: "1051710234567",
  appId: "1:1051710234567:web:1234567890abcdef"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);