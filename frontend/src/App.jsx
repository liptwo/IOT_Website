import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { ref, onValue, set } from "firebase/database";
import { signInWithEmailAndPassword } from "firebase/auth";
import { 
  Droplet, 
  Thermometer, 
  Sun, 
  Wind, 
  LogOut, 
  User as UserIcon, 
  Activity, 
  Compass, 
  Database,
  Terminal,
  Zap,
  Flame,
  TrendingUp,
  UserPlus
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// --- 1. BIỂU ĐỒ REALTIME (REALTIME CHART COMPONENT) ---
function RealtimeChart({ history = [], metric = "temperature", color = "#00f2fe" }) {
  if (history.length < 2) {
    return (
      <div style={{ height: "120px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
        Đang thu thập dữ liệu để vẽ biểu đồ...
      </div>
    );
  }

  const values = history.map(h => h[metric] || 0);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valRange = maxVal - minVal === 0 ? 10 : maxVal - minVal;
  
  const padTop = 15;
  const padBottom = 15;
  const width = 400;
  const height = 120;
  const usableHeight = height - padTop - padBottom;

  const points = history.map((item, idx) => {
    const x = (idx / (history.length - 1)) * width;
    const val = item[metric] || 0;
    const y = padTop + usableHeight - ((val - minVal) / valRange) * usableHeight;
    return { x, y, value: val };
  });

  const linePath = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="chart-panel">
      <div className="chart-header">
        <div className="chart-title">
          <TrendingUp size={14} style={{ color }} />
          <span>Biểu đồ {metric === "temperature" ? "Nhiệt độ" : metric === "soil" ? "Độ ẩm đất" : "Ánh sáng"}</span>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
          Min: {minVal}{metric === "temperature" ? "°C" : metric === "soil" ? "%" : "lx"} | Max: {maxVal}{metric === "temperature" ? "°C" : metric === "soil" ? "%" : "lx"}
        </span>
      </div>
      <div className="chart-svg-container">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`area-grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          
          <line x1="0" y1={padTop} x2={width} y2={padTop} className="chart-grid-line" />
          <line x1="0" y1={padTop + usableHeight / 2} x2={width} y2={padTop + usableHeight / 2} className="chart-grid-line" />
          <line x1="0" y1={padTop + usableHeight} x2={width} y2={padTop + usableHeight} className="chart-grid-line" />

          <path d={areaPath} fill={`url(#area-grad-${metric})`} className="chart-area" />
          <path d={linePath} stroke={color} className="chart-line" />

          {points.map((p, idx) => (
            <circle 
              key={idx} 
              cx={p.x} 
              cy={p.y} 
              r="3" 
              fill={color} 
              stroke="#0d1117" 
              strokeWidth="1"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

// --- 2. TRANG ĐĂNG NHẬP RIÊNG BIỆT (LOGIN COMPONENT) ---
function Login({ 
  username, 
  setUsername, 
  password, 
  setPassword, 
  errorMsg, 
  setErrorMsg, 
  successMsg, 
  setSuccessMsg, 
  authLoading, 
  handleLogin,
  handleSeedAdmin
}) {
  return (
    <div className="auth-container">
      <div className="auth-card glass-panel">
        <div className="auth-header">
          <h1>GreenHouse IoT</h1>
          <p>Hệ thống giám sát & điều khiển (Firebase Auth)</p>
        </div>

        {errorMsg && <div className="alert-error">{errorMsg}</div>}
        {successMsg && <div className="alert-success">{successMsg}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Tên tài khoản (Username)</label>
            <input 
              type="text" 
              className="form-input" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Ví dụ: admin, client_z1" 
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mật khẩu</label>
            <input 
              type="password" 
              className="form-input" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu" 
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={authLoading}>
            {authLoading ? "Đang xác thực..." : "Đăng nhập"}
          </button>
        </form>

        <div className="presets-container">
          <div className="presets-title">⚡ TIỆN ÍCH HỆ THỐNG</div>
          <div className="presets-grid">
            <button 
              type="button" 
              className="btn-preset" 
              onClick={handleSeedAdmin}
              style={{ justifyContent: "center", background: "rgba(0, 242, 254, 0.05)", border: "1px dashed var(--color-primary)" }}
            >
              🚀 Khởi tạo Admin Mặc định (admin / admin123)
            </button>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: 8, textAlign: "center" }}>
            Click nút trên nếu bạn chưa từng seed tài khoản Admin đầu tiên vào Firebase.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- 3. MÀN HÌNH CHÍNH (APP DASHBOARD) ---
function App() {
  // Cấu hình: Đặt false để chạy qua Firebase Authentication thật
  const BYPASS_AUTH = false;

  // Authentication states
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(
    BYPASS_AUTH 
      ? { username: "AdminSimulator", role: "ADMIN", zones: ["zone1", "zone2", "zone3"] }
      : null
  );
  
  // Login states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Client registration states (Admin only)
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newZoneId, setNewZoneId] = useState("zone1");
  const [regLoading, setRegLoading] = useState(false);

  // Realtime sensor database & controls
  const [realtimeData, setRealtimeData] = useState({});
  const [historyData, setHistoryData] = useState({});
  const [deviceLoading, setDeviceLoading] = useState({});
  const [activeMetric, setActiveMetric] = useState({}); // { zone1: "temperature" }
  const [logs, setLogs] = useState([]);

  // Restore user session if not bypassed
  useEffect(() => {
    if (BYPASS_AUTH) return;

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        
        // Cấu hình Zone truy cập dựa vào claims nhận được
        const userObj = {
          uid: payload.user_id,
          username: payload.email ? payload.email.split("@")[0] : "user",
          role: payload.role || "CLIENT",
          zones: payload.role === "ADMIN" ? ["zone1", "zone2", "zone3"] : (payload.zoneId ? [payload.zoneId] : [])
        };

        setUser(userObj);
        addLog(`🔓 Đăng nhập thành công: ${userObj.username} (Quyền: ${userObj.role})`);
      } catch (err) {
        handleLogout();
      }
    }
  }, [token]);

  // Subscribe to Firebase RTDB updates
  useEffect(() => {
    if (!user || !user.zones || user.zones.length === 0) return;

    addLog(`🔌 Đang kết nối Firebase Realtime Database...`);
    const unsubscribes = [];

    user.zones.forEach((zoneId) => {
      const zoneRef = ref(db, `realtime_data/${zoneId}`);
      
      const unsub = onValue(zoneRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setRealtimeData(prev => ({ ...prev, [zoneId]: data }));
          
          setHistoryData(prev => {
            const currentHistory = prev[zoneId] || [];
            const newReading = {
              temperature: data.temperature || 0,
              soil: data.soil || 0,
              light: data.light || 0,
              timestamp: Date.now()
            };
            const updatedHistory = [...currentHistory, newReading].slice(-15);
            return { ...prev, [zoneId]: updatedHistory };
          });

          setActiveMetric(prev => ({
            ...prev,
            [zoneId]: prev[zoneId] || "temperature"
          }));
        }
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user]);

  const addLog = (message) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [{ time, message }, ...prev].slice(0, 40));
  };

  // Login via Firebase Client SDK (converts username to fakeEmail)
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setAuthLoading(true);

    const fakeEmail = `${username.trim().toLowerCase()}@agriresearch.local`;
    addLog(`🔐 Đang đăng nhập tài khoản Firebase Auth: ${fakeEmail}...`);

    try {
      // 1. Authenticate with email/password directly on Firebase Auth Client SDK
      const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
      
      // 2. Fetch the ID Token (forces claim refresh in case roles just changed)
      const idToken = await userCredential.user.getIdToken(true);
      
      localStorage.setItem("token", idToken);
      setToken(idToken);
      
      setUsername("");
      setPassword("");
    } catch (err) {
      addLog(`❌ Đăng nhập thất bại: ${err.message}`);
      setErrorMsg("Sai tên đăng nhập hoặc mật khẩu.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Seed default admin in backend
  const handleSeedAdmin = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setAuthLoading(true);
    addLog("🚀 Đang yêu cầu Backend khởi tạo Admin mặc định...");
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/seed-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "admin123" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể seed Admin");
      setSuccessMsg("Đã khởi tạo Admin thành công! Tên đăng nhập: admin | Mật khẩu: admin123");
      addLog("✅ Khởi tạo Admin thành công. Bạn có thể đăng nhập ngay.");
    } catch (err) {
      setErrorMsg(`Lỗi khi seed Admin: ${err.message}`);
      addLog(`❌ Seed Admin thất bại: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  // Admin registers new client users
  const handleRegisterClient = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setRegLoading(true);
    addLog(`➕ Đang đăng ký Client mới [${newUsername}] cho ${newZoneId.toUpperCase()}...`);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register-client`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          zoneId: newZoneId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Đăng ký thất bại");
      
      setSuccessMsg(`Tạo Client [${newUsername}] thành công gán vào ${newZoneId.toUpperCase()}!`);
      addLog(`✅ Đăng ký Client thành công.`);
      setNewUsername("");
      setNewPassword("");
    } catch (err) {
      setErrorMsg(err.message);
      addLog(`❌ Đăng ký Client thất bại: ${err.message}`);
    } finally {
      setRegLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken("");
    setUser(null);
    setRealtimeData({});
    setHistoryData({});
    addLog("🔒 Đã đăng xuất khỏi hệ thống.");
  };

  // Device override control calling Backend REST API
  const handleDeviceControl = async (zoneId, device, currentAction) => {
    const key = `${zoneId}-${device}`;
    setDeviceLoading(prev => ({ ...prev, [key]: true }));

    const nextAction = currentAction === "on" ? "off" : "on";
    addLog(`🔘 Gửi lệnh điều khiển [${device}] -> ${nextAction.toUpperCase()} ở [${zoneId}]...`);

    try {
      const res = await fetch(`${API_BASE_URL}/api/control/${zoneId}/device`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ device, action: nextAction, duration: 30 })
      });
      const data = await res.json();
      
      if (res.ok) {
        addLog(`✅ Backend phản hồi: ${data.message}`);
        setDeviceLoading(prev => ({ ...prev, [key]: false }));
        return;
      }
      addLog(`⚠️ API Backend từ chối: ${data.error || data.message}.`);
    } catch (err) {
      addLog(`⚠️ Không kết nối được Backend.`);
    }

    // Fallback directly to Firebase if backend is unreachable
    try {
      const zoneRef = ref(db, `realtime_data/${zoneId}/${device}`);
      await set(zoneRef, nextAction);
      await set(ref(db, `realtime_data/${zoneId}/updatedAt`), Date.now());
      addLog(`✅ Ghi trực tiếp Firebase (Fallback) thành công: ${device} -> ${nextAction}`);
    } catch (err) {
      addLog(`❌ Lỗi ghi Firebase: ${err.message}.`);
    } finally {
      setDeviceLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // --- RENDERING ROUTE CONTROL ---
  if (!BYPASS_AUTH && (!token || !user)) {
    return (
      <Login 
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        errorMsg={errorMsg}
        setErrorMsg={setErrorMsg}
        successMsg={successMsg}
        setSuccessMsg={setSuccessMsg}
        authLoading={authLoading}
        handleLogin={handleLogin}
        handleSeedAdmin={handleSeedAdmin}
      />
    );
  }

  return (
    <div className="dashboard-container">
      <nav className="navbar">
        <div className="navbar-brand">
          <Activity size={24} className="sensor-temp" />
          <span>GreenHouse IoT Panel</span>
        </div>
        <div className="navbar-user">
          <div className="user-badge">
            <UserIcon size={14} />
            <span>Xin chào, <strong>{user?.username || "Guest"}</strong></span>
            <span className={`btn-preset-role ${user?.role === "ADMIN" ? "admin" : "client"}`} style={{ fontSize: "0.7rem", marginLeft: 4 }}>
              {user?.role || "GUEST"}
            </span>
          </div>
          <button className="btn-secondary" onClick={handleLogout}>
            <LogOut size={14} style={{ marginRight: 6 }} />
            Đăng xuất
          </button>
        </div>
      </nav>

      <main className="main-content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: "700" }}>Bảng Giám Sát & Điều Khiển Nhà Kính</h1>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
              Xác thực qua Firebase Auth • Đọc trực tiếp Firebase RTDB • Điều khiển qua Node.js
            </p>
          </div>
          <div className="user-badge" style={{ borderColor: "var(--color-success)" }}>
            <Database size={14} className="sensor-soil" />
            <span style={{ color: "var(--color-success)" }}>Firebase Connected</span>
          </div>
        </div>

        {/* ADMIN ONLY: Client Registration Panel */}
        {user?.role === "ADMIN" && (
          <div className="glass-panel" style={{ padding: 24, marginBottom: 30, background: "rgba(0, 242, 254, 0.02)" }}>
            <div className="panel-title" style={{ color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 8 }}>
              <UserPlus size={18} />
              <span>Quản trị viên: Cấp tài khoản Client & Phân quyền Zone</span>
            </div>
            
            <form onSubmit={handleRegisterClient} style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12, alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: "150px" }}>
                <label className="form-label" style={{ fontSize: "0.8rem", marginBottom: 4 }}>Username Client</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="Ví dụ: client_z1" 
                  required
                />
              </div>

              <div style={{ flex: 1, minWidth: "150px" }}>
                <label className="form-label" style={{ fontSize: "0.8rem", marginBottom: 4 }}>Mật khẩu</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự" 
                  required
                />
              </div>

              <div style={{ width: "120px" }}>
                <label className="form-label" style={{ fontSize: "0.8rem", marginBottom: 4 }}>Gán Zone</label>
                <select 
                  className="form-input"
                  value={newZoneId}
                  onChange={e => setNewZoneId(e.target.value)}
                >
                  <option value="zone1">Zone 1</option>
                  <option value="zone2">Zone 2</option>
                  <option value="zone3">Zone 3</option>
                </select>
              </div>

              <button type="submit" className="btn-primary" style={{ padding: "12px 24px", width: "auto" }} disabled={regLoading}>
                {regLoading ? "Đang xử lý..." : "Cấp tài khoản"}
              </button>
            </form>
          </div>
        )}

        {/* Zones Grid */}
        <div className="zones-grid">
          {user?.zones && user.zones.map((zoneId) => {
            const data = realtimeData[zoneId] || {};
            const history = historyData[zoneId] || [];
            
            const isHeaterOn = data.heater === "on" || data.heater === "ON" || data.heater === true;
            const isFanOn = data.fan === "on" || data.fan === "ON" || data.fan === true;
            const isPumpOn = data.pump === "on" || data.pump === "ON" || data.pump === true;

            const selectedMetric = activeMetric[zoneId] || "temperature";
            const metricColor = selectedMetric === "temperature" ? "#ff5722" : selectedMetric === "soil" ? "#00e676" : "#ffeb3b";

            return (
              <div key={zoneId} className="zone-card glass-panel">
                <div className="zone-header">
                  <div className="zone-title">
                    <Compass size={18} className="sensor-humidity" />
                    <h2 style={{ fontSize: "1.2rem" }}>Khu vực: {zoneId.toUpperCase()}</h2>
                  </div>
                  <span className={`zone-status-dot ${!data.updatedAt ? "offline" : ""}`}></span>
                </div>

                <div className="sensor-grid">
                  <div className="sensor-card">
                    <div className="sensor-icon"><Thermometer className="sensor-temp" size={18} /></div>
                    <span className="sensor-label">Nhiệt độ</span>
                    <span className="sensor-value sensor-temp">{data.temperature !== undefined ? `${data.temperature}°C` : "--"}</span>
                  </div>
                  
                  <div className="sensor-card">
                    <div className="sensor-icon"><Droplet className="sensor-soil" size={18} /></div>
                    <span className="sensor-label">Độ ẩm đất</span>
                    <span className="sensor-value sensor-soil">{data.soil !== undefined ? `${data.soil}%` : "--"}</span>
                  </div>

                  <div className="sensor-card">
                    <div className="sensor-icon"><Sun className="sensor-light" size={18} /></div>
                    <span className="sensor-label">Ánh sáng</span>
                    <span className="sensor-value sensor-light">{data.light !== undefined ? `${data.light} lx` : "--"}</span>
                  </div>
                </div>

                <div className="chart-metric-selector">
                  <button 
                    className={`btn-metric-tab ${selectedMetric === "temperature" ? "active" : ""}`}
                    onClick={() => setActiveMetric(prev => ({ ...prev, [zoneId]: "temperature" }))}
                  >
                    Nhiệt độ
                  </button>
                  <button 
                    className={`btn-metric-tab ${selectedMetric === "soil" ? "active" : ""}`}
                    onClick={() => setActiveMetric(prev => ({ ...prev, [zoneId]: "soil" }))}
                  >
                    Độ ẩm đất
                  </button>
                  <button 
                    className={`btn-metric-tab ${selectedMetric === "light" ? "active" : ""}`}
                    onClick={() => setActiveMetric(prev => ({ ...prev, [zoneId]: "light" }))}
                  >
                    Ánh sáng
                  </button>
                </div>

                <RealtimeChart 
                  history={history} 
                  metric={selectedMetric} 
                  color={metricColor} 
                />

                <div className="control-section" style={{ marginTop: 20 }}>
                  <div className="control-header">
                    <Zap size={14} />
                    <span>Điều khiển thiết bị thực tế {user?.role === "CLIENT" && "(Tối đa 30s)"}</span>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button 
                      onClick={() => handleDeviceControl(zoneId, "heater", isHeaterOn ? "on" : "off")}
                      disabled={deviceLoading[`${zoneId}-heater`]}
                      className={`btn-control ${isHeaterOn ? "active-heater" : ""}`}
                      style={{ fontSize: "0.85rem", padding: "10px" }}
                    >
                      <Flame size={14} style={{ marginRight: 6 }} />
                      Đèn: {isHeaterOn ? "ON" : "OFF"}
                    </button>

                    <button 
                      onClick={() => handleDeviceControl(zoneId, "fan", isFanOn ? "on" : "off")}
                      disabled={deviceLoading[`${zoneId}-fan`]}
                      className={`btn-control ${isFanOn ? "active-fan" : ""}`}
                      style={{ fontSize: "0.85rem", padding: "10px" }}
                    >
                      <Wind size={14} style={{ marginRight: 6 }} />
                      Quạt: {isFanOn ? "ON" : "OFF"}
                    </button>
                  </div>

                  <button 
                    onClick={() => handleDeviceControl(zoneId, "pump", isPumpOn ? "on" : "off")}
                    disabled={deviceLoading[`${zoneId}-pump`]}
                    className={`btn-control ${isPumpOn ? "active-pump" : ""}`}
                    style={{ fontSize: "0.9rem", width: "100%", marginTop: 4 }}
                  >
                    <Droplet size={16} style={{ marginRight: 6 }} />
                    Máy Bơm: {isPumpOn ? "ĐANG BẬT" : "TẮT (Click để Bật)"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="dashboard-meta">
          <div className="logs-panel glass-panel" style={{ gridColumn: "1 / -1" }}>
            <div className="panel-title">
              <Terminal size={16} className="sensor-temp" />
              <span>Theo dõi luồng MQTT & Firebase thời gian thực</span>
            </div>
            <div className="logs-list">
              {logs.map((log, idx) => (
                <div key={idx} className="log-item">
                  <span>{log.message}</span>
                  <span className="log-time">{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
