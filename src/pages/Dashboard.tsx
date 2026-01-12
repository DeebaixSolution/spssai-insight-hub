import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import {
  BarChart3,
  Home,
  PlusCircle,
  Database,
  FileText,
  Settings,
  LogOut,
  MessageSquare,
  Crown,
  ChevronRight,
  FolderOpen,
  TrendingUp,
  Clock,
} from 'lucide-react';

// Dashboard Home Component
const DashboardHome = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {t.dashboard.welcome}, {profile?.full_name || 'Researcher'}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Ready to analyze your data with AI-powered insights
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="data-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-sm text-muted-foreground">Total Analyses</p>
            </div>
          </div>
        </div>
        <div className="data-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-sm text-muted-foreground">Projects</p>
            </div>
          </div>
        </div>
        <div className="data-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">5</p>
              <p className="text-sm text-muted-foreground">Analyses Left (Free)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">{t.dashboard.quickActions}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/dashboard/new-analysis">
            <div className="data-card hover:border-primary transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-hero flex items-center justify-center">
                  <PlusCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {t.dashboard.newAnalysis}
                  </p>
                  <p className="text-sm text-muted-foreground">Start analyzing</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
              </div>
            </div>
          </Link>

          <Link to="/dashboard/data">
            <div className="data-card hover:border-primary transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Database className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {t.dashboard.dataManager}
                  </p>
                  <p className="text-sm text-muted-foreground">Manage datasets</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
              </div>
            </div>
          </Link>

          <Link to="/dashboard/ai-chat">
            <div className="data-card hover:border-primary transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {t.dashboard.aiChat}
                  </p>
                  <p className="text-sm text-muted-foreground">Ask AI anything</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
              </div>
            </div>
          </Link>

          <Link to="/dashboard/reports">
            <div className="data-card hover:border-primary transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {t.dashboard.reports}
                  </p>
                  <p className="text-sm text-muted-foreground">View reports</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Projects */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">{t.dashboard.recentProjects}</h2>
        <div className="data-card">
          <div className="text-center py-8">
            <FolderOpen className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No projects yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Start your first analysis to create a project
            </p>
            <Button variant="hero" asChild>
              <Link to="/dashboard/new-analysis">
                <PlusCircle className="w-4 h-4 mr-2" />
                {t.dashboard.newAnalysis}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Import actual pages
import NewAnalysisPage from './dashboard/NewAnalysis';

// Placeholder pages - to be implemented
const DataManager = () => (
  <div className="data-card p-8 text-center">
    <h2 className="text-2xl font-bold mb-2">Data Manager</h2>
    <p className="text-muted-foreground">Dataset management coming soon...</p>
  </div>
);

const AIChat = () => (
  <div className="data-card p-8 text-center">
    <h2 className="text-2xl font-bold mb-2">AI Assistant</h2>
    <p className="text-muted-foreground">AI chat coming soon...</p>
  </div>
);

const Reports = () => (
  <div className="data-card p-8 text-center">
    <h2 className="text-2xl font-bold mb-2">Reports</h2>
    <p className="text-muted-foreground">Report generation coming soon...</p>
  </div>
);

const UserSettings = () => (
  <div className="data-card p-8 text-center">
    <h2 className="text-2xl font-bold mb-2">Settings</h2>
    <p className="text-muted-foreground">User settings coming soon...</p>
  </div>
);

// Sidebar Navigation
const navItems = [
  { path: '/dashboard', icon: Home, label: 'Dashboard', exact: true },
  { path: '/dashboard/new-analysis', icon: PlusCircle, label: 'New Analysis' },
  { path: '/dashboard/data', icon: Database, label: 'Data Manager' },
  { path: '/dashboard/ai-chat', icon: MessageSquare, label: 'AI Assistant' },
  { path: '/dashboard/reports', icon: FileText, label: 'Reports' },
];

const Dashboard = () => {
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-sidebar border-r border-sidebar-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-sidebar-primary" />
            </div>
            <span className="text-xl font-bold text-sidebar-foreground">SPSS AI</span>
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
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Upgrade Banner */}
        {profile?.plan === 'free' && (
          <div className="p-4">
            <div className="bg-gradient-hero rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5" />
                <span className="font-semibold">Upgrade to Pro</span>
              </div>
              <p className="text-sm text-white/80 mb-3">
                Unlock unlimited analyses and full AI interpretation
              </p>
              <Button size="sm" variant="secondary" className="w-full">
                Upgrade Now
              </Button>
            </div>
          </div>
        )}

        {/* User & Settings */}
        <div className="p-4 border-t border-sidebar-border space-y-1">
          <Link
            to="/dashboard/settings"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/dashboard/settings')
                ? 'bg-sidebar-accent text-sidebar-primary'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <div />
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'U'}
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {profile?.full_name || profile?.email || 'User'}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-6 overflow-auto">
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/new-analysis" element={<NewAnalysisPage />} />
            <Route path="/data" element={<DataManager />} />
            <Route path="/ai-chat" element={<AIChat />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<UserSettings />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
