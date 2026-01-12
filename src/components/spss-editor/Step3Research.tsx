import { useState } from 'react';
import { Wand2, Lightbulb, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Variable } from '@/hooks/useAnalysisWizard';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { PlanGate } from '@/components/plan/PlanGate';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Step3ResearchProps {
  researchQuestion: string;
  onResearchQuestionChange: (question: string) => void;
  hypothesis: string;
  onHypothesisChange: (hypothesis: string) => void;
  variables: Variable[];
  onSuggestedTest?: (testCategory: string, testType: string) => void;
}

interface AISuggestion {
  testCategory: string;
  testType: string;
  explanation: string;
}

export function Step3Research({
  researchQuestion,
  onResearchQuestionChange,
  hypothesis,
  onHypothesisChange,
  variables,
  onSuggestedTest,
}: Step3ResearchProps) {
  const { isPro } = usePlanLimits();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);

  const handleAIAnalyze = async () => {
    if (!isPro || !researchQuestion.trim()) return;

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-analysis', {
        body: {
          researchQuestion,
          hypothesis,
          variables: variables.map((v) => ({
            name: v.name,
            type: v.type,
            label: v.label,
          })),
        },
      });

      if (error) throw error;

      if (data?.suggestions) {
        setAiSuggestions(data.suggestions);
        toast.success('AI analysis complete!');
      }
    } catch (err) {
      console.error('AI analysis error:', err);
      toast.error('Failed to analyze research question. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applySuggestion = (suggestion: AISuggestion) => {
    if (onSuggestedTest) {
      onSuggestedTest(suggestion.testCategory, suggestion.testType);
    }
    toast.success(`Applied: ${suggestion.testType}`);
  };

  return (
    <div className="space-y-6">
      {/* Research Question */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="research-question" className="text-base font-medium">
            Research Question
          </Label>
          <span className="text-xs text-muted-foreground">(Optional but recommended)</span>
        </div>
        <Textarea
          id="research-question"
          value={researchQuestion}
          onChange={(e) => onResearchQuestionChange(e.target.value)}
          placeholder="e.g., Is there a significant difference in test scores between male and female students?"
          className="min-h-[100px]"
        />
        <p className="text-sm text-muted-foreground">
          Describe what you want to find out. This helps the AI suggest appropriate statistical tests.
        </p>
      </div>

      {/* Hypothesis */}
      <div className="space-y-2">
        <Label htmlFor="hypothesis" className="text-base font-medium">
          Hypothesis
        </Label>
        <Textarea
          id="hypothesis"
          value={hypothesis}
          onChange={(e) => onHypothesisChange(e.target.value)}
          placeholder="e.g., H1: There is a significant difference in test scores between male and female students."
          className="min-h-[80px]"
        />
        <p className="text-sm text-muted-foreground">
          State your expected outcome or prediction.
        </p>
      </div>

      {/* AI Analysis Button */}
      <PlanGate feature="aiResearchSuggestions" showOverlay={false}>
        <Button
          variant="outline"
          onClick={handleAIAnalyze}
          disabled={isAnalyzing || !researchQuestion.trim()}
          className="w-full"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          {isAnalyzing ? 'Analyzing...' : 'AI Suggest Statistical Tests'}
        </Button>
      </PlanGate>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-warning" />
            AI Recommendations
          </h4>
          {aiSuggestions.map((suggestion, index) => (
            <div
              key={index}
              className="bg-muted/50 border border-border rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground uppercase">
                    {suggestion.testCategory}
                  </span>
                  <h5 className="font-medium text-foreground">{suggestion.testType}</h5>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applySuggestion(suggestion)}
                >
                  Apply
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{suggestion.explanation}</p>
            </div>
          ))}
        </div>
      )}

      {/* Variable Summary */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          Your Variables
        </h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium text-foreground">
              {variables.filter((v) => v.type === 'scale').length}
            </span>{' '}
            <span className="text-muted-foreground">Scale variables</span>
          </div>
          <div>
            <span className="font-medium text-foreground">
              {variables.filter((v) => v.type === 'nominal').length}
            </span>{' '}
            <span className="text-muted-foreground">Nominal variables</span>
          </div>
          <div>
            <span className="font-medium text-foreground">
              {variables.filter((v) => v.type === 'ordinal').length}
            </span>{' '}
            <span className="text-muted-foreground">Ordinal variables</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {variables.slice(0, 10).map((v) => (
            <span
              key={v.name}
              className={`px-2 py-1 rounded text-xs ${
                v.type === 'scale'
                  ? 'bg-primary/10 text-primary'
                  : v.type === 'ordinal'
                  ? 'bg-warning/10 text-warning'
                  : 'bg-accent/10 text-accent'
              }`}
            >
              {v.name}
            </span>
          ))}
          {variables.length > 10 && (
            <span className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground">
              +{variables.length - 10} more
            </span>
          )}
        </div>
      </div>

      {/* Tips */}
      <Alert>
        <Lightbulb className="h-4 w-4" />
        <AlertDescription>
          <strong>Tip:</strong> A clear research question helps determine the right statistical test.
          Include your independent variable(s), dependent variable(s), and what relationship you're
          testing.
        </AlertDescription>
      </Alert>
    </div>
  );
}
