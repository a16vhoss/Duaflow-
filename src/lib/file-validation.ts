// Tipos de archivo permitidos: solo PDF y Excel (Hallazgo 1.3)
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];

export const ALLOWED_EXTENSIONS = ['.pdf', '.xlsx', '.xls'];

export const MAX_FILE_SIZE_MB = 10;

export const ACCEPTED_INPUT_ATTR =
  '.pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

export function isFileAllowed(file: { name: string; type: string }): boolean {
  if (ALLOWED_FILE_TYPES.includes(file.type)) return true;
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

export function isFileSizeAllowed(sizeBytes: number): boolean {
  return sizeBytes <= MAX_FILE_SIZE_MB * 1024 * 1024;
}
