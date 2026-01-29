import { useState } from 'react';
import { Wand2, Copy, RefreshCw, CheckCircle, Loader2, FileText, BookOpen, FlaskConical } from 'lucide-react';
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

export function Step6Interpretation({
  analysisConfig,
  results,
  researchQuestion,
  hypothesis,
  aiInterpretation,
  onAiInterpretationChange,
  apaResults,
  onApaResultsChange,
  discussion,
  onDiscussionChange,
}: Step6InterpretationProps) {
  const { isPro } = usePlanLimits();
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [methodology, setMethodology] = useState('');
  const [fullResults, setFullResults] = useState('');

  const generateInterpretation = async (type: InterpretationType) => {
    if (!results || !analysisConfig) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('interpret-results', {
        body: {
          type,
          testType: analysisConfig.testType,
          results: results.tables,
          researchQuestion,
          hypothesis,
          variables: {
            dependent: analysisConfig.dependentVariables,
            independent: analysisConfig.independentVariables,
            grouping: analysisConfig.groupingVariable,
          },
          sampleSize: results.tables[0]?.rows?.[0]?.N || null,
          isPro,
        },
      });

      if (error) {
        // Handle rate limit and payment errors
        if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
          toast.error('Rate limit exceeded. Please wait a moment and try again.');
          return;
        }
        if (error.message?.includes('402') || error.message?.includes('Payment')) {
          toast.error('AI credits exhausted. Please add funds to continue.');
          return;
        }
        throw error;
      }

      if (data?.interpretation) {
        switch (type) {
          case 'summary':
            onAiInterpretationChange(data.interpretation);
            break;
          case 'apa':
            onApaResultsChange(data.interpretation);
            break;
          case 'discussion':
            onDiscussionChange(data.interpretation);
            break;
          case 'methodology':
            setMethodology(data.interpretation);
            break;
          case 'full-results':
            setFullResults(data.interpretation);
            break;
        }
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')} generated!`);
      }
    } catch (err) {
      console.error('Interpretation error:', err);
      toast.error('Failed to generate interpretation. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const generateAll = async () => {
    if (!results || !analysisConfig) return;
    
    toast.info('Generating all interpretations... This may take a moment.');
    
    // Generate sequentially to avoid rate limits
    await generateInterpretation('summary');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (isPro) {
      await generateInterpretation('apa');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await generateInterpretation('discussion');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await generateInterpretation('methodology');
    }
    
    toast.success('All interpretations generated!');
  };

  if (!results) {
    return (
      <div className="text-center py-12 border border-dashed rounded-lg">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Wand2 className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No Results Yet</h3>
        <p className="text-sm text-muted-foreground">
          Run your analysis first to get AI interpretation
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">AI Academic Writing</h3>
          <p className="text-sm text-muted-foreground">
            Generate publication-ready academic text from your results
          </p>
        </div>
        <Button
          variant="outline"
          onClick={generateAll}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Wand2 className="w-4 h-4 mr-2" />
          )}
          Generate All
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summary" className="text-xs sm:text-sm">
            <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="methodology" disabled={!isPro} className="text-xs sm:text-sm">
            <FlaskConical className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            Methods {!isPro && '🔒'}
          </TabsTrigger>
          <TabsTrigger value="apa" disabled={!isPro} className="text-xs sm:text-sm">
            <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            APA {!isPro && '🔒'}
          </TabsTrigger>
          <TabsTrigger value="discussion" disabled={!isPro} className="text-xs sm:text-sm">
            Discussion {!isPro && '🔒'}
          </TabsTrigger>
          <TabsTrigger value="full-results" disabled={!isPro} className="text-xs sm:text-sm">
            Full {!isPro && '🔒'}
          </TabsTrigger>
        </TabsList>

        {/* Summary Tab - Available to all */}
        <TabsContent value="summary" className="space-y-4">
          <InterpretationPanel
            title="Plain Language Summary"
            description="Clear, jargon-free explanation of your results"
            content={aiInterpretation}
            onChange={onAiInterpretationChange}
            onGenerate={() => generateInterpretation('summary')}
            onCopy={() => copyToClipboard(aiInterpretation)}
            isGenerating={isGenerating && activeTab === 'summary'}
            placeholder="Click 'Generate' to create a plain language summary of your statistical results."
          />
        </TabsContent>

        {/* Methodology Tab - Pro Only */}
        <TabsContent value="methodology" className="space-y-4">
          <PlanGate feature="methodology">
            <InterpretationPanel
              title="Methodology Section"
              description="Complete Methods section for your paper"
              content={methodology}
              onChange={setMethodology}
              onGenerate={() => generateInterpretation('methodology')}
              onCopy={() => copyToClipboard(methodology)}
              isGenerating={isGenerating && activeTab === 'methodology'}
              placeholder="Generate a complete Methods section describing your research design, participants, measures, and statistical analysis."
              fontClass="font-serif"
            />
          </PlanGate>
        </TabsContent>

        {/* APA Results Tab - Pro Only */}
        <TabsContent value="apa" className="space-y-4">
          <PlanGate feature="apaResults">
            <InterpretationPanel
              title="APA Results Section"
              description="Publication-ready APA 7th edition format"
              content={apaResults}
              onChange={onApaResultsChange}
              onGenerate={() => generateInterpretation('apa')}
              onCopy={() => copyToClipboard(apaResults)}
              isGenerating={isGenerating && activeTab === 'apa'}
              placeholder="Generate an APA-formatted Results section with proper statistical notation, effect sizes, and confidence intervals."
              fontClass="font-serif"
            />
          </PlanGate>
        </TabsContent>

        {/* Discussion Tab - Pro Only */}
        <TabsContent value="discussion" className="space-y-4">
          <PlanGate feature="discussion">
            <InterpretationPanel
              title="Discussion Section"
              description="Interpretation, implications, limitations, and future research"
              content={discussion}
              onChange={onDiscussionChange}
              onGenerate={() => generateInterpretation('discussion')}
              onCopy={() => copyToClipboard(discussion)}
              isGenerating={isGenerating && activeTab === 'discussion'}
              placeholder="Generate a scholarly Discussion section with theoretical implications, practical applications, limitations, and directions for future research."
              fontClass="font-serif"
            />
          </PlanGate>
        </TabsContent>

        {/* Full Results Tab - Pro Only */}
        <TabsContent value="full-results" className="space-y-4">
          <PlanGate feature="fullResults">
            <InterpretationPanel
              title="Comprehensive Results"
              description="Detailed analysis with all statistics and interpretations"
              content={fullResults}
              onChange={setFullResults}
              onGenerate={() => generateInterpretation('full-results')}
              onCopy={() => copyToClipboard(fullResults)}
              isGenerating={isGenerating && activeTab === 'full-results'}
              placeholder="Generate a comprehensive Results section including preliminary analyses, assumption checks, main findings, and supplementary analyses."
              fontClass="font-serif"
              minHeight="min-h-[350px]"
            />
          </PlanGate>
        </TabsContent>
      </Tabs>

      {/* Tips */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Tip:</strong> You can edit the AI-generated text to better fit your needs.
          Always review and verify statistical interpretations before publication.
        </AlertDescription>
      </Alert>
    </div>
  );
}

interface InterpretationPanelProps {
  title: string;
  description: string;
  content: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  onCopy: () => void;
  isGenerating: boolean;
  placeholder: string;
  fontClass?: string;
  minHeight?: string;
}

function InterpretationPanel({
  title,
  description,
  content,
  onChange,
  onGenerate,
  onCopy,
  isGenerating,
  placeholder,
  fontClass = '',
  minHeight = 'min-h-[200px]',
}: InterpretationPanelProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-foreground">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2">
          {content && (
            <Button variant="outline" size="sm" onClick={onCopy}>
              <Copy className="w-4 h-4 mr-1" />
              Copy
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : content ? (
              <RefreshCw className="w-4 h-4 mr-1" />
            ) : (
              <Wand2 className="w-4 h-4 mr-1" />
            )}
            {content ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
      </div>

      {content ? (
        <div className="bg-muted/50 rounded-lg p-4">
          <Textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            className={`${minHeight} bg-transparent border-none resize-none focus-visible:ring-0 ${fontClass}`}
          />
        </div>
      ) : (
        <div className="bg-muted/30 rounded-lg p-8 text-center border border-dashed">
          <Wand2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {placeholder}
          </p>
        </div>
      )}
    </>
  );
}
