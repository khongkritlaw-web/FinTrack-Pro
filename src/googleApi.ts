import { Expense } from './types';

// Default spreadsheet ID requested by user
export const DEFAULT_SPREADSHEET_ID = '1NN7hkA28PLynkE6jYWOi9mdBThaLT4aFupAOT1dTq-o';
export const DEFAULT_GID = '465767784';

export interface SheetMetadata {
  spreadsheetId: string;
  title: string; // The selected sheet/tab name
  sheetId: number; // The numerical sheet ID (needed for batch updates/deletes)
  allSheets: { title: string; sheetId: number }[];
}

/**
 * Fetch spreadsheet metadata to find sheet title and numerical sheet ID
 */
export const fetchSpreadsheetMetadata = async (
  spreadsheetId: string,
  token: string
): Promise<SheetMetadata> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch spreadsheet metadata: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const sheets: any[] = data.sheets || [];

  if (sheets.length === 0) {
    throw new Error('Spreadsheet has no sheets/tabs.');
  }

  const allSheets = sheets.map((s) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId,
  }));

  // Try to match GID if provided or match DEFAULT_GID
  const targetGidNum = parseInt(DEFAULT_GID, 10);
  let selectedSheet = sheets.find((s) => s.properties.sheetId === targetGidNum);

  if (!selectedSheet) {
    // Default to the first sheet
    selectedSheet = sheets[0];
  }

  return {
    spreadsheetId,
    title: selectedSheet.properties.title,
    sheetId: selectedSheet.properties.sheetId,
    allSheets,
  };
};

/**
 * Initialize empty spreadsheet with default headers if empty
 */
export const initializeSheetHeaders = async (
  spreadsheetId: string,
  sheetTitle: string,
  token: string
): Promise<void> => {
  const headers = [
    'ID',
    'วันที่',
    'รายการ',
    'หมวดหมู่',
    'จำนวนเงิน',
    'สถานะ',
    'วันที่ชำระ',
    'สลิปหลักฐาน',
    'หมายเหตุ'
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!A1:I1?valueInputOption=USER_ENTERED`;
  await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [headers],
    }),
  });
};

/**
 * Fetch all expense rows from Google Sheets
 */
export const fetchExpenses = async (
  spreadsheetId: string,
  sheetTitle: string,
  token: string
): Promise<Expense[]> => {
  const range = `${sheetTitle}!A:Z`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch expense records: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const values: string[][] = data.values || [];

  // If entirely empty, initialize with headers and return empty
  if (values.length === 0) {
    await initializeSheetHeaders(spreadsheetId, sheetTitle, token);
    return [];
  }

  // Check if first row is header, if values is size 1 and has no actual expense rows, return empty
  if (values.length === 1) {
    // Row 1 is header
    return [];
  }

  const expenses: Expense[] = [];

  // Index 0 is Header: ID | วันที่ | รายการ | หมวดหมู่ | จำนวนเงิน | สถานะ | วันที่ชำระ | สลิปหลักฐาน | หมายเหตุ
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row || row.length === 0) continue;

    // Google Sheets index corresponds to columns
    const id = row[0] || `EXP-ROW-${i + 1}`;
    const date = row[1] || '';
    const title = row[2] || '';
    const category = row[3] || 'เบ็ดเตล็ด';
    const amount = parseFloat(row[4] || '0') || 0;
    const statusVal = row[5] || 'ยังไม่ชำระ';
    const status: 'ชำระแล้ว' | 'ยังไม่ชำระ' = statusVal === 'ชำระแล้ว' ? 'ชำระแล้ว' : 'ยังไม่ชำระ';
    const payDate = row[6] || '';
    const receiptUrl = row[7] || '';
    const notes = row[8] || '';

    expenses.push({
      id,
      date,
      title,
      category,
      amount,
      status,
      payDate,
      receiptUrl,
      notes,
      rowNumber: i + 1, // Store the 1-based index (header is 1, first data row is 2)
    });
  }

  return expenses;
};

/**
 * Add a new expense row to the Google Sheet
 */
export const addExpenseRow = async (
  spreadsheetId: string,
  sheetTitle: string,
  expense: Omit<Expense, 'id'>,
  token: string
): Promise<void> => {
  const expenseId = `EXP-${Date.now()}`;
  const values = [
    [
      expenseId,
      expense.date,
      expense.title,
      expense.category,
      expense.amount.toString(),
      expense.status,
      expense.payDate || '',
      expense.receiptUrl || '',
      expense.notes || ''
    ]
  ];

  const range = `${sheetTitle}!A:I`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to append expense: ${response.status} - ${errText}`);
  }
};

