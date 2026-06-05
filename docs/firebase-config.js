// Firebase Configuration for Ssamanth Clothes Sorteo App
const firebaseConfig = {
  projectId: "ssamanth-clothes-jose-2026",
  appId: "1:443018417420:web:19b2049812c7a5bd79e529",
  storageBucket: "ssamanth-clothes-jose-2026.firebasestorage.app",
  apiKey: "AIzaSyAFyfihrb950QFQ5MW6Nnc5vJcOm2uKbKQ",
  authDomain: "ssamanth-clothes-jose-2026.firebaseapp.com",
  messagingSenderId: "443018417420",
  projectNumber: "443018417420",
  version: "2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();
