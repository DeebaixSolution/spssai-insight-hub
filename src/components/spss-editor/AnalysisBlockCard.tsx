import { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, GripVertical, AlertTriangle, CheckCircle, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { AnalysisBlock, Hypothesis, Variable, TestDefinition } from '@/types/analysis';

interface AnalysisBlockCardProps {
  block: AnalysisBlock;
  index: number;
  hypotheses: Hypothesis[];
  variables: Variable[];
  onUpdate: (block: AnalysisBlock) => void;
  onRemove: () => void;
  testDefinition: TestDefinition | undefined;
  validationErrors: string[];
}

export function AnalysisBlockCard({
  block,
  index,
  hypotheses,
  variables,
  onUpdate,
  onRemove,
  testDefinition,
  validationErrors,
}: AnalysisBlockCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isValid = validationErrors.length === 0;
  const requiresHypothesis = testDefinition?.category !== 'descriptive' && 
                              testDefinition?.category !== 'reliability';

  const getSectionOptions = () => {
    const options = [
      { value: 'descriptives', label: 'Descriptives / Demographics' },
      { value: 'reliability', label: 'Reliability Analysis' },
    ];
    
    hypotheses.forEach(h => {
      options.push({ value: h.id, label: `${h.hypothesisId}: ${h.statement.slice(0, 30)}...` });
    });
    
    return options;
  };

  const getVariablesByMeasure = (measures: string[]) => {
    return variables.filter(v => measures.includes(v.measure || 'scale'));
  };

  const handleVariableAdd = (role: 'dependent' | 'independent' | 'grouping', varName: string) => {
    const updated = { ...block };
    if (role === 'dependent') {
      if (!updated.dependentVariables.includes(varName)) {
        updated.dependentVariables = [...updated.dependentVariables, varName];
      }
    } else if (role === 'independent') {
      if (!updated.independentVariables.includes(varName)) {
        updated.independentVariables = [...updated.independentVariables, varName];
      }
    } else if (role === 'grouping') {
      updated.groupingVariable = varName;
    }
    onUpdate(updated);
  };

  const handleVariableRemove = (role: 'dependent' | 'independent' | 'grouping', varName: string) => {
    const updated = { ...block };
    if (role === 'dependent') {
      updated.dependentVariables = updated.dependentVariables.filter(v => v !== varName);
    } else if (role === 'independent') {
      updated.independentVariables = updated.independentVariables.filter(v => v !== varName);
    } else if (role === 'grouping') {
      updated.groupingVariable = undefined;
    }
    onUpdate(updated);
  };

  return (
    <Card className={cn(
      'transition-all',
      !isValid && 'border-destructive/50 bg-destructive/5',
      isValid && block.status === 'completed' && 'border-primary/50'
    )}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="p-4">
          <div className="flex items-center gap-3">
            <div className="cursor-move text-muted-foreground hover:text-foreground">
              <GripVertical className="w-4 h-4" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  #{index + 1}
                </span>
                <Badge variant="outline" className="text-xs">
                  {testDefinition?.name || block.testType}
                </Badge>
                {block.linkedHypothesisId && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Link className="w-3 h-3" />
                    {hypotheses.find(h => h.id === block.linkedHypothesisId)?.hypothesisId}
                  </Badge>
                )}
                {isValid ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <ul className="text-xs space-y-1">
                        {validationErrors.map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {testDefinition?.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-4">
            {/* Section & Hypothesis Link */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Section</Label>
                <Select
                  value={block.sectionId}
                  onValueChange={(value) => {
                    const isHypothesis = hypotheses.some(h => h.id === value);
                    onUpdate({
                      ...block,
                      section: isHypothesis ? 'hypothesis' : value as 'descriptives' | 'reliability',
                      sectionId: value,
                      linkedHypothesisId: isHypothesis ? value : undefined,
                    });
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {getSectionOptions().map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {requiresHypothesis && !block.linkedHypothesisId && (
                <div className="flex items-center">
                  <Badge variant="outline" className="text-warning border-warning">
                    Link to hypothesis required
                  </Badge>
                </div>
              )}
            </div>

            {/* Variable Assignment */}
            <div className="space-y-3">
              {/* Dependent Variables */}
              {testDefinition?.requiredVariables?.dependent && (
                <VariableSlot
                  label="Dependent Variable(s)"
                  description={`${testDefinition.requiredVariables.dependent.measures.join('/')} • Min: ${testDefinition.requiredVariables.dependent.min}, Max: ${testDefinition.requiredVariables.dependent.max}`}
                  availableVariables={getVariablesByMeasure(testDefinition.requiredVariables.dependent.measures)}
                  selectedVariables={block.dependentVariables}
                  onAdd={(name) => handleVariableAdd('dependent', name)}
                  onRemove={(name) => handleVariableRemove('dependent', name)}
                  max={testDefinition.requiredVariables.dependent.max}
                />
              )}

              {/* Independent Variables */}
              {testDefinition?.requiredVariables?.independent && (
                <VariableSlot
                  label="Independent Variable(s)"
                  description={`${testDefinition.requiredVariables.independent.measures.join('/')} • Min: ${testDefinition.requiredVariables.independent.min}, Max: ${testDefinition.requiredVariables.independent.max}`}
                  availableVariables={getVariablesByMeasure(testDefinition.requiredVariables.independent.measures)}
                  selectedVariables={block.independentVariables}
                  onAdd={(name) => handleVariableAdd('independent', name)}
                  onRemove={(name) => handleVariableRemove('independent', name)}
                  max={testDefinition.requiredVariables.independent.max}
                />
              )}

              {/* Grouping Variable */}
              {testDefinition?.requiredVariables?.grouping && (
                <VariableSlot
                  label="Grouping Variable"
                  description={`${testDefinition.requiredVariables.grouping.measures.join('/')}`}
                  availableVariables={getVariablesByMeasure(testDefinition.requiredVariables.grouping.measures)}
                  selectedVariables={block.groupingVariable ? [block.groupingVariable] : []}
                  onAdd={(name) => handleVariableAdd('grouping', name)}
                  onRemove={(name) => handleVariableRemove('grouping', name)}
                  max={1}
                />
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Variable Slot Component
function VariableSlot({
  label,
  description,
  availableVariables,
  selectedVariables,
  onAdd,
  onRemove,
  max,
}: {
  label: string;
  description: string;
  availableVariables: Variable[];
  selectedVariables: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  max: number;
}) {
  const canAdd = selectedVariables.length < max;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>

      <div className="min-h-[40px] p-2 border rounded-lg bg-muted/30">
        {selectedVariables.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selectedVariables.map((name) => (
              <Badge key={name} variant="secondary" className="gap-1 text-xs">
                {name}
                <button 
                  onClick={() => onRemove(name)} 
                  className="ml-0.5 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Select variables below
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {availableVariables
          .filter((v) => !selectedVariables.includes(v.name))
          .slice(0, 20)
          .map((v) => (
            <Button
              key={v.name}
              variant="ghost"
              size="sm"
              onClick={() => canAdd && onAdd(v.name)}
              disabled={!canAdd}
              className="h-6 text-xs px-2"
            >
              {v.name}
            </Button>
          ))}
        {availableVariables.filter(v => !selectedVariables.includes(v.name)).length > 20 && (
          <span className="text-xs text-muted-foreground">
            +{availableVariables.filter(v => !selectedVariables.includes(v.name)).length - 20} more
          </span>
        )}
      </div>
    </div>
  );
}
