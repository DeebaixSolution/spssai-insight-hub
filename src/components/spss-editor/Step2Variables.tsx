import { useState } from 'react';
import { Wand2, Edit2, Save, X, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Variable, ParsedDataset } from '@/hooks/useAnalysisWizard';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { PlanGate } from '@/components/plan/PlanGate';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Step2VariablesProps {
  variables: Variable[];
  onVariablesChange: (variables: Variable[]) => void;
  parsedData: ParsedDataset | null;
}

const variableTypes = [
  { value: 'scale', label: 'Scale', description: 'Numeric continuous' },
  { value: 'ordinal', label: 'Ordinal', description: 'Ordered categories' },
  { value: 'nominal', label: 'Nominal', description: 'Unordered categories' },
];

export function Step2Variables({
  variables,
  onVariablesChange,
  parsedData,
}: Step2VariablesProps) {
  const { isPro } = usePlanLimits();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingVariable, setEditingVariable] = useState<Variable | null>(null);
  const [valueLabelsOpen, setValueLabelsOpen] = useState(false);
  const [valueLabelsVariable, setValueLabelsVariable] = useState<Variable | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditingVariable({ ...variables[index] });
  };

  const handleSave = () => {
    if (editingIndex !== null && editingVariable) {
      const newVariables = [...variables];
      newVariables[editingIndex] = editingVariable;
      onVariablesChange(newVariables);
      setEditingIndex(null);
      setEditingVariable(null);
    }
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditingVariable(null);
  };

  const handleTypeChange = (index: number, type: 'nominal' | 'ordinal' | 'scale') => {
    const newVariables = [...variables];
    newVariables[index] = { ...newVariables[index], type, measure: type };
    onVariablesChange(newVariables);
  };

  const openValueLabels = (variable: Variable) => {
    setValueLabelsVariable({ ...variable });
    setValueLabelsOpen(true);
  };

  const saveValueLabels = () => {
    if (valueLabelsVariable) {
      const index = variables.findIndex((v) => v.name === valueLabelsVariable.name);
      if (index !== -1) {
        const newVariables = [...variables];
        newVariables[index] = valueLabelsVariable;
        onVariablesChange(newVariables);
      }
    }
    setValueLabelsOpen(false);
    setValueLabelsVariable(null);
  };

  const handleAIDetection = async () => {
    if (!isPro || !parsedData) return;

    setIsDetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-variables', {
        body: {
          headers: parsedData.headers,
          sampleData: parsedData.rows.slice(0, 50),
        },
      });

      if (error) throw error;

      if (data?.variables) {
        const updatedVariables = variables.map((v) => {
          const detected = data.variables.find(
            (d: { name: string; type: string; label?: string }) => d.name === v.name
          );
          if (detected) {
            return {
              ...v,
              type: detected.type as 'nominal' | 'ordinal' | 'scale',
              measure: detected.type as 'nominal' | 'ordinal' | 'scale',
              label: detected.label || v.label,
            };
          }
          return v;
        });
        onVariablesChange(updatedVariables);
        toast.success('AI detection complete! Variable types have been updated.');
      }
    } catch (err) {
      console.error('AI detection error:', err);
      toast.error('Failed to detect variable types. Please try again.');
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with AI Detection */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Variable View</h3>
          <p className="text-sm text-muted-foreground">
            Configure your variables like in SPSS Variable View
          </p>
        </div>
        <PlanGate feature="aiVariableDetection" showOverlay={false}>
          <Button
            variant="outline"
            onClick={handleAIDetection}
            disabled={isDetecting}
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {isDetecting ? 'Detecting...' : 'AI Detect Types'}
          </Button>
        </PlanGate>
      </div>

      {/* Variable Grid */}
      <div className="border border-border rounded-lg overflow-hidden">
        <ScrollArea className="w-full">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="p-3 text-left font-medium border-b border-r border-border w-12">
                  #
                </th>
                <th className="p-3 text-left font-medium border-b border-r border-border min-w-[120px]">
                  Name
                </th>
                <th className="p-3 text-left font-medium border-b border-r border-border min-w-[100px]">
                  Type
                </th>
                <th className="p-3 text-left font-medium border-b border-r border-border min-w-[60px]">
                  Width
                </th>
                <th className="p-3 text-left font-medium border-b border-r border-border min-w-[70px]">
                  Decimals
                </th>
                <th className="p-3 text-left font-medium border-b border-r border-border min-w-[200px]">
                  Label
                </th>
                <th className="p-3 text-left font-medium border-b border-r border-border min-w-[100px]">
                  Values
                </th>
                <th className="p-3 text-left font-medium border-b border-border min-w-[100px]">
                  Measure
                </th>
                <th className="p-3 text-left font-medium border-b border-border w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {variables.map((variable, index) => {
                const isEditing = editingIndex === index;
                const v = isEditing && editingVariable ? editingVariable : variable;

                return (
                  <tr
                    key={variable.name}
                    className={cn(
                      'hover:bg-muted/50 transition-colors',
                      isEditing && 'bg-primary/5'
                    )}
                  >
                    <td className="p-3 border-b border-r border-border/50 text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="p-3 border-b border-r border-border/50 font-mono">
                      {isEditing ? (
                        <Input
                          value={v.name}
                          onChange={(e) =>
                            setEditingVariable({ ...v, name: e.target.value })
                          }
                          className="h-8"
                        />
                      ) : (
                        v.name
                      )}
                    </td>
                    <td className="p-3 border-b border-r border-border/50">
                      <Select
                        value={v.type}
                        onValueChange={(val) =>
                          isEditing
                            ? setEditingVariable({
                                ...v,
                                type: val as 'nominal' | 'ordinal' | 'scale',
                                measure: val as 'nominal' | 'ordinal' | 'scale',
                              })
                            : handleTypeChange(index, val as 'nominal' | 'ordinal' | 'scale')
                        }
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {variableTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 border-b border-r border-border/50">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={v.width}
                          onChange={(e) =>
                            setEditingVariable({
                              ...v,
                              width: parseInt(e.target.value) || 8,
                            })
                          }
                          className="h-8 w-16"
                        />
                      ) : (
                        v.width
                      )}
                    </td>
                    <td className="p-3 border-b border-r border-border/50">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={v.decimals}
                          onChange={(e) =>
                            setEditingVariable({
                              ...v,
                              decimals: parseInt(e.target.value) || 0,
                            })
                          }
                          className="h-8 w-16"
                        />
                      ) : (
                        v.decimals
                      )}
                    </td>
                    <td className="p-3 border-b border-r border-border/50">
                      {isEditing ? (
                        <Input
                          value={v.label}
                          onChange={(e) =>
                            setEditingVariable({ ...v, label: e.target.value })
                          }
                          placeholder="Variable label..."
                          className="h-8"
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {v.label || '—'}
                        </span>
                      )}
                    </td>
                    <td className="p-3 border-b border-r border-border/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openValueLabels(variable)}
                        className="h-7 text-xs"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {Object.keys(v.valueLabels || {}).length > 0
                          ? `${Object.keys(v.valueLabels).length} labels`
                          : 'None'}
                      </Button>
                    </td>
                    <td className="p-3 border-b border-r border-border/50 capitalize">
                      {v.measure}
                    </td>
                    <td className="p-3 border-b border-border/50">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSave}
                            className="h-7 w-7 p-0"
                          >
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancel}
                            className="h-7 w-7 p-0"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(index)}
                          className="h-7 w-7 p-0"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Value Labels Dialog */}
      <Dialog open={valueLabelsOpen} onOpenChange={setValueLabelsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Value Labels: {valueLabelsVariable?.name}</DialogTitle>
            <DialogDescription>
              Define labels for numeric codes (e.g., 1 = "Male", 2 = "Female")
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {valueLabelsVariable && (
              <ValueLabelsEditor
                valueLabels={valueLabelsVariable.valueLabels || {}}
                onChange={(labels) =>
                  setValueLabelsVariable({ ...valueLabelsVariable, valueLabels: labels })
                }
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setValueLabelsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveValueLabels}>Save Labels</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Legend */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-foreground mb-2">Variable Types:</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {variableTypes.map((type) => (
            <div key={type.value}>
              <span className="font-medium text-foreground">{type.label}:</span>{' '}
              <span className="text-muted-foreground">{type.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Value Labels Editor Component
function ValueLabelsEditor({
  valueLabels,
  onChange,
}: {
  valueLabels: Record<string, string>;
  onChange: (labels: Record<string, string>) => void;
}) {
  const entries = Object.entries(valueLabels);
  const [newValue, setNewValue] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const addEntry = () => {
    if (newValue && newLabel) {
      onChange({ ...valueLabels, [newValue]: newLabel });
      setNewValue('');
      setNewLabel('');
    }
  };

  const removeEntry = (value: string) => {
    const newLabels = { ...valueLabels };
    delete newLabels[value];
    onChange(newLabels);
  };

  return (
    <div className="space-y-3">
      {entries.map(([value, label]) => (
        <div key={value} className="flex items-center gap-2">
          <Input value={value} disabled className="w-20" />
          <span className="text-muted-foreground">=</span>
          <Input value={label} disabled className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeEntry(value)}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Input
          placeholder="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="w-20"
        />
        <span className="text-muted-foreground">=</span>
        <Input
          placeholder="Label"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="flex-1"
        />
        <Button variant="outline" size="sm" onClick={addEntry} className="h-8">
          Add
        </Button>
      </div>
    </div>
  );
}
