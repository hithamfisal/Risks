import type { RefObject } from 'react';

export async function exportElementAsPNG(ref: RefObject<HTMLElement | null>, fileName: string, backgroundColor: string) {
  if (!ref.current) return;
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(ref.current, { backgroundColor, scale: 2, useCORS: true });
  const link = document.createElement('a');
  link.download = fileName;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
