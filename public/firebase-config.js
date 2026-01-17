// firebase-config.js - Firebase Configuration
// Your Firebase project credentials

const firebaseConfig = {
  apiKey: "-",
  authDomain: "-..com",
  projectId: "chotalink-",
  storageBucket: "chotalink-.firebasestorage.app",
  messagingSenderId: "",
  appId: "1::web:"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

console.log('✅ Firebase initialized successfully with Authentication enabled!');
