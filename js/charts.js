import { formatShortDay, formatMonthDay, formatCurrency } from './store.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, text = '') {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, String(v));
  }
  if (text) node.textContent = text;
  return node;
}

function niceMax(val) {
  if (val <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(val)));
  const norm = val / exp;
  let step;
  if (norm <= 1.2) step = 1.2;
  else if (norm <= 1.5) step = 1.5;
  else if (norm <= 2) step = 2;
  else if (norm <= 3) step = 3;
  else if (norm <= 5) step = 5;
  else if (norm <= 8) step = 8;
  else step = 10;
  return Math.ceil(step * exp);
}

function compactNum(val, currency) {
  if (val >= 100000) return `${currency}${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `${currency}${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
  return `${currency}${Math.round(val)}`;
}

/**
 * Task Completion Bar Chart (Weekly 7-day or Monthly 30-day)
 * Styled after the sleek dark-track + emerald/blue bar aesthetic.
 */
export function renderTaskBarChart(container, series, { selectedDate, onSelectDate, showTooltip, hideTooltip }) {
  container.innerHTML = '';
  const width = 560;
  const height = 220;
  const pad = { top: 14, right: 12, bottom: 28, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none' });

  // Horizontal gridlines & Y labels (0% to 100%)
  const ticks = [0, 25, 50, 75, 100];
  for (const t of ticks) {
    const y = pad.top + plotH - (t / 100) * plotH;
    svg.appendChild(
      el('line', {
        x1: pad.left,
        x2: width - pad.right,
        y1: y,
        y2: y,
        stroke: 'rgba(255,255,255,0.07)',
        'stroke-width': 1,
      })
    );
    svg.appendChild(
      el(
        'text',
        {
          x: pad.left - 8,
          y: y + 4,
          'text-anchor': 'end',
          fill: '#8b95a5',
          'font-size': 11,
        },
        `${t}%`
      )
    );
  }

  const count = series.length;
  const isMonthly = count > 10;
  const slotW = plotW / count;
  const barW = isMonthly ? Math.max(6, slotW * 0.62) : Math.min(46, slotW * 0.54);

  series.forEach((item, idx) => {
    const cx = pad.left + idx * slotW + slotW / 2;
    const x = cx - barW / 2;
    const isSelected = item.date === selectedDate;
    const barH = (item.rate / 100) * plotH;
    const barY = pad.top + plotH - barH;

    const g = el('g', { class: 'chart-bar-hit' });

    // Background track
    g.appendChild(
      el('rect', {
        x,
        y: pad.top,
        width: barW,
        height: plotH,
        rx: isMonthly ? 2 : 4,
        fill: '#262933',
      })
    );

    // Value bar
    if (barH > 0) {
      g.appendChild(
        el('rect', {
          class: 'bar-rect',
          x,
          y: barY,
          width: barW,
          height: barH,
          rx: isMonthly ? 2 : 4,
          fill: isSelected ? '#3b82f6' : '#2ea043',
        })
      );
    } else if (isSelected) {
      // Subtle bottom indicator for selected day at 0%
      g.appendChild(
        el('rect', {
          x,
          y: pad.top + plotH - 3,
          width: barW,
          height: 3,
          rx: 1.5,
          fill: '#3b82f6',
        })
      );
    }

    // X-axis label
    const showLabel = !isMonthly || idx === 0 || idx === count - 1 || idx % 5 === 0 || isSelected;
    if (showLabel) {
      const label = isMonthly ? formatMonthDay(item.date).replace(' ', ' ') : formatShortDay(item.date);
      svg.appendChild(
        el(
          'text',
          {
            x: cx,
            y: height - 6,
            'text-anchor': 'middle',
            fill: isSelected ? '#60a5fa' : '#9aa3b2',
            'font-size': isMonthly ? 10 : 12,
            'font-weight': isSelected ? '700' : '500',
          },
          label
        )
      );
    }

    // Transparent full-column hit target
    g.appendChild(
      el('rect', {
        x: pad.left + idx * slotW,
        y: pad.top,
        width: slotW,
        height: plotH + 20,
        fill: 'transparent',
      })
    );

    g.addEventListener('mouseenter', (ev) => {
      showTooltip(
        ev,
        `<div class="tt-title">${formatMonthDay(item.date)} (${formatShortDay(item.date)})</div>
         <div class="tt-row"><span>Completion</span><strong>${item.rate}%</strong></div>
         <div class="tt-row"><span>Finished</span><strong>${item.completed} / ${item.total}</strong></div>`
      );
    });
    g.addEventListener('mousemove', (ev) => {
      showTooltip(ev);
    });
    g.addEventListener('mouseleave', hideTooltip);
    g.addEventListener('click', () => {
      if (onSelectDate) onSelectDate(item.date);
    });

    svg.appendChild(g);
  });

  container.appendChild(svg);
}

/**
 * Expense Trend Bar Chart (Weekly 7-day or Monthly 30-day)
 */
export function renderExpenseBarChart(
  container,
  series,
  { selectedDate, currency, onSelectDate, showTooltip, hideTooltip }
) {
  container.innerHTML = '';
  const width = 560;
  const height = 220;
  const pad = { top: 14, right: 12, bottom: 28, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none' });

  const rawMax = Math.max(...series.map((s) => s.total), 0);
  const maxVal = niceMax(rawMax);
  const avgVal = series.length ? series.reduce((a, b) => a + b.total, 0) / series.length : 0;

  // Gridlines
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const val = (maxVal / steps) * i;
    const y = pad.top + plotH - (i / steps) * plotH;
    svg.appendChild(
      el('line', {
        x1: pad.left,
        x2: width - pad.right,
        y1: y,
        y2: y,
        stroke: 'rgba(255,255,255,0.07)',
        'stroke-width': 1,
      })
    );
    svg.appendChild(
      el(
        'text',
        {
          x: pad.left - 8,
          y: y + 4,
          'text-anchor': 'end',
          fill: '#8b95a5',
          'font-size': 10.5,
        },
        compactNum(val, currency)
      )
    );
  }

  const count = series.length;
  const isMonthly = count > 10;
  const slotW = plotW / count;
  const barW = isMonthly ? Math.max(6, slotW * 0.62) : Math.min(46, slotW * 0.54);

  series.forEach((item, idx) => {
    const cx = pad.left + idx * slotW + slotW / 2;
    const x = cx - barW / 2;
    const isSelected = item.date === selectedDate;
    const barH = maxVal > 0 ? (item.total / maxVal) * plotH : 0;
    const barY = pad.top + plotH - barH;

    const g = el('g', { class: 'chart-bar-hit' });

    // Background track
    g.appendChild(
      el('rect', {
        x,
        y: pad.top,
        width: barW,
        height: plotH,
        rx: isMonthly ? 2 : 4,
        fill: '#262933',
      })
    );

    if (barH > 0) {
      g.appendChild(
        el('rect', {
          class: 'bar-rect',
          x,
          y: barY,
          width: barW,
          height: barH,
          rx: isMonthly ? 2 : 4,
          fill: isSelected ? '#3b82f6' : '#f59e0b',
        })
      );
    }

    const showLabel = !isMonthly || idx === 0 || idx === count - 1 || idx % 5 === 0 || isSelected;
    if (showLabel) {
      const label = isMonthly ? formatMonthDay(item.date) : formatShortDay(item.date);
      svg.appendChild(
        el(
          'text',
          {
            x: cx,
            y: height - 6,
            'text-anchor': 'middle',
            fill: isSelected ? '#60a5fa' : '#9aa3b2',
            'font-size': isMonthly ? 10 : 12,
            'font-weight': isSelected ? '700' : '500',
          },
          label
        )
      );
    }

    g.appendChild(
      el('rect', {
        x: pad.left + idx * slotW,
        y: pad.top,
        width: slotW,
        height: plotH + 20,
        fill: 'transparent',
      })
    );

    g.addEventListener('mouseenter', (ev) => {
      showTooltip(
        ev,
        `<div class="tt-title">${formatMonthDay(item.date)} (${formatShortDay(item.date)})</div>
         <div class="tt-row"><span>Spent</span><strong>${formatCurrency(item.total, currency)}</strong></div>
         <div class="tt-row"><span>Entries</span><strong>${item.count}</strong></div>`
      );
    });
    g.addEventListener('mousemove', (ev) => showTooltip(ev));
    g.addEventListener('mouseleave', hideTooltip);
    g.addEventListener('click', () => {
      if (onSelectDate) onSelectDate(item.date);
    });

    svg.appendChild(g);
  });

  // Dashed average line
  if (avgVal > 0 && maxVal > 0) {
    const avgY = pad.top + plotH - (avgVal / maxVal) * plotH;
    svg.appendChild(
      el('line', {
        x1: pad.left,
        x2: width - pad.right,
        y1: avgY,
        y2: avgY,
        stroke: 'rgba(148, 163, 184, 0.55)',
        'stroke-width': 1.2,
        'stroke-dasharray': '4 4',
      })
    );
  }

  container.appendChild(svg);
}

/**
 * Spending by Category Donut + Progress Bars
 */
export function renderCategoryBreakdown(donutContainer, barsContainer, breakdown, { total, currency }) {
  donutContainer.innerHTML = '';
  barsContainer.innerHTML = '';

  const size = 156;
  const cx = size / 2;
  const cy = size / 2;
  const r = 56;
  const circ = 2 * Math.PI * r;

  const svg = el('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size });

  // Base ring
  svg.appendChild(
    el('circle', {
      cx,
      cy,
      r,
      fill: 'none',
      stroke: '#262933',
      'stroke-width': 18,
    })
  );

  if (total > 0 && breakdown.length > 0) {
    let offset = 0;
    for (const cat of breakdown) {
      const frac = cat.amount / total;
      const segLen = Math.max(0, frac * circ);
      svg.appendChild(
        el('circle', {
          cx,
          cy,
          r,
          fill: 'none',
          stroke: cat.color,
          'stroke-width': 18,
          'stroke-dasharray': `${segLen} ${circ}`,
          'stroke-dashoffset': -offset,
          transform: `rotate(-90 ${cx} ${cy})`,
        })
      );
      offset += segLen;
    }
  }

  // Center text
  svg.appendChild(
    el(
      'text',
      {
        x: cx,
        y: cy - 3,
        'text-anchor': 'middle',
        fill: '#9aa3b2',
        'font-size': 10,
      },
      'TOTAL'
    )
  );
  svg.appendChild(
    el(
      'text',
      {
        x: cx,
        y: cy + 16,
        'text-anchor': 'middle',
        fill: '#f1f5f9',
        'font-size': 15,
        'font-weight': 700,
      },
      compactNum(total, currency)
    )
  );

  donutContainer.appendChild(svg);

  if (!breakdown.length) {
    barsContainer.innerHTML = `<div class="empty-state">No expenses recorded in this period yet.</div>`;
    return;
  }

  for (const cat of breakdown.slice(0, 6)) {
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML = `
      <div class="cat-row-top">
        <span class="cat-name">
          <span class="cat-dot" style="background:${cat.color}"></span>
          <span>${cat.icon} ${cat.name}</span>
        </span>
        <span class="cat-amount">${formatCurrency(cat.amount, currency)} (${cat.pct}%)</span>
      </div>
      <div class="cat-track">
        <div class="cat-fill" style="width:${cat.pct}%;background:${cat.color}"></div>
      </div>
    `;
    barsContainer.appendChild(row);
  }
}
