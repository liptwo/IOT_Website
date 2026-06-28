const mqttClient = require('../config/mqtt');
const { db } = require('../config/firebase');

// Chủ đề (topic) nhận dữ liệu từ ESP32
const SENSOR_TOPIC = 'greenhouse/+/sensors'; // ví dụ: greenhouse/zone1/sensors

const startSubscriber = () => {
  mqttClient.on('connect', () => {
    mqttClient.subscribe(SENSOR_TOPIC, (err) => {
      if (err) {
        console.error(`[MQTT Subscriber] Không thể subscribe vào topic: ${SENSOR_TOPIC}`, err);
      } else {
        console.log(`[MQTT Subscriber] Đang lắng nghe trên topic: ${SENSOR_TOPIC}`);
      }
    });
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      console.log(`[MQTT Subscriber] Nhận dữ liệu từ [${topic}]:`, payload);

      // Trích xuất zoneId từ topic (greenhouse/zone1/sensors -> zone1)
      const topicParts = topic.split('/');
      const zoneId = topicParts[1];

      const sensorData = {
        zoneId: zoneId,
        temperature: payload.temperature,
        humidity: payload.humidity,
        soilMoisture: payload.soilMoisture,
        timestamp: new Date().toISOString()
      };

      // Ghi dữ liệu vào Firebase Realtime Database nếu được khởi tạo
      if (db) {
        const ref = db.ref(`zones/${zoneId}/sensorLogs`).push();
        await ref.set(sensorData);
        // Cập nhật trạng thái sensor mới nhất
        await db.ref(`zones/${zoneId}/currentStatus`).set(sensorData);
        console.log(`[Firebase] Ghi dữ liệu thành công cho zone: ${zoneId}`);
      } else {
        console.log('[Firebase - Mock] Firebase chưa kết nối. Dữ liệu ESP32:', sensorData);
      }
    } catch (error) {
      console.error('[MQTT Subscriber] Lỗi xử lý message:', error.message);
    }
  });
};

module.exports = { startSubscriber };
