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
  height = "400px",
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
  
  // Update global Monaco styles when theme changes
  useEffect(() => {
    const existingStyle = document.getElementById('monaco-theme-overrides');
    if (existingStyle) {
      existingStyle.remove();
    }
    
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
  const modelsRef = useRef<Map<string, any>>(new Map());
  
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

  // Dispose models when component unmounts
  useEffect(() => {
    return () => {
      // Clear editor reference first to prevent further operations
      editorRef.current = null;
      
      if (monaco) {
        try {
          // Test if Monaco is still working before disposing models
          monaco.languages.getLanguages();
          
          modelsRef.current.forEach(model => {
            try {
              // Check if the model is still valid before disposing
              if (model && typeof model.dispose === 'function') {
                model.dispose();
              }
            } catch (e) {
              console.warn('Error disposing model:', e);
            }
          });
          modelsRef.current.clear();
        } catch (e) {
          console.warn('Monaco appears to be already disposed, skipping model cleanup');
          // Just clear the references
          modelsRef.current.clear();
        }
      }
    };
  }, [monaco, currentTheme]);

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

  const runCode = useCallback(async () => {
    setIsRunning(true);
    clearConsole();
    setActiveTab(hasHtmlFiles ? 'preview' : 'console');
    
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
        // Use scratch pad content for all files
        const content = scratchPadContents[jsFile.fileName] || fileContents[jsFile.fileName] || '';
        let compiled = content;
        
        if (jsFile.language === 'typescript' || jsFile.language === 'tsx') {
          compiled = compileTypeScript(content, jsFile.fileName);
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
          
          // Configure Mocha with JSON reporter
          mocha.setup({ ui: 'bdd', reporter: 'json' });
          
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
        <script>
          // Execute non-test files in global scope first
          ${jsFiles.filter(f => !f.fileName.startsWith('tests.')).map(jsFile => {
            return `
              // Execute ${jsFile.fileName} in global scope
              console.log('Executing ${jsFile.fileName}...');
              try {
                // Use scratch pad content
                const content = window.scratchPadContents['${jsFile.fileName}'] || window.fileContents['${jsFile.fileName}'] || '';
                console.log('Content source:', window.scratchPadContents['${jsFile.fileName}'] ? 'scratch pad' : 'original file');
                console.log('Content length:', content.length);
                
                // Execute using Function constructor with sourceURL for better debugging
                const executeCode = new Function(content + '\\n//# sourceURL=${jsFile.fileName}');
                executeCode.call(window);
                
                // Log what variables were created
                const createdVars = [];
                if (typeof userName !== 'undefined') createdVars.push('userName=' + JSON.stringify(userName));
                if (typeof currentStreak !== 'undefined') createdVars.push('currentStreak=' + currentStreak);
                if (typeof MAX_HABITS !== 'undefined') createdVars.push('MAX_HABITS=' + MAX_HABITS);
                if (typeof habit !== 'undefined') createdVars.push('habit=' + JSON.stringify(habit));
                if (typeof habitStatus !== 'undefined') createdVars.push('habitStatus=' + JSON.stringify(habitStatus));
                if (typeof blockStatus !== 'undefined') createdVars.push('blockStatus=' + JSON.stringify(blockStatus));
                if (typeof globalStatus !== 'undefined') createdVars.push('globalStatus=' + JSON.stringify(globalStatus));
                if (typeof calculateHabitPoints !== 'undefined') createdVars.push('calculateHabitPoints=function');
                
                if (createdVars.length > 0) {
                  console.log('Created variables:', createdVars.join(', '));
                }
                
                console.log('Finished executing ${jsFile.fileName}');
              } catch (e) {
                console.error('Error executing ${jsFile.fileName}:', e.message);
              }
            `;
          }).join('\n')}
        </script>
        
        <script type="module">
          // Import modules that need module features (React components, etc)
          ${jsFiles.filter(f => !f.fileName.startsWith('tests.')).map(jsFile => {
            // Only import files that actually use imports/exports
            if (jsFile.fileName.includes('app') || jsFile.fileName.includes('main') || jsFile.fileName === 'index.js') {
              const content = fileContents[jsFile.fileName] || '';
              if (content.includes('import ') || content.includes('export ')) {
                return `import './${jsFile.fileName}';`;
              }
            }
            return '';
          }).filter(Boolean).join('\n')}
          
          // Execute test files after a delay
          ${jsFiles.some(f => f.fileName.startsWith('tests.')) ? `
            setTimeout(async () => {
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
                        console.log('Before tests - checking available variables:');
                        const availableVars = [];
                        if (typeof userName !== 'undefined') availableVars.push('userName=' + JSON.stringify(userName));
                        if (typeof currentStreak !== 'undefined') availableVars.push('currentStreak=' + currentStreak);
                        if (typeof MAX_HABITS !== 'undefined') availableVars.push('MAX_HABITS=' + MAX_HABITS);
                        if (typeof habit !== 'undefined') availableVars.push('habit=' + JSON.stringify(habit));
                        if (typeof habitStatus !== 'undefined') availableVars.push('habitStatus=' + JSON.stringify(habitStatus));
                        if (typeof blockStatus !== 'undefined') availableVars.push('blockStatus=' + JSON.stringify(blockStatus));
                        if (typeof globalStatus !== 'undefined') availableVars.push('globalStatus=' + JSON.stringify(globalStatus));
                        if (typeof totalPoints !== 'undefined') availableVars.push('totalPoints=' + JSON.stringify(totalPoints));
                        if (typeof currentStreakInput !== 'undefined') availableVars.push('currentStreakInput=' + JSON.stringify(currentStreakInput));
                        if (typeof bonusPoints !== 'undefined') availableVars.push('bonusPoints=' + bonusPoints);
                        if (typeof calculateHabitPoints !== 'undefined') availableVars.push('calculateHabitPoints=function');
                        console.log('Available variables for tests:', availableVars.length > 0 ? availableVars.join(', ') : 'NONE');
                        
                        // Execute test code with sourceURL for better debugging
                        const executeTest = new Function(testCode + '\\n//# sourceURL=${f.fileName}');
                        executeTest.call(window);
                      } catch (evalError) {
                        console.error('Error evaluating test file ${f.fileName}:', evalError);
                      }
                    }
                  `;
                }).join('\n')}
                
                // Capture JSON output from Mocha
                let jsonOutput = '';
                const originalLog = console.log;
                
                // Capture console output for JSON results
                console.log = function(...args) {
                  const output = args.join(' ');
                  if (output.startsWith('{') && output.includes('"tests"')) {
                    jsonOutput = output;
                  }
                  originalLog.apply(console, args);
                };
                
                const runner = mocha.run();
                
                runner.on('end', () => {
                  try {
                    let mochaResults;
                    if (jsonOutput) {
                      mochaResults = JSON.parse(jsonOutput);
                    } else {
                      // Fallback: construct results from runner
                      mochaResults = {
                        tests: runner.suite.tests || [],
                        failures: runner.failures || [],
                        passes: runner.passes || []
                      };
                    }
                    
                    // Format all results since we only loaded current versions
                    const testResults = [];
                    
                    if (mochaResults.tests) {
                      mochaResults.tests.forEach(test => {
                        testResults.push({
                          passed: test.state === 'passed' || !test.err,
                          description: test.title,
                          error: test.err ? test.err.message || test.err : undefined
                        });
                      });
                    }
                    
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
            }, 50);
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
          // Only switch to tests tab if we're not already viewing diff
          if (event.data.results.length > 0 && activeTab !== 'diff') {
            setActiveTab('tests');
          }
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

  // Create or get Monaco model for current file
  useEffect(() => {
    if (!monaco || !isSlideActive || !currentFile) {
      return;
    }

    // Check if Monaco is disposed
    try {
      // Test if Monaco is still working by checking if we can access languages
      monaco.languages.getLanguages();
    } catch (error) {
      console.warn('Monaco appears to be disposed, skipping model creation');
      return;
    }

    // Don't proceed if we don't have a valid editor reference
    if (!editorRef.current) {
      return;
    }

    // Add a small delay to ensure the editor is fully initialized
    const timeoutId = setTimeout(() => {
      const fileName = currentFile.fileName;
      let model = modelsRef.current.get(fileName);
      
      if (!model) {
        const uri = monaco.Uri.parse(`inmemory://model/${instanceId}/${fileName}`);
        
        try {
          // Check if a model with this URI already exists
          const existingModel = monaco.editor.getModel(uri);
          if (existingModel) {
            // Only update if content is defined
            if (currentContent !== null && currentContent !== undefined) {
              existingModel.setValue(currentContent);
            }
            model = existingModel;
          } else {
            const language = getLanguageForFile(fileName);
            // Use empty string if content is null/undefined
            const safeContent = currentContent ?? '';
            model = monaco.editor.createModel(safeContent, language, uri);
          }
        } catch (error) {
          console.warn('Error creating or updating Monaco model:', error);
          return; // Exit early if we can't create a model
        }
        
        modelsRef.current.set(fileName, model);
      } else {
        // Update existing model content if it changed
        if (currentContent !== null && currentContent !== undefined && model.getValue() !== currentContent) {
          model.setValue(currentContent);
        }
      }
      
      if (editorRef.current && model && isSlideActive) {
        try {
          // Double-check that the editor is still valid and Monaco is not disposed
          if (editorRef.current.getModel !== undefined && monaco) {
            monaco.languages.getLanguages(); // Test if Monaco is still working
            editorRef.current.setModel(model);
          }
        } catch (error) {
          console.warn('Error setting model on editor:', error);
          // If we can't set the model, clear the editor reference
          editorRef.current = null;
        }
      }
    }, 100); // 100ms delay

    // Cleanup timeout on unmount or dependency change
    return () => {
      clearTimeout(timeoutId);
    };
  }, [monaco, isSlideActive, currentFile, currentContent]);

  // Configure TypeScript compiler options and themes
  useEffect(() => {
    if (monaco) {
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
    <div className="multi-file-code-display" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: themeColors.background }}>
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
          <div style={{ flex: '0 0 45%', borderBottom: `1px solid ${themeColors.border}`, position: 'relative', minHeight: 0, backgroundColor: themeColors.background }}>
            {isSlideActive ? (
              <Editor
                key={`editor-${currentTheme}`}
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
          
          {/* Output panel */}
          <div style={{ flex: '1 1 55%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Output tabs */}
            <div style={{ 
              display: 'flex', 
              backgroundColor: themeColors.backgroundSecondary, 
              borderBottom: '1px solid #333' 
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
              {activeTab === 'preview' && hasHtmlFiles && (
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
              )}
              
              {activeTab === 'console' && (
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
              )}
              
              {activeTab === 'tests' && (
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
              )}
              
              {activeTab === 'diff' && currentFile && currentFile.versions && currentFile.versions.length > 1 && (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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