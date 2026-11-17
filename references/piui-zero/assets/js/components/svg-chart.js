/**
 * @fileoverview PIUI Zero — ApexCharts-Grade Interactive SVG Chart Engine
 * Fitur Utama:
 * 1. Hoverable Crosshair (Vertikal & Horizontal), Active Marker Halo, dan Floating SVG Tooltip Box.
 * 2. Clickable Data Points & Bars untuk mengunci (Pin/Lock) titik data & menyorot baris tabel pendamping.
 * 3. Interactive Series Legend Toggles (Volume Transaksi & Latensi p95) seperti ApexCharts.
 * 4. Chart Type Switcher: Area Spline (Kurva Bezier Halus), Bar Column, dan Combo (Bar + Line).
 * 5. Bi-Directional Sync: Klik pada baris tabel juga memilih & menyorot titik pada grafik SVG.
 */

import { el,field } from '../core/dom.js';
import { announce, showToast } from "../core/session-guard.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export const CHART_SERIES_BY_RANGE = {
  today: {
    label: "Hari Ini (Per 4 Jam — 21 Okt 2026)",
    points: [
      { period: "00:00 WIB", volume: 1840, latencyMs: 36, errorRate: "0,04%" },
      { period: "04:00 WIB", volume: 1420, latencyMs: 31, errorRate: "0,02%" },
      { period: "08:00 WIB", volume: 4680, latencyMs: 42, errorRate: "0,08%" },
      { period: "12:00 WIB", volume: 6190, latencyMs: 47, errorRate: "0,11%" },
      { period: "16:00 WIB", volume: 5840, latencyMs: 44, errorRate: "0,07%" },
      { period: "20:00 WIB", volume: 4920, latencyMs: 39, errorRate: "0,05%" }
    ]
  },
  "7d": {
    label: "7 Hari Terakhir (15 Okt – 21 Okt 2026)",
    points: [
      { period: "15 Okt", volume: 21400, latencyMs: 41, errorRate: "0,09%" },
      { period: "16 Okt", volume: 22950, latencyMs: 40, errorRate: "0,07%" },
      { period: "17 Okt", volume: 19800, latencyMs: 37, errorRate: "0,05%" },
      { period: "18 Okt", volume: 20600, latencyMs: 38, errorRate: "0,06%" },
      { period: "19 Okt", volume: 24120, latencyMs: 45, errorRate: "0,10%" },
      { period: "20 Okt", volume: 25390, latencyMs: 43, errorRate: "0,08%" },
      { period: "21 Okt", volume: 24890, latencyMs: 42, errorRate: "0,06%" }
    ]
  },
  "30d": {
    label: "30 Hari Terakhir (Agregasi Mingguan)",
    points: [
      { period: "Minggu 1", volume: 138400, latencyMs: 46, errorRate: "0,12%" },
      { period: "Minggu 2", volume: 149200, latencyMs: 44, errorRate: "0,09%" },
      { period: "Minggu 3", volume: 158900, latencyMs: 41, errorRate: "0,08%" },
      { period: "Minggu 4", volume: 169450, latencyMs: 42, errorRate: "0,06%" }
    ]
  }
};

