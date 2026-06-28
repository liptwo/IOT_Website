const router = require("express").Router();
const { db } = require("../config/firebase");
const auth = require("../middleware/auth");
const { requireRole, requireOwnZone } = require("../middleware/requireRole");
const { publishThreshold } = require("../config/mqttPublisher");

// GET /api/threshold/:zoneId
router.get('/:zoneId', auth, requireOwnZone, async (req, res) => {
  const { zoneId } = req.params;
  try {
    if (!db) {
      return res.status(500).json({ error: "Firebase Realtime Database chưa được khởi tạo" });
    }

    const snapshot = await db.ref(`thresholds/${zoneId}`).once('value');
    const thresholds = snapshot.val();
    
    return res.json({ zoneId, thresholds: thresholds || {} });
  } catch (error) {
    console.error(`[GET /api/threshold/${zoneId}] Lỗi bởi user ${req.user?.uid}:`, error.message);
    res.status(500).json({ error: "Lỗi hệ thống khi lấy ngưỡng cấu hình" });
  }
});

// POST /api/threshold/:zoneId (Chỉ Admin được sửa)
router.post("/:zoneId", auth, requireRole("ADMIN"), async (req, res) => {
  const { zoneId } = req.params;
  const { tempMax, soilMin, lightMin } = req.body;

  // 1. Validate values are numbers and inside realistic ranges
  if (tempMax === undefined || soilMin === undefined || lightMin === undefined) {
    return res.status(400).json({ error: "Vui lòng cung cấp đầy đủ tempMax, soilMin, và lightMin" });
  }

  const tMax = Number(tempMax);
  const sMin = Number(soilMin);
  const lMin = Number(lightMin);

  if (isNaN(tMax) || tMax < 0 || tMax > 50) {
    return res.status(400).json({ error: "tempMax phải là số hợp lệ từ 0 đến 50" });
  }

  if (isNaN(sMin) || sMin < 0 || sMin > 100) {
    return res.status(400).json({ error: "soilMin phải là số hợp lệ từ 0 đến 100" });
  }

  if (isNaN(lMin) || lMin < 0 || lMin > 100) {
    return res.status(400).json({ error: "lightMin phải là số hợp lệ từ 0 đến 100" });
  }

  try {
    if (!db) {
      return res.status(500).json({ error: "Firebase Realtime Database chưa được khởi tạo" });
    }

    const data = {
      tempMax: tMax,
      soilMin: sMin,
      lightMin: lMin,
      updatedBy: req.user.uid,
      updatedAt: Date.now()
    };

    // 2. Ghi vào Firebase Realtime Database
    await db.ref(`thresholds/${zoneId}`).set(data);

    // 3. Báo xuống ESP32 qua MQTT
    publishThreshold(zoneId, { tempMax: tMax, soilMin: sMin, lightMin: lMin });

    res.json({ success: true, data });
  } catch (error) {
    console.error(`[POST /api/threshold/${zoneId}] Lỗi bởi admin ${req.user?.uid}:`, error.message);
    res.status(500).json({ error: "Lỗi hệ thống khi cập nhật ngưỡng" });
  }
});

module.exports = router;
