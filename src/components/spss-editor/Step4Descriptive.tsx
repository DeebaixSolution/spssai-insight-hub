import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BarChart3, Activity, FileText, Loader2, AlertTriangle, CheckCircle, ChevronDown, HelpCircle, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Line, ComposedChart, ReferenceLine } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Variable } from '@/types/analysis';
import type { ParsedDataset } from '@/hooks/useAnalysisWizard';

interface Step4DescriptiveProps {
  variables: Variable[];
  parsedData: ParsedDataset | null;
  analysisId: string | null;
  onComplete: (results: DescriptiveResults) => void;
}

export interface DescriptiveResults {
  descriptives: DescriptiveStats[];
  frequencies: FrequencyTable[];
  normalityTests: NormalityResult[];
  reportText: string;
  visualDiagnostics?: VisualDiagnostics[];
}

interface DescriptiveStats {
  variable: string;
  n: number;
  mean: number;
  sd: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  skewness: number;
  kurtosis: number;
}

interface FrequencyTable {
  variable: string;
  categories: { value: string; frequency: number; percent: number; validPercent: number; cumulative: number }[];
}

interface NormalityResult {
  variable: string;
  test: string;
  statistic: number;
  df: number;
  sig: number;
  isNormal: boolean;
  skewnessViolation: boolean;
  kurtosisViolation: boolean;
  parametricAllowed: boolean;
}

interface VisualDiagnostics {
  variable: string;
  histogram: { bins: Array<{ binStart: number; binEnd: number; count: number; normalExpected: number }>; mean: number; std: number };
  qqPlot: Array<{ theoretical: number; observed: number }>;
  boxplot: { min: number; q1: number; median: number; q3: number; max: number; lowerWhisker: number; upperWhisker: number; outliers: number[]; mean: number };
}

