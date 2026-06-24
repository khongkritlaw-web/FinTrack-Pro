import fs from 'fs';

const gids = ['809188475', '1396928476', '1096802996', '465767784', '967591910', '2137903794', '1524515768'];

function parseCSVLine(line) {
  const row = [];
  let inQuotes = false;
  let currentCell = '';
  for (let c = 0; c < line.length; c++) {
    const char = line[c];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(currentCell.trim());
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  row.push(currentCell.trim());
  return row;
}

function parseCSV(text) {
  const lines = text.split('\n');
  return lines.map(parseCSVLine);
}

function analyzeSheet(gid) {
  const text = fs.readFileSync(`sheet_${gid}.csv`, 'utf8');
  const rows = parseCSV(text);
  console.log(`\n================= SHEET ${gid} (Rows: ${rows.length}) =================`);
  
  // Let's print the first 15 rows
  for (let i = 0; i < Math.min(25, rows.length); i++) {
    const row = rows[i];
    // Filter empty cells
    const nonEmpties = row.map((cell, idx) => cell ? `[${idx}]: "${cell}"` : '').filter(Boolean);
    console.log(`Row ${i}:`, nonEmpties.join(', '));
  }
}

gids.forEach(analyzeSheet);
