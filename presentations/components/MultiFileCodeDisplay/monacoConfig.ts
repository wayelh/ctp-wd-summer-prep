import * as monaco from 'monaco-editor';

export const REACT_TYPES = `
  type ReactNode = ReactChild | ReactFragment | ReactPortal | boolean | null | undefined;
  type ReactChild = ReactElement | ReactText;
  type ReactText = string | number;
  type ReactFragment = {} | Iterable<ReactNode>;
  type ReactPortal = any;
  
  interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
    type: T;
    props: P;
    key: Key | null;
  }
  
  type Key = string | number;
  type JSXElementConstructor<P> = ((props: P) => ReactElement | null) | (new (props: P) => Component<P, any>);
  
  interface Component<P = {}, S = {}> {
    render(): ReactNode;
    props: Readonly<P> & Readonly<{ children?: ReactNode }>;
    state: Readonly<S>;
    setState<K extends keyof S>(state: ((prevState: Readonly<S>, props: Readonly<P>) => (Pick<S, K> | S | null)) | (Pick<S, K> | S | null)): void;
  }
  
  type FC<P = {}> = FunctionComponent<P>;
  interface FunctionComponent<P = {}> {
    (props: P & { children?: ReactNode }, context?: any): ReactElement | null;
    displayName?: string;
  }
  
  type Dispatch<A> = (value: A) => void;
  type SetStateAction<S> = S | ((prevState: S) => S);
  type EffectCallback = () => (void | (() => void | undefined));
  type DependencyList = ReadonlyArray<any>;
  type Reducer<S, A> = (prevState: S, action: A) => S;
  type ReducerState<R extends Reducer<any, any>> = R extends Reducer<infer S, any> ? S : never;
  type ReducerAction<R extends Reducer<any, any>> = R extends Reducer<any, infer A> ? A : never;
  interface MutableRefObject<T> { current: T; }
  
  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: DependencyList): T;
  export function useMemo<T>(factory: () => T, deps: DependencyList | undefined): T;
  export function useRef<T>(initialValue: T): MutableRefObject<T>;
  export function useReducer<R extends Reducer<any, any>>(reducer: R, initialArg: ReducerState<R>): [ReducerState<R>, Dispatch<ReducerAction<R>>];
  export function createElement(type: any, props?: any, ...children: any[]): ReactElement;
  export const Fragment: symbol;
  
  export interface HTMLAttributes<T> {
    className?: string;
    id?: string;
    style?: CSSProperties;
    onClick?: () => void;
    onChange?: (event: any) => void;
    onSubmit?: (event: any) => void;
    children?: ReactNode;
  }
  
  export interface CSSProperties {
    [key: string]: string | number | undefined;
  }
`;

export const REACT_DOM_TYPES = `
  interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }
  
  export function createRoot(container: Element | DocumentFragment): Root;
`;

export const getThemeColors = (theme: string) => {
  const isDark = theme.includes('dark') || theme === 'vs-dark';
  return {
    background: isDark ? '#1e1e1e' : '#ffffff',
    backgroundSecondary: isDark ? '#252526' : '#f3f3f3',
    foreground: isDark ? '#d4d4d4' : '#333333',
    muted: isDark ? '#858585' : '#6e6e6e',
    border: isDark ? '#464647' : '#e5e5e5',
    borderLight: isDark ? '#464647' : '#e5e5e5',
    primary: isDark ? '#0e639c' : '#0066cc',
    error: isDark ? '#f48771' : '#dc3545',
    warning: isDark ? '#ffcc00' : '#ffc107',
    success: isDark ? '#4ec9b0' : '#28a745',
    info: isDark ? '#3794ff' : '#17a2b8',
    hover: isDark ? '#2a2d2e' : '#f0f0f0',
    selection: isDark ? '#264f78' : '#add6ff',
    accent: isDark ? '#569cd6' : '#0066cc'
  };
};

export const configureMonaco = (monaco: any) => {
  try {
    // Configure TypeScript compiler options
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
      checkJs: false,
      jsxFactory: 'React.createElement',
      jsxFragmentFactory: 'React.Fragment',
      lib: ['es2020', 'dom', 'dom.iterable'],
      strict: false,
      skipLibCheck: true,
      noSemanticValidation: false,
      noSyntaxValidation: false
    });
    
    // Configure JavaScript defaults too
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      allowJs: true,
      checkJs: false,
      jsx: monaco.languages.typescript.JsxEmit.React,
      esModuleInterop: true
    });
    
    // Set diagnostic options to enable JSX
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [1375, 1378] // Ignore some module resolution errors
    });
    
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [1375, 1378]
    });
    
    // Add React types
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      REACT_TYPES,
      'file:///node_modules/@types/react/index.d.ts'
    );
    
    // Add React DOM types
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      REACT_DOM_TYPES,
      'file:///node_modules/@types/react-dom/index.d.ts'
    );
    
    // Add the same for JavaScript
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      REACT_TYPES,
      'file:///node_modules/@types/react/index.d.ts'
    );
    
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      REACT_DOM_TYPES,
      'file:///node_modules/@types/react-dom/index.d.ts'
    );
  } catch (error) {
    console.error('Error configuring Monaco:', error);
  }
};