import { useState } from 'react';
import { Wand2, Copy, RefreshCw, CheckCircle, Loader2, FileText, BookOpen, FlaskConical, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AnalysisConfig, AnalysisResults } from '@/hooks/useAnalysisWizard';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { PlanGate } from '@/components/plan/PlanGate';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Step6InterpretationProps {
  analysisConfig: AnalysisConfig | null;
  results: AnalysisResults | null;
  researchQuestion: string;
  hypothesis?: string;
  aiInterpretation: string;
  onAiInterpretationChange: (interpretation: string) => void;
  apaResults: string;
  onApaResultsChange: (apa: string) => void;
  discussion: string;
  onDiscussionChange: (discussion: string) => void;
}

type InterpretationType = 'summary' | 'apa' | 'discussion' | 'methodology' | 'full-results';

interface ValidationMetadata {
  sampleSize: number | null;
  testStatistic: number | null;
  testStatisticName: string | null;
  pValue: number | null;
  effectSize: number | null;
  effectSizeName: string | null;
  variablesUsed: string[];
  groupsUsed: string[];
}

export function Step6Interpretation({ analysisConfig, results, researchQuestion, hypothesis, aiInterpretation, onAiInterpretationChange, apaResults, onApaResultsChange, discussion, onDiscussionChange }: Step6InterpretationProps) {
  const { isPro } = usePlanLimits();
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [methodology, setMethodology] = useState('');
  const [fullResults, setFullResults] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastMetadata, setLastMetadata] = useState<ValidationMetadata | null>(null);

  // Check if results exist and have data
  const hasValidResults = results && results.tables && results.tables.length > 0;
  
  // Extract sample size from results for display
  const extractedSampleSize = (): number | null => {
    if (!results?.tables) return null;
    for (const table of results.tables) {
      for (const row of table.rows) {
        if (row.N !== undefined) return Number(row.N);
        if (row.n !== undefined) return Number(row.n);
      }
    }
    return null;
  };

  const generateInterpretation = async (type: InterpretationType) => {
    if (!results || !analysisConfig) {
      setValidationError('No analysis results found. Please run the analysis in Step 5 first.');
      return;
    }
    
    if (!hasValidResults) {
      setValidationError('Analysis results are incomplete. Please re-run the analysis.');
      return;
    }
    
    setIsGenerating(true);
    setValidationError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('interpret-results', {
        body: { 
          type, 
          testType: analysisConfig.testType, 
          results: { tables: results.tables, charts: results.charts, summary: results.summary },
          researchQuestion, 
          hypothesis, 
          variables: { 
            dependent: analysisConfig.dependentVariables, 
            independent: analysisConfig.independentVariables, 
            grouping: analysisConfig.groupingVariable 
          }, 
          sampleSize: extractedSampleSize(),
          isPro 
        },
      });
      
      if (error) {
        // Handle validation errors from the edge function
        if (error.message?.includes('Missing required analysis data')) {
          setValidationError('Cannot generate interpretation: The analysis results are missing required statistics. Please re-run the analysis in Step 5.');
          throw error;
        }
        throw error;
      }
      
      // Check if the response includes validation metadata
      if (data?.metadata) {
        setLastMetadata(data.metadata);
      }
      
      if (data?.interpretation) {
        switch (type) {
          case 'summary': onAiInterpretationChange(data.interpretation); break;
          case 'apa': onApaResultsChange(data.interpretation); break;
          case 'discussion': onDiscussionChange(data.interpretation); break;
          case 'methodology': setMethodology(data.interpretation); break;
          case 'full-results': setFullResults(data.interpretation); break;
        }
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')} generated!`);
      }
    } catch (err) {
      console.error('Interpretation error:', err);
      if (!validationError) {
        toast.error('Failed to generate interpretation.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied!'); };

  if (!results) {
    return (
      <div className="text-center py-12 border border-dashed rounded-lg">
        <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Analysis Results</h3>
        <p className="text-sm text-muted-foreground mb-4">You must run the analysis in Step 5 before generating interpretations.</p>
        <p className="text-xs text-muted-foreground">The AI writing engine requires real statistical data to generate accurate academic content.</p>
      </div>
    );
  }

  const sampleSize = extractedSampleSize();

  return (
    <div className="space-y-6">
      {/* Data Validation Status */}
      <div className="flex items-center gap-3 p-4 bg-success/10 rounded-lg border border-success/20">
        <ShieldCheck className="w-6 h-6 text-success" />
        <div className="flex-1">
          <h4 className="font-medium text-foreground">Data Validated</h4>
          <p className="text-sm text-muted-foreground">
            Writing from real analysis: N = {sampleSize || 'detecting...'} | {results.tables.length} table(s)
            {lastMetadata?.testStatisticName && ` | ${lastMetadata.testStatisticName} = ${lastMetadata.testStatistic?.toFixed(3)}`}
          </p>
        </div>
      </div>

      {validationError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div><h3 className="text-lg font-semibold text-foreground mb-2">AI Academic Writing</h3><p className="text-sm text-muted-foreground">Generate publication-ready text from your actual results</p></div>
        <Button variant="outline" onClick={() => generateInterpretation('summary')} disabled={isGenerating || !hasValidResults}>
          {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}Generate
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summary"><FileText className="w-4 h-4 mr-1" />Summary</TabsTrigger>
          <TabsTrigger value="methodology" disabled={!isPro}><FlaskConical className="w-4 h-4 mr-1" />Methods {!isPro && '🔒'}</TabsTrigger>
          <TabsTrigger value="apa" disabled={!isPro}><BookOpen className="w-4 h-4 mr-1" />APA {!isPro && '🔒'}</TabsTrigger>
          <TabsTrigger value="discussion" disabled={!isPro}>Discussion {!isPro && '🔒'}</TabsTrigger>
          <TabsTrigger value="full-results" disabled={!isPro}>Full {!isPro && '🔒'}</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="space-y-4">
          <InterpretationPanel title="Plain Language Summary" description="Clear explanation of your actual results" content={aiInterpretation} onChange={onAiInterpretationChange} onGenerate={() => generateInterpretation('summary')} onCopy={() => copyToClipboard(aiInterpretation)} isGenerating={isGenerating} placeholder="Click Generate to create a summary from your analysis data." disabled={!hasValidResults} />
        </TabsContent>
        <TabsContent value="methodology"><PlanGate feature="methodology"><InterpretationPanel title="Methodology" description="Complete Methods section" content={methodology} onChange={setMethodology} onGenerate={() => generateInterpretation('methodology')} onCopy={() => copyToClipboard(methodology)} isGenerating={isGenerating} placeholder="Generate Methods section from your analysis configuration." disabled={!hasValidResults} /></PlanGate></TabsContent>
        <TabsContent value="apa"><PlanGate feature="apaResults"><InterpretationPanel title="APA Results" description="APA 7th edition format with your exact statistics" content={apaResults} onChange={onApaResultsChange} onGenerate={() => generateInterpretation('apa')} onCopy={() => copyToClipboard(apaResults)} isGenerating={isGenerating} placeholder="Generate APA Results with exact N, df, p-values from your analysis." disabled={!hasValidResults} /></PlanGate></TabsContent>
        <TabsContent value="discussion"><PlanGate feature="discussion"><InterpretationPanel title="Discussion" description="Implications based on your findings" content={discussion} onChange={onDiscussionChange} onGenerate={() => generateInterpretation('discussion')} onCopy={() => copyToClipboard(discussion)} isGenerating={isGenerating} placeholder="Generate Discussion interpreting your specific results." disabled={!hasValidResults} /></PlanGate></TabsContent>
        <TabsContent value="full-results"><PlanGate feature="fullResults"><InterpretationPanel title="Full Results (Chapter Four)" description="Comprehensive analysis with your exact statistics" content={fullResults} onChange={setFullResults} onGenerate={() => generateInterpretation('full-results')} onCopy={() => copyToClipboard(fullResults)} isGenerating={isGenerating} placeholder="Generate complete Chapter Four with your validated data." disabled={!hasValidResults} /></PlanGate></TabsContent>
      </Tabs>
      
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Data Binding Active:</strong> All generated text uses only the statistics from your Step 5 analysis. 
          Verify interpretations match your tables before publication.
        </AlertDescription>
      </Alert>
    </div>
  );
}

interface InterpretationPanelProps { 
  title: string; 
  description: string; 
  content: string; 
  onChange: (v: string) => void; 
  onGenerate: () => void; 
  onCopy: () => void; 
  isGenerating: boolean; 
  placeholder: string;
  disabled?: boolean;
}

function InterpretationPanel({ title, description, content, onChange, onGenerate, onCopy, isGenerating, placeholder, disabled }: InterpretationPanelProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div><h4 className="font-medium text-foreground">{title}</h4><p className="text-sm text-muted-foreground">{description}</p></div>
        <div className="flex gap-2">
          {content && <Button variant="outline" size="sm" onClick={onCopy}><Copy className="w-4 h-4 mr-1" />Copy</Button>}
          <Button variant="outline" size="sm" onClick={onGenerate} disabled={isGenerating || disabled}>
            {isGenerating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : content ? <RefreshCw className="w-4 h-4 mr-1" /> : <Wand2 className="w-4 h-4 mr-1" />}
            {content ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
      </div>
      {content ? (
        <div className="bg-muted/50 rounded-lg p-4">
          <Textarea value={content} onChange={(e) => onChange(e.target.value)} className="min-h-[200px] bg-transparent border-none resize-none focus-visible:ring-0 font-serif" />
        </div>
      ) : (
        <div className="bg-muted/30 rounded-lg p-8 text-center border border-dashed">
          <Wand2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{placeholder}</p>
        </div>
      )}
    </>
  );
}
