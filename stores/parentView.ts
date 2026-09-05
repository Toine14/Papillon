import { create } from 'zustand'

interface ParentViewStorage {
  // Which child the parent has chosen to view this session — null means "show
  // the family dashboard". Deliberately not persisted: a parent lands back on
  // the dashboard on every cold start, same as ecoledirecte.com's /Famille.
  enteredChildId: string | null;
  enterChild: (childId: string) => void;
  exitToFamilyDashboard: () => void;
}

export const useParentViewStore = create<ParentViewStorage>((set) => ({
  enteredChildId: null,
  enterChild: (childId) => set({ enteredChildId: childId }),
  exitToFamilyDashboard: () => set({ enteredChildId: null }),
}))
