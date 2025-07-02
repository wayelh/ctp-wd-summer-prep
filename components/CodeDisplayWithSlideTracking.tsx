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
  
  const [editor, setEditor] = useState<Parameters<Required<EditorProps>["onMount"]>[0] | null>(null)
  const [diffEditor, setDiffEditor] = useState<any>(null);
  const [consoleOutput, setConsoleOutput] = useState<ConsoleOutput[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const diffContainerRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<any>(null);
  const editorIdRef = useRef(getURI());

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
      const newValue = codeSnippets[index];
      
      // Store the current value as previous before switching
      if (index !== currentSnippetIndex) {
        setPreviousValue(value);
        setShowDiff(true);
      }
      
      setCurrentSnippetIndex(index);
      setValue(newValue);
      clearConsole();
    }
  };

  const nextSnippet = () => {
    navigateToSnippet(currentSnippetIndex + 1);
  };

  const previousSnippet = () => {
    navigateToSnippet(currentSnippetIndex - 1);
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
  };

  const compileTypeScript = (code: string): string => {
    try {
      const result = ts.transpileModule(code, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2015,
          jsx: ts.JsxEmit.React,
          esModuleInterop: true
        }
      });
      return result.outputText;
    } catch (error) {
      throw new Error(`TypeScript compilation error: ${error}`);
    }
  };

  const runCode = useCallback(async () => {
    setIsRunning(true);
    clearConsole();
    
    try {
      // Compile TypeScript if needed
      let codeToRun = value;
      if (language === 'typescript' || language === 'tsx') {
        try {
          codeToRun = compileTypeScript(value);
        } catch (error: any) {
          addConsoleOutput('error', error.message);
          setIsRunning(false);
          return;
        }
      }
      
      // Generate unique ID for this execution
      const executionId = Date.now().toString();
      
      // Create iframe content
      const iframeContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <script>
            const executionId = '${executionId}';
            
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
                    executionId: executionId,
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
              executionId: executionId
            }, '*');
            
            // Catch errors
            window.addEventListener('error', (event) => {
              window.parent.postMessage({
                type: 'console',
                executionId: executionId,
                method: 'error',
                args: [event.message + ' (at line ' + event.lineno + ':' + event.colno + ')']
              }, '*');
              event.preventDefault();
            });
            
            window.addEventListener('unhandledrejection', (event) => {
              window.parent.postMessage({
                type: 'console',
                executionId: executionId,
                method: 'error',
                args: ['Unhandled Promise Rejection: ' + String(event.reason)]
              }, '*');
              event.preventDefault();
            });
          </script>
        </head>
        <body>
          <script>
            // Wait a bit to ensure console overrides are in place
            setTimeout(() => {
              try {
                ${codeToRun}
              } catch (error) {
                console.error(error.stack || error.message || error.toString());
              }
              
              // Notify completion
              window.parent.postMessage({
                type: 'execution-complete',
                executionId: executionId
              }, '*');
            }, 0);
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
  }, [value, language]);

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
                consoleOutput.map((output, index) => (
                  <div key={index} className={`console-line console-${output.type}`}>
                    <span className="console-timestamp">
                      {output.timestamp.toLocaleTimeString()}
                    </span>
                    <span className="console-message">{output.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .code-display-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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