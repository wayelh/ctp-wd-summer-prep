import React, { lazy, Suspense, useState, PropsWithChildren, useContext, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import {
  CodeSpan,
  Deck,
  DefaultTemplate,
  Heading,
  ListItem,
  OrderedList,
  Text,
  UnorderedList,
  CodePane
} from 'spectacle';
import { CodeDisplayContext } from './components/CodeDisplayContext';
import CodeDisplay, { Version, File, Tests } from './components/CodeDisplayWithSlideTracking';
import './styles.css';

// Define presentation metadata
const presentations = {
  js: {
    'introduction': { title: 'Introduction to JavaScript', component: lazy(() => import('./js-intro-sections/introduction.mdx')) },
    'html-basics': { title: 'HTML Basics', component: lazy(() => import('./js-intro-sections/html-basics.mdx')) },
    'css-fundamentals': { title: 'CSS Fundamentals', component: lazy(() => import('./js-intro-sections/css-fundamentals.mdx')) },
    'variables-and-types': { title: 'Variables and Types', component: lazy(() => import('./js-intro-sections/variables-and-types.mdx')) },
    'functions': { title: 'Functions', component: lazy(() => import('./js-intro-sections/functions.mdx')) },
    'control-flow': { title: 'Control Flow', component: lazy(() => import('./js-intro-sections/control-flow.mdx')) },
    'objects-and-arrays': { title: 'Objects and Arrays', component: lazy(() => import('./js-intro-sections/objects-and-arrays.mdx')) },
    'dom-manipulation': { title: 'DOM Manipulation', component: lazy(() => import('./js-intro-sections/dom-manipulation.mdx')) },
    'async-javascript': { title: 'Async JavaScript', component: lazy(() => import('./js-intro-sections/async-javascript.mdx')) },
    'error-handling': { title: 'Error Handling', component: lazy(() => import('./js-intro-sections/error-handling.mdx')) },
    'advanced-functions': { title: 'Advanced Functions', component: lazy(() => import('./js-intro-sections/advanced-functions.mdx')) },
    'prototypes': { title: 'Prototypes', component: lazy(() => import('./js-intro-sections/prototypes.mdx')) },
    'modules': { title: 'Modules', component: lazy(() => import('./js-intro-sections/modules.mdx')) },
    'modern-features': { title: 'Modern Features', component: lazy(() => import('./js-intro-sections/modern-features.mdx')) },
    'common-pitfalls': { title: 'Common Pitfalls', component: lazy(() => import('./js-intro-sections/common-pitfalls.mdx')) },
    'best-practices': { title: 'Best Practices', component: lazy(() => import('./js-intro-sections/best-practices.mdx')) },
  },
  ts: {
    'introduction': { title: 'Introduction to TypeScript', component: lazy(() => import('./ts-intro-sections/introduction.mdx')) },
    'type-basics': { title: 'Type Basics', component: lazy(() => import('./ts-intro-sections/type-basics.mdx')) },
    'interfaces-and-types': { title: 'Interfaces and Types', component: lazy(() => import('./ts-intro-sections/interfaces-and-types.mdx')) },
    'unions-and-literals': { title: 'Unions and Literals', component: lazy(() => import('./ts-intro-sections/unions-and-literals.mdx')) },
    'generics': { title: 'Generics', component: lazy(() => import('./ts-intro-sections/generics.mdx')) },
    'type-guards': { title: 'Type Guards', component: lazy(() => import('./ts-intro-sections/type-guards.mdx')) },
    'utility-types': { title: 'Utility Types', component: lazy(() => import('./ts-intro-sections/utility-types.mdx')) },
    'classes-and-oop': { title: 'Classes and OOP', component: lazy(() => import('./ts-intro-sections/classes-and-oop.mdx')) },
    'modules-and-namespaces': { title: 'Modules and Namespaces', component: lazy(() => import('./ts-intro-sections/modules-and-namespaces.mdx')) },
    'async-types': { title: 'Async Types', component: lazy(() => import('./ts-intro-sections/async-types.mdx')) },
    'common-patterns': { title: 'Common Patterns', component: lazy(() => import('./ts-intro-sections/common-patterns.mdx')) },
    'react-typescript': { title: 'React with TypeScript', component: lazy(() => import('./ts-intro-sections/react-typescript.mdx')) },
    'testing-typescript': { title: 'Testing TypeScript', component: lazy(() => import('./ts-intro-sections/testing-typescript.mdx')) },
    'migration-strategies': { title: 'Migration Strategies', component: lazy(() => import('./ts-intro-sections/migration-strategies.mdx')) },
    'ecosystem-and-tools': { title: 'Ecosystem and Tools', component: lazy(() => import('./ts-intro-sections/ecosystem-and-tools.mdx')) },
  }
};

// Error Boundary Component (currently unused but may be needed for error handling)
// class ErrorBoundary extends React.Component<
//   { children: React.ReactNode },
//   { hasError: boolean; error: Error | null }
// > {
//   constructor(props: { children: React.ReactNode }) {
//     super(props);
//     this.state = { hasError: false, error: null };
//   }

//   static getDerivedStateFromError(error: Error) {
//     return { hasError: true, error };
//   }

//   render() {
//     if (this.state.hasError) {
//       return (
//         <div className="error">
//           <h2>Error loading presentation</h2>
//           <p>{this.state.error?.message}</p>
//         </div>
//       );
//     }

//     return this.props.children;
//   }
// }

// Main App Component
function App() {
  // Parse URL parameters to get initial presentation
  const getInitialPresentation = () => {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category') as 'js' | 'ts' | null;
    const key = params.get('presentation');
    
    if (category && key && presentations[category] && key in presentations[category]) {
      return { category, key };
    }
    return null;
  };
  
  const [activePresentation, setActivePresentation] = useState<{
    category: 'js' | 'ts';
    key: string;
  } | null>(getInitialPresentation());
  const [deckKey, setDeckKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Update URL when presentation changes
  useEffect(() => {
    // Create fresh params with only the presentation info
    const params = new URLSearchParams();
    
    if (activePresentation) {
      params.set('category', activePresentation.category);
      params.set('presentation', activePresentation.key);
    }
    
    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [activePresentation]);

  const handlePresentationSelect = (category: 'js' | 'ts', key: string) => {
    // If selecting the same presentation, force a remount
    if (activePresentation?.category === category && activePresentation?.key === key) {
      setDeckKey(prev => prev + 1);
    }
    setActivePresentation({ category, key });
    setSidebarOpen(false); // Close sidebar after selection
  };

  const ActiveComponent = activePresentation && activePresentation.key in presentations[activePresentation.category]
    ? presentations[activePresentation.category][activePresentation.key as keyof typeof presentations[typeof activePresentation.category]].component
    : null;

  // Force window resize event after presentation changes
  useEffect(() => {
    if (activePresentation) {
      // Small timeout to ensure DOM is ready
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activePresentation, deckKey]);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Hamburger Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          zIndex: 1001,
          width: '40px',
          height: '40px',
          background: 'rgba(0, 0, 0, 0.7)',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '4px',
          padding: '8px',
          transition: 'all 0.3s ease'
        }}
      >
        <span style={{
          width: '100%',
          height: '3px',
          background: 'white',
          borderRadius: '2px',
          transition: 'all 0.3s ease',
          transform: sidebarOpen ? 'rotate(45deg) translateY(7px)' : 'none'
        }}></span>
        <span style={{
          width: '100%',
          height: '3px',
          background: 'white',
          borderRadius: '2px',
          transition: 'all 0.3s ease',
          opacity: sidebarOpen ? 0 : 1
        }}></span>
        <span style={{
          width: '100%',
          height: '3px',
          background: 'white',
          borderRadius: '2px',
          transition: 'all 0.3s ease',
          transform: sidebarOpen ? 'rotate(-45deg) translateY(-7px)' : 'none'
        }}></span>
      </button>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
            transition: 'opacity 0.3s ease'
          }}
        />
      )}

      {/* Sidebar */}
      <nav 
        style={{
          position: 'fixed',
          top: 0,
          left: sidebarOpen ? 0 : '-320px',
          width: '300px',
          height: '100vh',
          background: '#1e1e1e',
          boxShadow: '2px 0 10px rgba(0, 0, 0, 0.3)',
          transition: 'left 0.3s ease',
          zIndex: 1000,
          overflowY: 'auto',
          padding: '80px 0 20px 0'
        }}
      >
        <div style={{ padding: '0 20px' }}>
          <button
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '10px',
              background: !activePresentation ? '#3178c6' : 'transparent',
              color: !activePresentation ? 'white' : '#ccc',
              border: '1px solid #444',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
            onClick={() => {
              setActivePresentation(null);
              setSidebarOpen(false);
            }}
          >
            🏠 Home
          </button>
          
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ 
              color: '#f7df1e', 
              fontSize: '14px', 
              fontWeight: 'bold',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              JavaScript
            </h3>
            {Object.entries(presentations.js).map(([key, { title }]) => (
              <button
                key={`js-${key}`}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  marginBottom: '5px',
                  background: activePresentation?.category === 'js' && activePresentation.key === key
                    ? '#f7df1e'
                    : 'transparent',
                  color: activePresentation?.category === 'js' && activePresentation.key === key
                    ? '#333'
                    : '#ccc',
                  border: '1px solid transparent',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  textAlign: 'left',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  if (!(activePresentation?.category === 'js' && activePresentation.key === key)) {
                    e.currentTarget.style.background = 'rgba(247, 223, 30, 0.1)';
                    e.currentTarget.style.borderColor = '#444';
                  }
                }}
                onMouseOut={(e) => {
                  if (!(activePresentation?.category === 'js' && activePresentation.key === key)) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
                onClick={() => handlePresentationSelect('js', key)}
              >
                {title}
              </button>
            ))}
          </div>
          
          <div style={{ marginTop: '30px' }}>
            <h3 style={{ 
              color: '#3178c6', 
              fontSize: '14px', 
              fontWeight: 'bold',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              TypeScript
            </h3>
            {Object.entries(presentations.ts).map(([key, { title }]) => (
              <button
                key={`ts-${key}`}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  marginBottom: '5px',
                  background: activePresentation?.category === 'ts' && activePresentation.key === key
                    ? '#3178c6'
                    : 'transparent',
                  color: activePresentation?.category === 'ts' && activePresentation.key === key
                    ? 'white'
                    : '#ccc',
                  border: '1px solid transparent',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  textAlign: 'left',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  if (!(activePresentation?.category === 'ts' && activePresentation.key === key)) {
                    e.currentTarget.style.background = 'rgba(49, 120, 198, 0.1)';
                    e.currentTarget.style.borderColor = '#444';
                  }
                }}
                onMouseOut={(e) => {
                  if (!(activePresentation?.category === 'ts' && activePresentation.key === key)) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
                onClick={() => handlePresentationSelect('ts', key)}
              >
                {title}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="presentation-container">
        {ActiveComponent && activePresentation ? (
          <Suspense fallback={
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%',
              fontSize: '2rem',
              color: '#666'
            }}>
              Loading presentation...
            </div>
          }>
            <Deck 
              key={`${activePresentation.category}-${activePresentation.key}-${deckKey}`}
              backgroundImage="url(https://ctp-presentation-media.s3.us-east-2.amazonaws.com/bg.gif)" 
              template={() => <DefaultTemplate />}
            >
              <ActiveComponent components={{
                // Map markdown elements to Spectacle components
                h1: ({ children }: PropsWithChildren) => <Heading fontSize="h1">{children}</Heading>,
                h2: ({ children }: PropsWithChildren) => <Heading fontSize="h2">{children}</Heading>,
                h3: ({ children }: PropsWithChildren) => <Heading fontSize="h3">{children}</Heading>,
                h4: ({ children }: PropsWithChildren) => <Heading fontSize="h4">{children}</Heading>,
                ul: UnorderedList,
                ol: OrderedList,
                b: ({ children }: PropsWithChildren) => <Text fontWeight="bold" fontSize="16px">{children}</Text>,
                strong: ({ children }: PropsWithChildren) => <Text fontWeight="bold" fontSize="16px">{children}</Text>,
                li: ({ children }: PropsWithChildren) => <ListItem fontSize="16px" margin="0">{children}</ListItem>,
                p: ({ children }: PropsWithChildren) => <Text fontSize="16px" lineHeight="1.5" margin="0.5rem 0">{children}</Text>,
                code: (props: PropsWithChildren<{ className?: string }>) => {
                  if (useContext(CodeDisplayContext)) {
                    return (
                      <Version>
                        {props.children}
                      </Version>
                    );
                  }
                  if (props.className && typeof props.children === 'string') {
                    return (
                      <CodePane language={props.className.split('-')[1]}>
                        {props.children}
                      </CodePane>
                    );
                  } else {
                    return <CodeSpan style={{ color: '#fff', fontSize: '16px', backgroundColor: '#000', padding: '2px 4px', borderRadius: '4px' }}>{props.children}</CodeSpan>;
                  }
                },
                // Add CodeDisplay components
                CodeDisplay,
                File,
                Tests,
                Version
              }} />
            </Deck>
          </Suspense>
        ) : (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <h1>CTP Presentations</h1>
              <p>Select a presentation from the navigation bar above.</p>
            </div>
        )}
      </div>
    </div>
  );
}

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);