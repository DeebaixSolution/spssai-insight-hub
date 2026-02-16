import { useState, useEffect, useMemo } from 'react';
import { BookOpen, CheckCircle, AlertCircle, FileText, RefreshCw, Save, Download } from 'lucide-react';
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
  sample: ['descriptive'],
  measurement: ['factor-analysis'],
  descriptive: ['descriptive'],
  reliability: ['reliability'],
  correlation: ['correlation'],
  regression: ['regression'],
  hypothesis: ['compare-means', 'nonparametric'],
  diagnostics: ['regression'],
  integrated: [],
  summary: [],
};

export function Step11AcademicResults({ analysisId, projectId }: Step11Props) {
  const [blocks, setBlocks] = useState<AnalysisBlockData[]>([]);
  const [hypotheses, setHypotheses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSections, setGeneratedSections] = useState<ChapterSection[]>([]);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [savedChapter, setSavedChapter] = useState<any>(null);

  // Fetch saved data
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
        // Restore sections from saved data
        const mapping = chapterRes.data[0].section_mapping as Record<string, string>;
        if (mapping) {
          const restored = CHAPTER_SECTIONS.map(s => ({
            id: s.id,
            title: s.title,
            number: s.number,
            content: mapping[s.id] || '',
            tables: [],
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

  // Step completion status
  const stepStatus = useMemo(() => {
    const categories = new Set(blocks.filter(b => b.status === 'completed').map(b => b.test_category));
    return {
      descriptive: categories.has('descriptive'),
      reliability: categories.has('reliability'),
      correlation: categories.has('correlation'),
      regression: categories.has('regression'),
      hypothesis: blocks.some(b => b.section === 'hypothesis' && b.status === 'completed'),
      diagnostics: categories.has('regression'),
    };
  }, [blocks]);

  const completedCount = Object.values(stepStatus).filter(Boolean).length;

  // Generate chapter content
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
          id: s.id,
          title: s.title,
          number: s.number,
          content: data.sections[s.id] || '',
          tables: [],
          hasSavedData: true,
        }));
        setGeneratedSections(sections);
        setActiveTab('editor');
        toast.success('Chapter 4 generated successfully!');
      }
    } catch (err) {
      console.error('Generation error:', err);
      toast.error('Failed to generate Chapter 4. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Save chapter
  const handleSave = async () => {
    if (!analysisId) return;
    try {
      const sectionMapping: Record<string, string> = {};
      generatedSections.forEach(s => { sectionMapping[s.id] = s.content; });
      const fullText = generatedSections.map(s => `## ${s.number} ${s.title}\n\n${s.content}`).join('\n\n');

      const record = {
        analysis_id: analysisId,
        full_text: fullText,
        section_mapping: sectionMapping,
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
        {savedChapter && (
          <Badge variant="secondary">v{savedChapter.version} saved</Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="editor" disabled={generatedSections.length === 0}>
            Chapter Editor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Status Grid */}
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
                {stepStatus[item.key] ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={cn('text-sm', stepStatus[item.key] ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground')}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* Analysis Blocks Summary */}
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

          {/* Hypotheses Summary */}
          {hypotheses.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2">{hypotheses.length} Hypotheses</h4>
              <div className="space-y-1">
                {hypotheses.map(h => (
                  <div key={h.id} className="flex items-center gap-2 text-sm">
                    <Badge variant={h.status === 'supported' ? 'default' : h.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                      {h.hypothesis_id}
                    </Badge>
                    <span className="text-muted-foreground truncate">{h.statement}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate Button */}
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
              <AlertDescription>
                No analysis blocks found. Complete Steps 4-10 first to generate Chapter 4.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="editor" className="space-y-4">
          {/* Action Bar */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" /> Save Draft
            </Button>
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
              <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
            </Button>
          </div>

          {/* Sections */}
          <ScrollArea className="h-[600px]">
            <div className="space-y-4 pr-4">
              {generatedSections.map(section => (
                <div key={section.id} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{section.number} {section.title}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingSection(editingSection === section.id ? null : section.id)}
                    >
                      {editingSection === section.id ? 'Preview' : 'Edit'}
                    </Button>
                  </div>
                  <div className="p-4">
                    {editingSection === section.id ? (
                      <Textarea
                        value={section.content}
                        onChange={(e) => updateSectionContent(section.id, e.target.value)}
                        className="min-h-[200px] font-serif text-sm"
                      />
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none font-serif">
                        {section.content ? (
                          String(section.content || '').split('\n').map((p, i) => <p key={i}>{p}</p>)
                        ) : (
                          <p className="text-muted-foreground italic">No content generated for this section.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
