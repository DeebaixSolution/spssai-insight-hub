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
    const { type, testType, results, researchQuestion, isPro } = await req.json();

    console.log('Generating interpretation:', type, 'for', testType);

    const systemPrompt = getSystemPrompt(type, isPro);
    const userPrompt = `
Test Type: ${testType}
Research Question: ${researchQuestion || 'Not specified'}
Results: ${JSON.stringify(results, null, 2)}

Generate a ${type} interpretation of these results.
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('OpenAI error:', data.error);
      throw new Error(data.error.message);
    }

    const interpretation = data.choices[0].message.content;

    return new Response(JSON.stringify({ interpretation }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Interpretation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getSystemPrompt(type: string, isPro: boolean): string {
  switch (type) {
    case 'summary':
      return `You are a statistics expert helping non-statisticians understand their results. 
Write a clear, jargon-free summary explaining what the results mean in plain language.
Focus on practical implications, not technical details.
Keep it concise (2-3 paragraphs).`;

    case 'apa':
      return `You are an academic writing expert specializing in APA format.
Write the results section in proper APA 7th edition format.
Include all relevant statistics with proper formatting (e.g., t(df) = value, p < .05).
Use italic formatting for statistical symbols.
Be precise and publication-ready.`;

    case 'discussion':
      return `You are a research methodology expert.
Write an academic discussion section that:
1. Interprets the findings in context of the research question
2. Discusses implications for theory and practice
3. Notes any limitations of the analysis
4. Suggests directions for future research
Keep it scholarly but accessible (3-4 paragraphs).`;

    default:
      return 'You are a helpful statistics assistant.';
  }
}
