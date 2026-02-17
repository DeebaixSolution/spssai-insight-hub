import { useState, useEffect, useMemo } from 'react';
import { BookOpen, CheckCircle, AlertCircle, FileText, RefreshCw, Save, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  hypothesis: ['compare-means', 'nonparametric', 'anova', 'parametric'],
  diagnostics: ['regression'],
  integrated: [],
  summary: [],
};

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
            id: s.id,
            title: s.title,
            number: s.number,
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
    // Include blocks regardless of status — auto-pilot may save with any status
    return allBlocks.filter(b => categories.includes(b.test_category) && b.status !== 'pending');
  };

  const stepStatus = useMemo(() => {
    const categories = new Set(blocks.filter(b => b.status !== 'pending').map(b => b.test_category));
    return {
      descriptive: categories.has('descriptive') || categories.has('normality'),
      reliability: categories.has('reliability') || categories.has('measurement-validation'),
      correlation: categories.has('correlation'),
      regression: categories.has('regression'),
      hypothesis: blocks.some(b => ['compare-means', 'nonparametric', 'anova', 'parametric'].includes(b.test_category) && b.status !== 'pending'),
      diagnostics: categories.has('regression'),
    };
  }, [blocks]);

  const handleGenerate = async () => {
    if (!analysisId) {
      toast.error('No analysis ID found. Please save your analysis first.');
      return;
    }
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
        // Auto-save after generation
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

  // Regenerate a single section
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
      const record = {
        analysis_id: analysisId, full_text: fullText,
        section_mapping: sectionMapping as any,
        version: (savedChapter?.version || 0) + 1,
      };
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

  // Render SPSS-style table from block results
  const renderBlockTable = (block: AnalysisBlockData) => {
    if (!block.results?.tables) return null;
    return block.results.tables.map((table: any, ti: number) => (
      <div key={`${block.id}-${ti}`} className="my-3">
        <p className="text-xs font-semibold text-muted-foreground italic mb-1">
          Table: {table.title || block.test_type}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse border-t-2 border-b-2 border-foreground">
            {table.headers && (
              <thead>
                <tr className="border-b-2 border-foreground">
                  {table.headers.map((h: string, hi: number) => (
                    <th key={hi} className="px-2 py-1 text-left font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {table.rows?.map((row: any, ri: number) => (
                <tr key={ri} className="border-b border-border">
                  {(Array.isArray(row) ? row : (table.headers ? table.headers.map((h: string) => row[h] ?? '') : Object.values(row))).map((cell: any, ci: number) => (
                    <td key={ci} className="px-2 py-1">{typeof cell === 'number' ? Number(cell).toFixed(3) : String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {block.narrative?.apa && (
          <p className="text-xs text-muted-foreground mt-1 italic font-serif">{block.narrative.apa}</p>
        )}
      </div>
    ));
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
          <TabsTrigger value="editor" disabled={generatedSections.length === 0}>Chapter Editor</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Descriptive', key: 'descriptive' as const },
              { label: 'Reliability', key: 'reliability' as const },
              { label: 'Correlation', key: 'correlation' as const },
              { label: 'Regression', key: 'regression' as const },
              { label: 'Hypothesis Testing', key: 'hypothesis' as const },
              { label: 'Diagnostics', key: 'diagnostics' as const },
            ].map(item => (
              <div key={item.key} className={cn(
                'rounded-lg p-3 border flex items-center gap-2',
                stepStatus[item.key] ? 'bg-green-50 dark:bg-green-950/20 border-green-200' : 'bg-muted/50 border-border'
              )}>
                {stepStatus[item.key] ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-muted-foreground" />}
                <span className={cn('text-sm', stepStatus[item.key] ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground')}>{item.label}</span>
              </div>
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

        <TabsContent value="editor" className="space-y-4">
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
              <RefreshCw className="w-4 h-4 mr-2" /> Regenerate All
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
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => handleRegenerateSection(section.id)}
                          disabled={regeneratingSection === section.id}
                        >
                          {regeneratingSection === section.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          <span className="ml-1 text-xs">AI</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingSection(editingSection === section.id ? null : section.id)}>
                          {editingSection === section.id ? 'Preview' : 'Edit'}
                        </Button>
                      </div>
                    </div>
                    <div className="p-4">
                      {/* Inline SPSS tables from analysis blocks */}
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