/**
 * Update an existing expense row (using stored rowNumber)
 */
export const updateExpenseRow = async (
  spreadsheetId: string,
  sheetTitle: string,
  expense: Expense,
  token: string
): Promise<void> => {
  if (!expense.rowNumber) {
    throw new Error('Cannot update expense without sheet row number.');
  }

  const values = [
    [
      expense.id,
      expense.date,
      expense.title,
      expense.category,
      expense.amount.toString(),
      expense.status,
      expense.payDate || '',
      expense.receiptUrl || '',
      expense.notes || ''
    ]
  ];

  const range = `${sheetTitle}!A${expense.rowNumber}:I${expense.rowNumber}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to update expense at row ${expense.rowNumber}: ${response.status} - ${errText}`);
  }
};

/**
 * Delete an expense row and shift subsequent rows up
 */
export const deleteExpenseRow = async (
  spreadsheetId: string,
  sheetId: number,
  rowNumber: number,
  token: string
): Promise<void> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const body = {
    requests: [
      {
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1, // 0-based start, inclusive
            endIndex: rowNumber,       // 0-based end, exclusive
          },
        },
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to delete expense row: ${response.status} - ${errText}`);
  }
};

/**
 * Find or create a specific folder in Google Drive
 */
export const getOrCreateFolder = async (folderName: string, token: string): Promise<string> => {
  // 1. Search for folder
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) {
    console.warn('Drive folder search failed, attempting to create direct');
  } else {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // 2. Create if not found
  const createUrl = 'https://www.googleapis.com/drive/v3/files';
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Google Drive folder: ${createRes.status} - ${errText}`);
  }

  const folderData = await createRes.json();
  return folderData.id;
};

/**
 * Upload an image file (slip/receipt) to Google Drive and return viewable webLink
 */
export const uploadReceiptFile = async (file: File, token: string): Promise<string> => {
  // Get or create the folder
  const folderId = await getOrCreateFolder('Expense_Receipts', token);

  // 1. Create metadata
  const metadataUrl = 'https://www.googleapis.com/drive/v3/files';
  const metaResponse = await fetch(metadataUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `slip_${Date.now()}_${file.name}`,
      mimeType: file.type,
      parents: [folderId],
    }),
  });

  if (!metaResponse.ok) {
    const errText = await metaResponse.text();
    throw new Error(`Failed to create Drive metadata: ${metaResponse.status} - ${errText}`);
  }

  const { id } = await metaResponse.json();

  // 2. Upload file contents
  const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`;
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(`Failed to upload file content: ${uploadResponse.status} - ${errText}`);
  }

  // 3. Make file accessible to anyone with the link
  try {
    const permissionUrl = `https://www.googleapis.com/drive/v3/files/${id}/permissions`;
    await fetch(permissionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
  } catch (err) {
    console.error('Failed to set public view permissions, will continue', err);
  }

  // 4. Retrieve webViewLink
  const fieldsUrl = `https://www.googleapis.com/drive/v3/files/${id}?fields=webViewLink`;
  const fieldsResponse = await fetch(fieldsUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!fieldsResponse.ok) {
    // Return standard viewer URL as fallback
    return `https://drive.google.com/file/d/${id}/view`;
  }

  const { webViewLink } = await fieldsResponse.json();
  return webViewLink || `https://drive.google.com/file/d/${id}/view`;
};
