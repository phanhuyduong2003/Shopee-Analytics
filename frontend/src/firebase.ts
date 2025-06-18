// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
	apiKey: "AIzaSyAF7YlV4rOMTVyEWLRkukOBRDh6_LyVh3c",
	authDomain: "shopee-analytics.firebaseapp.com",
	projectId: "shopee-analytics",
	storageBucket: "shopee-analytics.firebasestorage.app",
	messagingSenderId: "805009069204",
	appId: "1:805009069204:web:0a082c371d29b3504c9081",
	measurementId: "G-G06EKGJXKJ",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default db;
