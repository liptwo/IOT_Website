const router = require("express").Router();
const { db } = require("../config/firebase");
const auth = require("../middleware/auth");
const { requireRole, requireOwnZone } = require("../middleware/requireRole");
const { publishSchedule } = require("../config/mqttPublisher");

// Helper function to validate HH:mm format
function validateTimeFormat(timeStr) {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeStr);
}

// Helper to get all schedules for a device and publish them to MQTT
async function updateAndPublishMQTT(zoneId, device) {
  try {
    const snapshot = await db.ref(`schedules/${zoneId}/${device}`).once("value");
    const val = snapshot.val() || {};
    const schedulesList = Object.keys(val).map(key => ({
      id: key,
      ...val[key]
    }));
    publishSchedule(zoneId, device, schedulesList);
  } catch (error) {
    console.error(`[MQTT Sync Error] Failed to update and publish MQTT for ${zoneId}/${device}:`, error.message);
  }
}

// 1. GET /api/schedule/:zoneId - Lấy toàn bộ schedule của 1 zone (cả 3 device)
router.get("/:zoneId", auth, requireOwnZone, async (req, res) => {
  const { zoneId } = req.params;
  try {
    if (!db) {
      return res.status(500).json({ error: "Firebase Realtime Database chưa được khởi tạo" });
    }

    const snapshot = await db.ref(`schedules/${zoneId}`).once("value");
    const schedules = snapshot.val() || {};
    
    // Ensure all 3 devices are represented, even if empty
    const responseData = {
      fan: schedules.fan || {},
      pump: schedules.pump || {},
      lamp: schedules.lamp || {}
    };

    return res.json(responseData);
  } catch (error) {
    console.error(`[GET /api/schedule/${zoneId}] Lỗi bởi user ${req.user?.uid}:`, error.message);
    res.status(500).json({ error: "Lỗi hệ thống khi lấy lịch hẹn giờ" });
  }
});

// 2. POST /api/schedule/:zoneId/device/:device - Tạo schedule mới (Chỉ ADMIN)
router.post("/:zoneId/device/:device", auth, requireRole("ADMIN"), async (req, res) => {
  const { zoneId, device } = req.params;
  const { startTime, endTime } = req.body;

  // Validate device
  const allowedDevices = ["fan", "pump", "lamp"];
  if (!allowedDevices.includes(device)) {
    return res.status(400).json({ error: "Thiết bị không hợp lệ. Chỉ chấp nhận: fan, pump, lamp" });
  }

  // Validate time format
  if (!startTime || !endTime || !validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
    return res.status(400).json({ error: "Giờ bắt đầu/kết thúc không đúng định dạng HH:mm" });
  }

  try {
    if (!db) {
      return res.status(500).json({ error: "Firebase Realtime Database chưa được khởi tạo" });
    }

    const scheduleData = {
      startTime,
      endTime,
      enabled: true,
      createdBy: req.user.uid,
      createdAt: Date.now()
    };

    // Tạo key tự sinh
    const newRef = db.ref(`schedules/${zoneId}/${device}`).push();
    await newRef.set(scheduleData);

    // Gửi cập nhật qua MQTT
    await updateAndPublishMQTT(zoneId, device);

    return res.status(201).json({
      success: true,
      scheduleId: newRef.key,
      data: scheduleData
    });
  } catch (error) {
    console.error(`[POST /api/schedule/${zoneId}/device/${device}] Lỗi bởi admin ${req.user?.uid}:`, error.message);
    res.status(500).json({ error: "Lỗi hệ thống khi tạo lịch hẹn giờ" });
  }
});

// 3. PUT /api/schedule/:zoneId/device/:device/:scheduleId - Sửa 1 schedule (Chỉ ADMIN)
router.put("/:zoneId/device/:device/:scheduleId", auth, requireRole("ADMIN"), async (req, res) => {
  const { zoneId, device, scheduleId } = req.params;
  const { startTime, endTime, enabled } = req.body;

  // Validate device
  const allowedDevices = ["fan", "pump", "lamp"];
  if (!allowedDevices.includes(device)) {
    return res.status(400).json({ error: "Thiết bị không hợp lệ. Chỉ chấp nhận: fan, pump, lamp" });
  }

  // Build updates object
  const updates = {};
  if (startTime !== undefined) {
    if (!validateTimeFormat(startTime)) {
      return res.status(400).json({ error: "Giờ bắt đầu không đúng định dạng HH:mm" });
    }
    updates.startTime = startTime;
  }
  if (endTime !== undefined) {
    if (!validateTimeFormat(endTime)) {
      return res.status(400).json({ error: "Giờ kết thúc không đúng định dạng HH:mm" });
    }
    updates.endTime = endTime;
  }
  if (enabled !== undefined) {
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "Trạng thái enabled phải là kiểu boolean" });
    }
    updates.enabled = enabled;
  }

  try {
    if (!db) {
      return res.status(500).json({ error: "Firebase Realtime Database chưa được khởi tạo" });
    }

    const scheduleRef = db.ref(`schedules/${zoneId}/${device}/${scheduleId}`);
    const snapshot = await scheduleRef.once("value");
    if (!snapshot.exists()) {
      return res.status(404).json({ error: "Không tìm thấy lịch hẹn giờ này" });
    }

    await scheduleRef.update(updates);

    // Gửi cập nhật qua MQTT
    await updateAndPublishMQTT(zoneId, device);

    return res.json({
      success: true,
      message: "Cập nhật lịch hẹn giờ thành công"
    });
  } catch (error) {
    console.error(`[PUT /api/schedule/${zoneId}/device/${device}/${scheduleId}] Lỗi bởi admin ${req.user?.uid}:`, error.message);
    res.status(500).json({ error: "Lỗi hệ thống khi cập nhật lịch hẹn giờ" });
  }
});

// 4. DELETE /api/schedule/:zoneId/device/:device/:scheduleId - Xóa 1 schedule (Chỉ ADMIN)
router.delete("/:zoneId/device/:device/:scheduleId", auth, requireRole("ADMIN"), async (req, res) => {
  const { zoneId, device, scheduleId } = req.params;

  // Validate device
  const allowedDevices = ["fan", "pump", "lamp"];
  if (!allowedDevices.includes(device)) {
    return res.status(400).json({ error: "Thiết bị không hợp lệ. Chỉ chấp nhận: fan, pump, lamp" });
  }

  try {
    if (!db) {
      return res.status(500).json({ error: "Firebase Realtime Database chưa được khởi tạo" });
    }

    const scheduleRef = db.ref(`schedules/${zoneId}/${device}/${scheduleId}`);
    const snapshot = await scheduleRef.once("value");
    if (!snapshot.exists()) {
      return res.status(404).json({ error: "Không tìm thấy lịch hẹn giờ này" });
    }

    await scheduleRef.remove();

    // Gửi cập nhật qua MQTT
    await updateAndPublishMQTT(zoneId, device);

    return res.json({
      success: true,
      message: "Xóa lịch hẹn giờ thành công"
    });
  } catch (error) {
    console.error(`[DELETE /api/schedule/${zoneId}/device/${device}/${scheduleId}] Lỗi bởi admin ${req.user?.uid}:`, error.message);
    res.status(500).json({ error: "Lỗi hệ thống khi xóa lịch hẹn giờ" });
  }
});

module.exports = router;
