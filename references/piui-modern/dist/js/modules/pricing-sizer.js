// js/modules/pricing-sizer.js — Interactive Credit Sizer Calculator
function initPricingSizer() {
  const root = document.getElementById('vy-sizer') || document.querySelector('.vy-sizer');
  if (!root) return;

  const renders = document.getElementById('vy-calc-renders') || document.getElementById('vy-sizer-renders');
  const size = document.getElementById('vy-calc-size') || document.getElementById('vy-sizer-size');
  if (!renders || !size) return;

  const rendersOut = document.getElementById('vy-calc-renders-out') || document.getElementById('vy-sizer-renders-out');
  const sizeOut = document.getElementById('vy-calc-size-out') || document.getElementById('vy-sizer-size-out');
  const upOut = document.getElementById('vy-calc-up-out') || document.getElementById('vy-sizer-up-out');
  const upMinus = document.getElementById('vy-calc-up-minus') || document.getElementById('vy-sizer-up-minus');
  const upPlus = document.getElementById('vy-calc-up-plus') || document.getElementById('vy-sizer-up-plus');
  const totalEl = document.getElementById('vy-calc-total') || document.getElementById('vy-sizer-total');
  const formulaEl = document.getElementById('vy-calc-formula') || document.getElementById('vy-sizer-formula');
  const planEl = document.getElementById('vy-calc-plan') || document.getElementById('vy-sizer-plan');
  const whyEl = document.getElementById('vy-calc-why') || document.getElementById('vy-sizer-why');
  const costEl = document.getElementById('vy-calc-cost') || document.getElementById('vy-sizer-cost');
  const ctaEl = document.getElementById('vy-calc-cta') || document.getElementById('vy-sizer-cta');

  const SIZES = [
    { px: '60 FPS', mul: 1 },
    { px: '120 FPS', mul: 2 },
    { px: '240 FPS', mul: 3 },
    { px: '480 FPS', mul: 4 }
  ];

  const PLANS = [
    { id: 'starter', name: 'AMATEUR', credits: 2000, maxIdx: 0, cost: 0, cta: 'Start Free Hoop Log' },
    { id: 'studio', name: 'COLLEGIATE PRO', credits: 15000, maxIdx: 2, cost: 49, cta: 'Equip Collegiate Pro' },
    { id: 'scale', name: 'FRANCHISE APEX', credits: 60000, maxIdx: 3, cost: 189, cta: 'Deploy Franchise Apex' }
  ];

  let upPer10 = 0;

  function nf(v) {
    return v.toLocaleString('en-US');
  }

  function update() {
    const r = parseInt(renders.value, 10);
    const sIdx = Math.min(SIZES.length - 1, Math.max(0, parseInt(size.value, 10)));
    const s = SIZES[sIdx];
    const upscales = Math.round(r * (upPer10 / 10));
    const credits = r * s.mul + upscales * 2;

    if (rendersOut) rendersOut.textContent = nf(r);
    if (sizeOut) sizeOut.textContent = s.px;
    renders.setAttribute('aria-valuetext', `${nf(r)} monthly reps`);
    size.setAttribute('aria-valuetext', s.px);
    if (upOut) upOut.textContent = String(upPer10);
    if (upMinus) upMinus.disabled = upPer10 <= 0;
    if (upPlus) upPlus.disabled = upPer10 >= 10;
    if (totalEl) totalEl.textContent = nf(credits);
    if (formulaEl) {
      formulaEl.textContent = `(${nf(r)} shot reps × ${s.mul}) + (${nf(upscales)} sensor pods × 2)`;
    }

    // Recommendation logic: first plan satisfying both credits & sensor tier
    let pick = null;
    for (let i = 0; i < PLANS.length; i++) {
      if (credits <= PLANS[i].credits && sIdx <= PLANS[i].maxIdx) {
        pick = PLANS[i];
        break;
      }
    }

    let why;
    if (!pick) {
      pick = PLANS[PLANS.length - 1];
      why = `${nf(credits)} telemetry reps exceeds standard quota. Franchise Apex covers ${nf(pick.credits)} reps; additional usage billed per combine session.`;
    } else if (pick.id === 'starter') {
      why = `${nf(credits)} reps fits comfortably within the Amateur free tier. No subscription required.`;
    } else if (sIdx > 0 && credits <= PLANS[0].credits) {
      why = `Rep count is within entry limit, but ${s.px} high-speed telemetry requires Collegiate Pro tier.`;
    } else {
      const prev = PLANS[PLANS.indexOf(pick) - 1];
      why = `${nf(credits)} reps exceeds ${prev.name.toLowerCase()}'s ${nf(prev.credits)} cap. ${pick.name} provides ${nf(pick.credits)} tracking credits.`;
    }

    if (whyEl) whyEl.textContent = why;
    if (costEl) {
      const amount = document.createElement('b');
      amount.textContent = `$${pick.cost}`;
      costEl.replaceChildren(amount, document.createTextNode(' / mo'));
    }
    if (ctaEl) ctaEl.textContent = pick.cta;
    if (ctaEl) {
      const tierHash = pick.id === 'starter' ? 'starter' : (pick.id === 'studio' ? 'collegiate' : 'franchise');
      const onPricingPage = window.location.pathname.toLowerCase().endsWith('/pricing.html');
      ctaEl.href = onPricingPage
        ? `contact.html?plan=${encodeURIComponent(pick.id)}`
        : `pricing.html#${tierHash}`;
    }
    if (planEl) planEl.textContent = pick.name;

    // Highlight recommended plan tier card
    const tierCards = document.querySelectorAll('.vy-tier');
    tierCards.forEach((card) => {
      card.setAttribute('data-recommended', card.getAttribute('data-tier') === pick.id ? '1' : '0');
    });
  }

  renders.addEventListener('input', update);
  size.addEventListener('input', update);
  if (upMinus) upMinus.addEventListener('click', () => { upPer10 = Math.max(0, upPer10 - 1); update(); });
  if (upPlus) upPlus.addEventListener('click', () => { upPer10 = Math.min(10, upPer10 + 1); update(); });

  update();
}
