import express from "express";
import path from "path";
import multer from "multer";
import * as xlsx from "xlsx";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini SDK on server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Configure Multer for file upload in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

app.use(express.json({ limit: '10mb' }));

// 1. API: Parse Uploaded Files (Images, PDFs, Excel)
app.post("/api/parse-receipt", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "ไม่พบไฟล์ที่อัปโหลด" });
    }

    const { buffer, originalname, mimetype } = req.file;
    const fileExtension = path.extname(originalname).toLowerCase();

    let geminiResponseText = "";

    // If it's an Excel spreadsheet, parse it to text first to ensure 100% text parsing accuracy
    if (fileExtension === ".xlsx" || fileExtension === ".xls" || mimetype.includes("spreadsheet") || mimetype.includes("excel")) {
      try {
        const workbook = xlsx.read(buffer, { type: "buffer" });
        let excelText = "";
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = xlsx.utils.sheet_to_csv(sheet);
          excelText += `Sheet: ${sheetName}\n${csv}\n\n`;
        }

        const prompt = `คุณเป็นระบบ AI แยกแยะข้อมูลการชำระเงิน ตรวจสอบตาราง Excel ต่อไปนี้แล้วระบุรายการที่มีการชำระเงินหรือการบันทึกค่างวด ดึงข้อมูลดังนี้:
1. งวดที่ชำระ (installmentNo) เช่น "1" หรือ "2" (ถ้ามีระบุในตาราง)
2. วันที่ชำระหรือวันในแถว (date) ในรูปแบบ YYYY-MM-DD (แปลงปี พ.ศ. เป็น ค.ศ. เช่น 2569 -> 2026)
3. จำนวนเงิน (amount) เช่น 600.00
4. หมายเหตุ (notes) เช่น แถวที่เท่าไหร่ หรือสถานะ

ข้อความตาราง Excel:
${excelText}`;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                installmentNo: { type: Type.STRING, description: "ตัวเลขงวดที่พบ เช่น '1', '2' หรือปล่อยว่างถ้าไม่แน่ใจ" },
                date: { type: Type.STRING, description: "วันที่ในรูปแบบ YYYY-MM-DD เท่านั้น" },
                amount: { type: Type.NUMBER, description: "จำนวนเงินในตาราง" },
                notes: { type: Type.STRING, description: "คำอธิบายย่อหรือหมายเหตุเพิ่มเติม" }
              },
              required: ["installmentNo", "date", "amount", "notes"]
            }
          }
        });

        geminiResponseText = response.text || "{}";
      } catch (err: any) {
        console.error("Excel parse error:", err);
        return res.status(500).json({ error: "ล้มเหลวในการอ่านไฟล์ Excel: " + err.message });
      }
    } else {
      // It's an Image or PDF
      const base64Data = buffer.toString("base64");
      
      // Map standard mime types for Gemini
      let geminiMimeType = mimetype;
      if (fileExtension === ".pdf") {
        geminiMimeType = "application/pdf";
      } else if (fileExtension === ".jpg" || fileExtension === ".jpeg") {
        geminiMimeType = "image/jpeg";
      } else if (fileExtension === ".png") {
        geminiMimeType = "image/png";
      } else if (fileExtension === ".webp") {
        geminiMimeType = "image/webp";
      }

      const promptPart = {
        text: `คุณเป็นระบบ AI ตรวจสอบและสกัดข้อมูลจากรูปภาพสลิปการโอนเงิน (Slip) หรือเอกสาร PDF ของไทยอย่างแม่นยำ
ดึงข้อมูลเหล่านี้กลับมาในรูปแบบ JSON ตาม Schema ที่กำหนด:
1. งวดที่ชำระ (installmentNo) - ตรวจสอบว่าในสลิปมีบันทึกช่วยจำ (memo) หรือระบุคำว่า 'งวดที่ 1', 'งวด 1' หรือระบุตัวเลขใดๆ หรือไม่ ถ้าไม่พบให้ส่งกลับเป็นค่าว่าง ""
2. วันที่ทำรายการ (date) - ดึงวันที่ทำรายการในรูปแบบ YYYY-MM-DD (แปลงปี พ.ศ. เป็น ค.ศ. ให้ถูกต้องเสมอ เช่น 2569 เป็น 2026, 2570 เป็น 2027)
3. จำนวนเงินที่โอน (amount) - ตัวเลขจำนวนเงินโอน (เช่น 600 หรือ 600.00)
4. หมายเหตุ (notes) - เช่น ธนาคาร, รหัสอ้างอิงธุรกรรม, เวลาที่โอน หรือชื่อผู้โอน เพื่อนำไปบันทึกเพิ่ม`
      };

      const filePart = {
        inlineData: {
          mimeType: geminiMimeType,
          data: base64Data
        }
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [filePart, promptPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              installmentNo: { type: Type.STRING, description: "งวดที่ชำระ หากระบุในบันทึกช่วยจำ หรือเป็นค่าว่าง" },
              date: { type: Type.STRING, description: "วันที่โอนเงินในรูปแบบ YYYY-MM-DD" },
              amount: { type: Type.NUMBER, description: "ยอดเงินโอน" },
              notes: { type: Type.STRING, description: "ข้อมูลธนาคาร เวลาโอน หรือเลขธุรกรรม" }
            },
            required: ["installmentNo", "date", "amount", "notes"]
          }
        }
      });

      geminiResponseText = response.text || "{}";
    }

    const parsedData = JSON.parse(geminiResponseText);
    res.json(parsedData);
  } catch (error: any) {
    console.error("Gemini processing error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการประมวลผลด้วย AI: " + (error.message || error) });
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
