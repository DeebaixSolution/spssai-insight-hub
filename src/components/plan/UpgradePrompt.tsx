import React from 'react';
import { Crown, Check, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
}

const proFeatures = [
  'Unlimited analyses per month',
  'Up to 50,000 rows per dataset',
  'Excel and SPSS file support',
  'AI-powered variable detection',
  'AI research question analysis',
  'Full APA-formatted results',
  'Academic discussion generation',
  'Word & PDF report export',
  'Advanced statistical tests',
  'Unlimited AI chat messages',
];

export function UpgradePrompt({ open, onOpenChange, feature }: UpgradePromptProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-xl">Upgrade to Pro</DialogTitle>
          </div>
          <DialogDescription>
            {feature
              ? `Unlock "${feature}" and all Pro features to supercharge your research.`
              : 'Unlock all Pro features to supercharge your research.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            {proFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-success" />
                <span className="text-foreground">{f}</span>
              </div>
            ))}
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">$29</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Cancel anytime. 14-day money-back guarantee.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
          <Button variant="hero" className="flex-1">
            <Zap className="w-4 h-4 mr-2" />
            Upgrade Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
