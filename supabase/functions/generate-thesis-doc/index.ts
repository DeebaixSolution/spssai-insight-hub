import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map section keywords to analysis block categories/test_types for inline injection
const sectionKeywordMap: Record<string, string[]> = {
  descriptive: ['descriptive', 'normality', 'frequencies', 'sample'],
  correlation: ['correlation', 'spearman', 'pearson', 'kendall'],
  regression: ['regression'],
  hypothesis: ['hypothesis', 'compare', 'anova', 'manova', 'parametric', 'nonparametric', 't-test', 'mann-whitney', 'wilcoxon', 'kruskal'],
  reliability: ['reliability', 'cronbach', 'measurement', 'factor'],
  diagnostics: ['diagnostic', 'residual', 'collinearity', 'vif'],
};

function matchBlockToSection(heading: string, block: any): boolean {
  const headingLower = heading.toLowerCase();
  for (const [, keywords] of Object.entries(sectionKeywordMap)) {
    const headingMatches = keywords.some(kw => headingLower.includes(kw));
    if (!headingMatches) continue;
    const blockMatches = keywords.some(kw =>
      (block.test_type || '').toLowerCase().includes(kw) ||
      (block.test_category || '').toLowerCase().includes(kw)
    );
    if (blockMatches) return true;
  }
  return false;
}

function renderHeatmapHtml(chart: any, figNum: { value: number }): string {
  if (chart.type !== 'heatmap' || !Array.isArray(chart.data)) return '';
  const heatData = chart.data as Array<{ var1: string; var2: string; r: number; p: number }>;
  const allVars = [...new Set(heatData.flatMap((d: any) => [d.var1, d.var2]))];
  
  const getColor = (r: number) => {
    if (r > 0.7) return '#2563eb';
    if (r > 0.3) return '#60a5fa';
    if (r > 0.1) return '#93c5fd';
    if (r > -0.1) return '#e5e7eb';
    if (r > -0.3) return '#fca5a5';
    if (r > -0.7) return '#ef4444';
    return '#dc2626';
  };

  let html = `<p class="no-indent" style="font-style: italic;">Figure 4.${figNum.value}: ${chart.title || 'Correlation Heatmap'}</p>`;
  html += '<table style="font-size: 9pt;">';
  html += `<tr><th></th>${allVars.map(v => `<th style="text-align:center; max-width:60px;">${v}</th>`).join('')}</tr>`;
  for (const v1 of allVars) {
    html += '<tr>';
    html += `<td style="font-weight:bold;">${v1}</td>`;
    for (const v2 of allVars) {
      if (v1 === v2) {
        html += `<td style="text-align:center; background:${getColor(1)}; color:white; font-weight:bold;">1.00</td>`;
      } else {
        const cell = heatData.find((d: any) => (d.var1 === v1 && d.var2 === v2) || (d.var1 === v2 && d.var2 === v1));
        const r = cell?.r ?? 0;
        const color = Math.abs(r) > 0.5 ? 'white' : 'black';
        html += `<td style="text-align:center; background:${getColor(r)}; color:${color};">${r.toFixed(2)}</td>`;
      }
    }
    html += '</tr>';
  }
  html += '</table>';
  figNum.value++;
  return html;
}

