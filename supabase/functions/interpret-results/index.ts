import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================================
// STRICT DATA VALIDATION - BLOCK HALLUCINATION AT ARCHITECTURE LEVEL
// ============================================================================

interface ValidatedResults {
  isValid: boolean;
  errors: string[];
  extractedStats: ExtractedStatistics;
  rawTables: TableData[];
}

interface TableData {
  title: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

interface ExtractedStatistics {
  sampleSize: number | null;
  testStatistic: number | null;
  testStatisticName: string | null;
  degreesOfFreedom: number | string | null;
  pValue: number | null;
  effectSize: number | null;
  effectSizeName: string | null;
  means: Record<string, number>;
  standardDeviations: Record<string, number>;
  frequencies: Record<string, number>;
  percentages: Record<string, number>;
  correlations: Record<string, number>;
  groupLabels: string[];
  variableNames: string[];
  confidenceInterval?: { lower: number; upper: number };
  additionalStats: Record<string, unknown>;
}

function validateAndExtractResults(results: unknown, testType: string): ValidatedResults {
  const errors: string[] = [];
  const extractedStats: ExtractedStatistics = {
    sampleSize: null,
    testStatistic: null,
    testStatisticName: null,
    degreesOfFreedom: null,
    pValue: null,
    effectSize: null,
    effectSizeName: null,
    means: {},
    standardDeviations: {},
    frequencies: {},
    percentages: {},
    correlations: {},
    groupLabels: [],
    variableNames: [],
    additionalStats: {},
  };
  
  // Check if results exist at all
  if (!results || typeof results !== 'object') {
    errors.push('CRITICAL: No analysis results provided. Cannot generate interpretation without executed analysis data.');
    return { isValid: false, errors, extractedStats, rawTables: [] };
  }
  
  const resultsObj = results as Record<string, unknown>;
  
  // Check for tables array
  if (!resultsObj.tables || !Array.isArray(resultsObj.tables) || resultsObj.tables.length === 0) {
    errors.push('CRITICAL: No results tables found. Analysis must be executed in Step 5 before generating interpretation.');
    return { isValid: false, errors, extractedStats, rawTables: [] };
  }
  
  const tables = resultsObj.tables as TableData[];
  
  // Extract statistics from tables based on test type
  for (const table of tables) {
    if (!table.rows || table.rows.length === 0) {
      errors.push(`WARNING: Table "${table.title}" has no data rows.`);
      continue;
    }
    
    for (const row of table.rows) {
      // Extract sample size (N)
      if (row.N !== undefined && row.N !== null) {
        extractedStats.sampleSize = Number(row.N);
      }
      if (row.n !== undefined && row.n !== null) {
        extractedStats.sampleSize = Number(row.n);
      }
      if (row['Sample Size'] !== undefined) {
        extractedStats.sampleSize = Number(row['Sample Size']);
      }
      
      // Extract test statistics
      if (row.t !== undefined) {
        extractedStats.testStatistic = Number(row.t);
        extractedStats.testStatisticName = 't';
      }
      if (row.F !== undefined) {
        extractedStats.testStatistic = Number(row.F);
        extractedStats.testStatisticName = 'F';
      }
      if (row['Chi-Square'] !== undefined || row['χ²'] !== undefined || row.chi_square !== undefined) {
        extractedStats.testStatistic = Number(row['Chi-Square'] || row['χ²'] || row.chi_square);
        extractedStats.testStatisticName = 'χ²';
      }
      if (row.r !== undefined && testType.includes('pearson')) {
        extractedStats.testStatistic = Number(row.r);
        extractedStats.testStatisticName = 'r';
      }
      if (row.U !== undefined) {
        extractedStats.testStatistic = Number(row.U);
        extractedStats.testStatisticName = 'U';
      }
      if (row.H !== undefined) {
        extractedStats.testStatistic = Number(row.H);
        extractedStats.testStatisticName = 'H';
      }
      if (row['Friedman Chi-Square'] !== undefined) {
        extractedStats.testStatistic = Number(row['Friedman Chi-Square']);
        extractedStats.testStatisticName = 'χ²';
      }
      
      // Extract degrees of freedom
      if (row.df !== undefined) {
        extractedStats.degreesOfFreedom = String(row.df);
      }
      if (row['df1'] !== undefined && row['df2'] !== undefined) {
        extractedStats.degreesOfFreedom = `${row['df1']}, ${row['df2']}`;
      }
      
      // Extract p-value
      if (row.p !== undefined && row.p !== null) {
        extractedStats.pValue = Number(row.p);
      }
      if (row['p-value'] !== undefined) {
        extractedStats.pValue = Number(row['p-value']);
      }
      if (row['Sig.'] !== undefined) {
        extractedStats.pValue = Number(row['Sig.']);
      }
      
      // Extract effect sizes
      if (row.d !== undefined || row["Cohen's d"] !== undefined) {
        extractedStats.effectSize = Number(row.d || row["Cohen's d"]);
        extractedStats.effectSizeName = "Cohen's d";
      }
      if (row['η²'] !== undefined || row.eta_squared !== undefined || row['Eta Squared'] !== undefined) {
        extractedStats.effectSize = Number(row['η²'] || row.eta_squared || row['Eta Squared']);
        extractedStats.effectSizeName = 'η²';
      }
      if (row["Cramér's V"] !== undefined || row.cramers_v !== undefined) {
        extractedStats.effectSize = Number(row["Cramér's V"] || row.cramers_v);
        extractedStats.effectSizeName = "Cramér's V";
      }
      if (row['R²'] !== undefined || row.r_squared !== undefined) {
        extractedStats.effectSize = Number(row['R²'] || row.r_squared);
        extractedStats.effectSizeName = 'R²';
      }
      if (row.alpha !== undefined || row["Cronbach's Alpha"] !== undefined) {
        extractedStats.effectSize = Number(row.alpha || row["Cronbach's Alpha"]);
        extractedStats.effectSizeName = 'α';
      }
      
      // Extract means and SDs
      if (row.Mean !== undefined || row.mean !== undefined || row.M !== undefined) {
        const varName = String(row.Variable || row.Group || row.Category || 'Overall');
        extractedStats.means[varName] = Number(row.Mean || row.mean || row.M);
      }
      if (row.SD !== undefined || row.sd !== undefined || row['Std. Deviation'] !== undefined) {
        const varName = String(row.Variable || row.Group || row.Category || 'Overall');
        extractedStats.standardDeviations[varName] = Number(row.SD || row.sd || row['Std. Deviation']);
      }
      
      // Extract frequencies and percentages
      if (row.Count !== undefined || row.Frequency !== undefined || row.n !== undefined) {
        const category = String(row.Category || row.Value || row.Group || 'Unknown');
        extractedStats.frequencies[category] = Number(row.Count || row.Frequency || row.n);
      }
      if (row.Percent !== undefined || row.Percentage !== undefined || row['%'] !== undefined) {
        const category = String(row.Category || row.Value || row.Group || 'Unknown');
        extractedStats.percentages[category] = Number(row.Percent || row.Percentage || row['%']);
      }
      
      // Extract group labels
      if (row.Group !== undefined && !extractedStats.groupLabels.includes(String(row.Group))) {
        extractedStats.groupLabels.push(String(row.Group));
      }
      if (row.Category !== undefined && !extractedStats.groupLabels.includes(String(row.Category))) {
        extractedStats.groupLabels.push(String(row.Category));
      }
      
      // Extract variable names
      if (row.Variable !== undefined && !extractedStats.variableNames.includes(String(row.Variable))) {
        extractedStats.variableNames.push(String(row.Variable));
      }
      
      // Extract confidence intervals
      if (row['CI Lower'] !== undefined && row['CI Upper'] !== undefined) {
        extractedStats.confidenceInterval = {
          lower: Number(row['CI Lower']),
          upper: Number(row['CI Upper']),
        };
      }
      if (row['95% CI'] !== undefined) {
        const ciMatch = String(row['95% CI']).match(/\[([-\d.]+),\s*([-\d.]+)\]/);
        if (ciMatch) {
          extractedStats.confidenceInterval = {
            lower: Number(ciMatch[1]),
            upper: Number(ciMatch[2]),
          };
        }
      }
      
      // Collect any additional useful stats
      for (const [key, value] of Object.entries(row)) {
        if (!['Variable', 'Group', 'Category', 'Value'].includes(key) && 
            extractedStats.additionalStats[key] === undefined &&
            value !== null && value !== undefined) {
          extractedStats.additionalStats[key] = value;
        }
      }
    }
  }
  
  // Validate required statistics based on test type
  const requirementsMap: Record<string, string[]> = {
    'independent-t-test': ['sampleSize', 'testStatistic', 'pValue', 'degreesOfFreedom'],
    'paired-t-test': ['sampleSize', 'testStatistic', 'pValue', 'degreesOfFreedom'],
    'one-sample-t-test': ['sampleSize', 'testStatistic', 'pValue', 'degreesOfFreedom'],
    'one-way-anova': ['sampleSize', 'testStatistic', 'pValue', 'degreesOfFreedom'],
    'chi-square': ['sampleSize', 'testStatistic', 'pValue', 'degreesOfFreedom'],
    'pearson': ['sampleSize', 'testStatistic', 'pValue'],
    'spearman': ['sampleSize', 'testStatistic', 'pValue'],
    'mann-whitney': ['sampleSize', 'testStatistic', 'pValue'],
    'wilcoxon': ['sampleSize', 'testStatistic', 'pValue'],
    'kruskal-wallis': ['sampleSize', 'testStatistic', 'pValue'],
    'friedman': ['sampleSize', 'testStatistic', 'pValue'],
    'frequencies': ['sampleSize'],
    'descriptives': ['sampleSize'],
    'cronbach-alpha': ['sampleSize'],
  };
  
  const requirements = requirementsMap[testType] || ['sampleSize'];
  
  for (const req of requirements) {
    const value = extractedStats[req as keyof ExtractedStatistics];
    if (value === null || value === undefined || 
        (typeof value === 'object' && Object.keys(value).length === 0)) {
      errors.push(`MISSING REQUIRED STATISTIC: ${req} not found in analysis results.`);
    }
  }
  
  // Final validation
  const isValid = errors.filter(e => e.startsWith('CRITICAL') || e.startsWith('MISSING')).length === 0;
  
  return { isValid, errors, extractedStats, rawTables: tables };
}

// ============================================================================
// STRICT PROMPT BUILDER - USES ONLY VALIDATED DATA
// ============================================================================

function buildStrictUserPrompt(
  type: string,
  testType: string,
  validatedResults: ValidatedResults,
  researchQuestion?: string,
  hypothesis?: string,
  variables?: { dependent?: string[]; independent?: string[]; grouping?: string },
  writingLogic?: WritingLogic,
  blockContext?: { hypothesisId?: string; sectionId?: string; tableNumber?: number; figureNumber?: number; itemRange?: string }
): string {
  const stats = validatedResults.extractedStats;
  
  let prompt = '=== STRICT DATA BINDING - USE ONLY THE FOLLOWING VERIFIED DATA ===\n\n';
  
  prompt += 'CRITICAL INSTRUCTION: You MUST use ONLY the exact values provided below. DO NOT invent, estimate, or hallucinate any statistics.\n\n';
  
  // Research context
  if (researchQuestion) {
    prompt += `RESEARCH QUESTION: ${researchQuestion}\n\n`;
  }
  
  if (hypothesis) {
    prompt += `HYPOTHESIS: ${hypothesis}\n\n`;
  }
  
  // Variables - EXACT as provided
  if (variables) {
    prompt += 'VARIABLES (use these exact names):\n';
    if (variables.dependent?.length) {
      prompt += `• Dependent Variable(s): ${variables.dependent.join(', ')}\n`;
    }
    if (variables.independent?.length) {
      prompt += `• Independent Variable(s): ${variables.independent.join(', ')}\n`;
    }
    if (variables.grouping) {
      prompt += `• Grouping Variable: ${variables.grouping}\n`;
    }
    prompt += '\n';
  }
  
  // Block context for table/figure numbering
  if (blockContext?.tableNumber) {
    prompt += `TABLE REFERENCE: Table ${blockContext.tableNumber}\n`;
  }
  if (blockContext?.figureNumber) {
    prompt += `FIGURE REFERENCE: Figure ${blockContext.figureNumber}\n`;
  }
  if (blockContext?.itemRange) {
    prompt += `QUESTIONNAIRE ITEMS: ${blockContext.itemRange}\n`;
  }
  prompt += '\n';
  
  // VERIFIED STATISTICS - The AI MUST use these exact values
  prompt += '=== VERIFIED STATISTICS (USE EXACTLY AS SHOWN) ===\n\n';
  
  if (stats.sampleSize !== null) {
    prompt += `SAMPLE SIZE: N = ${stats.sampleSize}\n`;
  }
  
  if (stats.testStatistic !== null && stats.testStatisticName) {
    prompt += `TEST STATISTIC: ${stats.testStatisticName} = ${formatNumber(stats.testStatistic)}\n`;
  }
  
  if (stats.degreesOfFreedom !== null) {
    prompt += `DEGREES OF FREEDOM: df = ${stats.degreesOfFreedom}\n`;
  }
  
  if (stats.pValue !== null) {
    const pFormatted = stats.pValue < 0.001 ? '< .001' : `= ${formatNumber(stats.pValue, 3)}`;
    prompt += `P-VALUE: p ${pFormatted}\n`;
  }
  
  if (stats.effectSize !== null && stats.effectSizeName) {
    prompt += `EFFECT SIZE: ${stats.effectSizeName} = ${formatNumber(stats.effectSize)}\n`;
    prompt += `EFFECT INTERPRETATION: ${interpretEffectSize(stats.effectSizeName, stats.effectSize)}\n`;
  }
  
  if (stats.confidenceInterval) {
    prompt += `95% CI: [${formatNumber(stats.confidenceInterval.lower)}, ${formatNumber(stats.confidenceInterval.upper)}]\n`;
  }
  
  prompt += '\n';
  
  // Descriptive statistics
  if (Object.keys(stats.means).length > 0) {
    prompt += 'DESCRIPTIVE STATISTICS:\n';
    for (const [group, mean] of Object.entries(stats.means)) {
      const sd = stats.standardDeviations[group];
      if (sd !== undefined) {
        prompt += `• ${group}: M = ${formatNumber(mean)}, SD = ${formatNumber(sd)}\n`;
      } else {
        prompt += `• ${group}: M = ${formatNumber(mean)}\n`;
      }
    }
    prompt += '\n';
  }
  
  // Frequencies
  if (Object.keys(stats.frequencies).length > 0) {
    prompt += 'FREQUENCY DATA:\n';
    for (const [category, count] of Object.entries(stats.frequencies)) {
      const pct = stats.percentages[category];
      if (pct !== undefined) {
        prompt += `• ${category}: n = ${count} (${formatNumber(pct, 1)}%)\n`;
      } else {
        prompt += `• ${category}: n = ${count}\n`;
      }
    }
    prompt += '\n';
  }
  
  // Group labels
  if (stats.groupLabels.length > 0) {
    prompt += `GROUPS/CATEGORIES: ${stats.groupLabels.join(', ')}\n\n`;
  }
  
  // Raw tables for context
  prompt += '=== RAW TABLE DATA ===\n';
  for (const table of validatedResults.rawTables) {
    prompt += `\n${table.title}:\n`;
    prompt += JSON.stringify(table.rows, null, 2);
    prompt += '\n';
  }
  
  prompt += '\n=== WRITING INSTRUCTIONS ===\n\n';
  
  if (writingLogic) {
    prompt += `TEST TYPE: ${writingLogic.name}\n`;
    prompt += `APA NOTATION: ${writingLogic.apaNotation}\n\n`;
  }
  
  // Type-specific instructions
  switch (type) {
    case 'summary':
      prompt += 'Generate a plain-language summary explaining what these specific results mean. Use the exact statistics provided above.';
      break;
    case 'apa':
      prompt += 'Generate an APA 7th edition Results section using the exact statistics provided above. Include assumption checks, descriptives, main results with the exact test statistic, df, and p-value shown, effect size with interpretation, and hypothesis decision.';
      break;
    case 'discussion':
      prompt += 'Generate a Discussion section interpreting these specific findings. Reference the exact statistics and effect sizes provided above.';
      break;
    case 'methodology':
      prompt += 'Generate a Methods section describing this specific analysis. Reference the exact sample size and variables provided above.';
      break;
    case 'full-results':
      prompt += 'Generate a comprehensive Chapter Four Results section using ONLY the verified data above. Include separate paragraphs for: (1) assumption checks, (2) descriptive statistics, (3) main analysis with exact test statistics, (4) table interpretation, (5) hypothesis decision. Use the exact N, df, test statistic, p-value, and effect size provided.';
      break;
  }
  
  prompt += '\n\nREMINDER: Use ONLY the data provided above. Do not invent any statistics, sample sizes, or variable names.';
  
  return prompt;
}

function formatNumber(value: number, decimals: number = 3): string {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(decimals);
}

function interpretEffectSize(name: string, value: number): string {
  const absValue = Math.abs(value);
  
  switch (name) {
    case "Cohen's d":
      if (absValue >= 0.8) return 'large effect';
      if (absValue >= 0.5) return 'medium effect';
      if (absValue >= 0.2) return 'small effect';
      return 'negligible effect';
    
    case 'η²':
    case 'partial η²':
      if (absValue >= 0.14) return 'large effect';
      if (absValue >= 0.06) return 'medium effect';
      if (absValue >= 0.01) return 'small effect';
      return 'negligible effect';
    
    case "Cramér's V":
      if (absValue >= 0.5) return 'large effect';
      if (absValue >= 0.3) return 'medium effect';
      if (absValue >= 0.1) return 'small effect';
      return 'negligible effect';
    
    case 'R²':
      if (absValue >= 0.26) return 'large effect (substantial variance explained)';
      if (absValue >= 0.13) return 'medium effect (moderate variance explained)';
      if (absValue >= 0.02) return 'small effect (minimal variance explained)';
      return 'negligible effect';
    
    case 'r':
      if (absValue >= 0.5) return 'strong relationship';
      if (absValue >= 0.3) return 'moderate relationship';
      if (absValue >= 0.1) return 'weak relationship';
      return 'negligible relationship';
    
    case 'α':
      if (absValue >= 0.9) return 'excellent internal consistency';
      if (absValue >= 0.8) return 'good internal consistency';
      if (absValue >= 0.7) return 'acceptable internal consistency';
      if (absValue >= 0.6) return 'questionable internal consistency';
      return 'poor internal consistency';
    
    default:
      return '';
  }
}

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
      narrativePattern: 'Cronbach\'s alpha for the [scale_name] scale ([n_items] items) indicated [interpretation] internal consistency (α = [alpha]).',
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
      hypothesisSupported: 'The results support the hypothesis, indicating that [variable] significantly differs from the hypothesized value.',
      hypothesisNotSupported: 'The results do not support the hypothesis; no significant difference was found between the sample mean and the hypothesized value.',
      assumptionNarrative: 'Prior to analysis, the assumption of normality was evaluated using the Shapiro-Wilk test.',
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
      hypothesisSupported: 'The results support the hypothesis, indicating a significant difference in [dependent_variable] between [group1] and [group2].',
      hypothesisNotSupported: 'The results do not support the hypothesis; no significant difference in [dependent_variable] was found between [group1] and [group2].',
      assumptionNarrative: 'Prior to analysis, the assumptions of normality and homogeneity of variances were evaluated.',
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
      hypothesisSupported: 'The results support the hypothesis, indicating a significant change in [variable] between the two measurement points.',
      hypothesisNotSupported: 'The results do not support the hypothesis; no significant change in [variable] was found between the measurement points.',
      assumptionNarrative: 'The assumption of normality for the difference scores was assessed using the Shapiro-Wilk test.',
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
      narrativePattern: 'There was a statistically significant difference in [dependent_variable] across groups, F([df_between], [df_within]) = [F], p [< .001 / = .XXX], η² = [eta_squared].',
      hypothesisSupported: 'The results support the hypothesis, indicating significant differences in [dependent_variable] among the groups.',
      hypothesisNotSupported: 'The results do not support the hypothesis; no significant differences in [dependent_variable] were found among the groups.',
      assumptionNarrative: 'Prior to analysis, the assumptions of normality and homogeneity of variances were evaluated.',
      effectSizeInterpretation: {
        'small': 'η² = .01 represents a small effect',
        'medium': 'η² = .06 represents a medium effect',
        'large': 'η² = .14 represents a large effect'
      },
      tableTitle: 'Table [N]: One-Way ANOVA Results for [Variable] by [Group]',
      figureTitle: 'Figure [N]: Mean [Variable] Scores Across [Groups]'
    },
    
    'chi-square': {
      name: 'Chi-Square Test of Independence',
      category: 'nonparametric',
      apaNotation: 'χ²(df, N = X) = X.XX, p = .XXX, V = .XX',
      introTemplate: 'A chi-square test of independence was conducted to examine the association between [variable1] and [variable2].',
      requiredStats: ['chi_square', 'df', 'p', 'n', 'cramers_v', 'observed_frequencies', 'expected_frequencies'],
      forbiddenStats: ['mean', 'sd', 't', 'F', 'r'],
      narrativePattern: 'A significant association was found between [variable1] and [variable2], χ²([df], N = [n]) = [chi_square], p [< .001 / = .XXX], V = [cramers_v].',
      hypothesisSupported: 'The results support the hypothesis, indicating a significant association between [variable1] and [variable2].',
      hypothesisNotSupported: 'The results do not support the hypothesis; no significant association was found between [variable1] and [variable2].',
      assumptionNarrative: 'The chi-square test requires that expected frequencies in each cell are at least 5.',
      effectSizeInterpretation: {
        'small': 'V = .10 represents a small effect',
        'medium': 'V = .30 represents a medium effect',
        'large': 'V = .50 represents a large effect'
      },
      tableTitle: 'Table [N]: Chi-Square Test Results for [Variable1] by [Variable2]',
      figureTitle: 'Figure [N]: Distribution of [Variable1] by [Variable2]'
    },
    
    'pearson': {
      name: 'Pearson Product-Moment Correlation',
      category: 'correlation',
      apaNotation: 'r(N-2) = .XX, p = .XXX',
      introTemplate: 'Pearson product-moment correlation coefficients were computed to assess the linear relationships between the continuous variables.',
      requiredStats: ['r', 'p', 'n', 'r_squared'],
      forbiddenStats: ['t', 'F', 'chi_square', 'mean', 'sd'],
      narrativePattern: 'There was a [weak/moderate/strong] [positive/negative] correlation between [variable1] and [variable2], r([df]) = [r], p [< .001 / = .XXX].',
      hypothesisSupported: 'The results support the hypothesis, indicating a significant [positive/negative] relationship between [variable1] and [variable2].',
      hypothesisNotSupported: 'The results do not support the hypothesis; no significant relationship was found between [variable1] and [variable2].',
      assumptionNarrative: 'Pearson correlation assumes linearity, bivariate normality, and homoscedasticity.',
      effectSizeInterpretation: {
        'weak': 'r < .30 indicates a weak relationship',
        'moderate': '.30 ≤ r < .50 indicates a moderate relationship',
        'strong': '.50 ≤ r < .70 indicates a strong relationship',
        'very_strong': 'r ≥ .70 indicates a very strong relationship'
      },
      tableTitle: 'Table [N]: Pearson Correlation Matrix',
      figureTitle: 'Figure [N]: Scatterplot of [Variable1] and [Variable2]'
    },
    
    'spearman': {
      name: 'Spearman Rank Correlation',
      category: 'nonparametric',
      apaNotation: 'rs(N) = .XX, p = .XXX',
      introTemplate: 'Spearman rank-order correlation coefficients were computed to assess the monotonic relationships between the ordinal variables.',
      requiredStats: ['rs', 'p', 'n'],
      forbiddenStats: ['t', 'F', 'chi_square', 'mean', 'sd'],
      narrativePattern: 'There was a [weak/moderate/strong] [positive/negative] monotonic relationship between [variable1] and [variable2], rs([n]) = [rs], p [< .001 / = .XXX].',
      hypothesisSupported: 'The results support the hypothesis.',
      hypothesisNotSupported: 'The results do not support the hypothesis.',
      assumptionNarrative: 'Spearman correlation does not assume normality and is appropriate for ordinal data.',
      effectSizeInterpretation: {
        'weak': 'rs < .30 indicates a weak relationship',
        'moderate': '.30 ≤ rs < .50 indicates a moderate relationship',
        'strong': 'rs ≥ .50 indicates a strong relationship'
      },
      tableTitle: 'Table [N]: Spearman Correlation Results'
    },
    
    'mann-whitney': {
      name: 'Mann-Whitney U Test',
      category: 'nonparametric',
      apaNotation: 'U = X.XX, p = .XXX, r = .XX',
      introTemplate: 'A Mann-Whitney U test was conducted to compare [dependent_variable] between [group1] and [group2].',
      requiredStats: ['U', 'p', 'n1', 'n2', 'mean_rank1', 'mean_rank2', 'effect_r'],
      forbiddenStats: ['t', 'F', 'mean', 'sd'],
      narrativePattern: 'The [group1] group (Mdn = [median1], mean rank = [mean_rank1]) scored significantly [higher/lower] than the [group2] group (Mdn = [median2], mean rank = [mean_rank2]), U = [U], p [< .001 / = .XXX], r = [effect_r].',
      hypothesisSupported: 'The results support the hypothesis.',
      hypothesisNotSupported: 'The results do not support the hypothesis.',
      assumptionNarrative: 'The Mann-Whitney U test is a nonparametric alternative that does not assume normality.',
      effectSizeInterpretation: {
        'small': 'r = .10 represents a small effect',
        'medium': 'r = .30 represents a medium effect',
        'large': 'r = .50 represents a large effect'
      },
      tableTitle: 'Table [N]: Mann-Whitney U Test Results'
    },
    
    'wilcoxon': {
      name: 'Wilcoxon Signed-Rank Test',
      category: 'nonparametric',
      apaNotation: 'W = X.XX, p = .XXX, r = .XX',
      introTemplate: 'A Wilcoxon signed-rank test was conducted to examine changes in [variable] between two related conditions.',
      requiredStats: ['W', 'Z', 'p', 'n', 'effect_r', 'positive_ranks', 'negative_ranks'],
      forbiddenStats: ['t', 'F', 'mean', 'sd'],
      narrativePattern: 'There was a significant [increase/decrease] in [variable], W = [W], Z = [Z], p [< .001 / = .XXX], r = [effect_r].',
      hypothesisSupported: 'The results support the hypothesis.',
      hypothesisNotSupported: 'The results do not support the hypothesis.',
      assumptionNarrative: 'The Wilcoxon signed-rank test is a nonparametric alternative to the paired t-test.',
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
      apaNotation: 'H(df) = X.XX, p = .XXX, η² = .XX',
      introTemplate: 'A Kruskal-Wallis H test was conducted to compare [dependent_variable] across the [number] groups.',
      requiredStats: ['H', 'df', 'p', 'mean_ranks', 'eta_squared'],
      forbiddenStats: ['t', 'F', 'mean', 'sd'],
      narrativePattern: 'A significant difference was found across groups, H([df]) = [H], p [< .001 / = .XXX], η² = [eta_squared].',
      hypothesisSupported: 'The results support the hypothesis.',
      hypothesisNotSupported: 'The results do not support the hypothesis.',
      assumptionNarrative: 'The Kruskal-Wallis test is a nonparametric alternative to one-way ANOVA.',
      effectSizeInterpretation: {
        'small': 'η² = .01 represents a small effect',
        'medium': 'η² = .06 represents a medium effect',
        'large': 'η² = .14 represents a large effect'
      },
      tableTitle: 'Table [N]: Kruskal-Wallis H Test Results'
    },
    
    'friedman': {
      name: 'Friedman Test',
      category: 'nonparametric',
      apaNotation: 'χ²(df) = X.XX, p = .XXX, W = .XX',
      introTemplate: 'A Friedman test was conducted to compare [variable] across [number] repeated conditions.',
      requiredStats: ['chi_square', 'df', 'p', 'mean_ranks', 'kendalls_w'],
      forbiddenStats: ['t', 'F', 'mean', 'sd'],
      narrativePattern: 'A significant difference was found across conditions, χ²([df]) = [chi_square], p [< .001 / = .XXX], W = [kendalls_w].',
      hypothesisSupported: 'The results support the hypothesis.',
      hypothesisNotSupported: 'The results do not support the hypothesis.',
      assumptionNarrative: 'The Friedman test is a nonparametric alternative to repeated-measures ANOVA.',
      effectSizeInterpretation: {
        'small': 'W = .10 represents a small effect',
        'medium': 'W = .30 represents a medium effect',
        'large': 'W = .50 represents a large effect'
      },
      tableTitle: 'Table [N]: Friedman Test Results'
    },
    
    'linear-regression': {
      name: 'Simple Linear Regression',
      category: 'regression',
      apaNotation: 'β = X.XX, t = X.XX, p = .XXX, R² = .XX',
      introTemplate: 'A simple linear regression was conducted to examine whether [predictor] significantly predicted [outcome].',
      requiredStats: ['R', 'R_squared', 'F', 'df1', 'df2', 'p', 'beta', 'se', 't', 'constant'],
      forbiddenStats: ['chi_square', 'correlation_matrix'],
      narrativePattern: 'The regression model was significant, F([df1], [df2]) = [F], p [< .001 / = .XXX], R² = [R_squared]. [Predictor] significantly predicted [outcome], β = [beta], t = [t], p = [p].',
      hypothesisSupported: 'The results support the hypothesis.',
      hypothesisNotSupported: 'The results do not support the hypothesis.',
      assumptionNarrative: 'Regression assumptions of linearity, normality, homoscedasticity, and independence were evaluated.',
      effectSizeInterpretation: {
        'small': 'R² = .02 represents a small effect',
        'medium': 'R² = .13 represents a medium effect',
        'large': 'R² = .26 represents a large effect'
      },
      tableTitle: 'Table [N]: Simple Linear Regression Results',
      figureTitle: 'Figure [N]: Scatterplot with Regression Line'
    },
    
    'kendall-tau': {
      name: 'Kendall\'s Tau Correlation',
      category: 'nonparametric',
      apaNotation: 'τ = .XX, p = .XXX',
      introTemplate: 'Kendall\'s tau-b correlation was computed to assess the ordinal association between the variables.',
      requiredStats: ['tau', 'p', 'n'],
      forbiddenStats: ['t', 'F', 'mean', 'sd'],
      narrativePattern: 'There was a [weak/moderate/strong] [positive/negative] association, τ = [tau], p [< .001 / = .XXX].',
      hypothesisSupported: 'The results support the hypothesis.',
      hypothesisNotSupported: 'The results do not support the hypothesis.',
      assumptionNarrative: 'Kendall\'s tau is appropriate for ordinal data with tied ranks.',
      effectSizeInterpretation: {
        'weak': 'τ < .20 indicates a weak association',
        'moderate': '.20 ≤ τ < .40 indicates a moderate association',
        'strong': 'τ ≥ .40 indicates a strong association'
      },
      tableTitle: 'Table [N]: Kendall\'s Tau Correlation Results'
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
CRITICAL RULES - STRICT DATA BINDING:
1. You MUST use ONLY the exact statistics provided in the user message
2. DO NOT invent, estimate, or hallucinate ANY values
3. If a statistic is not provided, state "not available" - DO NOT make up a value
4. Use the EXACT variable names provided - DO NOT rename or alter them
5. Use the EXACT sample size (N) provided - DO NOT change it
6. Use the EXACT test statistic, df, and p-value provided - DO NOT modify them

WRITING STANDARDS:
- Write in formal academic English suitable for a doctoral dissertation
- NEVER use AI meta-language like "I analyzed", "The AI found", "Let me explain"
- Use passive voice and third person throughout
- Past tense only
- No conversational language, no filler text, no repetition
- Be precise with statistical notation - italicize test statistics (t, F, r, p, χ², η²)
- Report exact p-values to three decimal places (p = .023), except use p < .001 for very small values
- Round all values to 3 decimal places; avoid scientific notation

TEST-SPECIFIC REQUIREMENTS for ${writingLogic.name}:
- APA notation: ${writingLogic.apaNotation}
- Required statistics: ${writingLogic.requiredStats.join(', ')}
`;

  const eightLayerStructure = `
MANDATORY 8-LAYER REPORTING STRUCTURE:
Every statistical result MUST follow these 8 layers in order:

Layer 1 - Test Identification: State what analysis was conducted and why.
Layer 2 - Statistical Evidence: Report in APA-7 format using exact notation (e.g., F(df1, df2) = X.XX, p = .XXX, η² = .XX).
Layer 3 - Decision Rule: If p < .05 → "The null hypothesis was rejected." If p ≥ .05 → "The null hypothesis was not rejected."
Layer 4 - Effect Size Interpretation: Classify using standard thresholds:
  η² ≥ .14 = Large, .06–.13 = Medium, .01–.05 = Small
  Cohen's d ≥ .80 = Large, .50–.79 = Medium, .20–.49 = Small
  r ≥ .50 = Strong, .30–.49 = Moderate, .10–.29 = Weak
  R² ≥ .26 = Large, .13–.25 = Medium, .02–.12 = Small
Layer 5 - Practical Interpretation: Translate the statistical meaning into scientific context.
Layer 6 - Assumption Reporting: Report normality (Shapiro-Wilk), homogeneity (Levene's), sphericity (Mauchly's), multicollinearity if provided.
Layer 7 - Post Hoc Reporting: Report pairwise comparisons (Tukey HSD, Bonferroni, etc.) if provided.
Layer 8 - Graph Interpretation: Reference any charts/figures if data exists.

TABLE FOOTNOTES (add after every results table reference):
*p < .05. **p < .01. ***p < .001.
Note. N = [sample size]. The null hypothesis was [rejected/not rejected] at the .05 significance level.
`;

  const supervisorModeAdditions = supervisorMode ? `
SUPERVISOR MODE - Use conservative language:
- Use hedged language (e.g., "The findings suggest..." not "The results prove...")
- Report 95% confidence intervals where provided
- Note all limitations
` : '';

  switch (type) {
    case 'summary':
      return `You are a statistics expert. Write a plain-language summary using ONLY the provided data.

${baseGuidelines}
${eightLayerStructure}
${supervisorModeAdditions}

Keep it concise (2-3 paragraphs). Use the exact statistics provided.`;

    case 'apa':
      return `You are an academic writing expert. Write an APA 7th edition Results section using ONLY the provided data.

FORMAT: ${writingLogic.apaNotation}

${baseGuidelines}
${eightLayerStructure}
${supervisorModeAdditions}`;

    case 'discussion':
      return `You are a research methodology expert. Write a Discussion section using ONLY the provided results.

${baseGuidelines}
${eightLayerStructure}
${supervisorModeAdditions}`;

    case 'methodology':
      return `You are a research methodology expert. Write a Methods section describing this analysis.

${baseGuidelines}
${supervisorModeAdditions}`;

    case 'full-results':
      return `You are the SPSS AI Academic Reporting Engine writing a comprehensive Chapter Four Results section.

STRUCTURE REQUIRED (follow 8-layer format for EACH statistical result):
1. Preliminary analyses (assumption checks - Layer 6)
2. Descriptive statistics with table references
3. Main analysis results following all 8 layers
4. Table interpretation with footnotes
5. Hypothesis decision (Layer 3)

${baseGuidelines}
${eightLayerStructure}
${supervisorModeAdditions}

Use ONLY the data provided. Include separate paragraphs for table and figure interpretation.
After EACH table reference, add: *p < .05. **p < .01. ***p < .001.`;

    default:
      return `You are a helpful statistics assistant. Use ONLY the provided data.

${baseGuidelines}
${eightLayerStructure}
${supervisorModeAdditions}`;
  }
}

// ============================================================================
// MAIN REQUEST HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, testType, results, researchQuestion, hypothesis, variables, sampleSize, isPro, supervisorMode, blockContext } = await req.json();

    console.log('Interpretation request:', type, 'for', testType);

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // STEP 1: Validate and extract results - BLOCK IF INVALID
    const validatedResults = validateAndExtractResults(results, testType);
    
    if (!validatedResults.isValid) {
      console.error('Validation failed:', validatedResults.errors);
      return new Response(JSON.stringify({ 
        error: 'Cannot generate interpretation: Missing required analysis data',
        details: validatedResults.errors,
        suggestion: 'Please run the analysis in Step 5 first to generate results.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Log extracted statistics for debugging
    console.log('Validated statistics:', JSON.stringify({
      sampleSize: validatedResults.extractedStats.sampleSize,
      testStatistic: validatedResults.extractedStats.testStatistic,
      pValue: validatedResults.extractedStats.pValue,
      effectSize: validatedResults.extractedStats.effectSize,
    }));

    const writingLogic = getWritingLogic(testType);
    const systemPrompt = buildSystemPrompt(type, testType, writingLogic, isPro, supervisorMode);
    
    // STEP 2: Build STRICT user prompt with ONLY validated data
    const userPrompt = buildStrictUserPrompt(
      type,
      testType,
      validatedResults,
      researchQuestion,
      hypothesis,
      variables,
      writingLogic,
      blockContext
    );

    console.log('Sending strict prompt to AI with validated data');

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
        temperature: 0.3, // Lower temperature for more deterministic output
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

    // Include metadata about what data was used
    return new Response(JSON.stringify({ 
      interpretation,
      metadata: {
        sampleSize: validatedResults.extractedStats.sampleSize,
        testStatistic: validatedResults.extractedStats.testStatistic,
        testStatisticName: validatedResults.extractedStats.testStatisticName,
        pValue: validatedResults.extractedStats.pValue,
        effectSize: validatedResults.extractedStats.effectSize,
        effectSizeName: validatedResults.extractedStats.effectSizeName,
        variablesUsed: validatedResults.extractedStats.variableNames,
        groupsUsed: validatedResults.extractedStats.groupLabels,
      }
    }), {
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
