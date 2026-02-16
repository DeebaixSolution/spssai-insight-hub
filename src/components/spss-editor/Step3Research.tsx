import { useState } from 'react';
import { Wand2, Lightbulb, HelpCircle, Plus, AlertCircle, FileQuestion, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Variable, Hypothesis } from '@/hooks/useAnalysisWizard';
import { HypothesisType } from '@/types/analysis';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { HypothesisCard } from './HypothesisCard';
import { StatisticalDecisionEngine } from './StatisticalDecisionEngine';

interface Step3ResearchProps {
  researchQuestion: string;
  onResearchQuestionChange: (question: string) => void;
  variables: Variable[];
  hypotheses: Hypothesis[];
  onHypothesesChange: (hypotheses: Hypothesis[]) => void;
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

interface ResearchQuestionSuggestion {
  question: string;
  suggestedDV: string[];
  suggestedIV: string[];
  rationale: string;
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [questionSuggestions, setQuestionSuggestions] = useState<ResearchQuestionSuggestion[]>([]);
  const [hypothesisCount, setHypothesisCount] = useState(3);

  const getNextHypothesisId = (): string => {
    const existing = hypotheses.map(h => parseInt(h.hypothesisId.replace('H', '')));
    const max = existing.length > 0 ? Math.max(...existing) : 0;
    return `H${max + 1}`;
  };

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

  const updateHypothesis = (id: string, updates: Partial<Hypothesis>) => {
    onHypothesesChange(
      hypotheses.map(h => h.id === id ? { ...h, ...updates } : h)
    );
  };

  const removeHypothesis = (id: string) => {
    onHypothesesChange(hypotheses.filter(h => h.id !== id));
  };

  // Generate Research Questions
  const handleGenerateQuestions = async () => {
    if (variables.length === 0) {
      toast.error('No variables available. Complete Step 2 first.');
      return;
    }

    setIsGeneratingQuestions(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-analysis', {
        body: {
          mode: 'research-questions',
          variables: variables.map(v => ({ name: v.name, type: v.type, label: v.label, role: v.role })),
        },
      });

      if (error) throw error;

