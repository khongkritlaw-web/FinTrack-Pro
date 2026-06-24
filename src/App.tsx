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
  fetchPublicExpenses,
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
import seedExpenses from './data/seedExpenses.json';

const SEED_EXPENSES: Expense[] = seedExpenses as Expense[];

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
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
        setUser(null);
        setToken(null);
        setNeedsAuth(false); // Enable Guest / Local storage mode immediately
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

  const loadDefaultSeedData = useCallback(() => {
    setExpenses(SEED_EXPENSES);
    localStorage.setItem('fintrack_expenses', JSON.stringify(SEED_EXPENSES));
  }, []);

  // Load from LocalStorage
  useEffect(() => {
    const stored = localStorage.getItem('fintrack_expenses');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // If they have old cached data with fewer than 100 installments, upgrade them to the new 132-installment dataset automatically.
        if (parsed && parsed.length >= 100) {
          setExpenses(parsed);
        } else {
          loadDefaultSeedData();
        }
      } catch (e) {
        loadDefaultSeedData();
      }
    } else {
      loadDefaultSeedData();
    }
  }, [loadDefaultSeedData]);



  // Create or Update Expense Row
  const handleSaveExpense = async (expenseData: Omit<Expense, 'id' | 'rowNumber'> & { id?: string; rowNumber?: number }) => {
    setIsLoading(true);
    try {
      // ALWAYS LOCAL MODE
      let updatedExpenses: Expense[] = [];
      if (expenseData.id) {
        // Update
        updatedExpenses = expenses.map(exp => 
          exp.id === expenseData.id 
            ? { ...exp, ...expenseData } as Expense
            : exp
        );
        setSuccessToast('อัปเดตข้อมูลเรียบร้อยแล้ว!');
      } else {
        // Add new
        const newExpense: Expense = {
          id: 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
          ...expenseData,
          rowNumber: expenses.length + 2
        } as Expense;
        updatedExpenses = [newExpense, ...expenses];
        setSuccessToast('เพิ่มรายการชำระเงินเรียบร้อยแล้ว!');
      }
      setExpenses(updatedExpenses);
      localStorage.setItem('fintrack_expenses', JSON.stringify(updatedExpenses));
    } catch (err: any) {
      console.error('Save failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Expense Row (User Confirmation Mandatory)
  const handleDeleteExpense = async (expense: Expense) => {
    const confirmed = window.confirm(
      `คุณต้องการลบรายการ "${expense.title}" (จำนวนเงิน ${expense.amount.toLocaleString()} บาท) ใช่หรือไม่?\nการดำเนินการนี้ไม่สามารถย้อนกลับได้`
    );

    if (!confirmed) return;

    setIsLoading(true);
    try {
      // ALWAYS LOCAL MODE
      const updatedExpenses = expenses.filter(exp => exp.id !== expense.id);
      setExpenses(updatedExpenses);
      localStorage.setItem('fintrack_expenses', JSON.stringify(updatedExpenses));
      setSuccessToast('ลบรายการสำเร็จ!');
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
            <div className="bg-emerald-500/20 p-2.5 rounded-xl border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <Wallet className="text-emerald-400" size={22} />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight uppercase tracking-tight">FinTrack Umar+</h1>
              <p className="text-xs text-zinc-400">ระบบติดตามและตรวจสอบค่างวดรายเดือน</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Account Details */}
            <div className="flex items-center gap-3 pl-3 border-[#27272a]">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                ผู้รับผิดชอบ: พ่อ & ต้อ
              </div>
              <div className="bg-zinc-800 border border-zinc-700 p-2 rounded-xl text-xs text-zinc-300 font-semibold">
                บัญชี: บัตรเครดิต
              </div>
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

        {/* Action / Title bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-zinc-500 font-medium font-mono uppercase tracking-wider">ภาพรวมระบบค่างวด</div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 mt-0.5">
              แดชบอร์ดติดตามค่างวด (ทั้งหมด {expenses.length} งวด)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                if (window.confirm(`คุณต้องการรีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้นจาก Google Sheet (${expenses.length} งวด) ใช่หรือไม่?\nข้อมูลที่แก้ไขทั้งหมดบนเว็บจะถูกล้างทิ้ง`)) {
                  loadDefaultSeedData();
                  setSuccessToast('รีเซ็ตข้อมูลค่างวดกลับเป็นค่าเริ่มต้นจาก Google Sheet แล้ว!');
                }
              }}
              className="flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>รีเซ็ตข้อมูลเริ่มต้น</span>
            </button>

            <button
              onClick={handleAddNewClick}
              className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 text-emerald-950 font-bold px-5 py-3 rounded-2xl text-sm transition-all hover:scale-[1.01] cursor-pointer shadow-lg"
            >
              <Plus size={16} />
              <span>เพิ่มรายการใหม่</span>
            </button>
          </div>
        </div>

        {/* Dashboard visuals section */}
        <Dashboard expenses={expenses} />

        {/* Sheet instructions Info callout */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-start gap-3 shadow-md shadow-emerald-500/2">
          <Info className="shrink-0 mt-0.5 text-emerald-400" size={18} />
          <div className="text-xs leading-relaxed text-zinc-300">
            <strong>คำแนะนำในการใช้งาน:</strong> ระบบบันทึกข้อมูลและประมวลผลบนบราวเซอร์ในเครื่องของคุณโดยตรง (ไม่ต้องเชื่อมต่อ Google Sheets ใดๆ) คุณสามารถบันทึกสลิปหลักฐาน, อัปเดตสถานะการชำระเงิน, แก้ไขหมายเหตุ, หรือลบแถวแต่ละรายการได้อย่างอิสระทันที ข้อมูลของคุณจะปลอดภัยในพื้นที่เก็บข้อมูลเครื่องนี้
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
