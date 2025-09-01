import type { PropsWithChildren } from 'react';
import { Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import '@/lib/i18n';
import { queryClient } from '@/lib/queryClient';

export function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>{children}</Suspense>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}