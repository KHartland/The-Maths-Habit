// Generate diagram HTML - uses PNG images for AQA-style diagrams
export const generateDiagram = (type) => {
  // Image-based diagrams (AQA exam style)
  const imageDiagrams = {
    'distance-time-1': 'distane time graph 1.png',
    'distance-time-2': 'distance time graph 2.png',
    'distance-time-3': 'distance time graph 3.png',
    'plot-a-graph': 'Plot a graph.png',
    'football-pictogram': 'football pictogram.png',
    'scatter-graph': 'Scatter graph.png',
    'pythagoras': 'Pythagoras.png',
    'pythagoras-2': 'pythagoras 2.png',
    'pythagoras-3': 'Pythagoras 3.png',
    'tea-coffee': 'tea-coffee.png',
    'dual-bar-chart': 'dual bar chart.png',
    'spinners': 'spinners.png',
    'isosceles-triangle': 'Isoceles triangle missing angle.png',
    'isosceles-40': 'Isoceles 40.png',
    'isosceles-50': 'Isoceles 50.png',
    'pythagoras-shorter': 'pythagoras shorter side.png',
    'pythag-3-4': 'pythag-3-4.png',
    'pythag-5-13': 'pythag-5-13.png',
    'trig-30-hyp10': 'trig-30-hyp10.png',
    'trig-opp5-adj12': 'trig-opp5-adj12.png',
    'G10-semicircle-35': 'G10-semicircle-35.png',
    'G10-centre-circum-140': 'G10-centre-circum-140.png',
    'G10-cyclic-quad-85': 'G10-cyclic-quad-85.png',
    'G10-centre-circum-130': 'G10-centre-circum-130.png',
    'G10-cyclic-quad-110': 'G10-cyclic-quad-110.png',
    'G10-alt-segment-65': 'G10-alt-segment-65.png',
    'G10-tangent-chord-55': 'G10-tangent-chord-55.png',
    'G10-tangent-chord-72': 'G10-tangent-chord-72.png',
    'G10-two-tangents-60': 'G10-two-tangents-60.png',
    'G10-tangent-length': 'G10-tangent-length.png',
    // Batch 3: G17 Sectors & Circles
    'G17-semicircle-r7': 'G17-semicircle-r7.png',
    'G17-semicircle-d10': 'G17-semicircle-d10.png',
    'G17-quarter-circle-r4': 'G17-quarter-circle-r4.png',
    'G17-sector-45-r8': 'G17-sector-45-r8.png',
    'G17-sector-60-r6': 'G17-sector-60-r6.png',
    'G17-sector-120-r9': 'G17-sector-120-r9.png',
    'G17-sector-36-r10': 'G17-sector-36-r10.png',
    'G17-segment-90-r6': 'G17-segment-90-r6.png',
  };

  // Check for image-based diagram first
  if (imageDiagrams[type]) {
    return `<div class="rounded-lg p-4 mx-auto max-w-md" style="background:#1a1525"><img src="/images/${imageDiagrams[type]}" alt="${type}" class="w-full h-auto mx-auto" style="filter:invert(1) hue-rotate(180deg);opacity:0.9" /></div>`;
  }

  // Fallback SVG diagrams for legacy questions (white-on-dark theme)
  const svgDiagrams = {
    parallel: `<svg viewBox="0 0 200 120" class="w-full h-32">
      <line x1="20" y1="30" x2="180" y2="30" stroke="#e2e8f0" stroke-width="2"/>
      <line x1="20" y1="90" x2="180" y2="90" stroke="#e2e8f0" stroke-width="2"/>
      <line x1="50" y1="10" x2="150" y2="110" stroke="#a78bfa" stroke-width="2"/>
      <text x="70" y="45" fill="#a78bfa" font-size="14">70°</text>
      <text x="110" y="85" fill="#e2e8f0" font-size="14">?</text>
    </svg>`,
    pythagoras: `<svg viewBox="0 0 200 150" class="w-full h-32">
      <polygon points="30,120 170,120 30,30" fill="none" stroke="#e2e8f0" stroke-width="2"/>
      <rect x="30" y="110" width="10" height="10" fill="none" stroke="#e2e8f0"/>
      <text x="90" y="140" fill="#e2e8f0" font-size="14">4 cm</text>
      <text x="10" y="80" fill="#e2e8f0" font-size="14">3 cm</text>
      <text x="100" y="70" fill="#a78bfa" font-size="14">?</text>
    </svg>`,
    triangle: `<svg viewBox="0 0 200 150" class="w-full h-32">
      <polygon points="30,120 170,120 170,30" fill="none" stroke="#e2e8f0" stroke-width="2"/>
      <rect x="160" y="110" width="10" height="10" fill="none" stroke="#e2e8f0"/>
      <text x="90" y="140" fill="#e2e8f0" font-size="14">adj = 3</text>
      <text x="175" y="80" fill="#e2e8f0" font-size="14">opp = 4</text>
      <text x="40" y="110" fill="#a78bfa" font-size="14">θ</text>
    </svg>`,
  };
  // Table-of-values diagrams (AQA style)
  if (type && type.startsWith('table:')) {
    const data = type.slice(6); // e.g. "y=2x+1|-1,0,1,2|?,1,?,5"
    const [equation, xVals, yVals] = data.split('|');
    const xs = xVals.split(',');
    const ys = yVals.split(',');
    const cells = xs.map((x, i) => `<td style="border:2px solid #64748b;padding:8px 14px;text-align:center;font-weight:${ys[i] === '?' ? 'bold' : 'normal'};color:${ys[i] === '?' ? '#a78bfa' : '#e2e8f0'};font-size:1.1em">${ys[i]}</td>`).join('');
    const xCells = xs.map(x => `<td style="border:2px solid #64748b;padding:8px 14px;text-align:center;color:#e2e8f0;font-size:1.1em">${x}</td>`).join('');
    return `<table style="border-collapse:collapse;margin:0 auto;background:#1e293b;border-radius:8px;overflow:hidden">
      <tr><td style="border:2px solid #64748b;padding:8px 14px;font-weight:bold;color:#94a3b8;font-size:1.1em">x</td>${xCells}</tr>
      <tr><td style="border:2px solid #64748b;padding:8px 14px;font-weight:bold;color:#94a3b8;font-size:1.1em">y</td>${cells}</tr>
    </table>`;
  }

  // Tally chart diagrams (AQA style)
  if (type && type.startsWith('tally:')) {
    const raw = type.slice(6); // e.g. "Red:6,Blue:5,Green:4|Colour"
    const parts = raw.split('|');
    const data = parts[0];
    const headerLabel = parts[1] || 'Colour';
    const items = data.split(',').map(item => {
      const [label, count] = item.split(':');
      const n = parseInt(count);
      let tally = '';
      const groups = Math.floor(n / 5);
      const remainder = n % 5;
      for (let g = 0; g < groups; g++) tally += '<span style="text-decoration:line-through;letter-spacing:2px">||||</span> ';
      for (let r = 0; r < remainder; r++) tally += '|';
      return { label: label.trim(), count: n, tally: tally.trim() };
    });
    const rows = items.map(item => `<tr>
      <td style="border:2px solid #64748b;padding:8px 14px;color:#e2e8f0;font-size:1.05em">${item.label}</td>
      <td style="border:2px solid #64748b;padding:8px 14px;color:#e2e8f0;font-size:1.1em;font-family:monospace;letter-spacing:1px">${item.tally}</td>
      <td style="border:2px solid #64748b;padding:8px 14px;text-align:center;color:#e2e8f0;font-size:1.05em">${item.count}</td>
    </tr>`).join('');
    return `<table style="border-collapse:collapse;margin:0 auto;background:#1e293b;border-radius:8px;overflow:hidden">
      <tr>
        <th style="border:2px solid #64748b;padding:8px 14px;font-weight:bold;color:#94a3b8;font-size:1em">${headerLabel}</th>
        <th style="border:2px solid #64748b;padding:8px 14px;font-weight:bold;color:#94a3b8;font-size:1em">Tally</th>
        <th style="border:2px solid #64748b;padding:8px 14px;font-weight:bold;color:#94a3b8;font-size:1em">Frequency</th>
      </tr>${rows}
    </table>`;
  }

  return svgDiagrams[type] || null;
};
