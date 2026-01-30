import "https://deno.land/std@0.168.0/dotenv/load.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportRequest {
  format: 'docx' | 'pdf';
  projectName: string;
  researchQuestion: string;
  testType?: string;
  testCategory?: string;
  variables?: { name: string; label?: string; type: string }[];
  results: {
    tables: Array<{
      title: string;
      headers: string[];
      rows: (string | number)[][];
    }>;
    charts?: Array<{ type: string; title: string }>;
    summary?: string;
  } | null;
  aiInterpretation: string;
  apaResults: string;
  discussion: string;
  methodology?: string;
  sections: string[];
}

function formatDate(): string {
  const date = new Date();
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function generateTableText(table: { title: string; headers: string[]; rows: (string | number)[][] }): string {
  let text = `\n### ${table.title}\n\n`;
  
  // Calculate column widths
  const widths = table.headers.map((h, i) => {
    const headerLen = String(h).length;
    const maxDataLen = Math.max(...table.rows.map(r => String(r[i] ?? '').length));
    return Math.max(headerLen, maxDataLen, 10);
  });
  
  // Header row
  text += '| ' + table.headers.map((h, i) => String(h).padEnd(widths[i])).join(' | ') + ' |\n';
  text += '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |\n';
  
  // Data rows
  for (const row of table.rows) {
    text += '| ' + row.map((cell, i) => {
      const val = cell === null || cell === undefined ? '-' : String(cell);
      return val.padEnd(widths[i]);
    }).join(' | ') + ' |\n';
  }
  
  return text;
}

function generateHTMLTable(table: { title: string; headers: string[]; rows: (string | number)[][] }): string {
  let html = `<h3 style="margin-top: 24px; margin-bottom: 12px; color: #1a1a2e;">${table.title}</h3>`;
  html += '<table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11pt;">';
  
  // Header
  html += '<thead><tr style="background-color: #f8f9fa;">';
  for (const header of table.headers) {
    html += `<th style="border: 1px solid #dee2e6; padding: 8px 12px; text-align: left; font-weight: 600;">${header}</th>`;
  }
  html += '</tr></thead>';
  
  // Body
  html += '<tbody>';
  for (const row of table.rows) {
    html += '<tr>';
    for (const cell of row) {
      const val = cell === null || cell === undefined ? '-' : String(cell);
      html += `<td style="border: 1px solid #dee2e6; padding: 8px 12px;">${val}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  
  return html;
}

function generateMarkdownReport(data: ReportRequest): string {
  const sections = data.sections;
  let report = '';
  
  // Title Page
  report += `# ${data.projectName || 'Analysis Report'}\n\n`;
  report += `**Date:** ${formatDate()}\n\n`;
  
  if (data.researchQuestion) {
    report += `**Research Question:** ${data.researchQuestion}\n\n`;
  }
  
  if (data.testType) {
    report += `**Analysis Type:** ${data.testType}\n\n`;
  }
  
  report += '---\n\n';
  
  // Methodology Section
  if (sections.includes('methodology') && data.methodology) {
    report += '## Methodology\n\n';
    report += data.methodology + '\n\n';
    report += '---\n\n';
  }
  
  // Methods Section
  if (sections.includes('methods')) {
    report += '## Methods\n\n';
    
    if (data.testType) {
      report += `**Statistical Test:** ${data.testType}\n\n`;
    }
    
    if (data.testCategory) {
      report += `**Test Category:** ${data.testCategory}\n\n`;
    }
    
    if (data.variables && data.variables.length > 0) {
      report += '### Variables Used\n\n';
      report += '| Variable | Label | Type |\n';
      report += '| -------- | ----- | ---- |\n';
      for (const v of data.variables) {
        report += `| ${v.name} | ${v.label || '-'} | ${v.type} |\n`;
      }
      report += '\n';
    }
    
    report += '---\n\n';
  }
  
  // Results Section
  if (sections.includes('results') && data.results) {
    report += '## Results\n\n';
    
    if (data.results.summary) {
      report += data.results.summary + '\n\n';
    }
    
    if (data.results.tables && data.results.tables.length > 0) {
      for (const table of data.results.tables) {
        report += generateTableText(table);
        report += '\n';
      }
    }
    
    if (data.results.charts && data.results.charts.length > 0) {
      report += `\n*${data.results.charts.length} chart(s) were generated for this analysis.*\n\n`;
    }
    
    report += '---\n\n';
  }
  
  // Interpretation Section
  if (sections.includes('interpretation') && data.aiInterpretation) {
    report += '## Summary Interpretation\n\n';
    report += data.aiInterpretation + '\n\n';
    report += '---\n\n';
  }
  
  // APA Results Section
  if (sections.includes('apa') && data.apaResults) {
    report += '## APA-Style Results\n\n';
    report += data.apaResults + '\n\n';
    report += '---\n\n';
  }
  
  // Discussion Section
  if (sections.includes('discussion') && data.discussion) {
    report += '## Discussion\n\n';
    report += data.discussion + '\n\n';
    report += '---\n\n';
  }
  
  // Footer
  report += '\n\n---\n\n';
  report += `*Report generated by SPSS AI Assistant on ${formatDate()}*\n`;
  
  return report;
}

function generateHTMLReport(data: ReportRequest): string {
  const sections = data.sections;
  
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.projectName || 'Analysis Report'}</title>
  <style>
    @page {
      margin: 1in;
      size: A4;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #1a1a2e;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    h1 {
      font-size: 24pt;
      text-align: center;
      margin-bottom: 8px;
      color: #1a1a2e;
    }
    h2 {
      font-size: 16pt;
      margin-top: 32px;
      margin-bottom: 16px;
      color: #1a1a2e;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
    }
    h3 {
      font-size: 13pt;
      margin-top: 24px;
      margin-bottom: 12px;
    }
    .title-page {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 1px solid #e5e7eb;
    }
    .meta {
      color: #6b7280;
      font-size: 11pt;
      margin-bottom: 8px;
    }
    .section {
      margin-bottom: 32px;
    }
    p {
      margin-bottom: 12px;
      text-align: justify;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 10pt;
      color: #6b7280;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 11pt;
    }
    th, td {
      border: 1px solid #dee2e6;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f8f9fa;
      font-weight: 600;
    }
    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
`;

  // Title Page
  html += '<div class="title-page">';
  html += `<h1>${data.projectName || 'Analysis Report'}</h1>`;
  html += `<p class="meta">Date: ${formatDate()}</p>`;
  if (data.researchQuestion) {
    html += `<p class="meta"><strong>Research Question:</strong> ${data.researchQuestion}</p>`;
  }
  if (data.testType) {
    html += `<p class="meta"><strong>Analysis Type:</strong> ${data.testType}</p>`;
  }
  html += '</div>';

  // Methodology Section
  if (sections.includes('methodology') && data.methodology) {
    html += '<div class="section">';
    html += '<h2>Methodology</h2>';
    html += `<p>${data.methodology.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    html += '</div>';
  }

  // Methods Section
  if (sections.includes('methods')) {
    html += '<div class="section">';
    html += '<h2>Methods</h2>';
    
    if (data.testType) {
      html += `<p><strong>Statistical Test:</strong> ${data.testType}</p>`;
    }
    if (data.testCategory) {
      html += `<p><strong>Test Category:</strong> ${data.testCategory}</p>`;
    }
    
    if (data.variables && data.variables.length > 0) {
      html += '<h3>Variables Used</h3>';
      html += '<table><thead><tr><th>Variable</th><th>Label</th><th>Type</th></tr></thead><tbody>';
      for (const v of data.variables) {
        html += `<tr><td>${v.name}</td><td>${v.label || '-'}</td><td>${v.type}</td></tr>`;
      }
      html += '</tbody></table>';
    }
    
    html += '</div>';
  }

  // Results Section
  if (sections.includes('results') && data.results) {
    html += '<div class="section">';
    html += '<h2>Results</h2>';
    
    if (data.results.summary) {
      html += `<p>${data.results.summary}</p>`;
    }
    
    if (data.results.tables && data.results.tables.length > 0) {
      for (const table of data.results.tables) {
        html += generateHTMLTable(table);
      }
    }
    
    if (data.results.charts && data.results.charts.length > 0) {
      html += `<p><em>${data.results.charts.length} chart(s) were generated for this analysis.</em></p>`;
    }
    
    html += '</div>';
  }

  // Interpretation Section
  if (sections.includes('interpretation') && data.aiInterpretation) {
    html += '<div class="section">';
    html += '<h2>Summary Interpretation</h2>';
    html += `<p>${data.aiInterpretation.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    html += '</div>';
  }

  // APA Results Section
  if (sections.includes('apa') && data.apaResults) {
    html += '<div class="section">';
    html += '<h2>APA-Style Results</h2>';
    html += `<p>${data.apaResults.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    html += '</div>';
  }

  // Discussion Section
  if (sections.includes('discussion') && data.discussion) {
    html += '<div class="section">';
    html += '<h2>Discussion</h2>';
    html += `<p>${data.discussion.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    html += '</div>';
  }

  // Footer
  html += `<div class="footer">Report generated by SPSS AI Assistant on ${formatDate()}</div>`;
  html += '</body></html>';

  return html;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: ReportRequest = await req.json();
    
    // Validate required fields
    if (!data.sections || data.sections.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one section must be selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate report based on format
    let content: string;
    let contentType: string;
    let fileName: string;

    if (data.format === 'pdf') {
      // For PDF, we generate HTML that can be printed to PDF
      content = generateHTMLReport(data);
      contentType = 'text/html';
      fileName = `${(data.projectName || 'report').replace(/[^a-z0-9]/gi, '_')}_report.html`;
    } else {
      // For DOCX, generate markdown that can be converted or used directly
      // In a full implementation, you'd use a library like docx
      // For now, we return HTML that Word can open
      content = generateHTMLReport(data);
      contentType = 'text/html';
      fileName = `${(data.projectName || 'report').replace(/[^a-z0-9]/gi, '_')}_report.html`;
    }

    console.log(`Generated ${data.format} report for project: ${data.projectName}`);

    return new Response(
      JSON.stringify({ 
        content,
        contentType,
        fileName,
        format: data.format,
        success: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Report generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate report';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
