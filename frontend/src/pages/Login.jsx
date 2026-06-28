import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import api from "../utils/api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const { currentUser, role, zoneId, getFreshIdToken } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser && role) {
      if (role === "ADMIN") {
        navigate("/admin", { replace: true });
      } else if (zoneId) {
        navigate(`/zone/${zoneId}`, { replace: true });
      }
    }
  }, [currentUser, role, zoneId, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setAuthLoading(true);

    const fakeEmail = `${username.trim().toLowerCase()}@agriresearch.local`;

    try {
      // 1. Đăng nhập qua Firebase Client SDK
      const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
      // 2. Refresh token và claims
      await userCredential.user.getIdToken(true);
    } catch (err) {
      console.error("Lỗi đăng nhập:", err.code, err.message);
      // Custom thông báo lỗi tiếng Việt
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setErrorMsg("Tên đăng nhập hoặc mật khẩu không chính xác.");
      } else if (err.code === "auth/invalid-email") {
        setErrorMsg("Tên đăng nhập chứa ký tự không hợp lệ.");
      } else {
        setErrorMsg(`Đăng nhập thất bại: ${err.message}`);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSeedAdmin = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setAuthLoading(true);
    try {
      const res = await api.post("/api/auth/seed-admin", {
        username: "admin",
        password: "admin123"
      });
      if (res.data) {
        setSuccessMsg("Đã khởi tạo Admin mặc định thành công! Đăng nhập: admin / admin123");
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setErrorMsg(`Lỗi khi seed Admin: ${msg}`);
    } finally {
      setAuthLoading(false);
    }
  };

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
            Click nếu dự án của bạn chưa tạo tài khoản Admin đầu tiên.
          </p>
        </div>
      </div>
    </div>
  );
}
