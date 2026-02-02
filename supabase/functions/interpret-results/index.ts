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
    const { type, testType, results, researchQuestion, hypothesis, variables, sampleSize, isPro, supervisorMode, blockContext } = await req.json();

    console.log('Generating interpretation:', type, 'for', testType, 'supervisorMode:', supervisorMode);

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const writingLogic = getWritingLogic(testType);
    const systemPrompt = buildSystemPrompt(type, testType, writingLogic, isPro, supervisorMode);
    const userPrompt = buildUserPrompt(type, testType, results, researchQuestion, hypothesis, variables, sampleSize, writingLogic, blockContext);

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
        max_tokens: 3000,
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

// ============================================================================
// PER-TEST WRITING LOGIC LIBRARY
// ============================================================================

interface WritingLogic {
  name: string;
  category: 'descriptive' | 'reliability' | 'comparison' | 'correlation' | 'regression' | 'nonparametric' | 'factor';
  apaNotation: string;
  introTemplate: string;
  requiredStats: string[];
  forbiddenStats: string[];
  narrativePattern: string;
  hypothesisSupported: string;
  hypothesisNotSupported: string;
  assumptionNarrative: string;
  effectSizeInterpretation: Record<string, string>;
  tableTitle: string;
  figureTitle?: string;
}