function renderBlockTablesHtml(block: any, tableNum: { value: number }, figNum: { value: number }): string {
  let html = '';
  if (block.results?.tables) {
    for (const table of block.results.tables) {
      html += `<p class="no-indent" style="font-style: italic;">Table 4.${tableNum.value}: ${table.title || block.test_type}</p>`;
      html += `<table>`;
      if (table.headers) {
        html += `<tr>${table.headers.map((h: string) => `<th>${h}</th>`).join('')}</tr>`;
      }
      if (table.rows) {
        for (const row of table.rows) {
          if (Array.isArray(row)) {
            html += `<tr>${row.map((c: any) => `<td>${c ?? ''}</td>`).join('')}</tr>`;
          } else {
            const rowKeys = Object.keys(row);
            const vals = table.headers
              ? table.headers.map((h: string) => {
                  if (row[h] !== undefined) return row[h];
                  const k = rowKeys.find((rk: string) => rk.toLowerCase() === h.toLowerCase());
                  return k !== undefined ? row[k] : '';
                })
              : Object.values(row);
            html += `<tr>${vals.map((c: any) => `<td>${typeof c === 'number' ? Number(c).toFixed(3) : (c ?? '')}</td>`).join('')}</tr>`;
          }
        }
      }
      html += `</table>`;
      tableNum.value++;
    }
  } else if (block.results?.statistics && typeof block.results.statistics === 'object') {
    html += `<p class="no-indent" style="font-style: italic;">Table 4.${tableNum.value}: ${block.test_type}</p>`;
    html += `<table><tr><th>Statistic</th><th>Value</th></tr>`;
    for (const [k, v] of Object.entries(block.results.statistics)) {
      html += `<tr><td>${k}</td><td>${typeof v === 'number' ? Number(v).toFixed(3) : String(v ?? '')}</td></tr>`;
    }
    html += `</table>`;
    tableNum.value++;
  }

  // Render charts (heatmaps as HTML tables, others as figure references)
  if (block.results?.charts && Array.isArray(block.results.charts)) {
    for (const chart of block.results.charts) {
      if (chart.type === 'heatmap') {
        html += renderHeatmapHtml(chart, figNum);
      } else if (chart.title) {
        html += `<p class="no-indent" style="font-style: italic;">Figure 4.${figNum.value}: ${chart.title}</p>`;
        if (chart.type === 'boxplot' && chart.data) {
          const bp = chart.data;
          html += `<table style="font-size: 9pt;"><tr><th>Statistic</th><th>Value</th></tr>`;
          for (const [label, val] of [['Max', bp.max], ['Upper Whisker', bp.upperWhisker], ['Q3', bp.q3], ['Median', bp.median], ['Mean', bp.mean], ['Q1', bp.q1], ['Lower Whisker', bp.lowerWhisker], ['Min', bp.min]]) {
            html += `<tr><td>${label}</td><td>${typeof val === 'number' ? Number(val).toFixed(3) : val}</td></tr>`;
          }
          if (bp.outliers?.length) html += `<tr><td>Outliers</td><td>${bp.outliers.length}</td></tr>`;
          html += `</table>`;
        } else {
          html += `<p class="no-indent"><em>[See visualization in application]</em></p>`;
        }
        figNum.value++;
      }
    }
  }

  if (block.narrative?.apa) html += `<p>${block.narrative.apa}</p>`;
  if (block.narrative?.interpretation && block.narrative.interpretation !== block.narrative.apa) html += `<p>${block.narrative.interpretation}</p>`;
  return html;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisId, format, isPro, chapter4Text, chapter5Text, citations, analysisBlocks, chapterFilter } = await req.json();

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 2; margin: 1in; }
  h1 { font-size: 16pt; font-weight: bold; text-align: center; page-break-before: always; margin-top: 2in; }
  h1:first-child { page-break-before: avoid; }
  h2 { font-size: 14pt; font-weight: bold; margin-top: 24pt; }
  h3 { font-size: 12pt; font-weight: bold; font-style: italic; }
  p { text-indent: 0.5in; margin: 0 0 12pt 0; text-align: justify; }
  p.no-indent { text-indent: 0; }
  p.center { text-align: center; text-indent: 0; }
  p.hanging { text-indent: -0.5in; padding-left: 0.5in; }
  table { border-collapse: collapse; width: 100%; margin: 12pt 0; font-size: 10pt; }
  th, td { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4pt 8pt; text-align: left; }
  th { font-weight: bold; border-bottom: 2px solid #000; }
  tr:first-child th { border-top: 2px solid #000; }
  .watermark { text-align: center; color: #999; font-size: 10pt; margin-top: 2in; }
  .page-break { page-break-after: always; }
</style>
</head>
<body>`;

    const blocks = analysisBlocks && Array.isArray(analysisBlocks) ? analysisBlocks : [];
    const usedBlockIds = new Set<string>();
    const tableNum = { value: 1 };
    const figNum = { value: 1 };

    // ==================== APPENDIX MODE ====================
    if (chapterFilter === 'appendix') {
      html += `<div style="text-align: center; margin-top: 3in;">
  <p class="center" style="font-size: 16pt; font-weight: bold;">APPENDIX</p>
  <p class="center" style="margin-top: 1in;">Full SPSS Statistical Analysis Output</p>
</div>
<div class="page-break"></div>`;

      html += `<h1>APPENDIX: FULL SPSS ANALYSIS OUTPUT</h1>`;

      // Group blocks by category
      const categoryOrder = ['descriptive', 'correlation', 'regression', 'compare-means', 'nonparametric', 'anova-glm', 'reliability', 'measurement-validation'];
      const categoryLabels: Record<string, string> = {
        'descriptive': 'Descriptive Statistics & Normality',
        'correlation': 'Correlation Analysis',
        'regression': 'Regression Analysis',
        'compare-means': 'Parametric Tests (Mean Comparisons)',
        'nonparametric': 'Non-Parametric Tests',
        'anova-glm': 'ANOVA / GLM',
        'reliability': 'Reliability Analysis',
        'measurement-validation': 'Measurement Validation (EFA/KMO)',
      };

      let appendixLetter = 'A';
      for (const cat of categoryOrder) {
        const catBlocks = blocks.filter((b: any) => b.test_category === cat);
        if (catBlocks.length === 0) continue;

        html += `<h2>Appendix ${appendixLetter}: ${categoryLabels[cat] || cat}</h2>`;
        for (const block of catBlocks) {
          html += `<h3>${block.test_type}</h3>`;
          html += renderBlockTablesHtml(block, tableNum, figNum);
        }
        appendixLetter = String.fromCharCode(appendixLetter.charCodeAt(0) + 1);
      }

      // Catch any blocks not in known categories
      const usedCats = new Set(categoryOrder);
      const remainingBlocks = blocks.filter((b: any) => !usedCats.has(b.test_category));
      if (remainingBlocks.length > 0) {
        html += `<h2>Appendix ${appendixLetter}: Additional Analyses</h2>`;
        for (const block of remainingBlocks) {
          html += `<h3>${block.test_type}</h3>`;
          html += renderBlockTablesHtml(block, tableNum, figNum);
        }
      }

      if (!isPro) {
        html += `<div class="watermark"><p class="center">Generated by SPSS AI Platform — Upgrade to PRO for full export</p></div>`;
      }

      html += `</body></html>`;
      return new Response(JSON.stringify({ content: html, format: 'html' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== STANDARD THESIS MODE ====================
    // Title page
    html += `<div style="text-align: center; margin-top: 3in;">
  <p class="center" style="font-size: 16pt; font-weight: bold;">THESIS DOCUMENT</p>
  <p class="center" style="margin-top: 1in;">Results and Discussion</p>
</div>
<div class="page-break"></div>`;

    // Chapter 4
    if (chapterFilter !== 'chapter5') {
      html += `<h1>CHAPTER 4</h1>
<h2>RESULTS AND DATA ANALYSIS</h2>`;

      if (chapter4Text) {
        const ch4Lines = String(chapter4Text).split('\n');
        let pendingHeading = '';
        for (const line of ch4Lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('## ')) {
            pendingHeading = trimmed.replace(/^##\s*/, '');
            html += `<h2>${pendingHeading}</h2>`;
            // Inject matching block tables after this heading
            for (const block of blocks) {
              if (usedBlockIds.has(block.id)) continue;
              if (matchBlockToSection(pendingHeading, block)) {
                html += renderBlockTablesHtml(block, tableNum, figNum);
                usedBlockIds.add(block.id);
              }
            }
          } else if (trimmed.startsWith('### ')) {
            html += `<h3>${trimmed.replace(/^###\s*/, '')}</h3>`;
          } else {
            html += `<p>${trimmed}</p>`;
          }
        }
      } else {
        html += `<p>Chapter 4 content not available.</p>`;
      }

      // Append any remaining unused blocks at the end
      for (const block of blocks) {
        if (usedBlockIds.has(block.id)) continue;
        html += renderBlockTablesHtml(block, tableNum, figNum);
        usedBlockIds.add(block.id);
      }

      html += `<div class="page-break"></div>`;
    }

    // Chapter 5
    if (chapterFilter !== 'chapter4') {
      html += `<h1>CHAPTER 5</h1>
<h2>DISCUSSION AND CONCLUSION</h2>`;

      if (chapter5Text) {
        const ch5Lines = String(chapter5Text).split('\n');
        for (const line of ch5Lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('## ')) {
            html += `<h2>${trimmed.replace(/^##\s*/, '')}</h2>`;
          } else if (trimmed.startsWith('### ')) {
            html += `<h3>${trimmed.replace(/^###\s*/, '')}</h3>`;
          } else {
            html += `<p>${trimmed}</p>`;
          }
        }
      } else {
        html += `<p>Chapter 5 content not available.</p>`;
      }
    }

    // References (PRO only)
    if (isPro && citations && citations.length > 0) {
      html += `<div class="page-break"></div>`;
      html += `<h1>REFERENCES</h1>`;
      const sortedCitations = [...citations].sort((a: any, b: any) => 
        (a.author || '').localeCompare(b.author || '')
      );
      for (const c of sortedCitations) {
        html += `<p class="hanging">${c.author} (${c.year}). ${c.title}. <em>${c.journal || ''}</em>.`;
        if (c.doi) html += ` https://doi.org/${c.doi}`;
        html += `</p>`;
      }
    }

    // Watermark for free users
    if (!isPro) {
      html += `<div class="watermark"><p class="center">Generated by SPSS AI Platform — Upgrade to PRO for full export</p></div>`;
    }

    html += `</body></html>`;

    return new Response(JSON.stringify({ content: html, format: 'html' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
