import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, increment, setDoc } from 'firebase/firestore';

export const useTraffic = () => {
  const [stats, setStats] = useState({ views: 0 });

  useEffect(() => {
    const statsRef = doc(db, 'system', 'traffic');

    const logVisit = async () => {
      try {
        await updateDoc(statsRef, { views: increment(1) });
      } catch (err) {
        await setDoc(statsRef, { views: 1 }, { merge: true });
      }
    };
    logVisit();

    const unsubscribe = onSnapshot(statsRef, (docSnap) => {
      if (docSnap.exists()) {
        setStats(docSnap.data());
      }
    });
    return () => unsubscribe();
  }, []);

  return stats;
};