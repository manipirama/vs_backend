const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let serviceAccount;

// For production: read service account from an environment variable
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    console.error(' Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON from environment');
  }

}
// For local development: read from the local file
else {
  try {
    serviceAccount = require('./serviceAccountKey.json');
  } catch (e) {
    console.warn(' serviceAccountKey.json not found. Assuming environment variables will be used (GOOGLE_APPLICATION_CREDENTIALS).');
  }
}

const firebaseConfig = serviceAccount ? {
  credential: cert(serviceAccount)
} : {
  credential: applicationDefault()
};

try {
  initializeApp(firebaseConfig);
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
}

const db = getFirestore();

module.exports = { db };
