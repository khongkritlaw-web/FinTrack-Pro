import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, googleSignOut } from './firebase';
import {
  fetchSpreadsheetMetadata,
  fetchExpenses,
  addExpenseRow,
  updateExpenseRow,
  deleteExpenseRow,
  DEFAULT_SPREADSHEET_ID,
  SheetMetadata
} from './googleApi';
import { Expense } from './types';
import Dashboard from './components/Dashboard';
import ExpenseList from './components/ExpenseList';
import ExpenseForm from './components/ExpenseForm';
import {
  LogOut,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  Settings,
  HelpCircle,
  Database,
  ExternalLink,
  Wallet,
  AlertTriangle,
  Sparkles,
  Info
} from 'lucide-react';

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Spreadsheet state
  const [spreadsheetId, setSpreadsheetId] = useState(DEFAULT_SPREADSHEET_ID);
  const [sheetMetadata, setSheetMetadata] = useState<SheetMetadata | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // UI / Logic States
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [appError, setAppError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  // Auto-hide success toast after 4 seconds
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Auth State Listener
  useEffect(() => {
    initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(true);
      }
    );
  }, []);

  // Fetch data function
  const syncWithGoogleSheet = useCallback(async (activeToken: string, activeId: string) => {
    if (!activeToken) return;
    setIsSyncing(true);
    setAppError('');

    try {
      // 1. Fetch metadata to get dynamic tab titles and sheet ID matching GID
      const meta = await fetchSpreadsheetMetadata(activeId, activeToken);
      setSheetMetadata(meta);

      // 2. Fetch the actual expense rows
      const records = await fetchExpenses(activeId, meta.title, activeToken);
      setExpenses(records);
    } catch (err: any) {
      console.error('Sync failed:', err);
      setAppError(
        'ไม่สามารถเชื่อมต่อ Google Sheets ได้: ' +
        (err.message || 'โปรดตรวจสอบสิทธิ์การเข้าถึงหรือ Spreadsheet ID ของคุณ')
      );
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Trigger sync on login or spreadsheet ID change
  useEffect(() => {
    if (token && spreadsheetId) {
      syncWithGoogleSheet(token, spreadsheetId);
    }
  }, [token, spreadsheetId, syncWithGoogleSheet]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAppError('');
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        setSuccessToast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ!');
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setAppError('เข้าสู่ระบบไม่สำเร็จ: ' + (err.message || ''));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
      await googleSignOut();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setExpenses([]);
      setSheetMetadata(null);
    }
  };

  // Create or Update Expense Row
  const handleSaveExpense = async (expenseData: Omit<Expense, 'id' | 'rowNumber'> & { id?: string; rowNumber?: number }) => {
    if (!token || !sheetMetadata) {
      setAppError('กรุณาเข้าสู่ระบบก่อนดำเนินการ');
      return;
    }

    setIsLoading(true);
    try {
      if (expenseData.id && expenseData.rowNumber) {
        // Update operation
        const updatedExpense: Expense = {
          id: expenseData.id,
          rowNumber: expenseData.rowNumber,
          date: expenseData.date,
          title: expenseData.title,
          category: expenseData.category,
          amount: expenseData.amount,
          status: expenseData.status,
          payDate: expenseData.payDate,
          receiptUrl: expenseData.receiptUrl,
          notes: expenseData.notes
        };

        await updateExpenseRow(spreadsheetId, sheetMetadata.title, updatedExpense, token);
        setSuccessToast('อัปเดตข้อมูลค่าใช้จ่ายเรียบร้อยแล้ว!');
      } else {
        // Add new operation
        await addExpenseRow(spreadsheetId, sheetMetadata.title, expenseData, token);
        setSuccessToast('เพิ่มรายการค่าใช้จ่ายใหม่เรียบร้อยแล้ว!');
      }

      // Re-fetch data to sync
      await syncWithGoogleSheet(token, spreadsheetId);
    } catch (err: any) {
      console.error('Save failed:', err);
      throw err; // Form component will handle error message display
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Expense Row (User Confirmation Mandatory)
  const handleDeleteExpense = async (expense: Expense) => {
    if (!token || !sheetMetadata) return;

    // MANDATORY explicit confirmation per workspace integration skill rules
    const confirmed = window.confirm(
      `คุณต้องการลบรายการ "${expense.title}" (จำนวนเงิน ${expense.amount.toLocaleString()} บาท) ออกจาก Google Sheets ใช่หรือไม่?\nการดำเนินการนี้ไม่สามารถย้อนกลับได้`
    );

    if (!confirmed) return;

    setIsLoading(true);
    try {
      if (expense.rowNumber) {
        await deleteExpenseRow(spreadsheetId, sheetMetadata.sheetId, expense.rowNumber, token);
        setSuccessToast('ลบรายการค่าใช้จ่ายสำเร็จ!');
        await syncWithGoogleSheet(token, spreadsheetId);
      }
    } catch (err: any) {
      console.error('Delete failed:', err);
      setAppError('ไม่สามารถลบรายการได้: ' + (err.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (expense: Expense) => {
    setEditingExpense(expense);
    setShowForm(true);
  };

  const handleAddNewClick = () => {
    setEditingExpense(null);
    setShowForm(true);
  };

  // Welcome / Login Screen
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] text-[#e4e4e7] flex flex-col justify-between p-6 md:p-12 relative overflow-hidden font-sans">
        {/* Abstract blur background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Top Navbar */}
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-500/20 p-2.5 rounded-2xl border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <Wallet className="text-emerald-400" size={24} />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent uppercase">
              FinTrack Pro
            </span>
          </div>
          <div className="text-xs text-zinc-500 font-medium font-mono">v1.1.0</div>
        </div>

        {/* Main Content Card */}
        <div className="max-w-md w-full mx-auto my-auto z-10 bg-[#121214] border border-[#27272a] p-8 rounded-3xl shadow-2xl text-center space-y-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 text-xs px-3.5 py-1.5 rounded-full font-bold">
              <Sparkles size={12} />
              ระบบบันทึกรายรับ-รายจ่ายเชื่อมกับ Google Sheets
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight leading-tight">
              จัดการค่าใช้จ่ายของคุณ <br />
              <span className="text-emerald-400">ให้เป็นระเบียบและโปร่งใส</span>
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">
              บันทึกค่าใช้จ่ายรายเดือนพร้อมสลิปหลักฐาน จัดเก็บเข้าสู่ Google Sheet ของคุณโดยตรง ปลอดภัย และตรวจสอบย้อนหลังได้ทุกเมื่อ
            </p>
          </div>

          {/* Core Feature List badges */}
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="bg-[#18181b] border border-[#27272a]/50 p-3.5 rounded-2xl flex items-center gap-2.5">
              <FileSpreadsheet className="text-emerald-400 shrink-0" size={16} />
              <div className="text-xs">
                <p className="font-bold text-zinc-200">Google Sheet</p>
                <p className="text-zinc-500">ซิงค์บันทึกโดยตรง</p>
              </div>
            </div>
            <div className="bg-[#18181b] border border-[#27272a]/50 p-3.5 rounded-2xl flex items-center gap-2.5">
              <Database className="text-emerald-400 shrink-0" size={16} />
              <div className="text-xs">
                <p className="font-bold text-zinc-200">Google Drive</p>
                <p className="text-zinc-500">เก็บสลิปหลักฐาน</p>
              </div>
            </div>
          </div>

          {/* Standard Sign In with Google Button */}
          <div className="space-y-4">
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-[#0d0d0f] font-bold py-3.5 px-6 rounded-2xl shadow-xl hover:shadow-emerald-500/10 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? (
                <RefreshCw className="animate-spin text-[#0d0d0f]" size={18} />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
              )}
              <span>เข้าใช้งานด้วยบัญชี Google</span>
            </button>
            <p className="text-[10px] text-zinc-500 text-center">
              แอปพลิเคชันจะเชื่อมต่อกับ Google Sheet และ Google Drive ของคุณอย่างปลอดภัยเพื่อบันทึกข้อมูล
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-7xl w-full mx-auto text-center text-xs text-zinc-600 z-10 pt-4">
          © 2026 FinTrack Pro. พัฒนาขึ้นโดยเคารพสิทธิ์ความเป็นส่วนตัวสูงสุด
        </div>
      </div>
    );
  }

  // Logged-in application dashboard
  return (
    <div className="min-h-screen bg-[#0d0d0f] text-[#e4e4e7] flex flex-col font-sans pb-16">
      
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#121214] border border-emerald-500/40 text-emerald-300 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-up">
          <Sparkles className="text-emerald-400 animate-pulse shrink-0" size={18} />
          <span className="text-xs font-bold">{successToast}</span>
        </div>
      )}

      {/* Main Top Header */}
      <header className="border-b border-[#27272a] bg-[#121214] sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <Wallet className="text-emerald-400" size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight uppercase tracking-tight">FinTrack Pro</h1>
              <p className="text-xs text-zinc-400">ระบบบันทึกค่าใช้จ่ายรายเดือน</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            
            {/* Quick sync display */}
            <button
              onClick={() => token && syncWithGoogleSheet(token, spreadsheetId)}
              disabled={isSyncing}
              className={`p-2 rounded-xl bg-[#18181b] border border-[#27272a] text-zinc-300 transition-all hover:bg-[#27272a] ${
                isSyncing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
              title="ซิงค์ข้อมูลใหม่"
            >
              <RefreshCw size={16} className={isSyncing ? 'animate-spin text-emerald-400' : ''} />
            </button>

            {/* Config panel toggle */}
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`p-2 rounded-xl border transition-all ${
                showConfig 
                  ? 'bg-emerald-500 border-emerald-500 text-emerald-950 font-bold' 
                  : 'bg-[#18181b] border-[#27272a] text-zinc-300 hover:bg-[#27272a]'
              }`}
              title="ตั้งค่า Google Sheet"
            >
              <Settings size={16} />
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-3 pl-3 border-l border-[#27272a]">
              {user?.photoURL && (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-9 h-9 rounded-full border border-[#27272a] referrerPolicy=no-referrer"
                />
              )}
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-white max-w-[120px] truncate">
                  {user?.displayName || 'ผู้ใช้งาน'}
                </p>
                <p className="text-[10px] text-zinc-500 truncate max-w-[120px]">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                title="ออกจากระบบ"
              >
                <LogOut size={16} />
              </button>
            </div>

          </div>

        </div>
      </header>

      {/* Main Container body */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8 flex-1">
        
        {/* Error notification */}
        {appError && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-4 rounded-2xl flex items-start gap-3 shadow">
            <AlertTriangle className="shrink-0 mt-0.5 text-rose-400" size={18} />
            <div className="text-xs space-y-1">
              <p className="font-bold">เกิดข้อผิดพลาดในการดึงข้อมูล</p>
              <p className="text-zinc-400 leading-relaxed">{appError}</p>
            </div>
          </div>
        )}

        {/* Configuration settings panel */}
        {showConfig && (
          <div className="bg-[#121214] border border-[#27272a] p-6 rounded-3xl space-y-4 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Settings size={16} className="text-emerald-400" />
                กำหนดค่า Google Spreadsheet ปลายทาง
              </h3>
              <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded">
                เชื่อมต่ออยู่
              </span>
            </div>
            
            <p className="text-xs text-zinc-400 leading-relaxed">
              โดยปกติระบบจะอ่าน/เขียนข้อมูลใน Spreadsheet เริ่มต้นที่คุณกำหนดมาในความต้องการ 
              คุณสามารถแก้ไข Spreadsheet ID เป็นลิงก์ชีทอื่นของคุณได้ทันทีเพื่อสลับฐานข้อมูลบันทึก
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-zinc-400">Google Spreadsheet ID หรือ ลิงก์เต็ม</label>
                <input
                  type="text"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  placeholder="กรอก ID ของชีท หรือ ลิงก์ URL ของชีท"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder-zinc-600 font-mono"
                />
              </div>
              <button
                onClick={() => token && syncWithGoogleSheet(token, spreadsheetId)}
                disabled={isSyncing}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-bold h-[38px] px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                ซิงค์ชีทใหม่
              </button>
            </div>

            {sheetMetadata && (
              <div className="bg-[#0d0d0f] p-4 rounded-2xl border border-[#27272a] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-emerald-400" />
                  <div>
                    <span className="text-zinc-400">หน้าชีทที่เลือกบันทึกปัจจุบัน: </span>
                    <strong className="text-white">"{sheetMetadata.title}"</strong>
                    <span className="text-zinc-500 font-mono"> (GID: {sheetMetadata.sheetId})</span>
                  </div>
                </div>
                <a
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetMetadata.sheetId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 hover:underline font-bold"
                >
                  เปิดชีทตรวจสอบโดยตรง
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Action / Title bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-zinc-500 font-medium font-mono uppercase tracking-wider">ภาพรวมกระดานควบคุม</div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 mt-0.5">
              แดชบอร์ดค่าใช้จ่ายประจำเดือน
              {isSyncing && <RefreshCw size={16} className="animate-spin text-emerald-500" />}
            </h2>
          </div>

          <button
            onClick={handleAddNewClick}
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 text-emerald-950 font-bold px-6 py-3 rounded-2xl text-sm transition-all hover:scale-[1.01] cursor-pointer shadow-lg"
          >
            <Plus size={16} />
            <span>เพิ่มรายการค่าใช้จ่าย</span>
          </button>
        </div>

        {/* Dashboard visuals section */}
        <Dashboard expenses={expenses} />

        {/* Sheet instructions Info callout */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-start gap-3 shadow-md shadow-emerald-500/2">
          <Info className="shrink-0 mt-0.5 text-emerald-400" size={18} />
          <div className="text-xs leading-relaxed text-zinc-300">
            <strong>คำแนะนำ:</strong> ค่าใช้จ่ายทั้งหมดจะจัดเก็บในแถวของชีท 
            <strong className="text-emerald-400"> "{sheetMetadata?.title || 'Expense_Sheet'}" </strong> 
            โดยอัตโนมัติ สลิปหลักฐานจะถูกเก็บลงในโฟลเดอร์ <strong>"Expense_Receipts"</strong> บน Google Drive ของคุณ 
            และสร้างลิงก์สำหรับตรวจสอบเพื่อให้แชร์ได้ง่ายขึ้น
          </div>
        </div>

        {/* Main interactive records section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white">ประวัติรายการและตัวตรวจสอบค่าใช้จ่าย</h3>
            <p className="text-xs text-slate-400">ค้นหา กรองสถานะ และอัปเดตสลิปหลักฐานได้อย่างง่ายดาย</p>
          </div>

          <ExpenseList
            expenses={expenses}
            onEdit={handleEditClick}
            onDelete={handleDeleteExpense}
            isLoading={isSyncing}
          />
        </div>

      </main>

      {/* Form Dialog Modal */}
      {showForm && (
        <ExpenseForm
          expense={editingExpense}
          onSave={handleSaveExpense}
          onClose={() => setShowForm(false)}
          googleAccessToken={token}
        />
      )}
    </div>
  );
}
