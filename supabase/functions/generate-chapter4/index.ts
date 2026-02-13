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
    const { analysisId, blocks, hypotheses } = await req.json();
    const apiKey = Deno.env.get('OPENAI_API_KEY');

    const prompt = `You are an academic writing assistant generating Chapter 4: Results and Data Analysis for a thesis.

Given these analysis blocks and hypotheses, generate structured academic content for each section.
Use formal, objective, APA-7 style. Reference tables as "Table 4.X". Never fabricate statistics - use only the provided data.

Analysis Blocks: ${JSON.stringify(blocks)}
Hypotheses: ${JSON.stringify(hypotheses)}

Return a JSON object with keys: sample, measurement, descriptive, reliability, correlation, regression, hypothesis, diagnostics, integrated, summary.
Each key should contain 1-3 paragraphs of academic text for that section. If no data exists for a section, return empty string.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an academic thesis writing expert. Return only valid JSON.' },
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
