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
  const [selectedOwner, setSelectedOwner] = useState<string>('ทั้งหมด');

  // Dynamic unique categories and owners from loaded expenses
  const dynamicCategories = useMemo(() => {
    const cats = new Set<string>();
    expenses.forEach((e) => {
      if (e.category) cats.add(e.category);
    });
    return Array.from(cats).sort();
  }, [expenses]);

  const dynamicOwners = useMemo(() => {
    const owners = new Set<string>();
    expenses.forEach((e) => {
      if (e.owner) owners.add(e.owner);
    });
    return Array.from(owners).sort();
  }, [expenses]);

  // Format currency helpers
  const formatBaht = (value: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value);
  };

  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return '-';
    // If it's in D/M/YYYY (Buddhist Year) format like 1/7/2569
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);
        
        const thaiMonthsShort = [
          'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
          'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
        ];
        const monthName = thaiMonthsShort[month - 1] || `${month}`;
        
        // If year is Gregorian (e.g. 2026), convert to Buddhist Era (2569) for presentation consistency
        if (year < 2400) {
          year += 543;
        }
        return `${day} ${monthName} ${year}`;
      }
    }

    // Fallback to standard parsing
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    } catch (e) {}

    return dateStr;
  };

  const getOwnerBadgeClass = (ownerName?: string) => {
    const o = ownerName || 'ทั่วไป';
    if (o === 'พ่อ') return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
    if (o === 'ต้อ') return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    if (o === 'กมล') return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    if (o.includes('พ่อ') && o.includes('ต้อ')) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    return 'bg-pink-500/10 text-pink-400 border border-pink-500/20';
  };

  // Get available months from expenses for filtering
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    expenses.forEach((exp) => {
      if (exp.date) {
        if (exp.date.includes('/')) {
          const parts = exp.date.split('/');
          if (parts.length === 3) {
            // E.g., "1/7/2569" -> Month/Year key "7/2569"
            monthsSet.add(`${parts[1]}/${parts[2]}`);
          }
        } else {
          const monthYear = exp.date.slice(0, 7); // YYYY-MM
          if (monthYear) monthsSet.add(monthYear);
        }
      }
    });
    return Array.from(monthsSet);
  }, [expenses]);

  // Map to readable Thai month
  const formatThaiMonthYear = (val: string) => {
    if (!val || val === 'ทั้งหมด') return 'ทั้งหมด';
    
    const monthNames = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    if (val.includes('/')) {
      const [month, year] = val.split('/');
      const mIdx = parseInt(month, 10) - 1;
      return `${monthNames[mIdx] || month} ${year}`;
    }

    const [year, month] = val.split('-');
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
      let matchesMonth = selectedMonth === 'ทั้งหมด';
      if (!matchesMonth && exp.date) {
        if (selectedMonth.includes('/')) {
          const parts = exp.date.split('/');
          if (parts.length === 3) {
            matchesMonth = `${parts[1]}/${parts[2]}` === selectedMonth;
          }
        } else {
          matchesMonth = exp.date.startsWith(selectedMonth);
        }
      }

      // 5. Owner filter
      const matchesOwner = selectedOwner === 'ทั้งหมด' || exp.owner === selectedOwner;

      return matchesSearch && matchesCategory && matchesStatus && matchesMonth && matchesOwner;
    });
  }, [expenses, searchTerm, selectedCategory, selectedStatus, selectedMonth, selectedOwner]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('ทั้งหมด');
    setSelectedStatus('ทั้งหมด');
    setSelectedMonth('ทั้งหมด');
    setSelectedOwner('ทั้งหมด');
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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          
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
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">บัญชี / บัตร</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#18181b] border border-[#27272a] text-white rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ทั้งหมด">ทั้งหมดทุกบัญชี</option>
              {dynamicCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Owner selector */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">ผู้รับผิดชอบ</label>
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="bg-[#18181b] border border-[#27272a] text-white rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ทั้งหมด">ทั้งหมดทุกคน</option>
              {dynamicOwners.map((ownerName) => (
                <option key={ownerName} value={ownerName}>
                  {ownerName}
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
      {(selectedCategory !== 'ทั้งหมด' || selectedStatus !== 'ทั้งหมด' || selectedMonth !== 'ทั้งหมด' || selectedOwner !== 'ทั้งหมด' || searchTerm) && (
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
                  <th className="px-5 py-4 text-center">งวด</th>
                  <th className="px-5 py-4 text-center">ผู้รับผิดชอบ</th>
                  <th className="px-5 py-4">เดือน / กำหนดชำระ</th>
                  <th className="px-5 py-4 text-right">ค่างวด</th>
                  <th className="px-5 py-4 text-right">ชำระมา</th>
                  <th className="px-5 py-4 text-right">คงเหลือ</th>
                  <th className="px-5 py-4 text-center">สถานะ</th>
                  <th className="px-5 py-4 text-center">หลักฐาน</th>
                  <th className="px-5 py-4">หมายเหตุ</th>
                  <th className="px-5 py-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a] bg-[#121214]/20">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#18181b]/60 transition-colors">
                    
                    {/* Installment No */}
                    <td className="px-5 py-4 font-mono font-bold text-center text-emerald-400">
                      {exp.installmentNo || '-'}
                    </td>

                    {/* Owner */}
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold ${getOwnerBadgeClass(exp.owner)}`}>
                        {exp.owner || 'ทั่วไป'}
                      </span>
                    </td>

                    {/* Due Date */}
                    <td className="px-5 py-4 font-sans font-medium text-white whitespace-nowrap">
                      {formatThaiDate(exp.date)}
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-4 text-right font-bold text-white font-mono">
                      {formatBaht(exp.amount)}
                    </td>

                    {/* Amount Paid */}
                    <td className="px-5 py-4 text-right font-bold text-emerald-400 font-mono">
                      {formatBaht(exp.amountPaid !== undefined ? exp.amountPaid : (exp.status === 'ชำระแล้ว' ? exp.amount : 0))}
                    </td>

                    {/* Amount Remaining */}
                    <td className="px-5 py-4 text-right font-bold text-rose-400 font-mono">
                      {formatBaht(exp.amountRemaining !== undefined ? exp.amountRemaining : (exp.status === 'ยังไม่ชำระ' ? exp.amount : 0))}
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
                    <td className="px-5 py-4 text-center">
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
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase">งวดที่ {exp.installmentNo || '-'}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${getOwnerBadgeClass(exp.owner)}`}>
                        {exp.owner || 'ทั่วไป'}
                      </span>
                    </div>
                    <h5 className="font-bold text-white text-base leading-tight">กำหนดชำระ: {formatThaiDate(exp.date)}</h5>
                  </div>
                  
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

                <div className="grid grid-cols-3 gap-2 bg-[#0d0d0f]/55 p-3 rounded-xl border border-[#27272a]/40">
                  <div className="text-center">
                    <p className="text-[9px] font-semibold text-zinc-500">ค่างวด</p>
                    <p className="text-xs font-bold text-white mt-0.5 font-mono">{formatBaht(exp.amount)}</p>
                  </div>
                  <div className="text-center border-x border-[#27272a]/60">
                    <p className="text-[9px] font-semibold text-zinc-500">ชำระมา</p>
                    <p className="text-xs font-bold text-emerald-400 mt-0.5 font-mono">
                      {formatBaht(exp.amountPaid !== undefined ? exp.amountPaid : (exp.status === 'ชำระแล้ว' ? exp.amount : 0))}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-semibold text-zinc-500">คงเหลือ</p>
                    <p className="text-xs font-bold text-rose-400 mt-0.5 font-mono">
                      {formatBaht(exp.amountRemaining !== undefined ? exp.amountRemaining : (exp.status === 'ยังไม่ชำระ' ? exp.amount : 0))}
                    </p>
                  </div>
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
