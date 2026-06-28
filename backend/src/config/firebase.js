const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './iotgreenhouse-8f6c3-firebase-adminsdk-fbsvc-260c61aeed.json';
const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.FIREBASE_DB_URL;

let db = null;
let auth = null;

try {
  const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);
  if (fs.existsSync(resolvedPath)) {
    const serviceAccount = require(resolvedPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: databaseURL
    });
    db = admin.database(); // Hoặc admin.firestore() tùy vào nhu cầu sử dụng
    auth = admin.auth();
    console.log('Firebase Admin SDK initialized successfully.');
  } else {
    console.warn(`[Firebase Config] File service account không tìm thấy tại: ${resolvedPath}. Vui lòng kiểm tra lại cấu hình.`);
  }
} catch (error) {
  console.error('Lỗi khi khởi tạo Firebase Admin SDK:', error.message);
}

module.exports = {
  admin,
  db,
  auth
};
