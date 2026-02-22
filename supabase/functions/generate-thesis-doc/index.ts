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

// ========== CHART DATA TABLE RENDERERS ==========

function renderHistogramTableHtml(chart: any, figNum: { value: number }): string {
  if (!chart.data?.bins || !Array.isArray(chart.data.bins)) return '';
  let html = `<p class="no-indent" style="font-style: italic;">Figure 4.${figNum.value}: ${chart.title || 'Histogram'}</p>`;
  html += '<table style="font-size: 9pt;">';
  html += '<tr><th>Bin Range</th><th style="text-align:right;">Count</th><th style="text-align:right;">Normal Expected</th></tr>';
  for (const bin of chart.data.bins) {
    const range = `${Number(bin.binStart).toFixed(1)} – ${Number(bin.binEnd).toFixed(1)}`;
    html += `<tr><td>${range}</td><td style="text-align:right;">${bin.count ?? ''}</td><td style="text-align:right;">${typeof bin.normalExpected === 'number' ? bin.normalExpected.toFixed(2) : ''}</td></tr>`;
  }
  html += '</table>';
  html += `<p class="no-indent" style="font-size: 9pt; font-style: italic;">* Note: Interactive visualization available in application. Data values presented above.</p>`;
  figNum.value++;
  return html;
}

function renderQQPlotTableHtml(chart: any, figNum: { value: number }): string {
  if (!Array.isArray(chart.data)) return '';
  const points = chart.data.slice(0, 20);
  let html = `<p class="no-indent" style="font-style: italic;">Figure 4.${figNum.value}: ${chart.title || 'Q-Q Plot'}</p>`;
  html += '<table style="font-size: 9pt;">';
  html += '<tr><th style="text-align:right;">Theoretical</th><th style="text-align:right;">Observed</th></tr>';
  for (const pt of points) {
    html += `<tr><td style="text-align:right;">${typeof pt.theoretical === 'number' ? pt.theoretical.toFixed(3) : pt.theoretical}</td><td style="text-align:right;">${typeof pt.observed === 'number' ? pt.observed.toFixed(3) : pt.observed}</td></tr>`;
  }
  if (chart.data.length > 20) html += `<tr><td colspan="2" style="font-style:italic;">... ${chart.data.length - 20} additional points omitted</td></tr>`;
  html += '</table>';
  html += `<p class="no-indent" style="font-size: 9pt; font-style: italic;">* Note: Interactive visualization available in application. Data values presented above.</p>`;
  figNum.value++;
  return html;
}

function renderScatterTableHtml(chart: any, figNum: { value: number }): string {
  if (!Array.isArray(chart.data)) return '';
  const points = chart.data.slice(0, 30);
  let html = `<p class="no-indent" style="font-style: italic;">Figure 4.${figNum.value}: ${chart.title || 'Scatter Plot'}</p>`;
  html += '<table style="font-size: 9pt;">';
  html += '<tr><th style="text-align:right;">X</th><th style="text-align:right;">Y</th></tr>';
  for (const pt of points) {
    html += `<tr><td style="text-align:right;">${typeof pt.x === 'number' ? pt.x.toFixed(3) : pt.x}</td><td style="text-align:right;">${typeof pt.y === 'number' ? pt.y.toFixed(3) : pt.y}</td></tr>`;
  }
  if (chart.data.length > 30) html += `<tr><td colspan="2" style="font-style:italic;">... ${chart.data.length - 30} additional points omitted</td></tr>`;
  html += '</table>';
  html += `<p class="no-indent" style="font-size: 9pt; font-style: italic;">* Note: Interactive visualization available in application. Data values presented above.</p>`;
  figNum.value++;
  return html;
}

