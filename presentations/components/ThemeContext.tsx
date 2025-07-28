import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'vs-dark' | 'vs';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem('ctp-editor-theme');
    // Handle old solarized themes by converting them
    if (savedTheme === 'solarized-dark' || savedTheme === 'solarized-light') {
      const newTheme = savedTheme === 'solarized-light' ? 'vs' : 'vs-dark';
      localStorage.setItem('ctp-editor-theme', newTheme);
      return newTheme;
    }
    return savedTheme === 'vs' ? 'vs' : 'vs-dark';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('ctp-editor-theme', newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'vs-dark' ? 'vs' : 'vs-dark';
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};