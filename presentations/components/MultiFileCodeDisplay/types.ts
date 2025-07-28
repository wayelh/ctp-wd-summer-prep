export interface FileContent {
  fileName: string;
  content: string;
  language: string;
  testContent?: string;
  versions?: string[];
}

export interface MultiFileCodeDisplayProps {
  code?: string;
  files?: FileContent[];
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
  style?: React.CSSProperties;
  handleThemeDidChange?: (newTheme: string) => void;
  height?: string;
  theme?: 'light' | 'dark' | 'vs-dark';
  readOnly?: boolean;
  onChange?: (fileName: string, value: string | undefined) => void;
  options?: any;
  enableVersions?: boolean;
}

export interface ConsoleOutput {
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: number | Date;
}

export interface TestResult {
  name?: string;
  description?: string;
  passed: boolean;
  error?: string;
  duration?: number;
}