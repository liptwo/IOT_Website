import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useZoneRealtime } from "../hooks/useZoneRealtime";
import { useZoneControl } from "../hooks/useZoneControl";
import { 
  Activity, 
  Compass, 
  Thermometer, 
  Droplet, 
  Sun, 
  Wind, 
  User as UserIcon, 
  LogOut, 
  UserPlus, 
  Flame,
  Zap
} from "lucide-react";
import api from "../utils/api";

// Small component for each Zone card inside the Grid
function ZoneCard({ zoneId }) {
  const { data } = useZoneRealtime(zoneId);
  const { controls } = useZoneControl(zoneId);

  const isHeaterOn = controls?.heater?.state === true || controls?.lamp?.state === true;
  const isFanOn = controls?.fan?.state === true;
  const isPumpOn = controls?.pump?.state === true;

  return (
    <div className="zone-card glass-panel" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="zone-header">
        <div className="zone-title">
          <Compass size={18} className="sensor-humidity" />
          <h2 style={{ fontSize: "1.1rem" }}>{zoneId.toUpperCase()}</h2>
        </div>
        <span className={`zone-status-dot ${!data?.updatedAt ? "offline" : ""}`}></span>
      </div>

      {/* Mini Sensors Summary */}
      <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(0,0,0,0.1)", padding: 10, borderRadius: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Thermometer size={14} className="sensor-temp" />
          <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>{data?.temperature !== undefined ? `${data.temperature}°C` : "--"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Droplet size={14} className="sensor-soil" />
          <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>{data?.soil !== undefined ? `${data.soil}%` : "--"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Sun size={14} className="sensor-light" />
          <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>{data?.light !== undefined ? `${data.light} lx` : "--"}</span>
        </div>
      </div>

      {/* Mini Devices Badges */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <span className={`user-badge`} style={{ borderColor: isHeaterOn ? "var(--color-danger)" : "var(--glass-border)", color: isHeaterOn ? "var(--color-danger)" : "var(--color-text-muted)" }}>
          <Flame size={10} style={{ marginRight: 4 }} /> Đèn
        </span>
        <span className={`user-badge`} style={{ borderColor: isFanOn ? "var(--color-primary)" : "var(--glass-border)", color: isFanOn ? "var(--color-primary)" : "var(--color-text-muted)" }}>
          <Wind size={10} style={{ marginRight: 4 }} /> Quạt
        </span>
        <span className={`user-badge`} style={{ borderColor: isPumpOn ? "var(--color-success)" : "var(--glass-border)", color: isPumpOn ? "var(--color-success)" : "var(--color-text-muted)" }}>
          <Droplet size={10} style={{ marginRight: 4 }} /> Bơm
        </span>
      </div>

      <Link 
        to={`/admin/zone/${zoneId}`} 
        className="btn-control" 
        style={{ textDecoration: "none", fontSize: "0.85rem", textAlign: "center", padding: 8, background: "rgba(0, 242, 254, 0.05)", border: "1px solid var(--color-primary)" }}
      >
        Xem chi tiết
      </Link>
    </div>
  );
}

export default function AdminDashboard() {
  const { currentUser, logout } = useAuth();
  
  // Client creation fields
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newZoneId, setNewZoneId] = useState("zone1");
  const [regLoading, setRegLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const zonesList = ["zone1", "zone2", "zone3"];

  const handleRegisterClient = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setRegLoading(true);
    try {
      const res = await api.post("/api/auth/register-client", {
        username: newUsername,
        password: newPassword,
        zoneId: newZoneId
      });
      if (res.data) {
        setSuccessMsg(`Đã tạo tài khoản Client [${newUsername}] thành công gán vào ${newZoneId.toUpperCase()}!`);
        setNewUsername("");
        setNewPassword("");
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message;
      setErrorMsg(`Đăng ký thất bại: ${msg}`);
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Navigation */}
      <nav className="navbar">
        <div className="navbar-brand">
          <Activity size={20} className="sensor-temp" />
          <span>GreenHouse IoT Master Panel</span>
        </div>
        <div className="navbar-user">
          <div className="user-badge">
            <UserIcon size={14} />
            <span>Chào Admin, <strong>{currentUser?.displayName || currentUser?.email.split("@")[0]}</strong></span>
            <span className="btn-preset-role admin" style={{ fontSize: "0.7rem", marginLeft: 6 }}>ADMIN</span>
          </div>
          <button className="btn-secondary" onClick={logout}>
            <LogOut size={14} style={{ marginRight: 6 }} /> LogOut
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: "700" }}>Hệ Thống Giám Sát Master</h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
            Trang tổng quan dành cho Quản trị viên theo dõi toàn bộ các phân khu nghiên cứu.
          </p>
        </div>

        {/* Client Registration Panel */}
        <div className="glass-panel" style={{ padding: 20, marginBottom: 30, background: "rgba(0, 242, 254, 0.02)" }}>
          <div className="panel-title" style={{ color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 8, fontSize: "0.95rem" }}>
            <UserPlus size={16} />
            <span>Cấp tài khoản Client & Phân quyền Khu Vực</span>
          </div>

          {errorMsg && <div className="alert-error" style={{ marginTop: 10, marginBottom: 10 }}>{errorMsg}</div>}
          {successMsg && <div className="alert-success" style={{ marginTop: 10, marginBottom: 10 }}>{successMsg}</div>}

          <form onSubmit={handleRegisterClient} style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <label className="form-label" style={{ fontSize: "0.75rem", marginBottom: 4 }}>Username Client</label>
              <input 
                type="text" 
                className="form-input" 
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="Ví dụ: client_z1" 
                required
              />
            </div>

            <div style={{ flex: 1, minWidth: "120px" }}>
              <label className="form-label" style={{ fontSize: "0.75rem", marginBottom: 4 }}>Mật khẩu</label>
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
              <label className="form-label" style={{ fontSize: "0.75rem", marginBottom: 4 }}>Gán vào Zone</label>
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

            <button type="submit" className="btn-primary" style={{ padding: "10px 20px", width: "auto" }} disabled={regLoading}>
              {regLoading ? "Đang tạo..." : "Cấp tài khoản"}
            </button>
          </form>
        </div>

        {/* Zones Grid */}
        <div className="zones-grid">
          {zonesList.map(zoneId => (
            <ZoneCard key={zoneId} zoneId={zoneId} />
          ))}
        </div>
      </main>
    </div>
  );
}