const chartInstances=new WeakMap();let nextChartId=0;
function instance(root){if(!chartInstances.has(root))chartInstances.set(root,createChart(root));return chartInstances.get(root);}
export function renderOperationalChart(range='today',root=document){return instance(root).render(range);}
export function renderClusterComparisonChart(root=document){return instance(root).clusters();}
function createChart(root) {
 const gradientId=`piui-chart-gradient-${++nextChartId}`;
 const find=id=>root.querySelector(`[data-chart-part="${id}"], #${id}`);
 let comparison;
 function updateComparison(svg,range){
  if(!svg)return;
  if(!comparison){const box=svg.closest('.piui-chart-box')||svg.parentElement,details=el('details','piui-card'),select=field('Bandingkan agregasi periode',{tag:'select',options:[['','Tanpa pembanding'],...Object.entries(CHART_SERIES_BY_RANGE).map(([k,v])=>[k,v.label])]});details.append(el('summary','','Definisi metrik, sumber dan perbandingan'),el('p','piui-page-subtitle','Data contoh per 21 Oktober 2026; bukan pemantauan langsung. Volume = jumlah per bucket; latensi = p95 bucket (ms). Periode mempunyai panjang berbeda; jangan membandingkan total seolah panjangnya sama.'),select.wrap);const metrics=el('div','piui-workflow-toolbar');details.append(metrics);box.append(details);comparison={select:select.input,metrics};select.input.addEventListener('change',()=>updateComparison(svg,currentRangeKey));}
  comparison.metrics.replaceChildren();for(const key of [range,comparison.select.value].filter(Boolean)){const data=CHART_SERIES_BY_RANGE[key],card=el('article','piui-card');card.append(el('h3','piui-card__title',data.label),el('p','tabular-nums',`Total volume ${data.points.reduce((n,p)=>n+p.volume,0).toLocaleString('id-ID')} • ${data.points.length} bucket`),el('p','',`Rata-rata nilai p95 bucket: ${(data.points.reduce((n,p)=>n+p.latencyMs,0)/data.points.length).toFixed(1)} ms (bukan p95 gabungan).`));comparison.metrics.append(card);}
 }
// State Internal Apex Chart
let currentRangeKey = "today";
let currentChartMode = "area"; // "area" | "bar" | "combo"
let showVolumeSeries = true;
let showLatencySeries = true;
let pinnedPointIndex = -1;

/**
 * Menghasilkan path kurva Cubic Bezier halus (seperti ApexCharts smooth spline)
 * @param {Array<{x: number, y: number}>} pts
 */
function buildSmoothSplinePath(pts) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;

  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const midX = Math.round((p0.x + p1.x) / 2);
    d += ` C ${midX},${p0.y} ${midX},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}

/**
 * Memastikan Apex Toolbar & Live Inspector HUD terpasang di atas SVG Chart
 * @param {SVGElement} svgEl
 */
function ensureApexControls(svgEl) {
  const chartBox = svgEl.closest(".piui-chart-box") || svgEl.parentElement;
  if (!chartBox) return { hudEl: null, hudMetricsEl: null, hudStatusEl: null };

  let toolbarEl = chartBox.querySelector(".piui-apex-toolbar");
  let hudEl = chartBox.querySelector(".piui-apex-hud");

  if (!toolbarEl) {
    toolbarEl = document.createElement("div");
    toolbarEl.className = "piui-apex-toolbar";

    // 1. Series Legend Toggles (Clickable seperti ApexCharts)
    const legendGroup = document.createElement("div");
    legendGroup.className = "piui-apex-legend";
    legendGroup.setAttribute("role", "group");
    legendGroup.setAttribute("aria-label", "Filter seri data grafik");

    const btnVol = document.createElement("button");
    btnVol.type = "button";
    btnVol.className = "piui-apex-legend__btn";
    btnVol.setAttribute("aria-pressed", String(showVolumeSeries));
    const dotVol = document.createElement("span");
    dotVol.className = "piui-apex-dot";
    const lblVol = document.createElement("span");
    lblVol.textContent = "Volume Transaksi";
    btnVol.appendChild(dotVol);
    btnVol.appendChild(lblVol);

    const btnLat = document.createElement("button");
    btnLat.type = "button";
    btnLat.className = "piui-apex-legend__btn";
    btnLat.setAttribute("aria-pressed", String(showLatencySeries));
    const dotLat = document.createElement("span");
    dotLat.className = "piui-apex-dot piui-apex-dot--secondary";
    const lblLat = document.createElement("span");
    lblLat.textContent = "Latensi p95 (ms)";
    btnLat.appendChild(dotLat);
    btnLat.appendChild(lblLat);

    btnVol.addEventListener("click", () => {
      if (showVolumeSeries && !showLatencySeries) {
        showToast("Minimal satu seri data harus tetap aktif pada grafik.");
        return;
      }
      showVolumeSeries = !showVolumeSeries;
      btnVol.setAttribute("aria-pressed", String(showVolumeSeries));
      renderOperationalChart(currentRangeKey);
      announce(`Seri Volume Transaksi ${showVolumeSeries ? "ditampilkan" : "disembunyikan"}`);
    });

    btnLat.addEventListener("click", () => {
      if (showLatencySeries && !showVolumeSeries) {
        showToast("Minimal satu seri data harus tetap aktif pada grafik.");
        return;
      }
      showLatencySeries = !showLatencySeries;
      btnLat.setAttribute("aria-pressed", String(showLatencySeries));
      renderOperationalChart(currentRangeKey);
      announce(`Seri Latensi p95 ${showLatencySeries ? "ditampilkan" : "disembunyikan"}`);
    });

    legendGroup.appendChild(btnVol);
    legendGroup.appendChild(btnLat);

    // 2. Mode Switcher (Area Spline / Bar Column / Combo) + Reset & Export SVG
    const rightControls = document.createElement("div");
    rightControls.className = "piui-apex-legend";

    const modeBox = document.createElement("div");
    modeBox.className = "piui-apex-modes";
    modeBox.setAttribute("role", "group");
    modeBox.setAttribute("aria-label", "Tipe visualisasi grafik");

    const modes = [
      { id: "area", label: "Area Spline" },
      { id: "bar", label: "Bar Column" },
      { id: "combo", label: "Combo" }
    ];

    modes.forEach((m) => {
      const mBtn = document.createElement("button");
      mBtn.type = "button";
      mBtn.className = "piui-apex-mode-btn";
      mBtn.setAttribute("data-apex-mode", m.id);
      mBtn.setAttribute("aria-pressed", String(currentChartMode === m.id));
      mBtn.textContent = m.label;
      mBtn.addEventListener("click", () => {
        currentChartMode = m.id;
        modeBox.querySelectorAll("[data-apex-mode]").forEach((b) => {
          b.setAttribute("aria-pressed", String(b.getAttribute("data-apex-mode") === currentChartMode));
        });
        renderOperationalChart(currentRangeKey);
        showToast(`Tipe grafik diubah ke ${m.label}`);
      });
      modeBox.appendChild(mBtn);
    });

    const resetPinBtn = document.createElement("button");
    resetPinBtn.type = "button";
    resetPinBtn.className = "piui-btn piui-btn--secondary piui-btn--sm";
    resetPinBtn.textContent = "Reset Pin";
    resetPinBtn.title = "Lepas kunci titik data terpilih";
    resetPinBtn.addEventListener("click", () => {
      pinnedPointIndex = -1;
      renderOperationalChart(currentRangeKey);
      showToast("Kunci inspeksi titik data grafik telah direset.");
    });

    const dlSvgBtn = document.createElement("button");
    dlSvgBtn.type = "button";
    dlSvgBtn.className = "piui-btn piui-btn--secondary piui-btn--sm";
    dlSvgBtn.textContent = "Unduh SVG";
    dlSvgBtn.title = "Unduh snapshot vektor SVG grafik ini";
    dlSvgBtn.addEventListener("click", () => {
      const serializer = new XMLSerializer();
      const source = serializer.serializeToString(svgEl);
      const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `piui-zero-chart-${currentRangeKey}-${currentChartMode}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Snapshot grafik SVG berhasil diunduh.");
    });

    rightControls.appendChild(modeBox);
    rightControls.appendChild(resetPinBtn);
    rightControls.appendChild(dlSvgBtn);

    toolbarEl.appendChild(legendGroup);
    toolbarEl.appendChild(rightControls);
    chartBox.insertBefore(toolbarEl, svgEl);
  }

  if (!hudEl) {
    hudEl = document.createElement("div");
    hudEl.className = "piui-apex-hud";
    hudEl.setAttribute("aria-live", "polite");

    const metricsEl = document.createElement("div");
    metricsEl.className = "piui-apex-hud__metrics";
    metricsEl.setAttribute("data-apex-hud-metrics", "");

    const statusBadge = document.createElement("span");
    statusBadge.className = "piui-badge";
    statusBadge.setAttribute("data-status", "info");
    statusBadge.setAttribute("data-apex-hud-status", "");
    statusBadge.textContent = "Arahkan kursor (Hover) atau Klik titik data untuk mengunci";

    hudEl.appendChild(metricsEl);
    hudEl.appendChild(statusBadge);
    chartBox.insertBefore(hudEl, svgEl);
  }

  return {
    hudEl,
    hudMetricsEl: hudEl.querySelector("[data-apex-hud-metrics]"),
    hudStatusEl: hudEl.querySelector("[data-apex-hud-status]")
  };
}

