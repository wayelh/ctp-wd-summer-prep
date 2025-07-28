import React, { useEffect, useLayoutEffect, useState, useCallback, useRef, useContext } from 'react';
import { useTheme } from './ThemeContext';
import Editor, { EditorProps, useMonaco, DiffEditor } from '@monaco-editor/react';
import * as ts from 'typescript';
import { SlideContext } from 'spectacle';
import { 
  FileContent, 
  MultiFileCodeDisplayProps, 
  ConsoleOutput as ConsoleOutputType, 
  TestResult,
  parseFilesFromCode,
  getLanguageFromExtension,
  safeBase64Encode,
  FileManager,
  ConsoleOutput,
  TestResults,
  OutputTabs,
  configureMonaco,
  getThemeColors,
  REACT_TYPES,
  REACT_DOM_TYPES
} from './MultiFileCodeDisplay/index';


// Helper function to parse files using old syntax (// @@@)
const parseFilesFromCodeLegacy = (code: string): FileContent[] => {
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

const getLanguageFromExtension = (ext: string): string => {
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
  
  // Configure Monaco for TypeScript/TSX support
  useEffect(() => {
    if (monaco) {
      // Set TypeScript compiler options
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ['node_modules/@types'],
        // Explicitly enable JSX in .tsx files
        jsxFactory: 'React.createElement',
        jsxFragmentFactory: 'React.Fragment'
      });
      
      // Also configure JavaScript defaults for JSX
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
        // Explicitly enable JSX
        jsxFactory: 'React.createElement',
        jsxFragmentFactory: 'React.Fragment'
      });
      
      // Set diagnostic options to enable JSX
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false
      });
      
      // Ensure TSX files are treated as TypeScript
      monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
      
      // Types will be loaded dynamically based on imports
    }
  }, [monaco]);
  
  // Create a unique instance ID for this component
  const instanceId = React.useRef(`instance-${Date.now()}-${Math.random()}`).current;
  
  // Type definition cache
  const typeCache = useRef<Map<string, string>>(new Map());
  const loadingTypes = useRef<Set<string>>(new Set());
  
  // State management
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [consoleOutput, setConsoleOutput] = useState<ConsoleOutputType[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'console' | 'tests' | 'preview' | 'diff'>('console');
  const [scratchPadContents, setScratchPadContents] = useState<Record<string, string>>({});
  const [selectedSolutionVersion, setSelectedSolutionVersion] = useState(1); // Start at version 1 (first solution)
  const { theme: currentTheme, toggleTheme } = useTheme();
  
  // Pane state
  const [isPaneCollapsed, setIsPaneCollapsed] = useState(false);
  const [isPaneExpanded, setIsPaneExpanded] = useState(false);
  const [paneHeight, setPaneHeight] = useState(55); // percentage
  const [isResizing, setIsResizing] = useState(false);
  
  // Preview responsive state
  const [previewWidth, setPreviewWidth] = useState<number | string>('100%');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile' | 'custom'>('desktop');
  const [isRotated, setIsRotated] = useState(false);
  const [deviceScale, setDeviceScale] = useState(1);
  const [zoomLevel, setZoomLevelRaw] = useState(100); // Zoom percentage
  
  // Ensure zoom level is always positive
  const setZoomLevel = (value: number) => {
    setZoomLevelRaw(Math.max(100, Math.abs(value)));
  };
  
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
  
  
  // Theme colors helper
  const themeColors = getThemeColors(currentTheme);
  
  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  
  // Fetch type definitions from esm.sh
  const fetchTypeDefinitions = useCallback(async (packageName: string, version: string = 'latest') => {
    const cacheKey = `${packageName}@${version}`;
    
    // Check cache first
    if (typeCache.current.has(cacheKey)) {
      return typeCache.current.get(cacheKey);
    }
    
    // Check if already loading
    if (loadingTypes.current.has(cacheKey)) {
      return null;
    }
    
    loadingTypes.current.add(cacheKey);
    
    try {
      // Construct the esm.sh URL
      const esmUrl = `https://esm.sh/${packageName}${version !== 'latest' ? `@${version}` : ''}`;
      
      // First, make a HEAD request to get the X-TypeScript-Types header
      const headResponse = await fetch(esmUrl, { method: 'HEAD' });
      const typesHeader = headResponse.headers.get('X-TypeScript-Types');
      
      if (!typesHeader) {
        console.log(`No type definitions found for ${cacheKey}`);
        return null;
      }
      
      // Fetch the actual .d.ts content
      const typesResponse = await fetch(typesHeader);
      if (!typesResponse.ok) {
        throw new Error(`Failed to fetch types from ${typesHeader}`);
      }
      
      const typesContent = await typesResponse.text();
      
      // Cache the result
      typeCache.current.set(cacheKey, typesContent);
      
      return typesContent;
    } catch (error) {
      console.error(`Error fetching types for ${cacheKey}:`, error);
      return null;
    } finally {
      loadingTypes.current.delete(cacheKey);
    }
  }, []);
  
  // Load types for imports found in code
  const loadTypesForImports = useCallback(async (code: string) => {
    if (!monaco) return;
    
    // Create import map for current context
    const currentImportMap = {
      imports: {
        'react': 'https://esm.sh/react@18.2.0?dev',
        'react-dom': 'https://esm.sh/react-dom@18.2.0?dev',
        'react-dom/client': 'https://esm.sh/react-dom@18.2.0/client?dev',
        'react/jsx-runtime': 'https://esm.sh/react@18.2.0/jsx-runtime?dev',
        'react/jsx-dev-runtime': 'https://esm.sh/react@18.2.0/jsx-dev-runtime?dev',
        'axios': 'https://esm.sh/axios@1.6.2',
        'lodash': 'https://esm.sh/lodash@4.17.21',
        'date-fns': 'https://esm.sh/date-fns@3.0.0',
        'uuid': 'https://esm.sh/uuid@9.0.1',
        'classnames': 'https://esm.sh/classnames@2.5.1',
        'framer-motion': 'https://esm.sh/framer-motion@10.16.16',
        '@emotion/react': 'https://esm.sh/@emotion/react@11.11.3',
        '@emotion/styled': 'https://esm.sh/@emotion/styled@11.11.0',
        'styled-components': 'https://esm.sh/styled-components@6.1.8',
        'zustand': 'https://esm.sh/zustand@4.4.7',
        'react-hook-form': 'https://esm.sh/react-hook-form@7.48.2',
        'react-query': 'https://esm.sh/react-query@3.39.3',
        '@tanstack/react-query': 'https://esm.sh/@tanstack/react-query@5.17.0',
        'swr': 'https://esm.sh/swr@2.2.4',
        'react-router-dom': 'https://esm.sh/react-router-dom@6.21.1',
        '@mui/material': 'https://esm.sh/@mui/material@5.15.2',
        'antd': 'https://esm.sh/antd@5.12.8',
        'recharts': 'https://esm.sh/recharts@2.10.4',
        'chart.js': 'https://esm.sh/chart.js@4.4.1',
        'd3': 'https://esm.sh/d3@7.8.5'
      }
    };
    
    // Extract imports using regex
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    const imports = new Set<string>();
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
      const importPath = match[1];
      // Skip relative imports and URLs
      if (!importPath.startsWith('.') && !importPath.startsWith('/') && !importPath.includes('://')) {
        imports.add(importPath);
      }
    }
    
    // Load types for each import
    for (const importPath of imports) {
      // Check if we've already loaded types for this import
      const cacheKey = `loaded_${importPath}`;
      if (typeCache.current.has(cacheKey)) continue;
      
      // Extract package name and version from our import map
      const importMapEntry = (currentImportMap.imports as any)[importPath];
      if (!importMapEntry) {
        // Try to load from esm.sh without specific version
        const packageName = importPath.split('/')[0];
        const typesContent = await fetchTypeDefinitions(packageName);
        if (typesContent) {
          try {
            monaco.languages.typescript.typescriptDefaults.addExtraLib(
              typesContent,
              `file:///node_modules/${packageName}/index.d.ts`
            );
            monaco.languages.typescript.javascriptDefaults.addExtraLib(
              typesContent,
              `file:///node_modules/${packageName}/index.d.ts`
            );
            typeCache.current.set(cacheKey, 'loaded');
            console.log(`Loaded types for ${packageName} (no version)`);
          } catch (error) {
            console.error(`Error adding types for ${packageName}:`, error);
          }
        }
        continue;
      }
      
      // Parse package and version from esm.sh URL
      const urlMatch = importMapEntry.match(/esm\.sh\/(.+?)@([^/?]+)/);
      if (!urlMatch) continue;
      
      const [, packageNameWithPath, version] = urlMatch;
      // Handle subpaths like react-dom/client
      const packageName = packageNameWithPath.split('/')[0];
      
      const typesContent = await fetchTypeDefinitions(packageName, version);
      
      if (typesContent) {
        // Add types to Monaco
        try {
          monaco.languages.typescript.typescriptDefaults.addExtraLib(
            typesContent,
            `file:///node_modules/${packageName}/index.d.ts`
          );
          monaco.languages.typescript.javascriptDefaults.addExtraLib(
            typesContent,
            `file:///node_modules/${packageName}/index.d.ts`
          );
          
          typeCache.current.set(cacheKey, 'loaded');
          console.log(`Loaded types for ${packageName}@${version}`);
        } catch (error) {
          console.error(`Error adding types for ${packageName}:`, error);
        }
      }
    }
  }, [monaco, fetchTypeDefinitions]);
  
  // Track slide state
  const { isSlideActive, slideId } = slideContext;
  
  // Generate a unique key for this slide's scratch pad storage (without instanceId for persistence)
  const getStorageKey = (fileName: string) => `ctp-scratchpad-${slideId}-${fileName}`;
  
  // Initialize file contents when files change
  useEffect(() => {
    if (files.length > 0) {
      // Load types for all initial files
      files.forEach(file => {
        const content = file.content || '';
        if ((file.fileName.endsWith('.ts') || file.fileName.endsWith('.tsx') || 
             file.fileName.endsWith('.js') || file.fileName.endsWith('.jsx')) && content) {
          loadTypesForImports(content);
        }
      });
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
  }, [files, currentFileIndex, slideId, loadTypesForImports]);
  
  // Get current file safely
  const currentFile = files.length > 0 ? files[Math.min(currentFileIndex, files.length - 1)] : null;
  
  if (!currentFile && files.length > 0) {
    console.error('[MultiFileCodeDisplay] currentFile is null but files exist:', { currentFileIndex, filesLength: files.length });
  }
  
  // Check if we have HTML files or React files for preview
  const hasHtmlFiles = files.some(f => f.fileName.endsWith('.html'));
  const hasReactFiles = files.some(f => 
    f.fileName.endsWith('.tsx') || 
    f.fileName.endsWith('.jsx') ||
    (f.content && (f.content.includes('ReactDOM.render') || f.content.includes('ReactDOM.createRoot') || f.content.includes('root.render')))
  );
  const shouldShowPreview = hasHtmlFiles || hasReactFiles;
  
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
    
    // Load types for any new imports
    if (value && (fileName.endsWith('.ts') || fileName.endsWith('.tsx') || fileName.endsWith('.js') || fileName.endsWith('.jsx'))) {
      loadTypesForImports(value);
    }
    
    onChange?.(fileName, value);
  };

  const getLanguageForFile = (fileName: string): string => {
    const ext = fileName.split('.').pop();
    switch (ext) {
      case 'html': return 'html';
      case 'css': return 'css';
      case 'js': return 'javascript';
      case 'ts': return 'typescript';
      case 'tsx': return 'typescript';  // Use typescript mode with JSX enabled
      case 'jsx': return 'javascript';  // Use javascript mode with JSX enabled
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
          moduleResolution: ts.ModuleResolutionKind.NodeJs,
          strict: false,
          skipLibCheck: true
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
    
    // If it's an error, try to add Monaco annotations
    if (type === 'error' && editorRef.current) {
      const errorMatch = safeMessage.match(/at\s+.*?[(:](.*?):(\d+):(\d+)/);
      if (errorMatch) {
        const [, fileName, line, column] = errorMatch;
        const lineNumber = parseInt(line, 10);
        const columnNumber = parseInt(column, 10);
        
        // Find the file that matches
        const matchingFile = files.find(f => 
          f.fileName === fileName || 
          safeMessage.includes(f.fileName)
        );
        
        if (matchingFile && matchingFile.fileName === currentFile?.fileName) {
          // Add error decoration to current file
          const monaco = editorRef.current.getMonaco();
          const model = editorRef.current.getModel();
          
          if (monaco && model) {
            // Create error marker
            monaco.editor.setModelMarkers(model, 'runtime-errors', [{
              severity: monaco.MarkerSeverity.Error,
              startLineNumber: lineNumber,
              startColumn: columnNumber || 1,
              endLineNumber: lineNumber,
              endColumn: columnNumber || model.getLineMaxColumn(lineNumber),
              message: safeMessage.split('\n')[0] // First line of error
            }]);
          }
        }
      }
    }
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

  // Calculate device scale based on fixed viewport assumptions
  const calculateDeviceScale = useCallback((device: 'desktop' | 'tablet' | 'mobile' | 'custom') => {
    // Use fixed viewport size to prevent scaling on resize
    // Assume a reasonable preview area size
    const availableWidth = 800; // Fixed width assumption
    const availableHeight = 600; // Fixed height assumption
    
    let deviceWidth = 0;
    let deviceHeight = 0;
    
    if (device === 'desktop') {
      // For desktop, check if it needs scaling
      const desktopWidth = 1024;
      const desktopHeight = desktopWidth * (9 / 16); // 16:9 aspect ratio
      
      // Add extra space for the desktop stand/base (60px)
      const totalHeight = desktopHeight + 60;
      
      const scaleX = availableWidth / desktopWidth;
      const scaleY = availableHeight / totalHeight;
      return Math.min(scaleX, scaleY); // Scale to fit, no maximum limit
    } else if (device === 'mobile') {
      // For rotation, we need to consider the rotated dimensions
      if (isRotated) {
        deviceWidth = 812;
        deviceHeight = 375;
      } else {
        deviceWidth = 375;
        deviceHeight = 812;
      }
    } else if (device === 'tablet') {
      // For rotation, we need to consider the rotated dimensions
      if (isRotated) {
        deviceWidth = 1024;
        deviceHeight = 768;
      } else {
        deviceWidth = 768;
        deviceHeight = 1024;
      }
    } else {
      // Custom device, no scaling
      return 1;
    }
    
    // Add extra space for device frame decorations and padding
    const framePadding = device === 'mobile' ? 8 : device === 'tablet' ? 16 : 0;
    const frameWidth = framePadding * 2;
    const frameHeight = framePadding * 2;
    
    const totalWidth = deviceWidth + frameWidth;
    const totalHeight = deviceHeight + frameHeight;
    
    // Calculate scale to fit within container
    const scaleX = availableWidth / totalWidth;
    const scaleY = availableHeight / totalHeight;
    // Scale to fit without any maximum limit
    const scale = Math.min(scaleX, scaleY);
    
    return scale;
  }, [isRotated]);

  // Track if we've set the initial zoom
  const hasSetInitialZoom = useRef(false);

  // Set initial zoom using useLayoutEffect to run before paint
  useLayoutEffect(() => {
    if (!previewContainerRef.current || hasSetInitialZoom.current) return;
    
    const scale = calculateDeviceScale(previewDevice);
    if (scale > 0) {
      setDeviceScale(scale);
      
      // All devices start at actual size
      const actualSizeZoom = Math.min(800, Math.round(100 / scale));
      setZoomLevel(actualSizeZoom);
      hasSetInitialZoom.current = true;
    }
  });

  // Track previous values to maintain scale on rotation
  const prevDeviceScale = useRef(deviceScale);
  const prevIsRotated = useRef(isRotated);

  // Update device scale when preview device or rotation changes
  useEffect(() => {
    const scale = calculateDeviceScale(previewDevice);
    
    // If only rotating (not changing device), maintain the visual scale
    if (prevIsRotated.current !== isRotated && prevDeviceScale.current > 0) {
      // Calculate what the current visual scale is
      const currentVisualScale = prevDeviceScale.current * (zoomLevel / 100);
      
      // Update device scale
      setDeviceScale(scale);
      
      // Calculate new zoom level to maintain the same visual scale
      const newZoomLevel = Math.round((currentVisualScale / scale) * 100);
      setZoomLevel(Math.max(100, Math.min(800, newZoomLevel)));
    } else {
      setDeviceScale(scale);
    }
    
    // Update refs
    prevDeviceScale.current = scale;
    prevIsRotated.current = isRotated;
    
    // Debug logging
    if (previewDevice !== 'desktop' && previewDevice !== 'custom') {
      const dims = previewDevice === 'mobile' 
        ? { w: isRotated ? 812 : 375, h: isRotated ? 375 : 812 }
        : { w: isRotated ? 1024 : 768, h: isRotated ? 768 : 1024 };
      const aspectRatio = (dims.w / dims.h).toFixed(2);
      console.log(`Device: ${previewDevice}, Rotated: ${isRotated}, Dimensions: ${dims.w}x${dims.h}, Aspect: ${aspectRatio}, Scale: ${scale.toFixed(2)}`);
    }
  }, [previewDevice, isRotated, calculateDeviceScale, zoomLevel]);

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
      let htmlContent = scratchPadContents['index.html'] || fileContents['index.html'];
      
      // Process HTML to replace script src tags early
      if (htmlContent) {
        const tempParser = new DOMParser();
        const tempDoc = tempParser.parseFromString(htmlContent, 'text/html');
        
        // Replace script src tags with import syntax
        const scriptTags = tempDoc.querySelectorAll('script[src]');
        scriptTags.forEach((scriptElement) => {
          const script = scriptElement as HTMLScriptElement;
          const src = script.getAttribute('src');
          if (src && (src.startsWith('./') || src.startsWith('/') || !src.includes('://'))) {
            const newScript = tempDoc.createElement('script');
            newScript.type = 'module';
            newScript.textContent = `import '${src}';`;
            
            // Copy other attributes
            Array.from(script.attributes).forEach((attr: Attr) => {
              if (attr.name !== 'src' && attr.name !== 'type') {
                newScript.setAttribute(attr.name, attr.value);
              }
            });
            
            script.parentNode?.replaceChild(newScript, script);
          }
        });
        
        htmlContent = tempDoc.documentElement.outerHTML;
      }
      
      // If no HTML file but we have React files, create a default HTML
      if (!htmlContent && hasReactFiles) {
        htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>React App</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
          'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
          sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      #root {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
    </style>
</head>
<body>
    <div id="root"></div>
</body>
</html>`;
      } else if (!htmlContent) {
        htmlContent = '<!DOCTYPE html><html><head></head><body></body></html>';
      }
      
      // Import map injection is now handled automatically for all imports
      
      // Inject CSS if exists
      if (cssFile) {
        const cssContent = scratchPadContents['index.css'] || fileContents['index.css'] || '';
        const styleTag = `<style>${cssContent}</style>`;
        htmlContent = htmlContent.replace('</head>', `${styleTag}</head>`);
      }
      
      // First pass: compile all modules
      const compiledModules: Array<{file: typeof jsFiles[0], compiled: string}> = [];
      
      for (const jsFile of jsFiles) {
        // Skip test files for module creation
        if (jsFile.fileName.startsWith('tests.')) {
          console.log('Skipping test file:', jsFile.fileName);
          continue;
        }
        
        // Use scratch pad content for all files
        const content = scratchPadContents[jsFile.fileName] || fileContents[jsFile.fileName] || '';
        
        // Transform the code to export all top-level declarations
        let moduleContent = content;
        
        // Don't auto-export React imports
        const hasReactImport = /import\s+(?:\*\s+as\s+)?React|import\s+.*from\s+['"]react['"]/.test(moduleContent);
        const hasReactDOMImport = /import\s+(?:\*\s+as\s+)?ReactDOM|import\s+.*from\s+['"]react-dom/.test(moduleContent);
        
        // Add exports for all top-level const/let/var declarations (except React imports)
        moduleContent = moduleContent.replace(
          /^(const|let|var)\s+(\w+)\s*=/gm,
          (match, declType, varName) => {
            // Don't export if it's a React import result
            if ((varName === 'React' && hasReactImport) || (varName === 'ReactDOM' && hasReactDOMImport)) {
              return match;
            }
            return `export ${declType} ${varName} =`;
          }
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
        
        compiledModules.push({file: jsFile, compiled});
      }
      
      // Note: Object URLs will be created inside the iframe instead
      
      // Process compiled modules for debugging
      for (const {file: jsFile, compiled} of compiledModules) {
        
        // For debugging: log the compiled output for React files
        if (jsFile.language === 'tsx' || jsFile.language === 'jsx') {
          console.log(`[Compiled ${jsFile.fileName}]:`, compiled.substring(0, 500) + '...');
          
          // Check if the compiled code has the necessary imports
          if (!compiled.includes('import') && compiled.includes('React.createElement')) {
            console.warn(`[${jsFile.fileName}] Compiled code uses React.createElement but has no React import!`);
          }
        }
        
        // Add inline source map for better debugging and accurate line numbers
        const content = scratchPadContents[jsFile.fileName] || fileContents[jsFile.fileName] || '';
        const lines = content.split('\n');
        const sourceMap = {
          version: 3,
          sources: [jsFile.fileName],
          sourcesContent: [content],
          names: [],
          mappings: 'AAAA' + ';AACA'.repeat(lines.length - 1) // Simple 1:1 line mapping
        };
        
        const sourceMapComment = `\n//# sourceMappingURL=data:application/json;base64,${safeBase64Encode(JSON.stringify(sourceMap))}\n//# sourceURL=${jsFile.fileName}`;
        const compiledWithSourceMap = compiled + sourceMapComment;
        
        // Update the compiled module with source map
        const moduleIndex = compiledModules.findIndex(m => m.file.fileName === jsFile.fileName);
        if (moduleIndex !== -1) {
          compiledModules[moduleIndex].compiled = compiledWithSourceMap;
        }
      }
      
      // Extract all imports from the code to add to import map
      const externalImports: Record<string, string> = {};
      
      // Create import map for ES modules
      const importMap = {
        imports: {
          'react': 'https://esm.sh/react@18.2.0?dev',
          'react-dom': 'https://esm.sh/react-dom@18.2.0?dev',
          'react-dom/client': 'https://esm.sh/react-dom@18.2.0/client?dev',
          'react/jsx-runtime': 'https://esm.sh/react@18.2.0/jsx-runtime?dev',
          'react/jsx-dev-runtime': 'https://esm.sh/react@18.2.0/jsx-dev-runtime?dev',
          'axios': 'https://esm.sh/axios@1.6.2',
          'lodash': 'https://esm.sh/lodash@4.17.21',
          'date-fns': 'https://esm.sh/date-fns@3.0.0',
          'uuid': 'https://esm.sh/uuid@9.0.1',
          'classnames': 'https://esm.sh/classnames@2.5.1',
          'framer-motion': 'https://esm.sh/framer-motion@10.16.16',
          '@emotion/react': 'https://esm.sh/@emotion/react@11.11.3',
          '@emotion/styled': 'https://esm.sh/@emotion/styled@11.11.0',
          'styled-components': 'https://esm.sh/styled-components@6.1.8',
          'zustand': 'https://esm.sh/zustand@4.4.7',
          'react-hook-form': 'https://esm.sh/react-hook-form@7.48.2',
          'react-query': 'https://esm.sh/react-query@3.39.3',
          '@tanstack/react-query': 'https://esm.sh/@tanstack/react-query@5.17.0',
          'swr': 'https://esm.sh/swr@2.2.4',
          'react-router-dom': 'https://esm.sh/react-router-dom@6.21.1',
          '@mui/material': 'https://esm.sh/@mui/material@5.15.2',
          'antd': 'https://esm.sh/antd@5.12.8',
          'recharts': 'https://esm.sh/recharts@2.10.4',
          'chart.js': 'https://esm.sh/chart.js@4.4.1',
          'd3': 'https://esm.sh/d3@7.8.5'
        }
      };
      
      // Find all imports in all files
      for (const jsFile of jsFiles) {
        const content = scratchPadContents[jsFile.fileName] || fileContents[jsFile.fileName] || '';
        
        // Match import statements
        const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
        let match;
        
        while ((match = importRegex.exec(content)) !== null) {
          const importPath = match[1];
          
          // Skip relative imports (already handled by moduleUrls)
          if (importPath.startsWith('.') || importPath.startsWith('/')) {
            continue;
          }
          
          // Check if we have a CDN mapping for this import
          if ((importMap.imports as any)[importPath]) {
            externalImports[importPath] = (importMap.imports as any)[importPath];
          } else if (!importPath.includes('://')) {
            // For unmapped packages, try to resolve via esm.sh
            const packageName = importPath.split('/')[0];
            if (packageName.startsWith('@')) {
              // Scoped package
              const cdnUrl = `https://esm.sh/${importPath}`;
              externalImports[importPath] = cdnUrl;
            } else {
              // Regular package
              const cdnUrl = `https://esm.sh/${importPath}`;
              externalImports[importPath] = cdnUrl;
            }
          }
        }
      }
      
      // Create data URLs for local modules
      const localModuleUrls: Record<string, string> = {};
      for (const {file, compiled} of compiledModules) {
        const moduleContent = compiled;
        const dataUrl = `data:application/javascript;charset=utf-8,${encodeURIComponent(moduleContent)}`;
        const moduleName = file.fileName.replace(/\.(js|ts|jsx|tsx)$/, '');
        
        // Add all possible import paths
        localModuleUrls[moduleName] = dataUrl;
        localModuleUrls[`./${moduleName}`] = dataUrl;
        localModuleUrls[file.fileName] = dataUrl;
        localModuleUrls[`./${file.fileName}`] = dataUrl;
      }
      
      // Create import map for module resolution with predefined, external, and local modules
      const finalImportMap = {
        imports: {
          ...importMap.imports,  // Include all predefined imports (React, etc.)
          ...externalImports,    // Include imports found in the code
          ...localModuleUrls     // Include local module mappings
        }
      };
      
      // Inject es-module-shims and import map in the head
      const importMapScript = `<script type="importmap">
${JSON.stringify(finalImportMap, null, 2)}
</script>`;
      
      // Add es-module-shims for import map support in all contexts
      if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', `
        <!-- ES Module Shims for import map support in all contexts -->
        <script async src="https://ga.jspm.io/npm:es-module-shims@1.6.3/dist/es-module-shims.js"></script>
        ${importMapScript}
        </head>`);
      } else {
        // Try to inject before first script tag as fallback
        const firstScriptIndex = htmlContent.indexOf('<script');
        if (firstScriptIndex !== -1) {
          htmlContent = htmlContent.slice(0, firstScriptIndex) + 
            `<script async src="https://ga.jspm.io/npm:es-module-shims@1.6.3/dist/es-module-shims.js"></script>\n${importMapScript}\n` + 
            htmlContent.slice(firstScriptIndex);
        }
      }
      
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
        
        // Error handling with file name mapping
        window.addEventListener('error', (event) => {
          let errorMsg = event.error?.stack || event.message || 'Unknown error';
          
          // Data URLs are already readable in stack traces
          
          console.error(errorMsg);
          event.preventDefault();
        });
        
        window.addEventListener('unhandledrejection', (event) => {
          let reason = event.reason;
          if (reason && reason.stack) {
            // Data URLs are already readable in stack traces
          }
          console.error('Unhandled Promise Rejection:', reason);
          event.preventDefault();
        });
        
        // Mock Service Worker setup for API mocking
        const mockServiceWorker = \`
          // Simple MSW-like implementation for the iframe context
          class MockServiceWorker {
            constructor() {
              this.handlers = [];
              this.setupInterceptor();
            }
            
            setupInterceptor() {
              // Override fetch to intercept API calls
              const originalFetch = window.fetch;
              window.fetch = async (input, init) => {
                let url = typeof input === 'string' ? input : input.url;
                const method = (init?.method || 'GET').toUpperCase();
                
                // Normalize the URL to handle relative paths
                try {
                  const urlObj = new URL(url, window.location.origin);
                  url = urlObj.pathname + urlObj.search;
                } catch (e) {
                  // If URL parsing fails, use as-is
                }
                
                // Check if this is an API request
                if (url.startsWith('/api') || url.includes('/api/')) {
                  console.log(\\\`[MSW] Intercepting \\\${method} \\\${url}\\\`);
                  
                  // Find matching handler
                  for (const handler of this.handlers) {
                    if (handler.matches(method, url)) {
                      try {
                        console.log(\\\`[MSW] Found handler for \\\${method} \\\${url}\\\`);
                        const request = new Request(input, init);
                        const response = await handler.resolver(request);
                        return response;
                      } catch (error) {
                        console.error('[MSW] Handler error:', error);
                        return new Response(JSON.stringify({ error: error.message }), {
                          status: 500,
                          headers: { 'Content-Type': 'application/json' }
                        });
                      }
                    }
                  }
                  
                  // No handler found - return 404
                  console.warn(\\\`[MSW] No handler found for \\\${method} \\\${url}\\\`);
                  return new Response(JSON.stringify({ error: 'Not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                  });
                }
                
                // Not an API request, use original fetch
                return originalFetch(input, init);
              };
            }
            
            rest = {
              get: (path, resolver) => {
                this.handlers.push({
                  method: 'GET',
                  path,
                  matches: (method, url) => method === 'GET' && this.matchPath(path, url),
                  resolver
                });
              },
              post: (path, resolver) => {
                this.handlers.push({
                  method: 'POST',
                  path,
                  matches: (method, url) => method === 'POST' && this.matchPath(path, url),
                  resolver
                });
              },
              put: (path, resolver) => {
                this.handlers.push({
                  method: 'PUT',
                  path,
                  matches: (method, url) => method === 'PUT' && this.matchPath(path, url),
                  resolver
                });
              },
              patch: (path, resolver) => {
                this.handlers.push({
                  method: 'PATCH',
                  path,
                  matches: (method, url) => method === 'PATCH' && this.matchPath(path, url),
                  resolver
                });
              },
              delete: (path, resolver) => {
                this.handlers.push({
                  method: 'DELETE',
                  path,
                  matches: (method, url) => method === 'DELETE' && this.matchPath(path, url),
                  resolver
                });
              }
            };
            
            matchPath(pattern, url) {
              // Simple path matching with parameters
              const patternParts = pattern.split('/').filter(Boolean);
              
              // Parse URL and get pathname only (strip query params)
              let pathname = url;
              try {
                const urlObj = new URL(url, window.location.origin);
                pathname = urlObj.pathname;
              } catch (e) {
                // If URL parsing fails, try to extract pathname manually
                const queryIndex = url.indexOf('?');
                if (queryIndex !== -1) {
                  pathname = url.substring(0, queryIndex);
                }
              }
              
              const urlParts = pathname.split('/').filter(Boolean);
              
              if (patternParts.length !== urlParts.length) return false;
              
              for (let i = 0; i < patternParts.length; i++) {
                if (patternParts[i].startsWith(':')) continue; // Parameter
                if (patternParts[i] !== urlParts[i]) return false;
              }
              
              return true;
            }
            
            use(...handlers) {
              // For compatibility with MSW API
              console.log('Mock handlers registered:', handlers.length);
            }
          }
          
          // Create global MSW instance
          window.msw = new MockServiceWorker();
          
          // Helper to create responses
          window.HttpResponse = {
            json: (data, options = {}) => {
              return new Response(JSON.stringify(data), {
                status: options.status || 200,
                headers: {
                  'Content-Type': 'application/json',
                  ...options.headers
                }
              });
            },
            text: (text, options = {}) => {
              return new Response(text, {
                status: options.status || 200,
                headers: {
                  'Content-Type': 'text/plain',
                  ...options.headers
                }
              });
            },
            error: (message = 'Internal Server Error', status = 500) => {
              return new Response(JSON.stringify({ error: message }), {
                status,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          };
          
          // Example handlers - users can override these
          window.msw.rest.get('/api/data', async () => {
            return HttpResponse.json({
              users: [
                { id: 1, name: 'John Doe', email: 'john@example.com' },
                { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
                { id: 3, name: 'Bob Johnson', email: 'bob@example.com' }
              ],
              posts: [
                { id: 1, title: 'Hello World', content: 'This is my first post' },
                { id: 2, title: 'React Patterns', content: 'Learning about render props' }
              ]
            });
          });
          
          window.msw.rest.get('/api/users', async () => {
            return HttpResponse.json([
              { id: 1, name: 'John Doe', email: 'john@example.com' },
              { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
            ]);
          });
          
          window.msw.rest.get('/api/users/:id', async (req) => {
            const url = new URL(req.url);
            const id = url.pathname.split('/').pop();
            return HttpResponse.json({
              id: parseInt(id),
              name: 'John Doe',
              email: 'john@example.com'
            });
          });
          
          window.msw.rest.post('/api/users', async (req) => {
            const body = await req.json();
            return HttpResponse.json({
              id: Date.now(),
              ...body
            }, { status: 201 });
          });
          
          console.log('Mock Service Worker initialized for /api routes');
        \`;
        
        // Execute MSW setup
        eval(mockServiceWorker);
      `;
      
      // Pass compiled modules to iframe for object URL creation
      const compiledModulesData = compiledModules.map(({file, compiled}) => ({
        fileName: file.fileName,
        compiled: compiled
      }));
      
      // Build final HTML with all scripts
      const scriptTags = `
        <script src="https://unpkg.com/mocha@10.2.0/mocha.js"></script>
        <script src="https://unpkg.com/chai@4.3.7/chai.js"></script>
        <script src="https://unpkg.com/sinon@15.2.0/pkg/sinon.js"></script>
        <link rel="stylesheet" href="https://unpkg.com/mocha@10.2.0/mocha.css">
        <script>
          // Early error catching
          window.addEventListener('error', function(e) {
            console.log('[Error Details]', {
              message: e.message,
              source: e.filename,
              line: e.lineno,
              col: e.colno,
              error: e.error
            });
          }, true);
          window.expect = chai.expect;
          window.assert = chai.assert;
          window.sinon = sinon;
          
          // Configure Mocha
          mocha.setup({ ui: 'bdd' });
          
          // Pass files data to iframe context
          window.files = ${JSON.stringify(files).replace(/</g, '\\x3C').replace(/>/g, '\\x3E')};
          window.fileContents = ${JSON.stringify(fileContents).replace(/</g, '\\x3C').replace(/>/g, '\\x3E')};
          window.scratchPadContents = ${JSON.stringify(scratchPadContents).replace(/</g, '\\x3C').replace(/>/g, '\\x3E')};
          window.compiledModules = ${JSON.stringify(compiledModulesData).replace(/</g, '\\x3C').replace(/>/g, '\\x3E')};
          window.importMapData = ${JSON.stringify(finalImportMap).replace(/</g, '\\x3C').replace(/>/g, '\\x3E')};
          
          // Import map is already injected in the HTML, just log it for debugging
          console.log('Import map already injected in HTML');
          
          // Hide debug output if this is a preview iframe
          if (window.frameElement && window.frameElement.title === 'HTML Preview') {
            // Clear the document to prevent showing the script content
            document.addEventListener('DOMContentLoaded', function() {
              // Remove any text nodes that contain debug content
              const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
              );
              
              const nodesToRemove = [];
              while (walker.nextNode()) {
                const node = walker.currentNode;
                if (node.textContent && node.textContent.includes('window.files =')) {
                  nodesToRemove.push(node);
                }
              }
              
              nodesToRemove.forEach(node => node.remove());
            });
          }
          
          ${testRunner}
        </script>
        <script type="module">
          // Wait for import map to be processed
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Import and execute all non-test modules
          (async () => {
            try {
              ${jsFiles.filter(f => !f.fileName.startsWith('tests.')).map(jsFile => {
                const moduleName = jsFile.fileName.replace(/\.(js|ts|jsx|tsx)$/, '');
                const safeModuleName = moduleName.replace(/[^a-zA-Z0-9]/g, '_');
                return `
              console.log('Importing ${jsFile.fileName}...');
              try {
                console.log('Attempting to import ${jsFile.fileName} from ./${moduleName}');
                const ${safeModuleName} = await import('./${moduleName}');
                console.log('Successfully imported ${jsFile.fileName}');
                
                // Make all exports available globally for tests
                Object.entries(${safeModuleName}).forEach(([key, value]) => {
                  window[key] = value;
                  console.log(\`Exported \${key} to window\`);
                });
              } catch (importError) {
                console.error('Error importing ${jsFile.fileName}:', importError);
                console.error('Stack:', importError.stack);
                console.error('Import map data:', window.importMapData);
              }
                `;
              }).join('\n')}
              
              // After all modules are loaded, signal readiness
              console.log('All modules imported successfully');
              window.modulesLoaded = true;
              
            } catch (mainError) {
              console.error('Error in main module loading:', mainError);
            }
          })();
          
          // After all modules are loaded, run tests
          window.addEventListener('load', () => {
            // Signal that modules are loaded
            window.modulesLoaded = true;
            console.log('All modules loaded, ready for tests');
          });
          
          // Also check if the waitForModules function exists and call it
          if (typeof window.waitForModules === 'function') {
            window.waitForModules();
          }
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
      
      // Update any existing script src references to use blob URLs
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Note: Import map is already injected in the head section
      
      // Script URLs will be resolved inside the iframe using the import map
      
      // Add our script tags at the end
      const bodyElement = doc.body;
      const tempDiv = doc.createElement('div');
      tempDiv.innerHTML = scriptTags;
      while (tempDiv.firstChild) {
        bodyElement.appendChild(tempDiv.firstChild);
      }
      
      htmlContent = doc.documentElement.outerHTML;
      
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
      
      // Update preview iframe with clean HTML
      if (previewIframeRef.current && (hasHtmlFiles || hasReactFiles)) {
        previewIframeRef.current.srcdoc = '';
        
        // Build a clean HTML for preview
        const htmlFile = files.find(f => f.fileName.endsWith('.html'));
        let baseHtml = '';
        
        if (htmlFile) {
          baseHtml = scratchPadContents[htmlFile.fileName] || fileContents[htmlFile.fileName] || '';
        } else if (hasReactFiles) {
          baseHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>React App</title>
</head>
<body>
    <div id="root"></div>
</body>
</html>`;
        }
        
        // Create a document to manipulate
        const parser = new DOMParser();
        const doc = parser.parseFromString(baseHtml, 'text/html');
        
        // Add CSS
        const cssFile = files.find(f => f.fileName.endsWith('.css'));
        if (cssFile) {
          const cssContent = scratchPadContents[cssFile.fileName] || fileContents[cssFile.fileName] || '';
          if (cssContent) {
            const style = doc.createElement('style');
            style.textContent = cssContent;
            doc.head.appendChild(style);
          }
        }
        
        // Add es-module-shims for import map support
        const esmShimsScript = doc.createElement('script');
        esmShimsScript.src = 'https://ga.jspm.io/npm:es-module-shims@1.6.3/dist/es-module-shims.js';
        esmShimsScript.async = true;
        doc.head.insertBefore(esmShimsScript, doc.head.firstChild);
        
        // Add the import map
        const importMapScript = doc.createElement('script');
        importMapScript.type = 'importmap';
        importMapScript.textContent = JSON.stringify(finalImportMap, null, 2);
        doc.head.insertBefore(importMapScript, esmShimsScript.nextSibling);
        
        // Update any existing script src to use module imports
        const existingScripts = doc.querySelectorAll('script[src]');
        existingScripts.forEach(scriptElement => {
          const script = scriptElement as HTMLScriptElement;
          const src = script.getAttribute('src');
          if (src && (src.startsWith('./') || src.startsWith('/') || !src.includes('://'))) {
            // Create a new script with import syntax
            const newScript = doc.createElement('script');
            newScript.type = 'module';
            newScript.textContent = `import '${src}';`;
            
            // Copy any other attributes
            for (const attr of script.attributes) {
              if (attr.name !== 'src' && attr.name !== 'type') {
                newScript.setAttribute(attr.name, attr.value);
              }
            }
            
            // Replace the old script with the new one
            script.parentNode?.replaceChild(newScript, script);
          }
        });
        
        // If no script tags exist and we have React files, add the main entry
        if (existingScripts.length === 0 && hasReactFiles) {
          const mainFile = jsFiles.find(f => 
            f.fileName === 'App.tsx' || 
            f.fileName === 'index.tsx' || 
            f.fileName === 'index.js' ||
            f.fileName === 'main.js'
          );
          if (mainFile) {
            const script = doc.createElement('script');
            script.type = 'module';
            const moduleName = mainFile.fileName.replace(/\.(jsx?|tsx?)$/, '');
            script.textContent = `import './${moduleName}';`;
            doc.body.appendChild(script);
          }
        }
        
        // Get the clean HTML
        const previewHtml = doc.documentElement.outerHTML;
        
        setTimeout(() => {
          if (previewIframeRef.current) {
            previewIframeRef.current.srcdoc = previewHtml;
          }
        }, 10);
      }
      
      // Cleanup
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        setIsRunning(false);
        // Note: Blob URLs are created and managed inside the iframe
      }, 2000);
      
    } catch (error: any) {
      addConsoleOutput('error', `Runtime error: ${error.message}`);
      setIsRunning(false);
    }
  }, [fileContents, files]);

  // Removed auto-run - users must click Run button to execute tests

  // Remove the complex model management - let the Editor component handle it

  // Configure TypeScript compiler options
  useEffect(() => {
    if (monaco) {
      
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
        typeRoots: ['node_modules/@types'],
        jsxFactory: 'React.createElement',
        jsxFragmentFactory: 'React.Fragment',
        reactNamespace: 'React'
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
  }, [monaco]);

  // Update theme when currentTheme changes
  useEffect(() => {
    if (monaco && currentTheme) {
      monaco.editor.setTheme(currentTheme);
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
        <FileManager
          files={files}
          currentFileIndex={currentFileIndex}
          onFileSelect={setCurrentFileIndex}
          onReset={() => {
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
          onToggleExecution={runCode}
          isExecuting={isRunning}
          themeColors={themeColors}
          scratchPadVersion={currentFile && currentFile.versions ? currentFile.versions.length : 0}
          currentTheme={currentTheme}
          onToggleTheme={toggleTheme}
        />
        
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
                path={currentFile?.fileName || 'main.tsx'}
                onChange={handleEditorChange}
                beforeMount={(monaco) => {
                  // Ensure TypeScript/JavaScript defaults are configured before mounting
                  configureMonaco(monaco);
                }}
                options={{
                  ...options,
                  readOnly,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  automaticLayout: true,
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
                onMount={(editor, monaco) => {
                  // Only set the editor reference if the slide is still active
                  if (isSlideActive) {
                    editorRef.current = editor;
                    
                    // Configure Monaco (this already sets up TypeScript/JSX properly)
                    configureMonaco(monaco);
                    
                    // Debug: Log current language configuration
                    const model = editor.getModel();
                    if (model) {
                      console.log('Model language:', model.getLanguageId());
                      console.log('Expected language:', currentFile ? getLanguageForFile(currentFile.fileName) : 'javascript');
                      console.log('Available languages:', monaco.languages.getLanguages().map(l => l.id).sort());
                    }
                    
                    // Ensure correct language is set
                    setTimeout(() => {
                      const model = editor.getModel();
                      if (model && currentFile) {
                        const expectedLang = getLanguageForFile(currentFile.fileName);
                        const currentLang = model.getLanguageId();
                        
                        // Only update if different
                        if (currentLang !== expectedLang) {
                          console.log(`Updating language from ${currentLang} to ${expectedLang}`);
                          monaco.editor.setModelLanguage(model, expectedLang);
                        }
                        
                        // For TSX/JSX files, ensure the model is configured correctly
                        if (currentFile.fileName.endsWith('.tsx') || currentFile.fileName.endsWith('.jsx')) {
                          const uri = model.uri.toString();
                          console.log('Model URI:', uri);
                          
                          // Ensure the file is recognized as TypeScript/JavaScript with JSX
                          if (currentFile.fileName.endsWith('.tsx')) {
                            monaco.editor.setModelLanguage(model, 'typescript');
                          } else if (currentFile.fileName.endsWith('.jsx')) {
                            monaco.editor.setModelLanguage(model, 'javascript');
                          }
                        }
                      }
                    }, 100);
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
              {shouldShowPreview && (
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
              {shouldShowPreview && (
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
                          // Zoom level is maintained across device switches
                          // This ensures that when going to fullscreen (desktop), 
                          // the user's zoom preference is preserved
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
                      
                      {/* Zoom controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px' }}>
                        <button
                          onClick={() => setZoomLevel(Math.max(100, zoomLevel - 25))}
                          style={{
                            padding: '4px 8px',
                            background: themeColors.background,
                            color: themeColors.foreground,
                            border: `1px solid ${themeColors.border}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            transition: 'all 0.2s',
                            ':hover': {
                              background: themeColors.backgroundSecondary
                            }
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = themeColors.backgroundSecondary}
                          onMouseOut={(e) => e.currentTarget.style.background = themeColors.background}
                          title="Zoom out"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          value={`${zoomLevel}%`}
                          onChange={(e) => {
                            const value = e.target.value.replace('%', '');
                            const num = parseInt(value, 10);
                            if (!isNaN(num)) {
                              const maxZoom = Math.round(100 / Math.abs(deviceScale));
                              setZoomLevel(Math.max(100, Math.min(maxZoom, num)));
                            }
                          }}
                          onBlur={(e) => {
                            // Ensure valid value on blur
                            const value = e.target.value.replace('%', '');
                            const num = parseInt(value, 10);
                            if (isNaN(num)) {
                              setZoomLevel(100);
                            }
                          }}
                          style={{
                            width: '60px',
                            padding: '4px 8px',
                            backgroundColor: themeColors.background,
                            color: themeColors.foreground,
                            border: `1px solid ${themeColors.border}`,
                            borderRadius: '4px',
                            fontSize: '12px',
                            textAlign: 'center'
                          }}
                        />
                        <button
                          onClick={() => {
                            // Max zoom is actual size (100% scale)
                            const maxZoom = Math.min(800, Math.round(100 / Math.abs(deviceScale)));
                            setZoomLevel(Math.min(maxZoom, zoomLevel + 10));
                          }}
                          style={{
                            padding: '4px 8px',
                            background: themeColors.background,
                            color: themeColors.foreground,
                            border: `1px solid ${themeColors.border}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = themeColors.backgroundSecondary}
                          onMouseOut={(e) => e.currentTarget.style.background = themeColors.background}
                          title={`Zoom in (max: ${Math.min(800, Math.round(100 / deviceScale))}%)`}
                        >
                          +
                        </button>
                        <button
                          onClick={() => setZoomLevel(100)}
                          style={{
                            padding: '4px 8px',
                            background: themeColors.background,
                            color: themeColors.foreground,
                            border: `1px solid ${themeColors.border}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            marginLeft: '4px',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = themeColors.backgroundSecondary}
                          onMouseOut={(e) => e.currentTarget.style.background = themeColors.background}
                          title="Reset zoom"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Preview iframe container */}
                  <div 
                    ref={previewContainerRef}
                    style={{
                      flex: 1,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '40px',
                      backgroundColor:  themeColors.background,
                      overflow: 'auto'
                    }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      width: '100%',
                      minHeight: '100%'
                    }}>
                      <div style={{
                        boxSizing: 'border-box',
                        width: previewDevice === 'custom' ? previewWidth : 
                              previewDevice === 'desktop' ? '1024px' : 
                              previewDevice === 'mobile' ? '375px' :
                              previewDevice === 'tablet' ? '768px' : 
                              devicePresets[previewDevice].width,
                        height: previewDevice === 'mobile' ? '812px' : 
                               previewDevice === 'tablet' ? '1024px' : 
                               previewDevice === 'desktop' ? 'auto' : '100%',
                        aspectRatio: previewDevice === 'desktop' ? '16 / 9' : 'auto',
                        maxHeight: 'none',
                        backgroundColor: currentTheme === 'vs-dark' ? '#1a1a1a' : '#2d2d2d',
                        boxShadow: '0 0 40px rgba(0, 0, 0, 0.3)',
                        position: 'relative',
                        borderRadius: previewDevice === 'mobile' ? '36px' : 
                                     previewDevice === 'tablet' ? '18px' : 
                                     previewDevice === 'desktop' ? '8px' : '0',
                        padding: previewDevice === 'mobile' ? '8px' : 
                                previewDevice === 'tablet' ? '16px' : 
                                previewDevice === 'desktop' ? '3px' : '0',
                        display: 'flex',
                        flexDirection: 'column',
                        marginBottom: previewDevice === 'desktop' ? '60px' : '0',
                        transform: (() => {
                          const scale = previewDevice === 'custom' ? zoomLevel / 100 : deviceScale * (zoomLevel / 100);
                          
                          // Calculate vertical offset to keep devices visible when scaled
                          let translateY = 0;
                          
                          if (previewDevice === 'desktop') {
                            // Desktop needs less vertical adjustment
                            translateY = scale * 50;
                          } else if (previewDevice === 'mobile' || previewDevice === 'tablet') {
                            // Move up by a percentage of the scaled height
                            translateY = scale * 50;
                            
                            if (isRotated) {
                              return `rotate(90deg) translateY(calc(${translateY}% - 25px)) scale(${Math.abs(scale)})`;
                            }
                          }
                          
                          return `translateY(${translateY}%) scale(${Math.abs(scale)})`;
                        })(),
                        transformOrigin: 'center',
                        transition: 'all 0.3s ease-in-out'
                      }}>
                      {/* Device frame decorations */}
                      {previewDevice === 'mobile' && (
                        <>
                          {/* Home indicator only */}
                          <div style={{
                            position: 'absolute',
                            bottom: isRotated ? '50%' : '8px',
                            right: isRotated ? '8px' : 'auto',
                            left: isRotated ? 'auto' : '50%',
                            transform: isRotated ? 'translateY(50%)' : 'translateX(-50%)',
                            width: isRotated ? '4px' : '100px',
                            height: isRotated ? '100px' : '4px',
                            backgroundColor: currentTheme === 'vs-dark' ? '#4a4a4a' : '#666',
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
                            top: isRotated ? '50%' : '8px',
                            left: isRotated ? '8px' : '50%',
                            transform: isRotated ? 'translateY(-50%)' : 'translateX(-50%)',
                            width: '8px',
                            height: '8px',
                            backgroundColor: currentTheme === 'vs-dark' ? '#4a4a4a' : '#666',
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
                            backgroundColor: currentTheme === 'vs-dark' ? '#4a4a4a' : '#666',
                            clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)'
                          }} />
                          <div style={{
                            position: 'absolute',
                            bottom: '-50px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '300px',
                            height: '10px',
                            backgroundColor: currentTheme === 'vs-dark' ? '#4a4a4a' : '#666',
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
                          srcDoc="<!DOCTYPE html><html><head><style>body{margin:0;padding:0;background:white;}</style></head><body></body></html>"
                        />
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Console pane - always mounted but hidden when not active */}
              <div style={{ display: activeTab === 'console' ? 'block' : 'none', height: '100%' }}>
                <ConsoleOutput outputs={consoleOutput} themeColors={themeColors} />
              </div>
              
              {/* Tests pane - always mounted but hidden when not active */}
              <div style={{ display: activeTab === 'tests' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
                <TestResults results={testResults} themeColors={themeColors} />
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
        srcDoc="<!DOCTYPE html><html><head></head><body></body></html>"
      />
    </div>
  );
});

MultiFileCodeDisplay.displayName = 'MultiFileCodeDisplay';

export default MultiFileCodeDisplay;