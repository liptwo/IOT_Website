const router = require("express").Router();
const { db } = require("../config/firebase");
const auth = require("../middleware/auth");
const { requireRole, requireOwnZone } = require("../middleware/requireRole");
const { publishThreshold } = require("../config/mqttPublisher");

// Lấy cấu hình ngưỡng của một Zone
// GET /api/thresholds/:zoneId
router.get('/:zoneId', auth, requireOwnZone, async (req, res) => {
  const { zoneId } = req.params;
  try {
    if (db) {
      const snapshot = await db.ref(`thresholds/${zoneId}`).once('value');
      const thresholds = snapshot.val();
      return res.json({ zoneId, thresholds: thresholds || {} });
    } else {
      // Mock data nếu không có Firebase
      return res.json({
        zoneId,
        thresholds: {
          tempMax: 35,
          tempMin: 15,
          moistureMin: 40,
          moistureMax: 80
        }
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy ngưỡng cấu hình', error: error.message });
  }
});

// Chỉ ADMIN được sửa threshold
router.post("/:zoneId", auth, requireRole("ADMIN"), async (req, res) => {
  const { zoneId } = req.params;
  const data = { ...req.body, updatedBy: req.user.id, updatedAt: Date.now() };

  if (db) {
    await db.ref(`thresholds/${zoneId}`).set(data);
  }
  publishThreshold(zoneId, data); // báo ngay xuống ESP32

  res.json({ success: true });
});

module.exports = router;

