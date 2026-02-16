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

    const prompt = `Analyze these dataset variables and determine their measurement level, role, and scale grouping.

Variables: ${headers.join(', ')}

Sample data (first 5 rows):
${JSON.stringify(sampleData.slice(0, 5), null, 2)}

For each variable, determine:
1. "type": "nominal" (categories with no order), "ordinal" (ordered categories), or "scale" (continuous numbers)
2. "label": A brief descriptive label
3. "role": One of:
   - "id" if it's a unique identifier (e.g., ID, respondent number)
   - "demographic" if it's a background variable (e.g., gender, age group, education level)
   - "dependent" if it appears to be a dependent/outcome variable
   - "independent" if it appears to be an independent/predictor variable
   - "scale_item" if it's a Likert-scale item or questionnaire item (e.g., Q1, Q2, item_1, satisfaction_1)
4. "scaleGroup": If role is "scale_item", group related items under a common scale name (e.g., "Job Satisfaction", "Organizational Commitment"). Use null for non-scale items.
5. "valueLabels": For nominal/ordinal variables, provide a mapping of numeric codes to labels if detectable from the data (e.g., {"1": "Male", "2": "Female"}). Use null for scale variables.

Return JSON array:
[{"name": "var1", "type": "scale", "label": "Age in years", "role": "demographic", "scaleGroup": null, "valueLabels": null}, ...]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a statistics expert specializing in SPSS data analysis. Analyze dataset variables and return JSON only. Be precise about identifying scale items (Likert items, questionnaire items) and grouping them into their parent scales.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
