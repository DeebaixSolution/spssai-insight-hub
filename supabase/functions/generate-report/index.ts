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
      rows: Array<Record<string, string | number>>;
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

// ============================================================================
// STRICT VALIDATION - BLOCK REPORTS WITHOUT REAL DATA
// ============================================================================

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  extractedMetadata: {
    sampleSize: number | null;
    tableCount: number;
    hasRealStatistics: boolean;
  };
}

function validateReportData(data: ReportRequest): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let sampleSize: number | null = null;
  let hasRealStatistics = false;
  
  // Check if results exist
  if (!data.results) {
    errors.push('CRITICAL: No analysis results provided. Cannot generate report without executed analysis.');
    return { isValid: false, errors, warnings, extractedMetadata: { sampleSize: null, tableCount: 0, hasRealStatistics: false } };
  }
  
  // Check for tables
  if (!data.results.tables || data.results.tables.length === 0) {
    errors.push('CRITICAL: No results tables found. Run analysis in Step 5 first.');
    return { isValid: false, errors, warnings, extractedMetadata: { sampleSize: null, tableCount: 0, hasRealStatistics: false } };
  }
  
  const tableCount = data.results.tables.length;
  
  // Extract sample size and validate statistics exist
  for (const table of data.results.tables) {
    if (table.rows && table.rows.length > 0) {
      for (const row of table.rows) {
        // Check for sample size
        if (row.N !== undefined && row.N !== null) {
          sampleSize = Number(row.N);
        }
        if (row.n !== undefined && row.n !== null && sampleSize === null) {
          sampleSize = Number(row.n);
        }
        
        // Check for real statistics (indicates analysis was actually run)
        if (row.t !== undefined || row.F !== undefined || row['Chi-Square'] !== undefined ||
            row.r !== undefined || row.U !== undefined || row.Mean !== undefined ||
            row.alpha !== undefined || row.p !== undefined) {
          hasRealStatistics = true;
        }
      }
    }
  }
  
  if (sampleSize === null) {
    warnings.push('WARNING: Sample size (N) not found in results tables.');
  }
  
  if (!hasRealStatistics) {
    warnings.push('WARNING: No statistical values found in tables. Ensure analysis was executed.');
  }
  
  // Check AI-generated sections reference real data
  if (data.aiInterpretation && sampleSize !== null) {
    // Check if interpretation mentions a wildly different N (possible hallucination)
    const nMatches = data.aiInterpretation.match(/N\s*=\s*(\d+)/gi);
    if (nMatches) {
      for (const match of nMatches) {
        const mentionedN = parseInt(match.replace(/\D/g, ''));
        if (Math.abs(mentionedN - sampleSize) > 5) {
          warnings.push(`WARNING: AI interpretation mentions N=${mentionedN} but actual N=${sampleSize}. Possible hallucination detected.`);
        }
      }
    }
  }
  
  const isValid = errors.length === 0;
  
  return {
    isValid,
    errors,
    warnings,
    extractedMetadata: { sampleSize, tableCount, hasRealStatistics }
  };
}

// ============================================================================
// REPORT GENERATION WITH VALIDATION METADATA
// ============================================================================

function formatDate(): string {
  const date = new Date();
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function generateTableText(table: { title: string; headers: string[]; rows: Array<Record<string, string | number>> }): string {
  let text = `\n### ${table.title}\n\n`;
  
  const widths = table.headers.map((h) => {
    const headerLen = String(h).length;
    const maxDataLen = Math.max(...table.rows.map(r => String(r[h] ?? '').length));
    return Math.max(headerLen, maxDataLen, 10);
  });
  
  text += '| ' + table.headers.map((h, i) => String(h).padEnd(widths[i])).join(' | ') + ' |\n';
  text += '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |\n';
  
  for (const row of table.rows) {
    text += '| ' + table.headers.map((header, i) => {
      const cell = row[header];
      const val = cell === null || cell === undefined ? '-' : String(cell);
      return val.padEnd(widths[i]);
    }).join(' | ') + ' |\n';
  }
  
  return text;
}

function generateHTMLTable(table: { title: string; headers: string[]; rows: Array<Record<string, string | number>> }): string {
  let html = `<h3 style="margin-top: 24px; margin-bottom: 12px; color: #1a1a2e;">${table.title}</h3>`;
  html += '<table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11pt;">';
  
  html += '<thead><tr style="background-color: #f8f9fa;">';
  for (const header of table.headers) {
    html += `<th style="border: 1px solid #dee2e6; padding: 8px 12px; text-align: left; font-weight: 600;">${header}</th>`;
  }
  html += '</tr></thead>';
  
  html += '<tbody>';
  for (const row of table.rows) {
    html += '<tr>';
    for (const header of table.headers) {
      const cell = row[header];
      const val = cell === null || cell === undefined ? '-' : String(cell);
      html += `<td style="border: 1px solid #dee2e6; padding: 8px 12px;">${val}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  
  return html;
}

function generateHTMLReport(data: ReportRequest, metadata: ValidationResult['extractedMetadata']): string {
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
    .data-verification {
      background-color: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 16px;
      font-size: 10pt;
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

  // Data Verification Badge
  html += '<div class="data-verification">';
  html += `<strong>✓ Data Verification:</strong> This report was generated from validated analysis results. `;
  html += `Sample Size: N = ${metadata.sampleSize || 'Not specified'} | `;
  html += `Tables: ${metadata.tableCount} | `;
  html += `Statistics Present: ${metadata.hasRealStatistics ? 'Yes' : 'No'}`;
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

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: ReportRequest = await req.json();
    
    console.log('Report generation request for:', data.projectName);
    
    // STEP 1: Validate that real data exists
    const validation = validateReportData(data);
    
    if (!validation.isValid) {
      console.error('Report validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Cannot generate report: Missing required analysis data',
          details: validation.errors,
          suggestion: 'Please run the analysis in Step 5 first, then generate interpretations in Step 6.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn('Report validation warnings:', validation.warnings);
    }
    
    // Validate sections
    if (!data.sections || data.sections.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one section must be selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 2: Generate report with validation metadata embedded
    let content: string;
    let contentType: string;
    let fileName: string;

    // Generate HTML report (works for both PDF and DOCX - can be opened in Word)
    content = generateHTMLReport(data, validation.extractedMetadata);
    contentType = 'text/html';
    fileName = `${(data.projectName || 'report').replace(/[^a-z0-9]/gi, '_')}_report.html`;

    console.log(`Generated ${data.format} report for project: ${data.projectName}`);
    console.log(`Validation metadata: N=${validation.extractedMetadata.sampleSize}, Tables=${validation.extractedMetadata.tableCount}`);

    return new Response(
      JSON.stringify({ 
        content,
        contentType,
        fileName,
        format: data.format,
        success: true,
        validation: {
          sampleSize: validation.extractedMetadata.sampleSize,
          tableCount: validation.extractedMetadata.tableCount,
          hasRealStatistics: validation.extractedMetadata.hasRealStatistics,
          warnings: validation.warnings
        }
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
