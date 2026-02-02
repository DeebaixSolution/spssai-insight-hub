// ============================================
// SPSS-Level Statistical Analysis Types
// ============================================

// Variable roles matching SPSS Variable View
export type VariableRole = 'id' | 'demographic' | 'dependent' | 'independent' | 'scale_item' | null;
export type VariableMeasure = 'nominal' | 'ordinal' | 'scale';
export type VariableType = 'numeric' | 'string';

// Enhanced Variable Interface (SPSS Variable View)
export interface Variable {
  id?: string;
  name: string;
  label: string;
  type: VariableMeasure;
  measure: VariableMeasure;
  dataType: VariableType;
  role: VariableRole;
  width: number;
  decimals: number;
  valueLabels: Record<string, string>;
  missingValues: string[];
  columnIndex: number;
  scaleGroup?: string; // For grouping scale items (e.g., Q1_1, Q1_2 -> "Satisfaction Scale")
  uniqueValues?: number; // Count of unique values (for determining group count)
}

// Hypothesis types matching research methodology
export type HypothesisType = 'difference' | 'association' | 'prediction';
export type HypothesisStatus = 'untested' | 'supported' | 'rejected' | null;

// Structured Hypothesis
export interface Hypothesis {
  id: string; // UUID from database
  hypothesisId: string; // H1, H2, H3...
  type: HypothesisType;
  statement: string;
  dependentVariables: string[];
  independentVariables: string[];
  status: HypothesisStatus;
}

// Analysis block sections
export type AnalysisSection = 'descriptives' | 'reliability' | 'hypothesis';

// Assumption check results
export interface AssumptionResult {
  name: string; // 'normality', 'homogeneity', 'linearity', etc.
  test: string; // 'Shapiro-Wilk', 'Levene's', etc.
  statistic: number;
  df?: number;
  pValue: number;
  passed: boolean;
  message: string;
}

// Effect size result
export interface EffectSizeResult {
  name: string; // "Cohen's d", "η²", "r", etc.
  value: number;
  magnitude: 'negligible' | 'small' | 'medium' | 'large';
  interpretation: string;
}

// Confidence interval
export interface ConfidenceInterval {
  level: number; // 0.95 for 95%
  lower: number;
  upper: number;
}

// Post-hoc test result
export interface PostHocResult {
  comparison: string; // "Group A vs Group B"
  difference: number;
  pValue: number;
  significant: boolean;
  ciLower?: number;
  ciUpper?: number;
}

// Table structure (SPSS-style)
export interface StatisticalTable {
  title: string;
  headers: string[];
  rows: Array<Record<string, string | number>>;
  notes?: string[];
  tableNumber?: string; // "Table 4.1"
}

// Chart structure
export interface StatisticalChart {
  type: 'bar' | 'line' | 'scatter' | 'histogram' | 'boxplot' | 'pie';
  title: string;
  data: unknown;
  figureNumber?: string; // "Figure 4.1"
}

// Block results - output from statistical analysis
export interface BlockResults {
  tables: StatisticalTable[];
  charts: StatisticalChart[];
  effectSize?: EffectSizeResult;
  confidenceIntervals?: ConfidenceInterval[];
  postHocTests?: PostHocResult[];
  summary: string;
}

// Block narrative - AI-generated academic text
export interface BlockNarrative {
  sectionHeading: string;
  introduction: string;
  tableTitle: string;
  tableInterpretation: string;
  figureTitle?: string;
  figureInterpretation?: string;
  hypothesisDecision?: string;
  assumptionParagraph?: string;
}

// Analysis Block - core unit of the analysis system
export interface AnalysisBlock {
  id: string;
  analysisId: string;
  section: AnalysisSection;
  sectionId: string; // 'demographics', 'reliability', 'H1', 'H2', etc.
  testType: string;
  testCategory: string;
  dependentVariables: string[];
  independentVariables: string[];
  groupingVariable?: string;
  linkedHypothesisId?: string;
  config: Record<string, unknown>;
  assumptions: AssumptionResult[];
  results: BlockResults | null;
  narrative: BlockNarrative | null;
  displayOrder: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// Variable requirement for tests
export interface VariableRequirement {
  measures: VariableMeasure[];
  min: number;
  max: number;
}

// Test definition for the analysis library
export interface TestDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  requiredVariables: {
    dependent?: VariableRequirement;
    independent?: VariableRequirement;
    grouping?: VariableRequirement;
  };
  isPro: boolean;
  assumptions: string[]; // List of assumptions to check
  recommendedFor?: string; // Description of when to use
}

