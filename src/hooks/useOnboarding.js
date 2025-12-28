import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export const useOnboarding = () => {
  const [status, setStatus] = useState({
    isLoading: true,
    isCompleted: false,
    userData: null
  });

  useEffect(() => {
    // 監聽 Auth 狀態
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        // 監聽 Firestore 使用者文件
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setStatus({
              isLoading: false,
              isCompleted: docSnap.data().profileCompleted || false,
              userData: docSnap.data()
            });
          } else {
            // 文件不存在，視為尚未完成 Onboarding
            setStatus({ isLoading: false, isCompleted: false, userData: null });
          }
        });
        return () => unsubscribeDoc();
      } else {
        setStatus({ isLoading: false, isCompleted: false, userData: null });
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return status;
};