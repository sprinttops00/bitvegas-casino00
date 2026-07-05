import React, { createContext, useContext } from 'react';

export const getTelegramUser = () => {
  try {
    const tg = window.Telegram?.WebApp;
    if (!tg || !tg.initDataUnsafe?.user) return null;
    tg.ready();
    return tg.initDataUnsafe.user;
  } catch (e) {
    return null;
  }
};

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const telegramUser = getTelegramUser();

  const navigateToLogin = () => { window.location.href = '/'; };
  const logout = () => { window.location.href = '/'; };

  return (
    <AuthContext.Provider value={{
      user: telegramUser,
      isAuthenticated: !!telegramUser,
      isLoadingAuth: false,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      logout,
      navigateToLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};