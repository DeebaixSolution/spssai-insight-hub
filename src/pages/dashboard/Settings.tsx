import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  User,
  Globe,
  Crown,
  Shield,
  Trash2,
  Save,
  Loader2,
  CheckCircle,
  BarChart3,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { usePlanLimits } from '@/hooks/usePlanLimits';

const Settings = () => {
  const { user, profile, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const queryClient = useQueryClient();
  const { isPro, limits } = usePlanLimits();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [isSaving, setIsSaving] = useState(false);

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: async (data: { full_name: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile updated successfully');
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  // Update language
  const handleLanguageChange = async (newLang: string) => {
    setLanguage(newLang as 'en' | 'ar');
    
    // Save to profile
    await supabase
      .from('profiles')
      .update({ language: newLang })
      .eq('id', user?.id);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    await updateProfile.mutateAsync({ full_name: fullName });
    setIsSaving(false);
  };

  const handleDeleteAccount = async () => {
    // Note: Full account deletion would require backend support
    toast.info('Please contact support to delete your account');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile
          </CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={user?.email || ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <Button onClick={handleSaveProfile} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Preferences Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Preferences
          </CardTitle>
          <CardDescription>Customize your experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger id="language" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية (Arabic)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Subscription
          </CardTitle>
          <CardDescription>Your current plan and usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Plan */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isPro ? 'bg-gradient-hero' : 'bg-secondary'
              }`}>
                <Crown className={`w-6 h-6 ${isPro ? 'text-white' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">
                    {isPro ? 'Pro Plan' : 'Free Plan'}
                  </span>
                  <Badge variant={isPro ? 'default' : 'secondary'}>
                    {isPro ? 'Active' : 'Current'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {isPro ? 'Unlimited access to all features' : 'Limited features with usage caps'}
                </p>
              </div>
            </div>
            {!isPro && (
              <Button variant="hero">
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Button>
            )}
          </div>

          {/* Usage Stats */}
          <div>
            <h4 className="font-medium mb-3">Plan Features</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <span className="font-medium">Analyses</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {limits.maxAnalysesPerMonth === -1 ? '∞' : limits.maxAnalysesPerMonth}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isPro ? 'Unlimited' : 'per month'}
                </p>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span className="font-medium">AI Messages</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {limits.maxChatMessages === -1 ? '∞' : limits.maxChatMessages}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isPro ? 'Unlimited' : 'per day'}
                </p>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="font-medium">Reports</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {isPro ? '∞' : 'View only'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isPro ? 'Unlimited downloads' : 'upgrade for export'}
                </p>
              </div>
            </div>
          </div>

          {/* Feature Checklist */}
          <div>
            <h4 className="font-medium mb-3">Included Features</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { feature: 'Basic statistical tests', free: true, pro: true },
                { feature: 'Advanced tests (MANOVA, Factor Analysis)', free: false, pro: true },
                { feature: 'AI-powered interpretation', free: false, pro: true },
                { feature: 'APA format results', free: false, pro: true },
                { feature: 'Export to Word/PDF', free: false, pro: true },
                { feature: 'Dataset context in AI chat', free: false, pro: true },
                { feature: 'Priority support', free: false, pro: true },
                { feature: 'Unlimited file size', free: false, pro: true },
              ].map((item) => {
                const included = isPro ? item.pro : item.free;
                return (
                  <div
                    key={item.feature}
                    className={`flex items-center gap-2 text-sm ${
                      included ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <CheckCircle
                      className={`w-4 h-4 ${
                        included ? 'text-success' : 'text-muted-foreground/30'
                      }`}
                    />
                    {item.feature}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security
          </CardTitle>
          <CardDescription>Manage your account security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Password</p>
              <p className="text-sm text-muted-foreground">
                Change your password
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                // Supabase password reset flow
                toast.info('Check your email for password reset instructions');
                supabase.auth.resetPasswordForEmail(user?.email || '');
              }}
            >
              Reset Password
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Sign Out</p>
              <p className="text-sm text-muted-foreground">
                Sign out of your account
              </p>
            </div>
            <Button variant="outline" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete Account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your
                    account and remove all your data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
