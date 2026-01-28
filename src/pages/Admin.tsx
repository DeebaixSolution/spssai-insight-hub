import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart3,
  Home,
  FlaskConical,
  Users,
  CreditCard,
  ToggleRight,
  BookOpen,
  FileCode,
  Activity,
  ChevronLeft,
  Shield,
  Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import AnalysisManager from './admin/AnalysisManager';
import AuthSettings from './admin/AuthSettings';
import PaymentManager from './admin/PaymentManager';
import UserManager from './admin/UserManager';

// Admin Home Component
const AdminHome = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Manage your SPSS AI platform settings and configurations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link to="/admin/analysis-manager">
          <div className="data-card hover:border-primary transition-colors cursor-pointer group h-full">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FlaskConical className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                  Analysis Manager
                </p>
                <p className="text-sm text-muted-foreground">
                  Configure tests, set Free/Pro access
                </p>
              </div>
            </div>
          </div>
        </Link>

        <Link to="/admin/auth-settings">
          <div className="data-card hover:border-primary transition-colors cursor-pointer group h-full">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Key className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                  Auth Settings
                </p>
                <p className="text-sm text-muted-foreground">
                  Configure OAuth providers
                </p>
              </div>
            </div>
          </div>
        </Link>

        <Link to="/admin/payments">
          <div className="data-card hover:border-primary transition-colors cursor-pointer group h-full">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                  Payment Manager
                </p>
                <p className="text-sm text-muted-foreground">
                  Manage subscriptions & billing
                </p>
              </div>
            </div>
          </div>
        </Link>

        <Link to="/admin/users">
          <div className="data-card hover:border-primary transition-colors cursor-pointer group h-full">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                  User Management
                </p>
                <p className="text-sm text-muted-foreground">
                  Manage users & plans
                </p>
              </div>
            </div>
          </div>
        </Link>

        <div className="data-card opacity-50 cursor-not-allowed">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <ToggleRight className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Feature Toggles</p>
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          </div>
        </div>

        <div className="data-card opacity-50 cursor-not-allowed">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <ToggleRight className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Feature Toggles</p>
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          </div>
        </div>

        <div className="data-card opacity-50 cursor-not-allowed">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Tutorials CMS</p>
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          </div>
        </div>

        <div className="data-card opacity-50 cursor-not-allowed">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Activity className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Logs & Monitoring</p>
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sidebar Navigation
const navItems = [
  { path: '/admin', icon: Home, label: 'Dashboard', exact: true },
  { path: '/admin/analysis-manager', icon: FlaskConical, label: 'Analysis Manager' },
  { path: '/admin/users', icon: Users, label: 'Users' },
  { path: '/admin/auth-settings', icon: Key, label: 'Auth Settings' },
  { path: '/admin/payments', icon: CreditCard, label: 'Payments' },
];

const Admin = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    checkAdminRole();
  }, [user, navigate]);

  const isActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path) && path !== '/admin';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <Link to="/admin" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-white">Admin Panel</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive(item.path, item.exact)
                  ? 'bg-primary/20 text-primary'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Back to Dashboard */}
        <div className="p-4 border-t border-slate-700">
          <Button variant="outline" className="w-full" asChild>
            <Link to="/dashboard">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-medium text-foreground">Administrator</span>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-6 overflow-auto">
          <Routes>
            <Route path="/" element={<AdminHome />} />
            <Route path="/analysis-manager" element={<AnalysisManager />} />
            <Route path="/users" element={<UserManager />} />
            <Route path="/auth-settings" element={<AuthSettings />} />
            <Route path="/payments" element={<PaymentManager />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default Admin;
