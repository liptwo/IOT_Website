import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, role, zoneId, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Đang tải thông tin xác thực...</p>
      </div>
    );
  }

  // Chưa đăng nhập -> về Login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Kiểm tra vai trò được phép
  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect về trang phù hợp với role thực tế
    if (role === "ADMIN") {
      return <Navigate to="/admin" replace />;
    } else {
      return <Navigate to={`/zone/${zoneId}`} replace />;
    }
  }

  return children;
}
