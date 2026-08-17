import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { App } from './App';
import './styles.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: (count, error) => count < 2 && !(error && typeof error === 'object' && 'status' in error && Number((error as { status: number }).status) < 500), refetchOnWindowFocus: false }, mutations: { retry: false } } });

createRoot(document.getElementById('app')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><ToastProvider><AuthProvider><App/></AuthProvider></ToastProvider></QueryClientProvider></React.StrictMode>);
