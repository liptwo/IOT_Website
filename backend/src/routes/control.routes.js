const router = require("express").Router();
const auth = require("../middleware/auth");
const { requireOwnZone } = require("../middleware/requireRole");
const { publishControl } = require("../config/mqttPublisher");

router.post("/:zoneId/emergency-pump", auth, requireOwnZone, (req, res) => {
  const { zoneId } = req.params;
  publishControl(zoneId, { device: "pump", action: "on", duration: 30 });
  res.json({ success: true, message: "Pump activated for 30s" });
});

router.post("/:zoneId/device", auth, requireOwnZone, (req, res) => {
  const { zoneId } = req.params;
  const { device, action } = req.body;
  let { duration } = req.body;
  
  if (!device || !action) {
    return res.status(400).json({ error: "Missing device or action" });
  }
  
  // CLIENT role: enforce maximum duration of 30 seconds for overriding device ON
  if (req.user.role === "CLIENT" && action === "on") {
    duration = duration ? Math.min(Number(duration), 30) : 30;
  }
  
  const command = { device, action };
  if (duration !== undefined) {
    command.duration = Number(duration);
  }
  
  publishControl(zoneId, command);
  res.json({ 
    success: true, 
    message: `Device ${device} control command '${action}' published${duration ? ` (limited to ${duration}s)` : ""}` 
  });
});

module.exports = router;