import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  Users, 
  TrendingUp,
  ExternalLink,
  RefreshCw,
  Search,
  Calendar,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const STRIPE_DASHBOARD_URL = 'https://dashboard.stripe.com';

// Plan configuration
const PLANS = {
  pro: {
    name: 'SPSS AI Pro Plan',
    price_id: 'price_1SpxZSCH0MYDyhVnMkxoT8cr',
    product_id: 'prod_TnYg9uo9pfxqxm',
    price: 29.99,
    currency: 'USD',
    interval: 'month',
  },
};

interface Subscription {
  id: string;
  user_email: string;
  status: string;
  plan: string;
  current_period_end: string;
  created_at: string;
}

interface PaymentStats {
  totalRevenue: number;
  activeSubscribers: number;
  monthlyRecurring: number;
  churnRate: number;
}

const PaymentManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  
  // Mock data - in production, fetch from Stripe API via edge function
  const [stats] = useState<PaymentStats>({
    totalRevenue: 0,
    activeSubscribers: 0,
    monthlyRecurring: 0,
    churnRate: 0,
  });

  const [subscriptions] = useState<Subscription[]>([]);

  const refreshData = async () => {
    setLoading(true);
    try {
      // In production, call edge function to fetch from Stripe
      toast({ title: 'Data refreshed', description: 'Payment data has been updated' });
    } catch (error) {
      toast({ 
        title: 'Error refreshing data', 
        description: 'Failed to fetch payment data',
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'canceled':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Canceled</Badge>;
      case 'past_due':
        return <Badge className="bg-amber-100 text-amber-800"><Clock className="w-3 h-3 mr-1" />Past Due</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payment Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage subscriptions, invoices, and billing
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild>
            <a href={STRIPE_DASHBOARD_URL} target="_blank" rel="noopener noreferrer">
              Stripe Dashboard
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Subscribers</p>
                <p className="text-2xl font-bold">{stats.activeSubscribers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Recurring</p>
                <p className="text-2xl font-bold">${stats.monthlyRecurring.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Churn Rate</p>
                <p className="text-2xl font-bold">{stats.churnRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common payment management tasks</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button asChild variant="outline" className="h-auto py-4 flex-col">
                <a href={`${STRIPE_DASHBOARD_URL}/subscriptions`} target="_blank" rel="noopener noreferrer">
                  <Users className="w-6 h-6 mb-2" />
                  <span>View All Subscriptions</span>
                </a>
              </Button>
              <Button asChild variant="outline" className="h-auto py-4 flex-col">
                <a href={`${STRIPE_DASHBOARD_URL}/invoices`} target="_blank" rel="noopener noreferrer">
                  <CreditCard className="w-6 h-6 mb-2" />
                  <span>View Invoices</span>
                </a>
              </Button>
              <Button asChild variant="outline" className="h-auto py-4 flex-col">
                <a href={`${STRIPE_DASHBOARD_URL}/products`} target="_blank" rel="noopener noreferrer">
                  <DollarSign className="w-6 h-6 mb-2" />
                  <span>Manage Products</span>
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Subscriptions</CardTitle>
                  <CardDescription>Manage user subscriptions</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by email..." 
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {subscriptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No subscriptions found</p>
                  <p className="text-sm mt-1">Subscriptions will appear here once users sign up for Pro</p>
                  <Button asChild className="mt-4" variant="outline">
                    <a href={`${STRIPE_DASHBOARD_URL}/subscriptions`} target="_blank" rel="noopener noreferrer">
                      View in Stripe
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Renews</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.user_email}</TableCell>
                        <TableCell>{sub.plan}</TableCell>
                        <TableCell>{getStatusBadge(sub.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {new Date(sub.current_period_end).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="sm">
                            <a 
                              href={`${STRIPE_DASHBOARD_URL}/subscriptions/${sub.id}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              View
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Plans</CardTitle>
              <CardDescription>Configure your pricing plans</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(PLANS).map(([key, plan]) => (
                <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ${plan.price}/{plan.interval} • Price ID: {plan.price_id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                    <Button asChild variant="outline" size="sm">
                      <a 
                        href={`${STRIPE_DASHBOARD_URL}/products/${plan.product_id}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        Edit in Stripe
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
              
              <div className="pt-4 border-t">
                <Button asChild>
                  <a href={`${STRIPE_DASHBOARD_URL}/products/create`} target="_blank" rel="noopener noreferrer">
                    Create New Plan
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentManager;
