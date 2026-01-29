import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { testType, dependentVariables, independentVariables, groupingVariable, data } = await req.json();

    console.log('Running analysis:', testType, 'with', data.length, 'rows');

    const results = calculateStatistics(testType, dependentVariables, independentVariables, groupingVariable, data);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Analysis error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ==================== STATISTICAL HELPER FUNCTIONS ====================

function getNumericValues(data: Record<string, unknown>[], varName: string): number[] {
  return data.map(row => Number(row[varName])).filter(v => !isNaN(v));
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr: number[], population = false): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  const sumSq = arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0);
  return sumSq / (population ? arr.length : arr.length - 1);
}

function std(arr: number[], population = false): number {
  return Math.sqrt(variance(arr, population));
}

function standardError(arr: number[]): number {
  return std(arr) / Math.sqrt(arr.length);
}

function min(arr: number[]): number {
  return arr.length > 0 ? Math.min(...arr) : 0;
}

function max(arr: number[]): number {
  return arr.length > 0 ? Math.max(...arr) : 0;
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

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

// ==================== STATISTICAL DISTRIBUTIONS ====================

// Gamma function approximation (Lanczos)
function gamma(z: number): number {
  if (z < 0.5) {
    return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  }
  z -= 1;
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

// Beta function
function beta(a: number, b: number): number {
  return (gamma(a) * gamma(b)) / gamma(a + b);
}

// Incomplete beta function (regularized) using continued fraction
function incompleteBeta(x: number, a: number, b: number): number {
  if (x === 0) return 0;
  if (x === 1) return 1;
  
  // Use symmetry for better convergence
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(1 - x, b, a);
  }
  
  const bt = Math.exp(
    a * Math.log(x) + b * Math.log(1 - x) - Math.log(beta(a, b))
  );
  
  // Continued fraction
  const maxIter = 200;
  const eps = 1e-10;
  let c = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    
    // Even step
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    
    // Odd step
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    
    if (Math.abs(del - 1) < eps) break;
  }
  
  return bt * h / a;
}

// T-distribution CDF
function tCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  const p = 0.5 * incompleteBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - p : p;
}

// Two-tailed p-value for t-distribution
function tTestPValue(t: number, df: number): number {
  return 2 * (1 - tCDF(Math.abs(t), df));
}

// F-distribution CDF
function fCDF(f: number, df1: number, df2: number): number {
  if (f <= 0) return 0;
  const x = df1 * f / (df1 * f + df2);
  return incompleteBeta(x, df1 / 2, df2 / 2);
}

// P-value for F-distribution (right-tailed)
function fTestPValue(f: number, df1: number, df2: number): number {
  return 1 - fCDF(f, df1, df2);
}

// Chi-square CDF using incomplete gamma
function chiSquareCDF(x: number, df: number): number {
  if (x <= 0) return 0;
  return incompleteGamma(df / 2, x / 2) / gamma(df / 2);
}

// Lower incomplete gamma function
function incompleteGamma(a: number, x: number): number {
  if (x < 0) return 0;
  if (x === 0) return 0;
  
  // Series expansion for small x
  if (x < a + 1) {
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-10 * Math.abs(sum)) break;
    }
    return Math.exp(-x + a * Math.log(x)) * sum;
  }
  
  // Continued fraction for large x
  return gamma(a) - incompleteGammaUpper(a, x);
}

// Upper incomplete gamma function
function incompleteGammaUpper(a: number, x: number): number {
  let f = 1e-30;
  let c = 1e-30;
  let d = 1 / (x + 1 - a);
  let h = d;
  
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    const bn = x + 2 * i + 1 - a;
    d = bn + an * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = bn + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-10) break;
  }
  
  return Math.exp(-x + a * Math.log(x)) * h;
}

// Chi-square p-value (right-tailed)
function chiSquarePValue(x: number, df: number): number {
  return 1 - chiSquareCDF(x, df);
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

// Two-tailed p-value for z-score
function zTestPValue(z: number): number {
  return 2 * (1 - normalCDF(Math.abs(z)));
}

// ==================== EFFECT SIZE CALCULATIONS ====================

function cohensD(group1: number[], group2: number[]): number {
  const m1 = mean(group1);
  const m2 = mean(group2);
  const n1 = group1.length;
  const n2 = group2.length;
  const s1 = variance(group1);
  const s2 = variance(group2);
  
  // Pooled standard deviation
  const pooledSD = Math.sqrt(((n1 - 1) * s1 + (n2 - 1) * s2) / (n1 + n2 - 2));
  
  return pooledSD === 0 ? 0 : (m1 - m2) / pooledSD;
}

function cohensDPaired(diff: number[]): number {
  const m = mean(diff);
  const s = std(diff);
  return s === 0 ? 0 : m / s;
}

function etaSquared(ssEffect: number, ssTotal: number): number {
  return ssTotal === 0 ? 0 : ssEffect / ssTotal;
}

function omegaSquared(ssEffect: number, ssError: number, msError: number, dfEffect: number, n: number): number {
  const numerator = ssEffect - dfEffect * msError;
  const denominator = ssEffect + ssError + msError;
  return denominator === 0 ? 0 : numerator / denominator;
}

function interpretCohensD(d: number): string {
  const absD = Math.abs(d);
  if (absD < 0.2) return 'negligible';
  if (absD < 0.5) return 'small';
  if (absD < 0.8) return 'medium';
  return 'large';
}

function interpretEtaSquared(eta2: number): string {
  if (eta2 < 0.01) return 'negligible';
  if (eta2 < 0.06) return 'small';
  if (eta2 < 0.14) return 'medium';
  return 'large';
}

// ==================== CONFIDENCE INTERVALS ====================

function confidenceInterval(m: number, se: number, df: number, confidence = 0.95): [number, number] {
  // Use t-critical value approximation
  const alpha = 1 - confidence;
  // Approximate t-critical value for common confidence levels
  let tCrit: number;
  if (df >= 120) {
    tCrit = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.645;
  } else if (df >= 30) {
    tCrit = confidence === 0.95 ? 2.042 : confidence === 0.99 ? 2.750 : 1.697;
  } else if (df >= 10) {
    tCrit = confidence === 0.95 ? 2.228 : confidence === 0.99 ? 3.169 : 1.812;
  } else {
    tCrit = confidence === 0.95 ? 2.571 : confidence === 0.99 ? 4.032 : 2.015;
  }
  
  return [m - tCrit * se, m + tCrit * se];
}

// ==================== RANKING FUNCTIONS ====================

function rank(arr: number[]): number[] {
  const sorted = arr.map((v, i) => ({ value: v, index: i })).sort((a, b) => a.value - b.value);
  const ranks = new Array(arr.length);
  
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    // Find ties
    while (j < sorted.length && sorted[j].value === sorted[i].value) {
      j++;
    }
    // Average rank for ties
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[sorted[k].index] = avgRank;
    }
    i = j;
  }
  
  return ranks;
}

