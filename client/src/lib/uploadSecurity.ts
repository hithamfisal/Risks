const EXCEL_ZIP_EXTENSIONS = new Set(['xlsx', 'xlsm']);
const LEGACY_EXCEL_EXTENSIONS = new Set(['xls']);
const CSV_EXTENSIONS = new Set(['csv']);

export const MAX_WORKBOOK_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ALLOWED_WORKBOOK_FILE_RE = /\.(xlsx|xls|xlsm|csv)$/i;

function getExtension(fileName: string) {
  const match = /\.([^.]+)$/.exec(fileName.toLowerCase());
  return match?.[1] || '';
}

function startsWithBytes(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function looksLikeText(bytes: Uint8Array) {
  const sample = bytes.slice(0, Math.min(bytes.length, 512));
  if (sample.length === 0) return false;
  let suspicious = 0;
  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];
    if (byte === 0) return false;
    if (byte < 7 || (byte > 13 && byte < 32)) suspicious += 1;
  }
  return suspicious / sample.length < 0.08;
}

export function validateWorkbookFileSignature(fileName: string, bytes: Uint8Array) {
  const extension = getExtension(fileName);
  if (!ALLOWED_WORKBOOK_FILE_RE.test(fileName)) {
    throw new Error('UPLOAD_VALIDATION: Invalid file type. Please upload .xlsx, .xls, .xlsm, or .csv only.');
  }
  if (EXCEL_ZIP_EXTENSIONS.has(extension)) {
    if (!startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) && !startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06]) && !startsWithBytes(bytes, [0x50, 0x4b, 0x07, 0x08])) {
      throw new Error('UPLOAD_VALIDATION: The workbook signature does not match an Excel OpenXML file.');
    }
    return;
  }
  if (LEGACY_EXCEL_EXTENSIONS.has(extension)) {
    if (!startsWithBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
      throw new Error('UPLOAD_VALIDATION: The workbook signature does not match a legacy Excel file.');
    }
    return;
  }
  if (CSV_EXTENSIONS.has(extension) && !looksLikeText(bytes)) {
    throw new Error('UPLOAD_VALIDATION: The CSV file appears to contain binary data.');
  }
}

export async function validateWorkbookFile(file: File) {
  if (!ALLOWED_WORKBOOK_FILE_RE.test(file.name)) {
    throw new Error('UPLOAD_VALIDATION: Invalid file type. Please upload .xlsx, .xls, .xlsm, or .csv only.');
  }
  if (file.size === 0) {
    throw new Error('UPLOAD_VALIDATION: The selected file is empty. Please upload a valid workbook.');
  }
  if (file.size > MAX_WORKBOOK_UPLOAD_BYTES) {
    throw new Error('UPLOAD_VALIDATION: The selected file is too large. Please upload a file smaller than 25 MB.');
  }
  const signature = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  validateWorkbookFileSignature(file.name, signature);
}
