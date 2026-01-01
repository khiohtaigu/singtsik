import React, { useState, useRef, useEffect, useMemo } from 'react';
import MainLayout from './layouts/MainLayout';
import { 
  Lock, Unlock, Plus, Percent, ChevronDown, ChevronUp, 
  FileUp, Users, Settings2, ClipboardPaste, CheckCircle2, Trash2, Award, AlertCircle, Scale, BarChart3, Download, Image as ImageIcon, QrCode, X, Send, CalendarDays, XCircle, LogOut, GraduationCap, ShieldCheck, MapPin, School, Lightbulb, Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import { db, auth, googleProvider } from './firebase'; 
import { doc, setDoc, onSnapshot, getDoc, collection, getDocs, deleteDoc, query } from 'firebase/firestore';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';

// --- 預設常數 ---
const DEFAULT_HEADERS = [
  { id: 'e1', name: '第一次期中考', type: 'exam', isLocked: true },
  { id: 'e2', name: '第二次期中考', type: 'exam', isLocked: true },
  { id: 'e3', name: '期末考', type: 'exam', isLocked: true },
  { id: 'q1', name: '平時 1', type: 'quiz', isLocked: false },
  { id: 'q2', name: '平時 2', type: 'quiz', isLocked: false },
  { id: 'q3', name: '平時 3', type: 'quiz', isLocked: false },
  { id: 'q4', name: '平時 4', type: 'quiz', isLocked: false },
  { id: 'b1', name: '優異加分', type: 'bonus', isLocked: true },
];
const DEFAULT_WEIGHTS = { e1: 20, e2: 20, e3: 30, quizAvg: 30 };
const DEFAULT_VISIBILITY = { e1: true, e2: true, e3: true };

function App() {
  const getDefaultAcademicInfo = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    let ay = month >= 8 ? year - 1911 : year - 1911 - 1;
    let sem = (month >= 8 || month === 1) ? 1 : 2;
    return { ay, sem };
  };

  const defaultInfo = getDefaultAcademicInfo();

  // --- 狀態管理 ---
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [visitCount, setVisitCount] = useState(0); // 系統流量狀態

  const [academicYear, setAcademicYear] = useState(defaultInfo.ay);
  const [semester, setSemester] = useState(defaultInfo.sem);
  const [importYear, setImportYear] = useState(defaultInfo.ay);
  const [importSemester, setImportSemester] = useState(defaultInfo.sem);

  const [availableClasses, setAvailableClasses] = useState([]);
  const [currentClass, setCurrentClass] = useState(null);
  const [studentList, setStudentList] = useState([]);
  const [examHeaders, setExamHeaders] = useState(DEFAULT_HEADERS);
  const [examVisibility, setExamVisibility] = useState(DEFAULT_VISIBILITY);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [pickBestCount, setPickBestCount] = useState(3);
  const [isPaddingZero, setIsPaddingZero] = useState(false);
  const [scores, setScores] = useState({});

  const [openPanel, setOpenPanel] = useState('batch'); 
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrTarget, setQRTarget] = useState(null);
  const [isClassEditMode, setIsClassEditMode] = useState(false);
  const [batchTargetId, setBatchTargetId] = useState('q1');
  const [batchRawData, setBatchRawData] = useState('');

  const fileInputRef = useRef(null);
  const tableContainerRef = useRef(null);
  const exportAreaRef = useRef(null);

  const quizCount = examHeaders.filter(h => h.type === 'quiz').length;
  const viewPrefix = `${academicYear}_${semester}`; 

  // --- 1. 身分驗證 ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const profileSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (profileSnap.exists()) setUserProfile(profileSnap.data());
        setUser(currentUser);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // --- 2. 讀取系統流量統計 ---
  useEffect(() => {
    const trafficRef = doc(db, "system", "traffic");
    const unsub = onSnapshot(trafficRef, (docSnap) => {
      if (docSnap.exists()) {
        setVisitCount(docSnap.data().views || 0);
      }
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => { try { await signInWithPopup(auth, googleProvider); } catch (err) { alert("登入失敗"); } };
  const handleLogout = () => signOut(auth);

  // --- 3. 雲端資料同步 ---
  useEffect(() => {
    if (!user?.uid) return;
    const fetchClasses = async () => {
      const metaRef = collection(db, `users/${user.uid}/metadata`);
      const querySnapshot = await getDocs(query(metaRef));
      const classes = [];
      querySnapshot.forEach((doc) => {
        if (doc.id.startsWith(viewPrefix)) {
          classes.push(doc.id.replace(`${viewPrefix}_`, ""));
        }
      });
      setAvailableClasses(classes.sort());
      if (classes.length > 0) {
        if (!currentClass || !classes.includes(currentClass)) setCurrentClass(classes[0]);
      } else {
        setCurrentClass(null); setStudentList([]); setScores({});
      }
    };
    fetchClasses();
  }, [viewPrefix, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !currentClass) return;
    const combinedId = `${viewPrefix}_${currentClass}`;
    const metaRef = doc(db, `users/${user.uid}/metadata`, combinedId);
    const scoreRef = doc(db, `users/${user.uid}/scores`, combinedId);
    getDoc(metaRef).then(s => {
      if (s.exists()) {
        const data = s.data();
        setStudentList(data.students || []);
        setExamHeaders(data.examHeaders || DEFAULT_HEADERS);
        setWeights(data.weights || DEFAULT_WEIGHTS);
        setExamVisibility(data.examVisibility || DEFAULT_VISIBILITY);
        setPickBestCount(data.pickBestCount || 3);
        setIsPaddingZero(data.isPaddingZero || false);
      }
    });
    const unsub = onSnapshot(scoreRef, (docSnap) => {
      setScores(docSnap.exists() ? docSnap.data() : {});
    });
    return () => unsub();
  }, [currentClass, viewPrefix, user?.uid]);

  const saveClassConfig = async (updates) => {
    if (!user?.uid || !currentClass) return;
    await setDoc(doc(db, `users/${user.uid}/metadata`, `${viewPrefix}_${currentClass}`), updates, { merge: true });
  };

  // --- 4. 計算引擎 ---
  const totalWeight = useMemo(() => Object.entries(weights).filter(([key]) => key === 'quizAvg' || examVisibility[key]).reduce((sum, [_, val]) => sum + val, 0), [weights, examVisibility]);

  const calculationResults = useMemo(() => {
    const results = {};
    studentList.forEach(student => {
      const sScores = scores[student.id] || {};
      const quizItems = examHeaders.filter(h => h.type === 'quiz');
      let locked = []; let candidates = [];
      quizItems.forEach(h => {
        const val = parseFloat(sScores[h.id]);
        if (!isNaN(val)) h.isLocked ? locked.push({ id: h.id, val }) : candidates.push({ id: h.id, val });
      });
      candidates.sort((a, b) => b.val - a.val);
      const slotsLeft = Math.max(0, pickBestCount - locked.length);
      const finalQuizzes = [...locked, ...candidates.slice(0, slotsLeft)];
      const divisor = isPaddingZero ? Math.max(pickBestCount, locked.length) : finalQuizzes.length;
      const baseQuizAvg = finalQuizzes.length > 0 ? (finalQuizzes.reduce((a, b) => a + b.val, 0) / divisor) : 0;
      const bonusTotal = examHeaders.filter(h => h.type === 'bonus').reduce((sum, h) => sum + (parseFloat(sScores[h.id]) || 0), 0);
      const finalQuizAvg = Math.min(100, parseFloat((baseQuizAvg + bonusTotal).toFixed(1)));
      let total = 0;
      if (examVisibility.e1) total += (parseFloat(sScores['e1']) || 0) * (weights.e1 / 100);
      if (examVisibility.e2) total += (parseFloat(sScores['e2']) || 0) * (weights.e2 / 100);
      if (examVisibility.e3) total += (parseFloat(sScores['e3']) || 0) * (weights.e3 / 100);
      total += finalQuizAvg * (weights.quizAvg / 100);
      results[student.id] = { quizAvg: finalQuizAvg, semesterTotal: Math.min(100, parseFloat(total.toFixed(1))), usedIds: finalQuizzes.map(item => item.id), actualQuizCount: finalQuizzes.length };
    });
    return results;
  }, [studentList, scores, examHeaders, examVisibility, weights, pickBestCount, isPaddingZero]);

  // --- 5. 核心功能 ---
  const handleScoreChange = async (sid, hid, val) => {
    if (!user || !currentClass) return;
    let fv = val === "" ? "" : Math.max(0, Math.min(100, parseInt(val, 10)));
    await setDoc(doc(db, `users/${user.uid}/scores`, `${viewPrefix}_${currentClass}`), { [sid]: { ...(scores[sid] || {}), [hid]: fv } }, { merge: true });
  };

  const handleUpdateHeaderName = (id, newName) => {
    const newHeaders = examHeaders.map(h => h.id === id ? { ...h, name: newName } : h);
    setExamHeaders(newHeaders); saveClassConfig({ examHeaders: newHeaders });
  };

  const handleAddQuizColumn = () => {
    const newHeaders = [...examHeaders, { id: `q${Date.now()}`, name: `平時 ${quizCount + 1}`, type: 'quiz', isLocked: false }];
    setExamHeaders(newHeaders); saveClassConfig({ examHeaders: newHeaders });
    scrollToRight();
  };

  const handleAddBonusColumn = () => {
    const newHeaders = [...examHeaders, { id: `b${Date.now()}`, name: `優異加分`, type: 'bonus', isLocked: true }];
    setExamHeaders(newHeaders); saveClassConfig({ examHeaders: newHeaders });
    scrollToRight();
  };

  const handleDeleteColumn = (id) => {
    if (window.confirm("確定要刪除此成績欄位嗎？")) {
      const newHeaders = examHeaders.filter(h => h.id !== id);
      setExamHeaders(newHeaders); saveClassConfig({ examHeaders: newHeaders });
    }
  };

  const toggleHeaderLock = (id) => {
    const newHeaders = examHeaders.map(h => h.id === id ? { ...h, isLocked: !h.isLocked } : h);
    setExamHeaders(newHeaders); saveClassConfig({ examHeaders: newHeaders });
  };

  const handleBatchImport = async () => {
    if (!currentClass || !user) return;
    const lines = batchRawData.split(/[\n, \t]+/).filter(v => v.trim() !== "");
    const newScores = { ...scores };
    studentList.forEach((s, i) => {
      if (lines[i]) {
        const val = parseInt(lines[i], 10);
        newScores[s.id] = { ...(newScores[s.id] || {}), [batchTargetId]: isNaN(val) ? "" : Math.max(0, Math.min(100, val)) };
      }
    });
    await setDoc(doc(db, `users/${user.uid}/scores`, `${viewPrefix}_${currentClass}`), newScores);
    setBatchRawData('');
  };

  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const importPrefix = `${importYear}_${importSemester}`;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
      for (const name of wb.SheetNames) {
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[name]);
        const students = raw.map((row, idx) => {
          const rn = parseInt(row['座號'], 10);
          const fn = isNaN(rn) ? String(idx + 1).padStart(2, '0') : String(rn).padStart(2, '0');
          return { id: `${name}-${fn}`, class: row['班級'] || name, no: fn, name: row['姓名'] || '未具名' };
        });
        await setDoc(doc(db, `users/${user.uid}/metadata`, `${importPrefix}_${name}`), { students, examHeaders: DEFAULT_HEADERS, weights: DEFAULT_WEIGHTS, examVisibility: DEFAULT_VISIBILITY, pickBestCount: 3, isPaddingZero: false }, { merge: true });
      }
      setAcademicYear(importYear); setSemester(importSemester);
      alert(`已成功匯入正式資料`);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDeleteClass = async (className) => {
    if (window.confirm(`確定要刪除「${className} 班」嗎？`)) {
      await deleteDoc(doc(db, `users/${user.uid}/metadata`, `${viewPrefix}_${className}`));
      setAvailableClasses(prev => prev.filter(c => c !== className));
      if (currentClass === className) setCurrentClass(null);
    }
  };

  const handleVerticalTab = (e, sIdx, headerId) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextIdx = e.shiftKey ? sIdx - 1 : sIdx + 1;
      const targetInput = document.querySelector(`input[data-row="${nextIdx}"][data-col="${headerId}"]`);
      if (targetInput) { targetInput.focus(); targetInput.select(); }
    }
  };

  const scrollToRight = () => { if (tableContainerRef.current) { setTimeout(() => { tableContainerRef.current.scrollTo({ left: tableContainerRef.current.scrollWidth, behavior: 'smooth' }); }, 150); } };

  // --- 6. 渲染路由 ---
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('uid') && urlParams.get('examId')) {
    return <AssistantInputView teacherUid={urlParams.get('uid')} year={urlParams.get('year')} semester={urlParams.get('semester')} className={urlParams.get('class')} examId={urlParams.get('examId')} customName={urlParams.get('examName')} />;
  }

  if (authLoading) return <LoadingScreen text="確認身分中..." />;
  if (!user) return <LoginScreen onLogin={handleLogin} />;
  if (!userProfile) return <OnboardingScreen user={user} onComplete={(data) => setUserProfile(data)} />;

  const sortedVisibleHeaders = [ ...examHeaders.filter(h => h.type === 'exam' && examVisibility[h.id]), ...examHeaders.filter(h => h.type === 'quiz'), ...examHeaders.filter(h => h.type === 'bonus') ];

  return (
    <MainLayout 
      customSidebar={
        <div className="space-y-4 font-sans pb-10">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-2 border border-white/50 overflow-hidden font-black">
              <div className="w-10 h-10 flex-shrink-0 bg-indigo-100 rounded-full flex items-center justify-center text-2xl">👨‍🏫</div>
              <div className="min-w-0">
                <div className="text-slate-800 text-xl truncate tracking-tighter">{userProfile?.displayName || user?.displayName || '老師'}</div>
                <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Academic</div>
              </div>
            </div>
            <button onClick={handleLogout} className="bg-rose-50 text-rose-500 rounded-2xl font-black text-sm flex items-center justify-center gap-1 hover:bg-rose-100 transition-all border border-rose-100/50">
              <LogOut size={16}/> 登出
            </button>
          </div>

          <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-200 space-y-4 font-black">
            <h4 className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2"><CalendarDays size={14} /> 匯入對象學期 (Excel)</h4>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={importYear} onChange={(e) => setImportYear(parseInt(e.target.value))} className="w-full bg-slate-50 rounded-xl p-3 text-indigo-600 text-center text-xl font-mono outline-none" />
              <select value={importSemester} onChange={(e) => setImportSemester(parseInt(e.target.value))} className="w-full bg-slate-50 rounded-xl p-3 text-slate-700 text-center h-[52px] outline-none">
                <option value={1}>第 1 學期</option><option value={2}>第 2 學期</option>
              </select>
            </div>
            <button onClick={() => fileInputRef.current.click()} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all text-base uppercase"><FileUp size={24} /> 匯入班級 EXCEL</button>
          </div>

          <div className="grid grid-cols-2 gap-2 font-black">
            <button onClick={() => { if (!currentClass) return alert("請選班級"); const data = studentList.map(s => { const res = calculationResults[s.id] || { quizAvg: 0, semesterTotal: 0 }; const row = { "座號": s.no, "姓名": s.name }; sortedVisibleHeaders.forEach(h => { row[h.name] = scores[s.id]?.[h.id] || ''; }); row["平時平均"] = res.quizAvg; row["學期總成績"] = res.semesterTotal; return row; }); const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "成績單"); XLSX.writeFile(wb, `${academicYear}_${semester}_${currentClass}班成績.xlsx`); }} className="py-4 bg-white text-indigo-600 border-2 border-indigo-600 rounded-xl text-sm shadow-md">匯出 Excel</button>
            <button onClick={() => { if (!exportAreaRef.current) return; toPng(exportAreaRef.current, { backgroundColor: '#cbd5e1' }).then(url => { const l = document.createElement('a'); l.download = `${academicYear}_${semester}_${currentClass}班.png`; l.href = url; l.click(); }); }} className="py-4 bg-white text-emerald-600 border-2 border-emerald-600 rounded-xl font-black text-sm shadow-md">另存圖片</button>
          </div>

          <CollapsiblePanel title="成績快匯" icon={<ClipboardPaste size={20} />} isOpen={openPanel === 'batch'} onToggle={() => setOpenPanel(openPanel === 'batch' ? null : 'batch')}>
            <div className="p-5 pt-0 space-y-4 font-black">
              <select value={batchTargetId} onChange={(e)=>setBatchTargetId(e.target.value)} className="w-full bg-slate-100 rounded-xl p-3 font-bold border-2 border-slate-200 outline-none">{sortedVisibleHeaders.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              <textarea value={batchRawData} onChange={(e)=>setBatchRawData(e.target.value)} placeholder="複製分數貼於此..." className="w-full h-36 bg-slate-50 rounded-xl p-4 font-mono border-2 border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
              <button onClick={handleBatchImport} className="w-full py-4 bg-slate-800 text-white rounded-xl font-black hover:bg-black transition-all">批次匯入本班</button>
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel title="成績比例與權重" icon={<Settings2 size={20} />} isOpen={openPanel === 'rules'} onToggle={() => setOpenPanel(openPanel === 'rules' ? null : 'rules')}>
            <div className="p-5 pt-0 space-y-4 font-black">
              {[ { label: '第一次期中考', key: 'e1' }, { label: '第二次期中考', key: 'e2' }, { label: '期末考', key: 'e3' }, { label: '平時成績比例', key: 'quizAvg' } ].map(k => (
                <div key={k.key} className={`flex justify-between items-center bg-slate-900 rounded-2xl p-4 ${k.key !== 'quizAvg' && !examVisibility[k.key] ? 'opacity-40' : ''}`}>
                   <div className="flex items-center gap-3">
                    {k.key !== 'quizAvg' && <input type="checkbox" checked={examVisibility[k.key]} onChange={()=> { const newVis = {...examVisibility, [k.key]: !examVisibility[k.key]}; setExamVisibility(newVis); saveClassConfig({ examVisibility: newVis }); }} className="w-5 h-5 accent-indigo-500" />}
                    <span className="text-sm text-slate-300 font-bold">{k.label}</span>
                  </div>
                  <input type="number" value={weights[k.key]} onChange={(e)=> { let n = parseInt(e.target.value, 10); const newWeights = {...weights, [k.key]: isNaN(n)?0:n}; setWeights(newWeights); saveClassConfig({ weights: newWeights }); }} className="bg-transparent text-right text-indigo-400 font-mono w-16 outline-none text-xl font-black" />
                </div>
              ))}
              <div className="flex justify-between items-center px-2 py-2 border-t border-slate-800 font-black"><span className="text-sm text-slate-400">權重總計</span><span className={`text-2xl font-mono ${totalWeight === 100 ? 'text-green-400' : 'text-rose-500'}`}>{totalWeight}%</span></div>
            </div>
          </CollapsiblePanel>

          <div className="grid grid-cols-1 gap-3 font-black">
            <button onClick={handleAddQuizColumn} className="w-full py-5 bg-slate-800 text-white rounded-[24px] text-sm shadow-lg flex items-center justify-center gap-2 hover:bg-black transition-all font-black"><Plus size={18} /> 增加平時成績</button>
            <button onClick={handleAddBonusColumn} className="w-full py-5 bg-emerald-600 text-white rounded-[24px] text-sm shadow-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all font-black"><Award size={18} /> 增加優異加分</button>
          </div>

          <div className="bg-amber-50 rounded-[24px] p-6 border-2 border-amber-200 space-y-4 shadow-sm font-black text-amber-900">
            <h5 className="font-black text-xl flex items-center gap-3"><Lightbulb size={24} className="text-amber-600" /> 操作小撇步</h5>
            <ul className="text-base space-y-4 leading-relaxed font-bold">
              <li>• <b>縱向跳格：</b>按 <b>Tab</b> 鍵，可直接跳至下一位學生。</li>
              <li>• <b>優異加分：</b>此項目是在平時平均成績計算完成後，才額外給予的平均總分加分。</li>
              <li>• <b>小老師模式：</b>點擊標題旁的 QR Code，可授權小老師協助登錄。</li>
              <li>• <b>定期備份：</b>請記得定期使用「匯出 Excel」下載資料。</li>
            </ul>
          </div>

          {/* 流量統計區塊 */}
          <div className="bg-slate-900 rounded-[32px] p-8 mt-10 shadow-2xl border border-slate-800 font-black">
             <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-4">System Traffic</div>
             <div className="flex items-end gap-4">
                <div className="text-6xl font-black text-indigo-500 font-mono leading-none tracking-tighter">{visitCount}</div>
                <div className="text-slate-400 font-bold pb-1 uppercase text-xs tracking-widest">Visits</div>
             </div>
          </div>
        </div>
      }
    >
      <div ref={exportAreaRef} className="p-2 font-sans font-black">
        <div className="mb-8 font-black">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6 mb-10 font-black text-slate-900">
            <h1 className="text-4xl lg:text-5xl font-black tracking-tighter font-black">成績管理中心</h1>
            <div className="flex items-center bg-indigo-600 text-white px-6 py-3 rounded-[28px] shadow-xl font-black">
              <div className="flex items-center gap-3 font-black"><span className="font-black text-2xl font-mono font-black">{academicYear}</span>
                <div className="flex flex-col -space-y-1 font-black"><button onClick={() => setAcademicYear(prev => prev + 1)} className="hover:text-indigo-200 font-black"><ChevronUp size={20} strokeWidth={3} /></button><button onClick={() => setAcademicYear(prev => prev - 1)} className="hover:text-indigo-200 font-black"><ChevronDown size={20} strokeWidth={3} /></button></div><span className="text-sm font-bold opacity-80 mr-2 font-black font-black">學年</span>
              </div>
              <div className="w-px h-6 bg-white/20 mx-4 font-black"></div>
              <div className="flex items-center gap-3 font-black font-black"><span className="font-black text-2xl font-black">第 {semester} 學期</span>
                <div className="flex flex-col -space-y-1 font-black"><button onClick={() => setSemester(prev => prev === 1 ? 2 : 1)} className="hover:text-indigo-200 font-black"><ChevronUp size={20} strokeWidth={3} /></button><button onClick={() => setSemester(prev => prev === 1 ? 2 : 1)} className="hover:text-indigo-200 font-black"><ChevronDown size={20} strokeWidth={3} /></button></div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 no-export font-black">
            <div className="flex items-center gap-2 mr-4 bg-slate-100 p-2 px-4 rounded-2xl border border-slate-200 shadow-inner font-black font-black"><button onClick={() => setIsClassEditMode(!isClassEditMode)} className={`p-2 rounded-xl transition-all ${isClassEditMode ? 'bg-indigo-600 text-white rotate-12 shadow-lg font-black' : 'bg-orange-100 text-orange-600 font-black font-black'}`}>{isClassEditMode ? <Unlock size={20} /> : <Lock size={20} />}</button><span className="text-[10px] font-black text-slate-400 tracking-widest uppercase font-black font-black">Class Control</span></div>
            {availableClasses.length > 0 ? availableClasses.map(cls => (
              <div key={cls} className="relative group font-black"><button onClick={() => setCurrentClass(cls)} className={`px-10 py-4 rounded-[20px] font-black text-xl transition-all font-black ${currentClass === cls ? 'bg-indigo-600 text-white shadow-xl scale-105 shadow-indigo-200' : 'bg-white text-slate-400 hover:bg-slate-50 font-black'}`}>{cls} 班</button>{isClassEditMode && <button onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls); }} className="absolute -top-3 -right-3 bg-white text-rose-500 rounded-full shadow-2xl border-2 border-rose-50 font-black"><XCircle size={32} fill="white" /></button>}</div>
            )) : <p className="text-slate-300 font-black ml-4 text-lg italic font-black">此學期尚無資料，請由右側進行匯入</p>}
          </div>
        </div>

        {studentList.length > 0 ? (
          <div className="bg-white rounded-[48px] shadow-2xl border border-slate-200 overflow-hidden font-black">
            <div className="w-full overflow-x-auto font-black" ref={tableContainerRef}>
              <table className="w-full border-collapse font-black">
                <thead>
                  <tr className="bg-slate-50/50 text-xs font-black text-slate-400">
                    <th className="p-3 border-b border-r border-slate-100 sticky left-0 bg-slate-50 z-20 w-10 font-mono font-black font-black font-black font-black font-black">NO</th>
                    <th className="p-3 border-b border-r border-slate-100 sticky left-[40px] bg-slate-50 z-20 min-w-[100px] text-slate-800 text-xl tracking-tighter text-center font-black font-black">姓名</th>
                    {sortedVisibleHeaders.map((h) => (
                      <th key={h.id} className={`p-3 border-b border-r border-slate-100 min-w-[90px] group relative font-black ${h.type === 'exam' ? 'bg-indigo-50/30' : h.type === 'bonus' ? 'bg-emerald-50/30' : ''}`}>
                        <div className="flex flex-col items-center gap-1 font-black">
                          <div className="flex items-center gap-1 font-black"><span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black text-white ${h.type === 'exam' ? 'bg-indigo-600' : h.type === 'bonus' ? 'bg-emerald-600' : 'bg-slate-400 font-black'}`}>{h.type.slice(0,1).toUpperCase()}</span><button onClick={()=> { setQRTarget({ year: academicYear, semester: semester, class: currentClass, examId: h.id, examName: h.name, teacherUid: user.uid }); setIsQRModalOpen(true); }} className="text-indigo-500 hover:scale-125 no-export font-black"><QrCode size={14}/></button></div>
                          <textarea value={h.name} onChange={(e) => handleUpdateHeaderName(h.id, e.target.value)} rows={2} className="w-full text-center text-sm font-black bg-transparent border-none outline-none rounded py-0.5 hover:bg-white focus:bg-white resize-none font-black font-black" />
                          <div className="flex gap-2 no-export font-black font-black">{(h.type === 'quiz' || h.type === 'bonus') && <button onClick={() => handleDeleteColumn(h.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 font-black"><Trash2 size={12} /></button>}{h.type !== 'bonus' && <button onClick={() => toggleHeaderLock(h.id)} className={`${h.isLocked ? 'text-orange-500 scale-110' : 'text-slate-300'} font-black font-black`}>{h.isLocked ? <Lock size={10} fill="currentColor" /> : <Unlock size={10} />}</button>}</div>
                        </div>
                      </th>
                    ))}
                    <th className="p-3 border-b border-r border-slate-100 bg-slate-50 text-slate-400 font-black w-24 text-center text-[10px] font-black">平時平均</th>
                    <th className="p-3 border-b border-slate-100 bg-indigo-600 text-white font-black w-32 text-center text-[10px] tracking-tight font-black font-black font-black">學期總成績</th>
                  </tr>
                </thead>
                <tbody>
                  {studentList.map((s, sIdx) => {
                    const res = calculationResults[s.id] || { quizAvg: 0, semesterTotal: 0, usedIds: [], actualQuizCount: 0 };
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors group font-black text-slate-800 font-black">
                        <td className="p-2 border-b border-r border-slate-50 sticky left-0 bg-white z-10 text-center font-mono text-blue-500 font-bold group-hover:bg-slate-50 font-black">{s.no}</td>
                        <td className="p-2 border-b border-r border-slate-50 sticky left-[40px] bg-white z-10 font-black text-xl whitespace-nowrap font-mono tracking-tighter group-hover:bg-slate-50 font-black font-black">{s.name}</td>
                        {sortedVisibleHeaders.map((h) => {
                          const isUsed = h.type === 'exam' || h.type === 'bonus' || res.usedIds.includes(h.id);
                          const rawVal = scores[s.id]?.[h.id];
                          const isEmpty = rawVal === undefined || rawVal === '';
                          let displayVal = rawVal; let isAutoZeroed = false;
                          if (isEmpty && h.type === 'quiz' && (isPaddingZero && pickBestCount > res.actualQuizCount)) { displayVal = '0'; isAutoZeroed = true; }
                          return (
                            <td key={h.id} className={`p-1 border-b border-r border-slate-100 font-black ${isUsed || isAutoZeroed ? 'bg-indigo-50/20' : ''}`}>
                              <input type="number" value={displayVal ?? ''} data-row={sIdx} data-col={h.id} onChange={(e) => handleScoreChange(s.id, h.id, e.target.value)} onKeyDown={(e) => handleVerticalTab(e, sIdx, h.id)} className={`w-full h-11 text-center text-xl font-mono bg-transparent border-none outline-none rounded-lg font-black ${isAutoZeroed ? 'text-red-500 font-black animate-pulse font-black' : isUsed ? 'text-indigo-700 font-black font-black' : 'text-slate-400 opacity-70'} focus:ring-4 focus:ring-indigo-500/40 focus:bg-white font-black`} placeholder="--" />
                            </td>
                          );
                        })}
                        <td className="p-2 border-b border-r border-slate-50 bg-slate-50/50 text-center text-xl font-bold text-slate-400 font-mono tracking-tighter font-black font-black">{res.quizAvg}</td>
                        <td className="p-2 border-b border-slate-50 bg-indigo-50 text-center text-2xl font-black text-indigo-700 font-mono tracking-tighter font-black font-black">{res.semesterTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : <div className="bg-white/50 backdrop-blur-md rounded-[48px] p-20 text-center border-4 border-dashed border-slate-200 text-slate-300 font-black font-black font-black font-black"><Users size={64} className="mx-auto mb-4 opacity-50" /><h3 className="text-2xl font-black font-black">點選上方班級按鈕開始管理</h3></div>}
      </div>

      {isQRModalOpen && qrTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-start justify-center p-6 pt-24 font-black">
          <div className="bg-white rounded-[50px] p-10 max-w-lg w-full shadow-2xl relative font-black">
            <button onClick={()=>setIsQRModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 transition-colors p-2 font-black"><X size={32}/></button>
            <div className="text-center space-y-6 font-sans font-black font-black">
              <span className="bg-indigo-100 text-indigo-600 px-6 py-2 rounded-full text-lg font-black font-black">{qrTarget.class} 班專用</span>
              <h2 className="text-5xl font-black text-slate-900 leading-tight font-black">全班成績登錄</h2>
              <p className="text-slate-400 text-xl font-bold font-black font-black">登錄「<span className="text-indigo-600 font-black underline decoration-indigo-200 font-black">{qrTarget.examName}</span>」</p>
              <div className="bg-slate-50 p-10 rounded-[48px] border-8 border-white shadow-inner flex flex-col items-center font-black"><QRCodeSVG value={`${window.location.origin}${window.location.pathname}?uid=${qrTarget.teacherUid}&year=${qrTarget.year}&semester=${qrTarget.semester}&class=${encodeURIComponent(qrTarget.class)}&examId=${qrTarget.examId}&examName=${encodeURIComponent(qrTarget.examName)}`} size={300} level="H" includeMargin={true} /></div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

// --- 助教入口畫面 ---
function AssistantInputView({ teacherUid, year, semester, className, examId, customName }) {
  const [students, setStudents] = useState([]);
  const [localScores, setLocalScores] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); 
  const inputsRef = useRef([]);
  const classId = `${year}_${semester}_${className}`;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const mSnap = await getDoc(doc(db, `users/${teacherUid}/metadata`, classId));
        const sSnap = await getDoc(doc(db, `users/${teacherUid}/scores`, classId));
        if (mSnap.exists()) setStudents(mSnap.data().students);
        if (sSnap.exists()) setLocalScores(sSnap.data());
      } catch (err) { console.error("讀取失敗"); alert("無法讀取，請通知老師確認資料庫規則設定。"); }
      setIsLoading(false);
    };
    fetchData();
  }, [classId, teacherUid]);

  const updateScore = async (sid, val) => {
    const n = parseInt(val, 10);
    const scoreVal = isNaN(n) ? "" : Math.max(0, Math.min(100, n));
    setSaveStatus('saving');
    try {
      await setDoc(doc(db, `users/${teacherUid}/scores`, classId), { [sid]: { [examId]: scoreVal } }, { merge: true });
      setLocalScores(prev => ({ ...prev, [sid]: { ...prev[sid], [examId]: scoreVal } }));
      setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) { setSaveStatus('error'); alert("儲存失敗！"); }
  };

  if (isLoading) return <LoadingScreen text="正在同步雲端名單..." />;

  return (
    <div className="min-h-screen bg-indigo-600 p-4 font-sans font-black font-black font-black">
      <div className="max-w-md mx-auto bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 font-black font-black">
        <div className="bg-slate-900 p-10 text-center text-white relative font-black">
          {saveStatus === 'saving' && <div className="absolute top-4 right-4 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-black animate-pulse font-black">同步中...</div>}
          {saveStatus === 'saved' && <div className="absolute top-4 right-4 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-black font-black">已儲存</div>}
          <span className="text-indigo-400 font-black text-xs uppercase font-black">{year} 學年 第 {semester} 學期 {className} 班</span>
          <h1 className="text-2xl font-black mt-3 font-black font-black">{customName || "成績登錄"}</h1>
        </div>
        <div className="p-4 space-y-2 max-h-[65vh] overflow-y-auto bg-slate-50 font-black font-black">
          {students.map((s, idx) => (
            <div key={s.id} className="flex items-center justify-between p-4 bg-white rounded-3xl border border-slate-100 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 font-black">
              <div className="flex items-center gap-4 font-black"><span className="font-mono font-black text-indigo-500 text-xl font-black font-black">{s.no}</span><span className="font-bold text-slate-700 text-lg font-black font-black">{s.name}</span></div>
              <input type="number" defaultValue={localScores[s.id]?.[examId] ?? ""} ref={el => inputsRef.current[idx] = el} onBlur={(e) => updateScore(s.id, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { if (inputsRef.current[idx+1]) inputsRef.current[idx+1].focus(); else e.target.blur(); } }} className="w-24 h-14 text-center text-3xl font-black font-mono bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-black font-black font-black font-black" />
            </div>
          ))}
        </div>
        <div className="p-8 bg-white text-center font-black font-black">
          <button disabled={isFinalizing} onClick={() => { setIsFinalizing(true); setTimeout(() => { window.location.href = window.location.origin + window.location.pathname; }, 1200); }} className={`w-full py-4 text-white font-black rounded-3xl flex items-center justify-center gap-2 text-lg font-black ${isFinalizing ? 'bg-slate-400' : 'bg-indigo-600 hover:scale-105'}`}>
            {isFinalizing ? <Loader2 className="animate-spin" /> : <Send size={24}/>}
            {isFinalizing ? "正在進行最後存檔..." : "完成登錄"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CollapsiblePanel({ title, icon, isOpen, onToggle, children }) {
  return (
    <div className={`rounded-[24px] overflow-hidden transition-all duration-300 ${isOpen ? 'bg-white shadow-xl ring-1 ring-slate-200' : 'bg-slate-900 shadow-lg hover:bg-black font-black font-black font-black'}`}>
      <button onClick={onToggle} className={`w-full p-5 flex items-center justify-between ${isOpen ? 'text-slate-800' : 'text-white'} font-black`}>
        <div className="flex items-center gap-3 font-black"><span className="font-bold text-lg font-black font-black">{title}</span></div>
        {isOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
      </button>
      {isOpen && children}
    </div>
  );
}

function LoadingScreen({ text }) { return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans font-black font-black font-black"><div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4 font-black"></div><p className="text-indigo-600 font-black italic font-black font-black font-black">{text}</p></div>; }
function LoginScreen({ onLogin }) { return <div className="min-h-screen bg-[#cbd5e1] flex items-center justify-center p-6 font-black font-black"><div className="max-w-xl w-full bg-white rounded-[50px] shadow-2xl p-12 text-center space-y-8 animate-in fade-in zoom-in font-black font-black font-black"> <div className="w-24 h-24 bg-indigo-600 rounded-[35px] flex items-center justify-center mx-auto shadow-xl font-black font-black"> <GraduationCap size={48} className="text-white font-black font-black" /> </div> <div><h1 className="text-5xl font-black text-slate-900 tracking-tighter font-black font-black font-black font-black">成績管理中心</h1><p className="text-slate-400 font-bold mt-3 text-lg font-black font-black">智慧計分與雲端管理系統</p></div> <button onClick={onLogin} className="w-full py-5 bg-white border-2 border-slate-200 rounded-[30px] font-black text-xl flex items-center justify-center gap-4 hover:border-indigo-500 transition-all shadow-sm font-black font-black font-black font-black"> <img src="https://www.google.com/favicon.ico" className="w-6 h-6 font-black font-black font-black" alt="google" /> Google 帳號登入 </button> </div> </div>; }
function OnboardingScreen({ user, onComplete }) { const [formData, setFormData] = useState({ city: '臺北市', level: '高中', schoolName: '' }); const [loading, setLoading] = useState(false); const cities = ["臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市", "基隆市", "新竹市", "嘉義市", "新竹縣", "苗栗縣", "彰化縣", "南投縣", "雲林縣", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣"]; const levels = ["國小", "國中", "高中", "高職", "大專院校", "其他"]; const handleSubmit = async (e) => { e.preventDefault(); setLoading(true); const profile = { ...formData, email: user.email, displayName: user.displayName, completedAt: new Date() }; await setDoc(doc(db, "users", user.uid), profile); onComplete(profile); }; return <div className="min-h-screen bg-indigo-600 flex items-center justify-center p-6 font-black font-black font-black"><div className="max-w-lg w-full bg-white rounded-[50px] shadow-2xl p-10 space-y-8 font-black font-black font-black font-black"><div className="text-center font-black font-black font-black font-black"><h2 className="text-3xl font-black text-slate-800 font-black font-black">完善教師資訊</h2></div><form onSubmit={handleSubmit} className="space-y-6 font-black font-black"><div className="grid grid-cols-2 gap-4 font-black font-black"><div className="space-y-2 font-black font-black"><label className="text-xs font-black text-slate-400 font-black">縣市</label><select value={formData.city} onChange={(e)=>setFormData({...formData, city: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl ring-2 ring-slate-100 font-bold outline-none font-black font-black">{cities.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div className="space-y-2 font-black font-black font-black"><label className="text-xs font-black text-slate-400 font-black font-black">學制</label><select value={formData.level} onChange={(e)=>setFormData({...formData, level: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl ring-2 ring-slate-100 font-bold outline-none font-black font-black">{levels.map(l => <option key={l} value={l}>{l}</option>)}</select></div></div><div className="space-y-2 font-black font-black font-black font-black font-black"><label className="text-xs font-black text-slate-400 font-black font-black">學校名稱</label><input required type="text" placeholder="例如：建國中學" value={formData.schoolName} onChange={(e)=>setFormData({...formData, schoolName: e.target.value})} className="w-full p-5 bg-slate-50 rounded-2xl ring-2 ring-slate-100 font-bold outline-none font-black font-black font-black" /></div><button disabled={loading} type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-[30px] font-black text-xl shadow-xl font-black font-black font-black">{loading ? "建立中..." : "進入系統"}</button></form></div></div>; }

export default App;