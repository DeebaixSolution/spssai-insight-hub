import { useState, useEffect } from 'react';
import { Lightbulb, Crown, RefreshCw, Save, AlertTriangle, CheckCircle, BookOpen, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Step12Props {
  analysisId?: string | null;
}

interface TheoryInput {
  theoryName: string;
  theoryDescription: string;
  keyConstructs: string;
  priorStudies: string;
  researchContext: string;
}

interface Citation {
  id: string;
  author: string;
  year: string;
  title: string;
  journal: string;
  doi: string;
}

const CHAPTER_5_SECTIONS = [
  { id: 'findings', number: '5.1', title: 'Summary of Key Findings' },
  { id: 'theoretical', number: '5.2', title: 'Theoretical Implications' },
  { id: 'practical', number: '5.3', title: 'Practical Implications' },
  { id: 'unexpected', number: '5.4', title: 'Interpretation of Unexpected Results' },
  { id: 'limitations', number: '5.5', title: 'Study Limitations' },
  { id: 'future', number: '5.6', title: 'Recommendations for Future Research' },
  { id: 'conclusion', number: '5.7', title: 'Conclusion' },
];

export function Step12Theoretical({ analysisId }: Step12Props) {
  const { isPro } = usePlanLimits();
  const [mode, setMode] = useState<'free' | 'pro'>(isPro ? 'pro' : 'free');
  const [activeTab, setActiveTab] = useState('setup');
  const [isGenerating, setIsGenerating] = useState(false);
  const [sections, setSections] = useState<Record<string, string>>({});
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [savedChapter, setSavedChapter] = useState<any>(null);
  const [theoryInput, setTheoryInput] = useState<TheoryInput>({
    theoryName: '', theoryDescription: '', keyConstructs: '', priorStudies: '', researchContext: '',
  });
  const [citations, setCitations] = useState<Citation[]>([]);
  const [newCitation, setNewCitation] = useState<Partial<Citation>>({});

  // Advisory indicators
  const [advisoryItems, setAdvisoryItems] = useState<{ type: 'strength' | 'weakness' | 'suggestion'; message: string }[]>([]);

  useEffect(() => {
    if (!analysisId) return;
    fetchSavedData();
  }, [analysisId]);

  const fetchSavedData = async () => {
    if (!analysisId) return;
    try {
      const [discRes, citRes] = await Promise.all([
        supabase.from('discussion_chapter').select('*').eq('analysis_id', analysisId).order('created_at', { ascending: false }).limit(1),
        supabase.from('citations').select('*').eq('analysis_id', analysisId),
      ]);

      if (discRes.data?.[0]) {
        setSavedChapter(discRes.data[0]);
        const saved = discRes.data[0];
        if (saved.chapter5_text) {
          // Parse sections from saved text
          const parsed: Record<string, string> = {};
          CHAPTER_5_SECTIONS.forEach(s => { parsed[s.id] = ''; });
          const mapping = (saved as any).section_mapping as Record<string, unknown> | undefined;
          if (mapping) {
            const safeSections: Record<string, string> = {};
            Object.entries(mapping).forEach(([k, v]) => { safeSections[k] = typeof v === 'string' ? v : JSON.stringify(v ?? ''); });
            setSections(safeSections);
          } else {
            setSections(parsed);
          }
        }
        if (saved.theory_input) setTheoryInput(saved.theory_input as unknown as TheoryInput);
        setMode(saved.mode === 'pro' ? 'pro' : 'free');
      }
      if (citRes.data) {
        setCitations(citRes.data.map(c => ({ id: c.id, author: c.author, year: c.year, title: c.title, journal: c.journal || '', doi: c.doi || '' })));
      }
    } catch (err) {
      console.error('Error fetching:', err);
    }
  };

  const handleGenerate = async () => {
    if (!analysisId) {
      toast.error('No analysis ID. Save your analysis first.');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-chapter5', {
        body: { analysisId, mode, theoryInput: mode === 'pro' ? theoryInput : null, citations },
      });

      if (error) throw error;

      if (data?.sections) {
        setSections(data.sections);
        if (data.advisory) setAdvisoryItems(data.advisory);
        setActiveTab('editor');
        toast.success('Chapter 5 generated!');
      }
    } catch (err) {
      console.error('Generation error:', err);
      toast.error('Failed to generate Chapter 5.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!analysisId) return;
    try {
      const fullText = CHAPTER_5_SECTIONS.map(s => `## ${s.number} ${s.title}\n\n${sections[s.id] || ''}`).join('\n\n');

      const record = {
        analysis_id: analysisId,
        chapter5_text: fullText,
        mode,
        theory_input: theoryInput as any,
        citations_used: citations.map(c => c.id) as any,
        version: (savedChapter?.version || 0) + 1,
      };

      if (savedChapter?.id) {
        await supabase.from('discussion_chapter').update(record).eq('id', savedChapter.id);
      } else {
        await supabase.from('discussion_chapter').insert([record]);
      }

      // Save citations
      for (const c of citations) {
        if (!c.id.startsWith('local-')) continue;
        await supabase.from('citations').insert([{
          analysis_id: analysisId,
          author: c.author,
          year: c.year,
          title: c.title,
          journal: c.journal,
          doi: c.doi,
          formatted_reference: `${c.author} (${c.year}). ${c.title}. ${c.journal}.`,
        }]);
      }

      toast.success('Chapter 5 saved!');
      fetchSavedData();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save.');
    }
  };

  const addCitation = () => {
    if (!newCitation.author || !newCitation.year || !newCitation.title) {
      toast.error('Author, year, and title are required.');
      return;
    }
    setCitations(prev => [...prev, { ...newCitation, id: `local-${Date.now()}`, journal: newCitation.journal || '', doi: newCitation.doi || '' } as Citation]);
    setNewCitation({});
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Chapter 5: Discussion and Conclusion
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Theoretical interpretation, implications, and conclusions
          </p>
        </div>
        {savedChapter && <Badge variant="secondary">v{savedChapter.version}</Badge>}
      </div>

      {/* Mode Selection */}
      <div className="flex gap-2">
        <Button variant={mode === 'free' ? 'default' : 'outline'} onClick={() => setMode('free')} size="sm">
          Basic Discussion
        </Button>
        <Button
          variant={mode === 'pro' ? 'default' : 'outline'}
          onClick={() => isPro ? setMode('pro') : toast.error('PRO required')}
          size="sm"
          className="gap-1"
        >
          <Crown className="w-3.5 h-3.5" /> Advanced Academic
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          {mode === 'pro' && <TabsTrigger value="theory">Theory & References</TabsTrigger>}
          <TabsTrigger value="editor" disabled={Object.keys(sections).length === 0}>Editor</TabsTrigger>
          <TabsTrigger value="advisory" disabled={advisoryItems.length === 0}>Advisory</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-4">
          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full" size="lg">
            {isGenerating ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><BookOpen className="w-4 h-4 mr-2" /> Generate Discussion & Conclusion – Academic Mode</>
            )}
          </Button>

          {!analysisId && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Complete and save your analysis (Steps 4-10) before generating Chapter 5.</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {mode === 'pro' && (
          <TabsContent value="theory" className="space-y-4">
            {/* Theory Input */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Theory Name</Label>
                <Input value={theoryInput.theoryName} onChange={e => setTheoryInput(prev => ({ ...prev, theoryName: e.target.value }))} placeholder="e.g., Social Exchange Theory" />
              </div>
              <div className="space-y-2">
                <Label>Theory Description</Label>
                <Textarea value={theoryInput.theoryDescription} onChange={e => setTheoryInput(prev => ({ ...prev, theoryDescription: e.target.value }))} placeholder="Describe the theory..." className="min-h-[80px]" />
              </div>
              <div className="space-y-2">
                <Label>Key Constructs</Label>
                <Input value={theoryInput.keyConstructs} onChange={e => setTheoryInput(prev => ({ ...prev, keyConstructs: e.target.value }))} placeholder="e.g., Trust, Commitment, Satisfaction" />
              </div>
              <div className="space-y-2">
                <Label>Prior Study References</Label>
                <Textarea value={theoryInput.priorStudies} onChange={e => setTheoryInput(prev => ({ ...prev, priorStudies: e.target.value }))} placeholder="Key studies to reference..." className="min-h-[60px]" />
              </div>
            </div>

            {/* Citation Manager */}
            <div className="border rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Reference Manager ({citations.length})
              </h4>

              {citations.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-muted/50 rounded p-2 text-xs">
                  <span>{c.author} ({c.year}). <em>{c.title}</em>. {c.journal}</span>
                  <Button variant="ghost" size="sm" onClick={() => setCitations(prev => prev.filter(ci => ci.id !== c.id))}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Author" value={newCitation.author || ''} onChange={e => setNewCitation(p => ({ ...p, author: e.target.value }))} />
                <Input placeholder="Year" value={newCitation.year || ''} onChange={e => setNewCitation(p => ({ ...p, year: e.target.value }))} />
                <Input placeholder="Title" value={newCitation.title || ''} onChange={e => setNewCitation(p => ({ ...p, title: e.target.value }))} className="col-span-2" />
                <Input placeholder="Journal" value={newCitation.journal || ''} onChange={e => setNewCitation(p => ({ ...p, journal: e.target.value }))} />
                <Input placeholder="DOI (optional)" value={newCitation.doi || ''} onChange={e => setNewCitation(p => ({ ...p, doi: e.target.value }))} />
              </div>
              <Button variant="outline" size="sm" onClick={addCitation}>
                <Plus className="w-3 h-3 mr-1" /> Add Reference
              </Button>
            </div>
          </TabsContent>
        )}

        <TabsContent value="editor" className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" /> Save Draft
            </Button>
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
              <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
            </Button>
          </div>

          <ScrollArea className="h-[600px]">
            <div className="space-y-4 pr-4">
              {CHAPTER_5_SECTIONS.map(s => (
                <div key={s.id} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{s.number} {s.title}</h4>
                    <Button variant="ghost" size="sm" onClick={() => setEditingSection(editingSection === s.id ? null : s.id)}>
                      {editingSection === s.id ? 'Preview' : 'Edit'}
                    </Button>
                  </div>
                  <div className="p-4">
                    {editingSection === s.id ? (
                      <Textarea
                        value={sections[s.id] || ''}
                        onChange={e => setSections(prev => ({ ...prev, [s.id]: e.target.value }))}
                        className="min-h-[200px] font-serif text-sm"
                      />
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none font-serif">
                        {sections[s.id] ? (
                          String(sections[s.id]).split('\n').map((p, i) => <p key={i}>{p}</p>)
                        ) : (
                          <p className="text-muted-foreground italic">No content yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="advisory" className="space-y-3">
          {advisoryItems.map((item, i) => (
            <div key={i} className={cn(
              'flex items-start gap-2 p-3 rounded-lg border',
              item.type === 'strength' && 'bg-green-50 dark:bg-green-950/20 border-green-200',
              item.type === 'weakness' && 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200',
              item.type === 'suggestion' && 'bg-blue-50 dark:bg-blue-950/20 border-blue-200',
            )}>
              {item.type === 'strength' ? <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" /> :
               item.type === 'weakness' ? <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" /> :
               <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5" />}
              <span className="text-sm">{item.message}</span>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
