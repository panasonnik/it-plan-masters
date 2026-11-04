'use strict';

const { mean } = require('./statistics');

//для чорно-білого друку
const STYLES = {
  FIFO: { name: 'FIFO', color: '#6b7280', dash: '', marker: 'circle' },
  EDD: { name: 'правило Джексона', color: '#2563eb', dash: '10 5', marker: 'square' },
  WSPT: { name: 'правило Сміта', color: '#d97706', dash: '12 5 2 5', marker: 'triangle' },
  DYNAMIC_RATIO: { name: 'динамічний пріоритет', color: '#059669', dash: '1 6', marker: 'diamond' },
};
const X_LABEL = 'Завантаженість адміністратора ρ';
const Y_LABEL = 'Z̄, людино-хв за період';
const FONT = 'font-family="Arial" fill="#111"';

function escapeXml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function text(x, y, value, { size = 12, anchor = 'middle', rotate = false } = {}) {
  const transform = rotate ? ` transform="rotate(-90 ${x} ${y})"` : '';
  return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" ${FONT}${transform}>${escapeXml(value)}</text>`;
}

function ticks(min, max) {
  const raw = (max - min) / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw);
  const list = [];

  for (let value = Math.ceil(min / step) * step; value <= max + step / 1e6; value += step) {
    list.push(Math.round(value / step) * step);
  }

  return list;
}

function formatTick(value) {
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString('uk-UA').replace(/ /g, ' ');
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

function marker(style, x, y) {
  const r = 5;
  const fill = `fill="${style.color}"`;
  if (style.marker === 'square') return `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" ${fill}/>`;
  if (style.marker === 'triangle') return `<polygon points="${x},${y - r - 1} ${x - r - 1},${y + r} ${x + r + 1},${y + r}" ${fill}/>`;
  if (style.marker === 'diamond') return `<polygon points="${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}" ${fill}/>`;
  return `<circle cx="${x}" cy="${y}" r="${r}" ${fill}/>`;
}

function strokeOf(style) {
  const dash = style.dash ? ` stroke-dasharray="${style.dash}" stroke-linecap="round"` : '';
  return `stroke="${style.color}" stroke-width="2.5"${dash}`;
}

function panel(box, { title, series, xDomain, yDomain }) {
  const left = box.x + 95;
  const top = box.y + 34;
  const width = box.width - 110;
  const height = box.height - 90;
  const sx = (x) => left + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * width;
  const sy = (y) => top + height - ((y - yDomain[0]) / (yDomain[1] - yDomain[0])) * height;
  const parts = [text(box.x + box.width / 2, box.y + 20, title, { size: 18 })];

  for (const y of ticks(yDomain[0], yDomain[1])) {
    parts.push(`<line x1="${left}" x2="${left + width}" y1="${sy(y)}" y2="${sy(y)}" stroke="#e5e7eb"/>`);
    parts.push(text(left - 6, sy(y) + 5, formatTick(y), { size: 16, anchor: 'end' }));
  }

  for (const x of ticks(xDomain[0], xDomain[1])) {
    parts.push(text(sx(x), top + height + 20, formatTick(x), { size: 16 }));
  }

  parts.push(`<rect x="${left}" y="${top}" width="${width}" height="${height}" fill="none" stroke="#9ca3af"/>`);
  parts.push(text(left + width / 2, top + height + 46, X_LABEL, { size: 18 }));
  parts.push(text(box.x + 18, top + height / 2, Y_LABEL, { size: 18, rotate: true }));

  series.forEach((line, index) => {
    const dodge = (index - (series.length - 1) / 2) * 5;
    const points = line.points.map((p) => `${sx(p.x) + dodge},${sy(p.y)}`).join(' ');
    parts.push(`<polyline points="${points}" fill="none" ${strokeOf(line.style)}/>`);

    for (const p of line.points) {
      if (p.low !== undefined) {
        parts.push(`<line x1="${sx(p.x) + dodge}" x2="${sx(p.x) + dodge}" y1="${sy(p.low)}" y2="${sy(p.high)}" stroke="${line.style.color}" stroke-width="1.5"/>`);
      }
      parts.push(marker(line.style, sx(p.x) + dodge, sy(p.y)));
    }
  });

  return parts.join('\n');
}

function legend(chartWidth, y, rules) {
  const items = rules.map((rule) => ({ style: STYLES[rule], width: 48 + STYLES[rule].name.length * 10 }));
  const gap = 28;
  let left = (chartWidth - items.reduce((sum, item) => sum + item.width, 0) - gap * (items.length - 1)) / 2;

  return items
    .map((item) => {
      const sample = [
        `<line x1="${left}" x2="${left + 40}" y1="${y - 6}" y2="${y - 6}" ${strokeOf(item.style)}/>`,
        marker(item.style, left + 20, y - 6),
        text(left + 48, y, item.style.name, { size: 18, anchor: 'start' }),
      ].join('');
      left += item.width + gap;
      return sample;
    })
    .join('\n');
}

function svgDocument(width, height, title, body) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#fff"/>`,
    text(width / 2, 28, title, { size: 20 }),
    body,
    '</svg>',
    '',
  ].join('\n');
}

