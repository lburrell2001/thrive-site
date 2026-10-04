'use client';

// What every CRM page shares through the workspace layout: opening a
// contact in the side panel, a refresh signal after something changes, the
// contact list (for search and pickers) and the toast.

import { createContext, useContext } from 'react';
import type { CrmContactRow } from '@/types/crm';

export interface CrmWorkspace {
  /** Open someone in the contact panel (and put them in the URL). */
  openContact: (contactId: string, dealId?: string | null) => void;
  /** Bumps whenever data changed; pages refetch when it does. */
  version: number;
  refresh: () => void;
  contacts: CrmContactRow[] | null;
  notify: (message: string, tone?: 'ok' | 'error') => void;
}

export const CrmContext = createContext<CrmWorkspace | null>(null);

export function useCrm(): CrmWorkspace {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error('useCrm must be used inside the CRM layout');
  return ctx;
}
