import { useState, useMemo } from 'react';
import { TrendingUp, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, LineChart, Line
} from 'recharts';
import type { Variable } from '@/types/analysis';

interface Step9RegressionProps {
  variables: Variable[];
  parsedData: { rows: Record<string, unknown>[] } | null;
  analysisId?: string | null;
  hypotheses?: Array<{ id: string; hypothesisId: string; statement: string }>;
}

export function Step9Regression({ variables, parsedData, analysisId, hypotheses = [] }: Step9RegressionProps) {
  const [modelType, setModelType] = useState('simple-linear');
  const [dv, setDv] = useState('');
  const [selectedIVs, setSelectedIVs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const scaleVars = useMemo(() => variables.filter(v => v.measure === 'scale'), [variables]);
  const nominalVars = useMemo(() => variables.filter(v => v.measure === 'nominal'), [variables]);
  const allPredictorVars = useMemo(() => variables.filter(v => v.name !== dv), [variables, dv]);

  // Detect if DV is binary
  const dvIsBinary = useMemo(() => {
    if (!dv || !parsedData) return false;
    const vals = new Set(parsedData.rows.map(r => r[dv]).filter(v => v !== null && v !== undefined));
    return vals.size === 2;
  }, [dv, parsedData]);

  const toggleIV = (name: string) => {
    setSelectedIVs(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const runAnalysis = async () => {
    if (!dv || !parsedData) return;
    setLoading(true);
    try {
      let testType = '';
      if (modelType === 'simple-linear') testType = 'simple-linear-regression';
      else if (modelType === 'multiple-linear') testType = 'multiple-linear-regression';
      else testType = 'binary-logistic-regression';

      const ivs = modelType === 'simple-linear' ? [selectedIVs[0]] : selectedIVs;
      if (!ivs.length || !ivs[0]) { toast.error('Select predictor variable(s)'); setLoading(false); return; }

      const { data, error } = await supabase.functions.invoke('run-analysis', {
        body: { testType, dependentVariables: [dv], independentVariables: ivs, data: parsedData.rows },
      });
      if (error) throw error;
      setResults({ modelType, ...data.results });
      toast.success('Regression analysis completed');
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
                  return (
                    <td key={h} className="border border-border/30 px-3 py-1.5 text-right tabular-nums">
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

  const renderVIFWarnings = () => {
    if (!results?.tables) return null;
    const coefTable = results.tables.find((t: any) => t.title === 'Coefficients');
    if (!coefTable) return null;
    const warnings = coefTable.rows.filter((r: any) => typeof r.VIF === 'number' && r.VIF > 5);
    if (!warnings.length) return null;
    return (
      <Card className="border-destructive/50 bg-destructive/5 mt-3">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4" />
            <strong>Multicollinearity Warning</strong>
          </div>
          {warnings.map((w: any, i: number) => (
            <p key={i} className="text-xs text-muted-foreground mt-1">
              {w[''] ?? 'Variable'}: VIF = {Number(w.VIF).toFixed(2)} ({Number(w.VIF) > 10 ? 'Severe' : 'Moderate'})
            </p>
          ))}
        </CardContent>
      </Card>
    );
  };

  const renderCharts = () => {
    if (!results?.charts?.length) return null;
    return results.charts.map((chart: any, idx: number) => {
      if (chart.type === 'scatter' && Array.isArray(chart.data)) {
        return (
          <div key={idx} className="mt-4">
            <h4 className="text-sm font-semibold mb-2">{chart.title}</h4>
            <ResponsiveContainer width="100%" height={250}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" />
                <YAxis type="number" dataKey="y" />
                <RechartsTooltip />
                <Scatter data={chart.data.slice(0, 200)} fill="hsl(var(--primary))" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        );
      }
      if (chart.type === 'line' && chart.title === 'ROC Curve') {
        return (
          <div key={idx} className="mt-4">
            <h4 className="text-sm font-semibold mb-2">ROC Curve</h4>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chart.data} margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="fpr" domain={[0, 1]} label={{ value: 'False Positive Rate', position: 'bottom' }} />
                <YAxis type="number" dataKey="tpr" domain={[0, 1]} label={{ value: 'True Positive Rate', angle: -90, position: 'left' }} />
                <RechartsTooltip />
                <Area type="monotone" dataKey="tpr" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      }
      return null;
    });
  };

  const renderAcademicReport = () => {
    if (!results?.tables?.length) return null;
    const modelSummary = results.tables.find((t: any) => t.title === 'Model Summary');
    const anova = results.tables.find((t: any) => t.title === 'ANOVA');

    if (results.modelType === 'simple-linear' || results.modelType === 'multiple-linear') {
      const r2 = modelSummary?.rows?.[0]?.['R Square'] ?? 0;
      const f = anova?.rows?.[0]?.F ?? 0;
      const pF = anova?.rows?.[0]?.['Sig.'] ?? 1;
      const dfReg = anova?.rows?.[0]?.df ?? 1;
      const dfRes = anova?.rows?.[1]?.df ?? 1;
      const sig = Number(pF) < 0.05 ? 'statistically significant' : 'not statistically significant';

      return (
        <Card className="mt-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Academic Report</CardTitle></CardHeader>
          <CardContent className="text-sm leading-relaxed">
            <p>A {results.modelType === 'simple-linear' ? 'simple' : 'multiple'} linear regression was conducted to predict {dv} from {selectedIVs.join(', ')}. The overall model was {sig}, <em>F</em>({Number(dfReg).toFixed(0)}, {Number(dfRes).toFixed(0)}) = {Number(f).toFixed(3)}, <em>p</em> = {Number(pF) < 0.001 ? '< .001' : Number(pF).toFixed(3)}, explaining {(Number(r2) * 100).toFixed(1)}% of the variance (R² = {Number(r2).toFixed(3)}).</p>
          </CardContent>
        </Card>
      );
    }

    if (results.modelType === 'logistic') {
      const omnibus = results.tables.find((t: any) => t.title?.includes('Omnibus'));
      const chi = omnibus?.rows?.[0]?.['Chi-square'] ?? 0;
      const pOmn = omnibus?.rows?.[0]?.['Sig.'] ?? 1;
      const nag = modelSummary?.rows?.[0]?.["Nagelkerke R²"] ?? 0;

      return (
        <Card className="mt-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Academic Report</CardTitle></CardHeader>
          <CardContent className="text-sm leading-relaxed">
            <p>A binary logistic regression was performed to predict {dv}. The model was {Number(pOmn) < 0.05 ? 'statistically significant' : 'not significant'}, χ²({selectedIVs.length}) = {Number(chi).toFixed(3)}, <em>p</em> = {Number(pOmn) < 0.001 ? '< .001' : Number(pOmn).toFixed(3)}, Nagelkerke R² = {Number(nag).toFixed(3)}.</p>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Regression Modeling Engine</h2>
        <Badge variant="secondary">Step 9</Badge>
      </div>

      {/* Model selection */}
      <Tabs value={modelType} onValueChange={setModelType}>
        <TabsList>
          <TabsTrigger value="simple-linear">Simple Linear</TabsTrigger>
          <TabsTrigger value="multiple-linear">Multiple Linear</TabsTrigger>
          <TabsTrigger value="logistic">Binary Logistic</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* DV selection */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Dependent Variable (Outcome)</label>
        <Select value={dv} onValueChange={(v) => { setDv(v); setSelectedIVs([]); }}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Select DV..." /></SelectTrigger>
          <SelectContent>
            {(modelType === 'logistic' ? [...nominalVars, ...scaleVars] : scaleVars).map(v => (
              <SelectItem key={v.name} value={v.name}>{v.name} ({v.measure})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {modelType === 'logistic' && dv && !dvIsBinary && (
          <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> DV should be binary (0/1) for logistic regression</p>
        )}
      </div>

      {/* IV selection */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Predictor Variable(s) {modelType === 'simple-linear' ? '(select 1)' : '(select 2+)'}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
          {allPredictorVars.map(v => (
            <label key={v.name} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={selectedIVs.includes(v.name)}
                onCheckedChange={() => {
                  if (modelType === 'simple-linear') setSelectedIVs([v.name]);
                  else toggleIV(v.name);
                }}
              />
              <span className="truncate">{v.name}</span>
              <Badge variant="outline" className="text-xs">{v.measure}</Badge>
            </label>
          ))}
        </div>
      </div>

      <Button onClick={runAnalysis} disabled={loading || !dv || selectedIVs.length === 0}>
        {loading ? 'Running...' : 'Run Regression'}
      </Button>

      {/* Results */}
      {results?.tables?.map((t: any) => renderTable(t))}
      {renderVIFWarnings()}
      {renderCharts()}
      {renderAcademicReport()}

      {/* Tutorial */}
      <Collapsible open={tutorialOpen} onOpenChange={setTutorialOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <Info className="w-4 h-4" /> Understanding Regression {tutorialOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 p-4 bg-muted/30 rounded-lg text-sm space-y-2">
          <p><strong>R²</strong> indicates how much variance in the DV is explained by the predictors.</p>
          <p><strong>VIF &gt; 10</strong> indicates severe multicollinearity — predictors are too correlated.</p>
          <p><strong>Exp(B)</strong> in logistic regression: odds ratio. Exp(B)=1.5 means 50% increase in odds.</p>
          <p><strong>ROC AUC</strong>: .5 = chance, .7-.8 = good, .8-.9 = very good, &gt;.9 = excellent.</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