function domain(values, includeZero = false) {
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (includeZero) min = Math.min(0, min);
  const pad = (max - min) * 0.06 || 1;
  return [includeZero && min === 0 ? 0 : min - pad, max + pad];
}

function meanChart(summary, config) {
  const series = config.rules.map((rule) => ({
    style: STYLES[rule],
    points: summary
      .filter((row) => row.algorithm === rule)
      .map((row) => ({ x: row.rhoActual, y: row.mean, low: row.low, high: row.high })),
  }));
  const all = series.flatMap((line) => line.points);
  const body = [
    panel(
      { x: 0, y: 40, width: 900, height: 520 },
      {
        title: `Інтервал Z̄ ± z·s/√N з імовірністю ${config.confidence * 100} %`,
        series,
        xDomain: domain(all.map((p) => p.x)),
        yDomain: domain([...all.map((p) => p.low), ...all.map((p) => p.high)], true),
      }
    ),
    legend(900, 588, config.rules),
  ].join('\n');

  return svgDocument(900, 600, 'Середні втрати Z̄ залежно від завантаженості ρ', body);
}

function convergenceChart(records, summary, config, convergenceN) {
  const counts = config.convergence.runs.map((n) => (n === 'N' ? convergenceN : n));
  const levels = [...new Set(summary.map((row) => row.rho))];
  const measured = new Map(summary.map((row) => [row.rho, row.rhoActual]));
  const panels = [];

  for (const n of counts) {
    for (const [name, from] of [['A', 1], ['B', convergenceN + 1]]) {
      const to = from + n - 1;
      const series = config.rules.map((rule) => ({
        style: STYLES[rule],
        points: levels.map((rho) => {
          const z = records.filter((r) => r.rho === rho && r.algorithm === rule && r.seed >= from && r.seed <= to);
          return { x: measured.get(rho), y: mean(z.map((r) => r.z)) };
        }),
      }));
      panels.push({ title: `n = ${n}, серія ${name} (прогони ${from}…${to})`, series });
    }
  }

  const all = panels.flatMap((p) => p.series.flatMap((line) => line.points));
  const xDomain = domain(all.map((p) => p.x));
  const yDomain = domain(all.map((p) => p.y), true);
  const height = 300;
  const body = panels.map((p, index) =>
    panel(
      { x: (index % 2) * 450, y: 40 + Math.floor(index / 2) * height, width: 450, height },
      { ...p, xDomain, yDomain }
    )
  );
  const totalHeight = 40 + Math.ceil(panels.length / 2) * height + 40;
  body.push(legend(900, totalHeight - 15, config.rules));

  return svgDocument(900, totalHeight, `Збіжність середнього Z̄ зі зростанням кількості прогонів (N = ${convergenceN})`, body.join('\n'));
}

module.exports = { meanChart, convergenceChart };
