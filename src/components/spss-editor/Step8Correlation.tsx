import { useState, useMemo } from 'react';
import { Link2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import type { Variable } from '@/types/analysis';

interface Step8CorrelationProps {
  variables: Variable[];
  parsedData: { rows: Record<string, unknown>[] } | null;
  analysisId?: string | null;
  hypotheses?: Array<{ id: string; hypothesisId: string; statement: string }>;
}

function classifyStrength(r: number): string {
  const a = Math.abs(r);
  if (a < 0.1) return 'Negligible';
  if (a < 0.3) return 'Weak';
  if (a < 0.5) return 'Moderate';
  if (a < 0.7) return 'Strong';
  return 'Very Strong';
}

function getDirection(r: number): string {
  if (r > 0.01) return 'Positive';
  if (r < -0.01) return 'Negative';
  return 'None';
}

function getHeatColor(r: number): string {
  if (r > 0.7) return 'hsl(210, 80%, 40%)';
  if (r > 0.3) return 'hsl(210, 60%, 60%)';
  if (r > 0.1) return 'hsl(210, 40%, 75%)';
  if (r > -0.1) return 'hsl(0, 0%, 90%)';
  if (r > -0.3) return 'hsl(0, 40%, 75%)';
  if (r > -0.7) return 'hsl(0, 60%, 60%)';
  return 'hsl(0, 80%, 40%)';
}

export function Step8Correlation({ variables, parsedData, analysisId, hypotheses = [] }: Step8CorrelationProps) {
  const [mode, setMode] = useState('pairwise');
  const [varA, setVarA] = useState('');
  const [varB, setVarB] = useState('');
  const [dvVar, setDvVar] = useState('');
  const [method, setMethod] = useState<'auto' | 'pearson' | 'spearman'>('auto');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const scaleVars = useMemo(() => variables.filter(v => v.measure === 'scale'), [variables]);

  const runPairwise = async () => {
    if (!varA || !varB || !parsedData) return;
    setLoading(true);
    try {
      const testType = method === 'spearman' ? 'spearman' : method === 'pearson' ? 'pearson' : 'pearson';
      const { data, error } = await supabase.functions.invoke('run-analysis', {
        body: { testType, dependentVariables: [varA, varB], independentVariables: [], data: parsedData.rows },
      });
      if (error) throw error;
      setResults({ mode: 'pairwise', ...data.results });
      toast.success('Pairwise correlation computed');
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const runMatrix = async () => {
    if (!parsedData || scaleVars.length < 2) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-analysis', {
        body: {
          testType: 'correlation-matrix',
          dependentVariables: scaleVars.map(v => v.name),
          independentVariables: [],
          data: parsedData.rows,
          options: { method: method === 'auto' ? 'pearson' : method },
        },
      });
      if (error) throw error;
      setResults({ mode: 'matrix', ...data.results });
      toast.success('Correlation matrix computed');
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const runDvCentered = async () => {
    if (!dvVar || !parsedData) return;
    setLoading(true);
    try {
      const ivs = scaleVars.filter(v => v.name !== dvVar).map(v => v.name);
      const { data, error } = await supabase.functions.invoke('run-analysis', {
        body: {
          testType: 'dv-centered-correlation',
          dependentVariables: [dvVar],
          independentVariables: ivs,
          data: parsedData.rows,
          options: { method: method === 'auto' ? 'pearson' : method },
        },
      });
      if (error) throw error;
      setResults({ mode: 'dv-centered', ...data.results });
      toast.success('DV-centered correlations computed');
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
                {table.headers.map((h: string) => (
                  <td key={h} className="border border-border/30 px-3 py-1.5 text-right tabular-nums">
                    {typeof row[h] === 'number' ? Number(row[h]).toFixed(3) : String(row[h] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderHeatmap = () => {
    if (!results?.charts?.[0]?.data) return null;
    const heatData = results.charts[0].data as Array<{ var1: string; var2: string; r: number; p: number }>;
    if (!heatData.length) return null;
    const allVars = [...new Set(heatData.flatMap(d => [d.var1, d.var2]))];

    return (
      <div className="mt-4">
        <h4 className="text-sm font-semibold mb-2">Correlation Heatmap</h4>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead><tr><th className="px-2 py-1"></th>{allVars.map(v => <th key={v} className="px-2 py-1 text-center max-w-[80px] truncate">{v}</th>)}</tr></thead>
            <tbody>
              {allVars.map(v1 => (
                <tr key={v1}>
                  <td className="px-2 py-1 font-medium max-w-[80px] truncate">{v1}</td>
                  {allVars.map(v2 => {
                    if (v1 === v2) return <td key={v2} className="px-2 py-1 text-center font-bold" style={{ background: 'hsl(210, 80%, 40%)', color: 'white' }}>1.00</td>;
                    const cell = heatData.find(d => (d.var1 === v1 && d.var2 === v2) || (d.var1 === v2 && d.var2 === v1));
                    const r = cell?.r ?? 0;
                    return <td key={v2} className="px-2 py-1 text-center text-xs" style={{ background: getHeatColor(r), color: Math.abs(r) > 0.5 ? 'white' : 'inherit' }}>{r.toFixed(2)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span className="inline-block w-4 h-3" style={{ background: 'hsl(0, 80%, 40%)' }} /> Strong -
          <span className="inline-block w-4 h-3" style={{ background: 'hsl(0, 0%, 90%)' }} /> None
          <span className="inline-block w-4 h-3" style={{ background: 'hsl(210, 80%, 40%)' }} /> Strong +
        </div>
      </div>
    );
  };

  const renderScatter = () => {
    if (!results?.charts) return null;
    const scatter = results.charts.find((c: any) => c.data && Array.isArray(c.data) && c.data[0]?.x !== undefined);
    if (!scatter) return null;
    return (
      <div className="mt-4">
        <h4 className="text-sm font-semibold mb-2">{scatter.title}</h4>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name="X" />
            <YAxis type="number" dataKey="y" name="Y" />
            <RechartsTooltip />
            <Scatter data={scatter.data.slice(0, 200)} fill="hsl(var(--primary))" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderAcademicReport = () => {
    if (!results?.tables?.length) return null;
    const tbl = results.tables[0];
    if (!tbl.rows?.length) return null;
    const row = tbl.rows[0];
    const r = row['Coefficient'] ?? row['Pearson r'] ?? row["Spearman's rho"] ?? 0;
    const p = row['Sig. (2-tailed)'] ?? 1;
    const n = row['N'] ?? 0;
    const v1 = row['Variable 1'] ?? row['IV'] ?? varA;
    const v2 = row['Variable 2'] ?? row['DV'] ?? varB;
    const sig = Number(p) < 0.05 ? 'significant' : 'non-significant';
    const dir = getDirection(Number(r));
    const strength = classifyStrength(Number(r));

    return (
      <Card className="mt-4">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Academic Report Preview</CardTitle></CardHeader>
        <CardContent className="text-sm leading-relaxed">
          <p>A {method === 'spearman' ? 'Spearman rank-order' : 'Pearson'} correlation was conducted to examine the relationship between {v1} and {v2}. There was a {sig} {dir.toLowerCase()} correlation, {method === 'spearman' ? 'ρ' : 'r'}({Number(n) - 2}) = {Number(r).toFixed(3)}, <em>p</em> = {Number(p) < 0.001 ? '< .001' : Number(p).toFixed(3)}, indicating a {strength.toLowerCase()} association.</p>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Correlation Intelligence Module</h2>
        <Badge variant="secondary">Step 8</Badge>
      </div>

      {/* Method selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Method:</span>
        <Select value={method} onValueChange={(v) => setMethod(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-detect</SelectItem>
            <SelectItem value="pearson">Pearson</SelectItem>
            <SelectItem value="spearman">Spearman</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={mode} onValueChange={setMode}>
        <TabsList>
          <TabsTrigger value="pairwise">Pairwise</TabsTrigger>
          <TabsTrigger value="matrix">Full Matrix</TabsTrigger>
          <TabsTrigger value="dv-centered">DV-Centered</TabsTrigger>
        </TabsList>

        <TabsContent value="pairwise" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Variable A</label>
              <Select value={varA} onValueChange={setVarA}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{scaleVars.map(v => <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Variable B</label>
              <Select value={varB} onValueChange={setVarB}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{scaleVars.filter(v => v.name !== varA).map(v => <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={runPairwise} disabled={loading || !varA || !varB}>{loading ? 'Computing...' : 'Run Correlation'}</Button>
        </TabsContent>

        <TabsContent value="matrix" className="space-y-3">
          <p className="text-sm text-muted-foreground">Computes pairwise correlations for all {scaleVars.length} scale variables.</p>
          <Button onClick={runMatrix} disabled={loading || scaleVars.length < 2}>{loading ? 'Computing...' : 'Generate Matrix'}</Button>
        </TabsContent>

        <TabsContent value="dv-centered" className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Dependent Variable</label>
            <Select value={dvVar} onValueChange={setDvVar}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select DV..." /></SelectTrigger>
              <SelectContent>{scaleVars.map(v => <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={runDvCentered} disabled={loading || !dvVar}>{loading ? 'Computing...' : 'Run DV Analysis'}</Button>
        </TabsContent>
      </Tabs>

      {/* Results */}
      {results?.tables?.map((t: any) => renderTable(t))}
      {results?.mode === 'matrix' && renderHeatmap()}
      {results?.mode === 'pairwise' && renderScatter()}
      {(results?.mode === 'pairwise' || results?.mode === 'dv-centered') && renderAcademicReport()}

      {/* Tutorial */}
      <Collapsible open={tutorialOpen} onOpenChange={setTutorialOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <Info className="w-4 h-4" /> Understanding Correlation {tutorialOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 p-4 bg-muted/30 rounded-lg text-sm space-y-2">
          <p><strong>Pearson r</strong> measures linear relationships between continuous variables. Requires normality and linearity.</p>
          <p><strong>Spearman ρ</strong> measures monotonic relationships using ranks. Use when normality is violated or data is ordinal.</p>
          <p><strong>Interpreting r:</strong> |r| &lt; .10 = negligible, .10–.29 = weak, .30–.49 = moderate, .50–.69 = strong, ≥ .70 = very strong.</p>
          <p><strong>p-value:</strong> If p &lt; .05, the correlation is statistically significant (unlikely due to chance).</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
