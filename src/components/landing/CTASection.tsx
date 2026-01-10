import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export function CTASection() {
  const { t } = useLanguage();

  return (
    <section className="py-24 bg-muted/30">
      <div className="container-wide">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-12 md:p-16 text-center animate-fade-in">
          {/* Background Elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />
          </div>

          {/* Content */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/90 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>Join 10,000+ Researchers</span>
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 max-w-3xl mx-auto">
              {t.cta.title}
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
              {t.cta.subtitle}
            </p>

            <Link to="/signup">
              <Button variant="secondary" size="xl" className="group">
                {t.cta.button}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
