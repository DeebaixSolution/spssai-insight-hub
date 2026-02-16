import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { analysisId, blocks, hypotheses, sectionId } = await req.json();
    const apiKey = Deno.env.get('OPENAI_API_KEY');

    // Build detailed results summary for each section
    const blocksByCategory: Record<string, any[]> = {};
    for (const b of blocks) {
      if (!blocksByCategory[b.test_category]) blocksByCategory[b.test_category] = [];
      blocksByCategory[b.test_category].push(b);
    }

    const resultsDetail = blocks.map((b: any) => {
      let detail = `[${b.test_type}] Section: ${b.section}, Status: ${b.status}`;
      if (b.results) {
        const r = b.results;
        if (r.tables) detail += `\nTables: ${JSON.stringify(r.tables).slice(0, 500)}`;
        if (r.summary) detail += `\nSummary: ${r.summary}`;
        if (r.statistics) detail += `\nStatistics: ${JSON.stringify(r.statistics).slice(0, 300)}`;
      }
      if (b.narrative) {
        const n = b.narrative;
        if (n.apa) detail += `\nAPA: ${n.apa}`;
        if (n.interpretation) detail += `\nInterpretation: ${n.interpretation}`;
      }
      return detail;
    }).join('\n\n');

    // If regenerating a single section
    const sectionFilter = sectionId ? `\nONLY generate content for section: ${sectionId}. Return JSON with just that key.` : '';

    const prompt = `You are an academic writing assistant generating Chapter 4: Results and Data Analysis for a thesis.

Given these analysis results and hypotheses, generate structured academic content. Use formal, objective, APA-7 style. Reference tables as "Table 4.X". Use the actual statistical values provided - NEVER fabricate statistics.

ANALYSIS RESULTS:
${resultsDetail}

HYPOTHESES:
${hypotheses.map((h: any) => `${h.hypothesis_id}: ${h.statement} (${h.hypothesis_type}, status: ${h.status})`).join('\n')}
${sectionFilter}

Return a JSON object with keys: sample, measurement, descriptive, reliability, correlation, regression, hypothesis, diagnostics, integrated, summary.
Each key should contain 1-3 paragraphs of academic text for that section. Reference actual values from the results. If no data exists for a section, return empty string.
For sections with statistical results, include the actual test statistics, p-values, effect sizes, and confidence intervals from the data provided.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an academic thesis writing expert. Return only valid JSON. Use actual statistical values from the provided data.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 4000,
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const sections = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return new Response(JSON.stringify({ sections }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
