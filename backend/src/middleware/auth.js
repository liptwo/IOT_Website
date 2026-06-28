const { admin } = require('../config/firebase');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Không tìm thấy header Authorization' });
  }

  const token = authHeader.split(' ')[1] || authHeader;

  if (!token) {
    return res.status(401).json({ message: 'Token bị thiếu' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      username: decodedToken.email ? decodedToken.email.split('@')[0] : 'unknown',
      role: decodedToken.role || 'CLIENT',
      zoneId: decodedToken.zoneId || null
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn', error: error.message });
  }
};

module.exports = authMiddleware;
