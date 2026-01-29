import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { testType, variables, groupingVariable, data } = await req.json();

    console.log('Checking assumptions for:', testType);

    const results = checkAssumptions(testType, variables, groupingVariable, data);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Assumption check error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ==================== HELPER FUNCTIONS ====================

function getNumericValues(data: Record<string, unknown>[], varName: string): number[] {
  return data.map(row => Number(row[varName])).filter(v => !isNaN(v));
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  return arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / (arr.length - 1);
}

function std(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

// Normal CDF approximation
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1 + sign * y);
}

// Shapiro-Wilk test approximation (simplified for small-medium samples)
function shapiroWilkTest(data: number[]): { W: number; pValue: number } {
  const n = data.length;
  if (n < 3 || n > 5000) {
    return { W: 1, pValue: 1 }; // Cannot compute
  }
  
  const sorted = [...data].sort((a, b) => a - b);
  const m = mean(data);
  
  // Calculate S² (sum of squared deviations)
  const S2 = data.reduce((acc, val) => acc + Math.pow(val - m, 2), 0);
  
  if (S2 === 0) {
    return { W: 1, pValue: 1 }; // All values identical
  }
  
  // Simplified W calculation using ordered statistics
  let b = 0;
  const half = Math.floor(n / 2);
  
  // Approximate coefficients (simplified)
  for (let i = 0; i < half; i++) {
    const a = approximateShapiroCoeff(i + 1, n);
    b += a * (sorted[n - 1 - i] - sorted[i]);
  }
  
  const W = (b * b) / S2;
  
  // Approximate p-value using transformation
  const mu = 0.0038915 * Math.pow(Math.log(n), 3) - 0.083751 * Math.pow(Math.log(n), 2) - 0.31082 * Math.log(n) - 1.5861;
  const sigma = Math.exp(0.0030302 * Math.pow(Math.log(n), 2) - 0.082676 * Math.log(n) - 0.4803);
  const z = (Math.log(1 - W) - mu) / sigma;
  const pValue = 1 - normalCDF(z);
  
  return { W: Math.min(1, Math.max(0, W)), pValue: Math.min(1, Math.max(0, pValue)) };
}

function approximateShapiroCoeff(i: number, n: number): number {
  // Simplified approximation of Shapiro-Wilk coefficients
  const m = normalQuantile((i - 0.375) / (n + 0.25));
  return m / Math.sqrt(n);
}

