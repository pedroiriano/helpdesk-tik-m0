// js/modules/theme.js - Dark/Light Theme Controller (Zero FOUC)
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;

  // Sinkronkan ikon dengan tema yang aktif
  updateThemeIcon();

  toggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('theme-preference', nextTheme);
    } catch (e) {
      // LocalStorage error fallback (e.g. private browsing storage disabled)
    }
    updateThemeIcon();
  });

  // Pantau perubahan preferensi tema di tingkat OS
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const hasManualPreference = localStorage.getItem('theme-preference');
    if (!hasManualPreference) {
      const autoTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', autoTheme);
      updateThemeIcon();
    }
  });
}

function updateThemeIcon() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const iconSpan = document.querySelector('#theme-toggle span');
  if (iconSpan) {
    iconSpan.textContent = isDark ? '☀️' : '🌙';
  }
}
