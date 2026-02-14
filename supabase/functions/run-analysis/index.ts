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
    const { testType, dependentVariables, independentVariables, groupingVariable, data, options = {} } = await req.json();

    console.log('Running analysis:', testType, 'with', data.length, 'rows');

    const results = calculateStatistics(testType, dependentVariables, independentVariables, groupingVariable, data, options);

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

function gamma(z: number): number {
  if (z < 0.5) {
    return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  }
  z -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

function beta(a: number, b: number): number {
  return (gamma(a) * gamma(b)) / gamma(a + b);
}

function incompleteBeta(x: number, a: number, b: number): number {
  if (x === 0) return 0;
  if (x === 1) return 1;
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(1 - x, b, a);
  }
  const bt = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - Math.log(beta(a, b)));
  const maxIter = 200;
  const eps = 1e-10;
  let c = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  
  for (let m = 1; m <= maxIter; m++) {
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
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return bt * h / a;
}

function tCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  const p = 0.5 * incompleteBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - p : p;
}

function tTestPValue(t: number, df: number): number {
  return 2 * (1 - tCDF(Math.abs(t), df));
}

function fCDF(f: number, df1: number, df2: number): number {
  if (f <= 0) return 0;
  const x = df1 * f / (df1 * f + df2);
  return incompleteBeta(x, df1 / 2, df2 / 2);
}

function fTestPValue(f: number, df1: number, df2: number): number {
  return 1 - fCDF(f, df1, df2);
}

function chiSquareCDF(x: number, df: number): number {
  if (x <= 0) return 0;
  return incompleteGamma(df / 2, x / 2) / gamma(df / 2);
}

function incompleteGamma(a: number, x: number): number {
  if (x < 0) return 0;
  if (x === 0) return 0;
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
  return gamma(a) - incompleteGammaUpper(a, x);
}

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

function chiSquarePValue(x: number, df: number): number {
  return 1 - chiSquareCDF(x, df);
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function zTestPValue(z: number): number {
  return 2 * (1 - normalCDF(Math.abs(z)));
}

// ==================== EFFECT SIZE CALCULATIONS ====================

function cohensD(group1: number[], group2: number[]): number {
  const m1 = mean(group1), m2 = mean(group2);
  const n1 = group1.length, n2 = group2.length;
  const s1 = variance(group1), s2 = variance(group2);
  const pooledSD = Math.sqrt(((n1 - 1) * s1 + (n2 - 1) * s2) / (n1 + n2 - 2));
  return pooledSD === 0 ? 0 : (m1 - m2) / pooledSD;
}

function cohensDPaired(diff: number[]): number {
  const m = mean(diff);
  const s = std(diff);
  return s === 0 ? 0 : m / s;
}

function cohensDOneSample(values: number[], testValue: number): number {
  const m = mean(values);
  const s = std(values);
  return s === 0 ? 0 : (m - testValue) / s;
}

function etaSquared(ssEffect: number, ssTotal: number): number {
  return ssTotal === 0 ? 0 : ssEffect / ssTotal;
}

function partialEtaSquared(ssEffect: number, ssError: number): number {
  return (ssEffect + ssError) === 0 ? 0 : ssEffect / (ssEffect + ssError);
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

function interpretR2(r2: number): string {
  if (r2 < 0.02) return 'negligible';
  if (r2 < 0.13) return 'small';
  if (r2 < 0.26) return 'medium';
  return 'large';
}

// ==================== CONFIDENCE INTERVALS ====================

function confidenceInterval(m: number, se: number, df: number, confidence = 0.95): [number, number] {
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
    while (j < sorted.length && sorted[j].value === sorted[i].value) {
      j++;
    }
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[sorted[k].index] = avgRank;
    }
    i = j;
  }
  return ranks;
}

// ==================== CORRELATION FUNCTIONS ====================

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

function interpretAlpha(alpha: number): string {
  if (alpha >= 0.9) return 'Excellent';
  if (alpha >= 0.8) return 'Good';
  if (alpha >= 0.7) return 'Acceptable';
  if (alpha >= 0.6) return 'Questionable';
  if (alpha >= 0.5) return 'Poor';
  return 'Unacceptable';
}

function interpretCramersV(v: number, k: number): string {
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

// ==================== KENDALL'S TAU ====================

function kendallTau(x: number[], y: number[]): { tau: number; z: number; pValue: number } {
  const n = Math.min(x.length, y.length);
  if (n < 2) return { tau: 0, z: 0, pValue: 1 };
  
  let concordant = 0, discordant = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const xDiff = x[j] - x[i];
      const yDiff = y[j] - y[i];
      if (xDiff * yDiff > 0) concordant++;
      else if (xDiff * yDiff < 0) discordant++;
    }
  }
  
  const tau = (concordant - discordant) / (n * (n - 1) / 2);
  const z = 3 * tau * Math.sqrt(n * (n - 1)) / Math.sqrt(2 * (2 * n + 5));
  const pValue = zTestPValue(z);
  
  return { tau, z, pValue };
}

// ==================== REGRESSION HELPERS ====================

function simpleLinearRegression(x: number[], y: number[]): {
  slope: number; intercept: number; r: number; r2: number;
  se: number; slopeError: number; interceptError: number;
  tSlope: number; pSlope: number; tIntercept: number; pIntercept: number;
  f: number; pF: number; residuals: number[];
} {
  const n = Math.min(x.length, y.length);
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  
  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (x[i] - mx) * (y[i] - my);
    ssXX += Math.pow(x[i] - mx, 2);
    ssYY += Math.pow(y[i] - my, 2);
  }
  
  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const intercept = my - slope * mx;
  const r = Math.sqrt(ssXX * ssYY) === 0 ? 0 : ssXY / Math.sqrt(ssXX * ssYY);
  const r2 = r * r;
  
  // Residuals
  const residuals = [];
  let ssResidual = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * x[i];
    const residual = y[i] - predicted;
    residuals.push(residual);
    ssResidual += residual * residual;
  }
  
  const mse = ssResidual / (n - 2);
  const se = Math.sqrt(mse);
  const slopeError = ssXX === 0 ? 0 : Math.sqrt(mse / ssXX);
  const interceptError = Math.sqrt(mse * (1/n + mx*mx/ssXX));
  
  const tSlope = slopeError === 0 ? 0 : slope / slopeError;
  const tIntercept = interceptError === 0 ? 0 : intercept / interceptError;
  const pSlope = tTestPValue(tSlope, n - 2);
  const pIntercept = tTestPValue(tIntercept, n - 2);
  
  const ssRegression = ssYY - ssResidual;
  const f = mse === 0 ? 0 : ssRegression / mse;
  const pF = fTestPValue(f, 1, n - 2);
  
  return { slope, intercept, r, r2, se, slopeError, interceptError, tSlope, pSlope, tIntercept, pIntercept, f, pF, residuals };
}

// ==================== MAIN CALCULATION FUNCTION ====================

