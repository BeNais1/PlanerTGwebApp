import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCLu9KZvO3lluQX8b1eVIdw6dX46kI4l6I",
  authDomain: "planer-app-3a0f2.firebaseapp.com",
  databaseURL: "https://planer-app-3a0f2-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "planer-app-3a0f2",
  storageBucket: "planer-app-3a0f2.firebasestorage.app",
  messagingSenderId: "961873874615",
  appId: "1:961873874615:web:2678e9c5b8c038ba91c732"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
