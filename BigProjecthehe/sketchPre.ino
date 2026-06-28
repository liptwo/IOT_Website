#include <ArduinoJson.h>
#include <DHT.h>
#include <LiquidCrystal_I2C.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>


//================= Zone identity =================
// Mỗi ESP32 / mỗi khu trồng đặt 1 zoneId riêng để phân biệt trên cùng hệ thống
#define ZONE_ID "zone1"

// Prefix riêng để tránh đụng topic với người khác trên broker public HiveMQ
#define TOPIC_PREFIX "agriresearch_huynh"

//================= WiFi =================
const char *WIFI_SSID = "Wokwi-GUEST"; // mạng WiFi giả lập của Wokwi
const char *WIFI_PASS = "";

//================= MQTT (HiveMQ Cloud - TLS) =================
const char *MQTT_BROKER = "171ab0660619457faa5355b5c44f1390.s1.eu.hivemq.cloud";
const int MQTT_PORT = 8883; // port TLS, khác với 1883 không mã hoá
const char *MQTT_USER =
    "esp32_zone1"; // username tạo trong HiveMQ Cloud Console
const char *MQTT_PASS =
    "123456hH";      // password tương ứng - nên đổi mạnh hơn khi dùng thật
String mqttClientId; // random, tránh trùng client khác

WiFiClientSecure
    espClient; // đổi từ WiFiClient -> WiFiClientSecure để hỗ trợ TLS
PubSubClient mqttClient(espClient);

String TOPIC_SENSOR;
String TOPIC_THRESHOLD;
String TOPIC_CONTROL;

//================= LCD =================
LiquidCrystal_I2C lcd(0x27, 20, 4);

//================= DHT =================
#define DHTPIN 15
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

//================= Analog =================
#define SOIL_PIN 34
#define LDR_PIN 35

//================= Relay =================
#define LAMP_RELAY 18 // relay1 -> led1 DEN/LIGHT
#define FAN_RELAY 5   // relay2 -> led2 QUAT/FAN
#define PUMP_RELAY 4  // relay3 -> led3 BOM/PUMP

//================= Threshold (Admin chỉnh qua Backend) =================
float tempMax = 32; // > tempMax thì bật quạt
int soilMin = 50;   // < soilMin thì bật bơm
int lightMin = 40;  // < lightMin thì bật đèn

//================= Manual override state =================
struct DeviceOverride {
  bool active = false; // true = đang bị ghi đè thủ công, false = đang Auto
  bool state = false;  // trạng thái muốn ép (on/off)
  unsigned long expiresAt =
      0; // millis() hết hạn override, 0 = không giới hạn (Admin ép vô thời hạn)
};

DeviceOverride fanOverride, pumpOverride, lampOverride;

//================= Timing =================
unsigned long lastPublish = 0;
const unsigned long PUBLISH_INTERVAL =
    2500; // khớp với delay cũ, publish mỗi 2.5s

// ---------------------------------------------------------------
void setupWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected, IP: " + WiFi.localIP().toString());

  // Bỏ qua việc xác thực chứng chỉ root CA của broker - chấp nhận được cho
  // demo/đồ án, nhưng KHÔNG nên dùng insecure khi deploy thật vì dễ bị tấn công
  // man-in-the-middle.
  espClient.setInsecure();
}

// ---------------------------------------------------------------
DeviceOverride *getOverrideByDevice(const String &device) {
  if (device == "fan")
    return &fanOverride;
  if (device == "pump")
    return &pumpOverride;
  if (device == "lamp")
    return &lampOverride;
  return nullptr;
}

