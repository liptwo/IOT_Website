import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import ZoneDashboard from "./pages/ZoneDashboard";

// Helper để tự động điều hướng tại đường dẫn gốc "/"
function RootRedirect() {
  const { currentUser, role, zoneId } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  if (role === "ADMIN") {
    return <Navigate to="/admin" replace />;
  }
  
  if (zoneId) {
    return <Navigate to={`/zone/${zoneId}`} replace />;
  }
  
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Trang đăng nhập */}
          <Route path="/login" element={<Login />} />

          {/* Master Dashboard dành cho ADMIN */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Xem chi tiết từng Zone dành cho ADMIN */}
          <Route 
            path="/admin/zone/:zoneId" 
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <ZoneDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Zone Dashboard dành riêng cho CLIENT được gán */}
          <Route 
            path="/zone/:zoneId" 
            element={
              <ProtectedRoute allowedRoles={["CLIENT"]}>
                <ZoneDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Đường dẫn gốc: Tự động điều hướng theo role */}
          <Route path="/" element={<RootRedirect />} />

          {/* Mọi route không tồn tại điều hướng về trang chủ */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
