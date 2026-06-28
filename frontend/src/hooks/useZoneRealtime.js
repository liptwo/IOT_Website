import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";

export function useZoneRealtime(zoneId) {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!zoneId) return;

    const sensorRef = ref(db, `realtime_data/${zoneId}`);
    
    const unsubscribe = onValue(sensorRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        setData(val);
        setHistory(prev => {
          const newReading = {
            temperature: val.temperature || 0,
            soil: val.soil || 0,
            light: val.light || 0,
            timestamp: Date.now()
          };
          return [...prev, newReading].slice(-15);
        });
      }
      setLoading(false);
    }, (error) => {
      console.error(`useZoneRealtime error for ${zoneId}:`, error.message);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [zoneId]);

  return { data, history, loading };
}
