import { useState } from 'react';
import { Wand2, Edit2, Save, X, Tag, Users, Layers, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Variable, ParsedDataset } from '@/hooks/useAnalysisWizard';
import { VariableRole, VariableMeasure } from '@/types/analysis';
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

const variableMeasures: { value: VariableMeasure; label: string; description: string; icon: string }[] = [
  { value: 'scale', label: 'Scale', description: 'Numeric continuous', icon: '📊' },
  { value: 'ordinal', label: 'Ordinal', description: 'Ordered categories', icon: '📈' },
  { value: 'nominal', label: 'Nominal', description: 'Unordered categories', icon: '🏷️' },
];

const variableRoles: { value: VariableRole; label: string; description: string; color: string }[] = [
  { value: null, label: 'None', description: 'No specific role', color: 'bg-muted' },
  { value: 'id', label: 'ID', description: 'Unique identifier', color: 'bg-slate-500' },
  { value: 'demographic', label: 'Demographic', description: 'Background variable', color: 'bg-blue-500' },
  { value: 'dependent', label: 'DV', description: 'Dependent variable', color: 'bg-green-500' },
  { value: 'independent', label: 'IV', description: 'Independent variable', color: 'bg-orange-500' },
  { value: 'scale_item', label: 'Scale Item', description: 'Part of a scale', color: 'bg-purple-500' },
];

const getRoleColor = (role: VariableRole): string => {
  const found = variableRoles.find(r => r.value === role);
  return found?.color || 'bg-muted';
};

