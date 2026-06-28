const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const filePath = path.resolve(process.cwd(), 'users.json');

// Khởi tạo file json rỗng nếu chưa tồn tại
if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify([], null, 2));
}

const getUsers = () => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
};

const saveUsers = (users) => {
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
};

const UserStore = {
  // Tìm user theo username
  findByUsername: async (username) => {
    const users = getUsers();
    return users.find(u => u.username === username);
  },

  // Tạo user mới
  createUser: async (username, password, role = 'CLIENT', zones = []) => {
    const users = getUsers();
    const existing = users.find(u => u.username === username);
    if (existing) {
      throw new Error('Username đã tồn tại');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      id: Date.now().toString(),
      username,
      password: hashedPassword,
      role,
      zones
    };

    users.push(newUser);
    saveUsers(users);

    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }
};

module.exports = UserStore;
