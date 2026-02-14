import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FlaskConical, Loader2, AlertTriangle, CheckCircle, ChevronDown, ShieldCheck, BarChart3, FileText, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Variable, Hypothesis } from '@/types/analysis';
import type { ParsedDataset } from '@/hooks/useAnalysisWizard';

interface Step5ParametricProps {
  variables: Variable[];
  parsedData: ParsedDataset | null;
  analysisId: string | null;
  hypotheses: Hypothesis[];
  onHypothesisUpdate?: (id: string, status: 'supported' | 'rejected') => void;
}

interface AssumptionData {
  variable_name: string;
  normality_status: boolean;
  parametric_allowed: boolean;
  test_used: string;
  p_value: number;
}

type TestType = 'one-sample-t-test' | 'independent-t-test' | 'paired-t-test' | 'one-way-anova';

interface TestResult {
  tables: Array<{ title: string; headers: string[]; rows: Array<Record<string, string | number>> }>;
  charts: Array<{ type: string; data: any; title: string }>;
  effectSize?: { type: string; value: number; magnitude: string; interpretation: string };
  summary: string;
  pValue?: number;
  decision?: string;
}

export function Step5Parametric({ variables, parsedData, analysisId, hypotheses, onHypothesisUpdate }: Step5ParametricProps) {
  const [selectedTest, setSelectedTest] = useState<TestType | ''>('');
  const [assumptions, setAssumptions] = useState<AssumptionData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult | null>(null);
  const [selectedDV, setSelectedDV] = useState('');
  const [selectedIV, setSelectedIV] = useState('');
  const [selectedPair1, setSelectedPair1] = useState('');
  const [selectedPair2, setSelectedPair2] = useState('');
  const [testValue, setTestValue] = useState('0');
  const [linkedHypothesis, setLinkedHypothesis] = useState('');

  const scaleVars = useMemo(() => variables.filter(v => v.measure === 'scale'), [variables]);
  const groupingVars = useMemo(() => variables.filter(v => v.measure === 'nominal' || v.measure === 'ordinal'), [variables]);

  // Load assumptions from DB
  useEffect(() => {
    if (!analysisId) return;
    supabase.from('analysis_assumptions').select('*').eq('analysis_id', analysisId)
      .then(({ data }) => { if (data) setAssumptions(data as AssumptionData[]); });
  }, [analysisId]);

  const getAssumption = (varName: string) => assumptions.find(a => a.variable_name === varName);

  // Rule engine: check if test is allowed
  const testAvailability = useMemo(() => {
    const dvAssumption = selectedDV ? getAssumption(selectedDV) : null;
    const dvBlocked = dvAssumption ? !dvAssumption.parametric_allowed : false;

    // Count unique groups for grouping variable
    let groupCount = 0;
    if (selectedIV && parsedData) {
      const uniqueGroups = new Set(parsedData.rows.map(r => String(r[selectedIV])).filter(Boolean));
      groupCount = uniqueGroups.size;
    }

    return {
      'one-sample-t-test': { enabled: scaleVars.length > 0, reason: scaleVars.length === 0 ? 'No scale variables available' : '' },
      'independent-t-test': { enabled: scaleVars.length > 0 && groupingVars.length > 0, reason: groupingVars.length === 0 ? 'No grouping variable available' : '' },
      'paired-t-test': { enabled: scaleVars.length >= 2, reason: scaleVars.length < 2 ? 'Need at least 2 scale variables' : '' },
      'one-way-anova': { enabled: scaleVars.length > 0 && groupingVars.length > 0, reason: groupingVars.length === 0 ? 'No grouping variable available' : '' },
      dvBlocked,
      groupCount,
    };
  }, [scaleVars, groupingVars, selectedDV, selectedIV, parsedData, assumptions]);

  const runTest = async () => {
    if (!parsedData || !selectedTest) return;
    setIsRunning(true);

    try {
      let depVars: string[] = [];
      let indVars: string[] = [];
      let groupVar: string | undefined;
      const options: Record<string, unknown> = {};

      switch (selectedTest) {
        case 'one-sample-t-test':
          depVars = [selectedDV];
          options.testValue = Number(testValue);
          break;
        case 'independent-t-test':
          depVars = [selectedDV];
          groupVar = selectedIV;
          break;
        case 'paired-t-test':
          depVars = [selectedPair1, selectedPair2];
          break;
        case 'one-way-anova':
          depVars = [selectedDV];
          groupVar = selectedIV;
          break;
      }

      // Also run Levene's test for independent t-test
      let leveneResult: TestResult | null = null;
      if (selectedTest === 'independent-t-test' && groupVar) {
        const { data: levData } = await supabase.functions.invoke('run-analysis', {
          body: { testType: 'levene-test', dependentVariables: depVars, independentVariables: [], groupingVariable: groupVar, data: parsedData.rows },
        });
        if (levData) leveneResult = levData.results;
      }

      const { data, error } = await supabase.functions.invoke('run-analysis', {
        body: { testType: selectedTest, dependentVariables: depVars, independentVariables: indVars, groupingVariable: groupVar, data: parsedData.rows, options },
      });

      if (error) throw new Error(error.message);

      const result: TestResult = data.results;

      // Merge Levene's result
      if (leveneResult) {
        result.tables = [...(leveneResult.tables || []), ...result.tables];
      }

      // Extract p-value from main test table
      let pValue: number | undefined;
      result.tables.forEach(t => {
        t.rows.forEach(r => {
          const sig = r['Sig. (2-tailed)'] ?? r['Sig.'];
          if (typeof sig === 'number' && sig >= 0 && sig <= 1) {
            if (pValue === undefined || sig < pValue) pValue = sig;
          }
        });
      });

      const decision = pValue !== undefined && pValue < 0.05 ? 'Reject H₀' : 'Fail to Reject H₀';
      result.pValue = pValue;
      result.decision = decision;

      setResults(result);

      // Save to DB
      if (analysisId) {
        const block = {
          analysis_id: analysisId,
          section: 'hypothesis' as const,
          section_id: linkedHypothesis || `parametric-${selectedTest}`,
          test_type: selectedTest,
          test_category: 'compare-means',
          dependent_variables: depVars,
          independent_variables: indVars,
          grouping_variable: groupVar || null,
          linked_hypothesis_id: linkedHypothesis || null,
          config: JSON.parse(JSON.stringify({ options })),
          results: JSON.parse(JSON.stringify(result)),
          narrative: JSON.parse(JSON.stringify({ sectionHeading: '', introduction: '', tableTitle: '', tableInterpretation: generateAcademicReport(selectedTest, result) })),
          display_order: 0,
          status: 'completed',
        };

        await supabase.from('analysis_blocks').delete().eq('analysis_id', analysisId).eq('test_type', selectedTest);
        await supabase.from('analysis_blocks').insert([block]);

        // Update hypothesis status
        if (linkedHypothesis && pValue !== undefined) {
          const status = pValue < 0.05 ? 'supported' : 'rejected';
          await supabase.from('hypotheses').update({ status }).eq('id', linkedHypothesis);
          onHypothesisUpdate?.(linkedHypothesis, status as any);
        }

        // Update analysis state
        const { data: stateData } = await supabase.from('analysis_state').select().eq('analysis_id', analysisId).single();
        if (stateData) {
          await supabase.from('analysis_state').update({ step_5_completed: true, parametric_executed: true }).eq('analysis_id', analysisId);
        } else {
          await supabase.from('analysis_state').insert({ analysis_id: analysisId, step_5_completed: true, parametric_executed: true });
        }
      }

      toast.success('Parametric test completed!');
    } catch (err) {
      console.error('Test error:', err);
      toast.error('Test failed. Please try again.');
    } finally {
      setIsRunning(false);
    }
  };

  const generateAcademicReport = (test: TestType, result: TestResult): string => {
    const es = result.effectSize;
    const p = result.pValue;
    const sig = p !== undefined && p < 0.05 ? 'statistically significant' : 'not statistically significant';
    const pStr = p !== undefined ? (p < 0.001 ? '< .001' : `= ${p.toFixed(3)}`) : '';

    switch (test) {
      case 'one-sample-t-test': {
        const row = result.tables.find(t => t.title === 'One-Sample Test')?.rows[0];
        if (!row) return '';
        return `A one-sample t-test was conducted to determine whether ${selectedDV} differed from ${testValue}. The result was ${sig}, t(${row['df']}) = ${Number(row['t']).toFixed(3)}, p ${pStr}${es ? `, Cohen's d = ${es.value.toFixed(3)} (${es.magnitude})` : ''}.`;
      }
      case 'independent-t-test': {
        const row = result.tables.find(t => t.title === 'Independent Samples Test')?.rows[0];
        if (!row) return '';
        return `An independent samples t-test was conducted to compare ${selectedDV} between groups. There was a ${sig} difference, t(${row['df']}) = ${Number(row['t']).toFixed(3)}, p ${pStr}, 95% CI [${Number(row['95% CI Lower']).toFixed(2)}, ${Number(row['95% CI Upper']).toFixed(2)}]${es ? `, Cohen's d = ${es.value.toFixed(3)} (${es.magnitude})` : ''}.`;
      }
      case 'paired-t-test': {
        const row = result.tables.find(t => t.title === 'Paired Samples Test')?.rows[0];
        if (!row) return '';
        return `A paired samples t-test was conducted to compare ${selectedPair1} and ${selectedPair2}. There was a ${sig} difference, t(${row['df']}) = ${Number(row['t']).toFixed(3)}, p ${pStr}${es ? `, Cohen's d = ${es.value.toFixed(3)} (${es.magnitude})` : ''}.`;
      }
      case 'one-way-anova': {
        const row = result.tables.find(t => t.title === 'ANOVA')?.rows[0];
        if (!row) return '';
        return `A one-way ANOVA revealed a ${sig} difference between groups, F(${row['df']}, ${result.tables.find(t => t.title === 'ANOVA')?.rows[1]?.['df'] || ''}) = ${Number(row['F']).toFixed(2)}, p ${pStr}${es ? `, η² = ${es.value.toFixed(3)} (${es.magnitude})` : ''}.`;
      }
      default: return '';
    }
  };

  const canRun = selectedTest && (
    (selectedTest === 'one-sample-t-test' && selectedDV) ||
    (selectedTest === 'independent-t-test' && selectedDV && selectedIV) ||
    (selectedTest === 'paired-t-test' && selectedPair1 && selectedPair2 && selectedPair1 !== selectedPair2) ||
    (selectedTest === 'one-way-anova' && selectedDV && selectedIV)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Step 5: Parametric Inferential Engine</h2>
          <p className="text-sm text-muted-foreground mt-1">Select and run parametric tests connected to Step 4 assumptions</p>
        </div>
      </div>

      {/* Assumption Status */}
      {assumptions.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" />Normality Status from Step 4</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex flex-wrap gap-2">
              {assumptions.map(a => (
                <Badge key={a.variable_name} variant={a.parametric_allowed ? 'outline' : 'destructive'} className="text-xs">
                  {a.parametric_allowed ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                  {a.variable_name}: {a.parametric_allowed ? 'Parametric OK' : 'Non-Normal'}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Selection */}
      <Card>
        <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Panel 1 — Test Selection</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {(['one-sample-t-test', 'independent-t-test', 'paired-t-test', 'one-way-anova'] as TestType[]).map(test => {
              const avail = testAvailability[test];
              const labels: Record<TestType, string> = { 'one-sample-t-test': 'One-Sample T', 'independent-t-test': 'Independent T', 'paired-t-test': 'Paired T', 'one-way-anova': 'One-Way ANOVA' };
              return (
                <Button key={test} variant={selectedTest === test ? 'default' : 'outline'} size="sm" className="text-xs justify-start"
                  disabled={!avail.enabled} onClick={() => { setSelectedTest(test); setResults(null); }}>
                  {!avail.enabled && <Lock className="w-3 h-3 mr-1" />}
                  {labels[test]}
                </Button>
              );
            })}
          </div>

          {/* Variable selectors */}
          {selectedTest && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {(selectedTest === 'one-sample-t-test' || selectedTest === 'independent-t-test' || selectedTest === 'one-way-anova') && (
                <div>
                  <label className="text-xs font-medium mb-1 block">Dependent Variable (Scale)</label>
                  <Select value={selectedDV} onValueChange={setSelectedDV}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select DV" /></SelectTrigger>
                    <SelectContent>{scaleVars.map(v => <SelectItem key={v.name} value={v.name} className="text-xs">{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {selectedDV && getAssumption(selectedDV) && !getAssumption(selectedDV)!.parametric_allowed && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Normality violated — consider non-parametric alternative</p>
                  )}
                </div>
              )}
              {selectedTest === 'one-sample-t-test' && (
                <div>
                  <label className="text-xs font-medium mb-1 block">Test Value</label>
                  <Input type="number" value={testValue} onChange={e => setTestValue(e.target.value)} className="h-8 text-xs" />
                </div>
              )}
              {(selectedTest === 'independent-t-test' || selectedTest === 'one-way-anova') && (
                <div>
                  <label className="text-xs font-medium mb-1 block">Grouping Variable</label>
                  <Select value={selectedIV} onValueChange={setSelectedIV}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select IV" /></SelectTrigger>
                    <SelectContent>{groupingVars.map(v => <SelectItem key={v.name} value={v.name} className="text-xs">{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {selectedTest === 'paired-t-test' && (
                <>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Variable 1</label>
                    <Select value={selectedPair1} onValueChange={setSelectedPair1}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Var 1" /></SelectTrigger>
                      <SelectContent>{scaleVars.map(v => <SelectItem key={v.name} value={v.name} className="text-xs">{v.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Variable 2</label>
                    <Select value={selectedPair2} onValueChange={setSelectedPair2}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Var 2" /></SelectTrigger>
                      <SelectContent>{scaleVars.filter(v => v.name !== selectedPair1).map(v => <SelectItem key={v.name} value={v.name} className="text-xs">{v.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {hypotheses.length > 0 && (
                <div>
                  <label className="text-xs font-medium mb-1 block">Link to Hypothesis (Optional)</label>
                  <Select value={linkedHypothesis || "none"} onValueChange={(v) => setLinkedHypothesis(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">None</SelectItem>
                      {hypotheses.map(h => <SelectItem key={h.id} value={h.id} className="text-xs">{h.hypothesisId}: {h.statement.substring(0, 50)}...</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {selectedTest && (
            <Button onClick={runTest} disabled={!canRun || isRunning} variant="hero" size="sm" className="mt-2">
              {isRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Running...</> : 'Run Test'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Result Tables */}
          {results.tables.map((table, i) => (
            <div key={i}>
              <h3 className="text-sm font-semibold mb-2">{table.title}</h3>
              <div className="spss-table-container">
                <ScrollArea className="w-full">
                  <table className="spss-table-academic">
                    <thead><tr>{table.headers.map(h => <th key={h} className={typeof table.rows[0]?.[h] === 'number' ? 'text-right' : ''}>{h}</th>)}</tr></thead>
                    <tbody>
                      {table.rows.map((row, ri) => (
                        <tr key={ri}>
                          {table.headers.map(h => (
                            <td key={h} className={typeof row[h] === 'number' ? 'text-right font-mono' : ''}>
                              {typeof row[h] === 'number' ? Number(row[h]).toFixed(3) : String(row[h] ?? '-')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            </div>
          ))}

          {/* Effect Size */}
          {results.effectSize && (
            <Card>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-accent" />
                  <div>
                    <p className="text-sm font-medium">{results.effectSize.type}: {results.effectSize.value.toFixed(3)}</p>
                    <p className="text-xs text-muted-foreground">{results.effectSize.interpretation}</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-xs">{results.effectSize.magnitude}</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hypothesis Decision */}
          {results.decision && (
            <Card className={results.pValue !== undefined && results.pValue < 0.05 ? 'border-accent' : 'border-destructive/50'}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  {results.pValue !== undefined && results.pValue < 0.05 ? <CheckCircle className="w-5 h-5 text-accent" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}
                  <div>
                    <p className="text-sm font-semibold">{results.decision}</p>
                    <p className="text-xs text-muted-foreground">p {results.pValue !== undefined ? (results.pValue < 0.001 ? '< .001' : `= ${results.pValue.toFixed(3)}`) : ''}, α = .05</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Academic Report */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground">
              <FileText className="w-4 h-4" /> Academic Report Preview <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="prose prose-sm max-w-none bg-card border border-border rounded-lg p-4">
                <p className="text-sm leading-relaxed">{generateAcademicReport(selectedTest as TestType, results)}</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