      if (data?.questions) {
        setQuestionSuggestions(data.questions);
        toast.success('Research questions generated!');
      }
    } catch (err) {
      console.error('Question generation error:', err);
      toast.error('Failed to generate research questions.');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  // AI Hypothesis Generation with count control
  const handleAIAnalyze = async () => {
    if (!researchQuestion.trim()) {
      toast.error('Enter a research question first.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-analysis', {
        body: {
          researchQuestion,
          hypothesis: hypothesis || hypotheses.map(h => h.statement).join('\n'),
          variables: variables.map(v => ({ name: v.name, type: v.type, label: v.label, role: v.role })),
          hypothesisCount,
        },
      });

      if (error) throw error;

      if (data?.suggestions) {
        const suggestions: AISuggestion[] = data.suggestions.map((s: any, i: number) => ({
          hypothesisId: `H${hypotheses.length + i + 1}`,
          type: s.type || (s.testCategory?.includes('correlation') ? 'association' 
            : s.testCategory?.includes('regression') ? 'prediction' 
            : 'difference'),
          statement: s.statement || s.explanation || `There is a significant ${s.testType?.replace(/-/g, ' ')}`,
          dependentVariables: s.suggestedDV || [],
          independentVariables: s.suggestedIV || [],
          recommendedTest: s.testType,
        }));
        setAiSuggestions(suggestions);
        toast.success(`${suggestions.length} hypotheses generated!`);
      }
    } catch (err) {
      console.error('AI analysis error:', err);
      toast.error('Failed to analyze research question.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply AI suggestion with auto DV/IV
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
    
    toast.success(`Added ${newHypothesis.hypothesisId} with DV/IV pre-selected`);
  };

  // Add all suggestions at once
  const applyAllSuggestions = () => {
    const newHypotheses = aiSuggestions.map((s, i) => ({
      id: crypto.randomUUID(),
      hypothesisId: `H${hypotheses.length + i + 1}`,
      type: s.type,
      statement: s.statement,
      dependentVariables: s.dependentVariables,
      independentVariables: s.independentVariables,
      status: 'untested' as const,
    }));
    onHypothesesChange([...hypotheses, ...newHypotheses]);
    setAiSuggestions([]);
    toast.success(`Added ${newHypotheses.length} hypotheses!`);
  };

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
        
        {/* Generate Research Questions Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateQuestions}
          disabled={isGeneratingQuestions || variables.length === 0}
          className="w-full"
        >
          <FileQuestion className="w-4 h-4 mr-2" />
          {isGeneratingQuestions ? 'Generating...' : 'Generate Research Questions'}
        </Button>
      </div>

      {/* Research Question Suggestions */}
      {questionSuggestions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <FileQuestion className="w-4 h-4 text-primary" />
            Suggested Research Questions
          </h4>
          {questionSuggestions.map((q, i) => (
            <div
              key={i}
              onClick={() => {
                onResearchQuestionChange(q.question);
                setQuestionSuggestions([]);
                toast.success('Research question selected!');
              }}
              className="bg-muted/50 border border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <p className="font-medium text-foreground text-sm">{q.question}</p>
              <p className="text-xs text-muted-foreground mt-1">{q.rationale}</p>
              <div className="flex gap-2 mt-2">
                {q.suggestedDV?.length > 0 && (
                  <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                    DV: {q.suggestedDV.join(', ')}
                  </span>
                )}
                {q.suggestedIV?.length > 0 && (
                  <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded">
                    IV: {q.suggestedIV.join(', ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hypothesis Generation Controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm whitespace-nowrap">Count:</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={hypothesisCount}
              onChange={(e) => setHypothesisCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-16 h-8"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleAIAnalyze}
            disabled={isAnalyzing || !researchQuestion.trim()}
            className="flex-1"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {isAnalyzing ? 'Analyzing...' : `AI Generate ${hypothesisCount} Hypotheses`}
          </Button>
          <Button onClick={addHypothesis} className="flex-1">
            <Plus className="w-4 h-4 mr-2" />
            Add Manual
          </Button>
        </div>
      </div>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-warning" />
              AI Recommendations ({aiSuggestions.length})
            </h4>
            <Button size="sm" onClick={applyAllSuggestions}>
              Add All
            </Button>
          </div>
          {aiSuggestions.map((suggestion, index) => (
            <div
              key={index}
              className="bg-muted/50 border border-border rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-primary">{suggestion.hypothesisId}</span>
                    <span className="text-xs text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded">
                      {suggestion.type}
                    </span>
                  </div>
                  <h5 className="font-medium text-foreground text-sm">{suggestion.statement}</h5>
                  <div className="flex gap-2 mt-2">
                    {suggestion.dependentVariables.length > 0 && (
                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                        DV: {suggestion.dependentVariables.join(', ')}
                      </span>
                    )}
                    {suggestion.independentVariables.length > 0 && (
                      <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded">
                        IV: {suggestion.independentVariables.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applySuggestion(suggestion)}
                >
                  Add
                </Button>
              </div>
              {suggestion.recommendedTest && (
                <p className="text-xs text-muted-foreground">
                  Recommended: <strong>{suggestion.recommendedTest.replace(/-/g, ' ')}</strong>
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
              <div><span className="font-medium text-foreground">{scaleCount}</span><span className="text-muted-foreground text-sm ml-1">Scale</span></div>
              <div><span className="font-medium text-foreground">{nominalCount}</span><span className="text-muted-foreground text-sm ml-1">Nominal</span></div>
              <div><span className="font-medium text-foreground">{ordinalCount}</span><span className="text-muted-foreground text-sm ml-1">Ordinal</span></div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {variables.slice(0, 10).map((v) => (
            <span key={v.name} className={`px-2 py-1 rounded text-xs ${
              v.role === 'dependent' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : v.role === 'independent' ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300'
                : v.measure === 'scale' ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}>
              {v.name}
            </span>
          ))}
          {variables.length > 10 && (
            <span className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground">+{variables.length - 10} more</span>
          )}
        </div>
      </div>

      {hypotheses.length > 0 && (
        <StatisticalDecisionEngine variables={variables} parsedData={null} hypotheses={hypotheses} />
      )}

      {dvCount === 0 && hypotheses.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No variables assigned as <strong>DV</strong>. Go back to Variable View and assign roles.
          </AlertDescription>
        </Alert>
      )}

      {hypotheses.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Add at least one hypothesis to proceed to the Statistical Analysis Center.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