// ---------------------------------------------------------------
void onMqttMessage(char *topic, byte *payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++)
    msg += (char)payload[i];

  String t = String(topic);

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, msg);
  if (err) {
    Serial.println("JSON parse error: " + String(err.c_str()));
    return;
  }

  if (t == TOPIC_THRESHOLD) {
    // payload mẫu: { "tempMax": 30, "soilMin": 45, "lightMin": 35 }
    if (doc.containsKey("tempMax"))
      tempMax = doc["tempMax"].as<float>();
    if (doc.containsKey("soilMin"))
      soilMin = doc["soilMin"].as<int>();
    if (doc.containsKey("lightMin"))
      lightMin = doc["lightMin"].as<int>();

    Serial.println("Threshold updated: tempMax=" + String(tempMax) +
                   " soilMin=" + String(soilMin) +
                   " lightMin=" + String(lightMin));
  } else if (t == TOPIC_CONTROL) {
    // payload mẫu: { "device": "pump", "action": "on"/"off"/"auto", "duration":
    // 30 }
    String device = doc["device"].as<String>();
    String action = doc["action"].as<String>();
    long duration = doc["duration"] | 0;

    DeviceOverride *target = getOverrideByDevice(device);
    if (!target) {
      Serial.println("Unknown device in control message: " + device);
      return;
    }

    if (action == "auto") {
      target->active = false;
      Serial.println(device + " -> back to AUTO mode");
    } else {
      target->active = true;
      target->state = (action == "on");
      target->expiresAt =
          duration > 0 ? millis() + (unsigned long)duration * 1000UL : 0;
      Serial.println(device + " -> MANUAL " + action +
                     " (duration=" + String(duration) + "s)");
    }
  }
}

// ---------------------------------------------------------------
void reconnectMqtt() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting MQTT...");
    if (mqttClient.connect(mqttClientId.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println("connected as " + mqttClientId);
      mqttClient.subscribe(TOPIC_THRESHOLD.c_str());
      mqttClient.subscribe(TOPIC_CONTROL.c_str());
      Serial.println("Subscribed: " + TOPIC_THRESHOLD);
      Serial.println("Subscribed: " + TOPIC_CONTROL);
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retry in 2s");
      delay(2000);
    }
  }
}

// ---------------------------------------------------------------
void checkExpire(DeviceOverride &d) {
  if (d.active && d.expiresAt != 0 && millis() >= d.expiresAt) {
    d.active = false; // hết hạn override -> tự trả về Auto
  }
}

// ---------------------------------------------------------------
void setup() {

  Serial.begin(115200);

  // Build topic names và client id duy nhất theo zone
  TOPIC_SENSOR = String(TOPIC_PREFIX) + "/" + ZONE_ID + "/sensor";
  TOPIC_THRESHOLD = String(TOPIC_PREFIX) + "/" + ZONE_ID + "/threshold";
  TOPIC_CONTROL = String(TOPIC_PREFIX) + "/" + ZONE_ID + "/control";
  mqttClientId = String(TOPIC_PREFIX) + "-" + ZONE_ID + "-" +
                 String((uint32_t)ESP.getEfuseMac(), HEX);

  pinMode(FAN_RELAY, OUTPUT);
  pinMode(PUMP_RELAY, OUTPUT);
  pinMode(LAMP_RELAY, OUTPUT);

  digitalWrite(FAN_RELAY, LOW);
  digitalWrite(PUMP_RELAY, LOW);
  digitalWrite(LAMP_RELAY, LOW);

  dht.begin();

  Wire.begin(21, 22);

  lcd.init();
  lcd.backlight();

  lcd.clear();
  lcd.setCursor(1, 0);
  lcd.print("SMART GREENHOUSE");

  lcd.setCursor(3, 1);
  lcd.print("ESP32 DEVKIT");

  lcd.setCursor(0, 3);
  lcd.print("Connecting WiFi...");

  setupWiFi();

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  reconnectMqtt();

  lcd.clear();
}

