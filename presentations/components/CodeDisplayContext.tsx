import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface FileData {
  fileName: string;
  versions: string[];
}

interface CodeDisplayContextType {
  files: Record<string, FileData>;
  tests: string[];
  addFile: (fileName: string) => void;
  addVersion: (fileName: string, code: string) => void;
  addTest: (code: string) => void;
  setCurrentFile: (fileName: string) => void;
  currentFile: string | null;
  isInTestContext: boolean;
  setIsInTestContext: (value: boolean) => void;
}

export const CodeDisplayContext = createContext<CodeDisplayContextType | null>(null);

export const useCodeDisplay = () => {
  const context = useContext(CodeDisplayContext);
  if (!context) {
    throw new Error('useCodeDisplay must be used within CodeDisplayProvider');
  }
  return context;
};

// Helper to check if we're inside a CodeDisplay context
export const useIsInsideCodeDisplay = () => {
  const context = useContext(CodeDisplayContext);
  return context !== null;
};

export const CodeDisplayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<Record<string, FileData>>({});
  const [tests, setTests] = useState<string[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [isInTestContext, setIsInTestContext] = useState(false);

  const addFile = (fileName: string) => {
    setFiles(prev => ({
      ...prev,
      [fileName]: { fileName, versions: [] }
    }));
    setCurrentFile(fileName);
  };

  const addVersion = (fileName: string, code: string) => {
    setFiles(prev => {
      const currentVersions = prev[fileName]?.versions || [];
      // Don't add duplicate versions
      if (currentVersions.includes(code)) {
        return prev;
      }
      
      return {
        ...prev,
        [fileName]: {
          ...prev[fileName],
          versions: [...currentVersions, code]
        }
      };
    });
  };

  const addTest = (code: string) => {
    setTests(prev => {
      // Don't add duplicate tests
      if (prev.includes(code)) {
        return prev;
      }
      return [...prev, code];
    });
  };

  const value = {
    files,
    tests,
    addFile,
    addVersion,
    addTest,
    setCurrentFile,
    currentFile,
    isInTestContext,
    setIsInTestContext
  };

  return (
    <CodeDisplayContext.Provider value={value}>
      {children}
    </CodeDisplayContext.Provider>
  );
};

// File component
export const File: React.FC<{ name: string; children: React.ReactNode }> = ({ name, children }) => {
  const { addFile, setCurrentFile, addVersion } = useCodeDisplay();
  const initializedRef = useRef(false);
  const processedContentRef = useRef<Set<string>>(new Set());
  const childrenProcessedRef = useRef(false);

  useEffect(() => {
    // Initialize file and process children on first render
    if (!initializedRef.current) {
      console.log(`[File ${name}] Initializing with children type:`, typeof children, Array.isArray(children) ? 'array' : React.isValidElement(children) ? 'React element' : 'other');
      addFile(name);
      setCurrentFile(name);
      initializedRef.current = true;
      
      // Process children to extract code blocks
      const processNode = (node: React.ReactNode): void => {
        if (!node) return;
        
        // If it's a string, check for markdown code blocks
        if (typeof node === 'string') {
          const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
          let match;
          while ((match = codeBlockRegex.exec(node)) !== null) {
            const code = match[1].trim();
            if (code && !processedContentRef.current.has(code)) {
              console.log(`[File ${name}] Found code block from string:`, code.substring(0, 50) + '...');
              processedContentRef.current.add(code);
              addVersion(name, code);
            }
          }
        }
        
        // If it's an array, process each child
        if (Array.isArray(node)) {
          node.forEach(processNode);
        }
        
        // If it's a React element
        if (React.isValidElement(node)) {
          // Check if it's a pre element (MDX converts code blocks to pre)
          if (node.type === 'pre') {
            const codeElement = node.props.children;
            
            // Check if it's a code element (could be a function component)
            if (React.isValidElement(codeElement)) {
              const codeContent = codeElement.props?.children;
              if (typeof codeContent === 'string' && codeContent.trim() && !processedContentRef.current.has(codeContent.trim())) {
                console.log(`[File ${name}] Found code block from pre element:`, codeContent.trim().substring(0, 50) + '...');
                processedContentRef.current.add(codeContent.trim());
                addVersion(name, codeContent.trim());
                return;
              }
            }
          }
          
          // Skip if it's already a Version component
          if ((node.type as any)?.name === 'Version') {
            return;
          }
          
          // Otherwise process its children
          processNode(node.props?.children);
        }
      };
    
      processNode(children);
      console.log(`[File ${name}] Processing complete. Versions added:`, processedContentRef.current.size);
    }
  }, [name, addFile, setCurrentFile, addVersion]); // Dependencies for initialization

  return <div style={{ display: 'none' }} />; // Render invisible placeholder
};

