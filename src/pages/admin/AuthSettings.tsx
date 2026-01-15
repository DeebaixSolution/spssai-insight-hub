import { useState, useEffect } from 'react';
import { 
  Shield, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  Copy, 
  Check,
  Settings,
  Link as LinkIcon
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const SUPABASE_PROJECT_ID = 'iadhngzglwnfinocixdm';

const AuthSettings = () => {
  const { toast } = useToast();
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  
  const previewUrl = 'https://id-preview--7832d793-ca9c-4430-afe5-0b8da0067af4.lovable.app';
  const callbackUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/auth/v1/callback`;

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedUrl(label);
    toast({ title: 'Copied!', description: `${label} copied to clipboard` });
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const oauthProviders = [
    {
      name: 'Google',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ),
      status: 'requires_setup',
      description: 'Allow users to sign in with their Google account',
      docsUrl: 'https://supabase.com/docs/guides/auth/social-login/auth-google',
    },
    {
      name: 'GitHub',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      ),
      status: 'not_configured',
      description: 'Allow users to sign in with their GitHub account',
      docsUrl: 'https://supabase.com/docs/guides/auth/social-login/auth-github',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Authentication Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure OAuth providers and authentication settings
        </p>
      </div>

      {/* Important URLs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            Important URLs
          </CardTitle>
          <CardDescription>
            These URLs are required for OAuth provider configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">Site URL</p>
                <p className="text-xs text-muted-foreground font-mono">{previewUrl}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(previewUrl, 'Site URL')}
              >
                {copiedUrl === 'Site URL' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">Callback URL (for OAuth providers)</p>
                <p className="text-xs text-muted-foreground font-mono">{callbackUrl}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(callbackUrl, 'Callback URL')}
              >
                {copiedUrl === 'Callback URL' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="pt-2">
            <Button asChild variant="outline">
              <a 
                href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/auth/url-configuration`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Settings className="w-4 h-4 mr-2" />
                Configure in Supabase
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* OAuth Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            OAuth Providers
          </CardTitle>
          <CardDescription>
            Configure social login providers for your application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {oauthProviders.map((provider) => (
            <div 
              key={provider.name}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  {provider.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{provider.name}</p>
                    {provider.status === 'requires_setup' ? (
                      <Badge variant="secondary" className="text-amber-600 bg-amber-100">
                        Requires Setup
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground">
                        Not Configured
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{provider.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer">
                    Docs
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
                <Button asChild size="sm">
                  <a 
                    href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/auth/providers`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Configure
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Google OAuth Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-3 text-sm">
            <li>
              Go to{' '}
              <a 
                href="https://console.cloud.google.com/apis/credentials" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google Cloud Console → Credentials
              </a>
            </li>
            <li>Create a new OAuth 2.0 Client ID (Web application)</li>
            <li>
              Add <span className="font-mono bg-muted px-1 rounded">{previewUrl}</span> to Authorized JavaScript origins
            </li>
            <li>
              Add <span className="font-mono bg-muted px-1 rounded">{callbackUrl}</span> to Authorized redirect URIs
            </li>
            <li>Copy the Client ID and Client Secret</li>
            <li>
              Go to{' '}
              <a 
                href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/auth/providers`}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Supabase Auth Providers
              </a>{' '}
              and enable Google
            </li>
            <li>Paste your Client ID and Client Secret</li>
            <li>Save and test the login!</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthSettings;
