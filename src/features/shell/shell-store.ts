import { create } from 'zustand';

interface ShellState {
  mobileNavigationOpen: boolean;
  profileOpen: boolean;
  setMobileNavigationOpen: (open: boolean) => void;
  setProfileOpen: (open: boolean) => void;
}

export const useShellStore = create<ShellState>((set) => ({
  mobileNavigationOpen: false,
  profileOpen: false,
  setMobileNavigationOpen: (open) => set({ mobileNavigationOpen: open }),
  setProfileOpen: (open) => set({ profileOpen: open }),
}));
