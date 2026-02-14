import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { GitBranch, Loader2, AlertTriangle, CheckCircle, ChevronDown, FileText, Lightbulb, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Variable, Hypothesis } from '@/types/analysis';
import type { ParsedDataset } from '@/hooks/useAnalysisWizard';

interface Step6NonParametricProps {
  variables: Variable[];
  parsedData: ParsedDataset | null;
  analysisId: string | null;
  hypotheses: Hypothesis[];
  onHypothesisUpdate?: (id: string, status: 'supported' | 'rejected') => void;
}

type NPTestType = 'chi-square' | 'mann-whitney' | 'wilcoxon' | 'kruskal-wallis' | 'friedman' | 'spearman' | 'kendall-tau';

interface DecisionResult {
  recommendedTest: NPTestType;
  reason: string;
  alternatives: Array<{ test: NPTestType; reason: string }>;
}

interface TestResult {
  tables: Array<{ title: string; headers: string[]; rows: Array<Record<string, string | number>> }>;
  charts: Array<{ type: string; data: any; title: string }>;
  effectSize?: { type: string; value: number; magnitude: string; interpretation: string };
  summary: string;
}

type EngineState = 'INIT' | 'CHECKING' | 'SELECTING' | 'RUNNING' | 'COMPLETED';

export function Step6NonParametric({ variables, parsedData, analysisId, hypotheses, onHypothesisUpdate }: Step6NonParametricProps) {
  const [engineState, setEngineState] = useState<EngineState>('INIT');
  const [selectedTest, setSelectedTest] = useState<NPTestType | ''>('');
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [results, setResults] = useState<TestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedDV, setSelectedDV] = useState('');
  const [selectedIV, setSelectedIV] = useState('');
  const [selectedVars, setSelectedVars] = useState<string[]>([]);
  const [linkedHypothesis, setLinkedHypothesis] = useState('');
  const [pValue, setPValue] = useState<number | undefined>();
  const [assumptions, setAssumptions] = useState<any[]>([]);

  const scaleVars = useMemo(() => variables.filter(v => v.measure === 'scale'), [variables]);
  const ordinalVars = useMemo(() => variables.filter(v => v.measure === 'ordinal'), [variables]);
  const nominalVars = useMemo(() => variables.filter(v => v.measure === 'nominal'), [variables]);
  const scaleOrOrdinal = useMemo(() => variables.filter(v => v.measure === 'scale' || v.measure === 'ordinal'), [variables]);

  useEffect(() => {
    if (!analysisId) return;
    supabase.from('analysis_assumptions').select('*').eq('analysis_id', analysisId)
      .then(({ data }) => { if (data) setAssumptions(data); });
  }, [analysisId]);

  // Decision tree engine
  const runDecisionTree = () => {
    setEngineState('CHECKING');
    const nonNormalVars = assumptions.filter(a => !a.parametric_allowed).map(a => a.variable_name);
    const dvVar = variables.find(v => v.name === selectedDV);
    const ivVar = variables.find(v => v.name === selectedIV);

    let recommended: NPTestType = 'mann-whitney';
    let reason = '';
    const alternatives: Array<{ test: NPTestType; reason: string }> = [];

    if (dvVar?.measure === 'nominal' && ivVar?.measure === 'nominal') {
      recommended = 'chi-square';
      reason = 'Both DV and IV are nominal — Chi-Square test of independence is appropriate.';
      alternatives.push({ test: 'spearman', reason: 'If ordinal association is of interest' });
    } else if (dvVar && (dvVar.measure === 'ordinal' || (dvVar.measure === 'scale' && nonNormalVars.includes(dvVar.name)))) {
      // Count groups
      let groupCount = 0;
      if (selectedIV && parsedData) {
        groupCount = new Set(parsedData.rows.map(r => String(r[selectedIV])).filter(Boolean)).size;
      }

      if (groupCount === 2) {
        recommended = 'mann-whitney';
        reason = `DV is ${dvVar.measure === 'ordinal' ? 'ordinal' : 'non-normal scale'} with 2 independent groups — Mann-Whitney U is appropriate.`;
        alternatives.push({ test: 'wilcoxon', reason: 'If groups are paired/related' });
      } else if (groupCount >= 3) {
        recommended = 'kruskal-wallis';
        reason = `DV is ${dvVar.measure === 'ordinal' ? 'ordinal' : 'non-normal scale'} with ${groupCount} independent groups — Kruskal-Wallis H is appropriate.`;
        alternatives.push({ test: 'friedman', reason: 'If measures are repeated/related' });
      } else {
        recommended = 'spearman';
        reason = 'Non-normal continuous variables — Spearman rank correlation is appropriate.';
        alternatives.push({ test: 'kendall-tau', reason: 'Better for small samples or many ties' });
      }
    } else {
      recommended = 'spearman';
      reason = 'Default non-parametric correlation for scale/ordinal variables.';
    }

    setDecision({ recommendedTest: recommended, reason, alternatives });
    setSelectedTest(recommended);
    setEngineState('SELECTING');
  };

  const runTest = async () => {
    if (!parsedData || !selectedTest) return;
    setIsRunning(true);
    setEngineState('RUNNING');

    try {
      let depVars: string[] = [];
      let groupVar: string | undefined;

      switch (selectedTest) {
        case 'chi-square':
          depVars = [selectedDV, selectedIV];
          break;
        case 'mann-whitney':
        case 'kruskal-wallis':
          depVars = [selectedDV];
          groupVar = selectedIV;
          break;
        case 'wilcoxon':
        case 'friedman':
        case 'spearman':
        case 'kendall-tau':
          depVars = selectedVars.length > 0 ? selectedVars : [selectedDV, selectedIV].filter(Boolean);
          break;
      }

      const { data, error } = await supabase.functions.invoke('run-analysis', {
        body: { testType: selectedTest, dependentVariables: depVars, independentVariables: [], groupingVariable: groupVar, data: parsedData.rows },
      });

      if (error) throw new Error(error.message);
      const result: TestResult = data.results;
      setResults(result);

      // Extract p-value
      let extractedP: number | undefined;
      result.tables.forEach(t => {
        t.rows.forEach(r => {
          const sig = r['Asymptotic Sig. (2-sided)'] ?? r['Asymp. Sig. (2-tailed)'] ?? r['Asymp. Sig.'] ?? r['Sig. (2-tailed)'];
          if (typeof sig === 'number' && sig >= 0 && sig <= 1) {
            if (extractedP === undefined || sig < extractedP) extractedP = sig;
          }
        });
      });
      setPValue(extractedP);

      // Save to DB
      if (analysisId) {
        const block = {
          analysis_id: analysisId,
          section: 'hypothesis' as const,
          section_id: linkedHypothesis || `nonparametric-${selectedTest}`,
          test_type: selectedTest,
          test_category: 'nonparametric',
          dependent_variables: depVars,
          independent_variables: [],
          grouping_variable: groupVar || null,
          linked_hypothesis_id: linkedHypothesis || null,
          config: {},
          results: result as any,
          narrative: { sectionHeading: '', introduction: '', tableTitle: '', tableInterpretation: generateReport(selectedTest, result, extractedP) },
          display_order: 0,
          status: 'completed',
        };
        await supabase.from('analysis_blocks').delete().eq('analysis_id', analysisId).eq('test_type', selectedTest);
        await supabase.from('analysis_blocks').insert([block]);

        if (linkedHypothesis && extractedP !== undefined) {
          const status = extractedP < 0.05 ? 'supported' : 'rejected';
          await supabase.from('hypotheses').update({ status }).eq('id', linkedHypothesis);
          onHypothesisUpdate?.(linkedHypothesis, status as any);
        }

        const { data: stateData } = await supabase.from('analysis_state').select().eq('analysis_id', analysisId).single();
        if (stateData) {
          await supabase.from('analysis_state').update({ step_6_completed: true }).eq('analysis_id', analysisId);
        } else {
          await supabase.from('analysis_state').insert({ analysis_id: analysisId, step_6_completed: true });
        }
      }

      setEngineState('COMPLETED');
      toast.success('Non-parametric test completed!');
    } catch (err) {
      console.error(err);
      toast.error('Test failed.');
      setEngineState('SELECTING');
    } finally {
      setIsRunning(false);
    }
  };

  const generateReport = (test: NPTestType, result: TestResult, p?: number): string => {
    const sig = p !== undefined && p < 0.05 ? 'a statistically significant' : 'no statistically significant';
    const pStr = p !== undefined ? (p < 0.001 ? 'p < .001' : `p = ${p.toFixed(3)}`) : '';
    const es = result.effectSize;
    const templates: Record<NPTestType, string> = {
      'chi-square': `A Chi-Square test of independence was performed. There was ${sig} association, ${pStr}${es ? `, Cramér's V = ${es.value.toFixed(3)} (${es.magnitude})` : ''}.`,
      'mann-whitney': `A Mann–Whitney U test was conducted. There was ${sig} difference between groups, ${pStr}${es ? `, r = ${es.value.toFixed(3)} (${es.magnitude})` : ''}.`,
      'wilcoxon': `A Wilcoxon Signed-Rank test was conducted. There was ${sig} difference, ${pStr}${es ? `, r = ${es.value.toFixed(3)} (${es.magnitude})` : ''}.`,
      'kruskal-wallis': `A Kruskal–Wallis H test showed ${sig} difference across groups, ${pStr}${es ? `, ε² = ${es.value.toFixed(3)} (${es.magnitude})` : ''}.`,
      'friedman': `A Friedman test indicated ${sig} difference across conditions, ${pStr}${es ? `, Kendall's W = ${es.value.toFixed(3)}` : ''}.`,
      'spearman': `A Spearman's rank-order correlation was computed. ${es ? `The correlation was ${es.magnitude} (ρ = ${es.value.toFixed(3)}), ${pStr}` : pStr}.`,
      'kendall-tau': `A Kendall's tau-b correlation was computed. ${es ? `The correlation was ${es.magnitude} (τ = ${es.value.toFixed(3)}), ${pStr}` : pStr}.`,
    };
    return templates[test] || '';
  };

  const testLabels: Record<NPTestType, string> = {
    'chi-square': 'Chi-Square', 'mann-whitney': 'Mann-Whitney U', 'wilcoxon': 'Wilcoxon', 'kruskal-wallis': 'Kruskal-Wallis', 'friedman': 'Friedman', 'spearman': 'Spearman', 'kendall-tau': "Kendall's Tau"
  };

  const needsGroupVar = selectedTest === 'mann-whitney' || selectedTest === 'kruskal-wallis';
  const needsTwoNominal = selectedTest === 'chi-square';
  const needsMultiVars = selectedTest === 'wilcoxon' || selectedTest === 'friedman' || selectedTest === 'spearman' || selectedTest === 'kendall-tau';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Step 6: Non-Parametric Decision Engine</h2>
          <p className="text-sm text-muted-foreground mt-1">AI-guided test selection for non-normal or categorical data</p>
        </div>
        <Badge variant="outline" className="text-xs">{engineState}</Badge>
      </div>

      {/* Variable Selection */}
      <Card>
        <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Variable Configuration</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Primary Variable (DV)</label>
              <Select value={selectedDV} onValueChange={v => { setSelectedDV(v); setDecision(null); setResults(null); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select DV" /></SelectTrigger>
                <SelectContent>{variables.filter(v => v.role !== 'id').map(v => <SelectItem key={v.name} value={v.name} className="text-xs">{v.name} ({v.measure})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Secondary Variable / Grouping (IV)</label>
              <Select value={selectedIV} onValueChange={v => { setSelectedIV(v); setDecision(null); setResults(null); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select IV" /></SelectTrigger>
                <SelectContent>{variables.filter(v => v.name !== selectedDV && v.role !== 'id').map(v => <SelectItem key={v.name} value={v.name} className="text-xs">{v.name} ({v.measure})</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {hypotheses.length > 0 && (
            <div>
              <label className="text-xs font-medium mb-1 block">Link to Hypothesis</label>
              <Select value={linkedHypothesis} onValueChange={setLinkedHypothesis}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">None</SelectItem>
                  {hypotheses.map(h => <SelectItem key={h.id} value={h.id} className="text-xs">{h.hypothesisId}: {h.statement.substring(0, 50)}...</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {selectedDV && selectedIV && (
            <Button onClick={runDecisionTree} variant="outline" size="sm" className="text-xs">
              <Lightbulb className="w-3.5 h-3.5 mr-1.5" />Auto-Select Test
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Decision Result */}
      {decision && (
        <Card className="border-accent/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Recommended: {testLabels[decision.recommendedTest]}</p>
                <p className="text-xs text-muted-foreground mt-1">{decision.reason}</p>
                {decision.alternatives.length > 0 && (
                  <Collapsible className="mt-2">
                    <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      Alternative tests <ChevronDown className="w-3 h-3" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1 space-y-1">
                      {decision.alternatives.map(a => (
                        <button key={a.test} onClick={() => setSelectedTest(a.test)} className="block text-xs text-muted-foreground hover:text-foreground">
                          • {testLabels[a.test]}: {a.reason}
                        </button>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              {Object.keys(testLabels).map(t => (
                <Button key={t} variant={selectedTest === t ? 'default' : 'outline'} size="sm" className="text-xs h-7"
                  onClick={() => setSelectedTest(t as NPTestType)}>{testLabels[t as NPTestType]}</Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* For multi-var tests */}
      {selectedTest && needsMultiVars && (
        <Card>
          <CardContent className="py-3 px-4">
            <label className="text-xs font-medium mb-1 block">Select Variables (2+)</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {scaleOrOrdinal.map(v => (
                <Button key={v.name} variant={selectedVars.includes(v.name) ? 'default' : 'outline'} size="sm" className="text-xs h-7"
                  onClick={() => setSelectedVars(prev => prev.includes(v.name) ? prev.filter(x => x !== v.name) : [...prev, v.name])}>
                  {v.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Run button */}
      {selectedTest && (
        <Button onClick={runTest} disabled={isRunning} variant="hero" size="sm">
          {isRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Running...</> : `Run ${testLabels[selectedTest]}`}
        </Button>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {results.tables.map((table, i) => (
            <div key={i}>
              <h3 className="text-sm font-semibold mb-2">{table.title}</h3>
              <div className="spss-table-container">
                <ScrollArea className="w-full">
                  <table className="spss-table-academic">
                    <thead><tr>{table.headers.map(h => <th key={h} className={typeof table.rows[0]?.[h] === 'number' ? 'text-right' : ''}>{h}</th>)}</tr></thead>
                    <tbody>{table.rows.map((row, ri) => (
                      <tr key={ri}>{table.headers.map(h => (
                        <td key={h} className={typeof row[h] === 'number' ? 'text-right font-mono' : ''}>
                          {typeof row[h] === 'number' ? Number(row[h]).toFixed(3) : String(row[h])}
                        </td>
                      ))}</tr>
                    ))}</tbody>
                  </table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            </div>
          ))}

          {results.effectSize && (
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium">{results.effectSize.type}: {results.effectSize.value.toFixed(3)}</p>
                  <p className="text-xs text-muted-foreground">{results.effectSize.interpretation}</p>
                </div>
                <Badge variant="outline" className="ml-auto text-xs">{results.effectSize.magnitude}</Badge>
              </CardContent>
            </Card>
          )}

          {pValue !== undefined && (
            <Card className={pValue < 0.05 ? 'border-accent' : 'border-destructive/50'}>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                {pValue < 0.05 ? <CheckCircle className="w-5 h-5 text-accent" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}
                <div>
                  <p className="text-sm font-semibold">{pValue < 0.05 ? 'Reject H₀' : 'Fail to Reject H₀'}</p>
                  <p className="text-xs text-muted-foreground">p {pValue < 0.001 ? '< .001' : `= ${pValue.toFixed(3)}`}, α = .05</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium"><FileText className="w-4 h-4" /> Academic Report <ChevronDown className="w-4 h-4" /></CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="prose prose-sm max-w-none bg-card border border-border rounded-lg p-4">
                <p className="text-sm leading-relaxed">{generateReport(selectedTest as NPTestType, results, pValue)}</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
