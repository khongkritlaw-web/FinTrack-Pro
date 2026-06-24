import { useState, useMemo } from 'react';
import { Expense, CATEGORIES } from '../types';
import {
  Search,
  Filter,
  CheckCircle,
  Clock,
  Trash2,
  Edit2,
  FileText,
  AlertCircle,
  RefreshCw,
  FolderOpen
} from 'lucide-react';

interface ExpenseListProps {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => Promise<void>;
  isLoading: boolean;
}

export default function ExpenseList({
  expenses,
  onEdit,
  onDelete,
  isLoading
}: ExpenseListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [selectedStatus, setSelectedStatus] = useState<'ทั้งหมด' | 'ชำระแล้ว' | 'ยังไม่ชำระ'>('ทั้งหมด');
  const [selectedMonth, setSelectedMonth] = useState('ทั้งหมด');

  // Format currency helpers
  const formatBaht = (value: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value);
  };

  // Get available months from expenses for filtering
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    expenses.forEach((exp) => {
      if (exp.date) {
        const monthYear = exp.date.slice(0, 7); // YYYY-MM
        if (monthYear) monthsSet.add(monthYear);
      }
    });
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  // Map YYYY-MM to readable Thai month
  const formatThaiMonthYear = (val: string) => {
    if (!val || val === 'ทั้งหมด') return 'ทั้งหมด';
    const [year, month] = val.split('-');
    const monthNames = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const thMonth = monthNames[parseInt(month, 10) - 1] || month;
    const thYear = parseInt(year, 10) + 543; // Buddhist Era
    return `${thMonth} ${thYear}`;
  };

  // Real-time Search and Filter logic
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // 1. Search filter (instantly matches title, category, note, id)
      const matchesSearch =
        exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        exp.id.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Category filter
      const matchesCategory = selectedCategory === 'ทั้งหมด' || exp.category === selectedCategory;

      // 3. Status filter
      const matchesStatus = selectedStatus === 'ทั้งหมด' || exp.status === selectedStatus;

      // 4. Month filter
      const matchesMonth = selectedMonth === 'ทั้งหมด' || (exp.date && exp.date.startsWith(selectedMonth));

      return matchesSearch && matchesCategory && matchesStatus && matchesMonth;
    });
  }, [expenses, searchTerm, selectedCategory, selectedStatus, selectedMonth]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('ทั้งหมด');
    setSelectedStatus('ทั้งหมด');
    setSelectedMonth('ทั้งหมด');
  };

  return (
    <div className="bg-[#121214] border border-[#27272a] rounded-3xl p-6 shadow-xl space-y-6">
      
      {/* Search and Filters Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Search Input (instant reaction) */}
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาค่าใช้จ่าย เช่น ค่าไฟ, ทานข้าว..."
            className="w-full bg-[#18181b] border border-[#27272a] rounded-2xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-zinc-600 transition-all font-sans"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-3.5 text-xs text-zinc-400 hover:text-white"
            >
              ล้าง
            </button>
          )}
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Month selector */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">เดือน / ปี</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-[#18181b] border border-[#27272a] text-white rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ทั้งหมด">ทั้งหมดทุกช่วงเวลา</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatThaiMonthYear(m)}
                </option>
              ))}
            </select>
          </div>

          {/* Category Selector */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">หมวดหมู่</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#18181b] border border-[#27272a] text-white rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ทั้งหมด">ทั้งหมดทุกหมวดหมู่</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Status buttons */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">สถานะชำระเงิน</label>
            <div className="bg-[#18181b] border border-[#27272a] p-1 rounded-xl flex h-[38px]">
              {(['ทั้งหมด', 'ชำระแล้ว', 'ยังไม่ชำระ'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`flex-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    selectedStatus === st
                      ? st === 'ชำระแล้ว'
                        ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                        : st === 'ยังไม่ชำระ'
                        ? 'bg-rose-500/20 text-rose-400 font-bold'
                        : 'bg-emerald-500 text-emerald-950 font-bold'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Filter status summaries */}
      {(selectedCategory !== 'ทั้งหมด' || selectedStatus !== 'ทั้งหมด' || selectedMonth !== 'ทั้งหมด' || searchTerm) && (
        <div className="flex items-center justify-between bg-[#18181b] border border-[#27272a] px-4 py-2.5 rounded-xl text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-emerald-400" />
            <span>
              พบทั้งหมด <strong className="text-white">{filteredExpenses.length}</strong> รายการ จากการกรองข้อมูล
            </span>
          </div>
          <button onClick={resetFilters} className="text-emerald-400 hover:text-emerald-300 font-bold transition-all cursor-pointer">
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      )}

      {/* Data display */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400 space-y-3">
          <RefreshCw size={36} className="animate-spin text-emerald-500" />
          <p className="text-sm font-medium">กำลังโหลดข้อมูลและซิงค์กับ Google Sheet...</p>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 border border-dashed border-[#27272a] rounded-3xl bg-[#0d0d0f]/10">
          <FolderOpen size={44} className="stroke-1 text-zinc-600 mb-2.5" />
          <p className="text-sm font-semibold">ไม่พบรายการค่าใช้จ่ายที่ตรงตามเงื่อนไข</p>
          <p className="text-xs text-zinc-600 mt-1">ลองล้างตัวกรองหรือเพิ่มรายการใหม่เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-[#27272a]">
            <table className="w-full text-left border-collapse text-sm text-zinc-300">
              <thead className="bg-[#0d0d0f]/60 text-zinc-400 text-xs font-semibold uppercase border-b border-[#27272a]">
                <tr>
                  <th className="px-5 py-4">วันที่</th>
                  <th className="px-5 py-4">รายการค่าใช้จ่าย</th>
                  <th className="px-5 py-4">หมวดหมู่</th>
                  <th className="px-5 py-4 text-right">จำนวนเงิน</th>
                  <th className="px-5 py-4 text-center">สถานะ</th>
                  <th className="px-5 py-4">สลิปหลักฐาน</th>
                  <th className="px-5 py-4">หมายเหตุ</th>
                  <th className="px-5 py-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a] bg-[#121214]/20">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#18181b]/60 transition-colors">
                    
                    {/* Date */}
                    <td className="px-5 py-4 font-mono text-xs whitespace-nowrap">
                      {exp.date ? new Date(exp.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
                    </td>

                    {/* Title */}
                    <td className="px-5 py-4 font-semibold text-white max-w-[200px] truncate" title={exp.title}>
                      {exp.title}
                    </td>

                    {/* Category */}
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        {exp.category}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-4 text-right font-bold text-white font-mono">
                      {formatBaht(exp.amount)}
                    </td>

                    {/* Status badge */}
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      {exp.status === 'ชำระแล้ว' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-bold border border-emerald-500/20">
                          <CheckCircle size={12} />
                          ชำระแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 text-xs px-2.5 py-1 rounded-full font-bold border border-rose-500/20">
                          <Clock size={12} />
                          ยังไม่ชำระ
                        </span>
                      )}
                    </td>

                    {/* Receipt link */}
                    <td className="px-5 py-4">
                      {exp.receiptUrl ? (
                        <a
                          href={exp.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 hover:underline font-semibold cursor-pointer"
                        >
                          <FileText size={14} />
                          สลิปหลักฐาน
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-600">-</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-5 py-4 text-zinc-400 max-w-[160px] truncate" title={exp.notes}>
                      {exp.notes || '-'}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onEdit(exp)}
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-lg transition-all cursor-pointer"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => onDelete(exp)}
                          className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                          title="ลบรายการ"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card-Based View */}
          <div className="block md:hidden space-y-4">
            {filteredExpenses.map((exp) => (
              <div
                key={exp.id}
                className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 space-y-3 shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase">{exp.category}</span>
                    <h5 className="font-bold text-white text-base leading-tight">{exp.title}</h5>
                  </div>
                  <span className="font-bold text-white text-lg font-mono">{formatBaht(exp.amount)}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-[#27272a]/60">
                  <span className="font-mono">{exp.date ? new Date(exp.date).toLocaleDateString('th-TH') : '-'}</span>
                  
                  {exp.status === 'ชำระแล้ว' ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">
                      ชำระแล้ว
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-rose-500/20">
                      ยังไม่ชำระ
                    </span>
                  )}
                </div>

                {exp.notes && (
                  <p className="text-xs text-zinc-400 bg-[#0d0d0f]/40 p-2 rounded-lg italic border border-[#27272a]/50">
                    {exp.notes}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div>
                    {exp.receiptUrl ? (
                      <a
                        href={exp.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-400 font-bold hover:underline cursor-pointer"
                      >
                        <FileText size={13} />
                        ดูสลิปหลักฐาน
                      </a>
                    ) : (
                      <span className="text-[11px] text-zinc-600">ไม่มีสลิปหลักฐาน</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEdit(exp)}
                      className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-[#27272a]/60 transition-all cursor-pointer"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(exp)}
                      className="p-2 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  );
}
