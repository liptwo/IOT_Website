const mqtt = require("mqtt");

const client = mqtt.connect(process.env.MQTT_BROKER_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  protocol: "mqtts",     // bắt buộc cho port 8883 (TLS)
  rejectUnauthorized: true, // Node.js xác thực cert chuẩn (khác ESP32 dùng setInsecure())
});

client.on("connect", () => {
  console.log("✅ MQTT connected to HiveMQ Cloud");
});

client.on("error", (err) => {
  console.error("❌ MQTT connection error:", err.message);
});

client.on("reconnect", () => {
  console.log("🔄 MQTT reconnecting...");
});

module.exports = client;