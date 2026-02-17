import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisId, mode, theoryInput, citations } = await req.json();
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch Chapter 4 data safely (avoid .single() crash when no rows)
    const { data: ch4Rows } = await supabase.from('chapter_results').select('full_text').eq('analysis_id', analysisId).order('created_at', { ascending: false }).limit(1);
    const chapter4 = ch4Rows?.[0] || null;
    const { data: hyps } = await supabase.from('hypotheses').select('*').eq('analysis_id', analysisId);

    const theorySection = mode === 'pro' && theoryInput ? `
Theory Framework: ${theoryInput.theoryName}
Description: ${theoryInput.theoryDescription}
Key Constructs: ${theoryInput.keyConstructs}
Prior Studies: ${theoryInput.priorStudies}
Citations: ${JSON.stringify(citations || [])}` : '';

    const prompt = `Generate Chapter 5: Discussion and Conclusion for an academic thesis.

Chapter 4 Results: ${chapter4?.full_text?.slice(0, 3000) || 'Not available yet'}
Hypotheses: ${JSON.stringify(hyps || [])}
${theorySection}
Mode: ${mode}

Return JSON with keys: findings, theoretical, practical, unexpected, limitations, future, conclusion.
Each should be 1-3 paragraphs of formal academic writing. APA-7 style.
Also return "advisory" array with objects {type: "strength"|"weakness"|"suggestion", message: string}.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Academic thesis writing expert. Return valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 4000,
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return new Response(JSON.stringify({ sections: result.sections || result, advisory: result.advisory || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
