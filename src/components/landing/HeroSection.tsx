import { ArrowRight, Play, Users, BarChart2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export function HeroSection() {
  const { t } = useLanguage();

  const stats = [
    { icon: Users, value: '10K+', label: t.hero.stats.users },
    { icon: BarChart2, value: '500K+', label: t.hero.stats.analyses },
    { icon: Sparkles, value: '99.2%', label: t.hero.stats.accuracy },
  ];

  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,hsl(var(--background))_70%)]" />
      </div>

      <div className="container-wide py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-start space-y-8 animate-fade-in-up">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered Statistical Analysis</span>
            </div>

            {/* Heading */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              {t.hero.title}{' '}
              <span className="text-gradient-hero">{t.hero.titleHighlight}</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0">
              {t.hero.subtitle}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link to="/signup">
                <Button variant="hero" size="xl" className="w-full sm:w-auto group">
                  {t.hero.cta}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button variant="heroOutline" size="xl" className="w-full sm:w-auto gap-2">
                <Play className="w-5 h-5" />
                {t.hero.ctaSecondary}
              </Button>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-8 pt-4">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <stat.icon className="w-5 h-5 text-accent" />
                    <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Content - Dashboard Preview */}
          <div className="relative animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-data rounded-2xl blur-2xl opacity-20 scale-105" />
              
              {/* Dashboard Preview Card */}
              <div className="relative glass-card p-6 rounded-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-destructive" />
                    <div className="w-3 h-3 rounded-full bg-warning" />
                    <div className="w-3 h-3 rounded-full bg-success" />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">analysis.spss</span>
                </div>

                {/* Mock Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Mean', value: '3.847' },
                    { label: 'Std Dev', value: '1.234' },
                    { label: 'p-value', value: '0.023' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                      <div className="text-lg font-mono font-semibold text-accent">{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Mock Table */}
                <div className="bg-muted/30 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-4 text-xs font-medium text-muted-foreground bg-muted/50 p-2">
                    <span>Variable</span>
                    <span>N</span>
                    <span>Mean</span>
                    <span>Sig.</span>
                  </div>
                  {[
                    ['Satisfaction', '245', '4.23', '0.001'],
                    ['Performance', '245', '3.89', '0.023'],
                    ['Engagement', '245', '4.01', '0.004'],
                  ].map((row, i) => (
                    <div key={i} className="grid grid-cols-4 text-sm p-2 border-t border-border/50">
                      <span className="font-medium">{row[0]}</span>
                      <span className="font-mono text-muted-foreground">{row[1]}</span>
                      <span className="font-mono">{row[2]}</span>
                      <span className="font-mono text-accent">{row[3]}</span>
                    </div>
                  ))}
                </div>

                {/* AI Insight */}
                <div className="mt-4 p-3 bg-accent/10 border border-accent/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-accent mt-0.5" />
                    <p className="text-sm text-foreground">
                      <span className="font-medium text-accent">AI Insight:</span> Your independent samples t-test shows a significant difference (p = 0.023) between groups...
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute -top-4 -right-4 bg-card shadow-lg rounded-xl p-3 animate-float">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center">
                  <BarChart2 className="w-4 h-4 text-success" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Analysis</div>
                  <div className="text-sm font-semibold">Complete</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
