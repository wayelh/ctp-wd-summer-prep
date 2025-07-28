import React, { lazy, Suspense, useState, PropsWithChildren, useContext, useEffect, useRef, useCallback } from 'react';
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
  CodePane,
  DeckContext
} from 'spectacle';
import { CodeDisplayContext } from './components/CodeDisplayContext';
import CodeDisplay, { Version, File, Tests } from './components/CodeDisplayWithSlideTracking';
import { ThemeProvider } from './components/ThemeContext';
import './styles.css';

// Define presentation metadata
const presentations = {
  js: {
    'fullstack-introduction': { title: 'Fullstack Introduction', component: lazy(() => import('./js-intro-sections/fullstack-introduction.mdx')) },
    'html-basics': { title: 'HTML Basics', component: lazy(() => import('./js-intro-sections/html-basics.mdx')) },
    'css-fundamentals': { title: 'CSS Fundamentals', component: lazy(() => import('./js-intro-sections/css-fundamentals.mdx')) },
    'introduction': { title: 'Introduction to JavaScript', component: lazy(() => import('./js-intro-sections/introduction.mdx')) },
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
    'type-problems': { title: 'Type Problems', component: lazy(() => import('./ts-intro-sections/type-problems.mdx')) },
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
  },
  react: {
    'introduction': { title: 'Introduction to React', component: lazy(() => import('./react-sections/introduction.mdx')) },
    'components-props': { title: 'Components and Props', component: lazy(() => import('./react-sections/components-props/00-overview.mdx')) },
    'state-hooks': { title: 'State and Hooks', component: lazy(() => import('./react-sections/state-hooks/00-overview.mdx')) },
    'events-and-forms': { title: 'Events and Forms', component: lazy(() => import('./react-sections/events-and-forms/00-overview.mdx')) },
    'conditional-rendering': { title: 'Conditional Rendering', component: lazy(() => import('./react-sections/conditional-rendering/01-introduction.mdx')) },
    'lists-and-keys': { title: 'Lists and Keys', component: lazy(() => import('./react-sections/lists-and-keys/01-introduction.mdx')) },
    'lifecycle-methods': { title: 'Lifecycle Methods', component: lazy(() => import('./react-sections/lifecycle-methods.mdx')) },
    'refs-and-dom': { title: 'Refs and DOM Access', component: lazy(() => import('./react-sections/refs-and-dom.mdx')) },
    'context-api': { title: 'Context API', component: lazy(() => import('./react-sections/context-api/01-introduction.mdx')) },
    'custom-hooks': { title: 'Custom Hooks', component: lazy(() => import('./react-sections/custom-hooks/01-introduction.mdx')) },
    'advanced-patterns': { title: 'Advanced Patterns', component: lazy(() => import('./react-sections/advanced-patterns.mdx')) },
    'portals': { title: 'Portals', component: lazy(() => import('./react-sections/portals.mdx')) },
    'suspense-and-boundaries': { title: 'Suspense & Error Boundaries', component: lazy(() => import('./react-sections/suspense-and-boundaries.mdx')) },
    'performance-optimization': { title: 'Performance Optimization', component: lazy(() => import('./react-sections/performance-optimization/01-introduction.mdx')) },
    'data-fetching': { title: 'Data Fetching', component: lazy(() => import('./react-sections/data-fetching/00-overview.mdx')) },
    'server-components': { title: 'Server Components', component: lazy(() => import('./react-sections/server-components.mdx')) },
    'styling-approaches': { title: 'Styling Approaches', component: lazy(() => import('./react-sections/styling-approaches.mdx')) },
    'testing': { title: 'Testing React', component: lazy(() => import('./react-sections/testing.mdx')) },
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


// Custom template that includes navigation tracking
function CustomTemplate({ 
  activePresentation,
  onSlideInfo,
  getNextPresentation,
  getPreviousPresentation
}: {
  activePresentation: { category: 'js' | 'ts' | 'react'; key: string } | null;
  onSlideInfo: (info: any) => void;
  getNextPresentation: () => { category: 'js' | 'ts' | 'react'; key: string } | null;
  getPreviousPresentation: () => { category: 'js' | 'ts' | 'react'; key: string } | null;
}) {
  const deckContext = useContext(DeckContext);
  
  useEffect(() => {
    if (deckContext) {
      const { slideCount, activeView } = deckContext;
      const slideIndex = activeView?.slideIndex ?? 0;
      
      const info = {
        current: slideIndex,
        total: slideCount,
        isLast: slideIndex === slideCount - 1
      };
      
      onSlideInfo(info);
    }
  }, [deckContext, onSlideInfo]);

  if (!deckContext) return <DefaultTemplate />;
  
  const { slideCount, activeView } = deckContext;
  const slideIndex = activeView?.slideIndex ?? 0;
  const isFirstSlide = slideIndex === 0;
  const isLastSlide = slideIndex === slideCount - 1;
  
  return (
    <>
      <DefaultTemplate />
      
      {/* First slide indicator */}
      {activePresentation && isFirstSlide && (() => {
        const prev = getPreviousPresentation();
        if (prev && presentations[prev.category] && presentations[prev.category][prev.key]) {
          const prevTitle = presentations[prev.category][prev.key].title;
          return (
            <div style={{
              position: 'fixed',
              bottom: '20px',
              left: '20px',
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '10px 15px',
              borderRadius: '8px',
              fontSize: '14px',
              zIndex: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ 
                color: prev.category === 'js' ? '#f7df1e' : '#3178c6',
                fontWeight: 'bold'
              }}>
                {prevTitle}
              </span>
              <span>← Press to go back</span>
            </div>
          );
        }
        return null;
      })()}
      
      {/* Last slide indicator */}
      {activePresentation && isLastSlide && (() => {
        const next = getNextPresentation();
        if (next && presentations[next.category] && presentations[next.category][next.key]) {
          const nextTitle = presentations[next.category][next.key].title;
          return (
            <div style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '10px 15px',
              borderRadius: '8px',
              fontSize: '14px',
              zIndex: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>Press → to continue</span>
              <span style={{ 
                color: next.category === 'js' ? '#f7df1e' : '#3178c6',
                fontWeight: 'bold'
              }}>
                {nextTitle}
              </span>
            </div>
          );
        }
        return null;
      })()}
      
    </>
  );
}

// Main App Component
function App() {
  // Parse URL parameters to get initial presentation
  const getInitialPresentation = () => {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category') as 'js' | 'ts' | 'react' | null;
    const key = params.get('presentation');
    
    if (category && key && presentations[category] && key in presentations[category]) {
      // Check if we have a slide number in the hash
      const hash = window.location.hash;
      const slideMatch = hash.match(/#\/(\d+)/);
      if (slideMatch) {
        // Store the initial slide position
        sessionStorage.setItem('initialSlide', slideMatch[1]);
      }
      return { category, key };
    }
    return null;
  };
  
  const [activePresentation, setActivePresentation] = useState<{
    category: 'js' | 'ts' | 'react';
    key: string;
  } | null>(getInitialPresentation());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const slideInfoRef = useRef({ current: 0, total: 0, isLast: false });

  // Update URL when presentation changes (but preserve hash)
  useEffect(() => {
    // Create fresh params with only the presentation info
    const params = new URLSearchParams();
    
    if (activePresentation) {
      params.set('category', activePresentation.category);
      params.set('presentation', activePresentation.key);
    }
    
    // Preserve the current hash (slide number)
    const currentHash = window.location.hash;
    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}${currentHash}` : `${window.location.pathname}${currentHash}`;
    window.history.replaceState({}, '', newUrl);
  }, [activePresentation]);

  const handlePresentationSelect = (category: 'js' | 'ts' | 'react', key: string, goToLastSlide = false) => {
    // Update URL
    const params = new URLSearchParams();
    params.set('category', category);
    params.set('presentation', key);
    
    // Check if we're selecting the same presentation (just opening menu)
    const isSamePresentation = activePresentation?.category === category && activePresentation?.key === key;
    
    // Get the slide number from URL if provided
    let hash = window.location.hash;
    
    // If not same presentation and no explicit slide in URL, start at slide 0
    if (!isSamePresentation && !hash.match(/#\/\d+/)) {
      hash = '#/0';
    }
    
    const newUrl = `${window.location.pathname}?${params.toString()}${hash}`;
    
    if (goToLastSlide) {
      // Store flag in sessionStorage to handle after deck loads
      sessionStorage.setItem('navigateToLastSlide', 'true');
    } else {
      sessionStorage.removeItem('navigateToLastSlide');
    }
    
    // Force a full page navigation to ensure clean state
    window.location.href = newUrl;
  };

  // Handle slide info updates from NavigationTracker
  const handleSlideInfo = useCallback((info: { current: number; total: number; isLast: boolean }) => {
    slideInfoRef.current = info;
    
    // Save current slide position to sessionStorage
    if (activePresentation) {
      const storageKey = `slide-position-${activePresentation.category}-${activePresentation.key}`;
      sessionStorage.setItem(storageKey, info.current.toString());
    }
  }, [activePresentation]);

  const ActiveComponent = activePresentation && activePresentation.key in presentations[activePresentation.category]
    ? presentations[activePresentation.category][activePresentation.key as keyof typeof presentations[typeof activePresentation.category]].component
    : null;

  // Handle navigation to last slide after deck loads
  useEffect(() => {
    if (activePresentation && sessionStorage.getItem('navigateToLastSlide') === 'true') {
      // Remove the flag
      sessionStorage.removeItem('navigateToLastSlide');
      
      // Wait for deck to fully load and get slide count
      let attempts = 0;
      const navigateToLast = () => {
        // Try to find slide count from DOM
        const slideElements = document.querySelectorAll('[style*="transform: translateX"]');
        const slideCount = slideElements.length;
        
        if (slideCount > 0) {
          // Navigate to last slide
          const lastSlideIndex = slideCount - 1;
          window.location.hash = `#/${lastSlideIndex}`;
        } else if (attempts < 20) {
          // Keep trying for up to 4 seconds
          attempts++;
          setTimeout(navigateToLast, 200);
        }
      };
      
      // Start checking after a delay to let deck render
      setTimeout(navigateToLast, 500);
    }
  }, [activePresentation]);

  // Get next presentation
  const getNextPresentation = () => {
    if (!activePresentation) return null;
    
    const allPresentations = [
      ...Object.keys(presentations.js).map(key => ({ category: 'js' as const, key })),
      ...Object.keys(presentations.ts).map(key => ({ category: 'ts' as const, key })),
      ...Object.keys(presentations.react).map(key => ({ category: 'react' as const, key }))
    ];
    
    const currentIndex = allPresentations.findIndex(
      p => p.category === activePresentation.category && p.key === activePresentation.key
    );
    
    // Don't loop - return null if we're at the last presentation
    if (currentIndex === -1 || currentIndex === allPresentations.length - 1) {
      return null;
    }
    
    return allPresentations[currentIndex + 1];
  };

  // Get previous presentation
  const getPreviousPresentation = () => {
    if (!activePresentation) return null;
    
    const allPresentations = [
      ...Object.keys(presentations.js).map(key => ({ category: 'js' as const, key })),
      ...Object.keys(presentations.ts).map(key => ({ category: 'ts' as const, key })),
      ...Object.keys(presentations.react).map(key => ({ category: 'react' as const, key }))
    ];
    
    const currentIndex = allPresentations.findIndex(
      p => p.category === activePresentation.category && p.key === activePresentation.key
    );
    
    // Don't loop - return null if we're at the first presentation
    if (currentIndex === -1 || currentIndex === 0) {
      return null;
    }
    
    return allPresentations[currentIndex - 1];
  };

  // Handle navigation between presentations
  useEffect(() => {
    if (!activePresentation) return;

    // Handle keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      const { current, isLast } = slideInfoRef.current;
      const isFirst = current === 0;
      
      if (e.key === 'ArrowRight' && isLast) {
        const next = getNextPresentation();
        if (next) {
          e.preventDefault();
          e.stopPropagation();
          // Don't pass goToLastSlide parameter - we want to go to the first slide
          handlePresentationSelect(next.category, next.key, false);
        }
      } else if (e.key === 'ArrowLeft' && isFirst) {
        const prev = getPreviousPresentation();
        if (prev) {
          e.preventDefault();
          e.stopPropagation();
          handlePresentationSelect(prev.category, prev.key, true); // true = go to last slide
        }
      }
    };

    // Listen for navigation with capture to intercept before Spectacle
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activePresentation, handlePresentationSelect]);

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
          
          <div style={{ marginTop: '30px' }}>
            <h3 style={{ 
              color: '#61dafb', 
              fontSize: '14px', 
              fontWeight: 'bold',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              React
            </h3>
            {Object.entries(presentations.react).map(([key, { title }]) => (
              <button
                key={`react-${key}`}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  marginBottom: '5px',
                  background: activePresentation?.category === 'react' && activePresentation.key === key
                    ? '#61dafb'
                    : 'transparent',
                  color: activePresentation?.category === 'react' && activePresentation.key === key
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
                  if (!(activePresentation?.category === 'react' && activePresentation.key === key)) {
                    e.currentTarget.style.background = 'rgba(97, 218, 251, 0.1)';
                    e.currentTarget.style.borderColor = '#444';
                  }
                }}
                onMouseOut={(e) => {
                  if (!(activePresentation?.category === 'react' && activePresentation.key === key)) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
                onClick={() => handlePresentationSelect('react', key)}
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
              key={`${activePresentation.category}-${activePresentation.key}`}
              backgroundImage="url(https://ctp-presentation-media.s3.us-east-2.amazonaws.com/bg.gif)" 
              template={() => (
                <CustomTemplate 
                  activePresentation={activePresentation}
                  onSlideInfo={handleSlideInfo}
                  getNextPresentation={getNextPresentation}
                  getPreviousPresentation={getPreviousPresentation}
                />
              )}
            >
              <ActiveComponent components={{
                // Map markdown elements to Spectacle components
                h1: ({ children }: PropsWithChildren) => <Heading fontSize="h1" style={{ paddingBottom: '5px', marginBottom: '5px' }}>{children}</Heading>,
                h2: ({ children }: PropsWithChildren) => <Heading fontSize="h2" style={{ paddingBottom: '5px', marginBottom: '5px' }}>{children}</Heading>,
                h3: ({ children }: PropsWithChildren) => <Heading fontSize="h3" style={{ paddingBottom: '5px', marginBottom: '5px' }}>{children}</Heading>,
                h4: ({ children }: PropsWithChildren) => <Heading fontSize="h4" style={{ paddingBottom: '5px', marginBottom: '5px' }}>{children}</Heading>,
                ul: UnorderedList,
                ol: OrderedList,
                li: ({ children }: PropsWithChildren) => <ListItem fontSize="30px" margin="0">{children}</ListItem>,
                p: ({ children }: PropsWithChildren) => <Text fontSize="30px" lineHeight="1.5" margin="0.5rem 0">{children}</Text>,
                code: (props: PropsWithChildren<{ className?: string }>) => {
                  if (useContext(CodeDisplayContext)) {
                    return (
                      <Version>
                        {props.children}
                      </Version>
                    );
                  }
                  if (props.className && typeof props.children === 'string') {
                    // Extract language from className (e.g., 'language-tsx' -> 'tsx')
                    let language = props.className.split('-')[1] || 'javascript';
                    
                    // Map to CodePane supported languages
                    const languageMap: Record<string, string> = {
                      'tsx': 'typescript',
                      'ts': 'typescript',
                      'jsx': 'jsx',
                      'js': 'javascript'
                    };
                    
                    language = languageMap[language] || language;
                    
                    return (
                      <CodePane language={language}>
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
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);