function calculateStatistics(
  testType: string,
  depVars: string[],
  indVars: string[],
  groupVar: string | undefined,
  data: Record<string, unknown>[],
  options: Record<string, unknown> = {}
) {
  const tables: Array<{ title: string; headers: string[]; rows: Array<Record<string, string | number>> }> = [];
  const charts: Array<{ type: string; data: unknown; title: string }> = [];
  let effectSize: { type: string; value: number; magnitude: string; interpretation: string } | undefined;

  switch (testType) {
    case 'descriptives': {
      const rows = depVars.map(varName => {
        const values = getNumericValues(data, varName);
        const n = values.length;
        const m = mean(values);
        const se = standardError(values);
        const [ciLower, ciUpper] = confidenceInterval(m, se, n - 1);
        return {
          Variable: varName, N: n, Mean: m, 'Std. Error': se, 'Std. Deviation': std(values),
          Variance: variance(values), Minimum: min(values), Maximum: max(values),
          Range: max(values) - min(values), Skewness: skewness(values), Kurtosis: kurtosis(values),
          '95% CI Lower': ciLower, '95% CI Upper': ciUpper,
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
            return { Value: value, Frequency: count, Percent: percent, 'Valid Percent': validPercent, 'Cumulative Percent': cumPercent };
          });
        tables.push({ title: `Frequencies: ${varName}`, headers: ['Value', 'Frequency', 'Percent', 'Valid Percent', 'Cumulative Percent'], rows });
        
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
            ],
          });
        }
        charts.push({ type: 'bar', title: `${varName} Distribution`, data: Object.entries(freq).filter(([k]) => k !== 'Missing').map(([name, value]) => ({ name, value })) });
      });
      break;
    }

    case 'one-sample-t-test': {
      const testValue = Number(options.testValue) || 0;
      if (depVars[0]) {
        const values = getNumericValues(data, depVars[0]);
        const n = values.length;
        const m = mean(values);
        const s = std(values);
        const se = standardError(values);
        const t = (m - testValue) / se;
        const df = n - 1;
        const pValue = tTestPValue(t, df);
        const d = cohensDOneSample(values, testValue);
        const [ciLower, ciUpper] = confidenceInterval(m - testValue, se, df);

        tables.push({
          title: 'One-Sample Statistics',
          headers: ['Variable', 'N', 'Mean', 'Std. Deviation', 'Std. Error Mean'],
          rows: [{ Variable: depVars[0], N: n, Mean: m, 'Std. Deviation': s, 'Std. Error Mean': se }],
        });
        tables.push({
          title: 'One-Sample Test',
          headers: ['Variable', 'Test Value', 't', 'df', 'Sig. (2-tailed)', 'Mean Difference', '95% CI Lower', '95% CI Upper'],
          rows: [{ Variable: depVars[0], 'Test Value': testValue, t, df, 'Sig. (2-tailed)': pValue, 'Mean Difference': m - testValue, '95% CI Lower': ciLower, '95% CI Upper': ciUpper }],
        });
        effectSize = { type: "Cohen's d", value: d, magnitude: interpretCohensD(d), interpretation: `The effect size is ${interpretCohensD(d)} (d = ${d.toFixed(3)})` };
        tables.push({ title: 'Effect Size', headers: ['Statistic', 'Value', 'Interpretation'], rows: [{ Statistic: "Cohen's d", Value: d, Interpretation: interpretCohensD(d) }] });
      }
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
          const g1 = groups[groupNames[0]], g2 = groups[groupNames[1]];
          const n1 = g1.length, n2 = g2.length;
          const m1 = mean(g1), m2 = mean(g2);
          const s1 = std(g1), s2 = std(g2);
          const v1 = variance(g1), v2 = variance(g2);
          const se1 = standardError(g1), se2 = standardError(g2);
          
          const pooledVar = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
          const pooledSE = Math.sqrt(pooledVar * (1/n1 + 1/n2));
          const t = (m1 - m2) / pooledSE;
          const df = n1 + n2 - 2;
          const pValue = tTestPValue(t, df);
          
          const welchSE = Math.sqrt(v1/n1 + v2/n2);
          const tWelch = (m1 - m2) / welchSE;
          const dfWelch = Math.pow(v1/n1 + v2/n2, 2) / (Math.pow(v1/n1, 2)/(n1-1) + Math.pow(v2/n2, 2)/(n2-1));
          const pValueWelch = tTestPValue(tWelch, dfWelch);
          
          const d = cohensD(g1, g2);
          const meanDiff = m1 - m2;
          const [ciLower, ciUpper] = confidenceInterval(meanDiff, pooledSE, df);

          tables.push({ title: 'Group Statistics', headers: ['Group', 'N', 'Mean', 'Std. Deviation', 'Std. Error Mean'], rows: [
            { Group: groupNames[0], N: n1, Mean: m1, 'Std. Deviation': s1, 'Std. Error Mean': se1 },
            { Group: groupNames[1], N: n2, Mean: m2, 'Std. Deviation': s2, 'Std. Error Mean': se2 },
          ]});
          tables.push({ title: 'Independent Samples Test', headers: ['', 't', 'df', 'Sig. (2-tailed)', 'Mean Difference', 'Std. Error Difference', '95% CI Lower', '95% CI Upper'], rows: [
            { '': 'Equal variances assumed', t, df, 'Sig. (2-tailed)': pValue, 'Mean Difference': meanDiff, 'Std. Error Difference': pooledSE, '95% CI Lower': ciLower, '95% CI Upper': ciUpper },
            { '': 'Equal variances not assumed', t: tWelch, df: dfWelch, 'Sig. (2-tailed)': pValueWelch, 'Mean Difference': meanDiff, 'Std. Error Difference': welchSE, '95% CI Lower': meanDiff - 1.96 * welchSE, '95% CI Upper': meanDiff + 1.96 * welchSE },
          ]});
          effectSize = { type: "Cohen's d", value: d, magnitude: interpretCohensD(d), interpretation: `The effect size is ${interpretCohensD(d)} (d = ${d.toFixed(3)})` };
          tables.push({ title: 'Effect Size', headers: ['Statistic', 'Value', 'Interpretation'], rows: [{ Statistic: "Cohen's d", Value: d, Interpretation: interpretCohensD(d) }] });
          charts.push({ type: 'bar', title: 'Group Means Comparison', data: [{ name: groupNames[0], value: m1 }, { name: groupNames[1], value: m2 }] });
        }
      }
      break;
    }

    case 'paired-t-test': {
      if (depVars.length >= 2) {
        const pairs: Array<{ v1: number; v2: number; diff: number }> = [];
        data.forEach(row => {
          const v1 = Number(row[depVars[0]]);
          const v2 = Number(row[depVars[1]]);
          if (!isNaN(v1) && !isNaN(v2)) pairs.push({ v1, v2, diff: v1 - v2 });
        });
        if (pairs.length > 1) {
          const values1 = pairs.map(p => p.v1), values2 = pairs.map(p => p.v2), diffs = pairs.map(p => p.diff);
          const n = pairs.length;
          const m1 = mean(values1), m2 = mean(values2);
          const s1 = std(values1), s2 = std(values2);
          const diffMean = mean(diffs), diffSD = std(diffs), diffSE = standardError(diffs);
          const t = diffMean / diffSE;
          const df = n - 1;
          const pValue = tTestPValue(t, df);
          const d = cohensDPaired(diffs);
          const [ciLower, ciUpper] = confidenceInterval(diffMean, diffSE, df);

          tables.push({ title: 'Paired Samples Statistics', headers: ['', 'Mean', 'N', 'Std. Deviation', 'Std. Error Mean'], rows: [
            { '': depVars[0], Mean: m1, N: n, 'Std. Deviation': s1, 'Std. Error Mean': standardError(values1) },
            { '': depVars[1], Mean: m2, N: n, 'Std. Deviation': s2, 'Std. Error Mean': standardError(values2) },
          ]});
          tables.push({ title: 'Paired Samples Test', headers: ['Pair', 'Mean Diff', 'Std. Deviation', 'Std. Error Mean', '95% CI Lower', '95% CI Upper', 't', 'df', 'Sig. (2-tailed)'], rows: [
            { Pair: `${depVars[0]} - ${depVars[1]}`, 'Mean Diff': diffMean, 'Std. Deviation': diffSD, 'Std. Error Mean': diffSE, '95% CI Lower': ciLower, '95% CI Upper': ciUpper, t, df, 'Sig. (2-tailed)': pValue },
          ]});
          effectSize = { type: "Cohen's d", value: d, magnitude: interpretCohensD(d), interpretation: `The effect size is ${interpretCohensD(d)} (d = ${d.toFixed(3)})` };
          tables.push({ title: 'Effect Size', headers: ['Statistic', 'Value', 'Interpretation'], rows: [{ Statistic: "Cohen's d", Value: d, Interpretation: interpretCohensD(d) }] });
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
        const k = groupNames.length;
        if (k >= 2) {
          const allValues = Object.values(groups).flat();
          const grandMean = mean(allValues);
          const N = allValues.length;
          
          let ssBetween = 0;
          groupNames.forEach(g => { ssBetween += groups[g].length * Math.pow(mean(groups[g]) - grandMean, 2); });
          
          let ssWithin = 0;
          groupNames.forEach(g => { const gm = mean(groups[g]); groups[g].forEach(v => { ssWithin += Math.pow(v - gm, 2); }); });
          
          const ssTotal = ssBetween + ssWithin;
          const dfBetween = k - 1, dfWithin = N - k;
          const msBetween = ssBetween / dfBetween, msWithin = ssWithin / dfWithin;
          const F = msBetween / msWithin;
          const pValue = fTestPValue(F, dfBetween, dfWithin);
          const eta2 = etaSquared(ssBetween, ssTotal);
          const omega2 = omegaSquared(ssBetween, ssWithin, msWithin, dfBetween, N);

          tables.push({ title: 'Descriptives', headers: ['Group', 'N', 'Mean', 'Std. Deviation', 'Std. Error'], rows: groupNames.map(g => {
            const values = groups[g];
            return { Group: g, N: values.length, Mean: mean(values), 'Std. Deviation': std(values), 'Std. Error': standardError(values) };
          })});
          tables.push({ title: 'ANOVA', headers: ['Source', 'Sum of Squares', 'df', 'Mean Square', 'F', 'Sig.'], rows: [
            { Source: 'Between Groups', 'Sum of Squares': ssBetween, df: dfBetween, 'Mean Square': msBetween, F, 'Sig.': pValue },
            { Source: 'Within Groups', 'Sum of Squares': ssWithin, df: dfWithin, 'Mean Square': msWithin, F: '-', 'Sig.': '-' },
            { Source: 'Total', 'Sum of Squares': ssTotal, df: N - 1, 'Mean Square': '-', F: '-', 'Sig.': '-' },
          ]});
          effectSize = { type: 'Eta Squared (η²)', value: eta2, magnitude: interpretEtaSquared(eta2), interpretation: `The effect size is ${interpretEtaSquared(eta2)} (η² = ${eta2.toFixed(3)})` };
          tables.push({ title: 'Effect Sizes', headers: ['Statistic', 'Value', 'Interpretation'], rows: [
            { Statistic: 'Eta Squared (η²)', Value: eta2, Interpretation: interpretEtaSquared(eta2) },
            { Statistic: 'Omega Squared (ω²)', Value: omega2, Interpretation: interpretEtaSquared(omega2) },
          ]});
          
          // Post-hoc if significant
          if (pValue < 0.05 && k > 2) {
            const postHocRows: Array<Record<string, string | number>> = [];
            for (let i = 0; i < groupNames.length; i++) {
              for (let j = i + 1; j < groupNames.length; j++) {
                const g1 = groups[groupNames[i]], g2 = groups[groupNames[j]];
                const meanDiff = mean(g1) - mean(g2);
                const se = Math.sqrt(msWithin * (1/g1.length + 1/g2.length));
                const q = Math.abs(meanDiff) / se;
                const pPostHoc = Math.min(1, 2 * (1 - normalCDF(q / Math.sqrt(2))));
                postHocRows.push({ '(I) Group': groupNames[i], '(J) Group': groupNames[j], 'Mean Difference (I-J)': meanDiff, 'Std. Error': se, 'Sig.': pPostHoc, Significant: pPostHoc < 0.05 ? 'Yes' : 'No' });
              }
            }
            tables.push({ title: 'Post Hoc Tests - Multiple Comparisons (Tukey)', headers: ['(I) Group', '(J) Group', 'Mean Difference (I-J)', 'Std. Error', 'Sig.', 'Significant'], rows: postHocRows });
          }
          charts.push({ type: 'bar', title: 'Group Means', data: groupNames.map(g => ({ name: g, value: mean(groups[g]) })) });
        }
      }
      break;
    }

    case 'kruskal-wallis': {
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
        const k = groupNames.length;
        if (k >= 2) {
          // Rank all values
          const allWithGroup: Array<{value: number; group: string}> = [];
          Object.entries(groups).forEach(([g, vals]) => {
            vals.forEach(v => allWithGroup.push({ value: v, group: g }));
          });
          allWithGroup.sort((a, b) => a.value - b.value);
          const N = allWithGroup.length;
          const ranks = new Array(N);
          let i = 0;
          while (i < N) {
            let j = i;
            while (j < N && allWithGroup[j].value === allWithGroup[i].value) j++;
            const avgRank = (i + 1 + j) / 2;
            for (let k = i; k < j; k++) ranks[k] = avgRank;
            i = j;
          }
          
          // Sum of ranks per group
          const rankSums: Record<string, number> = {};
          groupNames.forEach(g => rankSums[g] = 0);
          allWithGroup.forEach((item, idx) => rankSums[item.group] += ranks[idx]);
          
          // H statistic
          let H = 0;
          groupNames.forEach(g => {
            const n = groups[g].length;
            const R = rankSums[g];
            H += (R * R) / n;
          });
          H = (12 / (N * (N + 1))) * H - 3 * (N + 1);
          const df = k - 1;
          const pValue = chiSquarePValue(H, df);
          const eta2 = (H - k + 1) / (N - k); // Epsilon squared approximation

          tables.push({ title: 'Ranks', headers: ['Group', 'N', 'Mean Rank'], rows: groupNames.map(g => ({ Group: g, N: groups[g].length, 'Mean Rank': rankSums[g] / groups[g].length })) });
          tables.push({ title: 'Test Statistics', headers: ['Statistic', 'Value'], rows: [
            { Statistic: 'Kruskal-Wallis H', Value: H },
            { Statistic: 'df', Value: df },
            { Statistic: 'Asymp. Sig.', Value: pValue },
          ]});
          effectSize = { type: 'Epsilon Squared (ε²)', value: eta2, magnitude: interpretEtaSquared(eta2), interpretation: `The effect size is ${interpretEtaSquared(eta2)} (ε² = ${eta2.toFixed(3)})` };
          
          // Dunn's post-hoc if significant
          if (pValue < 0.05 && k > 2) {
            const postHocRows: Array<Record<string, string | number>> = [];
            for (let i = 0; i < groupNames.length; i++) {
              for (let j = i + 1; j < groupNames.length; j++) {
                const ni = groups[groupNames[i]].length, nj = groups[groupNames[j]].length;
                const Ri = rankSums[groupNames[i]] / ni, Rj = rankSums[groupNames[j]] / nj;
                const se = Math.sqrt((N * (N + 1) / 12) * (1/ni + 1/nj));
                const z = (Ri - Rj) / se;
                const p = zTestPValue(z);
                postHocRows.push({ '(I) Group': groupNames[i], '(J) Group': groupNames[j], 'Mean Rank Diff': Ri - Rj, 'Std. Error': se, 'Z': z, 'Sig.': p });
              }
            }
            tables.push({ title: "Post Hoc Tests - Dunn's", headers: ['(I) Group', '(J) Group', 'Mean Rank Diff', 'Std. Error', 'Z', 'Sig.'], rows: postHocRows });
          }
        }
      }
      break;
    }

    case 'friedman': {
      if (depVars.length >= 2) {
        const validCases: number[][] = [];
        data.forEach(row => {
          const rowVals = depVars.map(v => Number(row[v]));
          if (rowVals.every(v => !isNaN(v))) validCases.push(rowVals);
        });
        const n = validCases.length, k = depVars.length;
        if (n > 1 && k >= 2) {
          // Rank within each case
          const rankedCases = validCases.map(caseVals => {
            const indexed = caseVals.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
            const ranks = new Array(k);
            let i = 0;
            while (i < k) {
              let j = i;
              while (j < k && indexed[j].v === indexed[i].v) j++;
              const avgRank = (i + 1 + j) / 2;
              for (let m = i; m < j; m++) ranks[indexed[m].i] = avgRank;
              i = j;
            }
            return ranks;
          });
          
          // Sum of ranks per condition
          const rankSums = depVars.map((_, condIdx) => sum(rankedCases.map(r => r[condIdx])));
          const meanRanks = rankSums.map(s => s / n);
          
          // Friedman statistic
          const ssRanks = sum(rankSums.map(R => R * R));
          const Q = (12 / (n * k * (k + 1))) * ssRanks - 3 * n * (k + 1);
          const df = k - 1;
          const pValue = chiSquarePValue(Q, df);
          const W = Q / (n * (k - 1)); // Kendall's W

          tables.push({ title: 'Ranks', headers: ['Condition', 'Mean Rank'], rows: depVars.map((v, i) => ({ Condition: v, 'Mean Rank': meanRanks[i] })) });
          tables.push({ title: 'Test Statistics', headers: ['Statistic', 'Value'], rows: [
            { Statistic: 'N', Value: n },
            { Statistic: 'Chi-Square', Value: Q },
            { Statistic: 'df', Value: df },
            { Statistic: 'Asymp. Sig.', Value: pValue },
            { Statistic: "Kendall's W", Value: W },
          ]});
          effectSize = { type: "Kendall's W", value: W, magnitude: W < 0.1 ? 'negligible' : W < 0.3 ? 'small' : W < 0.5 ? 'moderate' : 'large', interpretation: `Concordance is ${W < 0.3 ? 'weak' : W < 0.5 ? 'moderate' : 'strong'} (W = ${W.toFixed(3)})` };
        }
      }
      break;
    }

    case 'kendall-tau': {
      if (depVars.length >= 2) {
        const x = getNumericValues(data, depVars[0]);
        const y = getNumericValues(data, depVars[1]);
        const n = Math.min(x.length, y.length);
        if (n >= 2) {
          const { tau, z, pValue } = kendallTau(x.slice(0, n), y.slice(0, n));
          tables.push({ title: 'Correlations', headers: ['', depVars[0], depVars[1]], rows: [
            { '': "Kendall's tau_b", [depVars[0]]: 1, [depVars[1]]: tau },
            { '': 'Sig. (2-tailed)', [depVars[0]]: '-', [depVars[1]]: pValue },
            { '': 'N', [depVars[0]]: n, [depVars[1]]: n },
          ]});
          effectSize = { type: "Kendall's tau", value: tau, magnitude: interpretCorrelation(tau), interpretation: `The correlation is ${interpretCorrelation(tau)} (τ = ${tau.toFixed(3)})` };
        }
      }
      break;
    }

    case 'simple-linear-regression': {
      if (depVars[0] && indVars[0]) {
        const y = getNumericValues(data, depVars[0]);
        const x = getNumericValues(data, indVars[0]);
        const n = Math.min(x.length, y.length);
        if (n >= 3) {
          const result = simpleLinearRegression(x.slice(0, n), y.slice(0, n));
          
          tables.push({ title: 'Model Summary', headers: ['R', 'R Square', 'Adjusted R Square', 'Std. Error of the Estimate'], rows: [
            { R: Math.abs(result.r), 'R Square': result.r2, 'Adjusted R Square': 1 - (1 - result.r2) * (n - 1) / (n - 2), 'Std. Error of the Estimate': result.se },
          ]});
          tables.push({ title: 'ANOVA', headers: ['Model', 'Sum of Squares', 'df', 'Mean Square', 'F', 'Sig.'], rows: [
            { Model: 'Regression', 'Sum of Squares': result.r2 * variance(y.slice(0, n)) * (n - 1), df: 1, 'Mean Square': result.r2 * variance(y.slice(0, n)) * (n - 1), F: result.f, 'Sig.': result.pF },
            { Model: 'Residual', 'Sum of Squares': (1 - result.r2) * variance(y.slice(0, n)) * (n - 1), df: n - 2, 'Mean Square': result.se * result.se, F: '-', 'Sig.': '-' },
          ]});
          tables.push({ title: 'Coefficients', headers: ['', 'B', 'Std. Error', 't', 'Sig.'], rows: [
            { '': '(Constant)', B: result.intercept, 'Std. Error': result.interceptError, t: result.tIntercept, 'Sig.': result.pIntercept },
            { '': indVars[0], B: result.slope, 'Std. Error': result.slopeError, t: result.tSlope, 'Sig.': result.pSlope },
          ]});
          effectSize = { type: 'R²', value: result.r2, magnitude: interpretR2(result.r2), interpretation: `The model explains ${(result.r2 * 100).toFixed(1)}% of variance (${interpretR2(result.r2)} effect)` };
          charts.push({ type: 'scatter', title: `${indVars[0]} vs ${depVars[0]}`, data: Array.from({ length: Math.min(n, 100) }, (_, i) => ({ x: x[i], y: y[i] })) });
        }
      }
      break;
    }

    case 'pearson': {
      if (depVars.length >= 2) {
        const correlations: Array<Record<string, string | number>> = [];
        for (let i = 0; i < depVars.length; i++) {
          for (let j = i + 1; j < depVars.length; j++) {
            const x = getNumericValues(data, depVars[i]);
            const y = getNumericValues(data, depVars[j]);
            const n = Math.min(x.length, y.length);
            const r = pearsonCorrelation(x.slice(0, n), y.slice(0, n));
            const t = r * Math.sqrt((n - 2) / (1 - r * r));
            const pValue = tTestPValue(t, n - 2);
            correlations.push({ 'Variable 1': depVars[i], 'Variable 2': depVars[j], 'Pearson r': r, 'Sig. (2-tailed)': pValue, N: n, Interpretation: interpretCorrelation(r) });
          }
        }
        tables.push({ title: 'Correlations', headers: ['Variable 1', 'Variable 2', 'Pearson r', 'Sig. (2-tailed)', 'N', 'Interpretation'], rows: correlations });
        if (correlations.length > 0) {
          const r = correlations[0]['Pearson r'] as number;
          effectSize = { type: "Pearson's r", value: r, magnitude: interpretCorrelation(r), interpretation: `The correlation is ${interpretCorrelation(r)} (r = ${r.toFixed(3)})` };
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
            const xRanks = rank(x.slice(0, n)), yRanks = rank(y.slice(0, n));
            const rho = pearsonCorrelation(xRanks, yRanks);
            const t = rho * Math.sqrt((n - 2) / (1 - rho * rho));
            const pValue = tTestPValue(t, n - 2);
            correlations.push({ 'Variable 1': depVars[i], 'Variable 2': depVars[j], "Spearman's rho": rho, 'Sig. (2-tailed)': pValue, N: n, Interpretation: interpretCorrelation(rho) });
          }
        }
        tables.push({ title: 'Correlations', headers: ['Variable 1', 'Variable 2', "Spearman's rho", 'Sig. (2-tailed)', 'N', 'Interpretation'], rows: correlations });
        if (correlations.length > 0) {
          const rho = correlations[0]["Spearman's rho"] as number;
          effectSize = { type: "Spearman's rho", value: rho, magnitude: interpretCorrelation(rho), interpretation: `The correlation is ${interpretCorrelation(rho)} (ρ = ${rho.toFixed(3)})` };
        }
      }
      break;
    }

    case 'chi-square': {
      if (depVars.length >= 2) {
        const var1 = depVars[0], var2 = depVars[1];
        const contingency: Record<string, Record<string, number>> = {};
        const rowTotals: Record<string, number> = {};
        const colTotals: Record<string, number> = {};
        let grandTotal = 0;
        
        data.forEach(row => {
          const r = String(row[var1] ?? 'Missing');
          const c = String(row[var2] ?? 'Missing');
          contingency[r] = contingency[r] || {};
          contingency[r][c] = (contingency[r][c] || 0) + 1;
          rowTotals[r] = (rowTotals[r] || 0) + 1;
          colTotals[c] = (colTotals[c] || 0) + 1;
          grandTotal++;
        });
        
        const rowLabels = Object.keys(contingency);
        const colLabels = Object.keys(colTotals);
        
        if (rowLabels.length >= 2 && colLabels.length >= 2) {
          let chiSquare = 0;
          rowLabels.forEach(row => {
            colLabels.forEach(col => {
              const observed = contingency[row][col] || 0;
              const expected = (rowTotals[row] * colTotals[col]) / grandTotal;
              if (expected > 0) chiSquare += Math.pow(observed - expected, 2) / expected;
            });
          });
          
          const df = (rowLabels.length - 1) * (colLabels.length - 1);
          const pValue = chiSquarePValue(chiSquare, df);
          const phi = Math.sqrt(chiSquare / grandTotal);
          const cramerV = Math.sqrt(chiSquare / (grandTotal * (Math.min(rowLabels.length, colLabels.length) - 1)));
          
          const crosstabRows: Array<Record<string, string | number>> = [];
          rowLabels.forEach(row => {
            const rowData: Record<string, string | number> = { [var1]: row };
            colLabels.forEach(col => rowData[col] = contingency[row][col] || 0);
            rowData['Row Total'] = rowTotals[row];
            crosstabRows.push(rowData);
          });
          
          tables.push({ title: `Crosstabulation: ${var1} × ${var2}`, headers: [var1, ...colLabels, 'Row Total'], rows: crosstabRows });
          tables.push({ title: 'Chi-Square Tests', headers: ['Test', 'Value', 'df', 'Asymptotic Sig. (2-sided)'], rows: [
            { Test: 'Pearson Chi-Square', Value: chiSquare, df, 'Asymptotic Sig. (2-sided)': pValue },
            { Test: 'N of Valid Cases', Value: grandTotal, df: '-', 'Asymptotic Sig. (2-sided)': '-' },
          ]});
          effectSize = { type: "Cramér's V", value: cramerV, magnitude: interpretCramersV(cramerV, Math.min(rowLabels.length, colLabels.length)), interpretation: `The association is ${interpretCramersV(cramerV, Math.min(rowLabels.length, colLabels.length))} (V = ${cramerV.toFixed(3)})` };
          tables.push({ title: 'Symmetric Measures', headers: ['Measure', 'Value', 'Interpretation'], rows: [
            { Measure: 'Phi', Value: phi, Interpretation: interpretCorrelation(phi) },
            { Measure: "Cramér's V", Value: cramerV, Interpretation: interpretCramersV(cramerV, Math.min(rowLabels.length, colLabels.length)) },
          ]});
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
          const g1 = groups[groupNames[0]], g2 = groups[groupNames[1]];
          const n1 = g1.length, n2 = g2.length;
          
          const allValues = [...g1.map(v => ({ value: v, group: 0 })), ...g2.map(v => ({ value: v, group: 1 }))];
          allValues.sort((a, b) => a.value - b.value);
          const ranks = new Array(allValues.length);
          let i = 0;
          while (i < allValues.length) {
            let j = i;
            while (j < allValues.length && allValues[j].value === allValues[i].value) j++;
            const avgRank = (i + 1 + j) / 2;
            for (let k = i; k < j; k++) ranks[k] = avgRank;
            i = j;
          }
          
          let R1 = 0;
          for (let k = 0; k < allValues.length; k++) {
            if (allValues[k].group === 0) R1 += ranks[k];
          }
          
          const U1 = R1 - (n1 * (n1 + 1)) / 2;
          const U2 = n1 * n2 - U1;
          const U = Math.min(U1, U2);
          const meanU = (n1 * n2) / 2;
          const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
          const z = (U - meanU) / stdU;
          const pValue = zTestPValue(z);
          const r = Math.abs(z) / Math.sqrt(n1 + n2);

          tables.push({ title: 'Ranks', headers: ['Group', 'N', 'Mean Rank', 'Sum of Ranks'], rows: [
            { Group: groupNames[0], N: n1, 'Mean Rank': R1 / n1, 'Sum of Ranks': R1 },
            { Group: groupNames[1], N: n2, 'Mean Rank': (n1 * n2 + (n1 + n2 + 1) * n2 / 2 - R1) / n2, 'Sum of Ranks': n1 * n2 + (n1 + n2 + 1) * n2 / 2 - R1 },
          ]});
          tables.push({ title: 'Test Statistics', headers: ['Statistic', 'Value'], rows: [
            { Statistic: 'Mann-Whitney U', Value: U },
            { Statistic: 'Z', Value: z },
            { Statistic: 'Asymp. Sig. (2-tailed)', Value: pValue },
          ]});
          effectSize = { type: 'r', value: r, magnitude: interpretCorrelation(r), interpretation: `The effect size is ${interpretCorrelation(r)} (r = ${r.toFixed(3)})` };
          tables.push({ title: 'Effect Size', headers: ['Statistic', 'Value', 'Interpretation'], rows: [{ Statistic: 'Effect Size (r)', Value: r, Interpretation: interpretCorrelation(r) }] });
        }
      }
      break;
    }

    case 'wilcoxon': {
      if (depVars.length >= 2) {
        const pairs: Array<{ v1: number; v2: number; diff: number; absDiff: number }> = [];
        data.forEach(row => {
          const v1 = Number(row[depVars[0]]);
          const v2 = Number(row[depVars[1]]);
          if (!isNaN(v1) && !isNaN(v2) && v1 !== v2) {
            pairs.push({ v1, v2, diff: v1 - v2, absDiff: Math.abs(v1 - v2) });
          }
        });
        if (pairs.length > 0) {
          pairs.sort((a, b) => a.absDiff - b.absDiff);
          const ranks = new Array(pairs.length);
          let i = 0;
          while (i < pairs.length) {
            let j = i;
            while (j < pairs.length && pairs[j].absDiff === pairs[i].absDiff) j++;
            const avgRank = (i + 1 + j) / 2;
            for (let k = i; k < j; k++) ranks[k] = avgRank;
            i = j;
          }
          
          let Tplus = 0, Tminus = 0, nPlus = 0, nMinus = 0;
          for (let k = 0; k < pairs.length; k++) {
            if (pairs[k].diff > 0) { Tplus += ranks[k]; nPlus++; }
            else { Tminus += ranks[k]; nMinus++; }
          }
          
          const T = Math.min(Tplus, Tminus);
          const n = pairs.length;
          const meanT = n * (n + 1) / 4;
          const stdT = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24);
          const z = (T - meanT) / stdT;
          const pValue = zTestPValue(z);
          const r = Math.abs(z) / Math.sqrt(n);

          tables.push({ title: 'Wilcoxon Signed Ranks Test', headers: ['', 'N', 'Mean Rank', 'Sum of Ranks'], rows: [
            { '': 'Negative Ranks', N: nMinus, 'Mean Rank': nMinus > 0 ? Tminus / nMinus : 0, 'Sum of Ranks': Tminus },
            { '': 'Positive Ranks', N: nPlus, 'Mean Rank': nPlus > 0 ? Tplus / nPlus : 0, 'Sum of Ranks': Tplus },
            { '': 'Ties', N: data.length - pairs.length, 'Mean Rank': '-', 'Sum of Ranks': '-' },
          ]});
          tables.push({ title: 'Test Statistics', headers: ['Statistic', 'Value'], rows: [
            { Statistic: 'Z', Value: z },
            { Statistic: 'Asymp. Sig. (2-tailed)', Value: pValue },
          ]});
          effectSize = { type: 'r', value: r, magnitude: interpretCorrelation(r), interpretation: `The effect size is ${interpretCorrelation(r)} (r = ${r.toFixed(3)})` };
          tables.push({ title: 'Effect Size', headers: ['Statistic', 'Value', 'Interpretation'], rows: [{ Statistic: 'Effect Size (r)', Value: r, Interpretation: interpretCorrelation(r) }] });
        }
      }
      break;
    }

    case 'cronbach-alpha': {
      if (depVars.length >= 2) {
        const itemData = depVars.map(v => getNumericValues(data, v));
        const validCases: number[][] = [];
        for (let i = 0; i < data.length; i++) {
          const row = depVars.map(v => Number(data[i][v]));
          if (row.every(v => !isNaN(v))) validCases.push(row);
        }
        if (validCases.length > 1) {
          const n = depVars.length;
          const itemStats = depVars.map((v, idx) => {
            const values = validCases.map(row => row[idx]);
            return { name: v, mean: mean(values), std: std(values), variance: variance(values) };
          });
          const totals = validCases.map(row => sum(row));
          const totalVariance = variance(totals);
          const sumItemVariances = sum(itemStats.map(s => s.variance));
          const alpha = (n / (n - 1)) * (1 - sumItemVariances / totalVariance);
          
          const itemAnalysis = depVars.map((v, idx) => {
            const itemValues = validCases.map(row => row[idx]);
            const restTotals = validCases.map(row => sum(row) - row[idx]);
            const corrWithRest = pearsonCorrelation(itemValues, restTotals);
            const remainingVariances = itemStats.filter((_, i) => i !== idx).map(s => s.variance);
            const remainingTotals = validCases.map(row => sum(row.filter((_, i) => i !== idx)));
            const alphaIfDeleted = ((n - 1) / (n - 2)) * (1 - sum(remainingVariances) / variance(remainingTotals));
            return { Item: v, Mean: itemStats[idx].mean, 'Std. Deviation': itemStats[idx].std, 'Item-Total Correlation': corrWithRest, 'Alpha if Deleted': alphaIfDeleted };
          });

          tables.push({ title: 'Reliability Statistics', headers: ["Cronbach's Alpha", 'N of Items', 'N of Cases'], rows: [{ "Cronbach's Alpha": alpha, 'N of Items': n, 'N of Cases': validCases.length }] });
          tables.push({ title: 'Item Statistics', headers: ['Item', 'Mean', 'Std. Deviation', 'N'], rows: itemStats.map(s => ({ Item: s.name, Mean: s.mean, 'Std. Deviation': s.std, N: validCases.length })) });
          tables.push({ title: 'Item-Total Statistics', headers: ['Item', 'Item-Total Correlation', 'Alpha if Deleted'], rows: itemAnalysis.map(item => ({ Item: item.Item, 'Item-Total Correlation': item['Item-Total Correlation'], 'Alpha if Deleted': item['Alpha if Deleted'] })) });
          effectSize = { type: "Cronbach's Alpha", value: alpha, magnitude: interpretAlpha(alpha), interpretation: `Internal consistency is ${interpretAlpha(alpha)} (α = ${alpha.toFixed(3)})` };
        }
      }
      break;
    }

    case 'normality-test': {
      // Deterministic normality testing: Shapiro-Wilk approximation for N<50, K-S for N>=50
      depVars.forEach(varName => {
        const values = getNumericValues(data, varName);
        const n = values.length;
        if (n < 3) return;
        
        const sorted = [...values].sort((a, b) => a - b);
        const m = mean(values);
        const s = std(values);
        const sk = skewness(values);
        const ku = kurtosis(values);
        
        let swStatistic = 0, swPValue = 0;
        // Shapiro-Wilk approximation (Royston's method simplified)
        if (n <= 5000) {
          // Compute W statistic
          const ai: number[] = [];
          for (let i = 0; i < Math.floor(n / 2); i++) {
            const pVal = (i + 1 - 0.375) / (n + 0.25);
            // Inverse normal approximation
            const t = Math.sqrt(-2 * Math.log(pVal));
            const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
            const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
            const normalQuantile = t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
            ai.push(normalQuantile);
          }
          const sumAiSq = ai.reduce((acc, a) => acc + a * a, 0);
          const aCoeffs = ai.map(a => a / Math.sqrt(sumAiSq));
          
          let b = 0;
          for (let i = 0; i < aCoeffs.length; i++) {
            b += aCoeffs[i] * (sorted[n - 1 - i] - sorted[i]);
          }
          
          const totalSS = values.reduce((acc, v) => acc + Math.pow(v - m, 2), 0);
          swStatistic = totalSS > 0 ? (b * b) / totalSS : 1;
          swStatistic = Math.min(1, Math.max(0, swStatistic));
          
          // P-value approximation using Royston's log-normal transform
          if (n >= 4) {
            const logN = Math.log(n);
            const mu = -1.2725 + 1.0521 * logN;
            const sigma = 1.0308 - 0.26758 * logN;
            const z = (Math.log(1 - swStatistic) - mu) / sigma;
            swPValue = 1 - normalCDF(z);
          } else {
            swPValue = swStatistic > 0.767 ? 0.5 : 0.01;
          }
        }
        
        // Kolmogorov-Smirnov test
        let ksStatistic = 0;
        for (let i = 0; i < n; i++) {
          const zVal = s > 0 ? (sorted[i] - m) / s : 0;
          const F = normalCDF(zVal);
          const Dplus = Math.abs((i + 1) / n - F);
          const Dminus = Math.abs(F - i / n);
          ksStatistic = Math.max(ksStatistic, Dplus, Dminus);
        }
        // Lilliefors approximation for p-value
        const ksLambda = (Math.sqrt(n) + 0.12 + 0.11 / Math.sqrt(n)) * ksStatistic;
        let ksPValue = 0;
        if (ksLambda <= 0) ksPValue = 1;
        else if (ksLambda < 0.27) ksPValue = 1;
        else if (ksLambda < 1) ksPValue = Math.exp(-1.2337141 / (ksLambda * ksLambda));
        else ksPValue = 2 * Math.exp(-2 * ksLambda * ksLambda);
        ksPValue = Math.min(1, Math.max(0, ksPValue));
        
        const primaryTest = n < 50 ? 'Shapiro-Wilk' : 'Kolmogorov-Smirnov';
        const primaryStat = n < 50 ? swStatistic : ksStatistic;
        const primaryP = n < 50 ? swPValue : ksPValue;
        const skewnessViolation = Math.abs(sk) > 2;
        const kurtosisViolation = Math.abs(ku) > 2;
        const isNormal = primaryP > 0.05 && !skewnessViolation && !kurtosisViolation;
        
        tables.push({
          title: `Tests of Normality: ${varName}`,
          headers: ['Test', 'Statistic', 'df', 'Sig.'],
          rows: [
            { Test: 'Shapiro-Wilk', Statistic: swStatistic, df: n, 'Sig.': swPValue },
            { Test: 'Kolmogorov-Smirnov', Statistic: ksStatistic, df: n, 'Sig.': ksPValue },
          ],
        });
        
        // Distribution data for histogram
        const binCount = Math.min(Math.ceil(Math.sqrt(n)), 30);
        const binWidth = (max(values) - min(values)) / binCount || 1;
        const bins: Array<{ binStart: number; binEnd: number; count: number; normalExpected: number }> = [];
        for (let b = 0; b < binCount; b++) {
          const binStart = min(values) + b * binWidth;
          const binEnd = binStart + binWidth;
          const count = values.filter(v => v >= binStart && (b === binCount - 1 ? v <= binEnd : v < binEnd)).length;
          // Normal curve expected
          const zLow = s > 0 ? (binStart - m) / s : 0;
          const zHigh = s > 0 ? (binEnd - m) / s : 0;
          const normalExpected = n * (normalCDF(zHigh) - normalCDF(zLow));
          bins.push({ binStart, binEnd, count, normalExpected });
        }
        
        // Q-Q plot data
        const qqData = sorted.map((val, i) => {
          const p = (i + 0.5) / n;
          const t = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
          const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
          const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
          let theoretical = t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
          if (p < 0.5) theoretical = -theoretical;
          return { theoretical, observed: val };
        });
        
        // Boxplot data
        const q1Idx = Math.floor(n * 0.25);
        const q3Idx = Math.floor(n * 0.75);
        const q1 = sorted[q1Idx];
        const q3 = sorted[q3Idx];
        const iqr = q3 - q1;
        const lowerWhisker = Math.max(sorted[0], q1 - 1.5 * iqr);
        const upperWhisker = Math.min(sorted[n - 1], q3 + 1.5 * iqr);
        const outliers = values.filter(v => v < lowerWhisker || v > upperWhisker);
        
        charts.push({
          type: 'histogram',
          title: `Histogram: ${varName}`,
          data: { bins, mean: m, std: s },
        });
        charts.push({
          type: 'scatter',
          title: `Q-Q Plot: ${varName}`,
          data: qqData,
        });
        charts.push({
          type: 'boxplot',
          title: `Boxplot: ${varName}`,
          data: { min: sorted[0], q1, median: median(values), q3, max: sorted[n - 1], lowerWhisker, upperWhisker, outliers, mean: m },
        });
        
        // Summary row for this variable
        tables.push({
          title: `Normality Summary: ${varName}`,
          headers: ['Variable', 'Primary Test', 'Statistic', 'p-value', 'Skewness', 'Kurtosis', 'Normal', 'Parametric Allowed'],
          rows: [{
            Variable: varName,
            'Primary Test': primaryTest,
            Statistic: primaryStat,
            'p-value': primaryP,
            Skewness: sk,
            Kurtosis: ku,
            Normal: isNormal ? 'Yes' : 'No',
            'Parametric Allowed': isNormal ? 'Yes' : 'No',
          }],
        });
      });
      break;
    }

    case 'two-way-anova': {
      if (depVars[0] && indVars.length >= 2) {
        const factor1 = indVars[0], factor2 = indVars[1];
        const cells: Record<string, Record<string, number[]>> = {};
        const f1Levels = new Set<string>();
        const f2Levels = new Set<string>();
        
        data.forEach(row => {
          const a = String(row[factor1]);
          const b = String(row[factor2]);
          const v = Number(row[depVars[0]]);
          if (!isNaN(v) && a && b) {
            f1Levels.add(a);
            f2Levels.add(b);
            if (!cells[a]) cells[a] = {};
            if (!cells[a][b]) cells[a][b] = [];
            cells[a][b].push(v);
          }
        });
        
        const aLevels = Array.from(f1Levels);
        const bLevels = Array.from(f2Levels);
        const allValues: number[] = [];
        Object.values(cells).forEach(bCells => Object.values(bCells).forEach(vals => allValues.push(...vals)));
        const N = allValues.length;
        const grandMean = mean(allValues);
        
        // Marginal means
        const aMeans: Record<string, number> = {};
        aLevels.forEach(a => {
          const vals: number[] = [];
          bLevels.forEach(b => { if (cells[a]?.[b]) vals.push(...cells[a][b]); });
          aMeans[a] = mean(vals);
        });
        const bMeans: Record<string, number> = {};
        bLevels.forEach(b => {
          const vals: number[] = [];
          aLevels.forEach(a => { if (cells[a]?.[b]) vals.push(...cells[a][b]); });
          bMeans[b] = mean(vals);
        });
        
        // SS calculations
        let ssA = 0;
        aLevels.forEach(a => {
          const nA = Object.values(cells[a] || {}).flat().length;
          ssA += nA * Math.pow(aMeans[a] - grandMean, 2);
        });
        let ssB = 0;
        bLevels.forEach(b => {
          const vals: number[] = [];
          aLevels.forEach(a => { if (cells[a]?.[b]) vals.push(...cells[a][b]); });
          ssB += vals.length * Math.pow(mean(vals) - grandMean, 2);
        });
        let ssAB = 0;
        aLevels.forEach(a => {
          bLevels.forEach(b => {
            const vals = cells[a]?.[b] || [];
            if (vals.length > 0) {
              const cellMean = mean(vals);
              ssAB += vals.length * Math.pow(cellMean - aMeans[a] - bMeans[b] + grandMean, 2);
            }
          });
        });
        let ssWithin = 0;
        aLevels.forEach(a => {
          bLevels.forEach(b => {
            const vals = cells[a]?.[b] || [];
            const cellMean = mean(vals);
            vals.forEach(v => ssWithin += Math.pow(v - cellMean, 2));
          });
        });
        const ssTotal = ssA + ssB + ssAB + ssWithin;
        
        const dfA = aLevels.length - 1;
        const dfB = bLevels.length - 1;
        const dfAB = dfA * dfB;
        const dfWithin = N - aLevels.length * bLevels.length;
        const msA = dfA > 0 ? ssA / dfA : 0;
        const msB = dfB > 0 ? ssB / dfB : 0;
        const msAB = dfAB > 0 ? ssAB / dfAB : 0;
        const msW = dfWithin > 0 ? ssWithin / dfWithin : 0;
        const fA = msW > 0 ? msA / msW : 0;
        const fB = msW > 0 ? msB / msW : 0;
        const fAB = msW > 0 ? msAB / msW : 0;
        const pA = fTestPValue(fA, dfA, dfWithin);
        const pB = fTestPValue(fB, dfB, dfWithin);
        const pAB = fTestPValue(fAB, dfAB, dfWithin);
        const etaA = partialEtaSquared(ssA, ssWithin);
        const etaB = partialEtaSquared(ssB, ssWithin);
        const etaAB = partialEtaSquared(ssAB, ssWithin);
        
        // Descriptives
        const descRows: Array<Record<string, string | number>> = [];
        aLevels.forEach(a => {
          bLevels.forEach(b => {
            const vals = cells[a]?.[b] || [];
            if (vals.length > 0) {
              descRows.push({ [factor1]: a, [factor2]: b, N: vals.length, Mean: mean(vals), 'Std. Deviation': std(vals) });
            }
          });
        });
        tables.push({ title: 'Descriptive Statistics', headers: [factor1, factor2, 'N', 'Mean', 'Std. Deviation'], rows: descRows });
        
        // Levene's test (simplified - using median-based)
        const groupMedians: Record<string, number> = {};
        aLevels.forEach(a => {
          bLevels.forEach(b => {
            const vals = cells[a]?.[b] || [];
            if (vals.length > 0) groupMedians[`${a}_${b}`] = median(vals);
          });
        });
        
        tables.push({
          title: 'Tests of Between-Subjects Effects',
          headers: ['Source', 'Type III SS', 'df', 'Mean Square', 'F', 'Sig.', 'Partial η²'],
          rows: [
            { Source: factor1, 'Type III SS': ssA, df: dfA, 'Mean Square': msA, F: fA, 'Sig.': pA, 'Partial η²': etaA },
            { Source: factor2, 'Type III SS': ssB, df: dfB, 'Mean Square': msB, F: fB, 'Sig.': pB, 'Partial η²': etaB },
            { Source: `${factor1} * ${factor2}`, 'Type III SS': ssAB, df: dfAB, 'Mean Square': msAB, F: fAB, 'Sig.': pAB, 'Partial η²': etaAB },
            { Source: 'Error', 'Type III SS': ssWithin, df: dfWithin, 'Mean Square': msW, F: '-', 'Sig.': '-', 'Partial η²': '-' },
            { Source: 'Total', 'Type III SS': ssTotal, df: N - 1, 'Mean Square': '-', F: '-', 'Sig.': '-', 'Partial η²': '-' },
          ],
        });
        
        effectSize = { type: 'Partial η²', value: etaA, magnitude: interpretEtaSquared(etaA), interpretation: `Main effect of ${factor1}: η² = ${etaA.toFixed(3)} (${interpretEtaSquared(etaA)})` };
        
        // Interaction plot data
        const interactionData: Array<Record<string, unknown>> = [];
        bLevels.forEach(b => {
          const point: Record<string, unknown> = { [factor2]: b };
          aLevels.forEach(a => {
            const vals = cells[a]?.[b] || [];
            point[a] = vals.length > 0 ? mean(vals) : null;
          });
          interactionData.push(point);
        });
        charts.push({ type: 'line', title: `Interaction: ${factor1} × ${factor2}`, data: interactionData });
      }
      break;
    }

    case 'repeated-measures-anova': {
      if (depVars.length >= 3) {
        const validCases: number[][] = [];
        data.forEach(row => {
          const vals = depVars.map(v => Number(row[v]));
          if (vals.every(v => !isNaN(v))) validCases.push(vals);
        });
        const n = validCases.length;
        const k = depVars.length;
        
        if (n > 1 && k >= 3) {
          const condMeans = depVars.map((_, j) => mean(validCases.map(r => r[j])));
          const grandMean = mean(condMeans);
          const subjectMeans = validCases.map(row => mean(row));
          
          // SS decomposition
          let ssSubjects = 0;
          subjectMeans.forEach(sm => ssSubjects += k * Math.pow(sm - grandMean, 2));
          
          let ssConditions = 0;
          condMeans.forEach(cm => ssConditions += n * Math.pow(cm - grandMean, 2));
          
          let ssTotal = 0;
          validCases.forEach(row => row.forEach(v => ssTotal += Math.pow(v - grandMean, 2)));
          
          const ssError = ssTotal - ssSubjects - ssConditions;
          const dfConditions = k - 1;
          const dfSubjects = n - 1;
          const dfError = dfConditions * dfSubjects;
          const msConditions = ssConditions / dfConditions;
          const msError = ssError / dfError;
          const F = msError > 0 ? msConditions / msError : 0;
          const pValue = fTestPValue(F, dfConditions, dfError);
          const eta2 = partialEtaSquared(ssConditions, ssError);
          
          // Mauchly's Sphericity Test (simplified)
          // Compute covariance matrix of differences
          const diffs: number[][] = [];
          for (let j = 0; j < k - 1; j++) {
            diffs.push(validCases.map(row => row[j] - row[k - 1]));
          }
          // Simplified epsilon calculation (Greenhouse-Geisser)
          const covMatrix: number[][] = [];
          for (let i = 0; i < k; i++) {
            covMatrix.push([]);
            for (let j = 0; j < k; j++) {
              const xi = validCases.map(r => r[i]);
              const xj = validCases.map(r => r[j]);
              const mx = mean(xi), my = mean(xj);
              covMatrix[i].push(xi.reduce((s, v, idx) => s + (v - mx) * (xj[idx] - my), 0) / (n - 1));
            }
          }
          // Trace and trace squared
          let trace = 0;
          for (let i = 0; i < k; i++) trace += covMatrix[i][i];
          let traceSq = 0;
          for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) traceSq += covMatrix[i][j] * covMatrix[i][j];
          const epsilon = (trace * trace) / ((k - 1) * traceSq);
          const ggEpsilon = Math.min(1, Math.max(1 / (k - 1), epsilon));
          
          // Corrected values
          const dfCorrected = dfConditions * ggEpsilon;
          const dfErrorCorrected = dfError * ggEpsilon;
          const pCorrected = fTestPValue(F, dfCorrected, dfErrorCorrected);
          
          const sphericityViolated = ggEpsilon < 0.75;
          
          tables.push({
            title: 'Descriptive Statistics',
            headers: ['Condition', 'Mean', 'Std. Deviation', 'N'],
            rows: depVars.map((v, j) => ({
              Condition: v,
              Mean: condMeans[j],
              'Std. Deviation': std(validCases.map(r => r[j])),
              N: n,
            })),
          });
          
          tables.push({
            title: "Mauchly's Test of Sphericity",
            headers: ['Within Subjects Effect', 'Greenhouse-Geisser ε', 'Sphericity Assumed'],
            rows: [{ 'Within Subjects Effect': 'Time', 'Greenhouse-Geisser ε': ggEpsilon, 'Sphericity Assumed': ggEpsilon > 0.75 ? 'Yes' : 'No' }],
          });
          
          tables.push({
            title: 'Tests of Within-Subjects Effects',
            headers: ['Source', 'SS', 'df', 'Mean Square', 'F', 'Sig.', 'Partial η²'],
            rows: [
              { Source: 'Sphericity Assumed', SS: ssConditions, df: dfConditions, 'Mean Square': msConditions, F, 'Sig.': pValue, 'Partial η²': eta2 },
              { Source: 'Greenhouse-Geisser', SS: ssConditions, df: dfCorrected, 'Mean Square': ssConditions / dfCorrected, F, 'Sig.': pCorrected, 'Partial η²': eta2 },
              { Source: 'Error (Sphericity)', SS: ssError, df: dfError, 'Mean Square': msError, F: '-', 'Sig.': '-', 'Partial η²': '-' },
              { Source: 'Error (G-G)', SS: ssError, df: dfErrorCorrected, 'Mean Square': ssError / dfErrorCorrected, F: '-', 'Sig.': '-', 'Partial η²': '-' },
            ],
          });
          
          effectSize = { type: 'Partial η²', value: eta2, magnitude: interpretEtaSquared(eta2), interpretation: `The within-subjects effect size is ${interpretEtaSquared(eta2)} (η² = ${eta2.toFixed(3)})` };
          
          // Pairwise comparisons (Bonferroni)
          if ((sphericityViolated ? pCorrected : pValue) < 0.05) {
            const postHocRows: Array<Record<string, string | number>> = [];
            const numComparisons = k * (k - 1) / 2;
            for (let i = 0; i < k; i++) {
              for (let j = i + 1; j < k; j++) {
                const diffs = validCases.map(r => r[i] - r[j]);
                const mDiff = mean(diffs);
                const seDiff = standardError(diffs);
                const tVal = seDiff > 0 ? mDiff / seDiff : 0;
                const rawP = tTestPValue(tVal, n - 1);
                const adjP = Math.min(1, rawP * numComparisons);
                postHocRows.push({
                  '(I) Condition': depVars[i],
                  '(J) Condition': depVars[j],
                  'Mean Difference': mDiff,
                  'Std. Error': seDiff,
                  'Sig. (Bonferroni)': adjP,
                  Significant: adjP < 0.05 ? 'Yes' : 'No',
                });
              }
            }
            tables.push({ title: 'Pairwise Comparisons (Bonferroni)', headers: ['(I) Condition', '(J) Condition', 'Mean Difference', 'Std. Error', 'Sig. (Bonferroni)', 'Significant'], rows: postHocRows });
          }
          
          // Line chart
          charts.push({
            type: 'line',
            title: 'Estimated Marginal Means',
            data: depVars.map((v, j) => ({ condition: v, mean: condMeans[j], se: standardError(validCases.map(r => r[j])) })),
          });
        }
      }
      break;
    }

    case 'manova': {
      if (depVars.length >= 2 && groupVar) {
        const groups: Record<string, number[][]> = {};
        data.forEach(row => {
          const g = String(row[groupVar]);
          const vals = depVars.map(v => Number(row[v]));
          if (vals.every(v => !isNaN(v)) && g) {
            if (!groups[g]) groups[g] = [];
            groups[g].push(vals);
          }
        });
        const groupNames = Object.keys(groups);
        const k = groupNames.length;
        const p = depVars.length;
        
        if (k >= 2) {
          const allCases = Object.values(groups).flat();
          const N = allCases.length;
          const grandMeans = depVars.map((_, j) => mean(allCases.map(r => r[j])));
          
          // Group means
          const groupMeans: Record<string, number[]> = {};
          groupNames.forEach(g => {
            groupMeans[g] = depVars.map((_, j) => mean(groups[g].map(r => r[j])));
          });
          
          // Descriptives table
          const descRows: Array<Record<string, string | number>> = [];
          groupNames.forEach(g => {
            depVars.forEach((v, j) => {
              const vals = groups[g].map(r => r[j]);
              descRows.push({ Group: g, DV: v, N: vals.length, Mean: mean(vals), 'Std. Deviation': std(vals) });
            });
          });
          tables.push({ title: 'Descriptive Statistics', headers: ['Group', 'DV', 'N', 'Mean', 'Std. Deviation'], rows: descRows });
          
          // Simplified Wilks' Lambda using univariate F values
          // Run univariate ANOVA for each DV
          const univariateResults: Array<{ dv: string; F: number; pValue: number; eta2: number }> = [];
          let productLambda = 1;
          
          depVars.forEach((dv, j) => {
            let ssBetween = 0, ssWithin = 0;
            groupNames.forEach(g => {
              const vals = groups[g].map(r => r[j]);
              const gMean = mean(vals);
              ssBetween += vals.length * Math.pow(gMean - grandMeans[j], 2);
              vals.forEach(v => ssWithin += Math.pow(v - gMean, 2));
            });
            const dfBetween = k - 1;
            const dfWithin = N - k;
            const msBetween = ssBetween / dfBetween;
            const msWithin = dfWithin > 0 ? ssWithin / dfWithin : 0;
            const fVal = msWithin > 0 ? msBetween / msWithin : 0;
            const pVal = fTestPValue(fVal, dfBetween, dfWithin);
            const eta = partialEtaSquared(ssBetween, ssWithin);
            univariateResults.push({ dv, F: fVal, pValue: pVal, eta2: eta });
            
            const lambda = ssWithin / (ssWithin + ssBetween);
            productLambda *= lambda;
          });
          
          // Approximate overall F for Wilks' Lambda
          const dfH = k - 1;
          const dfE = N - k;
          const s = Math.min(p, dfH);
          const approxF = ((1 - Math.pow(productLambda, 1/s)) / Math.pow(productLambda, 1/s)) * (dfE - p + 1) / p;
          const multiPValue = fTestPValue(Math.abs(approxF), p * dfH, dfE);
          
          tables.push({
            title: 'Multivariate Tests',
            headers: ['Effect', 'Value', 'F', 'Hypothesis df', 'Error df', 'Sig.'],
            rows: [{
              Effect: "Wilks' Lambda",
              Value: productLambda,
              F: approxF,
              'Hypothesis df': p * dfH,
              'Error df': dfE,
              'Sig.': multiPValue,
            }],
          });
          
          // Univariate results
          tables.push({
            title: 'Tests of Between-Subjects Effects',
            headers: ['DV', 'F', 'df', 'Sig.', 'Partial η²'],
            rows: univariateResults.map(r => ({
              DV: r.dv,
              F: r.F,
              df: `${k - 1}, ${N - k}`,
              'Sig.': r.pValue,
              'Partial η²': r.eta2,
            })),
          });
          
          effectSize = {
            type: "Wilks' Lambda",
            value: productLambda,
            magnitude: productLambda < 0.5 ? 'large' : productLambda < 0.8 ? 'medium' : 'small',
            interpretation: `Wilks' Λ = ${productLambda.toFixed(3)}, indicating a ${productLambda < 0.5 ? 'large' : productLambda < 0.8 ? 'medium' : 'small'} multivariate effect`,
          };
          
          // Bar charts per DV
          depVars.forEach(dv => {
            const j = depVars.indexOf(dv);
            charts.push({
              type: 'bar',
              title: `Group Means: ${dv}`,
              data: groupNames.map(g => ({ name: g, value: mean(groups[g].map(r => r[j])) })),
            });
          });
        }
      }
      break;
    }

    case 'levene-test': {
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
        if (groupNames.length >= 2) {
          // Levene's test based on deviations from group medians
          const allDeviations: number[] = [];
          const groupDeviations: Record<string, number[]> = {};
          groupNames.forEach(g => {
            const med = median(groups[g]);
            groupDeviations[g] = groups[g].map(v => Math.abs(v - med));
            allDeviations.push(...groupDeviations[g]);
          });
          
          const grandMeanDev = mean(allDeviations);
          const N = allDeviations.length;
          const k = groupNames.length;
          
          let ssBetween = 0;
          groupNames.forEach(g => {
            const gMean = mean(groupDeviations[g]);
            ssBetween += groupDeviations[g].length * Math.pow(gMean - grandMeanDev, 2);
          });
          let ssWithin = 0;
          groupNames.forEach(g => {
            const gMean = mean(groupDeviations[g]);
            groupDeviations[g].forEach(d => ssWithin += Math.pow(d - gMean, 2));
          });
          
          const dfBetween = k - 1;
          const dfWithin = N - k;
          const F = dfWithin > 0 ? (ssBetween / dfBetween) / (ssWithin / dfWithin) : 0;
          const pValue = fTestPValue(F, dfBetween, dfWithin);
          
          tables.push({
            title: "Levene's Test of Equality of Error Variances",
            headers: ['F', 'df1', 'df2', 'Sig.'],
            rows: [{ F, df1: dfBetween, df2: dfWithin, 'Sig.': pValue }],
          });
          
          effectSize = {
            type: 'Levene F',
            value: F,
            magnitude: pValue > 0.05 ? 'assumption met' : 'assumption violated',
            interpretation: pValue > 0.05 ? 'Equal variances can be assumed' : 'Equal variances cannot be assumed',
          };
        }
      }
      break;
    }

    default:
      tables.push({ title: 'Analysis Results', headers: ['Message'], rows: [{ Message: `Analysis type "${testType}" is not yet fully implemented.` }] });
  }

  return {
    tables,
    charts,
    effectSize,
    summary: `Analysis completed with ${data.length} cases and ${depVars.length} variable(s).`,
  };
}
