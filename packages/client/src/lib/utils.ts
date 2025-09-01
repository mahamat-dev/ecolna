import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
   return twMerge(clsx(inputs));
}

export function downloadCSV<T extends Record<string, unknown>>(rows: T[], filename = 'export.csv') {
   if (!rows?.length) return;
   const headers = Object.keys(rows[0] as Record<string, unknown>);
   const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => escapeCSV((r as Record<string, unknown>)[h])).join(',')),
   ].join('\n');
   const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
   const link = document.createElement('a');
   link.href = URL.createObjectURL(blob);
   link.download = filename;
   link.click();
}

function escapeCSV(v: unknown) {
   if (v == null) return '';
   const s = String(v).replace(/"/g, '""');
   return /[",\n]/.test(s) ? `"${s}"` : s;
}
