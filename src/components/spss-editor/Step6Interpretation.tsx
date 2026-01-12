import { useState } from 'react';
import { Wand2, Copy, RefreshCw, CheckCircle, Loader2 } from 'lucide-react';
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
  aiInterpretation: string;
  onAiInterpretationChange: (interpretation: string) => void;
  apaResults: string;
  onApaResultsChange: (apa: string) => void;
  discussion: string;
  onDiscussionChange: (discussion: string) => void;
}

export function Step6Interpretation({
  analysisConfig,
  results,
  researchQuestion,
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

  const generateInterpretation = async (type: 'summary' | 'apa' | 'discussion') => {
    if (!results || !analysisConfig) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('interpret-results', {
        body: {
          type,
          testType: analysisConfig.testType,
          results: results.tables,
          researchQuestion,
          isPro,
        },
      });

      if (error) throw error;

      if (data?.interpretation) {
        if (type === 'summary') {
          onAiInterpretationChange(data.interpretation);
        } else if (type === 'apa') {
          onApaResultsChange(data.interpretation);
        } else {
          onDiscussionChange(data.interpretation);
        }
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} generated!`);
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
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">AI Interpretation</h3>
        <p className="text-sm text-muted-foreground">
          Generate AI-powered explanations of your results
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="apa" disabled={!isPro}>
            APA Results {!isPro && '🔒'}
          </TabsTrigger>
          <TabsTrigger value="discussion" disabled={!isPro}>
            Discussion {!isPro && '🔒'}
          </TabsTrigger>
        </TabsList>

        {/* Summary Tab - Available to all */}
        <TabsContent value="summary" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Plain language explanation of your results
            </p>
            <div className="flex gap-2">
              {aiInterpretation && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(aiInterpretation)}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateInterpretation('summary')}
                disabled={isGenerating}
              >
                {isGenerating && activeTab === 'summary' ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : aiInterpretation ? (
                  <RefreshCw className="w-4 h-4 mr-1" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-1" />
                )}
                {aiInterpretation ? 'Regenerate' : 'Generate'}
              </Button>
            </div>
          </div>

          {aiInterpretation ? (
            <div className="bg-muted/50 rounded-lg p-4">
              <Textarea
                value={aiInterpretation}
                onChange={(e) => onAiInterpretationChange(e.target.value)}
                className="min-h-[200px] bg-transparent border-none resize-none focus-visible:ring-0"
              />
            </div>
          ) : (
            <div className="bg-muted/30 rounded-lg p-8 text-center border border-dashed">
              <Wand2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                Click "Generate" to create an AI interpretation
              </p>
            </div>
          )}
        </TabsContent>

        {/* APA Results Tab - Pro Only */}
        <TabsContent value="apa" className="space-y-4">
          <PlanGate feature="apaResults">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Publication-ready APA-formatted results
              </p>
              <div className="flex gap-2">
                {apaResults && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(apaResults)}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateInterpretation('apa')}
                  disabled={isGenerating}
                >
                  {isGenerating && activeTab === 'apa' ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : apaResults ? (
                    <RefreshCw className="w-4 h-4 mr-1" />
                  ) : (
                    <Wand2 className="w-4 h-4 mr-1" />
                  )}
                  {apaResults ? 'Regenerate' : 'Generate'}
                </Button>
              </div>
            </div>

            {apaResults ? (
              <div className="bg-muted/50 rounded-lg p-4">
                <Textarea
                  value={apaResults}
                  onChange={(e) => onApaResultsChange(e.target.value)}
                  className="min-h-[200px] bg-transparent border-none resize-none focus-visible:ring-0 font-serif"
                />
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-8 text-center border border-dashed">
                <Wand2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Generate APA-formatted results text
                </p>
              </div>
            )}
          </PlanGate>
        </TabsContent>

        {/* Discussion Tab - Pro Only */}
        <TabsContent value="discussion" className="space-y-4">
          <PlanGate feature="discussion">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Academic discussion with implications
              </p>
              <div className="flex gap-2">
                {discussion && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(discussion)}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateInterpretation('discussion')}
                  disabled={isGenerating}
                >
                  {isGenerating && activeTab === 'discussion' ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : discussion ? (
                    <RefreshCw className="w-4 h-4 mr-1" />
                  ) : (
                    <Wand2 className="w-4 h-4 mr-1" />
                  )}
                  {discussion ? 'Regenerate' : 'Generate'}
                </Button>
              </div>
            </div>

            {discussion ? (
              <div className="bg-muted/50 rounded-lg p-4">
                <Textarea
                  value={discussion}
                  onChange={(e) => onDiscussionChange(e.target.value)}
                  className="min-h-[250px] bg-transparent border-none resize-none focus-visible:ring-0 font-serif"
                />
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-8 text-center border border-dashed">
                <Wand2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Generate a discussion section with implications
                </p>
              </div>
            )}
          </PlanGate>
        </TabsContent>
      </Tabs>

      {/* Tips */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Tip:</strong> You can edit the AI-generated text to better fit your needs.
          The interpretation is a starting point, not a final draft.
        </AlertDescription>
      </Alert>
    </div>
  );
}
