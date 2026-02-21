import { useState, useMemo } from 'react';
import { Puzzle, CheckCircle, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ReferenceLine } from 'recharts';
import type { Variable } from '@/types/analysis';

interface Step10MeasurementProps {
  variables: Variable[];
  parsedData: { rows: Record<string, unknown>[] } | null;
  analysisId?: string | null;
}

function interpretKMO(kmo: number): string {
  if (kmo >= 0.9) return 'Excellent';
  if (kmo >= 0.8) return 'Very Good';
  if (kmo >= 0.7) return 'Good';
  if (kmo >= 0.6) return 'Acceptable';
  if (kmo >= 0.5) return 'Marginal';
  return 'Inadequate';
}

function interpretAlpha(a: number): string {
  if (a >= 0.9) return 'Excellent';
  if (a >= 0.8) return 'Good';
  if (a >= 0.7) return 'Acceptable';
  if (a >= 0.6) return 'Questionable';
  if (a >= 0.5) return 'Poor';
  return 'Unacceptable';
}

export function Step10Measurement({ variables, parsedData, analysisId }: Step10MeasurementProps) {
  const [subStep, setSubStep] = useState(1);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [rotation, setRotation] = useState<'varimax' | 'oblimin'>('varimax');
  const [loading, setLoading] = useState(false);
  const [kmoResults, setKmoResults] = useState<any>(null);
  const [efaResults, setEfaResults] = useState<any>(null);
  const [reliabilityResults, setReliabilityResults] = useState<any>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const scaleVars = useMemo(() => variables.filter(v => v.measure === 'scale'), [variables]);

  const toggleItem = (name: string) => {
    setSelectedItems(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const subSteps = [
    { num: 1, label: 'Select Items' },
    { num: 2, label: 'KMO & Bartlett' },
    { num: 3, label: 'Factor Extraction' },
    { num: 4, label: 'Pattern Matrix' },
    { num: 5, label: 'Reliability' },
    { num: 6, label: 'Final Decision' },
  ];

  const saveBlockToDatabase = async (testType: string, testCategory: string, resultData: any, apa: string) => {
    if (!analysisId) return;
    try {
      await supabase.from('analysis_blocks').delete()
        .eq('analysis_id', analysisId)
        .eq('test_type', testType);

      await supabase.from('analysis_blocks').insert({
        analysis_id: analysisId,
        section: 'measurement',
        section_id: `measurement-${testType}`,
        test_type: testType,
        test_category: testCategory,
        dependent_variables: selectedItems,
        independent_variables: [],
        config: { rotation },
        results: resultData,
        narrative: { apa, interpretation: apa },
        display_order: 0,
        status: 'completed',
      });

      const { data: existingState } = await supabase.from('analysis_state').select().eq('analysis_id', analysisId).single();
      if (existingState) {
        await supabase.from('analysis_state').update({ step_10_completed: true }).eq('analysis_id', analysisId);
      } else {
        await supabase.from('analysis_state').insert({ analysis_id: analysisId, step_10_completed: true });
      }
    } catch (err) {
      console.error('Failed to save measurement block:', err);
    }
  };

  const runKMO = async () => {
    if (selectedItems.length < 3 || !parsedData) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-analysis', {
        body: { testType: 'kmo-bartlett', dependentVariables: selectedItems, independentVariables: [], data: parsedData.rows },
      });
      if (error) throw error;
      setKmoResults(data.results);
      const kmoVal = data.results?.tables?.[0]?.rows?.find((r: any) => r.Measure?.includes('Kaiser'))?.Value;
      const apa = kmoVal ? `The Kaiser-Meyer-Olkin measure of sampling adequacy was ${Number(kmoVal).toFixed(3)}, indicating ${interpretKMO(Number(kmoVal)).toLowerCase()} adequacy for factor analysis.` : '';
      await saveBlockToDatabase('kmo-bartlett', 'measurement-validation', data.results, apa);
      toast.success('KMO & Bartlett computed & saved');
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const runEFA = async () => {
    if (selectedItems.length < 3 || !parsedData) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-analysis', {
        body: {
          testType: 'factor-analysis', dependentVariables: selectedItems,
          independentVariables: [], data: parsedData.rows,
          options: { rotation },
        },
      });
      if (error) throw error;
      setEfaResults(data.results);
      const numFactors = data.results?.effectSize?.value ?? '?';
      const varianceRow = data.results?.tables?.find((t: any) => t.title.includes('Variance'))?.rows;
      const cumVar = varianceRow?.[Number(numFactors) - 1]?.['Cumulative %'];
      const apa = `An exploratory factor analysis using PCA with ${rotation === 'varimax' ? 'Varimax' : 'Oblimin'} rotation revealed a ${numFactors}-factor structure explaining ${cumVar ? Number(cumVar).toFixed(1) : '?'}% of total variance.`;
      await saveBlockToDatabase('factor-analysis', 'measurement-validation', data.results, apa);
      toast.success('Factor analysis completed & saved');
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const runReliability = async () => {
    if (selectedItems.length < 2 || !parsedData) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-analysis', {
        body: { testType: 'cronbach-alpha', dependentVariables: selectedItems, independentVariables: [], data: parsedData.rows },
      });
      if (error) throw error;
      setReliabilityResults(data.results);
      const alpha = data.results?.tables?.[0]?.rows?.[0]?.["Cronbach's Alpha"];
      const apa = alpha ? `The internal consistency was assessed using Cronbach's alpha. The reliability coefficient was α = ${Number(alpha).toFixed(3)}, indicating ${interpretAlpha(Number(alpha)).toLowerCase()} internal consistency.` : '';
      await saveBlockToDatabase('cronbach-alpha', 'reliability', data.results, apa);
      toast.success('Reliability analysis completed & saved');
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const renderTable = (table: any) => (
    <div key={table.title} className="mb-4">
      <h4 className="text-sm font-semibold mb-2">{table.title}</h4>
      <div className="overflow-x-auto">
        <table className="spss-table-academic w-full text-xs">
          <thead><tr className="bg-muted/50">{table.headers.map((h: string) => <th key={h} className="border border-border/50 px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {table.rows.map((row: any, i: number) => (
              <tr key={i} className="border-b border-border/30">
                {table.headers.map((h: string) => {
                  const val = row[h];
                  const isLoading = h.startsWith('Factor') && typeof val === 'number';
                  const highlight = isLoading && Math.abs(val) >= 0.4 ? 'bg-green-100 dark:bg-green-900/20 font-semibold' :
                    isLoading && Math.abs(val) >= 0.3 ? 'bg-yellow-50 dark:bg-yellow-900/10' : '';
                  return (
                    <td key={h} className={`border border-border/30 px-3 py-1.5 text-right tabular-nums ${highlight}`}>
                      {typeof val === 'number' ? Number(val).toFixed(3) : String(val ?? '-')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderScreePlot = () => {
    if (!efaResults?.charts) return null;
    const scree = efaResults.charts.find((c: any) => c.title === 'Scree Plot');
    if (!scree) return null;
    return (
      <div className="mt-4">
        <h4 className="text-sm font-semibold mb-2">Scree Plot</h4>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={scree.data} margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="component" label={{ value: 'Component', position: 'bottom' }} />
            <YAxis label={{ value: 'Eigenvalue', angle: -90, position: 'left' }} />
            <RechartsTooltip />
            <ReferenceLine y={1} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label="Eigenvalue = 1" />
            <Line type="monotone" dataKey="eigenvalue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Final decision summary
  const renderFinalDecision = () => {
    const kmo = kmoResults?.tables?.[0]?.rows?.find((r: any) => r.Measure?.includes('Kaiser'))?.Value;
    const bartlettP = kmoResults?.tables?.[0]?.rows?.find((r: any) => r.Measure?.includes('Sig.'))?.Value;
    const alpha = reliabilityResults?.tables?.[0]?.rows?.[0]?.["Cronbach's Alpha"];
    const numFactors = efaResults?.effectSize?.value;
    const varianceExpl = efaResults?.effectSize?.interpretation;

    return (
      <Card className="mt-4 border-primary/30">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-600" /> Measurement Validation Summary</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-muted-foreground">KMO:</span> {kmo ? `${Number(kmo).toFixed(3)} (${interpretKMO(Number(kmo))})` : 'Not computed'}</div>
            <div><span className="text-muted-foreground">Bartlett's p:</span> {bartlettP !== undefined ? (Number(bartlettP) < 0.001 ? '< .001' : Number(bartlettP).toFixed(3)) : 'Not computed'}</div>
            <div><span className="text-muted-foreground">Factors:</span> {numFactors ?? 'Not extracted'}</div>
            <div><span className="text-muted-foreground">Variance:</span> {varianceExpl ?? 'N/A'}</div>
            <div><span className="text-muted-foreground">Cronbach's α:</span> {alpha ? `${Number(alpha).toFixed(3)} (${interpretAlpha(Number(alpha))})` : 'Not computed'}</div>
            <div><span className="text-muted-foreground">Items:</span> {selectedItems.length}</div>
          </div>
          {kmo && alpha && (
            <div className="mt-3 p-3 bg-muted/30 rounded-md">
              <p className="font-medium">
                {Number(kmo) >= 0.6 && Number(bartlettP) < 0.05 && Number(alpha) >= 0.7
                  ? '✅ Scale is structurally valid and internally consistent. Ready for further analysis.'
                  : '⚠️ Some measurement criteria need attention before proceeding.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Puzzle className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Measurement Validation Engine</h2>
        <Badge variant="secondary">Step 10</Badge>
      </div>

      {/* Sub-step navigation */}
      <div className="flex gap-1 flex-wrap">
        {subSteps.map(s => (
          <Button key={s.num} variant={subStep === s.num ? 'default' : 'outline'} size="sm" onClick={() => setSubStep(s.num)}>
            {s.num}. {s.label}
          </Button>
        ))}
      </div>

      {/* Step 1: Item selection */}
      {subStep === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Select scale items to validate (minimum 3):</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 border rounded-md">
            {scaleVars.map(v => (
              <label key={v.name} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={selectedItems.includes(v.name)} onCheckedChange={() => toggleItem(v.name)} />
                <span className="truncate">{v.name}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedItems(scaleVars.map(v => v.name))}>Select All</Button>
            <Button size="sm" variant="outline" onClick={() => setSelectedItems([])}>Clear</Button>
          </div>
          <p className="text-xs text-muted-foreground">{selectedItems.length} items selected</p>
        </div>
      )}

      {/* Step 2: KMO & Bartlett */}
      {subStep === 2 && (
        <div className="space-y-3">
          <Button onClick={runKMO} disabled={loading || selectedItems.length < 3}>{loading ? 'Computing...' : "Run KMO & Bartlett's Test"}</Button>
          {kmoResults?.tables?.map((t: any) => renderTable(t))}
          {kmoResults && (() => {
            const kmoVal = kmoResults.tables?.[0]?.rows?.find((r: any) => r.Measure?.includes('Kaiser'))?.Value;
            if (!kmoVal) return null;
            const k = Number(kmoVal);
            return k < 0.5 ? (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="py-3 flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="w-4 h-4" /> KMO = {k.toFixed(3)} — Factor analysis is NOT recommended.
                </CardContent>
              </Card>
            ) : null;
          })()}
        </div>
      )}

      {/* Step 3: Factor Extraction */}
      {subStep === 3 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm">Rotation:</span>
            <Select value={rotation} onValueChange={(v) => setRotation(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="varimax">Varimax</SelectItem>
                <SelectItem value="oblimin">Oblimin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={runEFA} disabled={loading || selectedItems.length < 3}>{loading ? 'Extracting...' : 'Run Factor Analysis'}</Button>
          {efaResults?.tables?.filter((t: any) => t.title.includes('Variance')).map((t: any) => renderTable(t))}
          {renderScreePlot()}
        </div>
      )}

      {/* Step 4: Pattern Matrix */}
      {subStep === 4 && (
        <div className="space-y-3">
          {efaResults?.tables?.filter((t: any) => t.title.includes('Matrix')).map((t: any) => renderTable(t))}
          {!efaResults && <p className="text-sm text-muted-foreground">Run factor analysis in step 3 first.</p>}
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className="inline-block w-3 h-3 bg-green-100 border" /> ≥ .40 (strong loading)
            <span className="inline-block w-3 h-3 bg-yellow-50 border" /> .30–.39 (cross-loading)
          </div>
        </div>
      )}

      {/* Step 5: Reliability */}
      {subStep === 5 && (
        <div className="space-y-3">
          <Button onClick={runReliability} disabled={loading || selectedItems.length < 2}>{loading ? 'Computing...' : "Run Cronbach's Alpha"}</Button>
          {reliabilityResults?.tables?.map((t: any) => renderTable(t))}
        </div>
      )}

      {/* Step 6: Final Decision */}
      {subStep === 6 && renderFinalDecision()}

      {/* Academic report */}
      {(kmoResults || efaResults || reliabilityResults) && (
        <Card className="mt-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Academic Report Preview</CardTitle></CardHeader>
          <CardContent className="text-sm leading-relaxed">
            {efaResults && (() => {
              const numFactors = efaResults.effectSize?.value ?? '?';
              const kmoVal = kmoResults?.tables?.[0]?.rows?.find((r: any) => r.Measure?.includes('Kaiser'))?.Value;
              const bartChi = kmoResults?.tables?.[0]?.rows?.find((r: any) => r.Measure?.includes('Chi-Square'))?.Value;
              const bartDf = kmoResults?.tables?.[0]?.rows?.find((r: any) => r.Measure?.includes('df'))?.Value;
              const varianceRow = efaResults.tables?.find((t: any) => t.title.includes('Variance'))?.rows;
              const cumVar = varianceRow?.[Number(numFactors) - 1]?.['Cumulative %'];
              return (
                <p>An exploratory factor analysis using Principal Component Analysis with {rotation === 'varimax' ? 'Varimax' : 'Oblimin'} rotation revealed a {numFactors}-factor structure explaining {cumVar ? Number(cumVar).toFixed(1) : '?'}% of the total variance. {kmoVal ? `The KMO measure verified sampling adequacy (KMO = ${Number(kmoVal).toFixed(2)})` : ''}{bartChi ? `, and Bartlett's test of sphericity was significant (χ²(${Number(bartDf).toFixed(0)}) = ${Number(bartChi).toFixed(2)}, p < .001)` : ''}.</p>
              );
            })()}
            {reliabilityResults && (() => {
              const alpha = reliabilityResults.tables?.[0]?.rows?.[0]?.["Cronbach's Alpha"];
              return alpha ? (
                <p className="mt-2">The internal consistency of the scale was assessed using Cronbach's alpha. The reliability coefficient was α = {Number(alpha).toFixed(3)}, indicating {interpretAlpha(Number(alpha)).toLowerCase()} internal consistency.</p>
              ) : null;
            })()}
          </CardContent>
        </Card>
      )}

      {/* Tutorial */}
      <Collapsible open={tutorialOpen} onOpenChange={setTutorialOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <Info className="w-4 h-4" /> Understanding EFA & Reliability {tutorialOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 p-4 bg-muted/30 rounded-lg text-sm space-y-2">
          <p><strong>KMO</strong>: Measures sampling adequacy. Values ≥ .60 are acceptable for factor analysis.</p>
          <p><strong>Bartlett's Test</strong>: Tests if the correlation matrix differs from identity. Must be significant (p &lt; .05).</p>
          <p><strong>Eigenvalue &gt; 1 Rule</strong>: Factors with eigenvalues above 1 explain more variance than a single variable.</p>
          <p><strong>Factor Loadings ≥ .40</strong>: Items loading ≥ .40 on a factor are meaningfully associated with it.</p>
          <p><strong>Cronbach's α ≥ .70</strong>: Indicates acceptable internal consistency for research purposes.</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
