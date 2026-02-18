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
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch Chapter 4 data safely (avoid .single() crash when no rows)
    const { data: ch4Rows } = await supabase
      .from('chapter_results')
      .select('full_text')
      .eq('analysis_id', analysisId)
      .order('created_at', { ascending: false })
      .limit(1);
    const chapter4 = ch4Rows?.[0] || null;
    const { data: hyps } = await supabase.from('hypotheses').select('*').eq('analysis_id', analysisId);
    const { data: blocks } = await supabase
      .from('analysis_blocks')
      .select('test_type, test_category, narrative, results')
      .eq('analysis_id', analysisId)
      .neq('status', 'pending');

    // Build a brief results summary for context
    const resultsSummary = (blocks || []).map((b: any) => {
      let s = `[${b.test_type}]`;
      if (b.narrative?.apa) s += ` APA: ${b.narrative.apa}`;
      if (b.results?.summary) s += ` Summary: ${b.results.summary}`;
      return s;
    }).join('\n');

    const theorySection = mode === 'pro' && theoryInput ? `
Theory Framework: ${theoryInput.theoryName}
Description: ${theoryInput.theoryDescription}
Key Constructs: ${theoryInput.keyConstructs}
Prior Studies: ${theoryInput.priorStudies}
Citations: ${JSON.stringify(citations || [])}` : '';

    const prompt = `Generate Chapter 5: Discussion and Conclusion for an academic thesis.

Chapter 4 Results Summary:
${chapter4?.full_text?.slice(0, 2000) || 'Not available yet'}

Statistical Results:
${resultsSummary}

Hypotheses: ${JSON.stringify((hyps || []).map((h: any) => ({ id: h.hypothesis_id, statement: h.statement, status: h.status })))}
${theorySection}
Mode: ${mode}

Return a JSON object with EXACTLY these keys: findings, theoretical, practical, unexpected, limitations, future, conclusion.
Each value should be 2-4 paragraphs of formal academic writing in APA-7 style.
Also return an "advisory" array with objects {type: "strength"|"weakness"|"suggestion", message: string}.
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
            content: 'Academic thesis writing expert. Return only valid, complete JSON. Never truncate your response.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI usage credits required. Please add credits to your workspace.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: `AI gateway error: ${response.status}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let result: Record<string, any> = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('JSON parse failed:', parseErr);
    }

    // Strip advisory and any nested sections wrapper so they don't pollute sections
    const { advisory, sections: nestedSections, ...flatSections } = result;
    const finalSections = nestedSections || flatSections;

    return new Response(JSON.stringify({ sections: finalSections, advisory: advisory || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
