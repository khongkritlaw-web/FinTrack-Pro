export interface Expense {
  id: string;
  date: string;       // due date/month
  title: string;      // "งวดที่ X" or title
  category: string;
  amount: number;     // installment amount (ค่างวด)
  status: 'ชำระแล้ว' | 'ยังไม่ชำระ';
  payDate: string;    // payment date
  receiptUrl: string; // receipt image or doc url (หลักฐาน)
  notes: string;
  rowNumber?: number; // 1-based index in Google Sheets
  
  // Installment Tracker extensions
  installmentNo?: string;   // "งวด"
  amountPaid?: number;       // "ชำระมา"
  amountRemaining?: number;  // "คงเหลือ"
  owner?: string;            // ผู้รับผิดชอบ (e.g. 'พ่อ', 'ต้อ')
}

export const CATEGORIES = [
  'บัตรเครดิต',
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