export function Step4Descriptive({ variables, parsedData, analysisId, onComplete }: Step4DescriptiveProps) {
  const [activeTab, setActiveTab] = useState('descriptive');
  const [isComputing, setIsComputing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState<DescriptiveResults | null>(null);
  const [educationOpen, setEducationOpen] = useState(false);

  const scaleVars = variables.filter(v => v.measure === 'scale');
  const categoricalVars = variables.filter(v => v.measure === 'nominal' || v.measure === 'ordinal');

  const handleCompute = async () => {
    if (!parsedData) return;
    setIsComputing(true);

    try {
      // ===== CLIENT-SIDE: Descriptive statistics =====
      const descriptives: DescriptiveStats[] = scaleVars.map(v => {
        const values = parsedData.rows.map(r => Number(r[v.name])).filter(n => !isNaN(n));
        const n = values.length;
        const mean = values.reduce((a, b) => a + b, 0) / n;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
        const sd = Math.sqrt(variance);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const sorted = [...values].sort((a, b) => a - b);
        const skewness = n < 3 ? 0 : (n / ((n - 1) * (n - 2))) * values.reduce((a, b) => a + Math.pow((b - mean) / sd, 3), 0);
        const kurtosis = n < 4 ? 0 : ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * values.reduce((a, b) => a + Math.pow((b - mean) / sd, 4), 0) - (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
        return { variable: v.name, n, mean, sd, variance, min, max, range: max - min, skewness, kurtosis };
      });

      // ===== CLIENT-SIDE: Frequencies =====
      const frequencies: FrequencyTable[] = categoricalVars.map(v => {
        const counts: Record<string, number> = {};
        let total = 0;
        parsedData.rows.forEach(r => {
          const val = String(r[v.name] ?? '');
          if (val) { counts[val] = (counts[val] || 0) + 1; total++; }
        });
        let cumulative = 0;
        const categories = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([value, frequency]) => {
          const percent = (frequency / parsedData.rows.length) * 100;
          const validPercent = (frequency / total) * 100;
          cumulative += validPercent;
          return { value, frequency, percent, validPercent, cumulative };
        });
        return { variable: v.name, categories };
      });

      // ===== SERVER-SIDE: Normality testing via edge function =====
      let normalityTests: NormalityResult[] = [];
      let visualDiagnostics: VisualDiagnostics[] = [];

      if (scaleVars.length > 0) {
        const { data: normData, error: normError } = await supabase.functions.invoke('run-analysis', {
          body: {
            testType: 'normality-test',
            dependentVariables: scaleVars.map(v => v.name),
            independentVariables: [],
            data: parsedData.rows,
          },
        });

        if (normError) throw new Error('Normality test failed: ' + normError.message);

        const normResults = normData.results;

        // Parse normality results from edge function response
        scaleVars.forEach((v, i) => {
          // Find the summary table for this variable
          const summaryTable = normResults.tables.find((t: any) => t.title === `Normality Summary: ${v.name}`);
          const testTable = normResults.tables.find((t: any) => t.title === `Tests of Normality: ${v.name}`);

          if (summaryTable && summaryTable.rows.length > 0) {
            const row = summaryTable.rows[0];
            normalityTests.push({
              variable: v.name,
              test: String(row['Primary Test']),
              statistic: Number(row['Statistic']),
              df: descriptives.find(d => d.variable === v.name)?.n || 0,
              sig: Number(row['p-value']),
              isNormal: row['Normal'] === 'Yes',
              skewnessViolation: Math.abs(descriptives.find(d => d.variable === v.name)?.skewness || 0) > 2,
              kurtosisViolation: Math.abs(descriptives.find(d => d.variable === v.name)?.kurtosis || 0) > 2,
              parametricAllowed: row['Parametric Allowed'] === 'Yes',
            });
          }

          // Parse visual diagnostic data
          const histChart = normResults.charts.find((c: any) => c.title === `Histogram: ${v.name}`);
          const qqChart = normResults.charts.find((c: any) => c.title === `Q-Q Plot: ${v.name}`);
          const boxChart = normResults.charts.find((c: any) => c.title === `Boxplot: ${v.name}`);

          if (histChart && qqChart && boxChart) {
            visualDiagnostics.push({
              variable: v.name,
              histogram: histChart.data as any,
              qqPlot: qqChart.data as any,
              boxplot: boxChart.data as any,
            });
          }
        });
      }

      // ===== Template-based report =====
      const reportParts: string[] = [];
      reportParts.push('4.1 Descriptive Statistics\n');
      descriptives.forEach(d => {
        const skewInterp = Math.abs(d.skewness) < 1 ? 'an approximately symmetric distribution' :
          d.skewness > 0 ? 'a positively skewed distribution' : 'a negatively skewed distribution';
        reportParts.push(
          `The mean of ${d.variable} was ${d.mean.toFixed(2)} (SD = ${d.sd.toFixed(2)}), with values ranging from ${d.min.toFixed(2)} to ${d.max.toFixed(2)}. The distribution showed a skewness of ${d.skewness.toFixed(2)} and kurtosis of ${d.kurtosis.toFixed(2)}, indicating ${skewInterp}.`
        );
      });
      frequencies.forEach(f => {
        if (f.categories.length > 0) {
          const top = f.categories[0];
          const second = f.categories[1];
          reportParts.push(
            `The majority of respondents were classified as "${top.value}" (${top.validPercent.toFixed(1)}%)${second ? `, followed by "${second.value}" (${second.validPercent.toFixed(1)}%)` : ''}.`
          );
        }
      });
      reportParts.push('\n4.2 Normality Testing\n');
      normalityTests.forEach(nt => {
        const testLabel = nt.test === 'Shapiro-Wilk' ? 'W' : 'D';
        const pFormatted = nt.sig < 0.001 ? '< .001' : nt.sig.toFixed(3);
        if (nt.isNormal) {
          reportParts.push(
            `The ${nt.test} test indicated that ${nt.variable} was normally distributed (${testLabel} = ${nt.statistic.toFixed(3)}, p = ${pFormatted}), suggesting that parametric tests may be applied.`
          );
        } else {
          reportParts.push(
            `The ${nt.test} test revealed a significant deviation from normality for ${nt.variable} (${testLabel} = ${nt.statistic.toFixed(3)}, p = ${pFormatted}), indicating that non-parametric alternatives should be considered.`
          );
        }
      });

      const computed: DescriptiveResults = { descriptives, frequencies, normalityTests, reportText: reportParts.join('\n\n'), visualDiagnostics };
      setResults(computed);
      onComplete(computed);

      // ===== Save to database =====
      if (analysisId) {
        await saveToDatabase(analysisId, computed);
      }

      toast.success('Descriptive & normality analysis completed!');
    } catch (err) {
      console.error('Computation error:', err);
      toast.error('Analysis failed. Please try again.');
    } finally {
      setIsComputing(false);
    }
  };

  const saveToDatabase = async (analysisId: string, computed: DescriptiveResults) => {
    setIsSaving(true);
    try {
      // Save normality assumptions
      if (computed.normalityTests.length > 0) {
        // Delete existing
        await supabase.from('analysis_assumptions').delete().eq('analysis_id', analysisId);

        const assumptionRecords = computed.normalityTests.map(nt => ({
          analysis_id: analysisId,
          variable_name: nt.variable,
          normality_status: nt.isNormal,
          test_used: nt.test,
          statistic: nt.statistic,
          p_value: nt.sig,
          skewness: computed.descriptives.find(d => d.variable === nt.variable)?.skewness || 0,
          kurtosis: computed.descriptives.find(d => d.variable === nt.variable)?.kurtosis || 0,
          skewness_violation: nt.skewnessViolation,
          kurtosis_violation: nt.kurtosisViolation,
          parametric_allowed: nt.parametricAllowed,
          sample_size: nt.df,
        }));

        const { error } = await supabase.from('analysis_assumptions').insert(assumptionRecords);
        if (error) console.error('Failed to save assumptions:', error);
      }

      // Save analysis blocks (descriptive tables)
      const blocks: any[] = [];
      if (computed.descriptives.length > 0) {
        blocks.push({
          analysis_id: analysisId,
          section: 'descriptives',
          section_id: 'descriptive-stats',
          test_type: 'descriptives',
          test_category: 'descriptive',
          dependent_variables: computed.descriptives.map(d => d.variable),
          independent_variables: [],
          config: {},
          results: { tables: [{ title: 'Descriptive Statistics', headers: ['Variable', 'N', 'Mean', 'SD', 'Variance', 'Min', 'Max', 'Range', 'Skewness', 'Kurtosis'], rows: computed.descriptives }], charts: [], summary: '' },
          narrative: { sectionHeading: '4.1 Descriptive Statistics', introduction: '', tableTitle: 'Table 4.1: Descriptive Statistics', tableInterpretation: '' },
          display_order: 0,
          status: 'completed',
        });
      }
      computed.frequencies.forEach((f, i) => {
        blocks.push({
          analysis_id: analysisId,
          section: 'descriptives',
          section_id: `frequency-${f.variable}`,
          test_type: 'frequencies',
          test_category: 'descriptive',
          dependent_variables: [f.variable],
          independent_variables: [],
          config: {},
          results: { tables: [{ title: `Frequency Distribution: ${f.variable}`, headers: ['Category', 'Frequency', 'Percent', 'Valid %', 'Cumulative %'], rows: f.categories }], charts: [], summary: '' },
          narrative: { sectionHeading: '', introduction: '', tableTitle: `Table 4.${i + 2}: Frequency Distribution for ${f.variable}`, tableInterpretation: '' },
          display_order: i + 1,
          status: 'completed',
        });
      });

      if (blocks.length > 0) {
        // Delete existing descriptive blocks
        await supabase.from('analysis_blocks').delete().eq('analysis_id', analysisId).eq('section', 'descriptives');
        const { error } = await supabase.from('analysis_blocks').insert(blocks);
        if (error) console.error('Failed to save analysis blocks:', error);
      }

      // Update analysis state
      const { data: existingState } = await supabase.from('analysis_state').select().eq('analysis_id', analysisId).single();
      if (existingState) {
        await supabase.from('analysis_state').update({ step_4_completed: true }).eq('analysis_id', analysisId);
      } else {
        await supabase.from('analysis_state').insert({ analysis_id: analysisId, step_4_completed: true });
      }
    } catch (err) {
      console.error('DB save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const parametricBlocked = results?.normalityTests.some(nt => !nt.parametricAllowed) || false;
  const allNormal = results?.normalityTests.every(nt => nt.isNormal) || false;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Step 4: Descriptive & Normality Analysis</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {scaleVars.length} scale variable(s), {categoricalVars.length} categorical variable(s) detected
          </p>
        </div>
        <div className="flex items-center gap-2">
          {results && (
            <Badge variant={allNormal ? 'default' : 'destructive'} className="text-xs">
              {allNormal ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
              {allNormal ? 'Parametric OK' : 'Normality Issues'}
            </Badge>
          )}
          <Button onClick={handleCompute} disabled={isComputing || !parsedData} variant="hero">
            {isComputing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Computing...</>
            ) : results ? 'Recompute' : 'Run Analysis'}
          </Button>
        </div>
      </div>

      {/* Warning banner */}
      {results && parametricBlocked && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">Normality Violation Detected</p>
            <p className="text-xs text-muted-foreground mt-1">
              {results.normalityTests.filter(nt => !nt.parametricAllowed).map(nt => nt.variable).join(', ')} violate normality assumptions. Non-parametric alternatives will be recommended in Steps 5-7.
            </p>
          </div>
        </div>
      )}

      {/* Educational tooltips */}
      <Collapsible open={educationOpen} onOpenChange={setEducationOpen} className="mb-4">
        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>What are Descriptive Statistics & Normality?</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${educationOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <p><strong>Descriptive Statistics</strong> summarize your data — mean, standard deviation, range. They help you understand the central tendency and spread.</p>
          <p><strong>Normality Testing</strong> checks if your data follows a bell-shaped curve. If p &gt; .05, data is considered normal. Shapiro-Wilk is used for N &lt; 50, Kolmogorov-Smirnov for larger samples.</p>
          <p><strong>Why it matters:</strong> Parametric tests (t-tests, ANOVA) require normally distributed data. If normality is violated, you should use non-parametric alternatives.</p>
        </CollapsibleContent>
      </Collapsible>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="descriptive" className="gap-1.5">
            <BarChart3 className="w-4 h-4" />Descriptive Statistics
          </TabsTrigger>
          <TabsTrigger value="normality" className="gap-1.5">
            <Activity className="w-4 h-4" />Normality Testing
          </TabsTrigger>
          <TabsTrigger value="report" className="gap-1.5">
            <FileText className="w-4 h-4" />Reporting Preview
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB A: DESCRIPTIVE STATISTICS ===== */}
        <TabsContent value="descriptive" className="mt-4">
          {results ? (
            <div className="space-y-6">
              {results.descriptives.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Table 4.1: Descriptive Statistics for Scale Variables</h3>
                  <div className="spss-table-container">
                    <ScrollArea className="w-full">
                      <table className="spss-table-academic">
                        <thead>
                          <tr>
                            <th>Variable</th><th className="text-right">N</th><th className="text-right">Range</th>
                            <th className="text-right">Min</th><th className="text-right">Max</th><th className="text-right">Mean</th>
                            <th className="text-right">SD</th><th className="text-right">Variance</th>
                            <th className="text-right">Skewness</th><th className="text-right">Kurtosis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.descriptives.map(d => (
                            <tr key={d.variable}>
                              <td className="font-medium">{d.variable}</td>
                              <td className="text-right font-mono">{d.n}</td>
                              <td className="text-right font-mono">{d.range.toFixed(2)}</td>
                              <td className="text-right font-mono">{d.min.toFixed(2)}</td>
                              <td className="text-right font-mono">{d.max.toFixed(2)}</td>
                              <td className="text-right font-mono">{d.mean.toFixed(2)}</td>
                              <td className="text-right font-mono">{d.sd.toFixed(2)}</td>
                              <td className="text-right font-mono">{d.variance.toFixed(2)}</td>
                              <td className="text-right font-mono">
                                <span className={Math.abs(d.skewness) > 2 ? 'text-destructive font-semibold' : ''}>{d.skewness.toFixed(2)}</span>
                              </td>
                              <td className="text-right font-mono">
                                <span className={Math.abs(d.kurtosis) > 2 ? 'text-destructive font-semibold' : ''}>{d.kurtosis.toFixed(2)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>
                </div>
              )}
              {results.frequencies.map((f, i) => (
                <div key={f.variable}>
                  <h3 className="text-sm font-semibold mb-2">
                    Table 4.{results.descriptives.length > 0 ? i + 2 : i + 1}: Frequency Distribution for {f.variable}
                  </h3>
                  <div className="spss-table-container">
                    <table className="spss-table-academic">
                      <thead>
                        <tr><th>Category</th><th className="text-right">Frequency</th><th className="text-right">Percent</th><th className="text-right">Valid %</th><th className="text-right">Cumulative %</th></tr>
                      </thead>
                      <tbody>
                        {f.categories.map(c => (
                          <tr key={c.value}>
                            <td>{c.value}</td>
                            <td className="text-right font-mono">{c.frequency}</td>
                            <td className="text-right font-mono">{c.percent.toFixed(1)}</td>
                            <td className="text-right font-mono">{c.validPercent.toFixed(1)}</td>
                            <td className="text-right font-mono">{c.cumulative.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Click "Run Analysis" to compute descriptive statistics</p>
            </div>
          )}
        </TabsContent>

        {/* ===== TAB B: NORMALITY TESTING ===== */}
        <TabsContent value="normality" className="mt-4">
          {results && results.normalityTests.length > 0 ? (
            <div className="space-y-6">
              {/* Normality table */}
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Table 4.{(results.descriptives.length > 0 ? 1 : 0) + results.frequencies.length + 1}: Tests of Normality
                </h3>
                <div className="spss-table-container">
                  <ScrollArea className="w-full">
                    <table className="spss-table-academic">
                      <thead>
                        <tr><th>Variable</th><th>Test</th><th className="text-right">Statistic</th><th className="text-right">df</th><th className="text-right">Sig.</th><th>Status</th><th>Parametric</th></tr>
                      </thead>
                      <tbody>
                        {results.normalityTests.map(nt => (
                          <tr key={nt.variable}>
                            <td className="font-medium">{nt.variable}</td>
                            <td>{nt.test}</td>
                            <td className="text-right font-mono">{nt.statistic.toFixed(3)}</td>
                            <td className="text-right font-mono">{nt.df}</td>
                            <td className="text-right font-mono">{nt.sig < 0.001 ? '< .001' : nt.sig.toFixed(3)}</td>
                            <td><Badge variant={nt.isNormal ? 'default' : 'destructive'} className="text-xs">{nt.isNormal ? 'Normal' : 'Non-Normal'}</Badge></td>
                            <td><Badge variant={nt.parametricAllowed ? 'outline' : 'destructive'} className="text-xs">{nt.parametricAllowed ? 'Allowed' : 'Blocked'}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground mt-2">* Normality assumed when p &gt; .05 and |Skewness| &lt; 2 and |Kurtosis| &lt; 2</p>
                </div>
              </div>

              {/* Visual Diagnostics */}
              {results.visualDiagnostics && results.visualDiagnostics.map(vd => (
                <div key={vd.variable} className="space-y-4">
                  <h4 className="text-sm font-semibold border-b border-border pb-1">Visual Diagnostics: {vd.variable}</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Histogram */}
                    <div className="bg-card border border-border rounded-lg p-3">
                      <p className="text-xs font-medium mb-2 text-center">Histogram with Normal Curve</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={vd.histogram.bins.map(b => ({ name: ((b.binStart + b.binEnd) / 2).toFixed(1), count: b.count, normal: b.normalExpected }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ fontSize: 11 }} />
                          <Bar dataKey="count" fill="hsl(var(--accent))" opacity={0.7} name="Observed" />
                          <Line type="monotone" dataKey="normal" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name="Normal Curve" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Q-Q Plot */}
                    <div className="bg-card border border-border rounded-lg p-3">
                      <p className="text-xs font-medium mb-2 text-center">Normal Q-Q Plot</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" dataKey="theoretical" name="Expected" tick={{ fontSize: 10 }} />
                          <YAxis type="number" dataKey="observed" name="Observed" tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ fontSize: 11 }} />
                          <Scatter data={vd.qqPlot} fill="hsl(var(--primary))" r={2} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Boxplot representation */}
                    <div className="bg-card border border-border rounded-lg p-3">
                      <p className="text-xs font-medium mb-2 text-center">Boxplot Summary</p>
                      <div className="flex flex-col items-center justify-center h-[200px] text-xs space-y-1">
                        <div className="w-full max-w-[120px] space-y-1">
                          <div className="flex justify-between"><span className="text-muted-foreground">Max:</span><span className="font-mono">{vd.boxplot.max.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Upper W:</span><span className="font-mono">{vd.boxplot.upperWhisker.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Q3:</span><span className="font-mono">{vd.boxplot.q3.toFixed(2)}</span></div>
                          <div className="flex justify-between font-semibold"><span>Median:</span><span className="font-mono">{vd.boxplot.median.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Mean:</span><span className="font-mono">{vd.boxplot.mean.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Q1:</span><span className="font-mono">{vd.boxplot.q1.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Lower W:</span><span className="font-mono">{vd.boxplot.lowerWhisker.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Min:</span><span className="font-mono">{vd.boxplot.min.toFixed(2)}</span></div>
                          {vd.boxplot.outliers.length > 0 && (
                            <div className="text-destructive font-medium mt-1">{vd.boxplot.outliers.length} outlier(s)</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Normality tests will appear here for scale variables after computation</p>
            </div>
          )}
        </TabsContent>

        {/* ===== TAB C: REPORTING ===== */}
        <TabsContent value="report" className="mt-4">
          {results ? (
            <div className="prose prose-sm max-w-none bg-card border border-border rounded-lg p-6">
              {results.reportText.split('\n\n').map((paragraph, i) => {
                if (paragraph.startsWith('4.')) {
                  return <h3 key={i} className="text-base font-semibold mb-3 mt-4">{paragraph}</h3>;
                }
                return <p key={i} className="text-sm leading-relaxed text-foreground/90 mb-3">{paragraph}</p>;
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Report preview will appear after running the analysis</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