function renderOperationalChart(rangeKey = "today") {
  currentRangeKey = CHART_SERIES_BY_RANGE[rangeKey] ? rangeKey : "today";
  const series = CHART_SERIES_BY_RANGE[currentRangeKey];
  const svgEl = find("piui-main-svg-chart");
  const plotGroup = find("svg-chart-plot");
  const subtitleEl = find("chart-period-label");
  const tableBody = find("chart-data-tbody");
  const rowTpl = find("tpl-chart-data-row");

  if (subtitleEl) {
    subtitleEl.textContent = series.label;
  }

  if (pinnedPointIndex >= series.points.length) {
    pinnedPointIndex = -1;
  }

  const { hudEl, hudMetricsEl, hudStatusEl } = svgEl
    ? ensureApexControls(svgEl)
    : { hudEl: null, hudMetricsEl: null, hudStatusEl: null };

  // Fungsi pembaruan HUD Bar di atas grafik
  const updateHudDisplay = (pt, index, isPinned) => {
    if (!hudMetricsEl || !hudEl) return;
    hudEl.classList.toggle("is-pinned", isPinned);

    const frag = document.createDocumentFragment();
    const createMetricItem = (label, val) => {
      const span = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = `${label}: `;
      span.appendChild(strong);
      span.appendChild(document.createTextNode(val));
      return span;
    };

    frag.appendChild(createMetricItem("Periode", pt.period));
    frag.appendChild(createMetricItem("Volume", `${pt.volume.toLocaleString("id-ID")} tx`));
    frag.appendChild(createMetricItem("Latensi p95", `${pt.latencyMs} ms`));
    frag.appendChild(createMetricItem("Galat 5xx", pt.errorRate));
    hudMetricsEl.replaceChildren(frag);

    if (hudStatusEl) {
      hudStatusEl.textContent = isPinned
        ? `📌 Terkunci pada ${pt.period} (Klik lagi untuk melepas)`
        : `🔍 Hover Aktif (${index + 1}/${series.points.length}) — Klik titik/batang untuk mengunci`;
      hudStatusEl.setAttribute("data-status", isPinned ? "success" : "info");
    }

    // Sinkronkan sorotan baris pada tabel data di bawah
    if (tableBody) {
      const rows = tableBody.querySelectorAll("tr");
      rows.forEach((r, rIdx) => {
        r.classList.toggle("is-apex-selected", rIdx === index);
      });
    }
  };

  // Tampilkan ringkasan titik terakhir secara default pada HUD
  const defaultIdx = pinnedPointIndex >= 0 ? pinnedPointIndex : series.points.length - 1;
  if (series.points[defaultIdx]) {
    updateHudDisplay(series.points[defaultIdx], defaultIdx, pinnedPointIndex >= 0);
  }

  // 1. Render Grafik SVG Interaktif (Apex-style)
  if (svgEl && plotGroup) {
    const width = 680;
    const height = 210;
    const padLeft = 52;
    const padRight = 32;
    const padTop = 22;
    const padBottom = 34;
    const innerW = width - padLeft - padRight;
    const innerH = height - padTop - padBottom;
    const baseLineY = padTop + innerH;

    const maxVol = Math.max(...series.points.map((p) => p.volume)) * 1.16;
    const maxLat = Math.max(...series.points.map((p) => p.latencyMs)) * 1.35;
    const stepX = series.points.length > 1 ? innerW / (series.points.length - 1) : innerW;

    const coords = series.points.map((pt, idx) => {
      const x = Math.round(padLeft + idx * stepX);
      const yVol = Math.round(padTop + innerH - (pt.volume / maxVol) * innerH);
      const yLat = Math.round(padTop + innerH - (pt.latencyMs / maxLat) * innerH);
      return { x, yVol, yLat, pt, idx };
    });

    const frag = document.createDocumentFragment();

    // Definisi Gradien Monokrom Halus untuk Area & Bar
    const defs = document.createElementNS(SVG_NS, "defs");
    const areaGrad = document.createElementNS(SVG_NS, "linearGradient");
    areaGrad.setAttribute("id", gradientId);
    areaGrad.setAttribute("x1", "0");
    areaGrad.setAttribute("y1", "0");
    areaGrad.setAttribute("x2", "0");
    areaGrad.setAttribute("y2", "1");

    const stop1 = document.createElementNS(SVG_NS, "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", "var(--piui-accent-primary)");
    stop1.setAttribute("stop-opacity", "0.30");
    const stop2 = document.createElementNS(SVG_NS, "stop");
    stop2.setAttribute("offset", "100%");
    stop2.setAttribute("stop-color", "var(--piui-accent-primary)");
    stop2.setAttribute("stop-opacity", "0.02");
    areaGrad.appendChild(stop1);
    areaGrad.appendChild(stop2);
    defs.appendChild(areaGrad);
    frag.appendChild(defs);

    // Label Sumbu Y Kiri (Volume)
    [1, 0.5, 0].forEach((ratio, rIdx) => {
      const yVal = Math.round((maxVol / 1.16) * ratio);
      const yPos = padTop + rIdx * (innerH / 2);
      const yTxt = document.createElementNS(SVG_NS, "text");
      yTxt.setAttribute("x", String(padLeft - 8));
      yTxt.setAttribute("y", String(yPos + 4));
      yTxt.setAttribute("text-anchor", "end");
      yTxt.setAttribute("fill", "var(--piui-text-muted)");
      yTxt.setAttribute("font-size", "10");
      yTxt.textContent = yVal >= 1000 ? `${(yVal / 1000).toFixed(0)}k` : String(yVal);
      frag.appendChild(yTxt);
    });

    // SERI 1: VOLUME TRANSAKSI (Area Spline atau Bar Column)
    if (showVolumeSeries) {
      if (currentChartMode === "bar" || currentChartMode === "combo") {
        const barWidth = Math.min(44, Math.max(18, Math.round(innerW / (coords.length * 2.2))));
        coords.forEach(({ x, yVol, idx }) => {
          const barRect = document.createElementNS(SVG_NS, "rect");
          const barH = Math.max(4, baseLineY - yVol);
          barRect.setAttribute("x", String(Math.round(x - barWidth / 2)));
          barRect.setAttribute("y", String(yVol));
          barRect.setAttribute("width", String(barWidth));
          barRect.setAttribute("height", String(barH));
          barRect.setAttribute("rx", "5");
          barRect.setAttribute("fill", "var(--piui-accent-primary)");
          barRect.setAttribute("fill-opacity", pinnedPointIndex === idx ? "0.95" : "0.72");
          barRect.setAttribute("class", `piui-apex-bar${pinnedPointIndex === idx ? " is-active" : ""}`);
          frag.appendChild(barRect);
        });
      } else {
        const volPts = coords.map((c) => ({ x: c.x, y: c.yVol }));
        const splineCmd = buildSmoothSplinePath(volPts);

        const areaPath = document.createElementNS(SVG_NS, "path");
        areaPath.setAttribute(
          "d",
          `${splineCmd} L ${coords[coords.length - 1].x},${baseLineY} L ${coords[0].x},${baseLineY} Z`
        );
        areaPath.setAttribute("fill", `url(#${gradientId})`);
        areaPath.setAttribute("class", "piui-apex-area");
        frag.appendChild(areaPath);

        const curvePath = document.createElementNS(SVG_NS, "path");
        curvePath.setAttribute("d", splineCmd);
        curvePath.setAttribute("fill", "none");
        curvePath.setAttribute("stroke", "var(--piui-accent-primary)");
        curvePath.setAttribute("stroke-width", "3");
        curvePath.setAttribute("stroke-linecap", "round");
        curvePath.setAttribute("class", "piui-apex-curve");
        frag.appendChild(curvePath);
      }
    }

    // SERI 2: LATENSI p95 (Kurva Putus-Putus / Spline Kedua)
    if (showLatencySeries) {
      const latPts = coords.map((c) => ({ x: c.x, y: c.yLat }));
      const latSpline = buildSmoothSplinePath(latPts);
      const latPath = document.createElementNS(SVG_NS, "path");
      latPath.setAttribute("d", latSpline);
      latPath.setAttribute("fill", "none");
      latPath.setAttribute("stroke", "var(--piui-text-muted)");
      latPath.setAttribute("stroke-width", "2.2");
      if (currentChartMode !== "combo") {
        latPath.setAttribute("stroke-dasharray", "6 4");
      }
      latPath.setAttribute("class", "piui-apex-curve");
      frag.appendChild(latPath);
    }

    // GARIS CROSSHAIR INTERAKTIF (Vertikal & Horizontal) + HALO AKTIF
    const crosshairV = document.createElementNS(SVG_NS, "line");
    crosshairV.setAttribute("y1", String(padTop));
    crosshairV.setAttribute("y2", String(baseLineY));
    crosshairV.setAttribute("stroke", "var(--piui-text-primary)");
    crosshairV.setAttribute("stroke-width", "1.2");
    crosshairV.setAttribute("stroke-dasharray", "3 3");
    crosshairV.setAttribute("opacity", "0");
    crosshairV.setAttribute("class", "piui-apex-crosshair");
    frag.appendChild(crosshairV);

    const crosshairH = document.createElementNS(SVG_NS, "line");
    crosshairH.setAttribute("x1", String(padLeft));
    crosshairH.setAttribute("x2", String(width - padRight));
    crosshairH.setAttribute("stroke", "var(--piui-text-muted)");
    crosshairH.setAttribute("stroke-width", "1");
    crosshairH.setAttribute("stroke-dasharray", "3 3");
    crosshairH.setAttribute("opacity", "0");
    crosshairH.setAttribute("class", "piui-apex-crosshair");
    frag.appendChild(crosshairH);

    const activeHalo = document.createElementNS(SVG_NS, "circle");
    activeHalo.setAttribute("r", "12");
    activeHalo.setAttribute("fill", "var(--piui-accent-primary)");
    activeHalo.setAttribute("fill-opacity", "0.18");
    activeHalo.setAttribute("opacity", "0");
    activeHalo.setAttribute("pointer-events", "none");
    frag.appendChild(activeHalo);

    // TITIK MARKER & LABEL SUMBU X
    const markerCircles = [];
    coords.forEach(({ x, yVol, yLat, pt, idx }) => {
      const primaryY = showVolumeSeries ? yVol : yLat;

      if (showLatencySeries && showVolumeSeries) {
        const latDot = document.createElementNS(SVG_NS, "circle");
        latDot.setAttribute("cx", String(x));
        latDot.setAttribute("cy", String(yLat));
        latDot.setAttribute("r", "3.5");
        latDot.setAttribute("fill", "var(--piui-bg-surface)");
        latDot.setAttribute("stroke", "var(--piui-text-muted)");
        latDot.setAttribute("stroke-width", "2");
        frag.appendChild(latDot);
      }

      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", String(x));
      circle.setAttribute("cy", String(primaryY));
      circle.setAttribute("r", pinnedPointIndex === idx ? "7" : "5");
      circle.setAttribute("fill", pinnedPointIndex === idx ? "var(--piui-accent-primary)" : "var(--piui-bg-surface)");
      circle.setAttribute("stroke", "var(--piui-accent-primary)");
      circle.setAttribute("stroke-width", pinnedPointIndex === idx ? "3.5" : "2.5");
      circle.setAttribute("class", `piui-apex-point${pinnedPointIndex === idx ? " is-active" : ""}`);
      frag.appendChild(circle);
      markerCircles.push(circle);

      const labelText = document.createElementNS(SVG_NS, "text");
      labelText.setAttribute("x", String(x));
      labelText.setAttribute("y", String(height - 9));
      labelText.setAttribute("text-anchor", "middle");
      labelText.setAttribute("fill", pinnedPointIndex === idx ? "var(--piui-text-primary)" : "var(--piui-text-muted)");
      labelText.setAttribute("font-size", "11");
      labelText.setAttribute("font-weight", pinnedPointIndex === idx ? "700" : "500");
      labelText.textContent = pt.period;
      frag.appendChild(labelText);
    });

    // FLOATING SVG TOOLTIP BOX (Bergaya ApexCharts di dalam kanvas SVG)
    const tooltipG = document.createElementNS(SVG_NS, "g");
    tooltipG.setAttribute("class", "piui-apex-svg-tooltip");
    tooltipG.setAttribute("opacity", "0");

    const ttBg = document.createElementNS(SVG_NS, "rect");
    ttBg.setAttribute("width", "186");
    ttBg.setAttribute("height", "58");
    ttBg.setAttribute("rx", "7");
    ttBg.setAttribute("fill", "var(--piui-bg-surface)");
    ttBg.setAttribute("stroke", "var(--piui-border-strong)");
    ttBg.setAttribute("stroke-width", "1.5");

    const ttHeader = document.createElementNS(SVG_NS, "text");
    ttHeader.setAttribute("x", "10");
    ttHeader.setAttribute("y", "18");
    ttHeader.setAttribute("fill", "var(--piui-text-primary)");
    ttHeader.setAttribute("font-size", "11");
    ttHeader.setAttribute("font-weight", "700");

    const ttLine1 = document.createElementNS(SVG_NS, "text");
    ttLine1.setAttribute("x", "10");
    ttLine1.setAttribute("y", "35");
    ttLine1.setAttribute("fill", "var(--piui-text-secondary)");
    ttLine1.setAttribute("font-size", "10.5");

    const ttLine2 = document.createElementNS(SVG_NS, "text");
    ttLine2.setAttribute("x", "10");
    ttLine2.setAttribute("y", "49");
    ttLine2.setAttribute("fill", "var(--piui-text-muted)");
    ttLine2.setAttribute("font-size", "10");

    tooltipG.appendChild(ttBg);
    tooltipG.appendChild(ttHeader);
    tooltipG.appendChild(ttLine1);
    tooltipG.appendChild(ttLine2);
    frag.appendChild(tooltipG);

    const activatePointVisuals = (idx, isPinned) => {
      const c = coords[idx];
      if (!c) return;
      const targetY = showVolumeSeries ? c.yVol : c.yLat;

      crosshairV.setAttribute("x1", String(c.x));
      crosshairV.setAttribute("x2", String(c.x));
      crosshairV.setAttribute("opacity", "1");

      crosshairH.setAttribute("y1", String(targetY));
      crosshairH.setAttribute("y2", String(targetY));
      crosshairH.setAttribute("opacity", "0.75");

      activeHalo.setAttribute("cx", String(c.x));
      activeHalo.setAttribute("cy", String(targetY));
      activeHalo.setAttribute("opacity", "1");

      markerCircles.forEach((mc, mIdx) => {
        const active = mIdx === idx || mIdx === pinnedPointIndex;
        mc.setAttribute("r", active ? "7" : "5");
        mc.setAttribute("fill", active ? "var(--piui-accent-primary)" : "var(--piui-bg-surface)");
      });

      ttHeader.textContent = `${isPinned ? "📌 " : ""}${c.pt.period}`;
      ttLine1.textContent = `Volume: ${c.pt.volume.toLocaleString("id-ID")} transaksi`;
      ttLine2.textContent = `Latensi p95: ${c.pt.latencyMs} ms • Galat: ${c.pt.errorRate}`;

      const boxW = 186;
      const boxH = 58;
      let tx = c.x + 14;
      if (tx + boxW > width - 10) {
        tx = c.x - boxW - 14;
      }
      let ty = targetY - boxH - 10;
      if (ty < 8) {
        ty = targetY + 14;
      }
      tooltipG.setAttribute("transform", `translate(${Math.round(tx)}, ${Math.round(ty)})`);
      tooltipG.setAttribute("opacity", "1");

      updateHudDisplay(c.pt, idx, isPinned);
    };

    // Jika ada titik yang sedang terkunci (pinned), tampilkan langsung
    if (pinnedPointIndex >= 0 && coords[pinnedPointIndex]) {
      activatePointVisuals(pinnedPointIndex, true);
    }

    // HIT-COLUMNS INTERAKTIF (Hoverable & Clickable + Aksesibel Keyboard)
    const hitWidth = Math.max(36, Math.round(stepX));
    coords.forEach(({ x, pt, idx }) => {
      const hitRect = document.createElementNS(SVG_NS, "rect");
      hitRect.setAttribute("x", String(Math.round(x - hitWidth / 2)));
      hitRect.setAttribute("y", String(padTop));
      hitRect.setAttribute("width", String(hitWidth));
      hitRect.setAttribute("height", String(innerH));
      hitRect.setAttribute("class", "piui-apex-hitcol");
      hitRect.setAttribute("tabindex", "0");
      hitRect.setAttribute("role", "button");
      hitRect.setAttribute(
        "aria-label",
        `Titik data ${pt.period}: Volume ${pt.volume.toLocaleString("id-ID")} transaksi, Latensi ${pt.latencyMs} ms. Klik untuk mengunci.`
      );

      const handleHover = () => {
        if (pinnedPointIndex >= 0 && pinnedPointIndex !== idx) {
          // Tetap izinkan preview saat hover, namun beri tahu ada pin aktif
          activatePointVisuals(idx, false);
        } else {
          activatePointVisuals(idx, pinnedPointIndex === idx);
        }
      };

      const handleLeave = () => {
        if (pinnedPointIndex >= 0 && coords[pinnedPointIndex]) {
          activatePointVisuals(pinnedPointIndex, true);
        } else {
          crosshairV.setAttribute("opacity", "0");
          crosshairH.setAttribute("opacity", "0");
          activeHalo.setAttribute("opacity", "0");
          tooltipG.setAttribute("opacity", "0");
          markerCircles.forEach((mc) => {
            mc.setAttribute("r", "5");
            mc.setAttribute("fill", "var(--piui-bg-surface)");
          });
        }
      };

      const handleClickPin = () => {
        if (pinnedPointIndex === idx) {
          pinnedPointIndex = -1;
          renderOperationalChart(currentRangeKey);
          showToast(`Kunci titik data ${pt.period} dilepas.`);
        } else {
          pinnedPointIndex = idx;
          renderOperationalChart(currentRangeKey);
          const detailsEl = svgEl.closest(".piui-panel")?.querySelector("details.piui-chart-details");
          if (detailsEl instanceof HTMLDetailsElement) {
            detailsEl.open = true;
          }
          showToast(
            `📌 Titik data ${pt.period} dikunci (${pt.volume.toLocaleString("id-ID")} tx • ${pt.latencyMs} ms)`
          );
        }
      };

      hitRect.addEventListener("mouseenter", handleHover);
      hitRect.addEventListener("focus", handleHover);
      hitRect.addEventListener("mouseleave", handleLeave);
      hitRect.addEventListener("blur", handleLeave);
      hitRect.addEventListener("click", handleClickPin);
      hitRect.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClickPin();
        }
      });

      frag.appendChild(hitRect);
    });

    plotGroup.replaceChildren(frag);
  }

  // 2. Perbarui Tabel Data Angka Aksesibel & Tambahkan Klik Sinkronisasi 2 Arah
  if (tableBody && rowTpl instanceof HTMLTemplateElement) {
    const tableFrag = document.createDocumentFragment();
    series.points.forEach((pt, idx) => {
      const clone = rowTpl.content.cloneNode(true);
      const trEl = clone.querySelector("tr");
      const pCell = clone.querySelector("[data-chart-col='period']");
      const vCell = clone.querySelector("[data-chart-col='volume']");
      const lCell = clone.querySelector("[data-chart-col='latency']");
      const eCell = clone.querySelector("[data-chart-col='error']");

      if (pCell) pCell.textContent = pt.period;
      if (vCell) vCell.textContent = pt.volume.toLocaleString("id-ID");
      if (lCell) lCell.textContent = `${pt.latencyMs} ms`;
      if (eCell) eCell.textContent = pt.errorRate;

      if (trEl) {
        trEl.tabIndex=0;trEl.setAttribute("role","button");trEl.setAttribute("aria-pressed",String(idx===pinnedPointIndex));trEl.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();trEl.click();tableBody.children[idx]?.focus();}});
        trEl.classList.toggle("is-apex-selected", idx === pinnedPointIndex);
        trEl.setAttribute("title", "Klik baris ini untuk menyorot titik koordinat pada grafik di atas");
        trEl.addEventListener("click", () => {
          pinnedPointIndex = pinnedPointIndex === idx ? -1 : idx;
          renderOperationalChart(currentRangeKey);
          if (pinnedPointIndex >= 0) {
            showToast(`Baris ${pt.period} disorot pada grafik SVG.`);
          }
        });
      }

      tableFrag.appendChild(clone);
    });
    tableBody.replaceChildren(tableFrag);
  }

  updateComparison(svgEl,currentRangeKey);
  renderClusterComparisonChart();
}

