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
    const { researchQuestion, hypothesis, variables, mode, hypothesisCount } = await req.json();

    // Mode: research-questions
    if (mode === 'research-questions') {
      const varSummary = variables.map((v: any) => `- ${v.name} (${v.type}, role: ${v.role || 'unassigned'}): ${v.label || 'no label'}`).join('\n');
      
      const prompt = `Based on these dataset variables, suggest 3 research questions that could be investigated.

Available Variables:
${varSummary}

For each research question:
1. Make it specific and testable
2. Consider the variable types and roles
3. Suggest which variables would be DV and IV

Return JSON array:
[{
  "question": "The research question text",
  "suggestedDV": ["variable_name"],
  "suggestedIV": ["variable_name"],
  "rationale": "Brief explanation of why this is a good research question"
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
            { role: 'system', content: 'You are a statistics professor. Suggest research questions based on available variables. Return JSON only.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1000,
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const questions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      return new Response(JSON.stringify({ questions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default mode: suggest hypotheses and tests
    const count = hypothesisCount || 3;
    
    const prompt = `Based on this research question and available variables, suggest ${count} hypotheses with appropriate statistical tests.

Research Question: ${researchQuestion}
${hypothesis ? `Current Hypothesis: ${hypothesis}` : ''}

Available Variables:
${variables.map((v: any) => `- ${v.name} (${v.type}, role: ${v.role || 'unassigned'}): ${v.label || 'no label'}`).join('\n')}

For each hypothesis, provide:
1. A clear, testable hypothesis statement
2. The type: "difference" (compare groups), "association" (correlate), or "prediction" (regression)
3. Suggested dependent variable(s) from the variable list
4. Suggested independent variable(s) from the variable list
5. Recommended statistical test

Return exactly ${count} hypotheses as JSON array:
[{
  "statement": "There is a significant difference in [DV] between [groups defined by IV]",
  "type": "difference|association|prediction",
  "suggestedDV": ["exact_variable_name"],
  "suggestedIV": ["exact_variable_name"],
  "testCategory": "compare-means|correlation|regression|nonparametric",
  "testType": "independent-t-test|paired-t-test|one-way-anova|pearson|spearman|linear-regression|chi-square|etc",
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
          { role: 'system', content: 'You are a statistics professor expert in SPSS. Suggest hypotheses with appropriate tests. Use exact variable names from the provided list for suggestedDV and suggestedIV. Return JSON only.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
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
