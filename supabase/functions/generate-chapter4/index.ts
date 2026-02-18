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
    const apiKey = Deno.env.get('LOVABLE_API_KEY');

    // Build detailed results summary for each block
    const resultsDetail = blocks.map((b: any) => {
      let detail = `[${b.test_type}] Category: ${b.test_category}, Section: ${b.section}, Status: ${b.status}`;
      if (b.results) {
        const r = b.results;
        if (r.tables) detail += `\nTables: ${JSON.stringify(r.tables).slice(0, 600)}`;
        if (r.summary) detail += `\nSummary: ${r.summary}`;
        if (r.statistics) detail += `\nStatistics: ${JSON.stringify(r.statistics).slice(0, 400)}`;
      }
      if (b.narrative) {
        const n = b.narrative;
        if (n.apa) detail += `\nAPA: ${n.apa}`;
        if (n.interpretation) detail += `\nInterpretation: ${n.interpretation}`;
      }
      return detail;
    }).join('\n\n');

    // If regenerating a single section
    const sectionFilter = sectionId
      ? `\nONLY generate content for section: "${sectionId}". Return JSON with ONLY that key.`
      : '';

    const prompt = `You are an academic writing assistant generating Chapter 4: Results and Data Analysis for a thesis.

Given these analysis results and hypotheses, generate structured academic content. Use formal, objective, APA-7 style. Reference tables as "Table 4.X". Use the actual statistical values provided — NEVER fabricate statistics.

ANALYSIS RESULTS (use exact numbers from these):
${resultsDetail}

HYPOTHESES:
${hypotheses.map((h: any) => `${h.hypothesis_id}: ${h.statement} (${h.hypothesis_type}, status: ${h.status})`).join('\n')}
${sectionFilter}

Return a JSON object with these exact keys: sample, measurement, descriptive, reliability, correlation, regression, hypothesis, diagnostics, integrated, summary.
Each key should contain 2-4 paragraphs of academic text for that section. Reference actual test statistics, p-values, effect sizes from the data. If no data exists for a section, return a brief placeholder string.
IMPORTANT: Return complete, valid JSON. Do not truncate.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an academic thesis writing expert. Return only valid, complete JSON. Use actual statistical values from the provided data. Never truncate your response.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      return new Response(JSON.stringify({ error: `AI gateway error: ${response.status}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Robust JSON extraction — try strict match first, then lenient
    let sections: Record<string, string> = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Strip any non-string keys (e.g. nested objects) so each value is usable as text
        for (const [k, v] of Object.entries(parsed)) {
          sections[k] = typeof v === 'string' ? v : JSON.stringify(v);
        }
      }
    } catch (parseErr) {
      console.error('JSON parse failed, attempting partial recovery:', parseErr);
      // Partial recovery: extract individual string values via regex
      const keyPattern = /"(\w+)":\s*"((?:[^"\\]|\\.)*)"/g;
      let m;
      while ((m = keyPattern.exec(content)) !== null) {
        sections[m[1]] = m[2].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }

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
