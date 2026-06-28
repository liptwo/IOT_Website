// const mqttClient = require("../config/mqtt");
// const db = require("../config/firebase");

// const PREFIX = process.env.TOPIC_PREFIX || "agriresearch_huynh";
// const historyThrottle = new Map();
// const HISTORY_INTERVAL_MS = Number(process.env.HISTORY_INTERVAL_MS || 60000);

// mqttClient.on("connect", () => {
//   const topic = `${PREFIX}/+/sensor`;
//   mqttClient.subscribe(topic, (err) => {
//     if (err) console.error("Subscribe error:", err);
//     else console.log(`📡 Subscribed: ${topic}`);
//   });
// });

// mqttClient.on("message", async (topic, message) => {
//   try {
//     // topic dạng: agriresearch_huynh/zone1/sensor
//     const parts = topic.split("/");
//     const zoneId = parts[1];

//     const payload = JSON.parse(message.toString());

//     if (payload.temperature !== null && isNaN(payload.temperature)) {
//       console.warn(`Invalid temperature from ${zoneId}, skip`);
//       return;
//     }

//     const dataWithTime = { ...payload, updatedAt: Date.now() };

//     // 1. Ghi đè realtime
//     await db.ref(`realtime_data/${zoneId}`).set(dataWithTime);

//     // 2. Ghi historical theo throttle
//     const now = Date.now();
//     const last = historyThrottle.get(zoneId) || 0;
//     if (now - last >= HISTORY_INTERVAL_MS) {
//       await db.ref(`historical_logs/${zoneId}`).push({ ...payload, timestamp: now });
//       historyThrottle.set(zoneId, now);
//     }

//     console.log(`[${zoneId}] sensor data saved:`, payload);
//   } catch (err) {
//     console.error("MQTT message handling error:", err);
//   }
// });

// module.exports = mqttClient;

const mqttClient = require("../config/mqtt");
const { db } = require("../config/firebase");

const PREFIX = process.env.TOPIC_PREFIX || "agriresearch_huynh";
const historyThrottle = new Map();
const HISTORY_INTERVAL_MS = Number(process.env.HISTORY_INTERVAL_MS || 60000);

mqttClient.on("connect", () => {
  const topic = `${PREFIX}/+/sensor`;
  mqttClient.subscribe(topic, (err) => {
    if (err) console.error("❌ Subscribe error:", err);
    else console.log(`📡 Subscribed: ${topic}`);
  });
});

mqttClient.on("message", async (topic, message) => {
  console.log(`📥 MQTT message received on [${topic}]:`, message.toString());

  try {
    const parts = topic.split("/");
    const zoneId = parts[1];

    const payload = JSON.parse(message.toString());

    if (payload.temperature !== null && isNaN(payload.temperature)) {
      console.warn(`⚠️ Invalid temperature from ${zoneId}, skip`);
      return;
    }

    const dataWithTime = { ...payload, updatedAt: Date.now() };

    // 1. Ghi đè realtime - bọc riêng để biết lỗi ở đúng chỗ nào
    try {
      await db.ref(`realtime_data/${zoneId}`).set(dataWithTime);
      console.log(`✅ Saved realtime_data/${zoneId}`);
    } catch (firebaseErr) {
      console.error(`❌ Firebase write error (realtime_data/${zoneId}):`, firebaseErr.message);
      console.error(firebaseErr); // in full stack để thấy rõ nguyên nhân (auth, URL sai, permission...)
      return;
    }

    // 2. Ghi historical theo throttle
    const now = Date.now();
    const last = historyThrottle.get(zoneId) || 0;
    if (now - last >= HISTORY_INTERVAL_MS) {
      try {
        await db.ref(`historical_logs/${zoneId}`).push({ ...payload, timestamp: now });
        historyThrottle.set(zoneId, now);
        console.log(`✅ Saved historical_logs/${zoneId}`);
      } catch (firebaseErr) {
        console.error(`❌ Firebase write error (historical_logs/${zoneId}):`, firebaseErr.message);
      }
    }
  } catch (err) {
    console.error("❌ MQTT message handling error:", err.message);
    console.error(err);
  }
});

module.exports = mqttClient;