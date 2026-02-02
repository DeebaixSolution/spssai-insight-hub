import { useState } from 'react';
import { Play, Loader2, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AnalysisConfig, AnalysisResults, ParsedDataset } from '@/hooks/useAnalysisWizard';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ScatterChart, Scatter } from 'recharts';

interface Step5ResultsProps {
  analysisConfig: AnalysisConfig | null;
  parsedData: ParsedDataset | null;
  results: AnalysisResults | null;
  onResultsChange: (results: AnalysisResults) => void;
}

export function Step5Results({ analysisConfig, parsedData, results, onResultsChange }: Step5ResultsProps) {
  const { isPro } = usePlanLimits();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRun = analysisConfig && analysisConfig.dependentVariables.length > 0 &&
    (analysisConfig.independentVariables.length > 0 || analysisConfig.groupingVariable ||
      ['frequencies', 'descriptives', 'pearson', 'cronbach-alpha'].includes(analysisConfig.testType));

  const runAnalysis = async () => {
    if (!canRun || !parsedData || !analysisConfig) return;
    setIsRunning(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('run-analysis', {
        body: {
          testType: analysisConfig.testType,
          testCategory: analysisConfig.testCategory,
          dependentVariables: analysisConfig.dependentVariables,
          independentVariables: analysisConfig.independentVariables,
          groupingVariable: analysisConfig.groupingVariable,
          data: parsedData.rows,
          options: analysisConfig.options,
          isPro,
        },
      });
      if (fnError) throw fnError;
      if (data?.results) {
        onResultsChange(data.results);
        toast.success('Analysis complete!');
      } else throw new Error('No results returned');
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed.');
      toast.error('Analysis failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {!results && (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            {isRunning ? <Loader2 className="w-8 h-8 text-primary animate-spin" /> : <Play className="w-8 h-8 text-primary" />}
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">{isRunning ? 'Running Analysis...' : 'Ready to Analyze'}</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            {analysisConfig ? `${analysisConfig.testType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}` : 'Configure your analysis first'}
          </p>
          <Button variant="hero" size="lg" onClick={runAnalysis} disabled={!canRun || isRunning}>
            {isRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><Play className="w-4 h-4 mr-2" />Run Analysis</>}
          </Button>
        </div>
      )}
      {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {results && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 bg-success/10 rounded-lg">
            <CheckCircle className="w-6 h-6 text-success" />
            <div><h3 className="font-medium text-foreground">Analysis Complete</h3><p className="text-sm text-muted-foreground">{results.summary}</p></div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={runAnalysis}>Re-run</Button>
          </div>
          <Tabs defaultValue="tables">
            <TabsList>
              <TabsTrigger value="tables">Tables</TabsTrigger>
              {results.charts && results.charts.length > 0 && <TabsTrigger value="charts">Charts</TabsTrigger>}
            </TabsList>
            <TabsContent value="tables" className="space-y-4">
              {results.tables.map((table, index) => (
                <div key={index} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 font-medium text-sm">{table.title}</div>
                  <ScrollArea className="w-full">
                    <table className="w-full text-sm">
                      <thead><tr>{table.headers.map((h, i) => <th key={i} className="bg-muted/50 p-3 text-left font-medium border-b">{h}</th>)}</tr></thead>
                      <tbody>{table.rows.map((row, ri) => <tr key={ri} className="hover:bg-muted/30">{table.headers.map((h, ci) => <td key={ci} className="p-3 border-b border-border/50">{formatValue(row[h])}</td>)}</tr>)}</tbody>
                    </table>
                  </ScrollArea>
                </div>
              ))}
            </TabsContent>
            {results.charts && results.charts.length > 0 && (
              <TabsContent value="charts" className="space-y-4">
                {results.charts.map((chart, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h4 className="font-medium text-foreground mb-4">{chart.title}</h4>
                    <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%">{renderChart(chart)}</ResponsiveContainer></div>
                  </div>
                ))}
              </TabsContent>
            )}
          </Tabs>
          {!isPro && <Alert><BarChart3 className="h-4 w-4" /><AlertDescription>Upgrade to Pro for effect sizes and advanced visualizations.</AlertDescription></Alert>}
        </div>
      )}
    </div>
  );
}

function formatValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? v.toString() : v.toFixed(3);
  return String(v);
}

function renderChart(chart: { type: string; data: unknown; title: string }) {
  const d = chart.data as Record<string, unknown>[];
  switch (chart.type) {
    case 'bar': return <BarChart data={d}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="value" fill="hsl(var(--primary))" /></BarChart>;
    case 'line': return <LineChart data={d}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" /></LineChart>;
    case 'scatter': return <ScatterChart><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="x" /><YAxis dataKey="y" /><Tooltip /><Scatter data={d} fill="hsl(var(--primary))" /></ScatterChart>;
    default: return <BarChart data={d}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="hsl(var(--primary))" /></BarChart>;
  }
}
