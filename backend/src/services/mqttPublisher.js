const mqttClient = require('../config/mqtt');

const mqttPublisher = {
  /**
   * Gửi lệnh điều khiển thiết bị (ví dụ: bơm, đèn...) xuống ESP32
   * @param {string} zoneId - ID của zone cần điều khiển
   * @param {string} device - Tên thiết bị (ví dụ: 'pump', 'fan')
   * @param {string} action - Trạng thái ('ON', 'OFF', hoặc tham số cấu hình)
   * @param {number} duration - Thời gian chạy nếu có (ví dụ: 30 cho tưới nước 30s)
   */
  publishCommand: (zoneId, device, action, duration = null) => {
    const topic = `greenhouse/${zoneId}/commands`;
    
    const payload = {
      device,
      action,
      timestamp: new Date().toISOString()
    };

    if (duration !== null) {
      payload.duration = duration; // đơn vị: giây
    }

    const message = JSON.stringify(payload);

    return new Promise((resolve, reject) => {
      mqttClient.publish(topic, message, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[MQTT Publisher] Gửi lệnh thất bại tới ${topic}:`, err);
          return reject(err);
        }
        console.log(`[MQTT Publisher] Đã gửi lệnh tới [${topic}]:`, message);
        resolve({ topic, payload });
      });
    });
  }
};

module.exports = mqttPublisher;
