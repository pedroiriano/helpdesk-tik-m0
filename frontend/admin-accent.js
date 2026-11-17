export const STORAGE_ACCENT_KEY = 'piui_accent';

export function applyAccent(value, { persist }) {
  const accent = ['blue', 'emerald', 'violet', 'amber'].includes(value) ? value : 'default';
  document.documentElement.dataset.accent = accent;
  for (const button of document.querySelectorAll('[data-accent-choice]')) {
    button.setAttribute('aria-pressed', String(button.dataset.accentChoice === accent));
  }
  if (persist) {
    try { localStorage.setItem(STORAGE_ACCENT_KEY, accent); } catch { /* Optional preference. */ }
  }
}
