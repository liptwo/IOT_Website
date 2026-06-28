import React, { createContext, useContext, useState, useEffect } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [idToken, setIdToken] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Lấy token result cùng với custom claims (role, zoneId)
          const tokenResult = await user.getIdTokenResult(true);
          const claims = tokenResult.claims;
          
          setCurrentUser(user);
          setRole(claims.role || "CLIENT");
          setZoneId(claims.zoneId || "");
          setIdToken(tokenResult.token);
        } catch (err) {
          console.error("Lỗi khi nạp custom claims:", err.message);
          setCurrentUser(null);
          setRole("");
          setZoneId("");
          setIdToken("");
        }
      } else {
        setCurrentUser(null);
        setRole("");
        setZoneId("");
        setIdToken("");
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    setLoading(true);
    await signOut(auth);
    localStorage.removeItem("token");
  };

  const getFreshIdToken = async () => {
    if (auth.currentUser) {
      // Force refresh=true để nhận Token mới nhất chứa Custom Claims đã cập nhật
      const token = await auth.currentUser.getIdToken(true);
      setIdToken(token);
      return token;
    }
    return "";
  };

  const value = {
    currentUser,
    role,
    zoneId,
    idToken,
    loading,
    logout,
    getFreshIdToken
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
