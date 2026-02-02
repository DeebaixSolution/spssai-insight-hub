import { useState } from 'react';
import { Wand2, Lightbulb, HelpCircle, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Variable, Hypothesis } from '@/hooks/useAnalysisWizard';
import { HypothesisType } from '@/types/analysis';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { PlanGate } from '@/components/plan/PlanGate';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { HypothesisCard } from './HypothesisCard';

interface Step3ResearchProps {
  researchQuestion: string;
  onResearchQuestionChange: (question: string) => void;
  variables: Variable[];
  hypotheses: Hypothesis[];
  onHypothesesChange: (hypotheses: Hypothesis[]) => void;
  // Legacy support
  hypothesis?: string;
  onHypothesisChange?: (hypothesis: string) => void;
  onSuggestedTest?: (testCategory: string, testType: string) => void;
}

interface AISuggestion {
  hypothesisId: string;
  type: HypothesisType;
  statement: string;
  dependentVariables: string[];
  independentVariables: string[];
  recommendedTest?: string;
}

export function Step3Research({
  researchQuestion,
  onResearchQuestionChange,
  variables,
  hypotheses,
  onHypothesesChange,
  hypothesis,
  onHypothesisChange,
  onSuggestedTest,
}: Step3ResearchProps) {
  const { isPro } = usePlanLimits();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);

  // Generate next hypothesis ID
  const getNextHypothesisId = (): string => {
    const existing = hypotheses.map(h => parseInt(h.hypothesisId.replace('H', '')));
    const max = existing.length > 0 ? Math.max(...existing) : 0;
    return `H${max + 1}`;
  };

  // Add new hypothesis
  const addHypothesis = () => {
    const newHypothesis: Hypothesis = {
      id: crypto.randomUUID(),
      hypothesisId: getNextHypothesisId(),
      type: 'difference',
      statement: '',
      dependentVariables: [],
      independentVariables: [],
      status: 'untested',
    };
    onHypothesesChange([...hypotheses, newHypothesis]);
  };

  // Update hypothesis
  const updateHypothesis = (id: string, updates: Partial<Hypothesis>) => {
    onHypothesesChange(
      hypotheses.map(h => h.id === id ? { ...h, ...updates } : h)
    );
  };

  // Remove hypothesis
  const removeHypothesis = (id: string) => {
    onHypothesesChange(hypotheses.filter(h => h.id !== id));
  };

  // AI Analysis
  const handleAIAnalyze = async () => {
    if (!isPro || !researchQuestion.trim()) return;

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-analysis', {
        body: {
          researchQuestion,
          hypothesis: hypothesis || hypotheses.map(h => h.statement).join('\n'),
          variables: variables.map((v) => ({
            name: v.name,
            type: v.type,
            label: v.label,
            role: v.role,
          })),
        },
      });

      if (error) throw error;

      if (data?.suggestions) {
        // Convert suggestions to hypothesis format
        const suggestions: AISuggestion[] = data.suggestions.map((s: any, i: number) => ({
          hypothesisId: `H${hypotheses.length + i + 1}`,
          type: s.testCategory?.includes('correlation') ? 'association' 
            : s.testCategory?.includes('regression') ? 'prediction' 
            : 'difference',
          statement: s.explanation || `There is a significant ${s.testType?.replace(/-/g, ' ')}`,
          dependentVariables: [],
          independentVariables: [],
          recommendedTest: s.testType,
        }));
        setAiSuggestions(suggestions);
        toast.success('AI analysis complete!');
      }
    } catch (err) {
      console.error('AI analysis error:', err);
      toast.error('Failed to analyze research question. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply AI suggestion
  const applySuggestion = (suggestion: AISuggestion) => {
    const newHypothesis: Hypothesis = {
      id: crypto.randomUUID(),
      hypothesisId: getNextHypothesisId(),
      type: suggestion.type,
      statement: suggestion.statement,
      dependentVariables: suggestion.dependentVariables,
      independentVariables: suggestion.independentVariables,
      status: 'untested',
    };
    onHypothesesChange([...hypotheses, newHypothesis]);
    
    if (suggestion.recommendedTest && onSuggestedTest) {
      const category = suggestion.type === 'association' ? 'correlation' 
        : suggestion.type === 'prediction' ? 'regression' 
        : 'compare-means';
      onSuggestedTest(category, suggestion.recommendedTest);
    }
    
    toast.success(`Added ${newHypothesis.hypothesisId}`);
  };

  // Variable summary by role
  const dvCount = variables.filter(v => v.role === 'dependent').length;
  const ivCount = variables.filter(v => v.role === 'independent').length;
  const scaleCount = variables.filter(v => v.measure === 'scale').length;
  const nominalCount = variables.filter(v => v.measure === 'nominal').length;
  const ordinalCount = variables.filter(v => v.measure === 'ordinal').length;

  return (
    <div className="space-y-6">
      {/* Research Question */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="research-question" className="text-base font-medium">
            Research Question
          </Label>
          <span className="text-xs text-muted-foreground">(Recommended)</span>
        </div>
        <Textarea
          id="research-question"
          value={researchQuestion}
          onChange={(e) => onResearchQuestionChange(e.target.value)}
          placeholder="e.g., Is there a significant difference in academic performance between students who use online learning platforms and those who don't?"
          className="min-h-[100px]"
        />
        <p className="text-sm text-muted-foreground">
          A clear research question helps determine appropriate statistical tests and structure your analysis.
        </p>
      </div>

      {/* AI Analysis Button */}
      <div className="flex items-center gap-4">
        <PlanGate feature="aiResearchSuggestions" showOverlay={false}>
          <Button
            variant="outline"
            onClick={handleAIAnalyze}
            disabled={isAnalyzing || !researchQuestion.trim()}
            className="flex-1"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {isAnalyzing ? 'Analyzing...' : 'AI Suggest Hypotheses'}
          </Button>
        </PlanGate>
        <Button onClick={addHypothesis} className="flex-1">
          <Plus className="w-4 h-4 mr-2" />
          Add Hypothesis
        </Button>
      </div>

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
                    {suggestion.type}
                  </span>
                  <h5 className="font-medium text-foreground">{suggestion.statement}</h5>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applySuggestion(suggestion)}
                >
                  Add as {suggestion.hypothesisId}
                </Button>
              </div>
              {suggestion.recommendedTest && (
                <p className="text-sm text-muted-foreground">
                  Recommended test: <strong>{suggestion.recommendedTest.replace(/-/g, ' ')}</strong>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hypotheses List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-medium text-foreground">
            Hypotheses ({hypotheses.length})
          </h4>
          {hypotheses.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Add at least one hypothesis for inferential tests
            </span>
          )}
        </div>

        {hypotheses.length === 0 ? (
          <div className="border border-dashed rounded-lg p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="w-6 h-6 text-muted-foreground" />
            </div>
            <h4 className="font-medium text-foreground mb-2">No Hypotheses Yet</h4>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Add hypotheses to link your research questions to specific statistical tests.
              This helps structure your analysis and Chapter Four.
            </p>
            <Button onClick={addHypothesis} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Hypothesis
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {hypotheses.map((h, index) => (
              <HypothesisCard
                key={h.id}
                hypothesis={h}
                variables={variables}
                onUpdate={(updates) => updateHypothesis(h.id, updates)}
                onRemove={() => removeHypothesis(h.id)}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* Variable Summary */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          Your Variables
        </h4>
        
        {/* By Role */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-muted-foreground uppercase">By Role</span>
            <div className="flex gap-4 mt-1">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-medium text-foreground">{dvCount}</span>
                <span className="text-muted-foreground text-sm">DV</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="font-medium text-foreground">{ivCount}</span>
                <span className="text-muted-foreground text-sm">IV</span>
              </div>
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase">By Measure</span>
            <div className="flex gap-4 mt-1">
              <div>
                <span className="font-medium text-foreground">{scaleCount}</span>
                <span className="text-muted-foreground text-sm ml-1">Scale</span>
              </div>
              <div>
                <span className="font-medium text-foreground">{nominalCount}</span>
                <span className="text-muted-foreground text-sm ml-1">Nominal</span>
              </div>
              <div>
                <span className="font-medium text-foreground">{ordinalCount}</span>
                <span className="text-muted-foreground text-sm ml-1">Ordinal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Variable Tags */}
        <div className="flex flex-wrap gap-2">
          {variables.slice(0, 10).map((v) => (
            <span
              key={v.name}
              className={`px-2 py-1 rounded text-xs ${
                v.role === 'dependent'
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                  : v.role === 'independent'
                  ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300'
                  : v.measure === 'scale'
                  ? 'bg-primary/10 text-primary'
                  : v.measure === 'ordinal'
                  ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                  : 'bg-muted text-muted-foreground'
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

      {/* Validation Warning */}
      {dvCount === 0 && hypotheses.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No variables assigned as <strong>Dependent Variable (DV)</strong>. Go back to Variable View 
            and assign roles for better test recommendations.
          </AlertDescription>
        </Alert>
      )}

      {/* Tips */}
      <Alert>
        <Lightbulb className="h-4 w-4" />
        <AlertDescription>
          <strong>Tip:</strong> Each hypothesis should clearly state what you're testing. Use the type selector
          to indicate whether you're comparing groups (difference), examining relationships (association),
          or predicting outcomes (prediction).
        </AlertDescription>
      </Alert>
    </div>
  );
}
