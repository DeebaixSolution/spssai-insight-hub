import { Upload, MousePointerClick, Play, FileCheck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function HowItWorksSection() {
  const { t } = useLanguage();

  const steps = [
    {
      icon: Upload,
      step: '01',
      title: t.howItWorks.steps.upload.title,
      description: t.howItWorks.steps.upload.description,
    },
    {
      icon: MousePointerClick,
      step: '02',
      title: t.howItWorks.steps.select.title,
      description: t.howItWorks.steps.select.description,
    },
    {
      icon: Play,
      step: '03',
      title: t.howItWorks.steps.analyze.title,
      description: t.howItWorks.steps.analyze.description,
    },
    {
      icon: FileCheck,
      step: '04',
      title: t.howItWorks.steps.interpret.title,
      description: t.howItWorks.steps.interpret.description,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-muted/30">
      <div className="container-wide">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="section-heading mb-4">{t.howItWorks.title}</h2>
          <p className="section-subheading mx-auto">{t.howItWorks.subtitle}</p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connection Line */}
          <div className="absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent/30 to-transparent hidden lg:block" />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div
                key={index}
                className="relative text-center animate-fade-in-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Step Number */}
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-hero flex items-center justify-center shadow-lg mx-auto relative z-10">
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-8 h-8 bg-card border-2 border-accent rounded-full flex items-center justify-center text-sm font-bold text-accent z-20">
                    {step.step}
                  </span>
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold mb-2 text-foreground">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
