import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Save, RefreshCw, Crown, Check, Settings2 } from 'lucide-react';

interface AnalysisTest {
  id: string;
  test_id: string;
  name: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
  is_pro_only: boolean;
  display_order: number;
}

interface AnalysisCategory {
  id: string;
  category_id: string;
  name: string;
  icon: string | null;
  display_order: number;
  is_enabled: boolean;
}

interface StepFunction {
  id: string;
  step_number: number;
  function_id: string;
  function_name: string;
  description: string | null;
  is_enabled: boolean;
  is_pro_only: boolean;
  display_order: number;
}

const STEP_LABELS: Record<number, string> = {
  2: 'Variables', 3: 'Research', 4: 'Descriptive', 5: 'Parametric',
  6: 'Non-Parametric', 7: 'ANOVA/GLM', 8: 'Correlation', 9: 'Regression',
  10: 'Measurement', 11: 'Chapter 4', 12: 'Chapter 5', 13: 'Export',
};

export default function AnalysisManager() {
  const [tests, setTests] = useState<AnalysisTest[]>([]);
  const [categories, setCategories] = useState<AnalysisCategory[]>([]);
  const [stepFunctions, setStepFunctions] = useState<StepFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<AnalysisTest>>>(new Map());
  const [pendingSfChanges, setPendingSfChanges] = useState<Map<string, Partial<StepFunction>>>(new Map());
  const [activeTab, setActiveTab] = useState('tests');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [testsRes, categoriesRes, sfRes] = await Promise.all([
        supabase.from('analysis_tests').select('*').order('category').order('display_order'),
        supabase.from('analysis_categories').select('*').order('display_order'),
        supabase.from('step_functions' as any).select('*').order('step_number').order('display_order'),
      ]);
      if (testsRes.error) throw testsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      setTests(testsRes.data || []);
      setCategories(categoriesRes.data || []);
      setStepFunctions((sfRes.data || []) as unknown as StepFunction[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load analysis data');
    } finally {
      setLoading(false);
    }
  };

  // --- Tests CRUD ---
  const handleTestChange = (testId: string, field: keyof AnalysisTest, value: boolean | number) => {
    setTests(prev => prev.map(t => t.id === testId ? { ...t, [field]: value } : t));
    setPendingChanges(prev => {
      const m = new Map(prev);
      m.set(testId, { ...m.get(testId), [field]: value });
      return m;
    });
  };

  const saveTestChanges = async () => {
    if (pendingChanges.size === 0) { toast.info('No changes'); return; }
    setSaving(true);
    try {
      for (const [id, changes] of pendingChanges.entries()) {
        const { error } = await supabase.from('analysis_tests').update({ id, ...changes }).eq('id', id);
        if (error) throw error;
      }
      setPendingChanges(new Map());
      toast.success(`Saved ${pendingChanges.size} change(s)`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save');
    } finally { setSaving(false); }
  };

  // --- Step Functions CRUD ---
  const handleSfChange = (sfId: string, field: keyof StepFunction, value: boolean | number) => {
    setStepFunctions(prev => prev.map(sf => sf.id === sfId ? { ...sf, [field]: value } : sf));
    setPendingSfChanges(prev => {
      const m = new Map(prev);
      m.set(sfId, { ...m.get(sfId), [field]: value });
      return m;
    });
  };

  const saveSfChanges = async () => {
    if (pendingSfChanges.size === 0) { toast.info('No changes'); return; }
    setSaving(true);
    try {
      for (const [id, changes] of pendingSfChanges.entries()) {
        const { error } = await supabase.from('step_functions' as any).update({ id, ...changes } as any).eq('id', id);
        if (error) throw error;
      }
      setPendingSfChanges(new Map());
      toast.success(`Saved ${pendingSfChanges.size} step function change(s)`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save step functions');
    } finally { setSaving(false); }
  };

  const getCategoryName = (categoryId: string) =>
    categories.find(c => c.category_id === categoryId)?.name || categoryId;

  const filteredTests = tests.filter(test => {
    const matchesSearch = test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         test.test_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || test.category === filterCategory;
    const matchesPlan = filterPlan === 'all' ||
                       (filterPlan === 'pro' && test.is_pro_only) ||
                       (filterPlan === 'free' && !test.is_pro_only);
    return matchesSearch && matchesCategory && matchesPlan;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalPendingChanges = pendingChanges.size + pendingSfChanges.size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analysis Manager</h1>
          <p className="text-muted-foreground">Configure tests, step functions, and plan access</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button
            variant="hero"
            onClick={activeTab === 'tests' ? saveTestChanges : saveSfChanges}
            disabled={saving || totalPendingChanges === 0}
          >
            {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes {totalPendingChanges > 0 && `(${totalPendingChanges})`}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tests">Statistical Tests ({tests.length})</TabsTrigger>
          <TabsTrigger value="step-functions">
            <Settings2 className="w-3 h-3 mr-1" /> Step Functions ({stepFunctions.length})
          </TabsTrigger>
        </TabsList>

        {/* Tests Tab */}
        <TabsContent value="tests" className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search tests..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Category:</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.category_id} value={cat.category_id}>{cat.icon} {cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Plan:</Label>
              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="free">Free Only</SelectItem>
                  <SelectItem value="pro">Pro Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[250px]">Test Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Plan</TableHead>
                  <TableHead className="text-center">Enabled</TableHead>
                  <TableHead className="text-center w-[100px]">Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No tests found</TableCell>
                  </TableRow>
                ) : (
                  filteredTests.map(test => (
                    <TableRow key={test.id} className={pendingChanges.has(test.id) ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{test.name}</p>
                          <p className="text-xs text-muted-foreground">{test.test_id}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{getCategoryName(test.category)}</Badge></TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant={test.is_pro_only ? 'outline' : 'default'} size="sm" className="h-7 px-2 text-xs" onClick={() => handleTestChange(test.id, 'is_pro_only', false)}>
                            {!test.is_pro_only && <Check className="w-3 h-3 mr-1" />} Free
                          </Button>
                          <Button variant={test.is_pro_only ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={() => handleTestChange(test.id, 'is_pro_only', true)}>
                            {test.is_pro_only && <Crown className="w-3 h-3 mr-1" />} Pro
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={test.is_enabled} onCheckedChange={(checked) => handleTestChange(test.id, 'is_enabled', checked)} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input type="number" value={test.display_order} onChange={(e) => handleTestChange(test.id, 'display_order', parseInt(e.target.value) || 0)} className="w-16 h-8 text-center mx-auto" min={0} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span>Total: {tests.length}</span>
            <span>Free: {tests.filter(t => !t.is_pro_only).length}</span>
            <span>Pro: {tests.filter(t => t.is_pro_only).length}</span>
            <span>Enabled: {tests.filter(t => t.is_enabled).length}</span>
          </div>
        </TabsContent>

        {/* Step Functions Tab */}
        <TabsContent value="step-functions" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Control which functions are available in each wizard step, link to plan tiers, and set display order.
          </p>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[80px]">Step</TableHead>
                  <TableHead className="w-[200px]">Function</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Plan</TableHead>
                  <TableHead className="text-center">Enabled</TableHead>
                  <TableHead className="text-center w-[80px]">Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stepFunctions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No step functions configured</TableCell>
                  </TableRow>
                ) : (
                  stepFunctions.map((sf, i) => {
                    const showStepHeader = i === 0 || stepFunctions[i - 1].step_number !== sf.step_number;
                    return (
                      <TableRow key={sf.id} className={pendingSfChanges.has(sf.id) ? 'bg-primary/5' : ''}>
                        <TableCell>
                          {showStepHeader ? (
                            <div>
                              <p className="font-bold text-foreground">{sf.step_number}</p>
                              <p className="text-[10px] text-muted-foreground">{STEP_LABELS[sf.step_number] || ''}</p>
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{sf.function_name}</p>
                          <p className="text-[10px] text-muted-foreground">{sf.function_id}</p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{sf.description}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant={sf.is_pro_only ? 'outline' : 'default'} size="sm" className="h-6 px-2 text-[10px]" onClick={() => handleSfChange(sf.id, 'is_pro_only', false)}>
                              {!sf.is_pro_only && <Check className="w-2.5 h-2.5 mr-0.5" />} Free
                            </Button>
                            <Button variant={sf.is_pro_only ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-[10px]" onClick={() => handleSfChange(sf.id, 'is_pro_only', true)}>
                              {sf.is_pro_only && <Crown className="w-2.5 h-2.5 mr-0.5" />} Pro
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={sf.is_enabled} onCheckedChange={(checked) => handleSfChange(sf.id, 'is_enabled', checked)} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input type="number" value={sf.display_order} onChange={(e) => handleSfChange(sf.id, 'display_order', parseInt(e.target.value) || 0)} className="w-14 h-7 text-center mx-auto text-xs" min={0} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
