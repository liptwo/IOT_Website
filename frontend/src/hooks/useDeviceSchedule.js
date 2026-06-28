import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";

export function useDeviceSchedule(zoneId, device) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!zoneId || !device) return;

    const scheduleRef = ref(db, `schedules/${zoneId}/${device}`);
    
    const unsubscribe = onValue(scheduleRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const list = Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        }));
        setSchedules(list);
      } else {
        setSchedules([]);
      }
      setLoading(false);
    }, (error) => {
      console.error(`useDeviceSchedule error for ${zoneId}/${device}:`, error.message);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [zoneId, device]);

  return { schedules, loading };
}
