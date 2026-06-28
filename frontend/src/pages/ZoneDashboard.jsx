import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useZoneRealtime } from "../hooks/useZoneRealtime";
import { useZoneControl } from "../hooks/useZoneControl";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";
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
  ArrowLeft,
  Sliders,
  Save,
  Plus,
  Trash2,
  Clock
} from "lucide-react";
import api from "../utils/api";

// SVG Line Chart Component
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
          Min: {minVal} | Max: {maxVal}
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

// Small helper to support TrendingUp inside page file
const TrendingUp = ({ size, style }) => <Activity size={size} style={style} />;

export default function ZoneDashboard() {
  const { zoneId } = useParams();
  const { currentUser, role, zoneId: userZoneId, logout } = useAuth();
  const navigate = useNavigate();

  // Kiểm tra quyền truy cập phân khu của Client
  if (role === "CLIENT" && zoneId !== userZoneId) {
    return <Navigate to={`/zone/${userZoneId}`} replace />;
  }

  // Subscriptions hooks
  const { data, history } = useZoneRealtime(zoneId);
  const { controls } = useZoneControl(zoneId);

  // States
  const [plantNotes, setPlantNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [activeMetric, setActiveMetric] = useState("temperature");
  const [deviceLoading, setDeviceLoading] = useState({});
  const [logs, setLogs] = useState([]);

  // Thresholds state
  const [thresholds, setThresholds] = useState({ tempMax: 35, soilMin: 30, lightMin: 40 });

  // Ticking time state for expiresAt countdown
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Clock effect for manual override countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch thresholds on load
  useEffect(() => {
    const fetchThreshold = async () => {
      try {
        const res = await api.get(`/api/threshold/${zoneId}`);
        if (res.data && res.data.thresholds) {
          setThresholds({
            tempMax: res.data.thresholds.tempMax || 35,
            soilMin: res.data.thresholds.soilMin || 30,
            lightMin: res.data.thresholds.lightMin || 40
          });
        }
      } catch (err) {
        console.error("Lỗi fetch threshold:", err.message);
      }
    };

    if (zoneId) {
      fetchThreshold();
    }
  }, [zoneId]);

  // Subscribe to Plant Notes Realtime
  useEffect(() => {
    if (!zoneId) return;

    const notesRef = ref(db, `plant_notes/${zoneId}`);
    const unsubscribe = onValue(notesRef, (snapshot) => {
      const val = snapshot.val();
      let list = [];
      if (val) {
        list = Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        })).sort((a, b) => b.createdAt - a.createdAt);
      }
      setPlantNotes(list);
    });

    return () => unsubscribe();
  }, [zoneId]);

  const addLog = (message) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [{ time, message }, ...prev].slice(0, 30));
  };

  const handleDeviceControl = async (device, action, durationSec = 30) => {
    const key = `${zoneId}-${device}`;
    setDeviceLoading(prev => ({ ...prev, [key]: true }));
    addLog(`🔘 Gửi lệnh điều khiển [${device}] -> ${action.toUpperCase()}...`);

    try {
      const res = await api.post(`/api/control/${zoneId}/device/${device}`, {
        action,
        duration: durationSec
      });
      if (res.status === 200) {
        addLog(`✅ Thành công: ${res.data.message}`);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      addLog(`❌ Thất bại: ${msg}`);
      alert(msg);
    } finally {
      setDeviceLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleSaveThreshold = async (e) => {
    e.preventDefault();
    addLog(`⚙️ Đang gửi ngưỡng cấu hình mới lên backend...`);
    try {
      const res = await api.post(`/api/threshold/${zoneId}`, {
        tempMax: Number(thresholds.tempMax),
        soilMin: Number(thresholds.soilMin),
        lightMin: Number(thresholds.lightMin)
      });
      if (res.status === 200) {
        addLog(`✅ Đã lưu cấu hình ngưỡng mới.`);
        alert("Cấu hình ngưỡng đã được cập nhật!");
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      addLog(`❌ Thất bại: ${msg}`);
      alert(msg);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (noteText.trim() === "") return;

    addLog(`📝 Gửi ghi chú mới lên backend...`);
    try {
      const res = await api.post(`/api/notes/${zoneId}`, {
        note: noteText
      });
      if (res.status === 201) {
        addLog(`✅ Đã thêm ghi chú.`);
        setNoteText("");
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      addLog(`❌ Thất bại: ${msg}`);
      alert(msg);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm("Bạn có chắc chắn muốn xóa ghi chú này?")) return;

    addLog(`🗑️ Gửi lệnh xóa ghi chú ${noteId}...`);
    try {
      const res = await api.delete(`/api/notes/${zoneId}/${noteId}`);
      if (res.status === 200) {
        addLog(`✅ Đã xóa ghi chú thành công.`);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      addLog(`❌ Thất bại: ${msg}`);
      alert(msg);
    }
  };

  const metricColor = activeMetric === "temperature" ? "#ff5722" : activeMetric === "soil" ? "#00e676" : "#ffeb3b";

  return (
    <div className="dashboard-container">
      {/* Navigation */}
      <nav className="navbar">
        <div className="navbar-brand">
          {role === "ADMIN" ? (
            <Link to="/admin" style={{ color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 8, textDecoration: "none", fontSize: "0.95rem" }}>
              <ArrowLeft size={16} /> Master Dashboard
            </Link>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={18} className="sensor-temp" />
              <span>GreenHouse IoT Panel</span>
            </div>
          )}
        </div>
        <div className="navbar-user">
          <div className="user-badge">
            <UserIcon size={14} />
            <span>Chào, <strong>{currentUser?.displayName || currentUser?.email.split("@")[0]}</strong></span>
            <span className={`btn-preset-role ${role === "ADMIN" ? "admin" : "client"}`} style={{ fontSize: "0.7rem", marginLeft: 6 }}>
              {role}
            </span>
          </div>
          <button className="btn-secondary" onClick={logout}>
            <LogOut size={14} style={{ marginRight: 6 }} /> LogOut
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: "700" }}>Chi Tiết Phân Khu: {zoneId.toUpperCase()}</h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
            Quản lý số liệu cảm biến thời gian thực, điều khiển thiết bị & nhật ký ghi chú.
          </p>
        </div>

        {/* Dashboard Grid Details */}
        <div className="zones-grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
          
          {/* LEFT COLUMN: Sensors, Chart, and Controls */}
          <div className="glass-panel" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            
            {/* Realtime Sensors */}
            <div className="sensor-grid">
              <div className="sensor-card">
                <div className="sensor-icon"><Thermometer className="sensor-temp" size={18} /></div>
                <span className="sensor-label">Nhiệt độ</span>
                <span className="sensor-value sensor-temp">{data?.temperature !== undefined ? `${data.temperature}°C` : "--"}</span>
              </div>
              
              <div className="sensor-card">
                <div className="sensor-icon"><Droplet className="sensor-soil" size={18} /></div>
                <span className="sensor-label">Độ ẩm đất</span>
                <span className="sensor-value sensor-soil">{data?.soil !== undefined ? `${data.soil}%` : "--"}</span>
              </div>

              <div className="sensor-card">
                <div className="sensor-icon"><Sun className="sensor-light" size={18} /></div>
                <span className="sensor-label">Ánh sáng</span>
                <span className="sensor-value sensor-light">{data?.light !== undefined ? `${data.light} lx` : "--"}</span>
              </div>
            </div>

            {/* Sparkline Chart */}
            <div className="chart-metric-selector">
              <button className={`btn-metric-tab ${activeMetric === "temperature" ? "active" : ""}`} onClick={() => setActiveMetric("temperature")}>
                Nhiệt độ
              </button>
              <button className={`btn-metric-tab ${activeMetric === "soil" ? "active" : ""}`} onClick={() => setActiveMetric("soil")}>
                Độ ẩm đất
              </button>
              <button className={`btn-metric-tab ${activeMetric === "light" ? "active" : ""}`} onClick={() => setActiveMetric("light")}>
                Ánh sáng
              </button>
            </div>

            <RealtimeChart history={history} metric={activeMetric} color={metricColor} />

            {/* Threshold Configurations */}
            <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--glass-border)", borderRadius: "10px", padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: "600", display: "flex", alignItems: "center", gap: 4 }}>
                  <Sliders size={14} />
                  Ngưỡng Kích Hoạt Tự Động (Thresholds)
                </span>
                {role === "ADMIN" && (
                  <button onClick={handleSaveThreshold} className="btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4 }}>
                    <Save size={12} /> Lưu
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Nhiệt Max</span>
                  <input 
                    type="number" 
                    className="form-input" 
                    style={{ padding: "8px", fontSize: "0.85rem", marginTop: 4 }}
                    value={thresholds.tempMax}
                    onChange={e => setThresholds(prev => ({ ...prev, tempMax: e.target.value }))}
                    disabled={role !== "ADMIN"}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Ẩm Min</span>
                  <input 
                    type="number" 
                    className="form-input" 
                    style={{ padding: "8px", fontSize: "0.85rem", marginTop: 4 }}
                    value={thresholds.soilMin}
                    onChange={e => setThresholds(prev => ({ ...prev, soilMin: e.target.value }))}
                    disabled={role !== "ADMIN"}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Sáng Min</span>
                  <input 
                    type="number" 
                    className="form-input" 
                    style={{ padding: "8px", fontSize: "0.85rem", marginTop: 4 }}
                    value={thresholds.lightMin}
                    onChange={e => setThresholds(prev => ({ ...prev, lightMin: e.target.value }))}
                    disabled={role !== "ADMIN"}
                  />
                </div>
              </div>
              {role === "CLIENT" && (
                <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: 8 }}>
                  💡 Bạn chỉ có quyền xem cấu hình ngưỡng tự động này.
                </p>
              )}
            </div>

            {/* Devices control switches */}
            <div className="control-section">
              <div className="control-header">
                <Zap size={14} />
                <span>Điều khiển thiết bị {role === "CLIENT" && "(Tối đa 30s)"}</span>
              </div>

              {["lamp", "fan", "pump"].map((device) => {
                const devInfo = controls?.[device] || {};
                const isManual = devInfo.mode === "manual";
                const isOn = devInfo.state === true;
                const nextMode = isManual ? "auto" : "manual";
                const nextState = isOn ? "off" : "on";

                // Countdown remaining seconds calculation
                let countdownSec = 0;
                if (isManual && devInfo.expiresAt) {
                  const diff = devInfo.expiresAt - currentTime;
                  countdownSec = Math.max(0, Math.ceil(diff / 1000));
                }

                return (
                  <div key={device} style={{ display: "flex", flexDirection: "column", gap: 6, background: "rgba(0,0,0,0.15)", padding: "10px 14px", borderRadius: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ textTransform: "capitalize", fontSize: "0.85rem", fontWeight: "600", display: "flex", alignItems: "center", gap: 6 }}>
                        {device === "lamp" ? <Flame size={14} className="sensor-temp" /> : device === "fan" ? <Wind size={14} className="sensor-humidity" /> : <Droplet size={14} className="sensor-soil" />}
                        {device === "lamp" ? "Đèn sưởi" : device === "fan" ? "Quạt" : "Máy bơm"}
                      </span>
                      
                      <div style={{ display: "flex", gap: 8 }}>
                        {/* Auto/Manual toggle */}
                        <button 
                          disabled={role === "CLIENT" || deviceLoading[`${zoneId}-${device}`]}
                          onClick={() => handleDeviceControl(device, nextMode)}
                          className="btn-secondary" 
                          style={{ 
                            padding: "4px 8px", 
                            fontSize: "0.75rem", 
                            borderColor: !isManual ? "var(--color-success)" : "var(--color-text-muted)",
                            color: !isManual ? "var(--color-success)" : "var(--color-text-muted)" 
                          }}
                        >
                          {!isManual ? "Tự động" : "Bằng tay"}
                        </button>

                        {/* ON/OFF toggle */}
                        <button
                          disabled={deviceLoading[`${zoneId}-${device}`]}
                          onClick={() => handleDeviceControl(device, nextState, role === "CLIENT" ? 30 : 60)}
                          className={`btn-control ${isOn ? (device === "lamp" ? "active-heater" : device === "fan" ? "active-fan" : "active-pump") : ""}`}
                          style={{ padding: "4px 10px", fontSize: "0.75rem", width: "auto" }}
                        >
                          {isOn ? "BẬT" : "TẮT"}
                        </button>
                      </div>
                    </div>

                    {/* Countdown indicator */}
                    {isManual && devInfo.expiresAt && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, alignSelf: "flex-end", marginTop: 4 }}>
                        <Clock size={10} style={{ color: "var(--color-primary)" }} />
                        <span style={{ fontSize: "0.7rem", color: "var(--color-primary)" }}>
                          Chế độ bằng tay còn: {countdownSec > 0 ? `${countdownSec}s` : "Đang cập nhật..."}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: Plant Notes & Live Logs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Plant Notes Panel */}
            <div className="glass-panel" style={{ padding: 24 }}>
              <div className="panel-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "1rem" }}>
                <Terminal size={16} className="sensor-soil" />
                <span>Nhật ký ghi chú nông nghiệp</span>
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 16 }}>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ padding: "8px 12px", fontSize: "0.85rem" }}
                  placeholder="Thêm nhật ký tình trạng cây..." 
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  maxLength={500}
                />
                <button type="submit" className="btn-primary" style={{ width: "auto", padding: "8px 16px", display: "flex", alignItems: "center" }}>
                  <Plus size={16} /> Add
                </button>
              </form>

              {/* Scrollable list */}
              <div style={{ maxHeight: "250px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
                {plantNotes.map((noteItem) => {
                  const canDelete = role === "ADMIN" || noteItem.createdBy === currentUser?.uid;
                  return (
                    <div key={noteItem.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "rgba(0,0,0,0.2)", padding: 10, borderRadius: 8, gap: 10 }}>
                      <div>
                        <p style={{ fontSize: "0.8rem", color: "var(--color-text-main)", lineBreak: "anywhere" }}>{noteItem.note}</p>
                        <span style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock size={10} /> {new Date(noteItem.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {canDelete && (
                        <button onClick={() => handleDeleteNote(noteItem.id)} style={{ background: "none", border: "none", color: "var(--color-danger)", cursor: "pointer", display: "flex", alignItems: "center", padding: 2 }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {plantNotes.length === 0 && (
                  <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", textAlign: "center", display: "block", padding: 16 }}>Chưa có ghi chú nào.</span>
                )}
              </div>
            </div>

            {/* Local Socket Console Logs */}
            <div className="logs-panel glass-panel" style={{ minHeight: "200px" }}>
              <div className="panel-title">
                <Terminal size={14} className="sensor-temp" />
                <span>Hoạt động kết nối trực tiếp</span>
              </div>
              <div className="logs-list" style={{ maxHeight: "160px" }}>
                {logs.map((log, idx) => (
                  <div key={idx} className="log-item">
                    <span>{log.message}</span>
                    <span className="log-time">{log.time}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
