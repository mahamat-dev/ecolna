export type Locale = 'fr' | 'en' | 'ar';

export function getCurrentLocale(): Locale {
  const stored = (window?.localStorage?.getItem('locale') as Locale | null) || null;
  if (stored === 'fr' || stored === 'en' || stored === 'ar') return stored;
  return 'fr';
}

export function isRTL(loc: string) {
  return loc === 'ar';
}