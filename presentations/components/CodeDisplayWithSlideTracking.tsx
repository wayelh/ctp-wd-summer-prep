import React, { useEffect, useState, useCallback, useRef, useContext } from 'react';
import Editor, { EditorProps, useMonaco } from '@monaco-editor/react';
import * as ts from 'typescript';
import { SlideContext } from 'spectacle';
import MultiFileCodeDisplay from './MultiFileCodeDisplay';
import { CodeDisplayProvider, useCodeDisplay } from './CodeDisplayContext';

// Hook to calculate available height for code display
const useAvailableHeight = () => {
  const [availableHeight, setAvailableHeight] = useState('500px');
  
  useEffect(() => {
    const calculateHeight = () => {
      // Get viewport height
      const viewportHeight = window.innerHeight;
      
      // Account for Spectacle's slide padding and navigation controls
      // Typical Spectacle layout has ~100px top padding and ~100px bottom controls
      const reservedHeight = 200;
      
      // Calculate available height
      const calculatedHeight = viewportHeight - reservedHeight;
      
      // Set minimum height to ensure usability
      const finalHeight = Math.max(calculatedHeight, 400);
      
      setAvailableHeight(`${finalHeight}px`);
    };
    
    // Calculate on mount and resize
    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);
  
  return availableHeight;
};

interface CodeDisplayProps {
  fileName?: string;
  language?: string;
  height?: string;
  theme?: 'light' | 'dark' | 'vs-dark';
  readOnly?: boolean;
  onChange?: (value: string | undefined) => void;
  options?: any;
  children?: string;
  // New props for multi-file support
  files?: Array<{
    fileName: string;
    language: 'html' | 'css' | 'javascript' | 'typescript' | 'tsx' | 'jsx';
    content: string;
  }>;
  multiFile?: boolean;
  // New object-based code structure
  code?: {
    [fileName: string]: string | string[];
  };
  tests?: string | string[];
}

let lastURI = -1

const getURI = () => (++lastURI).toString()

interface ConsoleOutput {
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: Date;
}

const getLanguageFromExtension = (ext: string): 'html' | 'css' | 'javascript' | 'typescript' | 'tsx' | 'jsx' => {
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

// Inner component that can use context
const CodeDisplayInner: React.FC<CodeDisplayProps> = ({
  fileName = '',
  language = 'javascript',
  height = "100vh",
  theme = 'vs-dark',
  readOnly = false,
  onChange,
  options = {},
  children,
  files,
  multiFile = false,
  code,
  tests
}) => {
  const monaco = useMonaco()
  const slideContext = useContext(SlideContext);
  
  // Try to use context if available
  let contextData = null;
  try {
    contextData = useCodeDisplay();
    console.log('[CodeDisplayInner] Context data:', contextData);
  } catch (e) {
    console.log('[CodeDisplayInner] No context available');
    // Context not available, proceed without it
  }


  // If context is available and has data, use it
  if (contextData) {
    console.log('[CodeDisplayInner] Files in context:', Object.keys(contextData.files));
    console.log('[CodeDisplayInner] Tests in context:', contextData.tests.length);
    // Convert context data to the expected format
    const filesList = Object.values(contextData.files)
      .filter(file => file.fileName) // Include all files with names
      .map(file => ({
        fileName: file.fileName,
        language: getLanguageFromExtension(file.fileName.split('.').pop() || ''),
        content: file.versions.length > 0 ? file.versions[0] : '// No code yet', // Start with first version
        versions: file.versions.length > 0 ? file.versions : ['// No code yet']
      }));

    // Add tests if available
    if (contextData.tests.length > 0) {
      filesList.push({
        fileName: 'tests.js',
        language: 'javascript' as any,
        content: contextData.tests[0] || '', // Start with first test version
        versions: contextData.tests
      });
    }

    // Only render if we have files to show
    if (filesList.length > 0) {
      console.log('[CodeDisplayInner] Rendering with files:', filesList.map(f => f.fileName));
      return (
        <MultiFileCodeDisplay
          files={filesList}
          height={height}
          theme={theme}
          readOnly={readOnly}
          onChange={onChange}
          options={options}
          enableVersions={true}
        />
      );
    } else {
      console.log('[CodeDisplayInner] No files to show');
    }
  }
  
  // If using new object-based code structure
  if (code) {
    // Convert code object to files array
    const filesList = Object.entries(code).map(([fileName, content]) => {
      const ext = fileName.split('.').pop() || '';
      const lang = getLanguageFromExtension(ext);
      
      // If content is an array, use the last version by default
      const fileContent = Array.isArray(content) ? content[content.length - 1] : content;
      
      return {
        fileName,
        language: lang,
        content: fileContent,
        versions: Array.isArray(content) ? content : [content]
      };
    });
    
    // Add tests file if provided
    if (tests) {
      const testContent = Array.isArray(tests) ? tests[tests.length - 1] : tests;
      filesList.push({
        fileName: 'tests.js',
        language: 'javascript' as any,
        content: testContent,
        versions: Array.isArray(tests) ? tests : [tests]
      });
    }
    
    return (
      <MultiFileCodeDisplay
        files={filesList}
        height={height}
        theme={theme}
        readOnly={readOnly}
        onChange={onChange}
        options={options}
        enableVersions={true}
      />
    );
  }
  
  // Always use MultiFileCodeDisplay for consistency
  // If files are provided directly, use them
  if (files) {
    return (
      <MultiFileCodeDisplay
        files={files}
        height={height}
        theme={theme}
        readOnly={readOnly}
        onChange={(fname, value) => {
          if (fname === (fileName || 'index.js')) {
            onChange?.(value);
          }
        }}
        options={options}
      />
    );
  }
  
  // If children is not a string (context-based approach), return early
  if (children && typeof children !== 'string') {
    // Children are React components, not code string
    // This should have been handled by the parent component
    return null;
  }
  
  // Convert single file code to MultiFileCodeDisplay format
  // Create a single file with the provided filename or default
  const singleFile = {
    fileName: fileName || 'app.js',
    language: getLanguageFromExtension(fileName ? fileName.split('.').pop() || '' : 'js'),
    content: children || '',
    versions: (children || '').split(/\n\/\/ ---\s?\n/).map(s => s.trim()).filter(Boolean)
  };

  return (
    <MultiFileCodeDisplay
      files={[singleFile]}
      height={height}
      theme={theme}
      readOnly={readOnly}
      onChange={(fname, value) => {
        if (fname === singleFile.fileName) {
          onChange?.(value);
        }
      }}
      options={options}
      enableVersions={singleFile.versions.length > 1}
    />
  );
};

CodeDisplayInner.displayName = 'CodeDisplayInner';

// Component that renders after context is ready
const CodeDisplayWithContext: React.FC<{ height?: string }> = ({ height }) => {
  const context = useCodeDisplay();
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    // Check if we have files with actual versions
    const hasContent = Object.values(context.files).some(file => file.versions.length > 0) || context.tests.length > 0;
    
    if (hasContent && !isReady) {
      setIsReady(true);
    } else if (!hasContent && !isReady) {
      // Wait a bit for File components to process
      const timer = setTimeout(() => {
        const hasContentAfterWait = Object.values(context.files).some(file => file.versions.length > 0) || context.tests.length > 0;
        if (hasContentAfterWait) {
          setIsReady(true);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [context.files, context.tests, isReady]);
  
  if (!isReady) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Loading...</p>
    </div>;
  }
  
  return <CodeDisplayInner height={height} />;
};

// Wrapper component that provides context support
export const CodeDisplay: React.FC<CodeDisplayProps & { children?: React.ReactNode }> = (props) => {
  // Extract only the props we need, filtering out any MDX-specific props
  const calculatedHeight = useAvailableHeight();
  const { children, height = calculatedHeight, ...otherProps } = props;
  
  // If children are provided and they're not just a string, assume context usage
  if (children && typeof children !== 'string') {
    console.log('[CodeDisplay] Using context mode for children type:', typeof children, 'isArray:', Array.isArray(children), 'childrenCount:', React.Children.count(children));
    
    // Check if children is a problematic object
    if (children && typeof children === 'object' && !React.isValidElement(children) && !Array.isArray(children)) {
      console.error('[CodeDisplay] Invalid object passed as children:', children);
      return null;
    }
    
    return (
      <CodeDisplayProvider>
        <div 
          style={{ 
            width: '100%', 
            height: height, 
            overflow: 'hidden', 
            outline: 'none',
            display: 'flex',
            flexDirection: 'column'
          }}
          tabIndex={0}
        >
          {children}
          <CodeDisplayWithContext height="100%" />
        </div>
      </CodeDisplayProvider>
    );
  }
  
  // Otherwise use the component directly
  return (
    <div 
      style={{ 
        width: '100%', 
        height: height, 
        overflow: 'hidden', 
        outline: 'none',
        display: 'flex',
        flexDirection: 'column'
      }}
      tabIndex={0}
    >
      <CodeDisplayInner 
        fileName={otherProps.fileName}
        language={otherProps.language}
        theme={otherProps.theme}
        readOnly={otherProps.readOnly}
        onChange={otherProps.onChange}
        options={otherProps.options}
        files={otherProps.files}
        multiFile={otherProps.multiFile}
        code={otherProps.code}
        tests={otherProps.tests}
        height="100%" 
        children={children} 
      />
    </div>
  );
};

// Re-export context components for MDX usage
export { File, Version, Tests, TestVersion } from './CodeDisplayContext';

// Export a custom slide layout for code exercises
export const CodeSlideLayout: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '40px 20px 20px 20px',
      boxSizing: 'border-box'
    }}>
      {title && (
        <h2 style={{
          margin: '0 0 20px 0',
          fontSize: '2rem',
          fontWeight: 'bold',
          color: '#333'
        }}>
          {title}
        </h2>
      )}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {children}
      </div>
    </div>
  );
};

export default CodeDisplay;