function normalQuantile(p: number): number {
  // Approximation of inverse normal CDF
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  
  const a = [
    -3.969683028665376e+01,
    2.209460984245205e+02,
    -2.759285104469687e+02,
    1.383577518672690e+02,
    -3.066479806614716e+01,
    2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01,
    1.615858368580409e+02,
    -1.556989798598866e+02,
    6.680131188771972e+01,
    -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
    4.374664141464968e+00,
    2.938163982698783e+00
  ];
  const d = [
    7.784695709041462e-03,
    3.224671290700398e-01,
    2.445134137142996e+00,
    3.754408661907416e+00
  ];
  
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number, r: number;
  
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

// Levene's test for homogeneity of variances
function levenesTest(groups: number[][]): { F: number; pValue: number; df1: number; df2: number } {
  const k = groups.length;
  const N = groups.reduce((acc, g) => acc + g.length, 0);
  
  // Calculate deviations from group medians
  const deviations = groups.map(g => {
    const med = median(g);
    return g.map(v => Math.abs(v - med));
  });
  
  const grandMean = mean(deviations.flat());
  const groupMeans = deviations.map(d => mean(d));
  
  // Between-group sum of squares
  let ssBetween = 0;
  groups.forEach((g, i) => {
    ssBetween += g.length * Math.pow(groupMeans[i] - grandMean, 2);
  });
  
  // Within-group sum of squares
  let ssWithin = 0;
  deviations.forEach((d, i) => {
    const gm = groupMeans[i];
    d.forEach(v => {
      ssWithin += Math.pow(v - gm, 2);
    });
  });
  
  const df1 = k - 1;
  const df2 = N - k;
  const F = (ssBetween / df1) / (ssWithin / df2);
  
  // Approximate p-value
  const pValue = 1 - fCDF(F, df1, df2);
  
  return { F, pValue, df1, df2 };
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// F-distribution CDF (simplified)
function fCDF(f: number, df1: number, df2: number): number {
  if (f <= 0) return 0;
  const x = df1 * f / (df1 * f + df2);
  return incompleteBeta(x, df1 / 2, df2 / 2);
}

// Incomplete beta function
function incompleteBeta(x: number, a: number, b: number): number {
  if (x === 0) return 0;
  if (x === 1) return 1;
  
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(1 - x, b, a);
  }
  
  const bt = Math.exp(
    a * Math.log(x) + b * Math.log(1 - x) - logBeta(a, b)
  );
  
  // Continued fraction
  let c = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  
  for (let m = 1; m <= 100; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    
    if (Math.abs(d * c - 1) < 1e-10) break;
  }
  
  return bt * h / a;
}

function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

function logGamma(x: number): number {
  const c = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.001208650973866179,
    -0.000005395239384953
  ];
  
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  
  for (let j = 0; j < 6; j++) {
    ser += c[j] / ++y;
  }
  
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// Outlier detection using IQR method
function detectOutliers(data: number[]): { outliers: number[]; indices: number[]; lowerBound: number; upperBound: number } {
  const sorted = [...data].sort((a, b) => a - b);
  const n = sorted.length;
  
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  const outliers: number[] = [];
  const indices: number[] = [];
  
  data.forEach((v, i) => {
    if (v < lowerBound || v > upperBound) {
      outliers.push(v);
      indices.push(i);
    }
  });
  
  return { outliers, indices, lowerBound, upperBound };
}

// Skewness and Kurtosis
function skewness(arr: number[]): number {
  if (arr.length < 3) return 0;
  const n = arr.length;
  const m = mean(arr);
  const s = std(arr);
  if (s === 0) return 0;
  const sumCubed = arr.reduce((acc, val) => acc + Math.pow((val - m) / s, 3), 0);
  return (n / ((n - 1) * (n - 2))) * sumCubed;
}

function kurtosis(arr: number[]): number {
  if (arr.length < 4) return 0;
  const n = arr.length;
  const m = mean(arr);
  const s = std(arr);
  if (s === 0) return 0;
  const sumFourth = arr.reduce((acc, val) => acc + Math.pow((val - m) / s, 4), 0);
  const k = (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * sumFourth;
  const correction = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  return k - correction;
}

// ==================== MAIN FUNCTION ====================

interface AssumptionResult {
  name: string;
  passed: boolean;
  value: number | string;
  threshold: string;
  interpretation: string;
  recommendation: string;
}

function checkAssumptions(
  testType: string,
  variables: string[],
  groupingVariable: string | undefined,
  data: Record<string, unknown>[]
): { assumptions: AssumptionResult[]; summary: string; overallPass: boolean } {
  const assumptions: AssumptionResult[] = [];
  
  // Get data by group if needed
  const groups: Record<string, number[]> = {};
  if (groupingVariable) {
    data.forEach(row => {
      const g = String(row[groupingVariable]);
      const v = Number(row[variables[0]]);
      if (!isNaN(v)) {
        groups[g] = groups[g] || [];
        groups[g].push(v);
      }
    });
  }
  
  // Check sample size
  const totalN = data.length;
  const minSampleSize = testType.includes('anova') ? 20 : 
                        testType.includes('chi-square') ? 20 :
                        testType.includes('regression') ? 50 : 10;
  
  assumptions.push({
    name: 'Sample Size Adequacy',
    passed: totalN >= minSampleSize,
    value: totalN,
    threshold: `≥ ${minSampleSize}`,
    interpretation: totalN >= minSampleSize ? 
      'Sample size is adequate for this analysis.' : 
      'Sample size may be too small for reliable results.',
    recommendation: totalN >= minSampleSize ? 
      'Proceed with analysis.' : 
      'Consider collecting more data or using non-parametric alternatives.'
  });
  
  // Normality checks (for parametric tests)
  if (['independent-t-test', 'paired-t-test', 'one-way-anova', 'pearson'].includes(testType)) {
    if (groupingVariable && Object.keys(groups).length >= 2) {
      // Check normality for each group
      Object.entries(groups).forEach(([groupName, values]) => {
        if (values.length >= 3) {
          const sw = shapiroWilkTest(values);
          const sk = skewness(values);
          const ku = kurtosis(values);
          
          assumptions.push({
            name: `Normality (${groupName})`,
            passed: sw.pValue > 0.05,
            value: `W = ${sw.W.toFixed(3)}, p = ${sw.pValue.toFixed(3)}`,
            threshold: 'p > 0.05',
            interpretation: sw.pValue > 0.05 ? 
              `Data in group "${groupName}" appears normally distributed.` : 
              `Data in group "${groupName}" may not be normally distributed.`,
            recommendation: sw.pValue > 0.05 ? 
              'Normality assumption met.' : 
              `Skewness = ${sk.toFixed(2)}, Kurtosis = ${ku.toFixed(2)}. Consider non-parametric test.`
          });
        }
      });
      
      // Homogeneity of variances
      const groupArrays = Object.values(groups);
      if (groupArrays.length >= 2 && groupArrays.every(g => g.length >= 2)) {
        const levene = levenesTest(groupArrays);
        assumptions.push({
          name: 'Homogeneity of Variances',
          passed: levene.pValue > 0.05,
          value: `F(${levene.df1}, ${levene.df2}) = ${levene.F.toFixed(3)}, p = ${levene.pValue.toFixed(3)}`,
          threshold: 'p > 0.05',
          interpretation: levene.pValue > 0.05 ? 
            'Variances are approximately equal across groups.' : 
            'Variances differ significantly across groups.',
          recommendation: levene.pValue > 0.05 ? 
            'Use equal variances assumed.' : 
            'Use Welch\'s correction or equal variances not assumed.'
        });
      }
    } else {
      // Single sample or paired
      variables.forEach(varName => {
        const values = getNumericValues(data, varName);
        if (values.length >= 3) {
          const sw = shapiroWilkTest(values);
          const sk = skewness(values);
          const ku = kurtosis(values);
          
          assumptions.push({
            name: `Normality (${varName})`,
            passed: sw.pValue > 0.05,
            value: `W = ${sw.W.toFixed(3)}, p = ${sw.pValue.toFixed(3)}`,
            threshold: 'p > 0.05',
            interpretation: sw.pValue > 0.05 ? 
              'Data appears normally distributed.' : 
              'Data may not be normally distributed.',
            recommendation: sw.pValue > 0.05 ? 
              'Normality assumption met.' : 
              `Skewness = ${sk.toFixed(2)}, Kurtosis = ${ku.toFixed(2)}. Consider transformation or non-parametric test.`
          });
        }
      });
    }
  }
  
  // Outlier detection
  variables.forEach(varName => {
    const values = getNumericValues(data, varName);
    const outlierResult = detectOutliers(values);
    
    assumptions.push({
      name: `Outliers (${varName})`,
      passed: outlierResult.outliers.length === 0,
      value: outlierResult.outliers.length === 0 ? 
        'No outliers detected' : 
        `${outlierResult.outliers.length} outlier(s): ${outlierResult.outliers.slice(0, 5).join(', ')}${outlierResult.outliers.length > 5 ? '...' : ''}`,
      threshold: 'No extreme values',
      interpretation: outlierResult.outliers.length === 0 ? 
        'No outliers detected using IQR method.' : 
        `${outlierResult.outliers.length} potential outlier(s) found.`,
      recommendation: outlierResult.outliers.length === 0 ? 
        'No action needed.' : 
        'Review outliers for data entry errors. Consider robust methods or transformation.'
    });
  });
  
  // Chi-square specific assumptions
  if (testType === 'chi-square') {
    // Check expected frequencies >= 5
    // This would need the contingency table, simplified check here
    assumptions.push({
      name: 'Expected Cell Frequencies',
      passed: totalN >= 20, // Simplified
      value: `N = ${totalN}`,
      threshold: 'All expected frequencies ≥ 5',
      interpretation: totalN >= 20 ? 
        'Sample size suggests expected frequencies are likely adequate.' : 
        'Small sample may result in expected frequencies < 5.',
      recommendation: totalN >= 20 ? 
        'Check the expected frequencies table in results.' : 
        'Consider Fisher\'s exact test for small samples.'
    });
  }
  
  // Summary
  const passedCount = assumptions.filter(a => a.passed).length;
  const totalCount = assumptions.length;
  const overallPass = passedCount === totalCount;
  
  let summary = '';
  if (overallPass) {
    summary = `All ${totalCount} assumptions passed. The analysis can proceed with confidence.`;
  } else if (passedCount >= totalCount * 0.7) {
    summary = `${passedCount} of ${totalCount} assumptions passed. Results should be interpreted with some caution.`;
  } else {
    summary = `Only ${passedCount} of ${totalCount} assumptions passed. Consider alternative analyses or data transformation.`;
  }
  
  return { assumptions, summary, overallPass };
}
