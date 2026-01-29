import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, testType, results, researchQuestion, hypothesis, variables, sampleSize, isPro } = await req.json();

    console.log('Generating interpretation:', type, 'for', testType);

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = getSystemPrompt(type, testType, isPro);
    const userPrompt = buildUserPrompt(type, testType, results, researchQuestion, hypothesis, variables, sampleSize);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error('AI service temporarily unavailable');
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('AI error:', data.error);
      throw new Error(data.error.message || 'AI processing failed');
    }

    const interpretation = data.choices?.[0]?.message?.content || 'Unable to generate interpretation.';

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

function getSystemPrompt(type: string, testType: string, isPro: boolean): string {
  const testContext = getTestContext(testType);
  
  switch (type) {
    case 'summary':
      return `You are a statistics expert helping non-statisticians understand their ${testContext.name} results.

Your task is to write a clear, jargon-free summary that explains:
1. What the analysis tested
2. What the key findings are (in plain language)
3. Whether the results are statistically significant and what that means practically
4. The effect size and its practical importance

Guidelines:
- Use simple language that anyone can understand
- Avoid statistical jargon or explain it when necessary
- Focus on practical implications, not technical details
- Be direct and actionable
- Keep it concise (2-3 paragraphs)

${testContext.interpretationGuidance}`;

    case 'apa':
      return `You are an academic writing expert specializing in APA 7th edition format for ${testContext.name} results.

Your task is to write a complete Results section following strict APA guidelines:

Format Requirements:
- Use proper statistical notation: ${testContext.apaNotation}
- Italicize statistical symbols (M, SD, t, F, p, r, η², etc.)
- Report exact p-values to three decimal places (e.g., p = .023)
- Use "p < .001" for very small p-values
- Include effect sizes with interpretations
- Report 95% confidence intervals where applicable
- Include degrees of freedom in parentheses

Structure:
1. Brief statement of analysis performed
2. Assumption checks (if applicable)
3. Descriptive statistics
4. Main statistical results with all relevant statistics
5. Effect size with interpretation
6. Brief conclusion statement

Be precise, thorough, and publication-ready.`;

    case 'discussion':
      return `You are a research methodology expert writing a Discussion section for ${testContext.name} results.

Your task is to write an academic discussion that:

1. INTERPRETATION OF FINDINGS (1 paragraph)
   - Summarize the main findings
   - Explain what the results mean in context of the research question
   - Discuss statistical vs. practical significance

2. THEORETICAL IMPLICATIONS (1 paragraph)
   - How do these findings relate to existing theory?
   - What do they contribute to our understanding?
   - Are they consistent with or contrary to prior research?

3. PRACTICAL IMPLICATIONS (1 paragraph)
   - What are the real-world applications?
   - How might practitioners use these findings?
   - What recommendations emerge from the results?

4. LIMITATIONS (1 paragraph)
   - What are the methodological limitations?
   - What factors might affect the generalizability?
   - What assumptions were made?

5. FUTURE RESEARCH (brief)
   - What questions remain unanswered?
   - What should future studies investigate?

Write in a scholarly but accessible tone. Be critical and balanced.`;

    case 'methodology':
      return `You are a research methodology expert writing a Methods section for a study using ${testContext.name}.

Your task is to write a complete Methodology section including:

1. RESEARCH DESIGN
   - Type of study design
   - Variables and their roles (IV, DV, covariates)

2. PARTICIPANTS/SAMPLE
   - Sample size and characteristics
   - Sampling method (if known)
   - Inclusion/exclusion criteria (if applicable)

3. MEASURES/VARIABLES
   - Description of each variable
   - Measurement level (nominal, ordinal, interval, ratio)
   - Any transformations applied

4. STATISTICAL ANALYSIS
   - Specific test used and why it was appropriate
   - Software used for analysis
   - Alpha level for significance
   - Assumption checks performed

Write in past tense, third person, following APA style.`;

    case 'full-results':
      return `You are a statistics expert writing a comprehensive Results section for ${testContext.name}.

Provide an extremely detailed analysis including:

1. PRELIMINARY ANALYSES
   - Data screening and cleaning
   - Assumption testing with results
   - Descriptive statistics for all variables

2. MAIN ANALYSES
   - Complete statistical results with all test statistics
   - Exact p-values
   - Effect sizes with interpretations
   - Confidence intervals
   - Post-hoc tests if applicable

3. SUPPLEMENTARY ANALYSES
   - Any additional relevant analyses
   - Sensitivity checks

4. RESULTS SUMMARY
   - Summary table of all findings
   - Key takeaways

Use APA format throughout. Include all relevant statistics.
${isPro ? 'Provide maximum detail with advanced statistics.' : ''}`;

    default:
      return `You are a helpful statistics assistant specializing in ${testContext.name}. Provide clear, accurate, and helpful analysis of the results.`;
  }
}

