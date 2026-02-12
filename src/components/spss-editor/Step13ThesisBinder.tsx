import { FileDown } from 'lucide-react';

export function Step13ThesisBinder() {
  return (
    <div className="text-center py-16">
      <FileDown className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
      <h2 className="text-xl font-semibold mb-2">Thesis Binder</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        Combines all chapters into a unified document with auto-numbered
        tables/figures, table of contents, and APA-7 Word/PDF export.
      </p>
      <p className="text-xs text-muted-foreground mt-4">Coming in Phase 11</p>
    </div>
  );
}
