const mqttClient = require("../config/mqtt");

const PREFIX = process.env.TOPIC_PREFIX || "agriresearch_huynh";

function publishThreshold(zoneId, thresholdData) {
  const topic = `${PREFIX}/${zoneId}/threshold`;
  mqttClient.publish(topic, JSON.stringify(thresholdData), { qos: 1 }, (err) => {
    if (err) console.error("Publish threshold error:", err);
  });
}

function publishControl(zoneId, command) {
  const topic = `${PREFIX}/${zoneId}/control`;
  mqttClient.publish(topic, JSON.stringify(command), { qos: 1 }, (err) => {
    if (err) console.error("Publish control error:", err);
  });
}

function publishSchedule(zoneId, device, schedulesList) {
  const topic = `${PREFIX}/${zoneId}/schedule`;
  const payload = {
    device,
    schedules: schedulesList
  };
  mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) console.error("Publish schedule error:", err);
  });
}

module.exports = { publishThreshold, publishControl, publishSchedule };