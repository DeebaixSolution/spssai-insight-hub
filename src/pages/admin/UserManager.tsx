import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, Users, Crown, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  plan: string;
  created_at: string;
}

interface PendingChange {
  userId: string;
  newPlan: 'free' | 'pro';
}

const UserManager = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'pro'>('all');
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, plan, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handlePlanChange = (userId: string, newPlan: 'free' | 'pro') => {
    const existingChangeIndex = pendingChanges.findIndex(c => c.userId === userId);
    const originalPlan = users.find(u => u.id === userId)?.plan;

    if (originalPlan === newPlan) {
      // Remove pending change if reverting to original
      setPendingChanges(prev => prev.filter(c => c.userId !== userId));
    } else if (existingChangeIndex >= 0) {
      // Update existing pending change
      setPendingChanges(prev =>
        prev.map((c, i) => (i === existingChangeIndex ? { ...c, newPlan } : c))
      );
    } else {
      // Add new pending change
      setPendingChanges(prev => [...prev, { userId, newPlan }]);
    }
  };

  const saveChanges = async () => {
    if (pendingChanges.length === 0) return;

    setSaving(true);
    try {
      for (const change of pendingChanges) {
        const { error } = await supabase
          .from('profiles')
          .update({ plan: change.newPlan })
          .eq('id', change.userId);

        if (error) throw error;
      }

      toast.success(`Updated ${pendingChanges.length} user(s) successfully`);
      setPendingChanges([]);
      fetchUsers();
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const getCurrentPlan = (user: UserProfile): 'free' | 'pro' => {
    const pendingChange = pendingChanges.find(c => c.userId === user.id);
    return pendingChange ? pendingChange.newPlan : (user.plan as 'free' | 'pro');
  };

  const hasPendingChange = (userId: string): boolean => {
    return pendingChanges.some(c => c.userId === userId);
  };

  // Filter users based on search and plan filter
  const filteredUsers = users.filter(user => {
    const matchesSearch =
      searchQuery === '' ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const currentPlan = getCurrentPlan(user);
    const matchesPlan = planFilter === 'all' || currentPlan === planFilter;

    return matchesSearch && matchesPlan;
  });

  // Calculate stats
  const stats = {
    total: users.length,
    free: users.filter(u => getCurrentPlan(u) === 'free').length,
    pro: users.filter(u => getCurrentPlan(u) === 'pro').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage user accounts and subscription plans
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingChanges.length > 0 && (
            <Button onClick={saveChanges} disabled={saving}>
              {saving ? 'Saving...' : `Save ${pendingChanges.length} Change(s)`}
            </Button>
          )}
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.free}</p>
              <p className="text-sm text-muted-foreground">Free Users</p>
            </div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pro}</p>
              <p className="text-sm text-muted-foreground">Pro Users</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={planFilter}
          onValueChange={(value: 'all' | 'free' | 'pro') => setPlanFilter(value)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter by plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading users...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map(user => {
                const currentPlan = getCurrentPlan(user);
                const isPending = hasPendingChange(user.id);

                return (
                  <TableRow key={user.id} className={isPending ? 'bg-primary/5' : ''}>
                    <TableCell className="font-medium">
                      {user.email}
                      {isPending && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{user.full_name || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant={currentPlan === 'free' ? 'default' : 'outline'}
                          onClick={() => handlePlanChange(user.id, 'free')}
                          className="h-7 px-3"
                        >
                          Free
                        </Button>
                        <Button
                          size="sm"
                          variant={currentPlan === 'pro' ? 'default' : 'outline'}
                          onClick={() => handlePlanChange(user.id, 'pro')}
                          className={`h-7 px-3 ${
                            currentPlan === 'pro'
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 border-0'
                              : ''
                          }`}
                        >
                          <Crown className="w-3 h-3 mr-1" />
                          Pro
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(user.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer Stats */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredUsers.length} of {stats.total} users
      </div>
    </div>
  );
};

export default UserManager;
