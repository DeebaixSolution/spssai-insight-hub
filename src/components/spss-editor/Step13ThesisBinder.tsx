import { useState, useEffect } from 'react';
import { FileDown, Crown, CheckCircle, AlertCircle, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Step13Props {
  analysisId?: string | null;
}

interface ChapterStatus {
  chapter4: { exists: boolean; version: number; text: string };
  chapter5: { exists: boolean; version: number; text: string };
  citations: { count: number; items: any[] };
  blocks: { count: number; items: any[] };
}

export function Step13ThesisBinder({ analysisId }: Step13Props) {
  const { user } = useAuth();
  const { isPro } = usePlanLimits();
  const [status, setStatus] = useState<ChapterStatus>({
    chapter4: { exists: false, version: 0, text: '' },
    chapter5: { exists: false, version: 0, text: '' },
    citations: { count: 0, items: [] },
    blocks: { count: 0, items: [] },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('status');
  const [exports, setExports] = useState<any[]>([]);

  useEffect(() => {
    if (analysisId) fetchStatus();
  }, [analysisId]);

  const fetchStatus = async () => {
    if (!analysisId) return;
    setIsLoading(true);
    try {
      const [ch4, ch5, cit, blocks, exps] = await Promise.all([
        supabase.from('chapter_results').select('*').eq('analysis_id', analysisId).order('created_at', { ascending: false }).limit(1),
        supabase.from('discussion_chapter').select('*').eq('analysis_id', analysisId).order('created_at', { ascending: false }).limit(1),
        supabase.from('citations').select('*').eq('analysis_id', analysisId),
        supabase.from('analysis_blocks').select('*').eq('analysis_id', analysisId).order('display_order'),
        supabase.from('thesis_exports').select('*').eq('analysis_id', analysisId).order('created_at', { ascending: false }),
      ]);

      const ch5Record = ch5.data?.[0];
      // Chapter 5 is "exists" if the record exists AND has meaningful text content
      const ch5Text = ch5Record?.chapter5_text || '';
      const ch5Exists = !!ch5Record && ch5Text.trim().length > 50;

      setStatus({
        chapter4: { exists: !!ch4.data?.[0], version: ch4.data?.[0]?.version || 0, text: ch4.data?.[0]?.full_text || '' },
        chapter5: { exists: ch5Exists, version: ch5Record?.version || 0, text: ch5Text },
        citations: { count: cit.data?.length || 0, items: cit.data || [] },
        blocks: { count: blocks.data?.length || 0, items: blocks.data || [] },
      });
      setExports(exps.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: 'word' | 'word-doc', chapterFilter?: 'both' | 'chapter4' | 'chapter5') => {
    if (!analysisId || !user) return;

    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-thesis-doc', {
        body: {
          analysisId,
          format: 'word',
          isPro,
          chapterFilter: chapterFilter || 'both',
          chapter4Text: String(status.chapter4.text || ''),
          chapter5Text: String(status.chapter5.text || ''),
          citations: status.citations.items,
          analysisBlocks: status.blocks.items.map(b => ({
            id: b.id,
            test_type: b.test_type,
            test_category: b.test_category,
            results: b.results,
            narrative: b.narrative,
          })),
        },
      });

      if (error) throw error;

      // Save export metadata
      await supabase.from('thesis_exports').insert([{
        analysis_id: analysisId,
        user_id: user.id,
        export_type: format,
        version: Math.max(status.chapter4.version, status.chapter5.version),
        file_url: null,
      }]);

      if (data?.content) {
        const blob = new Blob([data.content], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // .doc extension opens natively in Word; .htm for browser preview
        const ext = format === 'word-doc' ? 'doc' : 'htm';
        a.download = `thesis-chapters-${chapterFilter || 'both'}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(
          format === 'word-doc'
            ? 'Word document downloaded! Open with Microsoft Word.'
            : 'HTML document downloaded. Open in browser or Word.'
        );
      }

      fetchStatus();
    } catch (err) {
      console.error('Export error:', err);
      toast.error(`Failed to export document.`);
    } finally {
      setIsExporting(false);
    }
  };

  const readyToExport = status.chapter4.exists || status.chapter5.exists;
  const completedBlocks = status.blocks.items.filter((b: any) => b.status !== 'pending');

  // Export progress steps
  const progressSteps = [
    { label: `Analysis Blocks (${completedBlocks.length}/${status.blocks.count})`, done: completedBlocks.length > 0 },
    { label: `Chapter 4 v${status.chapter4.version || '–'}`, done: status.chapter4.exists },
    { label: `Chapter 5 v${status.chapter5.version || '–'}`, done: status.chapter5.exists },
    { label: 'Ready to Export', done: readyToExport },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <FileDown className="w-5 h-5" />
            Thesis Binder – Final Compilation
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Compile chapters into a unified academic document
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus} disabled={isLoading}>
          <RefreshCw className={cn('w-4 h-4 mr-1', isLoading && 'animate-spin')} />
          Refresh Status
        </Button>
      </div>

      {/* Progress indicator */}
      <div className="border rounded-lg p-4">
        <h4 className="text-sm font-medium mb-3">Export Progress</h4>
        <div className="flex items-center gap-2 flex-wrap">
          {progressSteps.map((step, i) => (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground text-xs">→</span>}
              <div className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                step.done ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                {step.done
                  ? <CheckCircle className="w-3 h-3" />
                  : <AlertCircle className="w-3 h-3" />
                }
                {step.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="status">Compilation Status</TabsTrigger>
          <TabsTrigger value="preview" disabled={!readyToExport}>Preview</TabsTrigger>
          <TabsTrigger value="history">Export History</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cn(
              'border rounded-lg p-4',
              status.chapter4.exists ? 'border-primary/30 bg-primary/5' : 'border-border'
            )}>
              <div className="flex items-center gap-2 mb-2">
                {status.chapter4.exists
                  ? <CheckCircle className="w-5 h-5 text-primary" />
                  : <AlertCircle className="w-5 h-5 text-muted-foreground" />}
                <h4 className="font-medium">Chapter 4: Results</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                {status.chapter4.exists ? `v${status.chapter4.version} – Ready` : 'Not generated yet. Complete Step 11.'}
              </p>
              {status.blocks.count > 0 && (
                <Badge variant="secondary" className="mt-2 text-xs">
                  {completedBlocks.length}/{status.blocks.count} blocks ready
                </Badge>
              )}
            </div>

            <div className={cn(
              'border rounded-lg p-4',
              status.chapter5.exists
                ? 'border-primary/30 bg-primary/5'
                : 'border-destructive/30 bg-destructive/5'
            )}>
              <div className="flex items-center gap-2 mb-2">
                {status.chapter5.exists
                  ? <CheckCircle className="w-5 h-5 text-primary" />
                  : <AlertCircle className="w-5 h-5 text-destructive" />}
                <h4 className="font-medium">Chapter 5: Discussion</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                {status.chapter5.exists
                  ? `v${status.chapter5.version} – Ready`
                  : 'Not generated yet.'}
              </p>
              {!status.chapter5.exists && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-destructive font-medium">
                    ⚠️ Complete Step 12 (Theoretical Framework) to generate Chapter 5.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('navigate-to-step', { detail: { step: 12 } }));
                    }}
                  >
                    Go to Step 12 → Generate Chapter 5
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={fetchStatus}>
                    <RefreshCw className="w-3 h-3 mr-1" /> I just generated it – Refresh
                  </Button>
                </div>
              )}
              {status.citations.count > 0 && (
                <Badge variant="secondary" className="mt-2 text-xs">{status.citations.count} references</Badge>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="font-medium">Export Options</h4>
            <p className="text-xs text-muted-foreground">
              The export includes all analysis results, tables, and interpretations from Steps 4–10. 
              Chapter 4 is AI-generated academic text based on those results. Tables are embedded with their APA narrative.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => handleExport('word-doc', 'both')}
                disabled={!readyToExport || isExporting}
                className="flex-1"
              >
                {isExporting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Export Word (.doc)
              </Button>
              <Button
                onClick={() => handleExport('word', 'both')}
                disabled={!readyToExport || isExporting}
                variant="outline"
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Export HTML (.htm)
              </Button>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline" size="sm"
                onClick={() => handleExport('word-doc', 'chapter4')}
                disabled={!status.chapter4.exists || isExporting}
                className="flex-1"
              >
                <Download className="w-3 h-3 mr-1" /> Chapter 4 Only (.doc)
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => handleExport('word-doc', 'chapter5')}
                disabled={!status.chapter5.exists || isExporting}
                className="flex-1"
              >
                <Download className="w-3 h-3 mr-1" /> Chapter 5 Only (.doc)
              </Button>
            </div>
            {/* Appendix export */}
            <div className="border-t pt-3 mt-3">
              <h5 className="text-sm font-medium mb-2">📎 Appendix – Full SPSS Output</h5>
              <p className="text-xs text-muted-foreground mb-2">
                Export ALL analysis tables, charts, and academic reports from Steps 4–10 as a comprehensive appendix document.
              </p>
              <Button
                variant="outline" size="sm"
                onClick={() => handleExport('word-doc', 'appendix' as any)}
                disabled={status.blocks.count === 0 || isExporting}
                className="w-full"
              >
                <Download className="w-3 h-3 mr-1" /> Export Appendix (.doc)
              </Button>
            </div>
            {!isPro && (
              <p className="text-xs text-muted-foreground">
                Free plan: Export with watermark. Upgrade to PRO for full export without watermark.
              </p>
            )}
          </div>

          {!readyToExport && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Generate at least Chapter 4 (Step 11) or Chapter 5 (Step 12) before exporting.</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="preview">
          <ScrollArea className="h-[600px] border rounded-lg p-6">
            <div className="prose prose-sm dark:prose-invert max-w-none font-serif">
              <h1 className="text-center">Chapter 4: Results and Data Analysis</h1>
              {String(status.chapter4.text || '').split('\n').map((p, i) => p.trim() ? (
                p.startsWith('##') ? <h2 key={i}>{p.replace(/^##\s*/, '')}</h2> : <p key={i}>{p}</p>
              ) : null)}

              <hr className="my-8" />

              <h1 className="text-center">Chapter 5: Discussion and Conclusion</h1>
              {String(status.chapter5.text || '').split('\n').map((p, i) => p.trim() ? (
                p.startsWith('##') ? <h2 key={i}>{p.replace(/^##\s*/, '')}</h2> : <p key={i}>{p}</p>
              ) : null)}

              {status.citations.items.length > 0 && (
                <>
                  <hr className="my-8" />
                  <h1>References</h1>
                  {status.citations.items.map((c: any) => (
                    <p key={c.id} className="hanging-indent">
                      {c.formatted_reference || `${c.author} (${c.year}). ${c.title}. ${c.journal || ''}.`}
                    </p>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {exports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No exports yet.</p>
          ) : (
            exports.map(exp => (
              <div key={exp.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <span className="text-sm font-medium">{exp.export_type.toUpperCase()} Export</span>
                  <span className="text-xs text-muted-foreground ml-2">v{exp.version}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(exp.created_at).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
