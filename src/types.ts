export interface Expense {
  id: string;
  date: string;
  title: string;
  category: string;
  amount: number;
  status: 'ชำระแล้ว' | 'ยังไม่ชำระ';
  payDate: string;
  receiptUrl: string;
  notes: string;
  rowNumber?: number; // 1-based index in Google Sheets
}

export const CATEGORIES = [
  'ค่าที่พัก / ค่าบ้าน',
  'ค่าน้ำ / ค่าไฟ',
  'ค่าอาหาร / เครื่องดื่ม',
  'ค่าเดินทาง / น้ำมันรถ',
  'อินเทอร์เน็ต / โทรศัพท์',
  'ช้อปปิ้ง / ของใช้',
  'สุขภาพ / ยา',
  'เบ็ดเตล็ด'
];

export const STATUS_OPTIONS = [
  'ชำระแล้ว',
  'ยังไม่ชำระ'
] as const;
