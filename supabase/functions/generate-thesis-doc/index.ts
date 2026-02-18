import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisId, format, isPro, chapter4Text, chapter5Text, citations, analysisBlocks, chapterFilter } = await req.json();

    // Build HTML document with Word-compatible formatting
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
  table caption { text-align: left; font-style: italic; margin-bottom: 6pt; }
  th, td { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4pt 8pt; text-align: left; }
  th { font-weight: bold; border-bottom: 2px solid #000; }
  tr:first-child th { border-top: 2px solid #000; }
  .watermark { text-align: center; color: #999; font-size: 10pt; margin-top: 2in; }
  .page-break { page-break-after: always; }
</style>
</head>
<body>`;

    // Title page
    html += `<div style="text-align: center; margin-top: 3in;">
  <p class="center" style="font-size: 16pt; font-weight: bold;">THESIS DOCUMENT</p>
  <p class="center" style="margin-top: 1in;">Results and Discussion</p>
</div>
<div class="page-break"></div>`;

    // Chapter 4 (skip if chapter5 only)
    if (chapterFilter !== 'chapter5') {
      html += `<h1>CHAPTER 4</h1>
<h2>RESULTS AND DATA ANALYSIS</h2>`;

      if (chapter4Text) {
        const ch4Lines = String(chapter4Text).split('\n');
        for (const line of ch4Lines) {
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
        html += `<p>Chapter 4 content not available.</p>`;
      }

      // Insert analysis block tables embedded in chapter
      if (analysisBlocks && Array.isArray(analysisBlocks)) {
        let tableNum = 1;
        for (const block of analysisBlocks) {
          if (block.results?.tables) {
            for (const table of block.results.tables) {
              html += `<p class="no-indent" style="font-style: italic;">Table 4.${tableNum}: ${table.title || block.test_type}</p>`;
              html += `<table>`;
              if (table.headers) {
                html += `<tr>${table.headers.map((h: string) => `<th>${h}</th>`).join('')}</tr>`;
              }
              if (table.rows) {
                for (const row of table.rows) {
                  if (Array.isArray(row)) {
                    html += `<tr>${row.map((c: any) => `<td>${c ?? ''}</td>`).join('')}</tr>`;
                  } else {
                    // Case-insensitive key lookup: header "Variable" matches row key "variable"
                    const rowKeys = Object.keys(row);
                    const vals = table.headers
                      ? table.headers.map((h: string) => {
                          if (row[h] !== undefined) return row[h];
                          const k = rowKeys.find(rk => rk.toLowerCase() === h.toLowerCase());
                          return k !== undefined ? row[k] : '';
                        })
                      : Object.values(row);
                    html += `<tr>${vals.map((c: any) => `<td>${c ?? ''}</td>`).join('')}</tr>`;
                  }
                }
              }
              html += `</table>`;
              tableNum++;
            }
          }
          if (block.narrative?.apa) html += `<p>${block.narrative.apa}</p>`;
          if (block.narrative?.interpretation) html += `<p>${block.narrative.interpretation}</p>`;
        }
      }

      html += `<div class="page-break"></div>`;
    }

    // Chapter 5 (skip if chapter4 only)
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
