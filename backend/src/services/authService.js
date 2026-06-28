const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserStore = require('../models/userStore');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
const JWT_EXPIRES_IN = '24h';

const authService = {
  // Đăng ký tài khoản mới
  register: async (username, password, role = 'CLIENT', zones = []) => {
    return await UserStore.createUser(username, password, role, zones);
  },

  // Đăng nhập tài khoản
  login: async (username, password) => {
    const user = await UserStore.findByUsername(username);
    if (!user) {
      throw new Error('Sai tài khoản hoặc mật khẩu');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Sai tài khoản hoặc mật khẩu');
    }

    // Tạo JWT token
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      zones: user.zones
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        zones: user.zones
      }
    };
  }
};

module.exports = authService;