function getWritingLogic(testType: string): WritingLogic {
  const writingLogicLibrary: Record<string, WritingLogic> = {
    'frequencies': {
      name: 'Frequency Analysis',
      category: 'descriptive',
      apaNotation: 'n = X, % = X.X',
      introTemplate: 'The demographic characteristics and frequency distributions of the sample were examined to provide an overview of the respondents.',
      requiredStats: ['n', 'percent', 'valid_percent', 'cumulative_percent'],
      forbiddenStats: ['mean', 'sd', 't', 'F', 'r'],
      narrativePattern: 'The majority of participants were [category] (n = [n], [percent]%), followed by [next_category] (n = [n], [percent]%).',
      hypothesisSupported: '',
      hypothesisNotSupported: '',
      assumptionNarrative: 'Frequency analysis does not require parametric assumptions.',
      effectSizeInterpretation: {},
      tableTitle: 'Table [N]: Frequency Distribution of [Variable]',
      figureTitle: 'Figure [N]: Bar Chart of [Variable] Distribution'
    },
    
    'descriptives': {
      name: 'Descriptive Statistics',
      category: 'descriptive',
      apaNotation: 'M = X.XX, SD = X.XX',
      introTemplate: 'Descriptive statistics were computed to summarize the central tendency, variability, and distribution of the continuous variables.',
      requiredStats: ['mean', 'sd', 'min', 'max', 'n'],
      forbiddenStats: ['t', 'F', 'p', 'r'],
      narrativePattern: 'The mean score for [variable] was M = [mean] (SD = [sd]), with scores ranging from [min] to [max].',
      hypothesisSupported: '',
      hypothesisNotSupported: '',
      assumptionNarrative: 'Descriptive statistics do not require inferential assumptions.',
      effectSizeInterpretation: {},
      tableTitle: 'Table [N]: Descriptive Statistics for Study Variables',
      figureTitle: 'Figure [N]: Distribution of [Variable]'
    },
    
    'cronbach-alpha': {
      name: 'Reliability Analysis (Cronbach\'s Alpha)',
      category: 'reliability',
      apaNotation: 'α = .XX',
      introTemplate: 'Internal consistency reliability was assessed using Cronbach\'s alpha coefficient to evaluate the reliability of the measurement scale.',
      requiredStats: ['alpha', 'n_items', 'scale_mean', 'scale_variance'],
      forbiddenStats: ['mean', 'correlation', 't', 'F'],
      narrativePattern: 'Cronbach\'s alpha for the [scale_name] scale ([n_items] items, e.g., Items [item_range]) indicated [interpretation] internal consistency (α = [alpha]).',
      hypothesisSupported: '',
      hypothesisNotSupported: '',
      assumptionNarrative: 'Reliability analysis assumes that items measure a single latent construct and are measured on interval scales.',
      effectSizeInterpretation: {
        'excellent': 'α ≥ .90 indicates excellent internal consistency',
        'good': '.80 ≤ α < .90 indicates good internal consistency',
        'acceptable': '.70 ≤ α < .80 indicates acceptable internal consistency',
        'questionable': '.60 ≤ α < .70 indicates questionable internal consistency',
        'poor': '.50 ≤ α < .60 indicates poor internal consistency',
        'unacceptable': 'α < .50 indicates unacceptable internal consistency'
      },
      tableTitle: 'Table [N]: Reliability Statistics for [Scale Name]'
    },
    
    'one-sample-t-test': {
      name: 'One-Sample t-Test',
      category: 'comparison',
      apaNotation: 't(df) = X.XX, p = .XXX, d = X.XX',
      introTemplate: 'A one-sample t-test was conducted to determine whether the sample mean significantly differed from the hypothesized population value.',
      requiredStats: ['t', 'df', 'p', 'mean', 'sd', 'test_value', 'mean_difference', 'cohens_d', 'ci_lower', 'ci_upper'],
      forbiddenStats: ['F', 'r', 'chi_square'],
      narrativePattern: 'The sample mean (M = [mean], SD = [sd]) was significantly [higher/lower] than the test value of [test_value], t([df]) = [t], p [< .001 / = .XXX], with a [small/medium/large] effect size (d = [cohens_d]).',
      hypothesisSupported: 'The results support [hypothesis_id], indicating that [variable] significantly differs from the hypothesized value of [test_value].',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; no significant difference was found between the sample mean and the hypothesized value of [test_value].',
      assumptionNarrative: 'Prior to analysis, the assumption of normality was evaluated using the Shapiro-Wilk test. [Results of normality test]. The data [met/did not meet] the assumption of normality.',
      effectSizeInterpretation: {
        'small': 'd = 0.20 represents a small effect',
        'medium': 'd = 0.50 represents a medium effect',
        'large': 'd = 0.80 represents a large effect'
      },
      tableTitle: 'Table [N]: One-Sample t-Test Results for [Variable]'
    },
    
    'independent-t-test': {
      name: 'Independent Samples t-Test',
      category: 'comparison',
      apaNotation: 't(df) = X.XX, p = .XXX, d = X.XX',
      introTemplate: 'An independent samples t-test was conducted to compare [dependent_variable] between [group1] and [group2].',
      requiredStats: ['t', 'df', 'p', 'mean1', 'mean2', 'sd1', 'sd2', 'cohens_d', 'ci_lower', 'ci_upper', 'levene_f', 'levene_p'],
      forbiddenStats: ['F', 'r', 'chi_square'],
      narrativePattern: 'The [group1] group (M = [mean1], SD = [sd1]) scored significantly [higher/lower] than the [group2] group (M = [mean2], SD = [sd2]), t([df]) = [t], p [< .001 / = .XXX]. The effect size was [small/medium/large] (d = [cohens_d]).',
      hypothesisSupported: 'The results support [hypothesis_id], indicating a significant difference in [dependent_variable] between [group1] and [group2].',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; no significant difference in [dependent_variable] was found between [group1] and [group2].',
      assumptionNarrative: 'Prior to analysis, the assumptions of normality and homogeneity of variances were evaluated. Normality was assessed using the Shapiro-Wilk test [results]. Levene\'s test for equality of variances [was/was not] significant (F = [levene_f], p = [levene_p]), indicating [equal/unequal] variances. [If unequal: Welch\'s t-test was used to correct for this violation.]',
      effectSizeInterpretation: {
        'small': 'd = 0.20 represents a small effect',
        'medium': 'd = 0.50 represents a medium effect',
        'large': 'd = 0.80 represents a large effect'
      },
      tableTitle: 'Table [N]: Independent Samples t-Test Results Comparing [Groups] on [Variable]',
      figureTitle: 'Figure [N]: Mean [Variable] Scores by [Grouping Variable]'
    },
    
    'paired-t-test': {
      name: 'Paired Samples t-Test',
      category: 'comparison',
      apaNotation: 't(df) = X.XX, p = .XXX, d = X.XX',
      introTemplate: 'A paired samples t-test was conducted to examine whether there was a significant change in [variable] from [time1] to [time2].',
      requiredStats: ['t', 'df', 'p', 'mean_pre', 'mean_post', 'sd_pre', 'sd_post', 'mean_diff', 'cohens_d', 'ci_lower', 'ci_upper', 'correlation'],
      forbiddenStats: ['F', 'chi_square'],
      narrativePattern: 'There was a significant [increase/decrease] in [variable] from [time1] (M = [mean_pre], SD = [sd_pre]) to [time2] (M = [mean_post], SD = [sd_post]), t([df]) = [t], p [< .001 / = .XXX], with a [small/medium/large] effect size (d = [cohens_d]).',
      hypothesisSupported: 'The results support [hypothesis_id], indicating a significant change in [variable] between the two measurement points.',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; no significant change in [variable] was found between the measurement points.',
      assumptionNarrative: 'The assumption of normality for the difference scores was assessed using the Shapiro-Wilk test. [Results]. The paired observations showed a correlation of r = [correlation].',
      effectSizeInterpretation: {
        'small': 'd = 0.20 represents a small effect',
        'medium': 'd = 0.50 represents a medium effect',
        'large': 'd = 0.80 represents a large effect'
      },
      tableTitle: 'Table [N]: Paired Samples t-Test Results for [Variable]',
      figureTitle: 'Figure [N]: Mean [Variable] at [Time1] and [Time2]'
    },
    
    'one-way-anova': {
      name: 'One-Way ANOVA',
      category: 'comparison',
      apaNotation: 'F(df1, df2) = X.XX, p = .XXX, η² = .XX',
      introTemplate: 'A one-way analysis of variance (ANOVA) was conducted to examine differences in [dependent_variable] across the [number] levels of [independent_variable].',
      requiredStats: ['F', 'df_between', 'df_within', 'p', 'eta_squared', 'means', 'sds', 'levene_f', 'levene_p'],
      forbiddenStats: ['t', 'r', 'chi_square'],
      narrativePattern: 'There was a statistically significant difference in [dependent_variable] across groups, F([df_between], [df_within]) = [F], p [< .001 / = .XXX], η² = [eta_squared]. Post-hoc comparisons using Tukey HSD revealed that [specific_differences].',
      hypothesisSupported: 'The results support [hypothesis_id], indicating significant differences in [dependent_variable] among the groups.',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; no significant differences in [dependent_variable] were found among the groups.',
      assumptionNarrative: 'Prior to analysis, the assumptions of normality and homogeneity of variances were evaluated. Normality was assessed using the Shapiro-Wilk test for each group [results]. Levene\'s test for homogeneity of variances [was/was not] significant (F = [levene_f], p = [levene_p]).',
      effectSizeInterpretation: {
        'small': 'η² = .01 represents a small effect',
        'medium': 'η² = .06 represents a medium effect',
        'large': 'η² = .14 represents a large effect'
      },
      tableTitle: 'Table [N]: One-Way ANOVA Results for [Variable] by [Group]',
      figureTitle: 'Figure [N]: Mean [Variable] Scores Across [Groups]'
    },
    
    'two-way-anova': {
      name: 'Two-Way ANOVA',
      category: 'comparison',
      apaNotation: 'F(df1, df2) = X.XX, p = .XXX, partial η² = .XX',
      introTemplate: 'A two-way analysis of variance was conducted to examine the main effects of [factor1] and [factor2], as well as their interaction effect, on [dependent_variable].',
      requiredStats: ['F_factor1', 'F_factor2', 'F_interaction', 'df', 'p_values', 'partial_eta_squared'],
      forbiddenStats: ['t', 'r', 'chi_square'],
      narrativePattern: 'There was a significant main effect of [factor1], F([df1], [df2]) = [F], p = [p], partial η² = [effect]. [Describe factor2 and interaction similarly.]',
      hypothesisSupported: 'The results support [hypothesis_id], indicating [significant main effect/interaction].',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; no significant [main effect/interaction] was found.',
      assumptionNarrative: 'Assumptions of normality and homogeneity of variances were evaluated. Normality was assessed for each cell [results]. Levene\'s test [results].',
      effectSizeInterpretation: {
        'small': 'partial η² = .01 represents a small effect',
        'medium': 'partial η² = .06 represents a medium effect',
        'large': 'partial η² = .14 represents a large effect'
      },
      tableTitle: 'Table [N]: Two-Way ANOVA Results for [DV] by [Factor1] and [Factor2]'
    },
    
    'repeated-measures-anova': {
      name: 'Repeated Measures ANOVA',
      category: 'comparison',
      apaNotation: 'F(df1, df2) = X.XX, p = .XXX, partial η² = .XX',
      introTemplate: 'A repeated measures analysis of variance was conducted to examine changes in [dependent_variable] across [number] time points/conditions.',
      requiredStats: ['F', 'df', 'p', 'partial_eta_squared', 'mauchly_w', 'mauchly_p', 'greenhouse_geisser', 'means', 'sds'],
      forbiddenStats: ['t_between', 'chi_square'],
      narrativePattern: 'There was a significant effect of [within_factor] on [dependent_variable], F([df1], [df2]) = [F], p = [p], partial η² = [effect]. Pairwise comparisons with Bonferroni correction revealed [specific_differences].',
      hypothesisSupported: 'The results support [hypothesis_id], indicating significant changes across measurement points.',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; no significant changes were found across measurement points.',
      assumptionNarrative: 'The assumption of sphericity was evaluated using Mauchly\'s test, W = [mauchly_w], p = [mauchly_p]. [If violated: Sphericity was violated; therefore, the Greenhouse-Geisser correction (ε = [gg_epsilon]) was applied.]',
      effectSizeInterpretation: {
        'small': 'partial η² = .01 represents a small effect',
        'medium': 'partial η² = .06 represents a medium effect',
        'large': 'partial η² = .14 represents a large effect'
      },
      tableTitle: 'Table [N]: Repeated Measures ANOVA Results for [Variable]',
      figureTitle: 'Figure [N]: Mean [Variable] Across Time Points'
    },
    
    'pearson': {
      name: 'Pearson Product-Moment Correlation',
      category: 'correlation',
      apaNotation: 'r(N-2) = .XX, p = .XXX',
      introTemplate: 'Pearson product-moment correlation coefficients were computed to assess the linear relationships between the continuous variables.',
      requiredStats: ['r', 'p', 'n', 'r_squared'],
      forbiddenStats: ['t', 'F', 'chi_square', 'mean', 'sd'],
      narrativePattern: 'There was a [weak/moderate/strong] [positive/negative] correlation between [variable1] and [variable2], r([df]) = [r], p [< .001 / = .XXX]. The coefficient of determination (r² = [r_squared]) indicates that [percent]% of the variance in [variable2] is explained by [variable1].',
      hypothesisSupported: 'The results support [hypothesis_id], indicating a significant [positive/negative] relationship between [variable1] and [variable2].',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; no significant relationship was found between [variable1] and [variable2].',
      assumptionNarrative: 'Pearson correlation assumes linearity, bivariate normality, and homoscedasticity. Scatterplot inspection [confirmed/raised concerns about] linearity. [Normality results if available.]',
      effectSizeInterpretation: {
        'weak': 'r < .30 indicates a weak relationship',
        'moderate': '.30 ≤ r < .50 indicates a moderate relationship',
        'strong': '.50 ≤ r < .70 indicates a strong relationship',
        'very_strong': 'r ≥ .70 indicates a very strong relationship'
      },
      tableTitle: 'Table [N]: Pearson Correlations Among Study Variables',
      figureTitle: 'Figure [N]: Scatterplot of [Variable1] and [Variable2]'
    },
    
    'spearman': {
      name: 'Spearman\'s Rank-Order Correlation',
      category: 'correlation',
      apaNotation: 'rs(N) = .XX, p = .XXX',
      introTemplate: 'Spearman\'s rank-order correlation was used to examine the monotonic relationship between variables, as the data were ordinal or not normally distributed.',
      requiredStats: ['rho', 'p', 'n'],
      forbiddenStats: ['t', 'F', 'mean', 'sd'],
      narrativePattern: 'There was a [weak/moderate/strong] [positive/negative] monotonic relationship between [variable1] and [variable2], rs([n]) = [rho], p [< .001 / = .XXX].',
      hypothesisSupported: 'The results support [hypothesis_id], indicating a significant monotonic relationship between [variable1] and [variable2].',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; no significant monotonic relationship was found.',
      assumptionNarrative: 'Spearman\'s correlation was selected as a nonparametric alternative because [the data were ordinal / normality assumptions were violated].',
      effectSizeInterpretation: {
        'weak': 'rs < .30 indicates a weak relationship',
        'moderate': '.30 ≤ rs < .50 indicates a moderate relationship',
        'strong': 'rs ≥ .50 indicates a strong relationship'
      },
      tableTitle: 'Table [N]: Spearman Correlations Among Variables'
    },
    
    'kendall-tau': {
      name: 'Kendall\'s Tau-b Correlation',
      category: 'correlation',
      apaNotation: 'τb = .XX, p = .XXX',
      introTemplate: 'Kendall\'s tau-b coefficient was computed to examine the ordinal association between variables, particularly suitable for data with tied ranks.',
      requiredStats: ['tau', 'p', 'n'],
      forbiddenStats: ['t', 'F', 'mean', 'sd'],
      narrativePattern: 'There was a [weak/moderate/strong] [positive/negative] association between [variable1] and [variable2], τb = [tau], p [< .001 / = .XXX].',
      hypothesisSupported: 'The results support [hypothesis_id], indicating a significant ordinal association.',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; no significant ordinal association was found.',
      assumptionNarrative: 'Kendall\'s tau-b was selected as it handles tied ranks more effectively than Spearman\'s correlation.',
      effectSizeInterpretation: {
        'weak': 'τb < .20 indicates a weak association',
        'moderate': '.20 ≤ τb < .40 indicates a moderate association',
        'strong': 'τb ≥ .40 indicates a strong association'
      },
      tableTitle: 'Table [N]: Kendall\'s Tau-b Correlations'
    },
    
    'chi-square': {
      name: 'Chi-Square Test of Independence',
      category: 'nonparametric',
      apaNotation: 'χ²(df) = X.XX, p = .XXX, V = .XX',
      introTemplate: 'A chi-square test of independence was conducted to examine the association between [variable1] and [variable2].',
      requiredStats: ['chi_square', 'df', 'p', 'cramers_v', 'n', 'expected_counts', 'observed_counts'],
      forbiddenStats: ['mean', 'sd', 't', 'F', 'r'],
      narrativePattern: 'There was a significant association between [variable1] and [variable2], χ²([df]) = [chi_square], p [< .001 / = .XXX]. Cramér\'s V = [cramers_v] indicates a [small/medium/large] effect size.',
      hypothesisSupported: 'The results support [hypothesis_id], indicating a significant association between [variable1] and [variable2].',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; no significant association was found between [variable1] and [variable2].',
      assumptionNarrative: 'The chi-square test assumes that expected cell frequencies are at least 5. [X] cells ([percent]%) had expected counts less than 5. [If violated: Fisher\'s exact test was considered.]',
      effectSizeInterpretation: {
        'small': 'V = .10 represents a small effect',
        'medium': 'V = .30 represents a medium effect',
        'large': 'V = .50 represents a large effect'
      },
      tableTitle: 'Table [N]: Chi-Square Test of Independence for [Variable1] and [Variable2]',
      figureTitle: 'Figure [N]: Distribution of [Variable1] by [Variable2]'
    },
    
    'mann-whitney': {
      name: 'Mann-Whitney U Test',
      category: 'nonparametric',
      apaNotation: 'U = X, z = X.XX, p = .XXX, r = .XX',
      introTemplate: 'A Mann-Whitney U test was conducted to compare [dependent_variable] between two groups, as the assumption of normality was violated.',
      requiredStats: ['U', 'z', 'p', 'r_effect', 'median1', 'median2', 'mean_rank1', 'mean_rank2', 'n1', 'n2'],
      forbiddenStats: ['mean', 'sd', 't', 'F'],
      narrativePattern: 'The Mann-Whitney U test indicated that [dependent_variable] was significantly [higher/lower] for [group1] (Mdn = [median1], mean rank = [mean_rank1]) than for [group2] (Mdn = [median2], mean rank = [mean_rank2]), U = [U], z = [z], p [< .001 / = .XXX], with a [small/medium/large] effect size (r = [r_effect]).',
      hypothesisSupported: 'The results support [hypothesis_id], indicating a significant difference in [dependent_variable] between the groups.',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; no significant difference was found between the groups.',
      assumptionNarrative: 'The Mann-Whitney U test was selected as the nonparametric alternative to the independent t-test because the assumption of normality was violated (Shapiro-Wilk test [results]).',
      effectSizeInterpretation: {
        'small': 'r = .10 represents a small effect',
        'medium': 'r = .30 represents a medium effect',
        'large': 'r = .50 represents a large effect'
      },
      tableTitle: 'Table [N]: Mann-Whitney U Test Results for [Variable]'
    },
    
    'wilcoxon': {
      name: 'Wilcoxon Signed-Rank Test',
      category: 'nonparametric',
      apaNotation: 'W = X, z = X.XX, p = .XXX, r = .XX',
      introTemplate: 'A Wilcoxon signed-rank test was conducted to compare [variable] between two related conditions, as the assumption of normality for the difference scores was violated.',
      requiredStats: ['W', 'z', 'p', 'r_effect', 'median1', 'median2', 'positive_ranks', 'negative_ranks', 'ties'],
      forbiddenStats: ['mean', 'sd', 't'],
      narrativePattern: 'The Wilcoxon signed-rank test revealed a significant [increase/decrease] from [condition1] (Mdn = [median1]) to [condition2] (Mdn = [median2]), W = [W], z = [z], p [< .001 / = .XXX], with a [small/medium/large] effect size (r = [r_effect]).',
      hypothesisSupported: 'The results support [hypothesis_id], indicating a significant change between the conditions.',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; no significant change was found between the conditions.',
      assumptionNarrative: 'The Wilcoxon signed-rank test was used as the nonparametric alternative to the paired t-test because the difference scores were not normally distributed.',
      effectSizeInterpretation: {
        'small': 'r = .10 represents a small effect',
        'medium': 'r = .30 represents a medium effect',
        'large': 'r = .50 represents a large effect'
      },
      tableTitle: 'Table [N]: Wilcoxon Signed-Rank Test Results'
    },
    
    'kruskal-wallis': {
      name: 'Kruskal-Wallis H Test',
      category: 'nonparametric',
      apaNotation: 'H(df) = X.XX, p = .XXX, ε² = .XX',
      introTemplate: 'A Kruskal-Wallis H test was conducted to compare [dependent_variable] across [number] groups, as the assumptions for parametric ANOVA were violated.',
      requiredStats: ['H', 'df', 'p', 'epsilon_squared', 'medians', 'mean_ranks', 'ns'],
      forbiddenStats: ['mean', 'sd', 'F'],
      narrativePattern: 'The Kruskal-Wallis H test revealed significant differences in [dependent_variable] across groups, H([df]) = [H], p [< .001 / = .XXX], ε² = [epsilon_squared]. Dunn\'s post-hoc test with Bonferroni correction indicated [specific_differences].',
      hypothesisSupported: 'The results support [hypothesis_id], indicating significant differences across the groups.',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; no significant differences were found across the groups.',
      assumptionNarrative: 'The Kruskal-Wallis test was employed as the nonparametric alternative to one-way ANOVA because [normality/homogeneity] assumptions were violated.',
      effectSizeInterpretation: {
        'small': 'ε² = .01 represents a small effect',
        'medium': 'ε² = .06 represents a medium effect',
        'large': 'ε² = .14 represents a large effect'
      },
      tableTitle: 'Table [N]: Kruskal-Wallis H Test Results for [Variable]'
    },
    
    'friedman': {
      name: 'Friedman Test',
      category: 'nonparametric',
      apaNotation: 'χ²(df) = X.XX, p = .XXX, W = .XX',
      introTemplate: 'A Friedman test was conducted to compare [variable] across [number] related conditions, as the assumption of normality for repeated measures ANOVA was violated.',
      requiredStats: ['chi_square', 'df', 'p', 'kendalls_w', 'medians', 'mean_ranks'],
      forbiddenStats: ['F', 'mean', 'sd'],
      narrativePattern: 'The Friedman test indicated significant differences across conditions, χ²([df]) = [chi_square], p [< .001 / = .XXX], Kendall\'s W = [kendalls_w]. Pairwise Wilcoxon tests with Bonferroni correction revealed [specific_differences].',
      hypothesisSupported: 'The results support [hypothesis_id], indicating significant differences across conditions.',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; no significant differences were found across conditions.',
      assumptionNarrative: 'The Friedman test was used as the nonparametric alternative to repeated measures ANOVA due to violations of normality assumptions.',
      effectSizeInterpretation: {
        'small': 'W = .10 represents a small effect',
        'medium': 'W = .30 represents a medium effect',
        'large': 'W = .50 represents a large effect'
      },
      tableTitle: 'Table [N]: Friedman Test Results'
    },
    
    'simple-linear-regression': {
      name: 'Simple Linear Regression',
      category: 'regression',
      apaNotation: 'F(df1, df2) = X.XX, p = .XXX, R² = .XX',
      introTemplate: 'A simple linear regression was performed to predict [dependent_variable] from [independent_variable].',
      requiredStats: ['r', 'r_squared', 'adjusted_r_squared', 'F', 'df1', 'df2', 'p_model', 'b0', 'b1', 'se_b', 't', 'p_coef', 'ci_lower', 'ci_upper'],
      forbiddenStats: ['chi_square', 'mann_whitney'],
      narrativePattern: 'The regression model was significant, F([df1], [df2]) = [F], p [< .001 / = .XXX], R² = [r_squared]. [Independent_variable] significantly predicted [dependent_variable], β = [b1], t([df]) = [t], p [< .001 / = .XXX], indicating that for each unit increase in [independent_variable], [dependent_variable] [increased/decreased] by [b1] units.',
      hypothesisSupported: 'The results support [hypothesis_id], indicating that [independent_variable] significantly predicts [dependent_variable].',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; [independent_variable] did not significantly predict [dependent_variable].',
      assumptionNarrative: 'Regression assumptions were evaluated: linearity was confirmed through scatterplot inspection, homoscedasticity was assessed via residual plots, normality of residuals was tested using the Shapiro-Wilk test, and independence of errors was evaluated using the Durbin-Watson statistic.',
      effectSizeInterpretation: {
        'small': 'R² = .02 represents a small effect',
        'medium': 'R² = .13 represents a medium effect',
        'large': 'R² = .26 represents a large effect'
      },
      tableTitle: 'Table [N]: Simple Linear Regression Predicting [DV] from [IV]',
      figureTitle: 'Figure [N]: Scatterplot with Regression Line for [DV] and [IV]'
    },
    
    'multiple-regression': {
      name: 'Multiple Linear Regression',
      category: 'regression',
      apaNotation: 'F(df1, df2) = X.XX, p = .XXX, R² = .XX, Adjusted R² = .XX',
      introTemplate: 'A multiple linear regression was conducted to examine the extent to which [list of IVs] predicted [dependent_variable].',
      requiredStats: ['r', 'r_squared', 'adjusted_r_squared', 'se_estimate', 'F', 'df1', 'df2', 'p_model', 'coefficients', 'vif', 'tolerance', 'durbin_watson'],
      forbiddenStats: ['chi_square', 'mann_whitney'],
      narrativePattern: 'The overall regression model was significant, F([df1], [df2]) = [F], p [< .001 / = .XXX], explaining [percent]% of the variance in [dependent_variable] (R² = [r_squared], Adjusted R² = [adj_r_squared]). Examination of individual predictors revealed that [significant_predictors].',
      hypothesisSupported: 'The results support [hypothesis_id], indicating that [predictors] significantly predict [dependent_variable].',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; the predictors did not significantly predict [dependent_variable].',
      assumptionNarrative: 'Multiple regression assumptions were evaluated: multicollinearity was assessed using VIF (all values < 10) and tolerance (all values > 0.1). Linearity and homoscedasticity were evaluated through residual plots. Normality of residuals was assessed using the Shapiro-Wilk test. Independence of errors was evaluated using the Durbin-Watson statistic (d = [value]).',
      effectSizeInterpretation: {
        'small': 'R² = .02 represents a small effect',
        'medium': 'R² = .13 represents a medium effect',
        'large': 'R² = .26 represents a large effect'
      },
      tableTitle: 'Table [N]: Multiple Regression Model Summary and Coefficients'
    },
    
    'logistic-regression': {
      name: 'Binary Logistic Regression',
      category: 'regression',
      apaNotation: 'χ²(df) = X.XX, p = .XXX, Nagelkerke R² = .XX',
      introTemplate: 'Binary logistic regression was performed to examine the effects of [predictors] on the likelihood of [outcome].',
      requiredStats: ['chi_square', 'df', 'p_model', 'neg2ll', 'cox_snell', 'nagelkerke', 'coefficients_b', 'se', 'wald', 'exp_b', 'ci_exp_b', 'classification_accuracy'],
      forbiddenStats: ['r_pearson', 'F', 'eta_squared'],
      narrativePattern: 'The logistic regression model was significant, χ²([df]) = [chi_square], p [< .001 / = .XXX], Nagelkerke R² = [nagelkerke], correctly classifying [percent]% of cases. [Predictor] was a significant predictor; for each unit increase in [predictor], the odds of [outcome] [increased/decreased] by a factor of [exp_b] (95% CI [[ci_lower], [ci_upper]]).',
      hypothesisSupported: 'The results support [hypothesis_id], indicating that [predictors] significantly predict the likelihood of [outcome].',
      hypothesisNotSupported: 'The results do not support [hypothesis_id]; [predictors] did not significantly predict [outcome].',
      assumptionNarrative: 'Logistic regression assumptions were evaluated: linearity of the logit was assessed, multicollinearity was checked using VIF, and the Hosmer-Lemeshow test evaluated model fit.',
      effectSizeInterpretation: {
        'small': 'Nagelkerke R² < .10 represents a small effect',
        'medium': 'Nagelkerke R² = .10-.25 represents a medium effect',
        'large': 'Nagelkerke R² > .25 represents a large effect'
      },
      tableTitle: 'Table [N]: Logistic Regression Predicting [Outcome]'
    },
    
    'kmo-bartlett': {
      name: 'KMO and Bartlett\'s Test',
      category: 'factor',
      apaNotation: 'KMO = .XX, χ²(df) = X.XX, p < .001',
      introTemplate: 'Prior to conducting factor analysis, the factorability of the correlation matrix was assessed using the Kaiser-Meyer-Olkin (KMO) measure of sampling adequacy and Bartlett\'s test of sphericity.',
      requiredStats: ['kmo', 'chi_square', 'df', 'p'],
      forbiddenStats: ['mean', 'sd', 't', 'F', 'r'],
      narrativePattern: 'The KMO value was [kmo], which is [meritorious/middling/mediocre/miserable/marvelous] according to Kaiser\'s classification. Bartlett\'s test of sphericity was significant, χ²([df]) = [chi_square], p < .001, indicating that the correlations between items were sufficient for factor analysis.',
      hypothesisSupported: '',
      hypothesisNotSupported: '',
      assumptionNarrative: 'KMO values above .60 and a significant Bartlett\'s test are required to proceed with factor analysis.',
      effectSizeInterpretation: {
        'marvelous': 'KMO ≥ .90 is marvelous',
        'meritorious': '.80 ≤ KMO < .90 is meritorious',
        'middling': '.70 ≤ KMO < .80 is middling',
        'mediocre': '.60 ≤ KMO < .70 is mediocre',
        'miserable': '.50 ≤ KMO < .60 is miserable',
        'unacceptable': 'KMO < .50 is unacceptable'
      },
      tableTitle: 'Table [N]: KMO and Bartlett\'s Test of Sphericity'
    },
    
    'efa': {
      name: 'Exploratory Factor Analysis',
      category: 'factor',
      apaNotation: 'Factor loadings > .40, eigenvalues > 1.0',
      introTemplate: 'Exploratory factor analysis with [rotation_type] rotation was conducted to examine the underlying factor structure of the [number]-item scale.',
      requiredStats: ['kmo', 'bartlett_chi', 'n_factors', 'eigenvalues', 'variance_explained', 'cumulative_variance', 'factor_loadings', 'communalities'],
      forbiddenStats: ['mean', 'sd', 't', 'F', 'r'],
      narrativePattern: '[Number] factors were extracted with eigenvalues greater than 1.0, collectively accounting for [percent]% of the total variance. Factor loadings above .40 were used to interpret the factor structure. [Describe each factor and its items.]',
      hypothesisSupported: '',
      hypothesisNotSupported: '',
      assumptionNarrative: 'The KMO measure of sampling adequacy ([kmo]) and Bartlett\'s test of sphericity (p < .001) confirmed the suitability of the data for factor analysis.',
      effectSizeInterpretation: {
        'acceptable': 'Factor loadings > .40 are considered acceptable',
        'good': 'Factor loadings > .60 are considered good',
        'excellent': 'Factor loadings > .80 are considered excellent'
      },
      tableTitle: 'Table [N]: Factor Loadings from Exploratory Factor Analysis',
      figureTitle: 'Figure [N]: Scree Plot for Factor Extraction'
    }
  };
  
  return writingLogicLibrary[testType] || {
    name: testType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    category: 'descriptive',
    apaNotation: 'Report all relevant statistics',
    introTemplate: 'Statistical analysis was conducted to address the research question.',
    requiredStats: [],
    forbiddenStats: [],
    narrativePattern: 'The analysis revealed the following findings.',
    hypothesisSupported: 'The results support the hypothesis.',
    hypothesisNotSupported: 'The results do not support the hypothesis.',
    assumptionNarrative: 'Appropriate assumptions were evaluated prior to analysis.',
    effectSizeInterpretation: {},
    tableTitle: 'Table [N]: Statistical Results'
  };
}

