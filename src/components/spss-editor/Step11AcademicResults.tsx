import { useState, useEffect, useMemo } from 'react';
import { BookOpen, CheckCircle, AlertCircle, FileText, RefreshCw, Save, Wand2, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ScatterChart, Scatter, LineChart, Line,
  ComposedChart, ReferenceLine, AreaChart, Area
} from 'recharts';

interface Step11Props {
  analysisId?: string | null;
  projectId?: string | null;
}

interface AnalysisBlockData {
  id: string;
  section: string;
  test_type: string;
  test_category: string;
  results: any;
  narrative: any;
  status: string;
  display_order: number;
}

interface ChapterSection {
  id: string;
  title: string;
  number: string;
  content: string;
  tables: any[];
  hasSavedData: boolean;
}

const CHAPTER_SECTIONS = [
  { id: 'sample', number: '4.1', title: 'Sample Description' },
  { id: 'measurement', number: '4.2', title: 'Measurement Model' },
  { id: 'descriptive', number: '4.3', title: 'Descriptive Statistics' },
  { id: 'reliability', number: '4.4', title: 'Reliability and Validity' },
  { id: 'correlation', number: '4.5', title: 'Correlation Analysis' },
  { id: 'regression', number: '4.6', title: 'Regression Model' },
  { id: 'hypothesis', number: '4.7', title: 'Hypothesis Testing' },
  { id: 'diagnostics', number: '4.8', title: 'Model Diagnostics' },
  { id: 'integrated', number: '4.9', title: 'Integrated Findings' },
  { id: 'summary', number: '4.10', title: 'Summary' },
];

const sectionCategoryMap: Record<string, string[]> = {
  sample: ['descriptive', 'normality'],
  measurement: ['factor-analysis', 'measurement-validation'],
  descriptive: ['descriptive', 'normality'],
  reliability: ['reliability', 'measurement-validation'],
  correlation: ['correlation'],
  regression: ['regression'],
  hypothesis: ['compare-means', 'nonparametric', 'anova', 'anova-glm', 'parametric'],
  diagnostics: ['regression'],
  integrated: [],
  summary: [],
};

const CORRELATION_TEST_TYPES = ['spearman', 'pearson', 'kendall', 'partial-correlation', 'point-biserial'];
const RELIABILITY_TEST_TYPES = ['cronbach-alpha', 'factor-analysis', 'efa', 'cfa', 'composite-reliability'];
const REGRESSION_TEST_TYPES_PATTERN = 'regression';

