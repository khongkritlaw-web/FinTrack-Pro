import React, { useState, useEffect } from 'react';
import { Expense, CATEGORIES, STATUS_OPTIONS } from '../types';
import { uploadReceiptFile } from '../googleApi';
import {
  X,
  Plus,
  Loader2,
  Calendar,
  DollarSign,
  Tag,
  Paperclip,
  CheckCircle,
  FileText,
  AlertTriangle
} from 'lucide-react';

interface ExpenseFormProps {
  expense?: Expense | null; // If editing, pre-fills data
  onSave: (expenseData: Omit<Expense, 'id' | 'rowNumber'> & { id?: string; rowNumber?: number }) => Promise<void>;
  onClose: () => void;
  googleAccessToken: string | null;
}

export default function ExpenseForm({
  expense,
  onSave,
  onClose,
  googleAccessToken
}: ExpenseFormProps) {
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<Expense['status']>('ยังไม่ชำระ');
  const [payDate, setPayDate] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Set default form values (pre-fills if editing)
  useEffect(() => {
    if (expense) {
      setDate(expense.date || '');
      setTitle(expense.title || '');
      setCategory(expense.category || CATEGORIES[0]);
      setAmount(expense.amount ? expense.amount.toString() : '');
      setStatus(expense.status || 'ยังไม่ชำระ');
      setPayDate(expense.payDate || '');
      setReceiptUrl(expense.receiptUrl || '');
      setNotes(expense.notes || '');
    } else {
      // Clear values for new item
      setDate(new Date().toISOString().split('T')[0]);
      setTitle('');
      setCategory(CATEGORIES[2]); // Default to 'ค่าอาหาร / เครื่องดื่ม'
      setAmount('');
      setStatus('ยังไม่ชำระ');
      setPayDate('');
      setReceiptUrl('');
      setNotes('');
    }
  }, [expense]);

  // Handle status changes: auto-fill payment date if changed to 'ชำระแล้ว'
  const handleStatusChange = (newStatus: Expense['status']) => {
    setStatus(newStatus);
    if (newStatus === 'ชำระแล้ว' && !payDate) {
      setPayDate(new Date().toISOString().split('T')[0]);
    } else if (newStatus === 'ยังไม่ชำระ') {
      setPayDate('');
    }
  };

  // Upload file logic
  const handleFileUpload = async (file: File) => {
    if (!googleAccessToken) {
      setUploadError('กรุณาลงชื่อเข้าใช้ใหม่อีกครั้งเพื่ออัปโหลดไฟล์หลักฐาน');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setUploadError('โปรดเลือกเฉพาะรูปภาพหลักฐานการชำระเงิน (Slip)');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const fileUrl = await uploadReceiptFile(file, googleAccessToken);
      setReceiptUrl(fileUrl);
      // Auto-set status to paid since receipt was attached!
      setStatus('ชำระแล้ว');
      if (!payDate) {
        setPayDate(new Date().toISOString().split('T')[0]);
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      setUploadError('อัปโหลดไฟล์ไปยัง Google Drive ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileUpload(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('กรุณากรอกรายการค่าใช้จ่าย');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('กรุณากรอกจำนวนเงินให้ถูกต้องและมีค่ามากกว่า 0');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSave({
        id: expense?.id,
        rowNumber: expense?.rowNumber,
        date,
        title: title.trim(),
        category,
        amount: parsedAmount,
        status,
        payDate: status === 'ชำระแล้ว' ? payDate || new Date().toISOString().split('T')[0] : '',
        receiptUrl,
        notes: notes.trim(),
      });
      onClose();
    } catch (err: any) {
      console.error('Save error:', err);
      setErrorMsg('เกิดข้อผิดพลาดในการบันทึกข้อมูลลง Google Sheets: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121214] border border-[#27272a] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Form Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#27272a] bg-[#121214]/80">
          <div>
            <h3 className="text-xl font-bold text-white">
              {expense ? 'แก้ไขข้อมูลค่าใช้จ่าย' : 'เพิ่มรายการค่าใช้จ่ายใหม่'}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {expense ? 'ปรับปรุงรายละเอียดหรือบันทึกข้อมูลการชำระเงิน' : 'กรอกรายละเอียดเพื่อบันทึกลง Google Sheets'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white hover:bg-[#18181b] p-2 rounded-xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl text-sm flex items-start gap-2.5">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Title & Amount Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">รายการค่าใช้จ่าย *</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น ค่าไฟประจำเดือน, ค่าอาหารเย็น"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-zinc-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">จำนวนเงิน (บาท) *</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-xl pl-4 pr-3 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-zinc-600 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Date & Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">วันที่ทำรายการ</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">หมวดหมู่</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Selectors */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">สถานะการชำระเงิน</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleStatusChange('ยังไม่ชำระ')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                  status === 'ยังไม่ชำระ'
                    ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                    : 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                ยังไม่ชำระ
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('ชำระแล้ว')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                  status === 'ชำระแล้ว'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                    : 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                ชำระแล้ว
              </button>
            </div>
          </div>

          {/* Paid fields (conditional) */}
          {status === 'ชำระแล้ว' && (
            <div className="grid grid-cols-1 gap-4 animate-slide-down">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">วันที่ชำระเงิน</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 [color-scheme:dark]"
                />
              </div>

              {/* Upload Receipt / Slip */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">แนบสลิปหลักฐานการชำระเงิน</label>
                
                {/* Drag and drop stage */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                    dragActive
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : receiptUrl
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-[#27272a] bg-[#18181b]/40 hover:border-[#3f3f46]'
                  }`}
                >
                  <input
                    type="file"
                    id="slip-upload-input"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                    disabled={isUploading}
                  />

                  {isUploading ? (
                    <div className="flex flex-col items-center py-2.5">
                      <Loader2 size={24} className="animate-spin text-emerald-500 mb-2" />
                      <p className="text-xs font-medium text-zinc-300">กำลังอัปโหลดรูปภาพไปยัง Google Drive...</p>
                    </div>
                  ) : receiptUrl ? (
                    <div className="flex flex-col items-center w-full py-1">
                      <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-full mb-1">
                        <CheckCircle size={20} />
                      </div>
                      <p className="text-xs font-bold text-emerald-400">อัปโหลดสลิปสำเร็จ!</p>
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-400 underline hover:text-emerald-300 mt-1 truncate max-w-full font-semibold cursor-pointer"
                      >
                        ดูสลิปหลักฐานใน Google Drive
                      </a>
                      <button
                        type="button"
                        onClick={() => setReceiptUrl('')}
                        className="text-[10px] text-rose-400 mt-2 hover:underline cursor-pointer"
                      >
                        ลบและเลือกสลิปใหม่
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="slip-upload-input" className="cursor-pointer text-center w-full py-2">
                      <div className="flex justify-center text-zinc-500 mb-2">
                        <Paperclip size={22} />
                      </div>
                      <p className="text-xs text-zinc-300 font-medium">
                        ลากรูปภาพสลิปมาวางที่นี่ หรือ <span className="text-emerald-400 hover:underline">เลือกไฟล์ภาพ</span>
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-1">ขนาดไฟล์ไม่เกิน 10MB (ไฟล์จะจัดเก็บใน Google Drive)</p>
                    </label>
                  )}
                </div>

                {uploadError && <p className="text-xs text-rose-400 font-medium mt-1">{uploadError}</p>}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">หมายเหตุ / รายละเอียดเพิ่มเติม</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น ชำระผ่านแอป K-Plus, ค้างจ่ายร่วมกับรูมเมท"
              rows={2}
              className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-zinc-600 resize-none font-sans"
            />
          </div>
        </form>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-[#27272a] bg-[#0d0d0f] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl border border-[#27272a] hover:bg-[#18181b] text-sm font-semibold text-zinc-300 transition-all cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isUploading}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>{expense ? 'บันทึกการแก้ไข' : 'บันทึกรายการ'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
