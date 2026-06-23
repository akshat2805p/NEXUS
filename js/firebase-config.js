// ── FIREBASE & OAUTH CONFIGURATION ───────────────────────────
// Replace the placeholders below with your actual credentials from Firebase and GitLab Developer portal.

const firebaseConfig = {
  apiKey: "AIzaSyDMwalBAASxLYCy2SikyjMX90Ek0_-e2Nc",
  authDomain: "neuronflow-8de5e.firebaseapp.com",
  projectId: "neuronflow-8de5e",
  storageBucket: "neuronflow-8de5e.firebasestorage.app",
  messagingSenderId: "418358018196",
  appId: "1:418358018196:web:5475aeb89c5b44c9a43481",
  measurementId: "G-54N10WT983"
};

// Add your Google reCAPTCHA Enterprise or v3 site key here to enable Firebase App Check protection!
const recaptchaSiteKey = "6LfnT_osAAAAAIPQOLjGEA3sOvsT0rzKMl8mHzX7";
// Helper to determine if Firebase credentials are fully set up
function isFirebaseConfigured() {
  return firebaseConfig && 
         firebaseConfig.apiKey && 
         !firebaseConfig.apiKey.startsWith("YOUR_");
}
