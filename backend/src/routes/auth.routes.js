const express = require('express');
const router = express.Router();
const { admin } = require('../config/firebase');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');

/**
 * 💡 GIẢI THÍCH LUỒNG ĐĂNG NHẬP (FRONTEND LOGIN FLOW):
 * 
 * Vì chúng ta sử dụng Firebase Authentication làm nguồn xác thực duy nhất,
 * Backend KHÔNG cần viết endpoint /login tự xử lý mật khẩu.
 * Việc đăng nhập lấy ID Token sẽ được thực hiện trực tiếp ở Frontend thông qua Firebase Client Web SDK.
 * 
 * ĐOẠN MÃ MẪU TRÊN FRONTEND (React/HTML):
 * ----------------------------------------------------
 * import { initializeApp } from "firebase/app";
 * import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
 * 
 * const firebaseApp = initializeApp({ ...config... });
 * const auth = getAuth(firebaseApp);
 * 
 * async function loginWithUsername(username, password) {
 *   // 1. Tự động chuyển username thành email giả theo quy ước
 *   const fakeEmail = `${username}@agriresearch.local`;
 *   
 *   try {
 *     // 2. Gọi Firebase Client SDK để xác thực trực tiếp với Firebase Auth
 *     const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
 *     
 *     // 3. Lấy ID Token (JWT do Firebase ký) để gửi lên Backend
 *     // Sử dụng forceRefresh = true để lấy các Custom Claims (role, zoneId) mới nhất vừa gán
 *     const idToken = await userCredential.user.getIdToken(true);
 *     
 *     // 4. Lưu idToken vào localStorage và gửi kèm ở header Authorization: Bearer <idToken>
 *     console.log("Token xác thực gửi lên Backend:", idToken);
 *     return idToken;
 *   } catch (error) {
 *     console.error("Đăng nhập thất bại:", error.message);
 *   }
 * }
 * ----------------------------------------------------
 */

// POST /api/auth/register-client
// Chỉ ADMIN được phép gọi endpoint này để tạo Client mới và gán Zone
router.post('/register-client', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { username, password, zoneId } = req.body;

  // 1. Validate đầu vào
  if (!username || !password || !zoneId) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ username, password và zoneId' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Mật khẩu phải chứa ít nhất 6 ký tự' });
  }

  try {
    // 2. Chuyển đổi username thành email giả dạng username@agriresearch.local
    const fakeEmail = `${username.trim().toLowerCase()}@agriresearch.local`;

    // 3. Tạo tài khoản trong Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: fakeEmail,
      password: password,
      displayName: username,
      emailVerified: true
    });

    // 4. Thiết lập Custom Claims (role = CLIENT, zoneId tương ứng)
    // ⚠️ LƯU Ý QUAN TRỌNG: Sau khi set custom claims, nếu user này đang online hoặc đang login,
    // họ cần phải đăng nhập lại hoặc chạy hàm getIdTokenResult(true) trên client để force refresh token
    // thì claims mới này mới được nạp vào ID Token (tránh tình trạng dùng token cũ bị cache claims).
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: 'CLIENT',
      zoneId: zoneId
    });

    res.status(201).json({
      message: 'Tạo tài khoản Client thành công',
      user: {
        uid: userRecord.uid,
        username: username,
        email: userRecord.email,
        role: 'CLIENT',
        zoneId: zoneId
      }
    });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi tạo user Firebase', error: error.message });
  }
});

// POST /api/auth/seed-admin
// Endpoint seed chạy 1 lần duy nhất để khởi tạo tài khoản Admin đầu tiên của hệ thống
router.post('/seed-admin', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Vui lòng cung cấp username và password của Admin cần seed' });
  }

  try {
    const fakeEmail = `${username.trim().toLowerCase()}@agriresearch.local`;

    // 1. Tạo user admin trong Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: fakeEmail,
      password: password,
      displayName: username,
      emailVerified: true
    });

    // 2. Set custom claim role ADMIN, zoneId = null
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: 'ADMIN',
      zoneId: null
    });

    res.status(201).json({
      message: 'Seed tài khoản Admin thành công',
      user: {
        uid: userRecord.uid,
        username: username,
        email: userRecord.email,
        role: 'ADMIN',
        zoneId: null
      }
    });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi seed Admin (có thể tài khoản đã tồn tại)', error: error.message });
  }
});

module.exports = router;
