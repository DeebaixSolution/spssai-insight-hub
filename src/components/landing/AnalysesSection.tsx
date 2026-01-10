import { 
  BarChart2, 
  GitCompare, 
  Shuffle, 
  Link2, 
  TrendingUp, 
  Shield, 
  Layers,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function AnalysesSection() {
  const { t } = useLanguage();

  const categories = [
    {
      icon: BarChart2,
      name: t.analyses.categories.descriptive,
      tests: ['Frequencies', 'Descriptives', 'Explore', 'Crosstabs', 'Charts'],
      color: 'bg-blue-500',
    },
    {
      icon: GitCompare,
      name: t.analyses.categories.compareMeans,
      tests: ['One-Sample T-Test', 'Independent T-Test', 'Paired T-Test', 'One-Way ANOVA', 'Repeated Measures'],
      color: 'bg-teal-500',
    },
    {
      icon: Shuffle,
      name: t.analyses.categories.nonparametric,
      tests: ['Mann-Whitney U', 'Wilcoxon', 'Kruskal-Wallis', 'Friedman'],
      color: 'bg-emerald-500',
    },
    {
      icon: Link2,
      name: t.analyses.categories.correlation,
      tests: ['Pearson', 'Spearman', 'Partial Correlation'],
      color: 'bg-cyan-500',
    },
    {
      icon: TrendingUp,
      name: t.analyses.categories.regression,
      tests: ['Linear Regression', 'Multiple Regression', 'Logistic Regression'],
      color: 'bg-indigo-500',
    },
    {
      icon: Shield,
      name: t.analyses.categories.reliability,
      tests: ["Cronbach's Alpha", 'Item-Total', 'Scale if Item Deleted'],
      color: 'bg-violet-500',
    },
    {
      icon: Layers,
      name: t.analyses.categories.factor,
      tests: ['Exploratory FA', 'KMO & Bartlett', 'Rotation Methods'],
      color: 'bg-purple-500',
      pro: true,
    },
  ];

  return (
    <section id="analyses" className="py-24">
      <div className="container-wide">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="section-heading mb-4">{t.analyses.title}</h2>
          <p className="section-subheading mx-auto">{t.analyses.subtitle}</p>
        </div>

        {/* Analyses Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {categories.map((category, index) => (
            <div
              key={index}
              className="group relative bg-card rounded-xl border border-border hover:border-accent/30 overflow-hidden transition-all duration-300 hover:shadow-lg animate-fade-in-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Pro Badge */}
              {category.pro && (
                <div className="absolute top-3 right-3 px-2 py-0.5 bg-accent text-accent-foreground text-xs font-medium rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Pro
                </div>
              )}

              {/* Header */}
              <div className="p-5 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${category.color} flex items-center justify-center shadow-md`}>
                    <category.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-foreground">{category.name}</h3>
                </div>
              </div>

              {/* Tests List */}
              <div className="p-4">
                <ul className="space-y-2">
                  {category.tests.map((test, i) => (
                    <li 
                      key={i}
                      className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="w-3 h-3 text-accent" />
                      {test}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Hover Effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