function getTestContext(testType: string): { name: string; apaNotation: string; interpretationGuidance: string } {
  const contexts: Record<string, { name: string; apaNotation: string; interpretationGuidance: string }> = {
    'independent-t-test': {
      name: 'Independent Samples t-test',
      apaNotation: 't(df) = value, p = .XXX, d = X.XX',
      interpretationGuidance: `For t-tests, explain:
- Whether the means differ significantly between groups
- The direction of the difference (which group scored higher)
- Cohen's d effect size: small (0.2), medium (0.5), large (0.8)
- Whether to use equal or unequal variances based on Levene's test`
    },
    'paired-t-test': {
      name: 'Paired Samples t-test',
      apaNotation: 't(df) = value, p = .XXX, d = X.XX',
      interpretationGuidance: `For paired t-tests, explain:
- Whether there's a significant change between time points/conditions
- The direction of change
- Cohen's d for paired data
- The correlation between paired measures`
    },
    'one-way-anova': {
      name: 'One-Way ANOVA',
      apaNotation: 'F(df1, df2) = value, p = .XXX, η² = .XX',
      interpretationGuidance: `For ANOVA, explain:
- Whether there are significant differences among groups
- Which specific groups differ (from post-hoc tests)
- Eta-squared effect size: small (.01), medium (.06), large (.14)
- Homogeneity of variance assumption from Levene's test`
    },
    'pearson': {
      name: 'Pearson Correlation',
      apaNotation: 'r(N-2) = .XX, p = .XXX',
      interpretationGuidance: `For correlations, explain:
- Direction (positive/negative relationship)
- Strength: weak (<.3), moderate (.3-.5), strong (.5-.7), very strong (>.7)
- What the relationship means practically
- Correlation is not causation`
    },
    'spearman': {
      name: 'Spearman Rank Correlation',
      apaNotation: 'rs(N) = .XX, p = .XXX',
      interpretationGuidance: `For Spearman, explain:
- It's used for ordinal data or non-linear relationships
- Interpretation similar to Pearson
- More robust to outliers`
    },
    'chi-square': {
      name: 'Chi-Square Test of Independence',
      apaNotation: 'χ²(df) = value, p = .XXX, V = .XX',
      interpretationGuidance: `For chi-square, explain:
- Whether there's a significant association between variables
- The pattern of the relationship from the crosstabulation
- Cramér's V effect size
- Expected vs. observed frequencies`
    },
    'mann-whitney': {
      name: 'Mann-Whitney U Test',
      apaNotation: 'U = value, z = X.XX, p = .XXX, r = .XX',
      interpretationGuidance: `For Mann-Whitney, explain:
- It's the non-parametric alternative to independent t-test
- Compare mean ranks between groups
- Effect size r interpretation`
    },
    'wilcoxon': {
      name: 'Wilcoxon Signed-Rank Test',
      apaNotation: 'W = value, z = X.XX, p = .XXX, r = .XX',
      interpretationGuidance: `For Wilcoxon, explain:
- It's the non-parametric alternative to paired t-test
- Compare positive and negative ranks
- Effect size r interpretation`
    },
    'cronbach-alpha': {
      name: 'Reliability Analysis (Cronbach\'s Alpha)',
      apaNotation: 'α = .XX',
      interpretationGuidance: `For reliability, explain:
- Alpha interpretation: excellent (≥.9), good (.8-.9), acceptable (.7-.8), questionable (.6-.7), poor (.5-.6), unacceptable (<.5)
- Item-total correlations
- Whether removing any item would improve reliability`
    },
    'descriptives': {
      name: 'Descriptive Statistics',
      apaNotation: 'M = X.XX, SD = X.XX',
      interpretationGuidance: `For descriptives, explain:
- Central tendency (mean, median)
- Variability (SD, range)
- Distribution shape (skewness, kurtosis)
- Any notable patterns or outliers`
    },
    'frequencies': {
      name: 'Frequency Analysis',
      apaNotation: 'n = X, % = X.X',
      interpretationGuidance: `For frequencies, explain:
- Distribution of categories
- Modal category
- Any unexpected patterns
- Missing data if present`
    },
  };
  
  return contexts[testType] || {
    name: testType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    apaNotation: 'Report all relevant statistics',
    interpretationGuidance: 'Provide clear interpretation of the results.'
  };
}

function buildUserPrompt(
  type: string,
  testType: string,
  results: unknown,
  researchQuestion?: string,
  hypothesis?: string,
  variables?: { dependent?: string[]; independent?: string[]; grouping?: string },
  sampleSize?: number
): string {
  let prompt = '';
  
  if (researchQuestion) {
    prompt += `Research Question: ${researchQuestion}\n\n`;
  }
  
  if (hypothesis) {
    prompt += `Hypothesis: ${hypothesis}\n\n`;
  }
  
  if (variables) {
    prompt += 'Variables:\n';
    if (variables.dependent?.length) {
      prompt += `- Dependent Variable(s): ${variables.dependent.join(', ')}\n`;
    }
    if (variables.independent?.length) {
      prompt += `- Independent Variable(s): ${variables.independent.join(', ')}\n`;
    }
    if (variables.grouping) {
      prompt += `- Grouping Variable: ${variables.grouping}\n`;
    }
    prompt += '\n';
  }
  
  if (sampleSize) {
    prompt += `Sample Size: N = ${sampleSize}\n\n`;
  }
  
  prompt += `Test Type: ${testType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n`;
  prompt += `Statistical Results:\n${JSON.stringify(results, null, 2)}\n\n`;
  prompt += `Please generate a ${type} interpretation of these results.`;
  
  if (type === 'apa') {
    prompt += ' Format the output in proper APA 7th edition style, ready for inclusion in a research paper.';
  } else if (type === 'discussion') {
    prompt += ' Write a scholarly discussion section that critically analyzes these findings.';
  } else if (type === 'methodology') {
    prompt += ' Write a complete Methods section describing how this analysis was conducted.';
  } else if (type === 'full-results') {
    prompt += ' Provide an extremely comprehensive analysis with all relevant statistics and interpretations.';
  }
  
  return prompt;
}
