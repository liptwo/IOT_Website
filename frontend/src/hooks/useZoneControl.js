import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";

export function useZoneControl(zoneId) {
  const [controls, setControls] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!zoneId) return;

    const controlRef = ref(db, `control/${zoneId}`);
    
    const unsubscribe = onValue(controlRef, (snapshot) => {
      const val = snapshot.val();
      setControls(val || {});
      setLoading(false);
    }, (error) => {
      console.error(`useZoneControl error for ${zoneId}:`, error.message);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [zoneId]);

  return { controls, loading };
}
