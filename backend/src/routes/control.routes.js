const router = require("express").Router();
const { db } = require("../config/firebase");
const auth = require("../middleware/auth");
const { requireOwnZone } = require("../middleware/requireRole");
const { publishControl } = require("../config/mqttPublisher");

// GET /api/control/:zoneId - Lấy trạng thái của cả 3 thiết bị trong 1 Zone
router.get("/:zoneId", auth, requireOwnZone, async (req, res) => {
  const { zoneId } = req.params;
  try {
    if (!db) {
      return res.status(500).json({ error: "Firebase Realtime Database chưa được khởi tạo" });
    }

    const snapshot = await db.ref(`control/${zoneId}`).once("value");
    const controlState = snapshot.val();
    
    // Trả về trạng thái của các thiết bị (nếu rỗng thì trả về object rỗng)
    res.json(controlState || {});
  } catch (error) {
    console.error(`[GET /api/control/${zoneId}] Lỗi bởi user ${req.user?.uid}:`, error.message);
    res.status(500).json({ error: "Lỗi hệ thống khi lấy trạng thái thiết bị" });
  }
});

// POST /api/control/:zoneId/device/:device - Điều khiển bật/tắt hoặc đặt tự động cho thiết bị
router.post("/:zoneId/device/:device", auth, requireOwnZone, async (req, res) => {
  const { zoneId, device } = req.params;
  const { action } = req.body;
  let { duration } = req.body;

  // 1. Validate device type
  const allowedDevices = ["fan", "pump", "lamp"];
  if (!allowedDevices.includes(device)) {
    return res.status(400).json({ error: "Thiết bị không hợp lệ. Chỉ chấp nhận: fan, pump, lamp" });
  }

  // 2. Validate action
  const allowedActions = ["on", "off", "auto"];
  if (!allowedActions.includes(action)) {
    return res.status(400).json({ error: "Hành động không hợp lệ. Chỉ chấp nhận: on, off, auto" });
  }

  // 3. Phân quyền & Giới hạn theo Role
  const isClient = req.user.role === "CLIENT";

  if (isClient) {
    if (action === "auto") {
      return res.status(403).json({ error: "Client không được đổi chế độ Auto" });
    }
    // Ép cứng duration tối đa 30s đối với Client
    duration = duration ? Math.min(Number(duration), 30) : 30;
  } else {
    // Admin không giới hạn thời gian, mặc định 30s nếu bật manual mà không truyền duration
    if (action !== "auto" && !duration) {
      duration = 30;
    }
  }

  try {
    if (!db) {
      return res.status(500).json({ error: "Firebase Realtime Database chưa được khởi tạo" });
    }

    // 4. Tính toán expiresAt
    const expiresAt = action === "auto" ? null : Date.now() + Number(duration) * 1000;

    const controlData = {
      mode: action === "auto" ? "auto" : "manual",
      state: action === "on",
      expiresAt: expiresAt,
      setBy: req.user.uid,
      updatedAt: Date.now()
    };

    // 5. Ghi vào Firebase Realtime Database
    await db.ref(`control/${zoneId}/${device}`).set(controlData);

    // 6. Publish lệnh MQTT xuống ESP32
    publishControl(zoneId, {
      device,
      action,
      duration: action === "auto" ? null : Number(duration)
    });

    res.json({
      success: true,
      message: `Thiết bị ${device} đã được cập nhật sang chế độ ${controlData.mode} (${action.toUpperCase()})`,
      data: controlData
    });
  } catch (error) {
    console.error(`[POST /api/control/${zoneId}/device/${device}] Lỗi bởi user ${req.user?.uid}:`, error.message);
    res.status(500).json({ error: "Lỗi hệ thống khi cập nhật trạng thái thiết bị" });
  }
});

module.exports = router;