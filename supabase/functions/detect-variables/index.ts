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
    const { headers, sampleData } = await req.json();

    console.log('Detecting variable types for', headers.length, 'variables');

    const prompt = `Analyze these dataset variables and determine their measurement level.

Variables: ${headers.join(', ')}

Sample data (first 5 rows):
${JSON.stringify(sampleData.slice(0, 5), null, 2)}

For each variable, determine:
1. Type: "nominal" (categories with no order), "ordinal" (ordered categories), or "scale" (continuous numbers)
2. A brief descriptive label

Return JSON array:
[{"name": "var1", "type": "scale", "label": "Age in years"}, ...]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a statistics expert. Analyze dataset variables and return JSON only.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const variables = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return new Response(JSON.stringify({ variables }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Detection error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
