// ============================================================
// PANDA CONSTRUCTION — FIREBASE CONFIG
// ============================================================
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBBHKjdaXOC62x2sPu7Oh-R8uvFA-GUi3g",
  authDomain: "panda-construction.firebaseapp.com",
  projectId: "panda-construction",
  storageBucket: "panda-construction.firebasestorage.app",
  messagingSenderId: "94309012867",
  appId: "1:94309012867:web:6816e98507bbdadd63d2b6"
};
// Old Google Apps Script Web App URL — used ONLY by the one-time "Migrate from Google Sheets"
// button to pull existing data into Firestore. Safe to leave in place after migration.
window.OLD_GAS_URL = "https://script.google.com/macros/s/AKfycbyXTGpTjufcgepWzf3whb7v8QhWtGCWys3m7NoZyoB4d0EuRcO12pMxGgMQp99PlAcw/exec";
window.CONFIG = window.CONFIG || { COMPANY_NAME: "PANDA CONSTRUCTION", CURRENCY_SYMBOL: "₹", DEMO_PASSWORD: "panda@123" };
var CONFIG = window.CONFIG;
firebase.initializeApp(window.FIREBASE_CONFIG);
// App Check — proves requests come from this real deployed site (blocks random access using just the API key).
// Enable "Enforce" for Firestore in Firebase Console > App Check once this is confirmed working.
// App Check — DISABLED (still causing hangs with current Enterprise key; needs a properly verified key before re-enabling).
// if (!window.__pandaAppCheckActivated) {
//   window.__pandaAppCheckActivated = true;
//   try {
//     var appCheck = firebase.appCheck();
//     appCheck.activate(new firebase.appCheck.ReCaptchaEnterpriseProvider('6LfzGLgtAAAAAGw8YGPYuQ2HdpTaUGfgK-jk6tfo'), true);
//   } catch (e) { console.warn('App Check not available:', e); }
// }
window.fsdb = firebase.firestore();
