'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/queryClient';
import { ReactNode, useState } from 'react';
import { Toaster } from 'react-hot-toast';

export function ClientProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

