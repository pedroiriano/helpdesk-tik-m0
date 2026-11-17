// js/modules/faq.js — Accessible Zero-Dependency FAQ Accordion
function initFaq() {
  const accordions = document.querySelectorAll('.vy-faq, #vy-price-compare, #vy-price-faq');
  if (!accordions.length) return;

  accordions.forEach((root) => {
    const btns = root.querySelectorAll('.vy-faq__q');
    btns.forEach((btn) => {
      const panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (panel) {
        const initiallyOpen = btn.getAttribute('aria-expanded') === 'true';
        panel.setAttribute('aria-hidden', String(!initiallyOpen));
        panel.inert = !initiallyOpen;
      }

      btn.addEventListener('click', () => {
        const panel = document.getElementById(btn.getAttribute('aria-controls'));
        if (!panel) return;
        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        panel.setAttribute('data-open', isOpen ? '0' : '1');
        panel.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
        panel.inert = isOpen;
      });
    });
  });
}
