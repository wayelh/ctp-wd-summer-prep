import React, { useEffect, useState, useCallback, useRef, useContext } from 'react';
import Editor, { EditorProps, useMonaco, DiffEditor } from '@monaco-editor/react';
import * as ts from 'typescript';
import { SlideContext } from 'spectacle';

interface FileContent {
  fileName: string;
  language: 'html' | 'css' | 'javascript' | 'typescript' | 'tsx' | 'jsx';
  content: string;
  versions?: string[];
}

interface MultiFileCodeDisplayProps {
  files?: FileContent[];
  code?: string;
  height?: string;
  theme?: 'light' | 'dark' | 'vs-dark';
  readOnly?: boolean;
  onChange?: (fileName: string, value: string | undefined) => void;
  options?: any;
  enableVersions?: boolean;
}

interface ConsoleOutput {
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: Date;
}

interface TestResult {
  passed: boolean;
  description: string;
  error?: string;
}

// Parse files from code string using // @@@ filename syntax
const parseFilesFromCode = (code: string): FileContent[] => {
  const lines = code.split('\n');
  const files: FileContent[] = [];
  let currentFile: FileContent | null = null;
  let currentContent: string[] = [];
  
  for (const line of lines) {
    if (line.trim().startsWith('// @@@ ')) {
      // Save previous file if exists
      if (currentFile) {
        currentFile.content = currentContent.join('\n').trim();
        files.push(currentFile);
      }
      
      // Start new file
      const fileName = line.trim().substring(6).trim();
      const ext = fileName.split('.').pop() || '';
      const language = getLanguageFromExtension(ext);
      
      currentFile = {
        fileName,
        language,
        content: ''
      };
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  
  // Save last file
  if (currentFile) {
    currentFile.content = currentContent.join('\n').trim();
    files.push(currentFile);
  }
  
  // If no files found, treat entire code as single file
  if (files.length === 0) {
    files.push({
      fileName: 'index.js',
      language: 'javascript',
      content: code
    });
  }
  
  // Process files to extract tests
  const processedFiles: FileContent[] = [];
  let testFileContent = '';
  
  for (const file of files) {
    const lines = file.content.split('\n');
    const testSeparatorIndex = lines.findIndex(line => line.trim() === '// ***');
    
    if (testSeparatorIndex !== -1) {
      // Split into main content and test content
      const mainContent = lines.slice(0, testSeparatorIndex).join('\n').trim();
      const testContent = lines.slice(testSeparatorIndex + 1).join('\n').trim();
      
      // Add main file with content before // ***
      processedFiles.push({
        ...file,
        content: mainContent
      });
      
      // Accumulate test content
      if (testContent) {
        if (testFileContent) testFileContent += '\n\n';
        testFileContent += `// Tests from ${file.fileName}\n${testContent}`;
      }
    } else {
      // No test separator, use entire content
      processedFiles.push(file);
    }
  }
  
  // Add test file if we have test content
  if (testFileContent) {
    const mainLang = processedFiles.find(f => f.language === 'typescript' || f.language === 'tsx') ? 'typescript' : 'javascript';
    processedFiles.push({
      fileName: 'tests.' + (mainLang === 'typescript' ? 'ts' : 'js'),
      language: mainLang,
      content: testFileContent
    });
  }
  
  return processedFiles;
};

const getLanguageFromExtension = (ext: string): FileContent['language'] => {
  switch (ext) {
    case 'html': return 'html';
    case 'css': return 'css';
    case 'js': return 'javascript';
    case 'ts': return 'typescript';
    case 'tsx': return 'tsx';
    case 'jsx': return 'jsx';
    default: return 'javascript';
  }
};

export const MultiFileCodeDisplay: React.FC<MultiFileCodeDisplayProps> = React.memo(({
  files: propFiles,
  code,
  height = "50vh",
  theme = 'vs-dark',
  readOnly = false,
  onChange,
  options = {},
  enableVersions = false
}) => {
  // Debug props
  console.log('[MultiFileCodeDisplay] Rendering with props:', {
    filesCount: propFiles?.length,
    code: !!code,
    height,
    enableVersions
  });
  // Parse files from code if provided
  const files = propFiles || (code ? parseFilesFromCode(code) : []);

  const monaco = useMonaco();
  const slideContext = useContext(SlideContext);
  
  // Create a unique instance ID for this component
  const instanceId = React.useRef(`instance-${Date.now()}-${Math.random()}`).current;
  
  // State management
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [consoleOutput, setConsoleOutput] = useState<ConsoleOutput[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'console' | 'tests' | 'preview' | 'diff'>('console');
  const [scratchPadContents, setScratchPadContents] = useState<Record<string, string>>({});
  const [selectedSolutionVersion, setSelectedSolutionVersion] = useState(1); // Start at version 1 (first solution)
  const [currentTheme, setCurrentTheme] = useState<'solarized-dark' | 'solarized-light'>(() => {
    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem('ctp-editor-theme');
    return savedTheme === 'solarized-light' ? 'solarized-light' : 'solarized-dark';
  });
  
  // Pane state
  const [isPaneCollapsed, setIsPaneCollapsed] = useState(false);
  const [isPaneExpanded, setIsPaneExpanded] = useState(false);
  const [paneHeight, setPaneHeight] = useState(55); // percentage
  const [isResizing, setIsResizing] = useState(false);
  
  // Preview responsive state
  const [previewWidth, setPreviewWidth] = useState<number | string>('100%');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile' | 'custom'>('desktop');
  const [isRotated, setIsRotated] = useState(false);
  
  // Device presets
  const devicePresets = {
    desktop: { width: '100%', label: 'Desktop', icon: '🖥️' },
    tablet: { width: '768px', label: 'Tablet', icon: '💻' },
    mobile: { width: '375px', label: 'Mobile', icon: '📱' },
    custom: { width: previewWidth, label: 'Custom', icon: '⚙️' }
  };
  
  // Additional common breakpoints for reference
  const commonBreakpoints = [
    { name: 'iPhone SE', width: '375px' },
    { name: 'iPhone 12 Pro', width: '390px' },
    { name: 'Pixel 5', width: '393px' },
    { name: 'Samsung Galaxy S20', width: '412px' },
    { name: 'iPad Mini', width: '768px' },
    { name: 'iPad Air', width: '820px' },
    { name: 'Desktop', width: '1280px' },
    { name: 'Wide', width: '1920px' }
  ];
  
  // Update global Monaco styles when theme changes
  useEffect(() => {
    const existingStyle = document.getElementById('monaco-theme-overrides');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Force context menu backgrounds with MutationObserver
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Check for context menu containers
            if (node.classList.contains('context-view') || 
                node.classList.contains('monaco-menu-container') ||
                node.classList.contains('monaco-menu')) {
              // Force background color
              node.style.backgroundColor = currentTheme === 'solarized-dark' ? '#073642' : '#eee8d5';
              node.style.opacity = '1';
              node.style.border = '1px solid #ffffff';
              node.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
              
              // Apply to all descendants
              const applyBackground = (element: HTMLElement) => {
                if (element.classList.contains('monaco-menu') ||
                    element.classList.contains('monaco-scrollable-element') ||
                    element.classList.contains('monaco-list') ||
                    element.classList.contains('monaco-list-rows') ||
                    element.classList.contains('monaco-action-bar')) {
                  element.style.backgroundColor = currentTheme === 'solarized-dark' ? '#073642' : '#eee8d5';
                }
                
                // Apply to menu items
                if (element.classList.contains('monaco-list-row') ||
                    element.classList.contains('action-item')) {
                  element.style.backgroundColor = currentTheme === 'solarized-dark' ? '#073642' : '#eee8d5';
                  element.style.color = currentTheme === 'solarized-dark' ? '#ffffff' : '#000000';
                }
                
                // Apply to labels
                if (element.classList.contains('action-label') ||
                    element.classList.contains('monaco-icon-label') ||
                    element.classList.contains('label-name') ||
                    element.classList.contains('label-description')) {
                  element.style.color = currentTheme === 'solarized-dark' ? '#ffffff' : '#000000';
                }
                
                // Recursively apply to children
                Array.from(element.children).forEach(child => {
                  if (child instanceof HTMLElement) {
                    applyBackground(child);
                  }
                });
              };
              
              applyBackground(node);
              
              // Also observe changes to this node
              observer.observe(node, { childList: true, subtree: true });
            }
          }
        });
      });
    });
    
    // Start observing
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Also check for shadow roots periodically
    const shadowRootInterval = setInterval(() => {
      // Find all elements that might have shadow roots
      document.querySelectorAll('*').forEach(element => {
        if (element.shadowRoot) {
          // Apply styles to shadow root
          const shadowStyle = document.createElement('style');
          shadowStyle.textContent = `
            .monaco-menu,
            .monaco-menu-container,
            .context-view {
              background-color: ${currentTheme === 'solarized-dark' ? '#073642' : '#eee8d5'} !important;
              opacity: 1 !important;
              border: 1px solid #ffffff !important;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
            }
            
            .monaco-list,
            .monaco-scrollable-element,
            .monaco-action-bar {
              background-color: ${currentTheme === 'solarized-dark' ? '#073642' : '#eee8d5'} !important;
              opacity: 1 !important;
            }
            
            .monaco-list-row,
            .action-item {
              background-color: ${currentTheme === 'solarized-dark' ? '#073642' : '#eee8d5'} !important;
              color: ${currentTheme === 'solarized-dark' ? '#ffffff' : '#000000'} !important;
            }
            
            .monaco-list-row:hover,
            .action-item:hover {
              background-color: ${currentTheme === 'solarized-dark' ? '#586e75' : '#93a1a1'} !important;
              color: ${currentTheme === 'solarized-dark' ? '#ffffff' : '#000000'} !important;
            }
            
            .action-label,
            .monaco-list-row .monaco-icon-label,
            .monaco-list-row .label-name,
            .monaco-list-row .label-description {
              color: ${currentTheme === 'solarized-dark' ? '#ffffff' : '#000000'} !important;
            }
          `;
          
          if (!element.shadowRoot.querySelector('#monaco-shadow-style')) {
            shadowStyle.id = 'monaco-shadow-style';
            element.shadowRoot.appendChild(shadowStyle);
          }
        }
      });
    }, 100);
    
    const style = document.createElement('style');
    style.id = 'monaco-theme-overrides';
    style.innerHTML = currentTheme === 'solarized-dark' ? `
      .monaco-hover,
      .monaco-editor-hover,
      .monaco-hover-content,
      .monaco-hover .hover-contents {
        background-color: #073642 !important;
        border: 1px solid #586e75 !important;
        color: #839496 !important;
      }
      
      .monaco-menu,
      .context-view.monaco-menu-container,
      .monaco-action-bar {
        background-color: #073642 !important;
        border: 1px solid #586e75 !important;
        color: #839496 !important;
      }
      
      .monaco-menu .action-label {
        color: #839496 !important;
      }
      
      .monaco-menu .action-item:hover {
        background-color: #586e75 !important;
      }
      
      /* More specific context menu selectors */
      .context-view .monaco-menu {
        background-color: #073642 !important;
      }
      
      .context-view .monaco-action-bar {
        background-color: #073642 !important;
      }
      
      .shadow-root-host .monaco-menu {
        background-color: #073642 !important;
      }
    ` : `
      .monaco-hover,
      .monaco-editor-hover,
      .monaco-hover-content,
      .monaco-hover .hover-contents {
        background-color: #eee8d5 !important;
        border: 1px solid #93a1a1 !important;
        color: #657b83 !important;
      }
      
      .monaco-menu,
      .context-view.monaco-menu-container,
      .monaco-action-bar {
        background-color: #eee8d5 !important;
        border: 1px solid #93a1a1 !important;
        color: #657b83 !important;
      }
      
      .monaco-menu .action-label {
        color: #657b83 !important;
      }
      
      .monaco-menu .action-item:hover {
        background-color: #93a1a1 !important;
        color: #002b36 !important;
      }
      
      /* More specific context menu selectors */
      .context-view .monaco-menu {
        background-color: #eee8d5 !important;
      }
      
      .context-view .monaco-action-bar {
        background-color: #eee8d5 !important;
      }
      
      .shadow-root-host .monaco-menu {
        background-color: #eee8d5 !important;
      }
    `;
    document.head.appendChild(style);
    
    // Cleanup
    return () => {
      observer.disconnect();
      clearInterval(shadowRootInterval);
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, [currentTheme]);
  
  // Theme colors helper
  const themeColors = currentTheme === 'solarized-dark' ? {
    background: '#002b36',
    backgroundSecondary: '#073642',
    foreground: '#839496',
    border: '#586e75',
    borderLight: '#073642',
    success: '#859900',
    error: '#dc322f',
    warning: '#b58900',
    info: '#268bd2',
    muted: '#586e75',
  } : {
    background: '#fdf6e3',
    backgroundSecondary: '#eee8d5',
    foreground: '#657b83',
    border: '#93a1a1',
    borderLight: '#eee8d5',
    success: '#859900',
    error: '#dc322f',
    warning: '#b58900',
    info: '#268bd2',
    muted: '#93a1a1',
  };
  
  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track slide state
  const { isSlideActive, slideId } = slideContext;
  
  // Generate a unique key for this slide's scratch pad storage (without instanceId for persistence)
  const getStorageKey = (fileName: string) => `ctp-scratchpad-${slideId}-${fileName}`;
  
  // Initialize file contents when files change
  useEffect(() => {
    if (files.length > 0) {
      const contents = files.reduce((acc, file) => ({ ...acc, [file.fileName]: file.content }), {});
      
      setFileContents(contents);
      setActiveTab(files.some(f => f.fileName.endsWith('.html')) ? 'preview' : 'console');
      
      // Reset file index if out of bounds
      if (currentFileIndex >= files.length) {
        setCurrentFileIndex(0);
      }
      
      // Load scratch pad contents from localStorage
      const savedScratchPads: Record<string, string> = {};
      files.forEach(file => {
        const savedContent = localStorage.getItem(getStorageKey(file.fileName));
        if (savedContent !== null) {
          savedScratchPads[file.fileName] = savedContent;
        } else if (file.versions && file.versions.length > 0) {
          // Initialize with first version (exercise template) if no saved content
          savedScratchPads[file.fileName] = file.versions[0];
        } else {
          savedScratchPads[file.fileName] = file.content;
        }
      });
      setScratchPadContents(savedScratchPads);
    }
  }, [files, currentFileIndex, slideId]);
  
  // Get current file safely
  const currentFile = files.length > 0 ? files[Math.min(currentFileIndex, files.length - 1)] : null;
  
  if (!currentFile && files.length > 0) {
    console.error('[MultiFileCodeDisplay] currentFile is null but files exist:', { currentFileIndex, filesLength: files.length });
  }
  
  // Check if we have HTML files for preview
  const hasHtmlFiles = files.some(f => f.fileName.endsWith('.html'));
  
  // Always use scratch pad content for the main editor
  const currentContent = currentFile ? (scratchPadContents[currentFile.fileName] || '') : '';

  // Clean up editor reference when component unmounts
  useEffect(() => {
    return () => {
      editorRef.current = null;
    };
  }, []);

  const handleEditorChange = (value: string | undefined) => {
    if (!currentFile) return;
    
    const fileName = currentFile.fileName;
    
    // Always save to scratch pad
    setScratchPadContents(prev => ({
      ...prev,
      [fileName]: value || ''
    }));
    
    // Persist to localStorage
    localStorage.setItem(getStorageKey(fileName), value || '');
    
    onChange?.(fileName, value);
  };

  const getLanguageForFile = (fileName: string): string => {
    const ext = fileName.split('.').pop();
    switch (ext) {
      case 'html': return 'html';
      case 'css': return 'css';
      case 'js': return 'javascript';
      case 'ts': return 'typescript';
      case 'tsx': return 'typescriptreact';
      case 'jsx': return 'javascriptreact';
      default: return 'javascript';
    }
  };

  const compileTypeScript = (code: string, fileName: string): string => {
    const isTsx = fileName.endsWith('.tsx') || fileName.endsWith('.jsx');
    
    try {
      const result = ts.transpileModule(code, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
          jsx: isTsx ? ts.JsxEmit.React : ts.JsxEmit.None,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          moduleResolution: ts.ModuleResolutionKind.NodeJs
        },
        fileName: fileName
      });
      
      return result.outputText;
    } catch (error) {
      throw new Error(`TypeScript compilation error in ${fileName}: ${error}`);
    }
  };

  const clearConsole = () => {
    setConsoleOutput([]);
    setTestResults([]);
  };

  const addConsoleOutput = (type: ConsoleOutput['type'], message: string) => {
    // Ensure message is a string
    const safeMessage = typeof message === 'string' ? message : JSON.stringify(message);
    setConsoleOutput(prev => [...prev, { type, message: safeMessage, timestamp: new Date() }]);
  };

  const addTestResult = (result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  };

  // Handle pane resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = ((containerRect.bottom - e.clientY) / containerRect.height) * 100;
      
      // Limit between 20% and 80%
      setPaneHeight(Math.max(20, Math.min(80, newHeight)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const runCode = useCallback(async () => {
    setIsRunning(true);
    clearConsole();
    // Don't change the active tab - let the user control which pane they want to see
    
    try {
      // Get all file contents
      const cssFile = files.find(f => f.fileName === 'index.css');
      const jsFiles = files.filter(f => 
        f.language === 'javascript' || 
        f.language === 'typescript' || 
        f.language === 'jsx' || 
        f.language === 'tsx'
      );
      
      // Build HTML content - use scratch pad content if available
      let htmlContent = scratchPadContents['index.html'] || fileContents['index.html'] || '<!DOCTYPE html><html><head></head><body></body></html>';
      
      // Inject CSS if exists
      if (cssFile) {
        const cssContent = scratchPadContents['index.css'] || fileContents['index.css'] || '';
        const styleTag = `<style>${cssContent}</style>`;
        htmlContent = htmlContent.replace('</head>', `${styleTag}</head>`);
      }
      
      // Create blob URLs for each module to preserve line numbers
      const moduleUrls: Record<string, string> = {};
      
      // Compile and create blob URLs for each file
      for (const jsFile of jsFiles) {
        // Skip test files for module creation
        if (jsFile.fileName.startsWith('tests.')) continue;
        
        // Use scratch pad content for all files
        const content = scratchPadContents[jsFile.fileName] || fileContents[jsFile.fileName] || '';
        
        // Transform the code to export all top-level declarations
        let moduleContent = content;
        
        // Add exports for all top-level const/let/var declarations
        moduleContent = moduleContent.replace(
          /^(const|let|var)\s+(\w+)\s*=/gm,
          'export $1 $2 ='
        );
        
        // Add exports for all top-level function declarations
        moduleContent = moduleContent.replace(
          /^function\s+(\w+)/gm,
          'export function $1'
        );
        
        let compiled = moduleContent;
        
        if (jsFile.language === 'typescript' || jsFile.language === 'tsx') {
          compiled = compileTypeScript(moduleContent, jsFile.fileName);
        }
        
        // Create blob URL for this module
        const moduleBlob = new Blob([compiled], { type: 'application/javascript' });
        const moduleUrl = URL.createObjectURL(moduleBlob);
        
        // Store URL with both full filename and without extension for imports
        const moduleName = jsFile.fileName.replace(/\.(js|ts|jsx|tsx)$/, '');
        moduleUrls[jsFile.fileName] = moduleUrl;
        moduleUrls[moduleName] = moduleUrl;
        moduleUrls['./' + jsFile.fileName] = moduleUrl;
        moduleUrls['./' + moduleName] = moduleUrl;
      }
      
      // Create import map for module resolution
      const importMap = {
        imports: moduleUrls
      };
      
      // Create test runner script
      const testRunner = `
        // Override console methods
        const originalConsole = {
          log: console.log,
          error: console.error,
          warn: console.warn,
          info: console.info
        };
        
        ['log', 'error', 'warn', 'info'].forEach(method => {
          console[method] = function(...args) {
            window.parent.postMessage({
              type: 'console',
              method: method,
              args: args.map(arg => {
                try {
                  if (arg === undefined) return 'undefined';
                  if (arg === null) return 'null';
                  if (typeof arg === 'object') {
                    // Handle circular references and special objects
                    try {
                      const stringified = JSON.stringify(arg, null, 2);
                      return stringified;
                    } catch (jsonError) {
                      // Handle circular references or other JSON errors
                      if (arg.constructor && arg.constructor.name) {
                        return '[' + arg.constructor.name + ']';
                      }
                      return '[Object]';
                    }
                  }
                  return String(arg);
                } catch (e) {
                  return '[Error converting to string]';
                }
              })
            }, '*');
            originalConsole[method].apply(console, args);
          };
        });
        
        // CSS testing utilities
        window.getCSSRules = function() {
          const rules = [];
          for (const sheet of document.styleSheets) {
            try {
              for (const rule of sheet.cssRules) {
                rules.push(rule);
              }
            } catch (e) {
              // Cross-origin or other access issues
            }
          }
          return rules;
        };
        
        window.getCSSAST = function() {
          const styleElements = document.querySelectorAll('style');
          const cssText = Array.from(styleElements).map(el => el.textContent).join('\\n');
          return cssText;
        };
        
        // Simple CSS parser for testing
        window.parseCSS = function(cssText) {
          const rules = [];
          const ruleRegex = /([^{]+)\\{([^}]+)\\}/g;
          let match;
          
          while ((match = ruleRegex.exec(cssText)) !== null) {
            const selector = match[1].trim();
            const declarationsText = match[2].trim();
            const declarations = {};
            
            declarationsText.split(';').forEach(decl => {
              const [prop, value] = decl.split(':').map(s => s.trim());
              if (prop && value) {
                declarations[prop] = value;
              }
            });
            
            rules.push({ selector, declarations });
          }
          
          return rules;
        };
        
        // DOM testing utilities
        window.getComputedStyles = function(selector) {
          const element = document.querySelector(selector);
          if (!element) return null;
          return window.getComputedStyle(element);
        };
        
        // Error handling
        window.addEventListener('error', (event) => {
          console.error(event.error?.stack || event.message);
          event.preventDefault();
        });
        
        window.addEventListener('unhandledrejection', (event) => {
          console.error('Unhandled Promise Rejection:', event.reason);
          event.preventDefault();
        });
      `;
      
      // Build final HTML with all scripts
      const scriptTags = `
        <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/mocha@10.2.0/mocha.js"></script>
        <script src="https://unpkg.com/chai@4.3.7/chai.js"></script>
        <script src="https://unpkg.com/sinon@15.2.0/pkg/sinon.js"></script>
        <link rel="stylesheet" href="https://unpkg.com/mocha@10.2.0/mocha.css">
        <script>
          window.React = React;
          window.ReactDOM = ReactDOM;
          window.expect = chai.expect;
          window.assert = chai.assert;
          window.sinon = sinon;
          
          // Configure Mocha
          mocha.setup({ ui: 'bdd' });
          
          // Pass files data to iframe context
          window.files = ${JSON.stringify(files)};
          window.fileContents = ${JSON.stringify(fileContents)};
          window.scratchPadContents = ${JSON.stringify(scratchPadContents)};
          console.log('Scratch pad contents passed to iframe:', Object.keys(window.scratchPadContents));
          
          ${testRunner}
        </script>
        ${Object.keys(moduleUrls).length > 0 ? `
          <script type="importmap">
            ${JSON.stringify(importMap, null, 2)}
          </script>
        ` : ''}
        <script type="module">
          // Import and execute all non-test modules
          ${jsFiles.filter(f => !f.fileName.startsWith('tests.')).map(jsFile => {
            const moduleName = jsFile.fileName.replace(/\.(js|ts|jsx|tsx)$/, '');
            return `
          console.log('Importing ${jsFile.fileName}...');
          import * as ${moduleName.replace(/[^a-zA-Z0-9]/g, '_')} from './${moduleName}';
          
          // Make all exports available globally for tests
          Object.entries(${moduleName.replace(/[^a-zA-Z0-9]/g, '_')}).forEach(([key, value]) => {
            window[key] = value;
            console.log(\`Exported \${key} to window\`);
          });
            `;
          }).join('\n')}
          
          // After all modules are loaded, run tests
          window.addEventListener('load', () => {
            // Signal that modules are loaded
            window.modulesLoaded = true;
            console.log('All modules loaded, ready for tests');
          });
        </script>
        
        <script>
          // Wait for modules to load, then execute test files
          ${jsFiles.some(f => f.fileName.startsWith('tests.')) ? `
            // Wait for modules to be loaded
            function waitForModules() {
              if (window.modulesLoaded) {
                runTests();
              } else {
                setTimeout(waitForModules, 100);
              }
            }
            
            function runTests() {
              try {
                // Load test files (no versions, just single test suite)
                ${jsFiles.filter(f => f.fileName.startsWith('tests.')).map(f => {
                  return `
                    const testFile = window.files.find(file => file.fileName === '${f.fileName}');
                    
                    if (testFile) {
                      try {
                        // Use the single test content (no versions)
                        const testCode = window.fileContents['${f.fileName}'] || testFile.content;
                        console.log('Executing test file ${f.fileName}');
                        
                        // Debug what variables are available before tests
                        console.log('Before tests - checking available variables on window:');
                        const availableVars = [];
                        if (window.userName !== undefined) availableVars.push('userName=' + JSON.stringify(window.userName));
                        if (window.currentStreak !== undefined) availableVars.push('currentStreak=' + window.currentStreak);
                        if (window.MAX_HABITS !== undefined) availableVars.push('MAX_HABITS=' + window.MAX_HABITS);
                        if (window.habit !== undefined) availableVars.push('habit=' + JSON.stringify(window.habit));
                        if (window.habitStatus !== undefined) availableVars.push('habitStatus=' + JSON.stringify(window.habitStatus));
                        if (window.totalPoints !== undefined) availableVars.push('totalPoints=' + window.totalPoints);
                        if (window.currentStreakInput !== undefined) availableVars.push('currentStreakInput=' + JSON.stringify(window.currentStreakInput));
                        if (window.bonusPoints !== undefined) availableVars.push('bonusPoints=' + window.bonusPoints);
                        if (window.calculateHabitPoints !== undefined) availableVars.push('calculateHabitPoints=function');
                        console.log('Available variables for tests:', availableVars.length > 0 ? availableVars.join(', ') : 'NONE');
                        
                        // Create a wrapper that imports variables from window
                        const windowVars = ['userName', 'currentStreak', 'MAX_HABITS', 'habit', 'habitStatus', 
                                          'totalPoints', 'currentStreakInput', 'bonusPoints', 'calculateHabitPoints'];
                        const availableWindowVars = windowVars.filter(v => window[v] !== undefined);
                        
                        const testWrapper = availableWindowVars.length > 0 
                          ? \`// Import all window variables for test access
const { \${availableWindowVars.join(', ')} } = window;

\${testCode}\`
                          : testCode;
                        
                        // Execute test code with eval to access global variables
                        // Add sourceURL for better debugging
                        eval(testWrapper + '\\n//# sourceURL=${f.fileName}');
                      } catch (evalError) {
                        console.error('Error evaluating test file ${f.fileName}:', evalError);
                      }
                    }
                  `;
                }).join('\n')}
                
                const runner = mocha.run();
                
                runner.on('end', () => {
                  try {
                    const testResults = [];
                    
                    // Get all tests from the runner
                    const allTests = [];
                    
                    // Recursively collect all tests from suites
                    function collectTests(suite) {
                      // Add tests from this suite
                      suite.tests.forEach(test => {
                        allTests.push(test);
                      });
                      
                      // Recursively collect from child suites
                      suite.suites.forEach(childSuite => {
                        collectTests(childSuite);
                      });
                    }
                    
                    // Start from the root suite
                    collectTests(runner.suite);
                    
                    // Process all collected tests
                    allTests.forEach(test => {
                      console.log(\`Test: \${test.title}, State: \${test.state}, Passed: \${test.state === 'passed'}\`);
                      testResults.push({
                        passed: test.state === 'passed',
                        description: test.title,
                        error: test.err ? (test.err.message || test.err.toString()) : undefined
                      });
                    });
                    
                    // Send formatted results
                    window.parent.postMessage({
                      type: 'testResults',
                      results: testResults
                    }, '*');
                    
                  } catch (parseError) {
                    console.error('Error parsing test results:', parseError);
                    window.parent.postMessage({
                      type: 'testResults',
                      results: [{
                        passed: false,
                        description: 'Error parsing test results',
                        error: parseError.message
                      }]
                    }, '*');
                  }
                });
              } catch (error) {
                console.error('Test execution error:', error);
                window.parent.postMessage({
                  type: 'testResults',
                  results: [{
                    passed: false,
                    description: 'Test execution failed',
                    error: error.message || error.toString()
                  }]
                }, '*');
              }
            }
            
            // Start waiting for modules to load
            waitForModules();
          ` : ''}
        </script>
      `;
      
      htmlContent = htmlContent.replace('</body>', `${scriptTags}</body>`);
      
      // Message handler
      const messageHandler = (event: MessageEvent) => {
        if (event.data.type === 'console') {
          // Ensure args is an array and all items are strings
          const args = event.data.args || [];
          const safeArgs = args.map((arg: any) => {
            const result = typeof arg === 'string' ? arg : String(arg);
            return result;
          });
          addConsoleOutput(event.data.method, safeArgs.join(' '));
        } else if (event.data.type === 'testResults') {
          event.data.results.forEach((result: TestResult) => {
            addTestResult(result);
          });
          // Don't automatically switch tabs - let the user control what they want to see
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Update iframe - force reload by clearing first
      if (iframeRef.current) {
        // Clear the iframe first to ensure a clean reload
        iframeRef.current.srcdoc = '';
        // Use setTimeout to ensure the clear happens before setting new content
        setTimeout(() => {
          if (iframeRef.current) {
            iframeRef.current.srcdoc = htmlContent;
          }
        }, 10);
      }
      
      // Update preview iframe
      if (previewIframeRef.current && hasHtmlFiles) {
        previewIframeRef.current.srcdoc = '';
        setTimeout(() => {
          if (previewIframeRef.current) {
            previewIframeRef.current.srcdoc = htmlContent;
          }
        }, 10);
      }
      
      // Cleanup
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        setIsRunning(false);
        // Clean up blob URLs
        Object.values(moduleUrls).forEach(url => {
          if (typeof url === 'string' && url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        });
      }, 2000);
      
    } catch (error: any) {
      addConsoleOutput('error', `Runtime error: ${error.message}`);
      setIsRunning(false);
    }
  }, [fileContents, files]);

  // Removed auto-run - users must click Run button to execute tests

  // Remove the complex model management - let the Editor component handle it

  // Configure TypeScript compiler options and themes
  useEffect(() => {
    if (monaco) {
      // Intercept Monaco's context menu styling
      const originalCreateContextView = (window as any).monaco?.contextview?.createContextView;
      if (originalCreateContextView) {
        (window as any).monaco.contextview.createContextView = function(...args: any[]) {
          const result = originalCreateContextView.apply(this, args);
          
          // Force background on context menus after creation
          setTimeout(() => {
            document.querySelectorAll('.context-view, .monaco-menu-container, .monaco-menu').forEach((el: Element) => {
              if (el instanceof HTMLElement) {
                el.style.backgroundColor = currentTheme === 'solarized-dark' ? '#073642' : '#eee8d5';
                el.style.opacity = '1';
                
                // Apply to all children
                el.querySelectorAll('*').forEach((child: Element) => {
                  if (child instanceof HTMLElement) {
                    child.style.backgroundColor = 'inherit';
                  }
                });
              }
            });
          }, 0);
          
          return result;
        };
      }
      // Load themes from monaco-themes package
      Promise.all([
        import('monaco-themes/themes/Solarized-dark.json'),
        import('monaco-themes/themes/Solarized-light.json')
      ]).then(([darkTheme, lightTheme]) => {
        // Define themes with proper typing
        monaco.editor.defineTheme('solarized-dark', darkTheme as any);
        monaco.editor.defineTheme('solarized-light', lightTheme as any);
        // Set the current theme
        monaco.editor.setTheme(currentTheme);
      });
      
      // Configure both TypeScript and TypeScript React
      const tsConfig = {
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        allowJs: true,
        typeRoots: ['node_modules/@types']
      };
      
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsConfig);
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsConfig);

      // Add React types to both TypeScript and JavaScript
      const reactTypes = `
        declare module 'react' {
          export = React;
        }
        declare const React: any;
        declare const ReactDOM: any;
        declare const expect: any;
        declare const assert: any;
        declare const sinon: any;
        declare function describe(description: string, fn: () => void): void;
        declare function it(description: string, fn: () => void): void;
        declare function getCSSRules(): CSSRule[];
        declare function getCSSAST(): string;
        declare function parseCSS(cssText: string): Array<{
          selector: string;
          declarations: Record<string, string>;
        }>;
        declare function getComputedStyles(selector: string): CSSStyleDeclaration | null;
      `;
      
      monaco.languages.typescript.typescriptDefaults.addExtraLib(reactTypes, 'global.d.ts');
      monaco.languages.typescript.javascriptDefaults.addExtraLib(reactTypes, 'global.d.ts');
    }
  }, [monaco, currentTheme]);

  // Update theme when currentTheme changes
  useEffect(() => {
    if (monaco && currentTheme) {
      // Ensure themes are defined before setting
      Promise.all([
        import('monaco-themes/themes/Solarized-dark.json'),
        import('monaco-themes/themes/Solarized-light.json')
      ]).then(([darkTheme, lightTheme]) => {
        // Re-define themes to ensure they're available
        monaco.editor.defineTheme('solarized-dark', darkTheme as any);
        monaco.editor.defineTheme('solarized-light', lightTheme as any);
        // Set the current theme
        monaco.editor.setTheme(currentTheme);
      });
    }
  }, [monaco, currentTheme]);

  // Handle no files case
  if (files.length === 0) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        color: themeColors.muted,
        backgroundColor: themeColors.background,
        borderRadius: '4px',
        height: height 
      }}>
        No code files to display
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="multi-file-code-display" 
      style={{ 
        width: '100%', 
        height: height, 
        display: 'flex', 
        flexDirection: 'column', 
        backgroundColor: themeColors.background,
        position: 'relative'
      }}>
      <div className="editor-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, backgroundColor: themeColors.background }}>
        {/* File tabs */}
        <div className="file-tabs" style={{ 
          display: 'flex', 
          backgroundColor: themeColors.background, 
          borderBottom: `1px solid ${themeColors.border}`,
          minHeight: '35px'
        }}>
          {files.map((file, index) => {
            // Debug file object
            if (!file || typeof file !== 'object') {
              console.error('[MultiFileCodeDisplay] Invalid file object:', file);
              return null;
            }
            return (
            <button
              key={file.fileName || `file-${index}`}
              className={`file-tab ${index === currentFileIndex ? 'active' : ''}`}
              onClick={() => setCurrentFileIndex(index)}
              style={{
                padding: '8px 16px',
                backgroundColor: index === currentFileIndex ? themeColors.backgroundSecondary : 'transparent',
                color: index === currentFileIndex ? themeColors.foreground : themeColors.muted,
                border: 'none',
                borderRight: '1px solid #333',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}
            >
              {file.fileName || 'Untitled'}
            </button>
            );
          })}
          <div style={{ flex: 1 }} />
          
          {/* Reset button */}
          <button
            onClick={() => {
              if (currentFile && confirm('Reset to original exercise content? This will clear your current work.')) {
                const originalContent = currentFile.versions?.[0] || currentFile.content || '';
                setScratchPadContents(prev => ({
                  ...prev,
                  [currentFile.fileName]: originalContent
                }));
                // Clear from localStorage
                localStorage.removeItem(getStorageKey(currentFile.fileName));
                // Update the editor
                if (editorRef.current) {
                  editorRef.current.setValue(originalContent);
                }
              }
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: themeColors.error,
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              marginRight: '10px',
              borderRadius: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
          >
            Reset
          </button>
          
          <button
            className="run-button"
            onClick={runCode}
            disabled={isRunning}
            style={{
              padding: '8px 16px',
              backgroundColor: themeColors.success,
              color: 'white',
              border: 'none',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 'bold'
            }}
          >
            {isRunning ? 'Running...' : 'Run'}
          </button>
          
          <button
            onClick={() => {
              const newTheme = currentTheme === 'solarized-dark' ? 'solarized-light' : 'solarized-dark';
              setCurrentTheme(newTheme);
              localStorage.setItem('ctp-editor-theme', newTheme);
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: currentTheme === 'solarized-dark' ? '#fdf6e3' : '#002b36',
              color: currentTheme === 'solarized-dark' ? '#657b83' : '#839496',
              border: '1px solid ' + (currentTheme === 'solarized-dark' ? '#93a1a1' : '#586e75'),
              cursor: 'pointer',
              fontSize: '12px',
              borderRadius: '4px',
              marginLeft: 'auto'
            }}
          >
            {currentTheme === 'solarized-dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
        
        {/* Editor and output area */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Code editor */}
          <div style={{ 
            flex: isPaneExpanded ? '0 0 0%' : isPaneCollapsed ? '1 1 100%' : `0 0 ${100 - paneHeight}%`,
            borderBottom: !isPaneCollapsed ? `1px solid ${themeColors.border}` : 'none',
            position: 'relative',
            minHeight: 0,
            backgroundColor: themeColors.background,
            transition: isResizing ? 'none' : 'flex 0.3s ease'
          }}>
            {isSlideActive ? (
              <Editor
                key={`editor-${currentTheme}-${currentFile?.fileName || 'default'}-${currentFileIndex}`}
                height="100%"
                language={currentFile ? getLanguageForFile(currentFile.fileName) : 'javascript'}
                value={currentContent}
                theme={currentTheme}
                onChange={handleEditorChange}
                options={{
                  ...options,
                  readOnly,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  automaticLayout: true,
                  fixedOverflowWidgets: true,
                  overflowWidgetsDomNode: document.body,
                  hover: {
                    enabled: true,
                    delay: 300,
                    sticky: true
                  },
                  quickSuggestions: true,
                  suggestOnTriggerCharacters: true,
                  parameterHints: {
                    enabled: true
                  }
                }}
                onMount={(editor) => {
                  // Only set the editor reference if the slide is still active
                  if (isSlideActive) {
                    editorRef.current = editor;
                    
                    // Add custom CSS for Solarized themes
                    const existingStyle = document.getElementById('monaco-theme-overrides');
                    if (existingStyle) {
                      existingStyle.remove();
                    }
                    
                    const style = document.createElement('style');
                    style.id = 'monaco-theme-overrides';
                    style.innerHTML = `
                      /* Solarized Dark hover widget styles */
                      .monaco-editor[data-theme="solarized-dark"] .monaco-hover,
                      .monaco-editor[data-theme="solarized-dark"] .monaco-editor-hover,
                      .monaco-editor[data-theme="solarized-dark"] .monaco-hover-content {
                        background-color: #073642 !important;
                        border: 1px solid #586e75 !important;
                        color: #839496 !important;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5) !important;
                      }
                      
                      /* Solarized Light hover widget styles */
                      .monaco-editor[data-theme="solarized-light"] .monaco-hover,
                      .monaco-editor[data-theme="solarized-light"] .monaco-editor-hover,
                      .monaco-editor[data-theme="solarized-light"] .monaco-hover-content {
                        background-color: #eee8d5 !important;
                        border: 1px solid #93a1a1 !important;
                        color: #657b83 !important;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
                      }
                      
                      .monaco-editor .monaco-hover .hover-contents,
                      .monaco-editor .monaco-hover .hover-row,
                      .monaco-editor .monaco-hover .hover-row.status-bar,
                      .monaco-editor-hover .hover-contents {
                        background-color: #252526 !important;
                        color: #cccccc !important;
                      }
                      
                      /* Suggest widget styles */
                      .monaco-editor .suggest-widget,
                      .monaco-editor .suggest-details {
                        background-color: #252526 !important;
                        border: 1px solid #454545 !important;
                        color: #cccccc !important;
                      }
                      
                      .monaco-editor .suggest-widget .monaco-list-row,
                      .monaco-editor .suggest-details .monaco-list-row {
                        background-color: transparent !important;
                        color: #cccccc !important;
                      }
                      
                      .monaco-editor .suggest-widget .monaco-list-row.focused,
                      .monaco-editor .suggest-widget .monaco-list-row:hover {
                        background-color: #094771 !important;
                      }
                      
                      /* Parameter hints */
                      .monaco-editor .parameter-hints-widget {
                        background-color: #252526 !important;
                        border: 1px solid #454545 !important;
                        color: #cccccc !important;
                      }
                      
                      .monaco-editor .parameter-hints-widget .signature {
                        background-color: #252526 !important;
                      }
                      
                      /* Ensure all editor widgets have proper backgrounds */
                      .monaco-editor .monaco-editor-overlaymessage,
                      .monaco-editor-background,
                      .monaco-editor .inputarea.ime-input {
                        background-color: #252526 !important;
                      }
                      .monaco-editor .suggest-widget {
                        background-color: #252526 !important;
                        border: 1px solid #454545 !important;
                        color: #cccccc !important;
                      }
                      .monaco-editor .monaco-list-row {
                        color: #cccccc !important;
                      }
                      .monaco-editor .monaco-list-row.focused {
                        background-color: #094771 !important;
                        color: #ffffff !important;
                      }
                      .monaco-editor-overlaymessage {
                        background-color: #252526 !important;
                        border: 1px solid #454545 !important;
                      }
                      .monaco-tooltip {
                        background-color: #252526 !important;
                        border: 1px solid #454545 !important;
                        color: #cccccc !important;
                      }
                      
                      /* Global Monaco styles for current theme */
                      ${currentTheme === 'solarized-dark' ? `
                        .monaco-hover,
                        .monaco-editor-hover,
                        .monaco-hover-content {
                          background-color: #073642 !important;
                          border: 1px solid #586e75 !important;
                          color: #839496 !important;
                        }
                        
                        .monaco-menu,
                        .context-view.monaco-menu-container {
                          background-color: #073642 !important;
                          border: 1px solid #586e75 !important;
                          color: #839496 !important;
                        }
                        
                        .monaco-menu .monaco-action-bar {
                          background-color: #073642 !important;
                        }
                        
                        .monaco-menu .action-label {
                          color: #839496 !important;
                        }
                        
                        .monaco-menu .action-item:hover {
                          background-color: #586e75 !important;
                        }
                      ` : `
                        .monaco-hover,
                        .monaco-editor-hover,
                        .monaco-hover-content {
                          background-color: #eee8d5 !important;
                          border: 1px solid #93a1a1 !important;
                          color: #657b83 !important;
                        }
                        
                        .monaco-menu,
                        .context-view.monaco-menu-container {
                          background-color: #eee8d5 !important;
                          border: 1px solid #93a1a1 !important;
                          color: #657b83 !important;
                        }
                        
                        .monaco-menu .monaco-action-bar {
                          background-color: #eee8d5 !important;
                        }
                        
                        .monaco-menu .action-label {
                          color: #657b83 !important;
                        }
                        
                        .monaco-menu .action-item:hover {
                          background-color: #93a1a1 !important;
                          color: #002b36 !important;
                        }
                      `}
                    `;
                    document.head.appendChild(style);
                  }
                }}
              />
            ) : (
              <div 
                style={{
                  height: '100%',
                  backgroundColor: themeColors.background,
                  border: `1px solid ${themeColors.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: themeColors.muted,
                  fontFamily: 'monospace',
                  fontSize: '14px'
                }}
              >
                Code editor will load when slide is active...
              </div>
            )}
          </div>
          
          {/* Resize handle */}
          {!isPaneCollapsed && !isPaneExpanded && (
            <div
              onMouseDown={handleMouseDown}
              style={{
                height: '4px',
                backgroundColor: themeColors.border,
                cursor: 'ns-resize',
                position: 'relative',
                transition: 'background-color 0.2s',
                '&:hover': {
                  backgroundColor: themeColors.info
                }
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = themeColors.info}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = themeColors.border}
            />
          )}
          
          {/* Output panel */}
          <div style={{ 
            flex: isPaneExpanded ? '1 1 100%' : isPaneCollapsed ? '0 0 0%' : `1 1 ${paneHeight}%`,
            display: isPaneCollapsed ? 'none' : 'flex',
            flexDirection: 'column',
            minHeight: 0,
            transition: isResizing ? 'none' : 'flex 0.3s ease'
          }}>
            {/* Output tabs */}
            <div style={{ 
              display: 'flex', 
              backgroundColor: themeColors.backgroundSecondary, 
              borderBottom: '1px solid #333',
              position: 'relative'
            }}>
              {hasHtmlFiles && (
                <button
                  onClick={() => setActiveTab('preview')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: activeTab === 'preview' ? themeColors.backgroundSecondary : 'transparent',
                    color: activeTab === 'preview' ? themeColors.foreground : themeColors.muted,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Preview
                </button>
              )}
              <button
                onClick={() => setActiveTab('console')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: activeTab === 'console' ? themeColors.backgroundSecondary : 'transparent',
                  color: activeTab === 'console' ? themeColors.foreground : themeColors.muted,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Console
              </button>
              <button
                onClick={() => setActiveTab('tests')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: activeTab === 'tests' ? themeColors.backgroundSecondary : 'transparent',
                  color: activeTab === 'tests' ? themeColors.foreground : themeColors.muted,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Tests {testResults.length > 0 && `(${testResults.filter(r => r.passed).length}/${testResults.length})`}
              </button>
              {currentFile && currentFile.versions && currentFile.versions.length > 1 && (
                <button
                  onClick={() => setActiveTab('diff')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: activeTab === 'diff' ? themeColors.backgroundSecondary : 'transparent',
                    color: activeTab === 'diff' ? themeColors.foreground : themeColors.muted,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Solutions
                </button>
              )}
              
              {/* Collapse/Expand controls */}
              <div style={{ 
                marginLeft: 'auto', 
                display: 'flex', 
                gap: '4px',
                paddingRight: '8px'
              }}>
                <button
                  onClick={() => {
                    setIsPaneCollapsed(!isPaneCollapsed);
                    if (isPaneExpanded) setIsPaneExpanded(false);
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'transparent',
                    color: themeColors.foreground,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    opacity: 0.7,
                    transition: 'opacity 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                  title={isPaneCollapsed ? 'Show output panel' : 'Hide output panel'}
                >
                  {isPaneCollapsed ? '▲' : '▼'}
                </button>
                <button
                  onClick={() => {
                    setIsPaneExpanded(!isPaneExpanded);
                    if (isPaneCollapsed) setIsPaneCollapsed(false);
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'transparent',
                    color: themeColors.foreground,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    opacity: 0.7,
                    transition: 'opacity 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                  title={isPaneExpanded ? 'Restore panel size' : 'Maximize output panel'}
                >
                  {isPaneExpanded ? '⊟' : '⊞'}
                </button>
              </div>
            </div>
            
            {/* Output content */}
            <div style={{ 
              flex: 1, 
              backgroundColor: themeColors.background, 
              padding: activeTab === 'preview' ? '0' : '10px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}>
              {/* Preview pane - always mounted but hidden when not active */}
              {hasHtmlFiles && (
                <div style={{ 
                  display: activeTab === 'preview' ? 'flex' : 'none',
                  flexDirection: 'column',
                  height: '100%'
                }}>
                  {/* Responsive controls */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                    backgroundColor: themeColors.backgroundSecondary,
                    borderBottom: `1px solid ${themeColors.border}`
                  }}>
                    {/* Device preset buttons */}
                    {Object.entries(devicePresets).slice(0, 3).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setPreviewDevice(key as typeof previewDevice);
                          setPreviewWidth(preset.width);
                        }}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: previewDevice === key ? themeColors.info : 'transparent',
                          color: previewDevice === key ? 'white' : themeColors.foreground,
                          border: `1px solid ${previewDevice === key ? themeColors.info : themeColors.border}`,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span>{preset.icon}</span>
                        <span>{preset.label}</span>
                      </button>
                    ))}
                    
                    {/* Custom width input */}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: themeColors.muted }}>Width:</span>
                      <input
                        type="text"
                        value={previewDevice === 'custom' ? previewWidth : devicePresets[previewDevice].width}
                        onChange={(e) => {
                          setPreviewDevice('custom');
                          setPreviewWidth(e.target.value);
                        }}
                        style={{
                          width: '80px',
                          padding: '4px 8px',
                          backgroundColor: themeColors.background,
                          color: themeColors.foreground,
                          border: `1px solid ${themeColors.border}`,
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                        placeholder="e.g., 480px"
                      />
                      
                      {/* Rotate orientation button */}
                      <button
                        onClick={() => {
                          setIsRotated(!isRotated);
                        }}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: 'transparent',
                          color: themeColors.foreground,
                          border: `1px solid ${themeColors.border}`,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          transition: 'transform 0.2s'
                        }}
                        title="Rotate device"
                      >
                        🔄
                      </button>
                    </div>
                  </div>
                  
                  {/* Preview iframe container */}
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    padding: '40px',
                    backgroundColor: '#e0e0e0',
                    overflow: 'auto'
                  }}>
                    <div style={{
                      width: previewDevice === 'desktop' ? '768px' : 
                            previewDevice === 'tablet' ? (isRotated ? '716.8px' : '537.6px') :
                            previewDevice === 'mobile' ? (isRotated ? '649.6px' : '300px') : '100%',
                      height: previewDevice === 'desktop' ? '432px' : 
                             previewDevice === 'tablet' ? (isRotated ? '537.6px' : '716.8px') :
                             previewDevice === 'mobile' ? (isRotated ? '300px' : '649.6px') : 'auto',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      position: 'relative'
                    }}>
                      <div style={{
                        width: previewDevice === 'custom' ? previewWidth : 
                              previewDevice === 'desktop' ? '1280px' : 
                              previewDevice === 'mobile' ? (isRotated ? '812px' : '375px') :
                              previewDevice === 'tablet' ? (isRotated ? '1024px' : '768px') : 
                              devicePresets[previewDevice].width,
                        height: previewDevice === 'mobile' ? (isRotated ? '375px' : '812px') : 
                               previewDevice === 'tablet' ? (isRotated ? '768px' : '1024px') : 
                               previewDevice === 'desktop' ? '720px' : '100%',
                        maxHeight: 'none',
                        backgroundColor: currentTheme === 'solarized-dark' ? '#1a1a1a' : '#2d2d2d',
                        boxShadow: '0 0 40px rgba(0, 0, 0, 0.3)',
                        position: 'relative',
                        borderRadius: previewDevice === 'mobile' ? '36px' : 
                                     previewDevice === 'tablet' ? '18px' : 
                                     previewDevice === 'desktop' ? '8px' : '0',
                        padding: previewDevice === 'mobile' ? '12px' : 
                                previewDevice === 'tablet' ? '24px' : 
                                previewDevice === 'desktop' ? '3px' : '0',
                        display: 'flex',
                        flexDirection: 'column',
                        marginBottom: previewDevice === 'desktop' ? '60px' : '0',
                        transform: previewDevice === 'desktop' ? 'scale(0.6)' : 
                                  previewDevice === 'tablet' ? 'scale(0.7)' :
                                  previewDevice === 'mobile' ? 'scale(0.8)' : 'none',
                        transformOrigin: 'top center'
                      }}>
                      {/* Device frame decorations */}
                      {previewDevice === 'mobile' && (
                        <>
                          {/* Notch */}
                          <div style={{
                            position: 'absolute',
                            top: '12px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '120px',
                            height: '24px',
                            backgroundColor: currentTheme === 'solarized-dark' ? '#1a1a1a' : '#2d2d2d',
                            borderRadius: '0 0 20px 20px',
                            zIndex: 2
                          }} />
                          {/* Home indicator */}
                          <div style={{
                            position: 'absolute',
                            bottom: '8px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '100px',
                            height: '4px',
                            backgroundColor: currentTheme === 'solarized-dark' ? '#4a4a4a' : '#666',
                            borderRadius: '2px',
                            zIndex: 2
                          }} />
                        </>
                      )}
                      
                      {previewDevice === 'tablet' && (
                        <>
                          {/* Camera */}
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '8px',
                            height: '8px',
                            backgroundColor: currentTheme === 'solarized-dark' ? '#4a4a4a' : '#666',
                            borderRadius: '50%',
                            zIndex: 2
                          }} />
                        </>
                      )}
                      
                      {previewDevice === 'desktop' && (
                        <>
                          {/* Stand/Base */}
                          <div style={{
                            position: 'absolute',
                            bottom: '-40px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '200px',
                            height: '40px',
                            backgroundColor: currentTheme === 'solarized-dark' ? '#4a4a4a' : '#666',
                            clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)'
                          }} />
                          <div style={{
                            position: 'absolute',
                            bottom: '-50px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '300px',
                            height: '10px',
                            backgroundColor: currentTheme === 'solarized-dark' ? '#4a4a4a' : '#666',
                            borderRadius: '5px'
                          }} />
                        </>
                      )}
                      
                      {/* Screen container */}
                      <div style={{
                        flex: 1,
                        borderRadius: previewDevice === 'mobile' ? '24px' : 
                                     previewDevice === 'tablet' ? '8px' : '4px',
                        overflow: 'hidden',
                        backgroundColor: 'white',
                        position: 'relative'
                      }}>
                        <iframe
                          ref={previewIframeRef}
                          style={{
                            width: '100%',
                            height: '100%',
                            border: 'none',
                            backgroundColor: 'white'
                          }}
                          sandbox="allow-scripts allow-same-origin"
                          title="HTML Preview"
                        />
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Console pane - always mounted but hidden when not active */}
              <div style={{ display: activeTab === 'console' ? 'block' : 'none', height: '100%' }}>
                <div className="console-output" style={{ 
                  flex: 1, 
                  overflowY: 'auto',
                  overflowX: 'hidden'
                }}>
                  {consoleOutput.length === 0 ? (
                    <div style={{ color: '#666', fontStyle: 'italic' }}>
                      Click Run to execute code
                    </div>
                  ) : (
                    consoleOutput.map((output, index) => (
                      <div
                        key={index}
                        style={{
                          color: output.type === 'error' ? '#ff6b6b' : 
                                 output.type === 'warn' ? '#ffd93d' : 
                                 output.type === 'info' ? '#6bcfff' : '#ccc',
                          marginBottom: '4px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                      >
                        {String(output.message || '')}
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Tests pane - always mounted but hidden when not active */}
              <div style={{ display: activeTab === 'tests' ? 'block' : 'none', height: '100%' }}>
                <div className="test-results" style={{ 
                  flex: 1, 
                  overflowY: 'auto',
                  overflowX: 'hidden'
                }}>
                  {testResults.length === 0 ? (
                    <div style={{ color: '#666', fontStyle: 'italic' }}>
                      No tests to run
                    </div>
                  ) : (
                    testResults.map((result, index) => (
                      <div
                        key={index}
                        style={{
                          marginBottom: '8px',
                          padding: '8px',
                          backgroundColor: result.passed ? '#1e3a1e' : '#3a1e1e',
                          borderRadius: '4px',
                          border: `1px solid ${result.passed ? '#4caf50' : '#f44336'}`
                        }}
                      >
                        <div style={{ 
                          color: result.passed ? '#4caf50' : '#f44336',
                          fontWeight: 'bold',
                          marginBottom: result.error ? '4px' : '0'
                        }}>
                          {result.passed ? '✓' : '✗'} {String(result.description)}
                        </div>
                        {result.error && (
                          <div style={{ 
                            color: '#ff9999', 
                            fontSize: '11px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}>
                            {String(result.error)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Diff pane - conditionally rendered since it depends on current file */}
              {currentFile && currentFile.versions && currentFile.versions.length > 1 && (
                <div style={{ 
                  height: '100%', 
                  display: activeTab === 'diff' ? 'flex' : 'none', 
                  flexDirection: 'column' 
                }}>
                  {/* Solution version selector */}
                  <div style={{ 
                    padding: '10px', 
                    borderBottom: `1px solid ${themeColors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <span style={{ color: '#ccc', fontSize: '12px' }}>Compare with:</span>
                    <select
                      value={selectedSolutionVersion}
                      onChange={(e) => setSelectedSolutionVersion(Number(e.target.value))}
                      style={{
                        backgroundColor: '#2d2d2d',
                        color: '#ccc',
                        border: '1px solid #444',
                        padding: '4px 8px',
                        fontSize: '12px',
                        borderRadius: '4px'
                      }}
                    >
                      {currentFile.versions.slice(1).map((_, index) => (
                        <option key={index + 1} value={index + 1}>
                          Solution Step {index + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Diff editor */}
                  <div style={{ flex: 1 }}>
                    <DiffEditor
                      height="100%"
                      language={currentFile ? getLanguageForFile(currentFile.fileName) : 'javascript'}
                      original={currentFile ? (scratchPadContents[currentFile.fileName] || '') : ''}
                      modified={currentFile && currentFile.versions ? (currentFile.versions[selectedSolutionVersion] || '') : ''}
                      theme={currentTheme}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 14,
                        renderSideBySide: true,
                        originalEditable: false,
                        automaticLayout: true
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Collapsed panel indicator */}
        {isPaneCollapsed && (
          <div
            onClick={() => setIsPaneCollapsed(false)}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '24px',
              backgroundColor: themeColors.backgroundSecondary,
              borderTop: `1px solid ${themeColors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '12px',
              color: themeColors.muted,
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = themeColors.border;
              e.currentTarget.style.color = themeColors.foreground;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = themeColors.backgroundSecondary;
              e.currentTarget.style.color = themeColors.muted;
            }}
          >
            ▲ Output Panel (click to show)
          </div>
        )}
      </div>
      
      {/* Hidden iframe */}
      <iframe
        ref={iframeRef}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          left: '-1000px',
          top: '-1000px',
          border: 'none'
        }}
        sandbox="allow-scripts allow-same-origin"
        title="Code execution sandbox"
      />
    </div>
  );
});

MultiFileCodeDisplay.displayName = 'MultiFileCodeDisplay';

export default MultiFileCodeDisplay;