// Category definition
export interface CategoryDefinition {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

// Test recommendation from guided UI
export interface TestRecommendation {
  testId: string;
  testName: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  warnings?: string[];
}

// Complete analysis library
export const ANALYSIS_CATEGORIES: CategoryDefinition[] = [
  { id: 'descriptive', name: 'Descriptive & Preliminary', icon: '📊', description: 'Frequency tables, descriptives, data screening' },
  { id: 'reliability', name: 'Reliability', icon: '✓', description: 'Scale reliability and internal consistency' },
  { id: 'compare-means', name: 'Mean Comparisons', icon: '📈', description: 'T-tests, ANOVA, compare group means' },
  { id: 'nonparametric', name: 'Nonparametric Tests', icon: '📋', description: 'Distribution-free alternatives' },
  { id: 'correlation', name: 'Correlation', icon: '🔗', description: 'Relationship between variables' },
  { id: 'regression', name: 'Regression', icon: '📉', description: 'Prediction and modeling' },
  { id: 'factor-analysis', name: 'Factor Analysis', icon: '🧩', description: 'Dimensionality reduction' },
];

export const ANALYSIS_TESTS: TestDefinition[] = [
  // Descriptive & Preliminary
  {
    id: 'frequencies',
    name: 'Frequencies',
    description: 'Frequency tables and charts for categorical variables',
    category: 'descriptive',
    requiredVariables: { dependent: { measures: ['nominal', 'ordinal'], min: 1, max: 20 } },
    isPro: false,
    assumptions: [],
  },
  {
    id: 'descriptives',
    name: 'Descriptives',
    description: 'Mean, SD, min, max for scale variables',
    category: 'descriptive',
    requiredVariables: { dependent: { measures: ['scale'], min: 1, max: 20 } },
    isPro: false,
    assumptions: [],
  },
  {
    id: 'crosstabs',
    name: 'Crosstabs',
    description: 'Cross-tabulation with chi-square test',
    category: 'descriptive',
    requiredVariables: {
      dependent: { measures: ['nominal', 'ordinal'], min: 1, max: 1 },
      independent: { measures: ['nominal', 'ordinal'], min: 1, max: 1 },
    },
    isPro: false,
    assumptions: [],
  },
  {
    id: 'normality-test',
    name: 'Normality Tests',
    description: 'Shapiro-Wilk and Kolmogorov-Smirnov tests',
    category: 'descriptive',
    requiredVariables: { dependent: { measures: ['scale'], min: 1, max: 10 } },
    isPro: false,
    assumptions: [],
  },
  {
    id: 'outlier-detection',
    name: 'Outlier Detection',
    description: 'Identify extreme values using IQR and Z-scores',
    category: 'descriptive',
    requiredVariables: { dependent: { measures: ['scale'], min: 1, max: 10 } },
    isPro: false,
    assumptions: [],
  },

  // Reliability
  {
    id: 'cronbach-alpha',
    name: "Cronbach's Alpha",
    description: 'Internal consistency reliability for scales',
    category: 'reliability',
    requiredVariables: { dependent: { measures: ['scale', 'ordinal'], min: 2, max: 50 } },
    isPro: false,
    assumptions: [],
    recommendedFor: 'Scale items measuring the same construct',
  },
  {
    id: 'item-total',
    name: 'Item-Total Statistics',
    description: 'Item-total correlations and alpha if deleted',
    category: 'reliability',
    requiredVariables: { dependent: { measures: ['scale', 'ordinal'], min: 3, max: 50 } },
    isPro: true,
    assumptions: [],
  },

  // Mean Comparisons
  {
    id: 'one-sample-t-test',
    name: 'One-Sample T-Test',
    description: 'Compare sample mean to a known value',
    category: 'compare-means',
    requiredVariables: { dependent: { measures: ['scale'], min: 1, max: 1 } },
    isPro: false,
    assumptions: ['normality'],
    recommendedFor: 'Testing if mean differs from a specific value',
  },
  {
    id: 'independent-t-test',
    name: 'Independent Samples T-Test',
    description: 'Compare means of two independent groups',
    category: 'compare-means',
    requiredVariables: {
      dependent: { measures: ['scale'], min: 1, max: 1 },
      grouping: { measures: ['nominal', 'ordinal'], min: 1, max: 1 },
    },
    isPro: false,
    assumptions: ['normality', 'homogeneity'],
    recommendedFor: 'DV = Scale, IV = Nominal with 2 groups',
  },
  {
    id: 'paired-t-test',
    name: 'Paired Samples T-Test',
    description: 'Compare means of two related measurements',
    category: 'compare-means',
    requiredVariables: { dependent: { measures: ['scale'], min: 2, max: 2 } },
    isPro: false,
    assumptions: ['normality'],
    recommendedFor: 'Pre-post or matched pairs design',
  },
  {
    id: 'one-way-anova',
    name: 'One-Way ANOVA',
    description: 'Compare means across 3+ groups',
    category: 'compare-means',
    requiredVariables: {
      dependent: { measures: ['scale'], min: 1, max: 1 },
      grouping: { measures: ['nominal', 'ordinal'], min: 1, max: 1 },
    },
    isPro: false,
    assumptions: ['normality', 'homogeneity'],
    recommendedFor: 'DV = Scale, IV = Nominal with 3+ groups',
  },
  {
    id: 'two-way-anova',
    name: 'Two-Way ANOVA',
    description: 'Factorial ANOVA with two factors and interaction',
    category: 'compare-means',
    requiredVariables: {
      dependent: { measures: ['scale'], min: 1, max: 1 },
      independent: { measures: ['nominal', 'ordinal'], min: 2, max: 2 },
    },
    isPro: true,
    assumptions: ['normality', 'homogeneity'],
  },
  {
    id: 'repeated-measures-anova',
    name: 'Repeated Measures ANOVA',
    description: 'Compare means across 3+ time points or conditions',
    category: 'compare-means',
    requiredVariables: { dependent: { measures: ['scale'], min: 3, max: 10 } },
    isPro: true,
    assumptions: ['normality', 'sphericity'],
  },

  // Nonparametric
  {
    id: 'mann-whitney',
    name: 'Mann-Whitney U Test',
    description: 'Nonparametric alternative to independent t-test',
    category: 'nonparametric',
    requiredVariables: {
      dependent: { measures: ['scale', 'ordinal'], min: 1, max: 1 },
      grouping: { measures: ['nominal', 'ordinal'], min: 1, max: 1 },
    },
    isPro: false,
    assumptions: [],
    recommendedFor: 'When normality is violated for t-test',
  },
  {
    id: 'wilcoxon',
    name: 'Wilcoxon Signed-Rank Test',
    description: 'Nonparametric alternative to paired t-test',
    category: 'nonparametric',
    requiredVariables: { dependent: { measures: ['scale', 'ordinal'], min: 2, max: 2 } },
    isPro: false,
    assumptions: [],
  },
  {
    id: 'kruskal-wallis',
    name: 'Kruskal-Wallis H Test',
    description: 'Nonparametric alternative to one-way ANOVA',
    category: 'nonparametric',
    requiredVariables: {
      dependent: { measures: ['scale', 'ordinal'], min: 1, max: 1 },
      grouping: { measures: ['nominal', 'ordinal'], min: 1, max: 1 },
    },
    isPro: true,
    assumptions: [],
  },
  {
    id: 'friedman',
    name: 'Friedman Test',
    description: 'Nonparametric alternative to repeated measures ANOVA',
    category: 'nonparametric',
    requiredVariables: { dependent: { measures: ['scale', 'ordinal'], min: 3, max: 10 } },
    isPro: true,
    assumptions: [],
  },
  {
    id: 'chi-square',
    name: 'Chi-Square Test',
    description: 'Test association between categorical variables',
    category: 'nonparametric',
    requiredVariables: {
      dependent: { measures: ['nominal', 'ordinal'], min: 1, max: 1 },
      independent: { measures: ['nominal', 'ordinal'], min: 1, max: 1 },
    },
    isPro: false,
    assumptions: [],
  },

  // Correlation
  {
    id: 'pearson',
    name: 'Pearson Correlation',
    description: 'Linear correlation between scale variables',
    category: 'correlation',
    requiredVariables: { dependent: { measures: ['scale'], min: 2, max: 10 } },
    isPro: false,
    assumptions: ['normality', 'linearity'],
    recommendedFor: 'Two or more scale variables',
  },
  {
    id: 'spearman',
    name: 'Spearman Correlation',
    description: 'Rank correlation for ordinal or non-normal data',
    category: 'correlation',
    requiredVariables: { dependent: { measures: ['scale', 'ordinal'], min: 2, max: 10 } },
    isPro: false,
    assumptions: [],
    recommendedFor: 'Ordinal data or when normality is violated',
  },
  {
    id: 'kendall-tau',
    name: "Kendall's Tau",
    description: 'Rank correlation for small samples or many ties',
    category: 'correlation',
    requiredVariables: { dependent: { measures: ['scale', 'ordinal'], min: 2, max: 2 } },
    isPro: true,
    assumptions: [],
  },

  // Regression
  {
    id: 'simple-linear-regression',
    name: 'Simple Linear Regression',
    description: 'Predict outcome from single predictor',
    category: 'regression',
    requiredVariables: {
      dependent: { measures: ['scale'], min: 1, max: 1 },
      independent: { measures: ['scale'], min: 1, max: 1 },
    },
    isPro: false,
    assumptions: ['normality', 'linearity', 'homoscedasticity'],
  },
  {
    id: 'multiple-regression',
    name: 'Multiple Linear Regression',
    description: 'Predict outcome from multiple predictors',
    category: 'regression',
    requiredVariables: {
      dependent: { measures: ['scale'], min: 1, max: 1 },
      independent: { measures: ['scale', 'nominal', 'ordinal'], min: 2, max: 20 },
    },
    isPro: true,
    assumptions: ['normality', 'linearity', 'homoscedasticity', 'multicollinearity'],
  },
  {
    id: 'logistic-regression',
    name: 'Binary Logistic Regression',
    description: 'Predict binary outcome from predictors',
    category: 'regression',
    requiredVariables: {
      dependent: { measures: ['nominal'], min: 1, max: 1 },
      independent: { measures: ['scale', 'nominal', 'ordinal'], min: 1, max: 20 },
    },
    isPro: true,
    assumptions: [],
  },

  // Factor Analysis
  {
    id: 'kmo-bartlett',
    name: "KMO & Bartlett's Test",
    description: 'Test sampling adequacy for factor analysis',
    category: 'factor-analysis',
    requiredVariables: { dependent: { measures: ['scale'], min: 3, max: 50 } },
    isPro: true,
    assumptions: [],
  },
  {
    id: 'efa',
    name: 'Exploratory Factor Analysis',
    description: 'Extract underlying factors from variables',
    category: 'factor-analysis',
    requiredVariables: { dependent: { measures: ['scale'], min: 5, max: 50 } },
    isPro: true,
    assumptions: [],
  },
];

// Alias for backward compatibility
export const STATISTICAL_TESTS = ANALYSIS_TESTS;

// Get tests by category
export function getTestsByCategory(categoryId: string): TestDefinition[] {
  return ANALYSIS_TESTS.filter(t => t.category === categoryId);
}

// Get test by ID
export function getTestById(testId: string): TestDefinition | undefined {
  return ANALYSIS_TESTS.find(t => t.id === testId);
}

// Get recommended tests based on variable configuration
export function getRecommendedTests(
  variables: Variable[],
  hypotheses: Hypothesis[]
): TestRecommendation[] {
  const recommendations: TestRecommendation[] = [];
  
  const dvVars = variables.filter(v => v.role === 'dependent');
  const ivVars = variables.filter(v => v.role === 'independent');
  
  if (dvVars.length === 0) return recommendations;
  
  const dvMeasure = dvVars[0]?.measure;
  const ivMeasure = ivVars[0]?.measure;
  const groupCount = ivVars[0]?.uniqueValues;

  // Scale DV + Nominal IV with 2 groups
  if (dvMeasure === 'scale' && ivMeasure === 'nominal' && groupCount === 2) {
    recommendations.push({
      testId: 'independent-t-test',
      testName: 'Independent Samples T-Test',
      reason: 'Scale DV with 2-group nominal IV',
      confidence: 'high',
    });
    recommendations.push({
      testId: 'mann-whitney',
      testName: 'Mann-Whitney U Test',
      reason: 'Non-parametric alternative if normality violated',
      confidence: 'medium',
    });
  }

  // Scale DV + Nominal IV with 3+ groups
  if (dvMeasure === 'scale' && ivMeasure === 'nominal' && groupCount && groupCount >= 3) {
    recommendations.push({
      testId: 'one-way-anova',
      testName: 'One-Way ANOVA',
      reason: 'Scale DV with 3+ group nominal IV',
      confidence: 'high',
    });
    recommendations.push({
      testId: 'kruskal-wallis',
      testName: 'Kruskal-Wallis H Test',
      reason: 'Non-parametric alternative if normality violated',
      confidence: 'medium',
    });
  }

  // Scale + Scale
  if (dvMeasure === 'scale' && ivMeasure === 'scale') {
    recommendations.push({
      testId: 'pearson',
      testName: 'Pearson Correlation',
      reason: 'Both variables are scale',
      confidence: 'high',
    });
    recommendations.push({
      testId: 'simple-linear-regression',
      testName: 'Simple Linear Regression',
      reason: 'Prediction from scale predictor',
      confidence: 'high',
    });
  }

  // Ordinal DV
  if (dvMeasure === 'ordinal') {
    recommendations.push({
      testId: 'spearman',
      testName: 'Spearman Correlation',
      reason: 'Ordinal data requires rank-based correlation',
      confidence: 'high',
    });
    recommendations.push({
      testId: 'mann-whitney',
      testName: 'Mann-Whitney U Test',
      reason: 'Non-parametric test for ordinal DV',
      confidence: 'high',
    });
  }

  return recommendations;
}
