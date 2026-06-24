import { useState, useMemo } from 'react';
import { Expense } from '../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import {
  TrendingUp,
  CreditCard,
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  ChevronDown
} from 'lucide-react';

interface DashboardProps {
  expenses: Expense[];
}

const COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#6B7280'  // Gray
];

export default function Dashboard({ expenses }: DashboardProps) {
  const [lookbackYear, setLookbackYear] = useState<string>(new Date().getFullYear().toString());
  const [lookbackView, setLookbackView] = useState<'month' | 'day' | 'year'>('month');

  // Format currency helpers
  const formatBaht = (value: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value);
  };

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM

    let total = 0;
    let paid = 0;
    let unpaid = 0;
    let today = 0;
    let currentMonth = 0;

    expenses.forEach((exp) => {
      total += exp.amount;
      if (exp.status === 'ชำระแล้ว') {
        paid += exp.amount;
      } else {
        unpaid += exp.amount;
      }

      if (exp.date === todayStr) {
        today += exp.amount;
      }

      if (exp.date && exp.date.startsWith(currentMonthStr)) {
        currentMonth += exp.amount;
      }
    });

    return { total, paid, unpaid, today, currentMonth };
  }, [expenses]);

  // Chart 1: Expenses by Category
  const categoryData = useMemo(() => {
    const catMap: Record<string, number> = {};
    expenses.forEach((exp) => {
      catMap[exp.category] = (catMap[exp.category] || 0) + exp.amount;
    });

    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Chart 2: Monthly trend for lookback year
  const monthlyTrendData = useMemo(() => {
    const months = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    const monthlyValues = Array(12).fill(0);

    expenses.forEach((exp) => {
      if (exp.date && exp.date.startsWith(lookbackYear)) {
        const monthIndex = parseInt(exp.date.split('-')[1], 10) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          monthlyValues[monthIndex] += exp.amount;
        }
      }
    });

    return months.map((month, idx) => ({
      name: month,
      'ยอดค่าใช้จ่าย': monthlyValues[idx]
    }));
  }, [expenses, lookbackYear]);

  // Daily breakdown for the current month
  const dailyBreakdownData = useMemo(() => {
    const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
    const daysInMonth: Record<string, number> = {};

    // Get last 30 days or days of current month
    expenses.forEach((exp) => {
      if (exp.date && exp.date.startsWith(currentMonthStr)) {
        const day = exp.date.split('-')[2];
        daysInMonth[day] = (daysInMonth[day] || 0) + exp.amount;
      }
    });

    return Object.entries(daysInMonth)
      .map(([day, value]) => ({
        name: `วันที่ ${parseInt(day, 10)}`,
        'ยอดจ่าย': value
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [expenses]);

  // Yearly comparison data
  const yearlyData = useMemo(() => {
    const yearsMap: Record<string, number> = {};
    expenses.forEach((exp) => {
      if (exp.date) {
        const yr = exp.date.split('-')[0];
        if (yr) {
          yearsMap[yr] = (yearsMap[yr] || 0) + exp.amount;
        }
      }
    });

    return Object.entries(yearsMap)
      .map(([year, value]) => ({
        name: `ปี ${year}`,
        'ยอดรวม': value
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [expenses]);

  // Unique list of years in data
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    expenses.forEach((exp) => {
      if (exp.date) {
        const yr = exp.date.split('-')[0];
        if (yr) yearsSet.add(yr);
      }
    });
    // Add current year if not present
    yearsSet.add(new Date().getFullYear().toString());
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  return (
    <div id="dashboard-section" className="space-y-8">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total */}
        <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all hover:scale-[1.02] hover:border-zinc-700/50">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-400 text-sm font-medium">ค่าใช้จ่ายทั้งหมด</span>
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2 rounded-xl shadow-inner">
              <TrendingUp size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white tracking-tight">
            {formatBaht(stats.total)}
          </h3>
          <p className="text-xs text-zinc-500 mt-2">ยอดสะสมรวมในระบบ</p>
        </div>

        {/* Card 2: This Month */}
        <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all hover:scale-[1.02] hover:border-zinc-700/50">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-400 text-sm font-medium">ค่าใช้จ่ายประจำเดือน</span>
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2 rounded-xl">
              <Calendar size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-emerald-400 tracking-tight">
            {formatBaht(stats.currentMonth)}
          </h3>
          <p className="text-xs text-zinc-500 mt-2">ยอดค่าใช้จ่ายเดือนนี้</p>
        </div>

        {/* Card 3: Paid */}
        <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all hover:scale-[1.02] hover:border-zinc-700/50">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-400 text-sm font-medium">ชำระแล้ว</span>
            <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl">
              <CheckCircle size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-emerald-400 tracking-tight">
            {formatBaht(stats.paid)}
          </h3>
          <p className="text-xs text-zinc-500 mt-2">
            คิดเป็น {stats.total > 0 ? ((stats.paid / stats.total) * 100).toFixed(0) : 0}% ของยอดรวม
          </p>
        </div>

        {/* Card 4: Unpaid */}
        <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all hover:scale-[1.02] hover:border-zinc-700/50">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-400 text-sm font-medium">ยังไม่ชำระ</span>
            <div className="bg-rose-500/20 text-rose-400 p-2 rounded-xl">
              <AlertCircle size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-rose-400 tracking-tight">
            {formatBaht(stats.unpaid)}
          </h3>
          <p className="text-xs text-zinc-500 mt-2">ยอดค้างจ่ายที่ต้องจัดการ</p>
        </div>

        {/* Card 5: Today */}
        <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all hover:scale-[1.02] hover:border-zinc-700/50">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-400 text-sm font-medium">ค่าใช้จ่ายวันนี้</span>
            <div className="bg-amber-500/20 text-amber-400 p-2 rounded-xl">
              <Clock size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-amber-400 tracking-tight">
            {formatBaht(stats.today)}
          </h3>
          <p className="text-xs text-zinc-500 mt-2">อัปเดตแบบเรียลไทม์วันนี้</p>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trend lookback look Chart */}
        <div className="lg:col-span-2 bg-[#121214]/60 backdrop-blur-md border border-[#27272a] rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h4 className="text-lg font-bold text-white">รายงานสรุปค่าใช้จ่าย</h4>
              <p className="text-sm text-zinc-400">เลือกดูสรุปข้อมูลย้อนหลังตามวัน เดือน หรือปี</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-[#18181b] border border-[#27272a] p-1 rounded-xl flex">
                <button
                  onClick={() => setLookbackView('day')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    lookbackView === 'day' ? 'bg-emerald-500 text-emerald-950 shadow font-bold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  รายวัน (เดือนนี้)
                </button>
                <button
                  onClick={() => setLookbackView('month')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    lookbackView === 'month' ? 'bg-emerald-500 text-emerald-950 shadow font-bold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  รายเดือน
                </button>
                <button
                  onClick={() => setLookbackView('year')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    lookbackView === 'year' ? 'bg-emerald-500 text-emerald-950 shadow font-bold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  รายปีทั้งหมด
                </button>
              </div>

              {lookbackView === 'month' && (
                <div className="relative">
                  <select
                    value={lookbackYear}
                    onChange={(e) => setLookbackYear(e.target.value)}
                    className="appearance-none bg-[#18181b] border border-[#27272a] text-white px-3 py-1.5 pr-8 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        ปี {yr}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-zinc-400 pointer-events-none" />
                </div>
              )}
            </div>
          </div>

          <div className="h-72 w-full">
            {lookbackView === 'month' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                  <XAxis dataKey="name" stroke="#71717A" fontSize={12} tickLine={false} />
                  <YAxis stroke="#71717A" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#121214', borderColor: '#27272a', borderRadius: '12px' }}
                    labelStyle={{ color: '#a1a1aa', fontWeight: 'bold' }}
                    itemStyle={{ color: '#10B981' }}
                    formatter={(val) => [`${parseFloat(val as string).toLocaleString()} บาท`, 'ยอดเงิน']}
                  />
                  <Bar dataKey="ยอดค่าใช้จ่าย" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {lookbackView === 'day' && (
              dailyBreakdownData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyBreakdownData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                    <XAxis dataKey="name" stroke="#71717A" fontSize={11} tickLine={false} />
                    <YAxis stroke="#71717A" fontSize={12} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#121214', borderColor: '#27272a', borderRadius: '12px' }}
                      labelStyle={{ color: '#a1a1aa', fontWeight: 'bold' }}
                      formatter={(val) => [`${parseFloat(val as string).toLocaleString()} บาท`, 'ยอดเงิน']}
                    />
                    <Line type="monotone" dataKey="ยอดจ่าย" stroke="#10B981" strokeWidth={3} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                  <Calendar size={40} className="stroke-1 mb-2 text-zinc-600" />
                  <p>ไม่มีข้อมูลค่าใช้จ่ายสำหรับวันในเดือนนี้</p>
                </div>
              )
            )}

            {lookbackView === 'year' && (
              yearlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                    <XAxis dataKey="name" stroke="#71717A" fontSize={12} tickLine={false} />
                    <YAxis stroke="#71717A" fontSize={12} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#121214', borderColor: '#27272a', borderRadius: '12px' }}
                      labelStyle={{ color: '#a1a1aa', fontWeight: 'bold' }}
                      formatter={(val) => [`${parseFloat(val as string).toLocaleString()} บาท`, 'ยอดรวม']}
                    />
                    <Bar dataKey="ยอดรวม" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                  <Calendar size={40} className="stroke-1 mb-2 text-zinc-600" />
                  <p>ไม่มีข้อมูลรายปี</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* Expenses by Category Donut Chart */}
        <div className="bg-[#121214]/60 backdrop-blur-md border border-[#27272a] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h4 className="text-lg font-bold text-white mb-1">สัดส่วนตามหมวดหมู่</h4>
            <p className="text-sm text-zinc-400 mb-6">แสดงหมวดหมู่ที่ใช้จ่ายสูงสุด</p>
          </div>

          <div className="h-56 relative flex items-center justify-center">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#121214', borderColor: '#27272a', borderRadius: '12px' }}
                    itemStyle={{ color: '#FFF' }}
                    formatter={(val) => [`${parseFloat(val as string).toLocaleString()} บาท`, 'ยอดเงิน']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-zinc-500 text-sm">ไม่มีข้อมูลหมวดหมู่</div>
            )}
            {categoryData.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">ค่าใช้จ่ายสูงสุด</span>
                <span className="text-sm font-semibold text-white max-w-[120px] truncate text-center mt-0.5">
                  {categoryData[0]?.name}
                </span>
              </div>
            )}
          </div>

          {/* Legend list */}
          <div className="mt-4 max-h-28 overflow-y-auto space-y-1.5 pr-1">
            {categoryData.slice(0, 4).map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span className="text-zinc-300 font-medium truncate max-w-[120px]">{entry.name}</span>
                </div>
                <span className="text-zinc-400 font-semibold">{formatBaht(entry.value)}</span>
              </div>
            ))}
            {categoryData.length > 4 && (
              <div className="text-[10px] text-zinc-500 text-center mt-1">
                และหมวดหมู่อื่นๆ อีก {categoryData.length - 4} หมวดหมู่
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