// ==================== MAIN CALCULATION FUNCTION ====================

function calculateStatistics(
  testType: string,
  depVars: string[],
  indVars: string[],
  groupVar: string | undefined,
  data: Record<string, unknown>[]
) {
  const tables: Array<{ title: string; headers: string[]; rows: Array<Record<string, string | number>> }> = [];
  const charts: Array<{ type: string; data: unknown; title: string }> = [];

  switch (testType) {
    case 'descriptives': {
      const rows = depVars.map(varName => {
        const values = getNumericValues(data, varName);
        const n = values.length;
        const m = mean(values);
        const se = standardError(values);
        const [ciLower, ciUpper] = confidenceInterval(m, se, n - 1);
        
        return {
          Variable: varName,
          N: n,
          Mean: m,
          'Std. Error': se,
          'Std. Deviation': std(values),
          Variance: variance(values),
          Minimum: min(values),
          Maximum: max(values),
          Range: max(values) - min(values),
          Skewness: skewness(values),
          Kurtosis: kurtosis(values),
          '95% CI Lower': ciLower,
          '95% CI Upper': ciUpper,
        };
      });
      
      tables.push({
        title: 'Descriptive Statistics',
        headers: ['Variable', 'N', 'Mean', 'Std. Error', 'Std. Deviation', 'Variance', 'Minimum', 'Maximum', 'Range', 'Skewness', 'Kurtosis', '95% CI Lower', '95% CI Upper'],
        rows,
      });
      break;
    }

    case 'frequencies': {
      depVars.forEach(varName => {
        const freq: Record<string, number> = {};
        let validCount = 0;
        
        data.forEach(row => {
          const val = row[varName];
          if (val !== null && val !== undefined && val !== '') {
            const key = String(val);
            freq[key] = (freq[key] || 0) + 1;
            validCount++;
          } else {
            freq['Missing'] = (freq['Missing'] || 0) + 1;
          }
        });
        
        const total = data.length;
        let cumPercent = 0;
        
        const rows = Object.entries(freq)
          .sort((a, b) => {
            if (a[0] === 'Missing') return 1;
            if (b[0] === 'Missing') return -1;
            return a[0].localeCompare(b[0], undefined, { numeric: true });
          })
          .map(([value, count]) => {
            const percent = (count / total) * 100;
            const validPercent = value === 'Missing' ? 0 : (count / validCount) * 100;
            cumPercent += value === 'Missing' ? 0 : validPercent;
            
            return {
              Value: value,
              Frequency: count,
              Percent: percent,
              'Valid Percent': validPercent,
              'Cumulative Percent': cumPercent,
            };
          });
        
        tables.push({
          title: `Frequencies: ${varName}`,
          headers: ['Value', 'Frequency', 'Percent', 'Valid Percent', 'Cumulative Percent'],
          rows,
        });
        
        // Add statistics summary
        const numericValues = getNumericValues(data, varName);
        if (numericValues.length > 0) {
          tables.push({
            title: `Statistics: ${varName}`,
            headers: ['Statistic', 'Value'],
            rows: [
              { Statistic: 'N Valid', Value: numericValues.length },
              { Statistic: 'N Missing', Value: data.length - numericValues.length },
              { Statistic: 'Mean', Value: mean(numericValues) },
              { Statistic: 'Median', Value: median(numericValues) },
              { Statistic: 'Mode', Value: findMode(numericValues) },
              { Statistic: 'Std. Deviation', Value: std(numericValues) },
              { Statistic: 'Variance', Value: variance(numericValues) },
              { Statistic: 'Range', Value: max(numericValues) - min(numericValues) },
              { Statistic: 'Minimum', Value: min(numericValues) },
              { Statistic: 'Maximum', Value: max(numericValues) },
            ],
          });
        }
        
        charts.push({
          type: 'bar',
          title: `${varName} Distribution`,
          data: Object.entries(freq)
            .filter(([k]) => k !== 'Missing')
            .map(([name, value]) => ({ name, value })),
        });
      });
      break;
    }

    case 'independent-t-test': {
      if (depVars[0] && groupVar) {
        const groups: Record<string, number[]> = {};
        data.forEach(row => {
          const g = String(row[groupVar]);
          const v = Number(row[depVars[0]]);
          if (!isNaN(v)) {
            groups[g] = groups[g] || [];
            groups[g].push(v);
          }
        });
        
        const groupNames = Object.keys(groups);
        if (groupNames.length >= 2) {
          const g1 = groups[groupNames[0]];
          const g2 = groups[groupNames[1]];
          const n1 = g1.length, n2 = g2.length;
          const m1 = mean(g1), m2 = mean(g2);
          const s1 = std(g1), s2 = std(g2);
          const v1 = variance(g1), v2 = variance(g2);
          const se1 = standardError(g1), se2 = standardError(g2);
          
          // Pooled variance t-test
          const pooledVar = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
          const pooledSE = Math.sqrt(pooledVar * (1/n1 + 1/n2));
          const t = (m1 - m2) / pooledSE;
          const df = n1 + n2 - 2;
          const pValue = tTestPValue(t, df);
          
          // Welch's t-test (unequal variances)
          const welchSE = Math.sqrt(v1/n1 + v2/n2);
          const tWelch = (m1 - m2) / welchSE;
          const dfWelch = Math.pow(v1/n1 + v2/n2, 2) / 
            (Math.pow(v1/n1, 2)/(n1-1) + Math.pow(v2/n2, 2)/(n2-1));
          const pValueWelch = tTestPValue(tWelch, dfWelch);
          
          // Effect size
          const d = cohensD(g1, g2);
          const dInterpretation = interpretCohensD(d);
          
          // Levene's test for equality of variances (simplified)
          const allValues = [...g1, ...g2];
          const groupMeans = [m1, m2];
          const deviations1 = g1.map(v => Math.abs(v - m1));
          const deviations2 = g2.map(v => Math.abs(v - m2));
          const grandMeanDev = mean([...deviations1, ...deviations2]);
          const ssGroup = n1 * Math.pow(mean(deviations1) - grandMeanDev, 2) + 
                          n2 * Math.pow(mean(deviations2) - grandMeanDev, 2);
          const ssError = sum(deviations1.map(d => Math.pow(d - mean(deviations1), 2))) +
                          sum(deviations2.map(d => Math.pow(d - mean(deviations2), 2)));
          const fLevene = (ssGroup / 1) / (ssError / (n1 + n2 - 2));
          const pLevene = fTestPValue(fLevene, 1, n1 + n2 - 2);
          
          // Confidence interval for mean difference
          const meanDiff = m1 - m2;
          const [ciLower, ciUpper] = confidenceInterval(meanDiff, pooledSE, df);
          
          tables.push({
            title: 'Group Statistics',
            headers: ['Group', 'N', 'Mean', 'Std. Deviation', 'Std. Error Mean'],
            rows: [
              { Group: groupNames[0], N: n1, Mean: m1, 'Std. Deviation': s1, 'Std. Error Mean': se1 },
              { Group: groupNames[1], N: n2, Mean: m2, 'Std. Deviation': s2, 'Std. Error Mean': se2 },
            ],
          });
          
          tables.push({
            title: "Levene's Test for Equality of Variances",
            headers: ['F', 'Sig.'],
            rows: [{ F: fLevene, 'Sig.': pLevene }],
          });
          
          tables.push({
            title: 'Independent Samples Test',
            headers: ['', 't', 'df', 'Sig. (2-tailed)', 'Mean Difference', 'Std. Error Difference', '95% CI Lower', '95% CI Upper'],
            rows: [
              { 
                '': 'Equal variances assumed',
                t: t, 
                df: df, 
                'Sig. (2-tailed)': pValue, 
                'Mean Difference': meanDiff,
                'Std. Error Difference': pooledSE,
                '95% CI Lower': ciLower,
                '95% CI Upper': ciUpper,
              },
              { 
                '': 'Equal variances not assumed',
                t: tWelch, 
                df: dfWelch, 
                'Sig. (2-tailed)': pValueWelch, 
                'Mean Difference': meanDiff,
                'Std. Error Difference': welchSE,
                '95% CI Lower': meanDiff - 1.96 * welchSE,
                '95% CI Upper': meanDiff + 1.96 * welchSE,
              },
            ],
          });
          
          tables.push({
            title: 'Effect Size',
            headers: ['Statistic', 'Value', 'Interpretation'],
            rows: [
              { Statistic: "Cohen's d", Value: d, Interpretation: dInterpretation },
            ],
          });
          
          // Add box plot data
          charts.push({
            type: 'bar',
            title: 'Group Means Comparison',
            data: [
              { name: groupNames[0], value: m1, error: se1 },
              { name: groupNames[1], value: m2, error: se2 },
            ],
          });
        }
      }
      break;
    }

    case 'paired-t-test': {
      if (depVars.length >= 2) {
        const var1 = depVars[0];
        const var2 = depVars[1];
        
        // Get paired values
        const pairs: Array<{ v1: number; v2: number; diff: number }> = [];
        data.forEach(row => {
          const v1 = Number(row[var1]);
          const v2 = Number(row[var2]);
          if (!isNaN(v1) && !isNaN(v2)) {
            pairs.push({ v1, v2, diff: v1 - v2 });
          }
        });
        
        if (pairs.length > 1) {
          const values1 = pairs.map(p => p.v1);
          const values2 = pairs.map(p => p.v2);
          const diffs = pairs.map(p => p.diff);
          
          const n = pairs.length;
          const m1 = mean(values1), m2 = mean(values2);
          const s1 = std(values1), s2 = std(values2);
          const se1 = standardError(values1), se2 = standardError(values2);
          
          const diffMean = mean(diffs);
          const diffSD = std(diffs);
          const diffSE = standardError(diffs);
          
          const t = diffMean / diffSE;
          const df = n - 1;
          const pValue = tTestPValue(t, df);
          
          // Effect size
          const d = cohensDPaired(diffs);
          const dInterpretation = interpretCohensD(d);
          
          // Correlation between pairs
          const r = pearsonCorrelation(values1, values2);
          
          // Confidence interval
          const [ciLower, ciUpper] = confidenceInterval(diffMean, diffSE, df);
          
          tables.push({
            title: 'Paired Samples Statistics',
            headers: ['', 'Mean', 'N', 'Std. Deviation', 'Std. Error Mean'],
            rows: [
              { '': var1, Mean: m1, N: n, 'Std. Deviation': s1, 'Std. Error Mean': se1 },
              { '': var2, Mean: m2, N: n, 'Std. Deviation': s2, 'Std. Error Mean': se2 },
            ],
          });
          
          tables.push({
            title: 'Paired Samples Correlations',
            headers: ['Pair', 'N', 'Correlation', 'Sig.'],
            rows: [
              { Pair: `${var1} & ${var2}`, N: n, Correlation: r, Sig: r === 0 ? 1 : zTestPValue(fisherZ(r) * Math.sqrt(n - 3)) },
            ],
          });
          
          tables.push({
            title: 'Paired Samples Test',
            headers: ['Pair', 'Mean Diff', 'Std. Deviation', 'Std. Error Mean', '95% CI Lower', '95% CI Upper', 't', 'df', 'Sig. (2-tailed)'],
            rows: [
              { 
                Pair: `${var1} - ${var2}`,
                'Mean Diff': diffMean,
                'Std. Deviation': diffSD,
                'Std. Error Mean': diffSE,
                '95% CI Lower': ciLower,
                '95% CI Upper': ciUpper,
                t: t,
                df: df,
                'Sig. (2-tailed)': pValue,
              },
            ],
          });
          
          tables.push({
            title: 'Effect Size',
            headers: ['Statistic', 'Value', 'Interpretation'],
            rows: [
              { Statistic: "Cohen's d", Value: d, Interpretation: dInterpretation },
            ],
          });
        }
      }
      break;
    }

    case 'one-way-anova': {
      if (depVars[0] && groupVar) {
        const groups: Record<string, number[]> = {};
        data.forEach(row => {
          const g = String(row[groupVar]);
          const v = Number(row[depVars[0]]);
          if (!isNaN(v) && g) {
            groups[g] = groups[g] || [];
            groups[g].push(v);
          }
        });
        
        const groupNames = Object.keys(groups);
        const k = groupNames.length; // Number of groups
        
        if (k >= 2) {
          // Calculate ANOVA
          const allValues = Object.values(groups).flat();
          const grandMean = mean(allValues);
          const N = allValues.length;
          
          // Between-group sum of squares
          let ssBetween = 0;
          groupNames.forEach(g => {
            const groupMean = mean(groups[g]);
            const n = groups[g].length;
            ssBetween += n * Math.pow(groupMean - grandMean, 2);
          });
          
          // Within-group sum of squares
          let ssWithin = 0;
          groupNames.forEach(g => {
            const groupMean = mean(groups[g]);
            groups[g].forEach(v => {
              ssWithin += Math.pow(v - groupMean, 2);
            });
          });
          
          const ssTotal = ssBetween + ssWithin;
          const dfBetween = k - 1;
          const dfWithin = N - k;
          const dfTotal = N - 1;
          
          const msBetween = ssBetween / dfBetween;
          const msWithin = ssWithin / dfWithin;
          
          const F = msBetween / msWithin;
          const pValue = fTestPValue(F, dfBetween, dfWithin);
          
          // Effect sizes
          const eta2 = etaSquared(ssBetween, ssTotal);
          const omega2 = omegaSquared(ssBetween, ssWithin, msWithin, dfBetween, N);
          const eta2Interpretation = interpretEtaSquared(eta2);
          
          // Descriptive statistics by group
          tables.push({
            title: 'Descriptives',
            headers: ['Group', 'N', 'Mean', 'Std. Deviation', 'Std. Error', '95% CI Lower', '95% CI Upper', 'Minimum', 'Maximum'],
            rows: groupNames.map(g => {
              const values = groups[g];
              const m = mean(values);
              const se = standardError(values);
              const [ciL, ciU] = confidenceInterval(m, se, values.length - 1);
              return {
                Group: g,
                N: values.length,
                Mean: m,
                'Std. Deviation': std(values),
                'Std. Error': se,
                '95% CI Lower': ciL,
                '95% CI Upper': ciU,
                Minimum: min(values),
                Maximum: max(values),
              };
            }),
          });
          
          // Levene's test
          const deviationsByGroup = groupNames.map(g => {
            const groupMean = mean(groups[g]);
            return groups[g].map(v => Math.abs(v - groupMean));
          });
          const grandMeanDev = mean(deviationsByGroup.flat());
          let ssGroupLevene = 0;
          let ssErrorLevene = 0;
          groupNames.forEach((g, i) => {
            const devMean = mean(deviationsByGroup[i]);
            ssGroupLevene += groups[g].length * Math.pow(devMean - grandMeanDev, 2);
            ssErrorLevene += sum(deviationsByGroup[i].map(d => Math.pow(d - devMean, 2)));
          });
          const fLevene = (ssGroupLevene / (k - 1)) / (ssErrorLevene / (N - k));
          const pLevene = fTestPValue(fLevene, k - 1, N - k);
          
          tables.push({
            title: 'Test of Homogeneity of Variances',
            headers: ['Levene Statistic', 'df1', 'df2', 'Sig.'],
            rows: [{ 'Levene Statistic': fLevene, df1: k - 1, df2: N - k, 'Sig.': pLevene }],
          });
          
          // ANOVA table
          tables.push({
            title: 'ANOVA',
            headers: ['Source', 'Sum of Squares', 'df', 'Mean Square', 'F', 'Sig.'],
            rows: [
              { Source: 'Between Groups', 'Sum of Squares': ssBetween, df: dfBetween, 'Mean Square': msBetween, F: F, 'Sig.': pValue },
              { Source: 'Within Groups', 'Sum of Squares': ssWithin, df: dfWithin, 'Mean Square': msWithin, F: '-', 'Sig.': '-' },
              { Source: 'Total', 'Sum of Squares': ssTotal, df: dfTotal, 'Mean Square': '-', F: '-', 'Sig.': '-' },
            ],
          });
          
          tables.push({
            title: 'Effect Sizes',
            headers: ['Statistic', 'Value', 'Interpretation'],
            rows: [
              { Statistic: 'Eta Squared (η²)', Value: eta2, Interpretation: eta2Interpretation },
              { Statistic: 'Omega Squared (ω²)', Value: omega2, Interpretation: interpretEtaSquared(omega2) },
            ],
          });
          
          // Post-hoc tests (Tukey HSD approximation)
          if (pValue < 0.05 && k > 2) {
            const postHocRows: Array<Record<string, string | number>> = [];
            for (let i = 0; i < groupNames.length; i++) {
              for (let j = i + 1; j < groupNames.length; j++) {
                const g1 = groups[groupNames[i]];
                const g2 = groups[groupNames[j]];
                const meanDiff = mean(g1) - mean(g2);
                const se = Math.sqrt(msWithin * (1/g1.length + 1/g2.length));
                const q = Math.abs(meanDiff) / se;
                // Approximate p-value using studentized range distribution
                const pPostHoc = Math.min(1, 2 * (1 - normalCDF(q / Math.sqrt(2))));
                
                postHocRows.push({
                  '(I) Group': groupNames[i],
                  '(J) Group': groupNames[j],
                  'Mean Difference (I-J)': meanDiff,
                  'Std. Error': se,
                  'Sig.': pPostHoc,
                  Significant: pPostHoc < 0.05 ? 'Yes' : 'No',
                });
              }
            }
            
            tables.push({
              title: 'Post Hoc Tests - Multiple Comparisons',
              headers: ['(I) Group', '(J) Group', 'Mean Difference (I-J)', 'Std. Error', 'Sig.', 'Significant'],
              rows: postHocRows,
            });
          }
          
          charts.push({
            type: 'bar',
            title: 'Group Means',
            data: groupNames.map(g => ({ 
              name: g, 
              value: mean(groups[g]),
              error: standardError(groups[g]),
            })),
          });
        }
      }
      break;
    }

    case 'pearson': {
      if (depVars.length >= 2) {
        const correlations: Array<Record<string, string | number>> = [];
        
        // Correlation matrix
        const matrix: Record<string, Record<string, number>> = {};
        const pMatrix: Record<string, Record<string, number>> = {};
        
        for (let i = 0; i < depVars.length; i++) {
          matrix[depVars[i]] = {};
          pMatrix[depVars[i]] = {};
          
          for (let j = 0; j < depVars.length; j++) {
            const x = getNumericValues(data, depVars[i]);
            const y = getNumericValues(data, depVars[j]);
            const n = Math.min(x.length, y.length);
            
            if (i === j) {
              matrix[depVars[i]][depVars[j]] = 1;
              pMatrix[depVars[i]][depVars[j]] = 0;
            } else {
              const r = pearsonCorrelation(x.slice(0, n), y.slice(0, n));
              const t = r * Math.sqrt((n - 2) / (1 - r * r));
              const pValue = tTestPValue(t, n - 2);
              
              matrix[depVars[i]][depVars[j]] = r;
              pMatrix[depVars[i]][depVars[j]] = pValue;
              
              if (j > i) {
                correlations.push({
                  'Variable 1': depVars[i],
                  'Variable 2': depVars[j],
                  'Pearson r': r,
                  'Sig. (2-tailed)': pValue,
                  N: n,
                  Interpretation: interpretCorrelation(r),
                });
              }
            }
          }
        }
        
        tables.push({
          title: 'Correlations',
          headers: ['Variable 1', 'Variable 2', 'Pearson r', 'Sig. (2-tailed)', 'N', 'Interpretation'],
          rows: correlations,
        });
        
        // Scatter plot for first two variables
        if (depVars.length >= 2) {
          const x = getNumericValues(data, depVars[0]);
          const y = getNumericValues(data, depVars[1]);
          const scatterData = [];
          for (let i = 0; i < Math.min(x.length, y.length, 100); i++) {
            scatterData.push({ x: x[i], y: y[i] });
          }
          charts.push({
            type: 'scatter',
            title: `Scatter Plot: ${depVars[0]} vs ${depVars[1]}`,
            data: scatterData,
          });
        }
      }
      break;
    }

    case 'spearman': {
      if (depVars.length >= 2) {
        const correlations: Array<Record<string, string | number>> = [];
        
        for (let i = 0; i < depVars.length; i++) {
          for (let j = i + 1; j < depVars.length; j++) {
            const x = getNumericValues(data, depVars[i]);
            const y = getNumericValues(data, depVars[j]);
            const n = Math.min(x.length, y.length);
            
            const xRanks = rank(x.slice(0, n));
            const yRanks = rank(y.slice(0, n));
            
            const rho = pearsonCorrelation(xRanks, yRanks);
            const t = rho * Math.sqrt((n - 2) / (1 - rho * rho));
            const pValue = tTestPValue(t, n - 2);
            
            correlations.push({
              'Variable 1': depVars[i],
              'Variable 2': depVars[j],
              "Spearman's rho": rho,
              'Sig. (2-tailed)': pValue,
              N: n,
              Interpretation: interpretCorrelation(rho),
            });
          }
        }
        
        tables.push({
          title: 'Nonparametric Correlations - Spearman',
          headers: ['Variable 1', 'Variable 2', "Spearman's rho", 'Sig. (2-tailed)', 'N', 'Interpretation'],
          rows: correlations,
        });
      }
      break;
    }

    case 'chi-square': {
      if (depVars.length >= 2 || (depVars.length >= 1 && groupVar)) {
        const var1 = depVars[0];
        const var2 = groupVar || depVars[1];
        
        // Create contingency table
        const contingency: Record<string, Record<string, number>> = {};
        const rowTotals: Record<string, number> = {};
        const colTotals: Record<string, number> = {};
        let grandTotal = 0;
        
        data.forEach(row => {
          const v1 = String(row[var1] ?? 'Missing');
          const v2 = String(row[var2] ?? 'Missing');
          
          if (v1 !== 'Missing' && v2 !== 'Missing') {
            contingency[v1] = contingency[v1] || {};
            contingency[v1][v2] = (contingency[v1][v2] || 0) + 1;
            rowTotals[v1] = (rowTotals[v1] || 0) + 1;
            colTotals[v2] = (colTotals[v2] || 0) + 1;
            grandTotal++;
          }
        });
        
        const rowLabels = Object.keys(contingency);
        const colLabels = Object.keys(colTotals);
        
        if (rowLabels.length >= 2 && colLabels.length >= 2) {
          // Calculate expected frequencies and chi-square
          let chiSquare = 0;
          const expectedFreq: Record<string, Record<string, number>> = {};
          
          rowLabels.forEach(row => {
            expectedFreq[row] = {};
            colLabels.forEach(col => {
              const observed = contingency[row][col] || 0;
              const expected = (rowTotals[row] * colTotals[col]) / grandTotal;
              expectedFreq[row][col] = expected;
              if (expected > 0) {
                chiSquare += Math.pow(observed - expected, 2) / expected;
              }
            });
          });
          
          const df = (rowLabels.length - 1) * (colLabels.length - 1);
          const pValue = chiSquarePValue(chiSquare, df);
          
          // Effect sizes
          const phi = Math.sqrt(chiSquare / grandTotal);
          const cramerV = Math.sqrt(chiSquare / (grandTotal * (Math.min(rowLabels.length, colLabels.length) - 1)));
          
          // Crosstabulation
          const crosstabRows: Array<Record<string, string | number>> = [];
          rowLabels.forEach(row => {
            const rowData: Record<string, string | number> = { [var1]: row };
            colLabels.forEach(col => {
              rowData[col] = contingency[row][col] || 0;
            });
            rowData['Row Total'] = rowTotals[row];
            crosstabRows.push(rowData);
          });
          
          // Add column totals row
          const totalsRow: Record<string, string | number> = { [var1]: 'Column Total' };
          colLabels.forEach(col => {
            totalsRow[col] = colTotals[col];
          });
          totalsRow['Row Total'] = grandTotal;
          crosstabRows.push(totalsRow);
          
          tables.push({
            title: `Crosstabulation: ${var1} × ${var2}`,
            headers: [var1, ...colLabels, 'Row Total'],
            rows: crosstabRows,
          });
          
          tables.push({
            title: 'Chi-Square Tests',
            headers: ['Test', 'Value', 'df', 'Asymptotic Sig. (2-sided)'],
            rows: [
              { Test: 'Pearson Chi-Square', Value: chiSquare, df: df, 'Asymptotic Sig. (2-sided)': pValue },
              { Test: 'Likelihood Ratio', Value: calculateLikelihoodRatio(contingency, expectedFreq, rowLabels, colLabels), df: df, 'Asymptotic Sig. (2-sided)': '-' },
              { Test: 'N of Valid Cases', Value: grandTotal, df: '-', 'Asymptotic Sig. (2-sided)': '-' },
            ],
          });
          
          tables.push({
            title: 'Symmetric Measures',
            headers: ['Measure', 'Value', 'Interpretation'],
            rows: [
              { Measure: 'Phi', Value: phi, Interpretation: interpretCorrelation(phi) },
              { Measure: "Cramér's V", Value: cramerV, Interpretation: interpretCramersV(cramerV, Math.min(rowLabels.length, colLabels.length)) },
            ],
          });
          
          charts.push({
            type: 'bar',
            title: `Distribution by ${var2}`,
            data: colLabels.map(col => ({ name: col, value: colTotals[col] })),
          });
        }
      }
      break;
    }

    case 'mann-whitney': {
      if (depVars[0] && groupVar) {
        const groups: Record<string, number[]> = {};
        data.forEach(row => {
          const g = String(row[groupVar]);
          const v = Number(row[depVars[0]]);
          if (!isNaN(v)) {
            groups[g] = groups[g] || [];
            groups[g].push(v);
          }
        });
        
        const groupNames = Object.keys(groups);
        if (groupNames.length >= 2) {
          const g1 = groups[groupNames[0]];
          const g2 = groups[groupNames[1]];
          const n1 = g1.length, n2 = g2.length;
          
          // Rank all values
          const allValues = [...g1.map(v => ({ value: v, group: 0 })), ...g2.map(v => ({ value: v, group: 1 }))];
          allValues.sort((a, b) => a.value - b.value);
          
          // Assign ranks with ties
          const ranks = new Array(allValues.length);
          let i = 0;
          while (i < allValues.length) {
            let j = i;
            while (j < allValues.length && allValues[j].value === allValues[i].value) {
              j++;
            }
            const avgRank = (i + 1 + j) / 2;
            for (let k = i; k < j; k++) {
              ranks[k] = avgRank;
            }
            i = j;
          }
          
          // Sum of ranks for group 1
          let R1 = 0;
          for (let k = 0; k < allValues.length; k++) {
            if (allValues[k].group === 0) {
              R1 += ranks[k];
            }
          }
          
          const U1 = R1 - (n1 * (n1 + 1)) / 2;
          const U2 = n1 * n2 - U1;
          const U = Math.min(U1, U2);
          
          // Normal approximation
          const meanU = (n1 * n2) / 2;
          const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
          const z = (U - meanU) / stdU;
          const pValue = zTestPValue(z);
          
          // Effect size (r = z / sqrt(N))
          const r = Math.abs(z) / Math.sqrt(n1 + n2);
          
          tables.push({
            title: 'Ranks',
            headers: ['Group', 'N', 'Mean Rank', 'Sum of Ranks'],
            rows: [
              { Group: groupNames[0], N: n1, 'Mean Rank': R1 / n1, 'Sum of Ranks': R1 },
              { Group: groupNames[1], N: n2, 'Mean Rank': (n1 * n2 + (n1 + n2 + 1) * n2 / 2 - R1) / n2, 'Sum of Ranks': n1 * n2 + (n1 + n2 + 1) * n2 / 2 - R1 },
            ],
          });
          
          tables.push({
            title: 'Test Statistics',
            headers: ['Statistic', 'Value'],
            rows: [
              { Statistic: 'Mann-Whitney U', Value: U },
              { Statistic: 'Wilcoxon W', Value: R1 },
              { Statistic: 'Z', Value: z },
              { Statistic: 'Asymp. Sig. (2-tailed)', Value: pValue },
              { Statistic: 'Effect Size (r)', Value: r },
              { Statistic: 'Effect Interpretation', Value: interpretCorrelation(r) },
            ],
          });
        }
      }
      break;
    }

    case 'wilcoxon': {
      if (depVars.length >= 2) {
        const var1 = depVars[0];
        const var2 = depVars[1];
        
        // Get paired values
        const pairs: Array<{ v1: number; v2: number; diff: number; absDiff: number }> = [];
        data.forEach(row => {
          const v1 = Number(row[var1]);
          const v2 = Number(row[var2]);
          if (!isNaN(v1) && !isNaN(v2) && v1 !== v2) {
            const diff = v1 - v2;
            pairs.push({ v1, v2, diff, absDiff: Math.abs(diff) });
          }
        });
        
        if (pairs.length > 0) {
          // Rank absolute differences
          pairs.sort((a, b) => a.absDiff - b.absDiff);
          const ranks = new Array(pairs.length);
          let i = 0;
          while (i < pairs.length) {
            let j = i;
            while (j < pairs.length && pairs[j].absDiff === pairs[i].absDiff) {
              j++;
            }
            const avgRank = (i + 1 + j) / 2;
            for (let k = i; k < j; k++) {
              ranks[k] = avgRank;
            }
            i = j;
          }
          
          // Sum of positive and negative ranks
          let Tplus = 0, Tminus = 0;
          let nPlus = 0, nMinus = 0;
          for (let k = 0; k < pairs.length; k++) {
            if (pairs[k].diff > 0) {
              Tplus += ranks[k];
              nPlus++;
            } else {
              Tminus += ranks[k];
              nMinus++;
            }
          }
          
          const T = Math.min(Tplus, Tminus);
          const n = pairs.length;
          
          // Normal approximation
          const meanT = n * (n + 1) / 4;
          const stdT = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24);
          const z = (T - meanT) / stdT;
          const pValue = zTestPValue(z);
          
          // Effect size
          const r = Math.abs(z) / Math.sqrt(n);
          
          tables.push({
            title: 'Wilcoxon Signed Ranks Test',
            headers: ['', 'N', 'Mean Rank', 'Sum of Ranks'],
            rows: [
              { '': 'Negative Ranks', N: nMinus, 'Mean Rank': nMinus > 0 ? Tminus / nMinus : 0, 'Sum of Ranks': Tminus },
              { '': 'Positive Ranks', N: nPlus, 'Mean Rank': nPlus > 0 ? Tplus / nPlus : 0, 'Sum of Ranks': Tplus },
              { '': 'Ties', N: data.length - pairs.length, 'Mean Rank': '-', 'Sum of Ranks': '-' },
              { '': 'Total', N: data.length, 'Mean Rank': '-', 'Sum of Ranks': '-' },
            ],
          });
          
          tables.push({
            title: 'Test Statistics',
            headers: ['Statistic', 'Value'],
            rows: [
              { Statistic: 'Z', Value: z },
              { Statistic: 'Asymp. Sig. (2-tailed)', Value: pValue },
              { Statistic: 'Effect Size (r)', Value: r },
              { Statistic: 'Effect Interpretation', Value: interpretCorrelation(r) },
            ],
          });
        }
      }
      break;
    }

    case 'cronbach-alpha': {
      if (depVars.length >= 2) {
        const n = depVars.length; // Number of items
        const itemData = depVars.map(v => getNumericValues(data, v));
        
        // Find valid cases (rows with all items present)
        const validCases: number[][] = [];
        for (let i = 0; i < data.length; i++) {
          const row = depVars.map(v => Number(data[i][v]));
          if (row.every(v => !isNaN(v))) {
            validCases.push(row);
          }
        }
        
        if (validCases.length > 1) {
          // Calculate item statistics
          const itemStats = depVars.map((v, idx) => {
            const values = validCases.map(row => row[idx]);
            return {
              name: v,
              mean: mean(values),
              std: std(values),
              variance: variance(values),
            };
          });
          
          // Calculate total score for each case
          const totals = validCases.map(row => sum(row));
          const totalVariance = variance(totals);
          
          // Sum of item variances
          const sumItemVariances = sum(itemStats.map(s => s.variance));
          
          // Cronbach's Alpha
          const alpha = (n / (n - 1)) * (1 - sumItemVariances / totalVariance);
          
          // Item-total correlations and alpha if item deleted
          const itemAnalysis = depVars.map((v, idx) => {
            const itemValues = validCases.map(row => row[idx]);
            const restTotals = validCases.map(row => sum(row) - row[idx]);
            const corrWithRest = pearsonCorrelation(itemValues, restTotals);
            
            // Alpha if deleted
            const remainingItems = depVars.filter((_, i) => i !== idx);
            const remainingVariances = itemStats.filter((_, i) => i !== idx).map(s => s.variance);
            const remainingTotals = validCases.map(row => sum(row.filter((_, i) => i !== idx)));
            const alphaIfDeleted = ((n - 1) / (n - 2)) * (1 - sum(remainingVariances) / variance(remainingTotals));
            
            return {
              Item: v,
              Mean: itemStats[idx].mean,
              'Std. Deviation': itemStats[idx].std,
              'Item-Total Correlation': corrWithRest,
              'Alpha if Deleted': alphaIfDeleted,
            };
          });
          
          tables.push({
            title: 'Reliability Statistics',
            headers: ["Cronbach's Alpha", 'N of Items', 'N of Cases'],
            rows: [{ "Cronbach's Alpha": alpha, 'N of Items': n, 'N of Cases': validCases.length }],
          });
          
          tables.push({
            title: 'Item Statistics',
            headers: ['Item', 'Mean', 'Std. Deviation', 'N'],
            rows: itemStats.map(s => ({
              Item: s.name,
              Mean: s.mean,
              'Std. Deviation': s.std,
              N: validCases.length,
            })),
          });
          
          tables.push({
            title: 'Item-Total Statistics',
            headers: ['Item', 'Item-Total Correlation', 'Alpha if Deleted'],
            rows: itemAnalysis.map(item => ({
              Item: item.Item,
              'Item-Total Correlation': item['Item-Total Correlation'],
              'Alpha if Deleted': item['Alpha if Deleted'],
            })),
          });
          
          tables.push({
            title: 'Reliability Interpretation',
            headers: ['Alpha Range', 'Interpretation'],
            rows: [
              { 'Alpha Range': '≥ 0.9', Interpretation: 'Excellent' },
              { 'Alpha Range': '0.8 - 0.9', Interpretation: 'Good' },
              { 'Alpha Range': '0.7 - 0.8', Interpretation: 'Acceptable' },
              { 'Alpha Range': '0.6 - 0.7', Interpretation: 'Questionable' },
              { 'Alpha Range': '0.5 - 0.6', Interpretation: 'Poor' },
              { 'Alpha Range': '< 0.5', Interpretation: 'Unacceptable' },
              { 'Alpha Range': `Your α = ${alpha.toFixed(3)}`, Interpretation: interpretAlpha(alpha) },
            ],
          });
        }
      }
      break;
    }

    default:
      tables.push({
        title: 'Analysis Results',
        headers: ['Message'],
        rows: [{ Message: `Analysis type "${testType}" is not yet fully implemented. Coming soon!` }],
      });
  }

  return {
    tables,
    charts,
    summary: `Analysis completed with ${data.length} cases and ${depVars.length} variable(s).`,
  };
}

