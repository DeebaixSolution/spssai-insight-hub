import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Filter, Save, RefreshCw, Crown, Check } from 'lucide-react';

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

export default function AnalysisManager() {
  const [tests, setTests] = useState<AnalysisTest[]>([]);
  const [categories, setCategories] = useState<AnalysisCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<AnalysisTest>>>(new Map());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [testsRes, categoriesRes] = await Promise.all([
        supabase.from('analysis_tests').select('*').order('category').order('display_order'),
        supabase.from('analysis_categories').select('*').order('display_order'),
      ]);

      if (testsRes.error) throw testsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setTests(testsRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load analysis data');
    } finally {
      setLoading(false);
    }
  };

  const handleTestChange = (testId: string, field: keyof AnalysisTest, value: boolean | number) => {
    // Update local state immediately for responsive UI
    setTests(prev => prev.map(t => 
      t.id === testId ? { ...t, [field]: value } : t
    ));

    // Track pending changes
    setPendingChanges(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(testId) || {};
      newMap.set(testId, { ...existing, [field]: value });
      return newMap;
    });
  };

  const saveChanges = async () => {
    if (pendingChanges.size === 0) {
      toast.info('No changes to save');
      return;
    }

    setSaving(true);
    try {
      const updates = Array.from(pendingChanges.entries()).map(([id, changes]) => ({
        id,
        ...changes,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('analysis_tests')
          .update(update)
          .eq('id', update.id);

        if (error) throw error;
      }

      setPendingChanges(new Map());
      toast.success(`Saved ${updates.length} change(s)`);
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.category_id === categoryId)?.name || categoryId;
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analysis Manager</h1>
          <p className="text-muted-foreground">
            Configure statistical tests and control access by plan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="hero" 
            onClick={saveChanges} 
            disabled={saving || pendingChanges.size === 0}
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes {pendingChanges.size > 0 && `(${pendingChanges.size})`}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Category:</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.category_id} value={cat.category_id}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Plan:</Label>
          <Select value={filterPlan} onValueChange={setFilterPlan}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Plans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="free">Free Only</SelectItem>
              <SelectItem value="pro">Pro Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
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
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No tests found matching your filters
                </TableCell>
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
                  <TableCell>
                    <Badge variant="outline">{getCategoryName(test.category)}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant={test.is_pro_only ? 'outline' : 'default'}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleTestChange(test.id, 'is_pro_only', false)}
                      >
                        {!test.is_pro_only && <Check className="w-3 h-3 mr-1" />}
                        Free
                      </Button>
                      <Button
                        variant={test.is_pro_only ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleTestChange(test.id, 'is_pro_only', true)}
                      >
                        {test.is_pro_only && <Crown className="w-3 h-3 mr-1" />}
                        Pro
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={test.is_enabled}
                      onCheckedChange={(checked) => handleTestChange(test.id, 'is_enabled', checked)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={test.display_order}
                      onChange={(e) => handleTestChange(test.id, 'display_order', parseInt(e.target.value) || 0)}
                      className="w-16 h-8 text-center mx-auto"
                      min={0}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <span>Total: {tests.length} tests</span>
        <span>Free: {tests.filter(t => !t.is_pro_only).length}</span>
        <span>Pro: {tests.filter(t => t.is_pro_only).length}</span>
        <span>Enabled: {tests.filter(t => t.is_enabled).length}</span>
        <span>Disabled: {tests.filter(t => !t.is_enabled).length}</span>
      </div>
    </div>
  );
}
