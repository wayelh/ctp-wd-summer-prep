import React, { useEffect, useState, useCallback, useRef, useContext } from 'react';
import Editor, { EditorProps, useMonaco } from '@monaco-editor/react';
import * as ts from 'typescript';
import { SlideContext } from 'spectacle';

interface CodeDisplayProps {
  fileName?: string;
  language?: string;
  height?: string;
  theme?: 'light' | 'dark' | 'vs-dark';
  readOnly?: boolean;
  onChange?: (value: string | undefined) => void;
  options?: any;
  children: string;
}

let lastURI = -1

const getURI = () => (++lastURI).toString()

interface ConsoleOutput {
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: Date;
}

export const CodeDisplay: React.FC<CodeDisplayProps> = ({
  fileName = '',
  language = 'javascript',
  height = "300px",
  theme = 'vs-dark',
  readOnly = false,
  onChange,
  options = {},
  children
}) => {
  const monaco = useMonaco()
  const slideContext = useContext(SlideContext);
  
  // Parse multiple code snippets separated by ---
  const codeSnippets = children.split(/\n\/\/ ---\s?\n/).map(s => s.trim());
  const [currentSnippetIndex, setCurrentSnippetIndex] = useState(0);
  const [value, setValue] = useState(codeSnippets[0] || '');
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  
  // Store edited versions of each snippet
  const [editedSnippets, setEditedSnippets] = useState<Record<number, string>>({});
  
  const [editor, setEditor] = useState<Parameters<Required<EditorProps>["onMount"]>[0] | null>(null)
  const [diffEditor, setDiffEditor] = useState<any>(null);
  const [consoleOutput, setConsoleOutput] = useState<ConsoleOutput[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const diffContainerRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<any>(null);
  const editorIdRef = useRef(getURI());
  const errorDecorationsRef = useRef<string[]>([]);

  // Track slide state
  const { isSlideActive, slideId } = slideContext;
  const wasActiveRef = useRef(isSlideActive);
  const lastSlideIdRef = useRef(slideId);

  // Dispose editor model when slide becomes inactive
  useEffect(() => {
    // Check if slide changed or became inactive
    const slideChanged = slideId !== lastSlideIdRef.current;
    const becameInactive = wasActiveRef.current && !isSlideActive;
    
    if (slideChanged || becameInactive) {
      console.log(`[CodeDisplay ${editorIdRef.current}] Slide changed or became inactive. Disposing resources...`);
      
      // Clear edited snippets when slide changes
      setEditedSnippets({});
      
      // Dispose the model
      if (modelRef.current && monaco) {
        try {
          modelRef.current.dispose();
          modelRef.current = null;
          console.log(`[CodeDisplay ${editorIdRef.current}] Model disposed successfully`);
        } catch (e) {
          console.warn(`[CodeDisplay ${editorIdRef.current}] Error disposing model:`, e);
        }
      }

      // Dispose diff editor if it exists
      if (diffEditor) {
        try {
          const originalModel = diffEditor.getModel()?.original;
          const modifiedModel = diffEditor.getModel()?.modified;
          
          if (originalModel) originalModel.dispose();
          if (modifiedModel) modifiedModel.dispose();
          diffEditor.dispose();
          
          setDiffEditor(null);
          console.log(`[CodeDisplay ${editorIdRef.current}] Diff editor disposed successfully`);
        } catch (e) {
          console.warn(`[CodeDisplay ${editorIdRef.current}] Error disposing diff editor:`, e);
        }
      }

      // Clear editor reference when slide becomes inactive
      if (becameInactive && editor) {
        setEditor(null);
      }
    }

    // Update refs
    wasActiveRef.current = isSlideActive;
    lastSlideIdRef.current = slideId;
  }, [isSlideActive, slideId, monaco, diffEditor, editor]);

  const handleEditorChange = (newValue: string | undefined) => {
    setValue(newValue || '');
    onChange?.(newValue);
    // Clear error highlights when code changes
    clearErrorHighlights();
    
    // Store the edited version if it differs from the original
    if (newValue !== codeSnippets[currentSnippetIndex]) {
      setEditedSnippets(prev => ({
        ...prev,
        [currentSnippetIndex]: newValue || ''
      }));
    }
  };

  // Update editor value when children prop changes or slide becomes active
  useEffect(() => {
    if (editor && monaco && isSlideActive) {
      try {
        let currentModel = modelRef.current;
        
        if (!currentModel || currentModel.isDisposed()) {
          // Create a new model if none exists or if it was disposed
          const uri = monaco.Uri.parse(`inmemory://model/${editorIdRef.current}`);
          currentModel = monaco.editor.createModel(value, language, uri);
          modelRef.current = currentModel;
          editor.setModel(currentModel);
          console.log(`[CodeDisplay ${editorIdRef.current}] Created new model for active slide`);
        } else if (currentModel.getValue() !== value) {
          // Update existing model value
          currentModel.setValue(value);
        }
        
        // Ensure proper layout after value change
        editor.layout();
      } catch (e) {
        console.error('Error updating editor value:', e);
        if (e instanceof Error) {
          console.error('Stack trace:', e.stack);
        }
      }
    }
  }, [editor, monaco, value, language, isSlideActive]);

  // Handle snippet navigation
  const navigateToSnippet = (index: number) => {
    if (index >= 0 && index < codeSnippets.length) {
      // Use edited version if available, otherwise use original
      const newValue = editedSnippets[index] || codeSnippets[index];
      
      // Store the current value as previous before switching
      if (index !== currentSnippetIndex) {
        setPreviousValue(value);
        setShowDiff(true);
      }
      
      setCurrentSnippetIndex(index);
      setValue(newValue);
      clearConsole();
      clearErrorHighlights();
    }
  };

  const nextSnippet = () => {
    navigateToSnippet(currentSnippetIndex + 1);
  };

  const previousSnippet = () => {
    navigateToSnippet(currentSnippetIndex - 1);
  };
  
  const resetCurrentSnippet = () => {
    const originalValue = codeSnippets[currentSnippetIndex];
    setValue(originalValue);
    // Remove the edited version
    setEditedSnippets(prev => {
      const newEdited = { ...prev };
      delete newEdited[currentSnippetIndex];
      return newEdited;
    });
    clearConsole();
    clearErrorHighlights();
  };

  // Create diff editor when monaco is available and showDiff is true
  useEffect(() => {
    if (monaco && diffContainerRef.current && showDiff && previousValue !== null && isSlideActive) {
      try {
        // Create diff editor
        const diffEditorInstance = monaco.editor.createDiffEditor(diffContainerRef.current, {
          theme: theme,
          readOnly: true,
          renderSideBySide: true,
          ignoreTrimWhitespace: false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
        });

        // Set the models
        const originalModel = monaco.editor.createModel(previousValue, language);
        const modifiedModel = monaco.editor.createModel(value, language);
        
        diffEditorInstance.setModel({
          original: originalModel,
          modified: modifiedModel,
        });

        setDiffEditor(diffEditorInstance);

        return () => {
          try {
            originalModel.dispose();
            modifiedModel.dispose();
            diffEditorInstance.dispose();
          } catch (e) {
            console.warn('Error disposing diff editor:', e);
          }
          setDiffEditor(null);
        };
      } catch (e) {
        console.warn('Error creating diff editor:', e);
        setShowDiff(false);
      }
    }
  }, [monaco, showDiff, previousValue, value, language, theme, isSlideActive]);

  const clearConsole = () => {
    setConsoleOutput([]);
  };

  const addConsoleOutput = (type: ConsoleOutput['type'], message: string) => {
    setConsoleOutput(prev => [...prev, { type, message, timestamp: new Date() }]);
    
    // If it's an error, try to highlight the line in the editor
    if (type === 'error' && editor && monaco) {
      highlightErrorInEditor(message);
    }
  };
  
  const highlightErrorInEditor = (errorMessage: string) => {
    if (!editor || !monaco) return;
    
    // Parse error stack to find line numbers
    // Match patterns like:
    // - at code.js:15:11
    // - at Object.<anonymous> (code.js:15:11)
    // - Error: message\n    at code.js:15:11
    const patterns = [
      /at\s+(?:.*?\s+)?(?:\()?code\.[jt]s:(\d+):(\d+)/,
      /at\s+code\.[jt]s:(\d+):(\d+)/,
      /\(code\.[jt]s:(\d+):(\d+)\)/,
      /code\.[jt]s:(\d+):(\d+)/,
      /Error:.*\n\s*at\s+.*?code\.[jt]s:(\d+):(\d+)/s,
      /^\s*at\s+.*?:(\d+):(\d+)/m
    ];
    
    let lineMatch = null;
    for (const pattern of patterns) {
      lineMatch = errorMessage.match(pattern);
      if (lineMatch) break;
    }
    
    if (!lineMatch) {
      // Try a more general pattern as fallback
      lineMatch = errorMessage.match(/:(\d+):(\d+)/);
      if (!lineMatch) return;
    }
    
    const lineNumber = parseInt(lineMatch[1], 10);
    const columnNumber = parseInt(lineMatch[2], 10);
    
    // Check if this is in the test section
    const codeLines = value.split('\n');
    const testSeparatorIndex = codeLines.findIndex(line => line.trim() === '// ***');
    const isTestError = testSeparatorIndex !== -1 && lineNumber > testSeparatorIndex;
    
    // Create decorations for the error line
    const decorations = [
      {
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          className: 'error-line-highlight',
          glyphMarginClassName: 'error-glyph',
          glyphMarginHoverMessage: { value: errorMessage },
          hoverMessage: { value: errorMessage },
          overviewRuler: {
            color: '#ff0000',
            position: monaco.editor.OverviewRulerLane.Right
          }
        }
      }
    ];
    
    // Add inline error message decoration
    if (columnNumber > 0) {
      decorations.push({
        range: new monaco.Range(lineNumber, columnNumber, lineNumber, columnNumber + 1),
        options: {
          className: 'error-squiggle',
          hoverMessage: { value: errorMessage },
          inlineClassName: 'error-inline'
        }
      });
    }
    
    // Apply decorations
    const newDecorations = editor.deltaDecorations(errorDecorationsRef.current, decorations);
    errorDecorationsRef.current = newDecorations;
  };
  
  const clearErrorHighlights = () => {
    if (editor && errorDecorationsRef.current.length > 0) {
      errorDecorationsRef.current = editor.deltaDecorations(errorDecorationsRef.current, []);
    }
  };

  const compileTypeScript = (code: string, fileName: string = 'code.ts'): { code: string; sourceMap?: string } => {
    try {
      const result = ts.transpileModule(code, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2015,
          jsx: ts.JsxEmit.React,
          esModuleInterop: true,
          sourceMap: true,
          inlineSourceMap: false
        },
        fileName: fileName
      });
      
      // Extract source map from output
      const sourceMapMatch = result.outputText.match(/\/\/# sourceMappingURL=(.+)$/m);
      if (sourceMapMatch && result.sourceMapText) {
        const cleanCode = result.outputText.replace(/\/\/# sourceMappingURL=.+$/m, '');
        return {
          code: cleanCode,
          sourceMap: result.sourceMapText
        };
      }
      
      return { code: result.outputText };
    } catch (error) {
      throw new Error(`TypeScript compilation error: ${error}`);
    }
  };

  const runCode = useCallback(async () => {
    setIsRunning(true);
    clearConsole();
    clearErrorHighlights();
    
    try {
      // Split code into main code and test code
      const codeLines = value.split('\n');
      const testSeparatorIndex = codeLines.findIndex(line => line.trim() === '// ***');
      
      let mainCode = value;
      let testCode = '';
      
      if (testSeparatorIndex !== -1) {
        mainCode = codeLines.slice(0, testSeparatorIndex).join('\n');
        testCode = codeLines.slice(testSeparatorIndex + 1).join('\n').trim();
      }
      
      // Compile TypeScript if needed
      let codeToRun = mainCode;
      let testCodeToRun = testCode;
      let mainSourceMap: string | undefined;
      let testSourceMap: string | undefined;
      
      if (language === 'typescript' || language === 'tsx') {
        try {
          const mainResult = compileTypeScript(mainCode, 'main.ts');
          codeToRun = mainResult.code;
          mainSourceMap = mainResult.sourceMap;
          
          if (testCode) {
            const testResult = compileTypeScript(testCode, 'test.ts');
            testCodeToRun = testResult.code;
            testSourceMap = testResult.sourceMap;
          }
        } catch (error: any) {
          addConsoleOutput('error', error.message);
          setIsRunning(false);
          return;
        }
      }
      
      // Generate unique ID for this execution
      const executionId = Date.now().toString();
      
      // Determine the filename for stack traces
      const fileName = language === 'typescript' || language === 'tsx' ? 'code.ts' : 'code.js';
      
      // Create a single module with both main and test code
      // This preserves variable scope while maintaining accurate line numbers
      let fullModule = codeToRun;
      
      if (testCodeToRun) {
        // Add the test separator and test code
        fullModule += '\n// ***\n' + testCodeToRun;
      }
      
      // Add source map if available
      if (mainSourceMap) {
        fullModule += `\n//# sourceMappingURL=data:application/json;base64,${btoa(mainSourceMap)}`;
      }
      
      // Create blob URL for the module
      const moduleBlob = new Blob([fullModule], { type: 'application/javascript' });
      const moduleUrl = URL.createObjectURL(moduleBlob);
      
      // Create runner script that imports and executes the module
      const runnerScript = `
// Get executionId from window
const executionId = window.executionId || '${executionId}';

// Override error handler to clean up blob URLs in stack traces
const originalConsoleError = console.error;
console.error = function(...args) {
  // Clean up stack traces in error messages
  const cleanedArgs = args.map(arg => {
    if (typeof arg === 'string') {
      // Replace blob URLs with just the filename
      // Handles formats like: blob:http://localhost:5173/uuid:line:col
      return arg.replace(/blob:[^:]+:\\/\\/[^/]+\\/[^:]+/g, '${fileName}');
    }
    return arg;
  });
  originalConsoleError.apply(console, cleanedArgs);
};

window.addEventListener('error', (event) => {
  if (event.error && event.error.stack) {
    event.error.stack = event.error.stack.replace(/blob:[^:]+:\\/\\/[^/]+\\/[^:]+/g, '${fileName}');
  }
});

let __testSeparatorLine = -1;
let __mainExecutionSuccess = true;

try {
  // Import the module
  await import('${moduleUrl}');
} catch (error) {
  // Check if error is in main code or test code
  const errorLine = error.stack?.match(/:(\d+):\d+/)?.[1];
  if (errorLine && __testSeparatorLine > 0 && parseInt(errorLine) > __testSeparatorLine) {
    // This is a test error
    console.log('\\n--- Running Tests ---');
    if (error.stack) {
      error.stack = error.stack.replace(/blob:[^:]+:\\/\\/[^/]+\\/[^:]+/g, '${fileName}');
    }
    console.error(error.stack || error.message || error.toString());
    console.log('✗ Test failed');
  } else {
    // This is a main code error
    __mainExecutionSuccess = false;
    if (error.stack) {
      error.stack = error.stack.replace(/blob:[^:]+:\\/\\/[^/]+\\/[^:]+/g, '${fileName}');
    }
    console.error(error.stack || error.message || error.toString());
  }
}

${testCodeToRun ? `
// If we have test code and main succeeded, show success
if (__mainExecutionSuccess) {
  // Find the test separator line
  const moduleText = await fetch('${moduleUrl}').then(r => r.text());
  const lines = moduleText.split('\\n');
  __testSeparatorLine = lines.findIndex(line => line.trim() === '// ***') + 1;
  
  // If no error was thrown, tests passed
  console.log('\\n--- Running Tests ---');
  console.log('✓ All tests passed');
}
` : ''}

// Clean up blob URL
URL.revokeObjectURL('${moduleUrl}');
`;

      const runnerBlob = new Blob([runnerScript], { type: 'application/javascript' });
      const runnerUrl = URL.createObjectURL(runnerBlob);
      
      // Create iframe content with script tags pointing to blob URLs
      const iframeContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <script>
            const executionId = '${executionId}';
            window.executionId = executionId; // Make it available globally
            
            // Override console methods to send messages to parent
            const originalConsole = {
              log: console.log,
              error: console.error,
              warn: console.warn,
              info: console.info
            };
            
            ['log', 'error', 'warn', 'info'].forEach(method => {
              console[method] = function(...args) {
                // Send to parent first
                try {
                  window.parent.postMessage({
                    type: 'console',
                    executionId: window.executionId,
                    method: method,
                    args: args.map(arg => {
                      try {
                        if (arg === undefined) return 'undefined';
                        if (arg === null) return 'null';
                        if (typeof arg === 'object') {
                          return JSON.stringify(arg, null, 2);
                        }
                        return String(arg);
                      } catch (e) {
                        return String(arg);
                      }
                    })
                  }, '*');
                } catch (e) {
                  // Fallback if postMessage fails
                  originalConsole.error('Failed to send console message to parent:', e);
                }
                
                // Call original method
                originalConsole[method].apply(console, args);
              };
            });
            
            // Notify parent that console is ready
            window.parent.postMessage({
              type: 'console-ready',
              executionId: window.executionId
            }, '*');
            
            // Catch errors with better stack traces
            window.addEventListener('error', (event) => {
              let errorMsg = event.message;
              
              // Clean up the error message and stack trace
              if (event.error && event.error.stack) {
                // Replace blob URL with readable filename
                event.error.stack = event.error.stack.replace(/blob:[^:]+:\\/\\/[^/]+\\/[^:]+/g, '${fileName}');
                errorMsg = event.error.stack;
              } else if (event.filename && event.filename.includes('blob:')) {
                // If no stack trace, at least show line info
                errorMsg += ' (at ${fileName}:' + event.lineno + ':' + event.colno + ')';
              }
              
              window.parent.postMessage({
                type: 'console',
                executionId: window.executionId,
                method: 'error',
                args: [errorMsg]
              }, '*');
              event.preventDefault();
            });
            
            window.addEventListener('unhandledrejection', (event) => {
              window.parent.postMessage({
                type: 'console',
                executionId: window.executionId,
                method: 'error',
                args: ['Unhandled Promise Rejection: ' + String(event.reason)]
              }, '*');
              event.preventDefault();
            });
          </script>
        </head>
        <body>
          <script type="module">
            // Import and run the runner module
            import('${runnerUrl}').then(() => {
              // Notify completion after script execution
              setTimeout(() => {
                window.parent.postMessage({
                  type: 'execution-complete',
                  executionId: window.executionId
                }, '*');
              }, 50);
            }).catch(error => {
              console.error('Failed to run code:', error);
              window.parent.postMessage({
                type: 'execution-complete',
                executionId: window.executionId
              }, '*');
            });
          </script>
        </body>
        </html>
      `;
      
      // Set up message listener before setting iframe content
      let executionComplete = false;
      const messageHandler = (event: MessageEvent) => {
        if (!event.data || event.data.executionId !== executionId) {
          return;
        }
        
        if (event.data.type === 'console') {
          const message = event.data.args.join(' ');
          addConsoleOutput(event.data.method as ConsoleOutput['type'], message);
        } else if (event.data.type === 'console-ready') {
          console.log('Console ready in iframe');
        } else if (event.data.type === 'execution-complete') {
          executionComplete = true;
          // Give a bit more time for any pending messages
          setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            setIsRunning(false);
            // Clean up blob URLs
            URL.revokeObjectURL(runnerUrl);
            // Main and test URLs are cleaned up in the runner script
          }, 100);
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Create or update iframe
      if (iframeRef.current) {
        // Clear previous content first
        iframeRef.current.srcdoc = '';
        
        // Small delay to ensure iframe is cleared
        setTimeout(() => {
          if (iframeRef.current) {
            iframeRef.current.srcdoc = iframeContent;
          }
        }, 10);
      } else {
        console.error('Iframe ref is null');
        addConsoleOutput('error', 'Failed to initialize code execution environment');
        setIsRunning(false);
        return;
      }
      
      // Fallback cleanup after max time
      setTimeout(() => {
        if (!executionComplete) {
          window.removeEventListener('message', messageHandler);
          setIsRunning(false);
          addConsoleOutput('warn', 'Code execution timed out');
        }
      }, 5000);
      
    } catch (error: any) {
      addConsoleOutput('error', `Runtime error: ${error.message}`);
      setIsRunning(false);
    }
  }, [value, language, clearErrorHighlights]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Clean up the model on unmount
      if (modelRef.current && monaco) {
        try {
          modelRef.current.dispose();
          modelRef.current = null;
        } catch (e) {
          console.warn('Error during cleanup:', e);
        }
      }
    }
  }, [monaco])

  const defaultOptions = {
    minimap: { enabled: true },
    fontSize: 14,
    lineNumbers: 'on',
    roundedSelection: false,
    scrollBeyondLastLine: false,
    readOnly,
    automaticLayout: true,
    padding: { top: 10, bottom: 10 },
    ...options
  };

  // Only render the editor when the slide is active
  if (!isSlideActive) {
    return (
      <div className="code-display-container" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
        <div className="macos-window" style={{ minHeight: height }}>
          <div className="macos-titlebar">
            <div className="macos-controls">
              <div className="macos-control macos-close"></div>
              <div className="macos-control macos-minimize"></div>
              <div className="macos-control macos-maximize"></div>
            </div>
            <div className="macos-title">{fileName}</div>
          </div>
          <div className="window-content" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#666', fontStyle: 'italic' }}>Editor will load when slide is active</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="code-display-container" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="macos-window">
        <div className="macos-titlebar">
          <div className="macos-controls">
            <div className="macos-control macos-close"></div>
            <div className="macos-control macos-minimize"></div>
            <div className="macos-control macos-maximize"></div>
          </div>
          <div className="macos-title">{fileName}</div>
          <div className="macos-actions">
            {codeSnippets.length > 1 && (
              <>
                <button 
                  className="action-button" 
                  onClick={previousSnippet}
                  disabled={currentSnippetIndex === 0}
                  title="Previous snippet"
                >
                  ←
                </button>
                <span className="snippet-indicator">
                  {currentSnippetIndex + 1} / {codeSnippets.length}
                </span>
                <button 
                  className="action-button" 
                  onClick={nextSnippet}
                  disabled={currentSnippetIndex === codeSnippets.length - 1}
                  title="Next snippet"
                >
                  →
                </button>
                {showDiff && (
                  <button 
                    className="action-button" 
                    onClick={() => setShowDiff(false)}
                    title="Hide diff"
                  >
                    Hide Diff
                  </button>
                )}
                {editedSnippets[currentSnippetIndex] && (
                  <button 
                    className="action-button reset-button" 
                    onClick={resetCurrentSnippet}
                    title="Reset to original code"
                  >
                    Reset
                  </button>
                )}
              </>
            )}
            <button className="action-button" onClick={clearConsole} title="Clear console">
              Clear
            </button>
            <button 
              className="action-button run-button" 
              onClick={runCode} 
              disabled={isRunning}
              title="Run code"
            >
              {isRunning ? 'Running...' : 'Run'}
            </button>
          </div>
        </div>
        <div className="window-content">
          <div className="editor-pane">
          <Editor
            height={height}
            width={'800px'}
            language={language}
            value={value}
            theme={theme}
            onChange={handleEditorChange}
            options={defaultOptions}
            onMount={(editorInstance, monacoInstance) => {
              setEditor(editorInstance);
              // Ensure the editor has a model
              if (!editorInstance.getModel() && monacoInstance) {
                const uri = monacoInstance.Uri.parse(`inmemory://model/${editorIdRef.current}`);
                const model = monacoInstance.editor.createModel(value, language, uri);
                modelRef.current = model;
                editorInstance.setModel(model);
              } else {
                modelRef.current = editorInstance.getModel();
              }
            }}
            beforeMount={(monaco) => {
              // Configure intellisense
              monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.Latest,
                allowNonTsExtensions: true,
                moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                module: monaco.languages.typescript.ModuleKind.CommonJS,
                noEmit: true,
                esModuleInterop: true,
                jsx: monaco.languages.typescript.JsxEmit.React,
                reactNamespace: 'React',
                allowJs: true,
                typeRoots: ['node_modules/@types']
              });

              monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: false,
                noSyntaxValidation: false,
                onlyVisible: true
              });

              // Add type definitions for better intellisense
              monaco.languages.typescript.javascriptDefaults.addExtraLib(
                `
                declare module 'react' {
                  export = React;
                }
                declare const React: any;
                declare const console: any;
                declare const window: any;
                declare const document: any;
                `,
                'global.d.ts'
              );
            }}

          />
          {showDiff && previousValue !== null && (
            <div className="diff-editor-container">
              <div className="diff-header">
                <span className="diff-title">Changes from previous version</span>
              </div>
              <div ref={diffContainerRef} className="diff-editor" style={{ height: '200px' }} />
            </div>
          )}
          </div>
          <div className="console-pane">
            <div className="console-header">
              <span className="console-title">Console</span>
            </div>
            <div className="console-output">
              {consoleOutput.length === 0 ? (
                <div className="console-empty">Click Run to execute code</div>
              ) : (
                consoleOutput.map((output, index) => {
                  const isTestSeparator = output.message.includes('--- Running Tests ---');
                  const isTestPass = output.message.includes('✓ All tests passed');
                  const isTestFail = output.message.includes('✗ Test failed:');
                  
                  let className = `console-line console-${output.type}`;
                  if (isTestSeparator) className += ' console-test-separator';
                  if (isTestPass) className += ' console-test-pass';
                  if (isTestFail) className += ' console-test-fail';
                  
                  return (
                    <div key={index} className={className}>
                      <span className="console-timestamp">
                        {output.timestamp.toLocaleTimeString()}
                      </span>
                      <span className="console-message">{output.message}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .code-display-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        /* Error highlighting styles */
        .error-line-highlight {
          background-color: rgba(255, 0, 0, 0.1);
          border-left: 3px solid #ff0000;
        }
        
        .error-glyph {
          background-color: #ff0000;
          color: white;
          border-radius: 50%;
          width: 12px !important;
          height: 12px !important;
          margin: 6px;
        }
        
        .error-glyph::before {
          content: '!';
          position: absolute;
          left: 4px;
          top: -2px;
          font-size: 10px;
          font-weight: bold;
        }
        
        .error-squiggle {
          text-decoration: underline wavy #ff0000;
        }
        
        .error-inline {
          border-bottom: 2px solid #ff0000;
        }

        .window-content {
          display: flex;
          height: ${height};
          overflow: visible;
        }

        .editor-pane {
          flex: 1;
          border-right: 1px solid #2d2d2d;
          overflow: visible;
          display: flex;
          flex-direction: column;
        }

        .console-pane {
          width: 350px;
          display: flex;
          flex-direction: column;
          background: #1a1a1a;
        }

        .console-header {
          background: #252526;
          padding: 10px 15px;
          border-bottom: 1px solid #2d2d2d;
        }

        .console-title {
          color: #cccccc;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .console-output {
          flex: 1;
          padding: 10px;
          overflow-y: auto;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }

        .console-empty {
          color: #666;
          font-style: italic;
          font-size: 13px;
        }

        .console-line {
          font-size: 12px;
          line-height: 1.6;
          margin-bottom: 4px;
          display: flex;
          gap: 8px;
        }

        .console-timestamp {
          color: #666;
          font-size: 11px;
          min-width: 65px;
        }

        .console-message {
          flex: 1;
          word-break: break-word;
          white-space: pre-wrap;
        }

        .console-log .console-message {
          color: #cccccc;
        }

        .console-error .console-message {
          color: #ff6b6b;
        }

        .console-warn .console-message {
          color: #ffd93d;
        }

        .console-info .console-message {
          color: #6bcfff;
        }

        .console-test-separator {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #333;
        }

        .console-test-separator .console-message {
          color: #a78bfa;
          font-weight: 600;
        }

        .console-test-pass .console-message {
          color: #4ade80;
          font-weight: 600;
        }

        .console-test-fail .console-message {
          color: #ff6b6b;
          font-weight: 600;
        }

        .macos-window {
          background: #1e1e1e;
          border-radius: 8px;
          box-shadow: 0 22px 70px 4px rgba(0, 0, 0, 0.56);
          overflow: visible;
          border: 1px solid #444;
          flex: 1;
          width: 100%;
          max-width: 1200px;
          min-width: 1000px;
        }

        .macos-titlebar {
          background: #323233;
          height: 38px;
          display: flex;
          align-items: center;
          padding: 0 20px;
          position: relative;
          user-select: none;
        }

        .macos-controls {
          display: flex;
          gap: 8px;
          position: absolute;
          left: 20px;
        }

        .macos-actions {
          position: absolute;
          right: 20px;
          display: flex;
          gap: 8px;
        }

        .action-button {
          background: #404040;
          border: 1px solid #555;
          color: #cccccc;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .action-button:hover:not(:disabled) {
          background: #4a4a4a;
          border-color: #666;
        }

        .action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .run-button {
          background: #28a745;
          border-color: #28a745;
          color: white;
        }

        .run-button:hover:not(:disabled) {
          background: #218838;
          border-color: #1e7e34;
        }
        
        .reset-button {
          background: #dc3545;
          border-color: #dc3545;
          color: white;
        }
        
        .reset-button:hover:not(:disabled) {
          background: #c82333;
          border-color: #bd2130;
        }

        .snippet-indicator {
          color: #cccccc;
          font-size: 11px;
          padding: 0 8px;
          display: flex;
          align-items: center;
        }

        .diff-editor-container {
          border-top: 1px solid #2d2d2d;
          background: #1a1a1a;
        }

        .diff-header {
          background: #252526;
          padding: 8px 15px;
          border-bottom: 1px solid #2d2d2d;
        }

        .diff-title {
          color: #cccccc;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .diff-editor {
          width: 100%;
        }

        .macos-control {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          transition: opacity 0.15s;
        }

        .macos-control:hover {
          opacity: 0.8;
        }

        .macos-close {
          background: #ff5f57;
          border: 1px solid #e0443e;
        }

        .macos-minimize {
          background: #ffbd2e;
          border: 1px solid #dea123;
        }

        .macos-maximize {
          background: #28c940;
          border: 1px solid #14aa2f;
        }

        .macos-title {
          flex: 1;
          text-align: center;
          color: #cccccc;
          font-size: 13px;
          font-weight: 500;
        }

        .editor-container {
          border-top: 1px solid #2d2d2d;
        }
      `}</style>
      
      {/* Hidden iframe for code execution */}
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
};

export default CodeDisplay;