// ==================== ADDITIONAL HELPER FUNCTIONS ====================

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  
  let num = 0, dx = 0, dy = 0;
  for (let k = 0; k < n; k++) {
    num += (x[k] - mx) * (y[k] - my);
    dx += Math.pow(x[k] - mx, 2);
    dy += Math.pow(y[k] - my, 2);
  }
  
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

function fisherZ(r: number): number {
  return 0.5 * Math.log((1 + r) / (1 - r));
}

function interpretCorrelation(r: number): string {
  const absR = Math.abs(r);
  if (absR < 0.1) return 'negligible';
  if (absR < 0.3) return 'weak';
  if (absR < 0.5) return 'moderate';
  if (absR < 0.7) return 'strong';
  return 'very strong';
}

function interpretCramersV(v: number, k: number): string {
  // Interpretation depends on degrees of freedom
  if (k <= 2) {
    if (v < 0.1) return 'negligible';
    if (v < 0.3) return 'small';
    if (v < 0.5) return 'medium';
    return 'large';
  } else {
    if (v < 0.07) return 'negligible';
    if (v < 0.21) return 'small';
    if (v < 0.35) return 'medium';
    return 'large';
  }
}

function interpretAlpha(alpha: number): string {
  if (alpha >= 0.9) return 'Excellent';
  if (alpha >= 0.8) return 'Good';
  if (alpha >= 0.7) return 'Acceptable';
  if (alpha >= 0.6) return 'Questionable';
  if (alpha >= 0.5) return 'Poor';
  return 'Unacceptable';
}

function findMode(arr: number[]): number {
  const freq: Record<number, number> = {};
  let maxFreq = 0;
  let mode = arr[0];
  
  arr.forEach(v => {
    freq[v] = (freq[v] || 0) + 1;
    if (freq[v] > maxFreq) {
      maxFreq = freq[v];
      mode = v;
    }
  });
  
  return mode;
}

function calculateLikelihoodRatio(
  observed: Record<string, Record<string, number>>,
  expected: Record<string, Record<string, number>>,
  rows: string[],
  cols: string[]
): number {
  let G = 0;
  rows.forEach(row => {
    cols.forEach(col => {
      const o = observed[row][col] || 0;
      const e = expected[row][col] || 0;
      if (o > 0 && e > 0) {
        G += 2 * o * Math.log(o / e);
      }
    });
  });
  return G;
}
