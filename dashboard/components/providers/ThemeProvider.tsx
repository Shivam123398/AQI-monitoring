"use client";

import React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';

interface Props {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
}

export function ThemeProvider({ children, ...props }: Props) {
  return (
    <NextThemesProvider {...props}>
      {children}
      <Toaster position="top-right" />
    </NextThemesProvider>
  );
}
