import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { researchQuestion, hypothesis, variables } = await req.json();

    const prompt = `Based on this research question and available variables, suggest appropriate statistical tests.

Research Question: ${researchQuestion}
Hypothesis: ${hypothesis || 'Not specified'}

Available Variables:
${variables.map((v: {name: string; type: string; label: string}) => `- ${v.name} (${v.type}): ${v.label || 'no label'}`).join('\n')}

Suggest 1-3 appropriate statistical tests. Return JSON:
[{
  "testCategory": "compare-means|correlation|regression|descriptive|nonparametric",
  "testType": "independent-t-test|paired-t-test|one-way-anova|pearson|linear-regression|chi-square|etc",
  "explanation": "Brief explanation of why this test is appropriate"
}]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a statistics expert. Suggest appropriate statistical tests based on research questions and data. Return JSON only.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Suggestion error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
