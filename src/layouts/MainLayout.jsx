import React from 'react';
import { useTraffic } from '../hooks/useTraffic';
import { Mail, MessageCircle, Coffee } from 'lucide-react';

const MainLayout = ({ children, customSidebar }) => {
  const { views } = useTraffic();

  return (
    <div className="min-h-screen w-full bg-[#cbd5e1] p-2 sm:p-4 lg:p-6 transition-all duration-300 font-sans overflow-x-hidden">
      <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row gap-4 lg:gap-6 items-start">
        
        {/* 左側：主內容區域 */}
        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          <main className="w-full bg-white/80 backdrop-blur-md rounded-[24px] sm:rounded-[40px] shadow-2xl p-4 sm:p-6 lg:p-10 border border-white/20">
            {children}

            {/* 版權與 QR Code 頁尾 */}
            <footer className="mt-16 pt-10 border-t border-slate-200/50 flex flex-col md:flex-row items-center justify-center gap-8">
              <div className="group relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-2xl blur opacity-25 transition duration-1000"></div>
                <div className="relative bg-white p-3 rounded-2xl shadow-xl border border-slate-100">
                  <img 
                    src="/qrcode.png" 
                    alt="Line QR Code" 
                    className="w-24 h-24 sm:w-28 sm:h-28 object-contain grayscale-[0.2] transition-all"
                    onError={(e) => { e.target.src = "https://placehold.co/150x150?text=Line+QR"; }}
                  />
                </div>
              </div>

              <div className="text-center md:text-left space-y-2">
                <p className="text-slate-800 font-black text-lg sm:text-xl tracking-tight">
                  本網頁由 <span className="text-indigo-600">蚵仔囝老師</span>、<span className="text-indigo-600">蒜米老師</span> 製作、授權使用
                </p>
                <p className="text-slate-500 font-bold text-xs sm:text-sm flex items-center justify-center md:justify-start gap-2 font-sans">
                  <Coffee size={14} className="text-amber-600" /> 使用上有問題或請我喝咖啡，請跟我聯繫
                </p>
                <div className="flex flex-col md:flex-row gap-2 md:gap-6 text-slate-400 font-semibold text-xs pt-1 font-sans">
                  <a href="mailto:yaoink@gmail.com" className="flex items-center justify-center md:justify-start gap-2 hover:text-indigo-500 transition-colors font-sans">
                    <Mail size={14} /> yaoink@gmail.com
                  </a>
                  <div className="flex items-center justify-center md:justify-start gap-2 font-sans">
                    <MessageCircle size={14} className="text-green-500" /> Line ID：@956hkncr
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.4em] pt-3 font-sans">
                  © 2025 KHIOHTAIGU ACADEMIC MANAGEMENT SYSTEM
                </p>
              </div>
            </footer>
          </main>
        </div>

        {/* 右側：側邊欄 (Sticky) */}
        <aside className="w-full xl:w-80 flex-shrink-0 space-y-4 xl:sticky xl:top-6 font-sans">
          {/* 已修正：現在這裡只顯示 App.jsx 傳入的內容，不會再多出一張卡片 */}
          {customSidebar}

          <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-2xl border border-white/5 font-sans">
            <h4 className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] mb-3 font-sans">System Traffic</h4>
            <div className="flex items-baseline gap-2 font-sans">
              <span className="text-4xl font-black font-mono text-indigo-400">{views}</span>
              <span className="text-slate-600 text-[10px] font-bold font-sans">VISITS</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MainLayout;