const getRoleLabel = (role: VariableRole): string => {
  const found = variableRoles.find(r => r.value === role);
  return found?.label || 'None';
};

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
  const [scaleGroupOpen, setScaleGroupOpen] = useState(false);
  const [selectedForScale, setSelectedForScale] = useState<Set<string>>(new Set());
  const [scaleGroupName, setScaleGroupName] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);

  // Get unique values for a variable (for value labels suggestions)
  const getUniqueValues = (varName: string): string[] => {
    if (!parsedData) return [];
    const values = new Set<string>();
    parsedData.rows.forEach(row => {
      const val = row[varName];
      if (val !== null && val !== undefined && val !== '') {
        values.add(String(val));
      }
    });
    return Array.from(values).slice(0, 20); // Limit to 20 unique values
  };

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

  const handleMeasureChange = (index: number, measure: VariableMeasure) => {
    const newVariables = [...variables];
    newVariables[index] = { ...newVariables[index], type: measure, measure };
    onVariablesChange(newVariables);
  };

  const handleRoleChange = (index: number, role: VariableRole) => {
    const newVariables = [...variables];
    newVariables[index] = { ...newVariables[index], role };
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

  const openScaleGrouping = () => {
    setSelectedForScale(new Set());
    setScaleGroupName('');
    setScaleGroupOpen(true);
  };

  const toggleScaleSelection = (varName: string) => {
    const newSet = new Set(selectedForScale);
    if (newSet.has(varName)) {
      newSet.delete(varName);
    } else {
      newSet.add(varName);
    }
    setSelectedForScale(newSet);
  };

  const saveScaleGroup = () => {
    if (selectedForScale.size < 2 || !scaleGroupName.trim()) {
      toast.error('Select at least 2 items and provide a scale name');
      return;
    }

    const newVariables = variables.map(v => {
      if (selectedForScale.has(v.name)) {
        return { ...v, role: 'scale_item' as VariableRole, scaleGroup: scaleGroupName };
      }
      return v;
    });
    onVariablesChange(newVariables);
    setScaleGroupOpen(false);
    toast.success(`Created scale group: ${scaleGroupName}`);
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
            (d: { name: string; type: string; label?: string; role?: string }) => d.name === v.name
          );
          if (detected) {
            return {
              ...v,
              type: detected.type as VariableMeasure,
              measure: detected.type as VariableMeasure,
              label: detected.label || v.label,
              role: (detected.role as VariableRole) || v.role,
            };
          }
          return v;
        });
        onVariablesChange(updatedVariables);
        toast.success('AI detection complete! Variable types and roles updated.');
      }
    } catch (err) {
      console.error('AI detection error:', err);
      toast.error('Failed to detect variable types. Please try again.');
    } finally {
      setIsDetecting(false);
    }
  };

  // Count variables by role
  const roleCounts = variables.reduce((acc, v) => {
    const key = v.role || 'none';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get scale groups
  const scaleGroups = [...new Set(variables.filter(v => v.scaleGroup).map(v => v.scaleGroup))];

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Variable View</h3>
          <p className="text-sm text-muted-foreground">
            Configure variables like SPSS Variable View — set types, roles, and value labels
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openScaleGrouping}>
            <Layers className="w-4 h-4 mr-2" />
            Group Scale Items
          </Button>
          <PlanGate feature="aiVariableDetection" showOverlay={false}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAIDetection}
              disabled={isDetecting}
            >
              <Wand2 className="w-4 h-4 mr-2" />
              {isDetecting ? 'Detecting...' : 'AI Detect'}
            </Button>
          </PlanGate>
        </div>
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {variableRoles.filter(r => r.value !== null).map(role => (
          <div
            key={role.value}
            className={cn(
              'rounded-lg p-3 text-center transition-all',
              roleCounts[role.value || 'none'] > 0
                ? `${role.color} text-white`
                : 'bg-muted text-muted-foreground'
            )}
          >
            <div className="text-2xl font-bold">{roleCounts[role.value || 'none'] || 0}</div>
            <div className="text-xs font-medium">{role.label}</div>
          </div>
        ))}
      </div>

      {/* Scale Groups Display */}
      {scaleGroups.length > 0 && (
        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Scale Groups
          </h4>
          <div className="flex flex-wrap gap-2">
            {scaleGroups.map(group => {
              const items = variables.filter(v => v.scaleGroup === group);
              return (
                <Badge key={group} variant="secondary" className="bg-purple-100 dark:bg-purple-900">
                  {group} ({items.length} items)
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Variable Grid */}
      <div className="border border-border rounded-lg overflow-hidden">
        <ScrollArea className="w-full">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="p-3 text-left font-medium border-b border-r border-border w-12">#</th>
                <th className="p-3 text-left font-medium border-b border-r border-border min-w-[120px]">Name</th>
                <th className="p-3 text-left font-medium border-b border-r border-border min-w-[100px]">Role</th>
                <th className="p-3 text-left font-medium border-b border-r border-border min-w-[100px]">Measure</th>
                <th className="p-3 text-left font-medium border-b border-r border-border min-w-[60px]">Width</th>
                <th className="p-3 text-left font-medium border-b border-r border-border min-w-[70px]">Dec</th>
                <th className="p-3 text-left font-medium border-b border-r border-border min-w-[200px]">Label</th>
                <th className="p-3 text-left font-medium border-b border-r border-border min-w-[100px]">Values</th>
                <th className="p-3 text-left font-medium border-b border-border w-20">Actions</th>
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
                    <td className="p-3 border-b border-r border-border/50">
                      {isEditing ? (
                        <Input
                          value={v.name}
                          onChange={(e) => setEditingVariable({ ...v, name: e.target.value })}
                          className="h-8"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{v.name}</span>
                          {v.scaleGroup && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                              {v.scaleGroup}
                            </Badge>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 border-b border-r border-border/50">
                      <Select
                        value={v.role || 'none'}
                        onValueChange={(val) => {
                          const newRole = val === 'none' ? null : val as VariableRole;
                          if (isEditing) {
                            setEditingVariable({ ...v, role: newRole });
                          } else {
                            handleRoleChange(index, newRole);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 w-full">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2 h-2 rounded-full', getRoleColor(v.role))} />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {variableRoles.map((role) => (
                            <SelectItem key={role.value || 'none'} value={role.value || 'none'}>
                              <div className="flex items-center gap-2">
                                <div className={cn('w-2 h-2 rounded-full', role.color)} />
                                <span>{role.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 border-b border-r border-border/50">
                      <Select
                        value={v.measure}
                        onValueChange={(val) => {
                          const newMeasure = val as VariableMeasure;
                          if (isEditing) {
                            setEditingVariable({ ...v, type: newMeasure, measure: newMeasure });
                          } else {
                            handleMeasureChange(index, newMeasure);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {variableMeasures.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              <span>{m.icon} {m.label}</span>
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
                          onChange={(e) => setEditingVariable({ ...v, width: parseInt(e.target.value) || 8 })}
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
                          onChange={(e) => setEditingVariable({ ...v, decimals: parseInt(e.target.value) || 0 })}
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
                          onChange={(e) => setEditingVariable({ ...v, label: e.target.value })}
                          placeholder="Variable label..."
                          className="h-8"
                        />
                      ) : (
                        <span className="text-muted-foreground">{v.label || '—'}</span>
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
                    <td className="p-3 border-b border-border/50">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={handleSave} className="h-7 w-7 p-0">
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={handleCancel} className="h-7 w-7 p-0">
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(index)} className="h-7 w-7 p-0">
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

      {/* Validation Warnings */}
      {roleCounts['dependent'] === 0 && (
        <Alert>
          <Users className="h-4 w-4" />
          <AlertDescription>
            <strong>Tip:</strong> Assign at least one <strong>Dependent Variable (DV)</strong> role for inferential statistical tests.
          </AlertDescription>
        </Alert>
      )}

      {/* Value Labels Dialog */}
      <Dialog open={valueLabelsOpen} onOpenChange={setValueLabelsOpen}>
        <DialogContent className="max-w-lg">
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
                onChange={(labels) => setValueLabelsVariable({ ...valueLabelsVariable, valueLabels: labels })}
                suggestedValues={getUniqueValues(valueLabelsVariable.name)}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setValueLabelsOpen(false)}>Cancel</Button>
            <Button onClick={saveValueLabels}>Save Labels</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scale Grouping Dialog */}
      <Dialog open={scaleGroupOpen} onOpenChange={setScaleGroupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Group Scale Items</DialogTitle>
            <DialogDescription>
              Select items that belong to the same scale construct (e.g., Q1_1 to Q1_5 for "Satisfaction Scale")
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Scale Name</Label>
              <Input
                value={scaleGroupName}
                onChange={(e) => setScaleGroupName(e.target.value)}
                placeholder="e.g., Satisfaction Scale, Anxiety Scale"
              />
            </div>

            <div className="space-y-2">
              <Label>Select Scale Items ({selectedForScale.size} selected)</Label>
              <ScrollArea className="h-[200px] border rounded-lg p-2">
                {variables.filter(v => v.measure === 'scale' || v.measure === 'ordinal').map((v) => (
                  <div key={v.name} className="flex items-center gap-2 py-1">
                    <Checkbox
                      checked={selectedForScale.has(v.name)}
                      onCheckedChange={() => toggleScaleSelection(v.name)}
                    />
                    <span className="font-mono text-sm">{v.name}</span>
                    {v.label && <span className="text-xs text-muted-foreground">({v.label})</span>}
                  </div>
                ))}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScaleGroupOpen(false)}>Cancel</Button>
            <Button onClick={saveScaleGroup} disabled={selectedForScale.size < 2}>
              Create Scale Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Legend */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium text-foreground">Variable Roles:</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {variableRoles.filter(r => r.value !== null).map((role) => (
            <div key={role.value} className="flex items-center gap-2">
              <div className={cn('w-3 h-3 rounded-full', role.color)} />
              <span className="font-medium text-foreground">{role.label}:</span>
              <span className="text-muted-foreground">{role.description}</span>
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
  suggestedValues,
}: {
  valueLabels: Record<string, string>;
  onChange: (labels: Record<string, string>) => void;
  suggestedValues: string[];
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

  const addSuggested = (value: string) => {
    if (!valueLabels[value]) {
      setNewValue(value);
    }
  };

  return (
    <div className="space-y-4">
      {/* Existing labels */}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map(([value, label]) => (
            <div key={value} className="flex items-center gap-2">
              <Input value={value} disabled className="w-20" />
              <span className="text-muted-foreground">=</span>
              <Input value={label} disabled className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => removeEntry(value)} className="h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new label */}
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
          onKeyDown={(e) => e.key === 'Enter' && addEntry()}
        />
        <Button variant="outline" size="sm" onClick={addEntry} className="h-8">Add</Button>
      </div>

      {/* Suggested values */}
      {suggestedValues.length > 0 && suggestedValues.some(v => !valueLabels[v]) && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Detected values (click to add):</Label>
          <div className="flex flex-wrap gap-1">
            {suggestedValues.filter(v => !valueLabels[v]).slice(0, 10).map((value) => (
              <Badge
                key={value}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10"
                onClick={() => addSuggested(value)}
              >
                {value}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
