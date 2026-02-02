import { useState } from 'react';
import { FileText, Download, Eye, Loader2, Lock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { AnalysisResults } from '@/hooks/useAnalysisWizard';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Step7ExportProps {
  projectName: string;
  researchQuestion: string;
  results: AnalysisResults | null;
  aiInterpretation: string;
  apaResults: string;
  discussion: string;
}

interface ReportSection { id: string; label: string; description: string; enabled: boolean; }

export function Step7Export({ projectName, researchQuestion, results, aiInterpretation, apaResults, discussion }: Step7ExportProps) {
  const { isPro } = usePlanLimits();
  const [isGenerating, setIsGenerating] = useState(false);
  const [format, setFormat] = useState<'docx' | 'pdf'>('docx');
  const [sections, setSections] = useState<ReportSection[]>([
    { id: 'methods', label: 'Methods', description: 'Analysis methodology', enabled: true },
    { id: 'results', label: 'Results', description: 'Statistical tables', enabled: true },
    { id: 'charts', label: 'Charts', description: 'Visualizations', enabled: results?.charts && results.charts.length > 0 },
    { id: 'interpretation', label: 'Summary', description: 'AI interpretation', enabled: !!aiInterpretation },
    { id: 'apa', label: 'APA Results', description: 'Publication-ready', enabled: !!apaResults && isPro },
    { id: 'discussion', label: 'Discussion', description: 'Implications', enabled: !!discussion && isPro },
  ]);

  const toggleSection = (id: string) => setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));

  const generateReport = async () => {
    if (!isPro) { toast.error('Upgrade to Pro to export reports'); return; }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: { format, projectName, researchQuestion, results, aiInterpretation, apaResults, discussion, sections: sections.filter(s => s.enabled).map(s => s.id) },
      });
      if (error) throw error;
      if (data?.content) {
        const blob = new Blob([data.content], { type: data.contentType || 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.fileName || `${projectName.replace(/[^a-z0-9]/gi, '_')}_report.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Report downloaded!');
      }
    } catch (err) {
      console.error('Report error:', err);
      toast.error('Failed to generate report.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div><h3 className="text-lg font-semibold text-foreground mb-2">Export Report</h3><p className="text-sm text-muted-foreground">Download your analysis report</p></div>
      <div className="bg-muted/50 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><FileText className="w-6 h-6 text-primary" /></div>
          <div><h4 className="font-medium text-foreground">{projectName || 'Untitled'}</h4><p className="text-sm text-muted-foreground">{results?.tables.length || 0} table(s) • {results?.charts?.length || 0} chart(s)</p></div>
        </div>
        {researchQuestion && <div className="text-sm"><span className="text-muted-foreground">Research Question: </span><span className="text-foreground">{researchQuestion}</span></div>}
      </div>
      <Separator />
      <div className="space-y-3">
        <Label className="text-base font-medium">Export Format</Label>
        <RadioGroup value={format} onValueChange={v => setFormat(v as 'docx' | 'pdf')} className="flex gap-4">
          <div className="flex items-center space-x-2"><RadioGroupItem value="docx" id="docx" disabled={!isPro} /><Label htmlFor="docx" className={!isPro ? 'text-muted-foreground' : 'cursor-pointer'}>Word (.docx) {!isPro && <Lock className="w-3 h-3 inline ml-1" />}</Label></div>
          <div className="flex items-center space-x-2"><RadioGroupItem value="pdf" id="pdf" disabled={!isPro} /><Label htmlFor="pdf" className={!isPro ? 'text-muted-foreground' : 'cursor-pointer'}>PDF {!isPro && <Lock className="w-3 h-3 inline ml-1" />}</Label></div>
        </RadioGroup>
      </div>
      <Separator />
      <div className="space-y-4">
        <Label className="text-base font-medium">Include Sections</Label>
        <div className="space-y-3">
          {sections.map(section => (
            <div key={section.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div><span className="font-medium text-foreground">{section.label}</span><p className="text-xs text-muted-foreground">{section.description}</p></div>
              <Switch checked={section.enabled} onCheckedChange={() => toggleSection(section.id)} disabled={section.id === 'apa' || section.id === 'discussion' ? !isPro : false} />
            </div>
          ))}
        </div>
      </div>
      <Separator />
      <div className="flex gap-3">
        {isPro ? (
          <>
            <Button variant="outline" className="flex-1" disabled={isGenerating}><Eye className="w-4 h-4 mr-2" />Preview</Button>
            <Button variant="hero" className="flex-1" onClick={generateReport} disabled={isGenerating}>{isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Download className="w-4 h-4 mr-2" />Download Report</>}</Button>
          </>
        ) : (
          <div className="flex-1 space-y-3">
            <Alert><Lock className="h-4 w-4" /><AlertDescription><strong>Pro Feature:</strong> Upgrade to export Word/PDF reports.</AlertDescription></Alert>
            <Button variant="hero" className="w-full">Upgrade to Pro</Button>
          </div>
        )}
      </div>
      {isPro && <Alert><CheckCircle className="h-4 w-4" /><AlertDescription>Your report will have professional APA formatting.</AlertDescription></Alert>}
    </div>
  );
}
