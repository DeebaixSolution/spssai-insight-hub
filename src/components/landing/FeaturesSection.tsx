import { Upload, BarChart3, Brain, FileText } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function FeaturesSection() {
  const { t } = useLanguage();

  const features = [
    {
      icon: Upload,
      title: t.features.upload.title,
      description: t.features.upload.description,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: BarChart3,
      title: t.features.analysis.title,
      description: t.features.analysis.description,
      gradient: 'from-teal-500 to-emerald-500',
    },
    {
      icon: Brain,
      title: t.features.ai.title,
      description: t.features.ai.description,
      gradient: 'from-accent to-primary',
    },
    {
      icon: FileText,
      title: t.features.export.title,
      description: t.features.export.description,
      gradient: 'from-indigo-500 to-blue-500',
    },
  ];

  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="container-wide">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="section-heading mb-4">{t.features.title}</h2>
          <p className="section-subheading mx-auto">{t.features.subtitle}</p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative bg-card rounded-2xl p-6 border border-border hover:border-accent/50 transition-all duration-300 hover:shadow-card-hover animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon */}
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold mb-2 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>

              {/* Hover Effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
