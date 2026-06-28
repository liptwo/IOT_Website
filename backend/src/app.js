require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Khởi động MQTT subscriber ngay khi server start
require("./config/mqttSubscriber");

// Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/threshold", require("./routes/threshold.routes"));
app.use("/api/control", require("./routes/control.routes"));
app.use("/api/notes", require("./routes/note.routes"));



// Xử lý Route không tồn tại
app.use((req, res, next) => {
  res.status(404).json({ message: 'Không tìm thấy API này' });
});

// Xử lý Lỗi Hệ Thống
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Lỗi hệ thống nội bộ', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = app;