function renderBarTableHtml(chart: any, figNum: { value: number }): string {
  if (!Array.isArray(chart.data)) return '';
  let html = `<p class="no-indent" style="font-style: italic;">Figure 4.${figNum.value}: ${chart.title || 'Bar Chart'}</p>`;
  html += '<table style="font-size: 9pt;">';
  const keys = Object.keys(chart.data[0] || {});
  const labelKey = keys.find(k => ['group', 'name', 'label', 'category'].includes(k.toLowerCase())) || keys[0];
  const valueKey = keys.find(k => !['group', 'name', 'label', 'category'].includes(k.toLowerCase())) || keys[1];
  html += `<tr><th>${labelKey}</th><th style="text-align:right;">${valueKey}</th></tr>`;
  for (const item of chart.data) {
    html += `<tr><td>${item[labelKey] ?? ''}</td><td style="text-align:right;">${typeof item[valueKey] === 'number' ? item[valueKey].toFixed(3) : (item[valueKey] ?? '')}</td></tr>`;
  }
  html += '</table>';
  html += `<p class="no-indent" style="font-size: 9pt; font-style: italic;">* Note: Interactive visualization available in application. Data values presented above.</p>`;
  figNum.value++;
  return html;
}

function renderLineTableHtml(chart: any, figNum: { value: number }): string {
  if (!Array.isArray(chart.data)) return '';
  let html = `<p class="no-indent" style="font-style: italic;">Figure 4.${figNum.value}: ${chart.title || 'Line Chart'}</p>`;
  html += '<table style="font-size: 9pt;">';
  const keys = Object.keys(chart.data[0] || {});
  const xKey = keys.find(k => ['component', 'x', 'name', 'fpr'].includes(k.toLowerCase())) || keys[0];
  const yKey = keys.find(k => ['eigenvalue', 'y', 'value', 'tpr'].includes(k.toLowerCase())) || keys[1];
  html += `<tr><th>${xKey}</th><th style="text-align:right;">${yKey}</th></tr>`;
  for (const item of chart.data) {
    html += `<tr><td>${item[xKey] ?? ''}</td><td style="text-align:right;">${typeof item[yKey] === 'number' ? item[yKey].toFixed(3) : (item[yKey] ?? '')}</td></tr>`;
  }
  html += '</table>';
  html += `<p class="no-indent" style="font-size: 9pt; font-style: italic;">* Note: Interactive visualization available in application. Data values presented above.</p>`;
  figNum.value++;
  return html;
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

function renderBoxplotTableHtml(chart: any, figNum: { value: number }): string {
  if (!chart.data) return '';
  const bp = chart.data;
  let html = `<p class="no-indent" style="font-style: italic;">Figure 4.${figNum.value}: ${chart.title || 'Boxplot'}</p>`;
  html += `<table style="font-size: 9pt;"><tr><th>Statistic</th><th style="text-align:right;">Value</th></tr>`;
  for (const [label, val] of [['Max', bp.max], ['Upper Whisker', bp.upperWhisker], ['Q3', bp.q3], ['Median', bp.median], ['Mean', bp.mean], ['Q1', bp.q1], ['Lower Whisker', bp.lowerWhisker], ['Min', bp.min]] as [string, any][]) {
    html += `<tr><td>${label}</td><td style="text-align:right;">${typeof val === 'number' ? Number(val).toFixed(3) : (val ?? '')}</td></tr>`;
  }
  if (bp.outliers?.length) html += `<tr><td>Outliers</td><td style="text-align:right;">${bp.outliers.length}</td></tr>`;
  html += `</table>`;
  figNum.value++;
  return html;
}

// ========== RENDER CHART DISPATCH ==========

function renderChartHtml(chart: any, figNum: { value: number }): string {
  if (!chart?.type) return '';
  switch (chart.type) {
    case 'heatmap': return renderHeatmapHtml(chart, figNum);
    case 'histogram': return renderHistogramTableHtml(chart, figNum);
    case 'qq-plot': return renderQQPlotTableHtml(chart, figNum);
    case 'scatter': return renderScatterTableHtml(chart, figNum);
    case 'bar': return renderBarTableHtml(chart, figNum);
    case 'line': case 'scree': return renderLineTableHtml(chart, figNum);
    case 'boxplot': return renderBoxplotTableHtml(chart, figNum);
    default:
      if (chart.title) {
        let html = `<p class="no-indent" style="font-style: italic;">Figure 4.${figNum.value}: ${chart.title}</p>`;
        html += `<p class="no-indent"><em>[Chart data type "${chart.type}" — see application for interactive visualization]</em></p>`;
        figNum.value++;
        return html;
      }
      return '';
  }
}

// ========== TABLE FOOTNOTES ==========

function renderTableFootnotes(block: any): string {
  let html = '';
  // Check if any table has p-values to add significance footnotes
  const hasPValues = block.results?.tables?.some((t: any) => 
    t.rows?.some((r: any) => {
      const row = typeof r === 'object' ? r : {};
      return row.p !== undefined || row['p-value'] !== undefined || row['Sig.'] !== undefined;
    })
  );
  if (hasPValues) {
    html += `<p class="no-indent" style="font-size: 9pt; font-style: italic;">*p < .05. **p < .01. ***p < .001.</p>`;
  }
  // Add hypothesis decision if available in narrative
  if (block.narrative?.hypothesis_decision) {
    html += `<p class="no-indent" style="font-size: 9pt; font-style: italic;">Note. ${block.narrative.hypothesis_decision}</p>`;
  }
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
      // Add footnotes after each table
      html += renderTableFootnotes(block);
      tableNum.value++;
    }
  } else if (block.results?.statistics && typeof block.results.statistics === 'object') {
    html += `<p class="no-indent" style="font-style: italic;">Table 4.${tableNum.value}: ${block.test_type}</p>`;
    html += `<table><tr><th>Statistic</th><th>Value</th></tr>`;
    for (const [k, v] of Object.entries(block.results.statistics)) {
      html += `<tr><td>${k}</td><td>${typeof v === 'number' ? Number(v).toFixed(3) : String(v ?? '')}</td></tr>`;
    }
    html += `</table>`;
    html += renderTableFootnotes(block);
    tableNum.value++;
  }

  // Render ALL charts as HTML data tables
  if (block.results?.charts && Array.isArray(block.results.charts)) {
    for (const chart of block.results.charts) {
      html += renderChartHtml(chart, figNum);
    }
  }

  // Render narrative - support both structured and simple formats
  if (block.narrative?.methodology) html += `<p>${block.narrative.methodology}</p>`;
  if (block.narrative?.statistical_result) html += `<p>${block.narrative.statistical_result}</p>`;
  if (block.narrative?.effect_interpretation) html += `<p>${block.narrative.effect_interpretation}</p>`;
  if (block.narrative?.assumption_report) html += `<p>${block.narrative.assumption_report}</p>`;
  if (block.narrative?.posthoc_report) html += `<p>${block.narrative.posthoc_report}</p>`;
  if (block.narrative?.graph_interpretation) html += `<p>${block.narrative.graph_interpretation}</p>`;
  if (block.narrative?.hypothesis_decision) html += `<p>${block.narrative.hypothesis_decision}</p>`;
  // Fallback to simple apa/interpretation
  if (!block.narrative?.methodology) {
    if (block.narrative?.apa) html += `<p>${block.narrative.apa}</p>`;
    if (block.narrative?.interpretation && block.narrative.interpretation !== block.narrative.apa) html += `<p>${block.narrative.interpretation}</p>`;
  }
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
      html += renderAppendixContent(blocks, tableNum, figNum);

      if (!isPro) {
        html += `<div class="watermark"><p class="center">Generated by SPSS AI Platform — Upgrade to PRO for full export</p></div>`;
      }

      html += `</body></html>`;
      return new Response(JSON.stringify({ content: html, format: 'html' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== UNIFIED "ALL" MODE ====================
    if (chapterFilter === 'all') {
      // Title page
      html += `<div style="text-align: center; margin-top: 3in;">
  <p class="center" style="font-size: 18pt; font-weight: bold;">COMPLETE THESIS DOCUMENT</p>
  <p class="center" style="margin-top: 0.5in; font-size: 14pt;">Results, Discussion, and Appendix</p>
  <p class="center" style="margin-top: 2in; font-size: 10pt;">Generated by SPSS AI Academic Platform</p>
</div>
<div class="page-break"></div>`;

      // Table of Contents
      html += `<h1 style="page-break-before: avoid;">TABLE OF CONTENTS</h1>`;
      html += `<p class="no-indent">Chapter 4: Results and Data Analysis</p>`;
      html += `<p class="no-indent">Chapter 5: Discussion and Conclusion</p>`;
      html += `<p class="no-indent">Appendix: Full SPSS Analysis Output</p>`;
      if (citations?.length > 0) html += `<p class="no-indent">References</p>`;
      html += `<div class="page-break"></div>`;

      // Chapter 4
      html += `<h1>CHAPTER 4</h1><h2>RESULTS AND DATA ANALYSIS</h2>`;
      if (chapter4Text) {
        html += renderChapterText(chapter4Text, blocks, usedBlockIds, tableNum, figNum);
      } else {
        html += `<p>Chapter 4 content not available.</p>`;
      }
      for (const block of blocks) {
        if (usedBlockIds.has(block.id)) continue;
        html += renderBlockTablesHtml(block, tableNum, figNum);
        usedBlockIds.add(block.id);
      }
      html += `<div class="page-break"></div>`;

      // Chapter 5
      html += `<h1>CHAPTER 5</h1><h2>DISCUSSION AND CONCLUSION</h2>`;
      if (chapter5Text) {
        html += renderPlainChapterText(chapter5Text);
      } else {
        html += `<p>Chapter 5 content not available.</p>`;
      }
      html += `<div class="page-break"></div>`;

      // Appendix
      html += `<h1>APPENDIX</h1><h2>FULL SPSS ANALYSIS OUTPUT</h2>`;
      const appTableNum = { value: 1 };
      const appFigNum = { value: 1 };
      html += renderAppendixContent(blocks, appTableNum, appFigNum);
      html += `<div class="page-break"></div>`;

      // References
      if (isPro && citations && citations.length > 0) {
        html += `<h1>REFERENCES</h1>`;
        const sortedCitations = [...citations].sort((a: any, b: any) => (a.author || '').localeCompare(b.author || ''));
        for (const c of sortedCitations) {
          html += `<p class="hanging">${c.author} (${c.year}). ${c.title}. <em>${c.journal || ''}</em>.`;
          if (c.doi) html += ` https://doi.org/${c.doi}`;
          html += `</p>`;
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
        html += renderChapterText(chapter4Text, blocks, usedBlockIds, tableNum, figNum);
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
        html += renderPlainChapterText(chapter5Text);
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

// ========== HELPER: Render chapter text with inline block injection ==========
function renderChapterText(text: string, blocks: any[], usedBlockIds: Set<string>, tableNum: { value: number }, figNum: { value: number }): string {
  let html = '';
  const lines = String(text).split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('## ')) {
      const heading = trimmed.replace(/^##\s*/, '');
      html += `<h2>${heading}</h2>`;
      for (const block of blocks) {
        if (usedBlockIds.has(block.id)) continue;
        if (matchBlockToSection(heading, block)) {
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
  return html;
}

// ========== HELPER: Render plain chapter text ==========
function renderPlainChapterText(text: string): string {
  let html = '';
  const lines = String(text).split('\n');
  for (const line of lines) {
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
  return html;
}

// ========== HELPER: Render appendix content ==========
function renderAppendixContent(blocks: any[], tableNum: { value: number }, figNum: { value: number }): string {
  let html = '';
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
  return html;
}
