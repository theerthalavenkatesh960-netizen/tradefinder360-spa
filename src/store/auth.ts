import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  email: string;
  name: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      login: (token, user) => {
        localStorage.setItem('auth_token', token);
        set({ token, user });
      },
      logout: () => {
        localStorage.removeItem('auth_token');
        set({ token: null, user: null });
      },
      isAuthenticated: () => {
        const token = get().token;
        return !!token;
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
