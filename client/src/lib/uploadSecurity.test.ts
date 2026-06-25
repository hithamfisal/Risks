import { describe, expect, it } from 'vitest';
import { validateWorkbookFileSignature } from './uploadSecurity';

describe('validateWorkbookFileSignature', () => {
  it('accepts OpenXML Excel ZIP signatures', () => {
    expect(() => validateWorkbookFileSignature('risk.xlsx', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]))).not.toThrow();
    expect(() => validateWorkbookFileSignature('risk.xlsm', new Uint8Array([0x50, 0x4b, 0x05, 0x06]))).not.toThrow();
  });

  it('accepts legacy Excel compound file signatures', () => {
    expect(() => validateWorkbookFileSignature('risk.xls', new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).not.toThrow();
  });

  it('accepts text-like CSV input', () => {
    expect(() => validateWorkbookFileSignature('risk.csv', new TextEncoder().encode('Risk Title,Owner\nA,B'))).not.toThrow();
  });

  it('rejects renamed binary files', () => {
    expect(() => validateWorkbookFileSignature('risk.xlsx', new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toThrow(/OpenXML/);
    expect(() => validateWorkbookFileSignature('risk.csv', new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toThrow(/binary/);
  });

  it('rejects unsupported extensions', () => {
    expect(() => validateWorkbookFileSignature('risk.exe', new Uint8Array([0x4d, 0x5a]))).toThrow(/Invalid file type/);
  });
});
