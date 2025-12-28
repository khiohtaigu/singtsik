import React, { useState } from 'react';
import { db, auth } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';

const OnboardingForm = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    role: '教師',
    bio: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("找不到使用者帳號");

      // 更新 Firestore 中的使用者資料
      await setDoc(doc(db, 'users', user.uid), {
        ...formData,
        email: user.email,
        profileCompleted: true, // 關鍵：標記完成
        updatedAt: new Date()
      }, { merge: true });

      console.log("資料更新成功");
    } catch (error) {
      console.error("更新失敗:", error);
      alert("儲存失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
      <h2 className="text-2xl font-bold mb-2">建立您的個人檔案</h2>
      <p className="text-gray-500 mb-6">請填寫以下資訊以開始使用系統</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">真實姓名</label>
          <input
            required
            type="text"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={formData.displayName}
            onChange={(e) => setFormData({...formData, displayName: e.target.value})}
            placeholder="例如：曾耀毅"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">職務角色</label>
          <select 
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.role}
            onChange={(e) => setFormData({...formData, role: e.target.value})}
          >
            <option value="教師">教師</option>
            <option value="開發者">開發者</option>
            <option value="管理員">管理員</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">個人簡介</label>
          <textarea
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            rows="3"
            value={formData.bio}
            onChange={(e) => setFormData({...formData, bio: e.target.value})}
            placeholder="簡單介紹一下您自己..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
            loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200'
          }`}
        >
          {loading ? '儲存中...' : '完成並進入系統'}
        </button>
      </form>
    </div>
  );
};

export default OnboardingForm;