// js/modules/metrics-chart.js — Interactive SVG Throughput Chart & Count-Up
function initMetricsChart() {
  const host = document.getElementById('vy-chart');
  if (!host) return;

  const gGrid = document.getElementById('vy-chart-grid');
  const gAxis = document.getElementById('vy-chart-axis');
  const gSeries = document.getElementById('vy-chart-series');
  const gCursor = document.getElementById('vy-chart-cursor');
  const readout = document.getElementById('vy-chart-readout');
  const scrubber = document.getElementById('vy-chart-scrubber');
  if (!gGrid || !gAxis || !gSeries) return;

  const SERIES_NAMES = ['Shooting Lab', 'Handle & Iso', 'Rim Apex', 'Court Vision'];
  const X_LABELS = ['16:00', '22:30', '05:00', '11:30'];
  const Y_MAX = 15;
  const PLOT = { l: 96, r: 1184, t: 20, b: 360 };
  const NS = 'http://www.w3.org/2000/svg';

  // Deterministic 49 points (24h at 30 min intervals)
  function buildData() {
    const out = [];
    const shapes = [
      { base: 8.4, amp: 3.6, w1: 0.42, w2: 0.17, ph: 0.0 },
      { base: 6.9, amp: 2.4, w1: 0.31, w2: 0.23, ph: 1.7 },
      { base: 3.6, amp: 1.5, w1: 0.26, w2: 0.44, ph: 3.1 },
      { base: 2.1, amp: 0.9, w1: 0.19, w2: 0.37, ph: 4.6 }
    ];
    shapes.forEach((s) => {
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const v = s.base
          + Math.sin(i * s.w1 + s.ph) * s.amp
          + Math.sin(i * s.w2 + s.ph * 1.9) * (s.amp * 0.38)
          + Math.sin(i * 0.91 + s.ph * 2.7) * (s.amp * 0.12);
        pts.push(Math.max(0.2, Math.round(v * 100) / 100));
      }
      out.push(pts);
    });
    return out;
  }

  const data = buildData();
  const n = data[0].length;
  let currentIndex = 0;

  function x(i) { return PLOT.l + (i / (n - 1)) * (PLOT.r - PLOT.l); }
  function y(v) { return PLOT.b - (v / Y_MAX) * (PLOT.b - PLOT.t); }

  // Draw Grid Lines & Y-Axis Labels
  for (let v = 0; v <= Y_MAX; v += 3) {
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', PLOT.l);
    line.setAttribute('x2', PLOT.r);
    line.setAttribute('y1', y(v));
    line.setAttribute('y2', y(v));
    gGrid.appendChild(line);

    const lbl = document.createElementNS(NS, 'text');
    lbl.setAttribute('x', PLOT.l - 18);
    lbl.setAttribute('y', y(v) + 5);
    lbl.setAttribute('text-anchor', 'end');
    lbl.textContent = String(v);
    gAxis.appendChild(lbl);
  }

  // Draw X-Axis Labels
  X_LABELS.forEach((t, i) => {
    const lbl = document.createElementNS(NS, 'text');
    const px = PLOT.l + (i / (X_LABELS.length - 1)) * (PLOT.r - PLOT.l);
    lbl.setAttribute('x', px);
    lbl.setAttribute('y', PLOT.b + 32);
    lbl.setAttribute('text-anchor', i === 0 ? 'start' : (i === X_LABELS.length - 1 ? 'end' : 'middle'));
    lbl.textContent = t;
    gAxis.appendChild(lbl);
  });

  // Smooth Bezier Curve Path Generator
  function pathFor(points) {
    let d = `M ${x(0).toFixed(1)} ${y(points[0]).toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const x0 = x(i), y0 = y(points[i]);
      const x1 = x(i + 1), y1 = y(points[i + 1]);
      const cx = (x0 + x1) / 2;
      d += ` C ${cx.toFixed(1)} ${y0.toFixed(1)}, ${cx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    return d;
  }

  const paths = [];
  data.forEach((points, si) => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('data-off', '0');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', pathFor(points));
    p.setAttribute('data-series', String(si));
    g.appendChild(p);
    gSeries.appendChild(g);
    paths.push({ g, p });
  });

  // Legend Toggles
  const legendBtns = document.querySelectorAll('#vy-chart-legend button');
  legendBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const si = parseInt(btn.getAttribute('data-series'), 10);
      const on = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', on ? 'false' : 'true');
      paths[si].g.setAttribute('data-off', on ? '1' : '0');
      readIndex(currentIndex);
    });
  });

  // Cursor Readout
  function readIndex(index) {
    const i = Math.max(0, Math.min(n - 1, Number(index) || 0));
    currentIndex = i;
    const hh = (16 + Math.floor(i / 2)) % 24;
    const mm = (i % 2) ? '30' : '00';
    const timestamp = `${(hh < 10 ? '0' : '') + hh}:${mm}`;
    const parts = [];

    data.forEach((pts, si) => {
      if (paths[si].g.getAttribute('data-off') === '1') return;
      parts.push(`${SERIES_NAMES[si]} ${pts[i].toFixed(1)}`);
    });

    if (gCursor) {
      gCursor.setAttribute('data-on', '1');
      const curLine = gCursor.querySelector('line');
      if (curLine) {
        curLine.setAttribute('x1', x(i));
        curLine.setAttribute('x2', x(i));
      }
    }

    if (readout) {
      readout.textContent = `${timestamp}  ·  ${parts.join('   ') || 'no series'}`;
    }

    if (scrubber) {
      if (scrubber.value !== String(i)) scrubber.value = String(i);
      scrubber.setAttribute('aria-valuetext', `${timestamp}; ${parts.join(', ') || 'no active series'}`);
    }
  }

  function readAt(clientX) {
    const r = host.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * 1200;
    const i = Math.round(((vx - PLOT.l) / (PLOT.r - PLOT.l)) * (n - 1));
    readIndex(i);
  }

  host.addEventListener('pointermove', (e) => readAt(e.clientX));
  host.addEventListener('pointerleave', () => {
    if (gCursor) gCursor.setAttribute('data-on', '0');
  });

  if (scrubber) {
    scrubber.addEventListener('input', () => readIndex(scrubber.value));
    scrubber.addEventListener('focus', () => readIndex(scrubber.value));
  }

  readIndex(0);

  // 4. Metric Count-Up Animation
  const countUpEls = document.querySelectorAll('[data-countup]');
  if (countUpEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.dataset.vyCounted === '1') return;
        el.dataset.vyCounted = '1';

        const end = parseFloat(el.getAttribute('data-countup'));
        const dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
        const suffix = el.querySelector('small');
        const suffixText = suffix?.textContent || '';
        const valueNode = document.createTextNode('0');
        el.replaceChildren(valueNode);
        if (suffix) {
          const suffixNode = document.createElement('small');
          suffixNode.textContent = suffixText;
          el.append(suffixNode);
        }

        const start = performance.now();
        const dur = 1400;

        function step(now) {
          const t = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - t, 4); // exponential ease out
          const val = end * eased;
          valueNode.textContent = val.toLocaleString('en-US', {
            minimumFractionDigits: dec,
            maximumFractionDigits: dec
          });
          if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        io.unobserve(el);
      });
    }, { threshold: 0.3 });

    countUpEls.forEach((el) => io.observe(el));
  }
}
