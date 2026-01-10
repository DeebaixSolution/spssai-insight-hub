import { Link } from 'react-router-dom';
import { BarChart3, Github, Twitter, Linkedin } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  const footerLinks = {
    product: [
      { label: t.nav.features, href: '#features' },
      { label: t.nav.analyses, href: '#analyses' },
      { label: t.nav.pricing, href: '#pricing' },
      { label: t.nav.tutorials, href: '/tutorials' },
    ],
    company: [
      { label: t.nav.about, href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Careers', href: '/careers' },
      { label: t.nav.contact, href: '/contact' },
    ],
    support: [
      { label: 'Help Center', href: '/help' },
      { label: 'Documentation', href: '/docs' },
      { label: 'API', href: '/api' },
      { label: 'Status', href: '/status' },
    ],
    legal: [
      { label: t.footer.privacy, href: '/privacy' },
      { label: t.footer.terms, href: '/terms' },
      { label: 'Cookies', href: '/cookies' },
    ],
  };

  return (
    <footer className="bg-sidebar text-sidebar-foreground py-16">
      <div className="container-wide">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-data flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">SPSS<span className="text-accent">AI</span></span>
            </Link>
            <p className="text-sm text-sidebar-foreground/70 mb-6 max-w-xs">
              {t.footer.description}
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-9 h-9 rounded-lg bg-sidebar-accent flex items-center justify-center hover:bg-sidebar-primary transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-lg bg-sidebar-accent flex items-center justify-center hover:bg-sidebar-primary transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-lg bg-sidebar-accent flex items-center justify-center hover:bg-sidebar-primary transition-colors">
                <Github className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">{t.footer.product}</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link, i) => (
                <li key={i}>
                  <a href={link.href} className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{t.footer.company}</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link, i) => (
                <li key={i}>
                  <a href={link.href} className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{t.footer.support}</h4>
            <ul className="space-y-3">
              {footerLinks.support.map((link, i) => (
                <li key={i}>
                  <a href={link.href} className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{t.footer.legal}</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link, i) => (
                <li key={i}>
                  <a href={link.href} className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-sidebar-border text-center">
          <p className="text-sm text-sidebar-foreground/50">{t.footer.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
