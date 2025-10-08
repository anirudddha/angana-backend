import admin from 'firebase-admin';

const serviceAccount = {
  projectId: process.env.FCM_PROJECT_ID,
  privateKey: process.env.FCM_PRIVATE_KEY.replace(/\\n/g, '\n'), // Unescape newlines
  clientEmail: process.env.FCM_CLIENT_EMAIL,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

console.log('Firebase Admin SDK initialized.');
export default admin;