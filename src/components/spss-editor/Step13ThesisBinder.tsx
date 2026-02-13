import { useState, useEffect } from 'react';
import { FileDown, Crown, CheckCircle, AlertCircle, Download, Eye, RefreshCw } from 'lucide-react';
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
  blocks: { count: number };
}

export function Step13ThesisBinder({ analysisId }: Step13Props) {
  const { user } = useAuth();
  const { isPro } = usePlanLimits();
  const [status, setStatus] = useState<ChapterStatus>({
    chapter4: { exists: false, version: 0, text: '' },
    chapter5: { exists: false, version: 0, text: '' },
    citations: { count: 0, items: [] },
    blocks: { count: 0 },
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
        supabase.from('analysis_blocks').select('id').eq('analysis_id', analysisId),
        supabase.from('thesis_exports').select('*').eq('analysis_id', analysisId).order('created_at', { ascending: false }),
      ]);

      setStatus({
        chapter4: { exists: !!ch4.data?.[0], version: ch4.data?.[0]?.version || 0, text: ch4.data?.[0]?.full_text || '' },
        chapter5: { exists: !!ch5.data?.[0], version: ch5.data?.[0]?.version || 0, text: ch5.data?.[0]?.chapter5_text || '' },
        citations: { count: cit.data?.length || 0, items: cit.data || [] },
        blocks: { count: blocks.data?.length || 0 },
      });
      setExports(exps.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: 'word' | 'pdf') => {
    if (!analysisId || !user) return;
    if (format === 'pdf' && !isPro) {
      toast.error('PDF export requires PRO plan.');
      return;
    }

    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-thesis-doc', {
        body: {
          analysisId,
          format,
          isPro,
          chapter4Text: status.chapter4.text,
          chapter5Text: status.chapter5.text,
          citations: status.citations.items,
        },
      });

      if (error) throw error;

      // Save export metadata
      await supabase.from('thesis_exports').insert([{
        analysis_id: analysisId,
        user_id: user.id,
        export_type: format,
        version: Math.max(status.chapter4.version, status.chapter5.version),
        file_url: data?.fileUrl || null,
      }]);

      if (data?.content) {
        // Download the file
        const blob = new Blob([data.content], { type: format === 'word' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `thesis-chapter4-5.${format === 'word' ? 'docx' : 'pdf'}`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast.success(`${format.toUpperCase()} export complete!`);
      fetchStatus();
    } catch (err) {
      console.error('Export error:', err);
      toast.error(`Failed to export ${format.toUpperCase()}.`);
    } finally {
      setIsExporting(false);
    }
  };

  const readyToExport = status.chapter4.exists && status.chapter5.exists;

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
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="status">Compilation Status</TabsTrigger>
          <TabsTrigger value="preview" disabled={!readyToExport}>Preview</TabsTrigger>
          <TabsTrigger value="history">Export History</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          {/* Chapter Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cn(
              'border rounded-lg p-4',
              status.chapter4.exists ? 'border-green-200 bg-green-50/50 dark:bg-green-950/20' : 'border-border'
            )}>
              <div className="flex items-center gap-2 mb-2">
                {status.chapter4.exists ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-muted-foreground" />}
                <h4 className="font-medium">Chapter 4: Results</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                {status.chapter4.exists ? `v${status.chapter4.version} – Ready` : 'Not generated yet. Complete Step 11.'}
              </p>
              {status.blocks.count > 0 && (
                <Badge variant="secondary" className="mt-2 text-xs">{status.blocks.count} analysis blocks</Badge>
              )}
            </div>

            <div className={cn(
              'border rounded-lg p-4',
              status.chapter5.exists ? 'border-green-200 bg-green-50/50 dark:bg-green-950/20' : 'border-border'
            )}>
              <div className="flex items-center gap-2 mb-2">
                {status.chapter5.exists ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-muted-foreground" />}
                <h4 className="font-medium">Chapter 5: Discussion</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                {status.chapter5.exists ? `v${status.chapter5.version} – Ready` : 'Not generated yet. Complete Step 12.'}
              </p>
              {status.citations.count > 0 && (
                <Badge variant="secondary" className="mt-2 text-xs">{status.citations.count} references</Badge>
              )}
            </div>
          </div>

          {/* Export Options */}
          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="font-medium">Export Options</h4>
            <div className="flex gap-3">
              <Button onClick={() => handleExport('word')} disabled={!readyToExport || isExporting} className="flex-1">
                {isExporting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Export Word (.docx)
              </Button>
              <Button
                onClick={() => handleExport('pdf')}
                disabled={!readyToExport || isExporting || !isPro}
                variant={isPro ? 'default' : 'outline'}
                className="flex-1"
              >
                {!isPro && <Crown className="w-4 h-4 mr-2" />}
                <Download className="w-4 h-4 mr-2" />
                Export PDF {!isPro && '(PRO)'}
              </Button>
            </div>

            {!isPro && (
              <p className="text-xs text-muted-foreground">
                Free plan: Partial export with watermark. Upgrade to PRO for full thesis export.
              </p>
            )}
          </div>

          {!readyToExport && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Both Chapter 4 (Step 11) and Chapter 5 (Step 12) must be generated before exporting.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="preview">
          <ScrollArea className="h-[600px] border rounded-lg p-6">
            <div className="prose prose-sm dark:prose-invert max-w-none font-serif">
              <h1 className="text-center">Chapter 4: Results and Data Analysis</h1>
              {status.chapter4.text.split('\n').map((p, i) => p.trim() ? (
                p.startsWith('##') ? <h2 key={i}>{p.replace(/^##\s*/, '')}</h2> : <p key={i}>{p}</p>
              ) : null)}

              <hr className="my-8" />

              <h1 className="text-center">Chapter 5: Discussion and Conclusion</h1>
              {status.chapter5.text.split('\n').map((p, i) => p.trim() ? (
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
                <span className="text-xs text-muted-foreground">
                  {new Date(exp.created_at).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