// ============================================================================
// SYSTEM PROMPT BUILDER
// ============================================================================

function buildSystemPrompt(type: string, testType: string, writingLogic: WritingLogic, isPro: boolean, supervisorMode: boolean): string {
  const baseGuidelines = `
CRITICAL WRITING RULES:
1. Write in formal academic English suitable for a doctoral dissertation
2. NEVER use AI meta-language like "I analyzed", "The AI found", "Let me explain"
3. Use passive voice and third person throughout
4. Be precise with statistical notation - italicize test statistics (t, F, r, p, χ², η²)
5. Report exact p-values to three decimal places (p = .023), except use p < .001 for very small values
6. Always include effect sizes with magnitude interpretations
7. Separate table interpretation and figure interpretation into distinct paragraphs
8. Reference questionnaire item numbers when applicable (e.g., Items Q12-Q18)
9. State assumption test results explicitly for all inferential tests

TEST-SPECIFIC REQUIREMENTS for ${writingLogic.name}:
- APA notation: ${writingLogic.apaNotation}
- Required statistics to report: ${writingLogic.requiredStats.join(', ')}
- Statistics to AVOID: ${writingLogic.forbiddenStats.join(', ')}
- Assumption narrative: ${writingLogic.assumptionNarrative}
`;

  const supervisorModeAdditions = supervisorMode ? `
SUPERVISOR MODE ENABLED - Additional requirements:
- Use conservative, hedged language (e.g., "The findings suggest..." rather than "The results prove...")
- Include ALL assumption checks with full detail
- Report 95% confidence intervals for all applicable statistics
- Avoid any causal claims; use correlational/associational language
- Note all potential limitations and alternative explanations
- Provide more extensive methodological justification
` : '';

  switch (type) {
    case 'summary':
      return `You are a statistics expert helping non-statisticians understand their ${writingLogic.name} results.

Write a clear, jargon-free summary that explains:
1. What the analysis tested
2. What the key findings are (in plain language)
3. Whether results are statistically significant and what that means practically
4. The effect size and its practical importance

${baseGuidelines}
${supervisorModeAdditions}

Keep it concise (2-3 paragraphs). Focus on practical implications.`;

    case 'apa':
      return `You are an academic writing expert specializing in APA 7th edition format for ${writingLogic.name} results.

Write a complete Results section following strict APA guidelines:

FORMAT REQUIREMENTS:
- Use proper statistical notation: ${writingLogic.apaNotation}
- Italicize statistical symbols (M, SD, t, F, p, r, η², etc.)
- Report exact p-values to three decimal places
- Use "p < .001" for very small p-values
- Include effect sizes with interpretations
- Report 95% confidence intervals where applicable

STRUCTURE:
1. Brief statement of analysis performed
2. Assumption checks paragraph (MANDATORY for inferential tests)
3. Descriptive statistics
4. Main statistical results with ALL relevant statistics
5. Effect size with interpretation
6. Hypothesis decision (if applicable)

${baseGuidelines}
${supervisorModeAdditions}`;

    case 'discussion':
      return `You are a research methodology expert writing a Discussion section for ${writingLogic.name} results.

Write an academic discussion including:

1. INTERPRETATION OF FINDINGS (1 paragraph)
   - Summarize main findings
   - Explain meaning in context of research question
   - Discuss statistical vs. practical significance

2. THEORETICAL IMPLICATIONS (1 paragraph)
   - How do findings relate to existing theory?
   - Are they consistent with or contrary to prior research?

3. PRACTICAL IMPLICATIONS (1 paragraph)
   - Real-world applications
   - Recommendations for practitioners

4. LIMITATIONS (1 paragraph)
   - Methodological limitations
   - Factors affecting generalizability

5. FUTURE RESEARCH (brief)
   - Questions remaining
   - Directions for future studies

${baseGuidelines}
${supervisorModeAdditions}`;

    case 'methodology':
      return `You are a research methodology expert writing a Methods section for a study using ${writingLogic.name}.

Write a complete Methodology section including:

1. RESEARCH DESIGN
   - Type of study design
   - Variables and their roles (IV, DV, covariates)

2. PARTICIPANTS/SAMPLE
   - Sample size and characteristics
   - Sampling method

3. MEASURES/VARIABLES
   - Description of each variable
   - Measurement level
   - Reference questionnaire items where applicable

4. STATISTICAL ANALYSIS
   - Specific test used and why appropriate
   - Alpha level
   - Assumption checks to be performed
   - Post-hoc tests if applicable

Write in past tense, third person, following APA style.

${baseGuidelines}
${supervisorModeAdditions}`;

    case 'full-results':
      return `You are a statistics expert writing a comprehensive Chapter Four Results section for ${writingLogic.name}.

Provide an extremely detailed analysis including:

1. PRELIMINARY ANALYSES
   - Data screening and cleaning
   - Assumption testing with FULL results (mandatory paragraph)
   - Descriptive statistics for all variables

2. MAIN ANALYSES
   - Complete statistical results with ALL test statistics
   - Exact p-values
   - Effect sizes with interpretations
   - Confidence intervals
   - Post-hoc tests if applicable

3. TABLE INTERPRETATION (separate paragraph)
   - Reference table number: "${writingLogic.tableTitle}"
   - Explain all columns and key values

4. FIGURE INTERPRETATION (separate paragraph if figure exists)
   - Reference figure number if applicable
   - Describe visual patterns

5. HYPOTHESIS DECISION (if linked to hypothesis)
   - State whether hypothesis is supported or not supported
   - Use appropriate template language

6. SUPPLEMENTARY ANALYSES
   - Any additional relevant analyses
   - Sensitivity checks if applicable

Use APA format throughout. Include all relevant statistics.
${isPro ? 'Provide maximum detail with advanced statistics.' : ''}

${baseGuidelines}
${supervisorModeAdditions}`;

    default:
      return `You are a helpful statistics assistant specializing in ${writingLogic.name}. Provide clear, accurate analysis following academic standards.

${baseGuidelines}
${supervisorModeAdditions}`;
  }
}

