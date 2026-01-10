import { Check, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export function PricingSection() {
  const { t } = useLanguage();

  const plans = [
    {
      name: t.pricing.free.name,
      price: t.pricing.free.price,
      period: t.pricing.free.period,
      features: t.pricing.free.features,
      cta: t.pricing.free.cta,
      popular: false,
    },
    {
      name: t.pricing.pro.name,
      price: t.pricing.pro.price,
      period: t.pricing.pro.period,
      features: t.pricing.pro.features,
      cta: t.pricing.pro.cta,
      popular: true,
      badge: t.pricing.pro.badge,
    },
  ];

  return (
    <section id="pricing" className="py-24">
      <div className="container-wide">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="section-heading mb-4">{t.pricing.title}</h2>
          <p className="section-subheading mx-auto">{t.pricing.subtitle}</p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-2xl p-8 animate-fade-in-up ${
                plan.popular
                  ? 'bg-gradient-hero text-white shadow-xl shadow-primary/20'
                  : 'bg-card border border-border'
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Popular Badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-accent text-accent-foreground text-sm font-medium rounded-full flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  {plan.badge}
                </div>
              )}

              {/* Plan Info */}
              <div className="text-center mb-8">
                <h3 className={`text-xl font-semibold mb-4 ${plan.popular ? 'text-white' : 'text-foreground'}`}>
                  {plan.name}
                </h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className={`text-5xl font-bold ${plan.popular ? 'text-white' : 'text-foreground'}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm ${plan.popular ? 'text-white/70' : 'text-muted-foreground'}`}>
                    /{plan.period}
                  </span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      plan.popular ? 'bg-white/20' : 'bg-accent/20'
                    }`}>
                      <Check className={`w-3 h-3 ${plan.popular ? 'text-white' : 'text-accent'}`} />
                    </div>
                    <span className={`text-sm ${plan.popular ? 'text-white/90' : 'text-muted-foreground'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link to="/signup">
                <Button
                  variant={plan.popular ? 'secondary' : 'hero'}
                  size="lg"
                  className="w-full"
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