export function Step11AcademicResults({ analysisId, projectId }: Step11Props) {
  const [blocks, setBlocks] = useState<AnalysisBlockData[]>([]);
  const [hypotheses, setHypotheses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [generatedSections, setGeneratedSections] = useState<ChapterSection[]>([]);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [savedChapter, setSavedChapter] = useState<any>(null);

  useEffect(() => {
    if (!analysisId) return;
    fetchData();
  }, [analysisId]);

  const fetchData = async () => {
    if (!analysisId) return;
    setIsLoading(true);
    try {
      const [blocksRes, hypRes, chapterRes] = await Promise.all([
        supabase.from('analysis_blocks').select('*').eq('analysis_id', analysisId).order('display_order'),
        supabase.from('hypotheses').select('*').eq('analysis_id', analysisId),
        supabase.from('chapter_results').select('*').eq('analysis_id', analysisId).order('created_at', { ascending: false }).limit(1),
      ]);

      if (blocksRes.data) setBlocks(blocksRes.data);
      if (hypRes.data) setHypotheses(hypRes.data);
      if (chapterRes.data?.[0]) {
        setSavedChapter(chapterRes.data[0]);
        const mapping = chapterRes.data[0].section_mapping as Record<string, unknown> | undefined;
        if (mapping) {
          const restored = CHAPTER_SECTIONS.map(s => ({
            id: s.id, title: s.title, number: s.number,
            content: typeof mapping[s.id] === 'string' ? mapping[s.id] as string : JSON.stringify(mapping[s.id] ?? ''),
            tables: getBlocksForSection(s.id, blocksRes.data || []),
            hasSavedData: !!mapping[s.id],
          }));
          setGeneratedSections(restored);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getBlocksForSection = (sectionId: string, allBlocks: AnalysisBlockData[]): AnalysisBlockData[] => {
    const categories = sectionCategoryMap[sectionId] || [];
    return allBlocks.filter(b => {
      if (b.status === 'pending') return false;
      if (categories.includes(b.test_category)) return true;
      if (sectionId === 'correlation' && CORRELATION_TEST_TYPES.includes(b.test_type)) return true;
      if (sectionId === 'reliability' && RELIABILITY_TEST_TYPES.includes(b.test_type)) return true;
      if ((sectionId === 'regression' || sectionId === 'diagnostics') && b.test_type?.includes(REGRESSION_TEST_TYPES_PATTERN)) return true;
      return false;
    });
  };

  const stepStatus = useMemo(() => {
    const completedBlocks = blocks.filter(b => b.status !== 'pending');
    const categories = new Set(completedBlocks.map(b => b.test_category));
    const testTypes = new Set(completedBlocks.map(b => b.test_type));
    return {
      descriptive: categories.has('descriptive') || categories.has('normality'),
      reliability: categories.has('reliability') || categories.has('measurement-validation') ||
        RELIABILITY_TEST_TYPES.some(t => testTypes.has(t)),
      correlation: categories.has('correlation') ||
        CORRELATION_TEST_TYPES.some(t => testTypes.has(t)),
      regression: categories.has('regression') ||
        Array.from(testTypes).some(t => t?.includes(REGRESSION_TEST_TYPES_PATTERN)),
      hypothesis: completedBlocks.some(b => ['compare-means', 'nonparametric', 'anova', 'anova-glm', 'parametric'].includes(b.test_category)),
      diagnostics: categories.has('regression') ||
        Array.from(testTypes).some(t => t?.includes(REGRESSION_TEST_TYPES_PATTERN)),
    };
  }, [blocks]);

  const handleGenerate = async () => {
    if (!analysisId) { toast.error('No analysis ID found.'); return; }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-chapter4', {
        body: {
          analysisId,
          blocks: blocks.map(b => ({ id: b.id, section: b.section, test_type: b.test_type, test_category: b.test_category, results: b.results, narrative: b.narrative, status: b.status })),
          hypotheses: hypotheses.map(h => ({ id: h.id, hypothesis_id: h.hypothesis_id, statement: h.statement, status: h.status, hypothesis_type: h.hypothesis_type })),
        },
      });
      if (error) throw error;
      if (data?.sections) {
        const sections: ChapterSection[] = CHAPTER_SECTIONS.map(s => ({
          id: s.id, title: s.title, number: s.number,
          content: data.sections[s.id] || '',
          tables: getBlocksForSection(s.id, blocks),
          hasSavedData: true,
        }));
        setGeneratedSections(sections);
        setActiveTab('editor');
        toast.success('Chapter 4 generated! Auto-saving...');
        const sectionMapping: Record<string, string> = {};
        sections.forEach(s => { sectionMapping[s.id] = s.content; });
        const fullText = sections.map(s => `## ${s.number} ${s.title}\n\n${s.content}`).join('\n\n');
        const record = { analysis_id: analysisId, full_text: fullText, section_mapping: sectionMapping as any, version: (savedChapter?.version || 0) + 1 };
        if (savedChapter?.id) {
          await supabase.from('chapter_results').update(record).eq('id', savedChapter.id);
        } else {
          await supabase.from('chapter_results').insert([record]);
        }
        fetchData();
      }
    } catch (err) {
      console.error('Generation error:', err);
      toast.error('Failed to generate Chapter 4.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateSection = async (sectionId: string) => {
    if (!analysisId) return;
    setRegeneratingSection(sectionId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-chapter4', {
        body: {
          analysisId, sectionId,
          blocks: blocks.map(b => ({ id: b.id, section: b.section, test_type: b.test_type, test_category: b.test_category, results: b.results, narrative: b.narrative, status: b.status })),
          hypotheses: hypotheses.map(h => ({ id: h.id, hypothesis_id: h.hypothesis_id, statement: h.statement, status: h.status, hypothesis_type: h.hypothesis_type })),
        },
      });
      if (error) throw error;
      if (data?.sections?.[sectionId]) {
        setGeneratedSections(prev => prev.map(s => s.id === sectionId ? { ...s, content: data.sections[sectionId] } : s));
        toast.success(`Section ${sectionId} regenerated!`);
      }
    } catch (err) {
      toast.error('Failed to regenerate section.');
    } finally {
      setRegeneratingSection(null);
    }
  };

  const handleSave = async () => {
    if (!analysisId) return;
    try {
      const sectionMapping: Record<string, string> = {};
      generatedSections.forEach(s => { sectionMapping[s.id] = s.content; });
      const fullText = generatedSections.map(s => `## ${s.number} ${s.title}\n\n${s.content}`).join('\n\n');
      const record = { analysis_id: analysisId, full_text: fullText, section_mapping: sectionMapping as any, version: (savedChapter?.version || 0) + 1 };
      if (savedChapter?.id) {
        await supabase.from('chapter_results').update(record).eq('id', savedChapter.id);
      } else {
        await supabase.from('chapter_results').insert([record]);
      }
      toast.success('Chapter 4 saved!');
      fetchData();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save chapter.');
    }
  };

  const updateSectionContent = (sectionId: string, content: string) => {
    setGeneratedSections(prev => prev.map(s => s.id === sectionId ? { ...s, content } : s));
  };

  const resolveCell = (row: any, header: string): any => {
    if (row[header] !== undefined) return row[header];
    const keys = Object.keys(row);
    const found = keys.find(k => k.toLowerCase() === header.toLowerCase());
    return found ? row[found] : '';
  };

  // Render charts from block results
  const renderBlockCharts = (block: AnalysisBlockData) => {
    const charts = block.results?.charts;
    if (!charts?.length) return null;
    return charts.map((chart: any, idx: number) => {
      if (!chart?.data) return null;
      if (chart.type === 'histogram' && chart.data?.bins) {
        const histData = chart.data.bins.map((b: any) => ({ name: ((b.binStart + b.binEnd) / 2).toFixed(1), count: b.count, normal: b.normalExpected }));
        return (<div key={`${block.id}-ch-${idx}`} className="my-3"><p className="text-xs font-semibold text-muted-foreground italic mb-1">{chart.title}</p><ResponsiveContainer width="100%" height={200}><ComposedChart data={histData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><RechartsTooltip contentStyle={{ fontSize: 11 }} /><Bar dataKey="count" fill="hsl(var(--accent))" opacity={0.7} name="Observed" /><Line type="monotone" dataKey="normal" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name="Normal Curve" /></ComposedChart></ResponsiveContainer></div>);
      }
      if (chart.type === 'qq-plot' && Array.isArray(chart.data)) {
        return (<div key={`${block.id}-ch-${idx}`} className="my-3"><p className="text-xs font-semibold text-muted-foreground italic mb-1">{chart.title}</p><ResponsiveContainer width="100%" height={200}><ScatterChart><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" dataKey="theoretical" tick={{ fontSize: 10 }} /><YAxis type="number" dataKey="observed" tick={{ fontSize: 10 }} /><RechartsTooltip /><Scatter data={chart.data} fill="hsl(var(--primary))" r={2} /></ScatterChart></ResponsiveContainer></div>);
      }
      if (chart.type === 'boxplot' && chart.data) {
        const bp = chart.data;
        return (<div key={`${block.id}-ch-${idx}`} className="my-3"><p className="text-xs font-semibold text-muted-foreground italic mb-1">{chart.title}</p><div className="text-xs p-3 border rounded-lg bg-muted/30 w-fit space-y-0.5">{[['Max', bp.max], ['Q3', bp.q3], ['Median', bp.median], ['Mean', bp.mean], ['Q1', bp.q1], ['Min', bp.min]].map(([l, v]: any) => <div key={l} className="flex justify-between gap-4"><span className="text-muted-foreground">{l}:</span><span className="font-mono">{typeof v === 'number' ? v.toFixed(2) : '-'}</span></div>)}{bp.outliers?.length > 0 && <div className="text-destructive font-medium">{bp.outliers.length} outlier(s)</div>}</div></div>);
      }
      if (chart.type === 'scatter' && Array.isArray(chart.data)) {
        return (<div key={`${block.id}-ch-${idx}`} className="my-3"><p className="text-xs font-semibold text-muted-foreground italic mb-1">{chart.title}</p><ResponsiveContainer width="100%" height={200}><ScatterChart><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" dataKey="x" tick={{ fontSize: 10 }} /><YAxis type="number" dataKey="y" tick={{ fontSize: 10 }} /><RechartsTooltip /><Scatter data={chart.data.slice(0, 200)} fill="hsl(var(--primary))" /></ScatterChart></ResponsiveContainer></div>);
      }
      if (chart.type === 'bar' && Array.isArray(chart.data)) {
        const dk = Object.keys(chart.data[0] || {}).find((k: string) => !['group','name','label'].includes(k)) || 'mean';
        const lk = Object.keys(chart.data[0] || {}).find((k: string) => ['group','name','label'].includes(k)) || 'group';
        return (<div key={`${block.id}-ch-${idx}`} className="my-3"><p className="text-xs font-semibold text-muted-foreground italic mb-1">{chart.title}</p><ResponsiveContainer width="100%" height={200}><BarChart data={chart.data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={lk} tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><RechartsTooltip /><Bar dataKey={dk} fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer></div>);
      }
      if ((chart.type === 'line' || chart.type === 'scree') && Array.isArray(chart.data)) {
        const yk = Object.keys(chart.data[0] || {}).find((k: string) => ['eigenvalue','tpr','y','value'].includes(k)) || 'value';
        const xk = Object.keys(chart.data[0] || {}).find((k: string) => ['component','fpr','x','name'].includes(k)) || 'name';
        return (<div key={`${block.id}-ch-${idx}`} className="my-3"><p className="text-xs font-semibold text-muted-foreground italic mb-1">{chart.title}</p><ResponsiveContainer width="100%" height={200}><LineChart data={chart.data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={xk} tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><RechartsTooltip />{chart.type === 'scree' && <ReferenceLine y={1} stroke="hsl(var(--destructive))" strokeDasharray="5 5" />}<Line type="monotone" dataKey={yk} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>);
      }
      if (chart.type === 'heatmap' && Array.isArray(chart.data)) {
        const hd = chart.data as Array<{ var1: string; var2: string; r: number }>;
        const vars = [...new Set(hd.flatMap((d: any) => [d.var1, d.var2]))];
        const gc = (r: number) => r > 0.7 ? 'hsl(210,80%,40%)' : r > 0.3 ? 'hsl(210,60%,60%)' : r > 0.1 ? 'hsl(210,40%,75%)' : r > -0.1 ? 'hsl(0,0%,90%)' : r > -0.3 ? 'hsl(0,40%,75%)' : r > -0.7 ? 'hsl(0,60%,60%)' : 'hsl(0,80%,40%)';
        return (<div key={`${block.id}-ch-${idx}`} className="my-3"><p className="text-xs font-semibold text-muted-foreground italic mb-1">{chart.title}</p><div className="overflow-x-auto"><table className="text-xs"><thead><tr><th className="px-1 py-0.5"></th>{vars.map(v => <th key={v} className="px-1 py-0.5 text-center max-w-[60px] truncate">{v}</th>)}</tr></thead><tbody>{vars.map(v1 => <tr key={v1}><td className="px-1 py-0.5 font-medium truncate max-w-[60px]">{v1}</td>{vars.map(v2 => { if (v1===v2) return <td key={v2} className="px-1 py-0.5 text-center font-bold" style={{background:'hsl(210,80%,40%)',color:'white'}}>1.00</td>; const c=hd.find((d: any)=>(d.var1===v1&&d.var2===v2)||(d.var1===v2&&d.var2===v1)); const r=c?.r??0; return <td key={v2} className="px-1 py-0.5 text-center" style={{background:gc(r),color:Math.abs(r)>0.5?'white':'inherit'}}>{r.toFixed(2)}</td>;})}</tr>)}</tbody></table></div></div>);
      }
      return null;
    });
  };

  // Table footnotes component
  const renderTableFootnotes = (block: AnalysisBlockData) => {
    const hasPValues = block.results?.tables?.some((t: any) =>
      t.rows?.some((r: any) => {
        const row = typeof r === 'object' ? r : {};
        return row.p !== undefined || row['p-value'] !== undefined || row['Sig.'] !== undefined;
      })
    );
    if (!hasPValues && !block.narrative?.hypothesis_decision) return null;
    return (
      <div className="mt-1 space-y-0.5">
        {hasPValues && (
          <p className="text-[10px] text-muted-foreground italic">*p &lt; .05. **p &lt; .01. ***p &lt; .001.</p>
        )}
        {block.narrative?.hypothesis_decision && (
          <p className="text-[10px] text-muted-foreground italic">Note. {block.narrative.hypothesis_decision}</p>
        )}
      </div>
    );
  };

  // Render structured narrative (8-layer)
  const renderStructuredNarrative = (block: AnalysisBlockData) => {
    const n = block.narrative;
    if (!n) return null;
    // Check if structured narrative exists
    if (n.methodology || n.statistical_result || n.effect_interpretation) {
      return (
        <div className="mt-2 space-y-1 font-serif text-xs">
          {n.methodology && <p className="text-foreground">{n.methodology}</p>}
          {n.statistical_result && <p className="text-foreground">{n.statistical_result}</p>}
          {n.effect_interpretation && <p className="text-foreground">{n.effect_interpretation}</p>}
          {n.assumption_report && <p className="text-foreground">{n.assumption_report}</p>}
          {n.posthoc_report && <p className="text-foreground">{n.posthoc_report}</p>}
          {n.graph_interpretation && <p className="text-foreground">{n.graph_interpretation}</p>}
          {n.hypothesis_decision && <p className="text-foreground font-medium">{n.hypothesis_decision}</p>}
        </div>
      );
    }
    // Fallback to simple narrative
    return (
      <>
        {n.apa && <p className="text-xs text-muted-foreground mt-1 italic font-serif">{n.apa}</p>}
        {n.interpretation && n.interpretation !== n.apa && <p className="text-xs text-foreground mt-1 font-serif">{n.interpretation}</p>}
      </>
    );
  };

  // Render SPSS-style table from block results
  const renderBlockTable = (block: AnalysisBlockData) => {
    const tables = block.results?.tables;
    const summary = block.results?.summary;
    const statistics = block.results?.statistics;

    if (!tables?.length) {
      return (
        <div key={block.id} className="my-2 space-y-1">
          {summary && <p className="text-xs font-serif text-foreground">{summary}</p>}
          {statistics && typeof statistics === 'object' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border-t-2 border-b-2 border-foreground">
                <thead><tr className="border-b border-foreground"><th className="px-2 py-1 text-left font-bold">Statistic</th><th className="px-2 py-1 text-left font-bold">Value</th></tr></thead>
                <tbody>{Object.entries(statistics).map(([k, v]: [string, any], i) => (<tr key={i} className="border-b border-border"><td className="px-2 py-1 font-medium">{k}</td><td className="px-2 py-1">{typeof v === 'number' ? Number(v).toFixed(3) : String(v ?? '')}</td></tr>))}</tbody>
              </table>
            </div>
          )}
          {renderTableFootnotes(block)}
          {renderStructuredNarrative(block)}
          {renderBlockCharts(block)}
          {!summary && !statistics && !block.narrative?.apa && !block.results?.charts?.length && (
            <p className="text-xs text-muted-foreground italic">No table data available for this block.</p>
          )}
        </div>
      );
    }

    return (
      <div>
        {tables.map((table: any, ti: number) => (
          <div key={`${block.id}-${ti}`} className="my-3">
            <p className="text-xs font-semibold text-muted-foreground italic mb-1">Table: {table.title || block.test_type}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border-t-2 border-b-2 border-foreground">
                {table.headers && (<thead><tr className="border-b-2 border-foreground">{table.headers.map((h: string, hi: number) => (<th key={hi} className="px-2 py-1 text-left font-bold">{h}</th>))}</tr></thead>)}
                <tbody>
                  {table.rows?.map((row: any, ri: number) => {
                    const cells = Array.isArray(row) ? row : table.headers ? table.headers.map((h: string) => resolveCell(row, h)) : Object.values(row);
                    return (<tr key={ri} className="border-b border-border">{cells.map((cell: any, ci: number) => (<td key={ci} className="px-2 py-1">{typeof cell === 'number' ? Number(cell).toFixed(3) : String(cell ?? '')}</td>))}</tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {renderTableFootnotes(block)}
        {renderStructuredNarrative(block)}
        {renderBlockCharts(block)}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Chapter 4: Results and Data Analysis
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Aggregates all analysis outputs into a structured academic chapter
          </p>
        </div>
        {savedChapter && <Badge variant="secondary">v{savedChapter.version} saved</Badge>}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="allblocks">
            <LayoutGrid className="w-3 h-3 mr-1" /> All Blocks ({blocks.length})
          </TabsTrigger>
          <TabsTrigger value="editor" disabled={generatedSections.length === 0}>Chapter Editor</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Descriptive', key: 'descriptive' as const, step: 4 },
              { label: 'Reliability', key: 'reliability' as const, step: 10 },
              { label: 'Correlation', key: 'correlation' as const, step: 8 },
              { label: 'Regression', key: 'regression' as const, step: 9 },
              { label: 'Hypothesis Testing', key: 'hypothesis' as const, step: 5 },
              { label: 'Diagnostics', key: 'diagnostics' as const, step: 9 },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => {
                  if (!stepStatus[item.key]) {
                    window.dispatchEvent(new CustomEvent('navigate-to-step', { detail: { step: item.step } }));
                  }
                }}
                className={cn(
                  'rounded-lg p-3 border flex items-center gap-2 text-left w-full transition-colors',
                  stepStatus[item.key] ? 'bg-primary/10 border-primary/30' : 'bg-muted/50 border-border hover:bg-muted/80 cursor-pointer'
                )}
              >
                {stepStatus[item.key] ? <CheckCircle className="w-4 h-4 text-primary" /> : <AlertCircle className="w-4 h-4 text-muted-foreground" />}
                <div className="flex flex-col">
                  <span className={cn('text-sm', stepStatus[item.key] ? 'text-primary' : 'text-muted-foreground')}>{item.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {stepStatus[item.key] ? 'Data available' : `No data — Go to Step ${item.step}`}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {blocks.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2">{blocks.length} Analysis Blocks Found</h4>
              <div className="flex flex-wrap gap-2">
                {blocks.map(b => (
                  <Badge key={b.id} variant={b.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                    {b.test_type} ({b.status})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full" size="lg">
            {isGenerating ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating Chapter 4...</>
            ) : (
              <><FileText className="w-4 h-4 mr-2" /> Generate Chapter 4 – Academic Mode</>
            )}
          </Button>

          {blocks.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No analysis blocks found. Complete Steps 4-10 first.</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="allblocks" className="space-y-4">
          {blocks.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No analysis blocks yet. Complete Steps 4–10 first.</AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4 pr-4">
                {blocks.map(block => (
                  <div key={block.id} className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">{block.test_type}</h4>
                        <Badge variant="outline" className="text-xs">{block.test_category}</Badge>
                        <Badge variant={block.status === 'completed' ? 'default' : 'secondary'} className="text-xs">{block.status}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{block.section}</span>
                    </div>
                    <div className="p-4">
                      {renderBlockTable(block)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="editor" className="space-y-4">
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Regenerate All
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSave}>
              <Save className="w-3 h-3 mr-1" /> Save
            </Button>
            {savedChapter && <span className="text-xs text-muted-foreground">Auto-saved v{savedChapter.version}</span>}
          </div>

          <ScrollArea className="h-[600px]">
            <div className="space-y-4 pr-4">
              {generatedSections.map(section => {
                const sectionBlocks = getBlocksForSection(section.id, blocks);
                return (
                  <div key={section.id} className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-4 py-2 flex items-center justify-between">
                      <h4 className="text-sm font-semibold">{section.number} {section.title}</h4>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleRegenerateSection(section.id)} disabled={regeneratingSection === section.id}>
                          {regeneratingSection === section.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          <span className="ml-1 text-xs">AI</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingSection(editingSection === section.id ? null : section.id)}>
                          {editingSection === section.id ? 'Preview' : 'Edit'}
                        </Button>
                      </div>
                    </div>
                    <div className="p-4">
                      {sectionBlocks.length > 0 && (
                        <div className="mb-4 bg-muted/30 rounded-lg p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">📊 Analysis Tables</p>
                          {sectionBlocks.map(b => renderBlockTable(b))}
                        </div>
                      )}

                      {editingSection === section.id ? (
                        <Textarea
                          value={section.content}
                          onChange={(e) => updateSectionContent(section.id, e.target.value)}
                          className="min-h-[200px] font-serif text-sm"
                        />
                      ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none font-serif">
                          {section.content ? (
                            String(section.content).split('\n').map((p, i) => p.trim() ? <p key={i}>{p}</p> : null)
                          ) : (
                            <p className="text-muted-foreground italic">No content generated for this section.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