// Version component - unified component that handles both tests and file versions based on context
export const Version: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentFile, addVersion, addTest, isInTestContext } = useCodeDisplay();
  const processedRef = useRef(false);

  useEffect(() => {
    // Only process once per component instance
    if (processedRef.current) return;
    
    if (children) {
      // Extract code from the children  
      let code = '';
      
      if (typeof children === 'string') {
        code = children;
      } else if (React.isValidElement(children)) {
        // If it's a React element (like a pre/code block from MDX)
        const extractCode = (element: any): string => {
          if (typeof element === 'string') return element;
          if (!element) return '';
          
          // Check if it's a code block element
          if (element.props?.children) {
            if (typeof element.props.children === 'string') {
              return element.props.children;
            } else if (Array.isArray(element.props.children)) {
              return element.props.children.map(extractCode).join('');
            } else if (React.isValidElement(element.props.children)) {
              return extractCode(element.props.children);
            }
          }
          return '';
        };
        
        code = extractCode(children);
      }
      
      
      if (code.trim()) {
        // Determine if we should add as test or version based on context
        if (isInTestContext) {
          addTest(code.trim());
        } else if (currentFile && currentFile !== '__tests__') {
          addVersion(currentFile, code.trim());
        }
        processedRef.current = true;
      }
    }
  }, [currentFile, addVersion, addTest, isInTestContext]); // Remove children from dependencies

  return null; // This component doesn't render anything
};

// Helper function to extract code from elements
const extractCodeFromElement = (element: any): string => {
  if (typeof element === 'string') return element;
  if (!element) return '';
  
  if (element.props?.children) {
    if (typeof element.props.children === 'string') {
      return element.props.children;
    } else if (Array.isArray(element.props.children)) {
      return element.props.children.map(extractCodeFromElement).join('');
    } else if (React.isValidElement(element.props.children)) {
      return extractCodeFromElement(element.props.children);
    }
  }
  return '';
};

// Tests component
export const Tests: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setIsInTestContext, addTest } = useCodeDisplay();
  const initializedRef = useRef(false);
  
  useEffect(() => {
    setIsInTestContext(true);
    
    if (!initializedRef.current) {
      initializedRef.current = true;
      
      // Process children to extract test code blocks
      const processNode = (node: React.ReactNode): void => {
        if (!node) return;
        
        // If it's a string, check for markdown code blocks
        if (typeof node === 'string') {
          const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
          let match;
          while ((match = codeBlockRegex.exec(node)) !== null) {
            const code = match[1].trim();
            if (code) {
              addTest(code);
            }
          }
        }
        
        // If it's an array, process each child
        if (Array.isArray(node)) {
          node.forEach(processNode);
        }
        
        // If it's a React element
        if (React.isValidElement(node)) {
          // Check if it's a pre element (MDX converts code blocks to pre)
          if (node.type === 'pre') {
            const codeElement = node.props.children;
            
            // Check if it's a code element (could be a function component)
            if (React.isValidElement(codeElement)) {
              const codeContent = codeElement.props?.children;
              if (typeof codeContent === 'string' && codeContent.trim()) {
                addTest(codeContent.trim());
                return;
              }
            }
          }
          
          // Otherwise process its children
          processNode(node.props?.children);
        }
      };
      
      processNode(children);
    }
    
    return () => setIsInTestContext(false);
  }, [setIsInTestContext, addTest]); // Remove children from deps to avoid re-processing
  
  return <div style={{ display: 'none' }} />; // Render invisible placeholder
};

// TestVersion is now just an alias for Version - it will automatically detect it's in a test context
export const TestVersion = Version;