// ============================================================================
// USER PROMPT BUILDER
// ============================================================================

function buildUserPrompt(
  type: string,
  testType: string,
  results: unknown,
  researchQuestion?: string,
  hypothesis?: string,
  variables?: { dependent?: string[]; independent?: string[]; grouping?: string },
  sampleSize?: number,
  writingLogic?: WritingLogic,
  blockContext?: { hypothesisId?: string; sectionId?: string; tableNumber?: number; figureNumber?: number; itemRange?: string }
): string {
  let prompt = '';
  
  if (researchQuestion) {
    prompt += `Research Question: ${researchQuestion}\n\n`;
  }
  
  if (hypothesis) {
    prompt += `Hypothesis: ${hypothesis}\n\n`;
  }
  
  if (blockContext?.hypothesisId) {
    prompt += `Linked Hypothesis ID: ${blockContext.hypothesisId}\n`;
  }
  
  if (blockContext?.tableNumber) {
    prompt += `Table Number: Table ${blockContext.tableNumber}\n`;
  }
  
  if (blockContext?.figureNumber) {
    prompt += `Figure Number: Figure ${blockContext.figureNumber}\n`;
  }
  
  if (blockContext?.itemRange) {
    prompt += `Questionnaire Items: ${blockContext.itemRange}\n`;
  }
  
  prompt += '\n';
  
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
  
  prompt += `Test Type: ${writingLogic?.name || testType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n`;
  
  prompt += `Statistical Results:\n${JSON.stringify(results, null, 2)}\n\n`;
  
  // Add writing logic guidance
  if (writingLogic) {
    prompt += `\nWriting Template Guidance:\n`;
    prompt += `- Introduction Pattern: ${writingLogic.introTemplate}\n`;
    prompt += `- Narrative Pattern: ${writingLogic.narrativePattern}\n`;
    if (hypothesis && writingLogic.hypothesisSupported) {
      prompt += `- If significant: ${writingLogic.hypothesisSupported}\n`;
      prompt += `- If not significant: ${writingLogic.hypothesisNotSupported}\n`;
    }
  }
  
  prompt += `\nPlease generate a ${type} interpretation of these results.`;
  
  switch (type) {
    case 'apa':
      prompt += ' Format the output in proper APA 7th edition style, ready for inclusion in a research paper. Include a separate paragraph for assumption checks.';
      break;
    case 'discussion':
      prompt += ' Write a scholarly discussion section that critically analyzes these findings.';
      break;
    case 'methodology':
      prompt += ' Write a complete Methods section describing how this analysis was conducted.';
      break;
    case 'full-results':
      prompt += ' Provide an extremely comprehensive Chapter Four analysis. Include separate paragraphs for: (1) assumption checks, (2) table interpretation, (3) figure interpretation if applicable, (4) hypothesis decision if applicable.';
      break;
  }
  
  return prompt;
}
