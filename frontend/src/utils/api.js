import axios from "axios";
import { auth } from "../firebase";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
});

// Axios Request Interceptor tự động thêm header Authorization: Bearer <idToken>
api.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      try {
        // Lấy ID Token mới nhất
        const idToken = await user.getIdToken();
        config.headers.Authorization = `Bearer ${idToken}`;
      } catch (err) {
        console.error("Lỗi khi lấy ID Token trong Interceptor:", err.message);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