void loop() {

  if (!mqttClient.connected()) {
    reconnectMqtt();
  }
  mqttClient.loop();

  //-------------------- Read Sensor ---------------------
  float temp = dht.readTemperature();

  int soilRaw = analogRead(SOIL_PIN);
  int lightRaw = analogRead(LDR_PIN);

  int soil = map(soilRaw, 0, 4095, 0, 100);
  int light = map(lightRaw, 0, 4095, 100, 0);

  soil = constrain(soil, 0, 100);
  light = constrain(light, 0, 100);

  bool dhtError = isnan(temp);

  //-------------------- Auto Control (dùng threshold động) --------------------

  checkExpire(fanOverride);
  checkExpire(pumpOverride);
  checkExpire(lampOverride);

  bool fanAuto = false;
  if (!dhtError)
    fanAuto = temp > tempMax;

  bool pumpAuto = soil < soilMin;

  bool lampAuto;
  if (dhtError)
    lampAuto = light < lightMin;
  else
    lampAuto = (temp < 20 || light < lightMin);

  // Ưu tiên Manual override nếu đang active, ngược lại theo Auto
  bool fanState = fanOverride.active ? fanOverride.state : fanAuto;
  bool pumpState = pumpOverride.active ? pumpOverride.state : pumpAuto;
  bool lampState = lampOverride.active ? lampOverride.state : lampAuto;

  digitalWrite(FAN_RELAY, fanState);
  digitalWrite(PUMP_RELAY, pumpState);
  digitalWrite(LAMP_RELAY, lampState);

  //-------------------- LCD -----------------------------

  lcd.setCursor(0, 0);
  lcd.print("Temp:");

  if (dhtError)
    lcd.print(" ERR ");
  else {
    lcd.print(temp, 1);
    lcd.print((char)223);
    lcd.print("C ");
  }

  lcd.setCursor(14, 0);
  if (fanState)
    lcd.print(fanOverride.active ? "FANm" : "FAN ");
  else
    lcd.print(fanOverride.active ? "OFFm" : "OFF ");

  //----------------

  lcd.setCursor(0, 1);
  lcd.print("Soil:");
  lcd.print(soil);
  lcd.print("%   ");

  lcd.setCursor(14, 1);
  if (pumpState)
    lcd.print(pumpOverride.active ? "PMPm" : "PUMP");
  else
    lcd.print(pumpOverride.active ? "OFFm" : "OFF ");

  //----------------

  lcd.setCursor(0, 2);
  lcd.print("Light:");
  lcd.print(light);
  lcd.print("%  ");

  lcd.setCursor(14, 2);
  if (lampState)
    lcd.print(lampOverride.active ? "LMPm" : "LAMP");
  else
    lcd.print(lampOverride.active ? "OFFm" : "OFF ");

  //----------------

  lcd.setCursor(0, 3);
  lcd.print(ZONE_ID);
  lcd.print(" MQTT:");
  lcd.print(mqttClient.connected() ? "OK  " : "DOWN");

  //---------------- Serial debug ----------------

  Serial.println("-----------------------------");

  if (dhtError)
    Serial.println("Temperature : ERROR");
  else {
    Serial.print("Temperature : ");
    Serial.println(temp);
  }

  Serial.print("Soil : ");
  Serial.print(soil);
  Serial.println("%");
  Serial.print("Light : ");
  Serial.print(light);
  Serial.println("%");
  Serial.print("Fan   : ");
  Serial.println(fanState);
  Serial.print("Pump  : ");
  Serial.println(pumpState);
  Serial.print("Lamp  : ");
  Serial.println(lampState);

  //---------------- Publish MQTT mỗi 2.5s ----------------

  unsigned long now = millis();
  if (now - lastPublish >= PUBLISH_INTERVAL) {
    lastPublish = now;

    StaticJsonDocument<256> doc;
    if (dhtError)
      doc["temperature"] = nullptr;
    else
      doc["temperature"] = temp;
    doc["soil"] = soil;
    doc["light"] = light;
    doc["fan"] = fanState;
    doc["pump"] = pumpState;
    doc["lamp"] = lampState;
    doc["fanMode"] = fanOverride.active ? "manual" : "auto";
    doc["pumpMode"] = pumpOverride.active ? "manual" : "auto";
    doc["lampMode"] = lampOverride.active ? "manual" : "auto";

    char buf[256];
    size_t n = serializeJson(doc, buf);
    bool ok = mqttClient.publish(TOPIC_SENSOR.c_str(), buf, n);
    Serial.println(ok ? ("Published to " + TOPIC_SENSOR + " : " + String(buf))
                      : "Publish FAILED, mqtt state=" +
                            String(mqttClient.state()));
  }

  delay(150); // delay ngắn để không chặn mqttClient.loop() quá lâu (khác với
              // delay 2500 cũ)
}
