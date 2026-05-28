import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme, switchable } = useTheme();

  if (!switchable || !toggleTheme) return null;

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="no-print"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 34,
        padding: '0 12px',
        borderRadius: 999,
        border: isDark ? '1px solid rgba(125, 211, 252, 0.65)' : '1px solid rgba(31, 56, 100, 0.18)',
        background: isDark ? 'rgba(6, 20, 48, 0.74)' : 'rgba(255, 255, 255, 0.86)',
        color: isDark ? '#E0F2FE' : '#1F3864',
        boxShadow: isDark ? '0 12px 34px rgba(0,0,0,0.28)' : '0 12px 30px rgba(31,56,100,0.12)',
        backdropFilter: 'blur(12px)',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 800,
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
      {isDark ? 'Light' : 'Dark'}
    </button>
  );
}
