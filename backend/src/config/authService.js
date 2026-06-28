const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Demo: users lưu cứng hoặc trong Firebase /users node — tuỳ bạn chọn
async function login(username, password, users) {
  const user = users.find(u => u.username === username);
  if (!user) throw new Error("User not found");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("Wrong password");

  const token = jwt.sign(
    { id: user.id, role: user.role, zoneId: user.zoneId },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
  return { token, role: user.role, zoneId: user.zoneId };
}

module.exports = { login };