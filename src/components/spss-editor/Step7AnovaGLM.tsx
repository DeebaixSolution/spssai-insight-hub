import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BarChart3, Loader2, CheckCircle, ChevronDown, FileText, AlertTriangle, Lightbulb } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Variable, Hypothesis } from '@/types/analysis';
import type { ParsedDataset } from '@/hooks/useAnalysisWizard';

interface Step7AnovaGLMProps {
  variables: Variable[];
  parsedData: ParsedDataset | null;
  analysisId: string | null;
  hypotheses: Hypothesis[];
  onHypothesisUpdate?: (id: string, status: 'supported' | 'rejected') => void;
}

type ModelType = 'one-way-anova' | 'two-way-anova' | 'repeated-measures-anova' | 'manova';

interface TestResult {
  tables: Array<{ title: string; headers: string[]; rows: Array<Record<string, string | number>> }>;
  charts: Array<{ type: string; data: any; title: string }>;
  effectSize?: { type: string; value: number; magnitude: string; interpretation: string };
  summary: string;
}

export function Step7AnovaGLM({ variables, parsedData, analysisId, hypotheses, onHypothesisUpdate }: Step7AnovaGLMProps) {
  const [selectedModel, setSelectedModel] = useState<ModelType | ''>('');
  const [autoDetected, setAutoDetected] = useState<ModelType | null>(null);
  const [results, setResults] = useState<TestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [pValue, setPValue] = useState<number | undefined>();
  const [selectedDV, setSelectedDV] = useState('');
  const [selectedDVs, setSelectedDVs] = useState<string[]>([]);
  const [selectedIV1, setSelectedIV1] = useState('');
  const [selectedIV2, setSelectedIV2] = useState('');
  const [selectedRepeated, setSelectedRepeated] = useState<string[]>([]);
  const [linkedHypothesis, setLinkedHypothesis] = useState('');

  const scaleVars = useMemo(() => variables.filter(v => v.measure === 'scale'), [variables]);
  const groupingVars = useMemo(() => variables.filter(v => v.measure === 'nominal' || v.measure === 'ordinal'), [variables]);

  // Auto-detection engine
  const detectModel = () => {
    const dvCount = selectedDVs.length || (selectedDV ? 1 : 0);
    const ivCount = (selectedIV1 ? 1 : 0) + (selectedIV2 ? 1 : 0);

    if (selectedRepeated.length >= 3) {
      setAutoDetected('repeated-measures-anova');
      setSelectedModel('repeated-measures-anova');
    } else if (dvCount >= 2 && ivCount >= 1) {
      setAutoDetected('manova');
      setSelectedModel('manova');
    } else if (dvCount === 1 && ivCount === 2) {
      setAutoDetected('two-way-anova');
      setSelectedModel('two-way-anova');
    } else if (dvCount === 1 && ivCount === 1) {
      setAutoDetected('one-way-anova');
      setSelectedModel('one-way-anova');
    }
  };

  const modelLabels: Record<ModelType, string> = {
    'one-way-anova': 'One-Way ANOVA',
    'two-way-anova': 'Two-Way ANOVA',
    'repeated-measures-anova': 'Repeated Measures ANOVA',
    'manova': 'MANOVA',
  };

  const runTest = async () => {
    if (!parsedData || !selectedModel) return;
    setIsRunning(true);

    try {
      let depVars: string[] = [];
      let indVars: string[] = [];
      let groupVar: string | undefined;

      switch (selectedModel) {
        case 'one-way-anova':
          depVars = [selectedDV];
          groupVar = selectedIV1;
          break;
        case 'two-way-anova':
          depVars = [selectedDV];
          indVars = [selectedIV1, selectedIV2].filter(Boolean);
          break;
        case 'repeated-measures-anova':
          depVars = selectedRepeated;
          break;
        case 'manova':
          depVars = selectedDVs;
          groupVar = selectedIV1;
          break;
      }

      const { data, error } = await supabase.functions.invoke('run-analysis', {
        body: { testType: selectedModel, dependentVariables: depVars, independentVariables: indVars, groupingVariable: groupVar, data: parsedData.rows },
      });

      if (error) throw new Error(error.message);
      const result: TestResult = data.results;
      setResults(result);

      // Extract p-value
      let extractedP: number | undefined;
      result.tables.forEach(t => {
        if (t.title.includes('Between-Subjects') || t.title === 'ANOVA' || t.title.includes('Within-Subjects') || t.title.includes('Multivariate')) {
          t.rows.forEach(r => {
            const sig = r['Sig.'] ?? r['Sig'];
            if (typeof sig === 'number' && sig >= 0 && sig <= 1) {
              if (extractedP === undefined || sig < extractedP) extractedP = sig;
            }
          });
        }
      });
      setPValue(extractedP);

      // Save to DB
      if (analysisId) {
        const block = {
          analysis_id: analysisId,
          section: 'hypothesis' as const,
          section_id: linkedHypothesis || `anova-glm-${selectedModel}`,
          test_type: selectedModel,
          test_category: 'anova-glm',
          dependent_variables: depVars,
          independent_variables: indVars,
          grouping_variable: groupVar || null,
          linked_hypothesis_id: linkedHypothesis || null,
          config: {},
          results: result as any,
          narrative: { sectionHeading: '', introduction: '', tableTitle: '', tableInterpretation: generateReport(selectedModel, result, extractedP) },
          display_order: 0,
          status: 'completed',
        };
        await supabase.from('analysis_blocks').delete().eq('analysis_id', analysisId).eq('test_type', selectedModel);
        await supabase.from('analysis_blocks').insert([block]);

        if (linkedHypothesis && extractedP !== undefined) {
          const status = extractedP < 0.05 ? 'supported' : 'rejected';
          await supabase.from('hypotheses').update({ status }).eq('id', linkedHypothesis);
          onHypothesisUpdate?.(linkedHypothesis, status as any);
        }

        const { data: stateData } = await supabase.from('analysis_state').select().eq('analysis_id', analysisId).single();
        if (stateData) {
          await supabase.from('analysis_state').update({ step_7_completed: true }).eq('analysis_id', analysisId);
        } else {
          await supabase.from('analysis_state').insert({ analysis_id: analysisId, step_7_completed: true });
        }
      }

      toast.success(`${modelLabels[selectedModel]} completed!`);
    } catch (err) {
      console.error(err);
      toast.error('Analysis failed.');
    } finally {
      setIsRunning(false);
    }
  };

  const generateReport = (model: ModelType, result: TestResult, p?: number): string => {
    const sig = p !== undefined && p < 0.05 ? 'statistically significant' : 'not statistically significant';
    const pStr = p !== undefined ? (p < 0.001 ? 'p < .001' : `p = ${p.toFixed(3)}`) : '';
    const es = result.effectSize;
    switch (model) {
      case 'one-way-anova': {
        const row = result.tables.find(t => t.title === 'ANOVA')?.rows[0];
        return row ? `A one-way ANOVA revealed a ${sig} difference between groups, F(${row['df']}) = ${Number(row['F']).toFixed(2)}, ${pStr}${es ? `, η² = ${es.value.toFixed(3)} (${es.magnitude})` : ''}.` : '';
      }
      case 'two-way-anova':
        return `A two-way ANOVA was conducted. The results were ${sig}, ${pStr}${es ? `, Partial η² = ${es.value.toFixed(3)} (${es.magnitude})` : ''}.`;
      case 'repeated-measures-anova':
        return `A repeated measures ANOVA was conducted. After applying corrections where necessary, the within-subjects effect was ${sig}, ${pStr}${es ? `, Partial η² = ${es.value.toFixed(3)} (${es.magnitude})` : ''}.`;
      case 'manova':
        return `A one-way MANOVA was conducted. A ${sig} multivariate effect was observed, ${pStr}${es ? `, ${es.type} = ${es.value.toFixed(3)} (${es.magnitude})` : ''}.`;
      default: return '';
    }
  };

  const canRun = selectedModel && (
    (selectedModel === 'one-way-anova' && selectedDV && selectedIV1) ||
    (selectedModel === 'two-way-anova' && selectedDV && selectedIV1 && selectedIV2) ||
    (selectedModel === 'repeated-measures-anova' && selectedRepeated.length >= 3) ||
    (selectedModel === 'manova' && selectedDVs.length >= 2 && selectedIV1)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Step 7: Advanced ANOVA & GLM Analysis</h2>
          <p className="text-sm text-muted-foreground mt-1">Multivariate and Repeated Measures Modeling Engine</p>
        </div>
      </div>

      {/* Model Selection */}
      <Card>
        <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Model Configuration</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {(Object.keys(modelLabels) as ModelType[]).map(m => (
              <Button key={m} variant={selectedModel === m ? 'default' : 'outline'} size="sm" className="text-xs"
                onClick={() => { setSelectedModel(m); setResults(null); setPValue(undefined); }}>
                {autoDetected === m && <Lightbulb className="w-3 h-3 mr-1 text-yellow-500" />}
                {modelLabels[m]}
              </Button>
            ))}
          </div>

          {/* Variable selectors per model */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {(selectedModel === 'one-way-anova' || selectedModel === 'two-way-anova') && (
              <>
                <div>
                  <label className="text-xs font-medium mb-1 block">Dependent Variable (Scale)</label>
                  <Select value={selectedDV} onValueChange={setSelectedDV}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select DV" /></SelectTrigger>
                    <SelectContent>{scaleVars.map(v => <SelectItem key={v.name} value={v.name} className="text-xs">{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Factor 1 (IV)</label>
                  <Select value={selectedIV1} onValueChange={setSelectedIV1}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Factor 1" /></SelectTrigger>
                    <SelectContent>{groupingVars.map(v => <SelectItem key={v.name} value={v.name} className="text-xs">{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {selectedModel === 'two-way-anova' && (
                  <div>
                    <label className="text-xs font-medium mb-1 block">Factor 2 (IV)</label>
                    <Select value={selectedIV2} onValueChange={setSelectedIV2}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Factor 2" /></SelectTrigger>
                      <SelectContent>{groupingVars.filter(v => v.name !== selectedIV1).map(v => <SelectItem key={v.name} value={v.name} className="text-xs">{v.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
            {selectedModel === 'repeated-measures-anova' && (
              <div className="col-span-2">
                <label className="text-xs font-medium mb-1 block">Select Repeated Measures (3+ scale variables)</label>
                <div className="flex flex-wrap gap-1.5">
                  {scaleVars.map(v => (
                    <Button key={v.name} variant={selectedRepeated.includes(v.name) ? 'default' : 'outline'} size="sm" className="text-xs h-7"
                      onClick={() => setSelectedRepeated(prev => prev.includes(v.name) ? prev.filter(x => x !== v.name) : [...prev, v.name])}>
                      {v.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {selectedModel === 'manova' && (
              <>
                <div>
                  <label className="text-xs font-medium mb-1 block">Dependent Variables (2+ scale)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {scaleVars.map(v => (
                      <Button key={v.name} variant={selectedDVs.includes(v.name) ? 'default' : 'outline'} size="sm" className="text-xs h-7"
                        onClick={() => setSelectedDVs(prev => prev.includes(v.name) ? prev.filter(x => x !== v.name) : [...prev, v.name])}>
                        {v.name}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Grouping Variable (IV)</label>
                  <Select value={selectedIV1} onValueChange={setSelectedIV1}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select IV" /></SelectTrigger>
                    <SelectContent>{groupingVars.map(v => <SelectItem key={v.name} value={v.name} className="text-xs">{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {hypotheses.length > 0 && (
            <div className="max-w-xs">
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

          <div className="flex gap-2">
            <Button onClick={detectModel} variant="outline" size="sm" className="text-xs">
              <Lightbulb className="w-3.5 h-3.5 mr-1.5" />Auto-Detect Model
            </Button>
            <Button onClick={runTest} disabled={!canRun || isRunning} variant="hero" size="sm">
              {isRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Running...</> : 'Run Analysis'}
            </Button>
          </div>
        </CardContent>
      </Card>

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

          {/* Charts */}
          {results.charts.map((chart, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm font-medium mb-3">{chart.title}</p>
              <ResponsiveContainer width="100%" height={250}>
                {chart.type === 'bar' ? (
                  <BarChart data={chart.data as any[]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="value" fill="hsl(var(--accent))" />
                  </BarChart>
                ) : (
                  <LineChart data={chart.data as any[]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey={Object.keys((chart.data as any[])[0] || {})[0]} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Legend />
                    {Object.keys((chart.data as any[])[0] || {}).slice(1).map((key, ki) => (
                      <Line key={key} type="monotone" dataKey={key} stroke={ki === 0 ? 'hsl(var(--accent))' : 'hsl(var(--primary))'} strokeWidth={2} />
                    ))}
                  </LineChart>
                )}
              </ResponsiveContainer>
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
                <p className="text-sm leading-relaxed">{generateReport(selectedModel as ModelType, results, pValue)}</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
