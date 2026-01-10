export type Language = 'en' | 'ar' | 'et';

export const languages: { code: Language; name: string; nativeName: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti', dir: 'ltr' },
];

export const translations = {
  en: {
    // Navigation
    nav: {
      home: 'Home',
      features: 'Features',
      analyses: 'SPSS Analyses',
      howItWorks: 'How It Works',
      pricing: 'Pricing',
      tutorials: 'Tutorials',
      about: 'About',
      contact: 'Contact',
      login: 'Login',
      signUp: 'Sign Up',
      tryFree: 'Try Free',
      dashboard: 'Dashboard',
    },
    // Hero Section
    hero: {
      title: 'Analyze Your Data Like SPSS',
      titleHighlight: 'Powered by AI',
      subtitle: 'The intelligent research assistant that helps students, researchers, and analysts perform statistical analysis with AI-powered interpretation and academic reporting.',
      cta: 'Start Free Analysis',
      ctaSecondary: 'Watch Demo',
      stats: {
        users: 'Active Researchers',
        analyses: 'Analyses Completed',
        accuracy: 'AI Accuracy',
      },
    },
    // Features
    features: {
      title: 'Everything You Need for Statistical Analysis',
      subtitle: 'Comprehensive SPSS-style analysis with AI-powered insights',
      upload: {
        title: 'Smart Data Upload',
        description: 'Upload CSV or Excel files with automatic variable detection and data validation.',
      },
      analysis: {
        title: 'Complete SPSS Analyses',
        description: 'From descriptive statistics to advanced regression, all tests you need.',
      },
      ai: {
        title: 'AI Interpretation',
        description: 'Get academic-quality explanations of your results in plain language.',
      },
      export: {
        title: 'APA-Ready Reports',
        description: 'Export publication-ready reports in Word or PDF format.',
      },
    },
    // Analysis Categories
    analyses: {
      title: 'SPSS-Style Statistical Analyses',
      subtitle: 'All the statistical tests you need, powered by AI interpretation',
      categories: {
        descriptive: 'Descriptive Statistics',
        compareMeans: 'Compare Means',
        nonparametric: 'Nonparametric Tests',
        correlation: 'Correlation',
        regression: 'Regression',
        reliability: 'Reliability & Scale',
        factor: 'Factor Analysis',
      },
    },
    // Pricing
    pricing: {
      title: 'Simple, Transparent Pricing',
      subtitle: 'Start free, upgrade when you need more',
      free: {
        name: 'Free',
        price: '$0',
        period: 'forever',
        features: [
          'Basic descriptive statistics',
          '5 analyses per month',
          'AI suggestions (basic)',
          'Community support',
        ],
        cta: 'Get Started',
      },
      pro: {
        name: 'Pro',
        price: '$19',
        period: 'per month',
        badge: 'Most Popular',
        features: [
          'All statistical analyses',
          'Unlimited analyses',
          'Full AI interpretation',
          'APA report generation',
          'Word/PDF export',
          'Priority support',
        ],
        cta: 'Start Pro Trial',
      },
    },
    // How It Works
    howItWorks: {
      title: 'How It Works',
      subtitle: 'From data to insights in four simple steps',
      steps: {
        upload: {
          title: 'Upload Your Data',
          description: 'Import your CSV or Excel file. Our AI automatically detects variable types.',
        },
        select: {
          title: 'Select Analysis',
          description: 'Choose from our SPSS-style analysis modules or let AI suggest the right test.',
        },
        analyze: {
          title: 'Run Analysis',
          description: 'Execute statistical tests with full SPSS-quality output tables.',
        },
        interpret: {
          title: 'AI Interpretation',
          description: 'Get academic explanations and export APA-ready reports.',
        },
      },
    },
    // CTA
    cta: {
      title: 'Ready to Transform Your Research?',
      subtitle: 'Join thousands of researchers using AI-powered statistical analysis',
      button: 'Start Free Today',
    },
    // Footer
    footer: {
      description: 'AI-powered statistical analysis platform for students, researchers, and analysts.',
      product: 'Product',
      company: 'Company',
      support: 'Support',
      legal: 'Legal',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      copyright: '© 2024 SPSS AI. All rights reserved.',
    },
    // Dashboard
    dashboard: {
      welcome: 'Welcome back',
      newAnalysis: 'New Analysis',
      recentProjects: 'Recent Projects',
      quickActions: 'Quick Actions',
      dataManager: 'Data Manager',
      aiChat: 'AI Assistant',
      reports: 'Reports',
    },
  },
  ar: {
    nav: {
      home: 'الرئيسية',
      features: 'المميزات',
      analyses: 'تحليلات SPSS',
      howItWorks: 'كيف يعمل',
      pricing: 'الأسعار',
      tutorials: 'الدروس',
      about: 'حولنا',
      contact: 'اتصل بنا',
      login: 'تسجيل الدخول',
      signUp: 'إنشاء حساب',
      tryFree: 'جرب مجاناً',
      dashboard: 'لوحة التحكم',
    },
    hero: {
      title: 'حلل بياناتك مثل SPSS',
      titleHighlight: 'مدعوم بالذكاء الاصطناعي',
      subtitle: 'المساعد البحثي الذكي الذي يساعد الطلاب والباحثين والمحللين في إجراء التحليل الإحصائي مع تفسير مدعوم بالذكاء الاصطناعي وتقارير أكاديمية.',
      cta: 'ابدأ التحليل المجاني',
      ctaSecondary: 'شاهد العرض',
      stats: {
        users: 'باحثون نشطون',
        analyses: 'تحليلات مكتملة',
        accuracy: 'دقة الذكاء الاصطناعي',
      },
    },
    features: {
      title: 'كل ما تحتاجه للتحليل الإحصائي',
      subtitle: 'تحليل شامل بأسلوب SPSS مع رؤى مدعومة بالذكاء الاصطناعي',
      upload: {
        title: 'رفع البيانات الذكي',
        description: 'ارفع ملفات CSV أو Excel مع الكشف التلقائي عن المتغيرات والتحقق من البيانات.',
      },
      analysis: {
        title: 'تحليلات SPSS كاملة',
        description: 'من الإحصاءات الوصفية إلى الانحدار المتقدم، جميع الاختبارات التي تحتاجها.',
      },
      ai: {
        title: 'تفسير الذكاء الاصطناعي',
        description: 'احصل على تفسيرات بجودة أكاديمية لنتائجك بلغة واضحة.',
      },
      export: {
        title: 'تقارير جاهزة للنشر',
        description: 'صدّر تقارير جاهزة للنشر بتنسيق Word أو PDF.',
      },
    },
    analyses: {
      title: 'تحليلات إحصائية بأسلوب SPSS',
      subtitle: 'جميع الاختبارات الإحصائية التي تحتاجها، مدعومة بتفسير الذكاء الاصطناعي',
      categories: {
        descriptive: 'الإحصاءات الوصفية',
        compareMeans: 'مقارنة المتوسطات',
        nonparametric: 'الاختبارات اللامعلمية',
        correlation: 'الارتباط',
        regression: 'الانحدار',
        reliability: 'الموثوقية والمقياس',
        factor: 'التحليل العاملي',
      },
    },
    pricing: {
      title: 'أسعار بسيطة وشفافة',
      subtitle: 'ابدأ مجاناً، قم بالترقية عند الحاجة',
      free: {
        name: 'مجاني',
        price: '$0',
        period: 'للأبد',
        features: [
          'الإحصاءات الوصفية الأساسية',
          '5 تحليلات شهرياً',
          'اقتراحات الذكاء الاصطناعي (أساسية)',
          'دعم المجتمع',
        ],
        cta: 'ابدأ الآن',
      },
      pro: {
        name: 'احترافي',
        price: '$19',
        period: 'شهرياً',
        badge: 'الأكثر شعبية',
        features: [
          'جميع التحليلات الإحصائية',
          'تحليلات غير محدودة',
          'تفسير كامل بالذكاء الاصطناعي',
          'إنشاء تقارير APA',
          'تصدير Word/PDF',
          'دعم ذو أولوية',
        ],
        cta: 'ابدأ النسخة التجريبية',
      },
    },
    howItWorks: {
      title: 'كيف يعمل',
      subtitle: 'من البيانات إلى الرؤى في أربع خطوات بسيطة',
      steps: {
        upload: {
          title: 'ارفع بياناتك',
          description: 'استورد ملف CSV أو Excel. الذكاء الاصطناعي يكتشف أنواع المتغيرات تلقائياً.',
        },
        select: {
          title: 'اختر التحليل',
          description: 'اختر من وحدات تحليل SPSS أو دع الذكاء الاصطناعي يقترح الاختبار المناسب.',
        },
        analyze: {
          title: 'أجرِ التحليل',
          description: 'نفذ الاختبارات الإحصائية مع جداول إخراج بجودة SPSS الكاملة.',
        },
        interpret: {
          title: 'تفسير الذكاء الاصطناعي',
          description: 'احصل على تفسيرات أكاديمية وصدّر تقارير جاهزة بتنسيق APA.',
        },
      },
    },
    cta: {
      title: 'هل أنت مستعد لتحويل بحثك؟',
      subtitle: 'انضم إلى آلاف الباحثين الذين يستخدمون التحليل الإحصائي المدعوم بالذكاء الاصطناعي',
      button: 'ابدأ مجاناً اليوم',
    },
    footer: {
      description: 'منصة تحليل إحصائي مدعومة بالذكاء الاصطناعي للطلاب والباحثين والمحللين.',
      product: 'المنتج',
      company: 'الشركة',
      support: 'الدعم',
      legal: 'قانوني',
      privacy: 'سياسة الخصوصية',
      terms: 'شروط الخدمة',
      copyright: '© 2024 SPSS AI. جميع الحقوق محفوظة.',
    },
    dashboard: {
      welcome: 'مرحباً بعودتك',
      newAnalysis: 'تحليل جديد',
      recentProjects: 'المشاريع الأخيرة',
      quickActions: 'إجراءات سريعة',
      dataManager: 'مدير البيانات',
      aiChat: 'مساعد الذكاء الاصطناعي',
      reports: 'التقارير',
    },
  },
  et: {
    nav: {
      home: 'Avaleht',
      features: 'Funktsioonid',
      analyses: 'SPSS Analüüsid',
      howItWorks: 'Kuidas see töötab',
      pricing: 'Hinnad',
      tutorials: 'Õpetused',
      about: 'Meist',
      contact: 'Kontakt',
      login: 'Logi sisse',
      signUp: 'Registreeru',
      tryFree: 'Proovi tasuta',
      dashboard: 'Töölaud',
    },
    hero: {
      title: 'Analüüsi oma andmeid nagu SPSS-is',
      titleHighlight: 'AI-toega',
      subtitle: 'Intelligentne uurimisassistent, mis aitab üliõpilastel, teadlastel ja analüütikutel teostada statistilist analüüsi AI-toega tõlgendamise ja akadeemilise aruandlusega.',
      cta: 'Alusta tasuta analüüsi',
      ctaSecondary: 'Vaata demo',
      stats: {
        users: 'Aktiivsed teadlased',
        analyses: 'Tehtud analüüse',
        accuracy: 'AI täpsus',
      },
    },
    features: {
      title: 'Kõik, mida vajad statistiliseks analüüsiks',
      subtitle: 'Põhjalik SPSS-stiilis analüüs AI-toega ülevaadetega',
      upload: {
        title: 'Nutikas andmete üleslaadimine',
        description: 'Laadi üles CSV või Excel failid automaatse muutujate tuvastamise ja andmete valideerimisega.',
      },
      analysis: {
        title: 'Täielikud SPSS analüüsid',
        description: 'Kirjeldavast statistikast keeruka regressioonini - kõik vajalikud testid.',
      },
      ai: {
        title: 'AI tõlgendus',
        description: 'Saa akadeemilise kvaliteediga selgitusi oma tulemustest lihtsas keeles.',
      },
      export: {
        title: 'APA-valmis aruanded',
        description: 'Ekspordi avaldamisvalmis aruandeid Word või PDF formaadis.',
      },
    },
    analyses: {
      title: 'SPSS-stiilis statistilised analüüsid',
      subtitle: 'Kõik vajalikud statistilised testid, AI tõlgendusega',
      categories: {
        descriptive: 'Kirjeldav statistika',
        compareMeans: 'Võrdle keskmisi',
        nonparametric: 'Mitteparameetrilised testid',
        correlation: 'Korrelatsioon',
        regression: 'Regressioon',
        reliability: 'Usaldusväärsus ja skaala',
        factor: 'Faktoranalüüs',
      },
    },
    pricing: {
      title: 'Lihtne, läbipaistev hinnastamine',
      subtitle: 'Alusta tasuta, uuenda kui vajad rohkem',
      free: {
        name: 'Tasuta',
        price: '€0',
        period: 'igavesti',
        features: [
          'Põhiline kirjeldav statistika',
          '5 analüüsi kuus',
          'AI soovitused (põhiline)',
          'Kogukonna tugi',
        ],
        cta: 'Alusta',
      },
      pro: {
        name: 'Pro',
        price: '€19',
        period: 'kuus',
        badge: 'Populaarseim',
        features: [
          'Kõik statistilised analüüsid',
          'Piiramatu arv analüüse',
          'Täielik AI tõlgendus',
          'APA aruande genereerimine',
          'Word/PDF eksport',
          'Prioriteetne tugi',
        ],
        cta: 'Alusta Pro prooviperioodi',
      },
    },
    howItWorks: {
      title: 'Kuidas see töötab',
      subtitle: 'Andmetest ülevaadeteni nelja lihtsa sammuga',
      steps: {
        upload: {
          title: 'Laadi üles oma andmed',
          description: 'Impordi oma CSV või Excel fail. Meie AI tuvastab automaatselt muutujate tüübid.',
        },
        select: {
          title: 'Vali analüüs',
          description: 'Vali meie SPSS-stiilis analüüsimoodulitest või lase AI-l soovitada õiget testi.',
        },
        analyze: {
          title: 'Käivita analüüs',
          description: 'Teosta statistilised testid täieliku SPSS-kvaliteediga väljundtabelitega.',
        },
        interpret: {
          title: 'AI tõlgendus',
          description: 'Saa akadeemilised selgitused ja ekspordi APA-valmis aruanded.',
        },
      },
    },
    cta: {
      title: 'Valmis oma uurimust muutma?',
      subtitle: 'Liitu tuhandete teadlastega, kes kasutavad AI-toega statistilist analüüsi',
      button: 'Alusta täna tasuta',
    },
    footer: {
      description: 'AI-toega statistilise analüüsi platvorm üliõpilastele, teadlastele ja analüütikutele.',
      product: 'Toode',
      company: 'Ettevõte',
      support: 'Tugi',
      legal: 'Õiguslik',
      privacy: 'Privaatsuspoliitika',
      terms: 'Teenuse tingimused',
      copyright: '© 2024 SPSS AI. Kõik õigused kaitstud.',
    },
    dashboard: {
      welcome: 'Tere tulemast tagasi',
      newAnalysis: 'Uus analüüs',
      recentProjects: 'Viimased projektid',
      quickActions: 'Kiired toimingud',
      dataManager: 'Andmehaldur',
      aiChat: 'AI assistent',
      reports: 'Aruanded',
    },
  },
};

export type Translations = typeof translations.en;
