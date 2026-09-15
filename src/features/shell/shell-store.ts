import { create } from 'zustand';

interface ShellState {
  sidebarCollapsed: boolean;
  mobileNavigationOpen: boolean;
  profileOpen: boolean;
  setMobileNavigationOpen: (open: boolean) => void;
  setProfileOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useShellStore = create<ShellState>((set) => ({
  sidebarCollapsed: false,
  mobileNavigationOpen: false,
  profileOpen: false,
  setMobileNavigationOpen: (open) => set({ mobileNavigationOpen: open }),
  setProfileOpen: (open) => set({ profileOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