const CLUSTER_CHART_DATA = [
  { id: "CLS-JKT-01", name: "Jakarta Core DC-1", cpu: 38, ram: 54, p95: 36, status: "Optimal" },
  { id: "CLS-JKT-02", name: "Jakarta Selatan DC-2", cpu: 29, ram: 48, p95: 39, status: "Hot Standby" },
  { id: "CLS-SBY-01", name: "Surabaya DRC-1", cpu: 22, ram: 41, p95: 48, status: "Sinkron Real-Time" },
  { id: "CLS-BTH-01", name: "Batam Edge Gateway", cpu: 34, ram: 50, p95: 44, status: "WAF Active" }
];

let selectedClusterId = "";

/**
 * Merender Grafik Komparasi Beban Klaster Interaktif (Clickable & Hoverable seperti ApexCharts)
 * pada halaman Analitik (#piui-cluster-svg-chart)
 */
function renderClusterComparisonChart() {
  const clusterSvg = find("piui-cluster-svg-chart");
  const clusterPlot = find("svg-cluster-plot");
  const clusterHud = find("cluster-apex-hud");
  if (!clusterSvg || !clusterPlot) return;

  const width = 680;
  const height = 185;
  const padLeft = 110;
  const padRight = 40;
  const padTop = 18;
  const rowH = 38;
  const maxBarW = width - padLeft - padRight;

  const frag = document.createDocumentFragment();

  const updateClusterHud = (c, isLocked) => {
    if (!clusterHud) return;
    clusterHud.classList.toggle("is-pinned", isLocked);
    clusterHud.textContent = `${isLocked ? "📌 Klaster Terkunci: " : "🔍 Inspeksi Klaster: "}${c.id} (${c.name}) • Beban CPU: ${c.cpu}% • Beban RAM: ${c.ram}% • Latensi p95: ${c.p95} ms (${c.status})`;
  };

  CLUSTER_CHART_DATA.forEach((c, idx) => {
    const yBase = padTop + idx * rowH;
    const isSel = selectedClusterId === c.id;

    // Label Klaster Kiri
    const lbl = document.createElementNS(SVG_NS, "text");
    lbl.setAttribute("x", String(padLeft - 12));
    lbl.setAttribute("y", String(yBase + 18));
    lbl.setAttribute("text-anchor", "end");
    lbl.setAttribute("fill", isSel ? "var(--piui-text-primary)" : "var(--piui-text-secondary)");
    lbl.setAttribute("font-size", "11");
    lbl.setAttribute("font-weight", isSel ? "700" : "600");
    lbl.textContent = c.id;
    frag.appendChild(lbl);

    // Track Background
    const track = document.createElementNS(SVG_NS, "rect");
    track.setAttribute("x", String(padLeft));
    track.setAttribute("y", String(yBase + 4));
    track.setAttribute("width", String(maxBarW));
    track.setAttribute("height", "22");
    track.setAttribute("rx", "5");
    track.setAttribute("fill", "var(--piui-bg-elevated)");
    frag.appendChild(track);

    // Bar RAM (Lebih lebar, abu-abu muda)
    const ramW = Math.round((c.ram / 100) * maxBarW);
    const ramBar = document.createElementNS(SVG_NS, "rect");
    ramBar.setAttribute("x", String(padLeft));
    ramBar.setAttribute("y", String(yBase + 4));
    ramBar.setAttribute("width", String(ramW));
    ramBar.setAttribute("height", "22");
    ramBar.setAttribute("rx", "5");
    ramBar.setAttribute("fill", "var(--piui-text-muted)");
    ramBar.setAttribute("fill-opacity", isSel ? "0.55" : "0.32");
    ramBar.setAttribute("class", "piui-apex-bar");
    frag.appendChild(ramBar);

    // Bar CPU (Utama, monokrom gelap)
    const cpuW = Math.round((c.cpu / 100) * maxBarW);
    const cpuBar = document.createElementNS(SVG_NS, "rect");
    cpuBar.setAttribute("x", String(padLeft));
    cpuBar.setAttribute("y", String(yBase + 7));
    cpuBar.setAttribute("width", String(cpuW));
    cpuBar.setAttribute("height", "16");
    cpuBar.setAttribute("rx", "4");
    cpuBar.setAttribute("fill", "var(--piui-accent-primary)");
    cpuBar.setAttribute("fill-opacity", isSel ? "1" : "0.82");
    cpuBar.setAttribute("class", `piui-apex-bar${isSel ? " is-active" : ""}`);
    frag.appendChild(cpuBar);

    // Label Persentase di ujung bar
    const valTxt = document.createElementNS(SVG_NS, "text");
    valTxt.setAttribute("x", String(padLeft + ramW + 8));
    valTxt.setAttribute("y", String(yBase + 19));
    valTxt.setAttribute("fill", "var(--piui-text-primary)");
    valTxt.setAttribute("font-size", "10.5");
    valTxt.setAttribute("font-weight", "600");
    valTxt.textContent = `${c.cpu}% CPU / ${c.ram}% RAM (${c.p95}ms)`;
    frag.appendChild(valTxt);

    // Area Interaktif Hover & Klik
    const hitRow = document.createElementNS(SVG_NS, "rect");
    hitRow.setAttribute("x", "10");
    hitRow.setAttribute("y", String(yBase));
    hitRow.setAttribute("width", String(width - 20));
    hitRow.setAttribute("height", String(rowH - 4));
    hitRow.setAttribute("rx", "6");
    hitRow.setAttribute("class", "piui-apex-hitcol");
    hitRow.setAttribute("tabindex", "0");
    hitRow.setAttribute("role", "button");
    hitRow.setAttribute("aria-label", `Klaster ${c.id}: ${c.cpu}% CPU, ${c.ram}% RAM. Klik untuk menyorot di tabel.`);

    hitRow.addEventListener("mouseenter", () => updateClusterHud(c, selectedClusterId === c.id));
    hitRow.addEventListener("focus", () => updateClusterHud(c, selectedClusterId === c.id));
    hitRow.setAttribute("data-cluster-key",c.id);hitRow.setAttribute("aria-pressed",String(selectedClusterId===c.id));
    hitRow.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();hitRow.dispatchEvent(new MouseEvent("click",{bubbles:true}));clusterPlot.querySelector(`[data-cluster-key="${c.id}"]`)?.focus();}});
    hitRow.addEventListener("click", () => {
      selectedClusterId = selectedClusterId === c.id ? "" : c.id;
      renderClusterComparisonChart();
      // Sorot baris klaster yang cocok pada tabel di bawahnya
      const clusterRows = root.querySelectorAll("table[data-piui-table='analytics'] tbody tr");
      clusterRows.forEach((tr) => {
        tr.classList.toggle("is-apex-selected", tr.getAttribute("data-row-id") === selectedClusterId);
      });
      if (selectedClusterId) {
        updateClusterHud(c, true);
        showToast(`📌 Klaster ${c.id} dipilih dan disorot pada tabel matriks.`);
      } else {
        showToast("Seleksi klaster pada grafik direset.");
      }
    });

    frag.appendChild(hitRow);
  });

  clusterPlot.replaceChildren(frag);
}


 return {render:renderOperationalChart,clusters:renderClusterComparisonChart};
}
