import React, { PropsWithChildren, useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { MDXProvider } from '@mdx-js/react';
import {
  CodeSpan,
  Deck,
  DefaultTemplate,
  Heading,
  ListItem,
  OrderedList,
  Text,
  UnorderedList,
  SlideLayout,
  Image,
  FlexBox,
  Box,
  CodePane
} from 'spectacle';
import JSIntroSlides from './js-intro-sections/index.mdx';
import TSIntroSlides from './ts-intro-sections/index.mdx';
import CodeDisplay, { Version, Tests } from './components/CodeDisplayWithSlideTracking';
import './styles.css'
import { CodeDisplayContext } from './components/CodeDisplayContext';


const App = () => {
  // Check URL for presentation choice and slide number
  const urlParams = new URLSearchParams(window.location.search);
  const presentationParam = urlParams.get('presentation') || 'js';
  const slideParam = urlParams.get('slide');
  const initialSlide = slideParam ? parseInt(slideParam, 10) : undefined;
  
  const [presentation, setPresentation] = useState<'js' | 'ts'>(presentationParam as 'js' | 'ts');
  const [currentSlide, setCurrentSlide] = useState(initialSlide || 0);

  const Slides = presentation === 'js' ? JSIntroSlides : TSIntroSlides;

  // Update URL when slide changes
  const updateURL = (slideIndex: number) => {
    setCurrentSlide(slideIndex);
    const params = new URLSearchParams(window.location.search);
    params.set('presentation', presentation);
    params.set('slide', slideIndex.toString());
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  };

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const slideParam = params.get('slide');
      if (slideParam) {
        const slideIndex = parseInt(slideParam, 10);
        if (!isNaN(slideIndex)) {
          // Reload to navigate to the correct slide
          window.location.reload();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <>
      {/* Navigation controls */}
      <div style={{
        position: 'fixed',
        top: 10,
        right: 10,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        padding: '10px',
        borderRadius: '5px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        {/* Slide counter */}
        <div style={{
          color: '#ccc',
          fontSize: '14px',
          marginRight: '10px'
        }}>
          Slide {currentSlide + 1}
        </div>
        <button
          onClick={() => {
            setPresentation('js');
            const params = new URLSearchParams(window.location.search);
            params.set('presentation', 'js');
            params.set('slide', '0'); // Reset to first slide when switching
            window.history.pushState({}, '', `?${params.toString()}`);
          }}
          style={{
            margin: '0 5px',
            padding: '5px 10px',
            background: presentation === 'js' ? '#61dafb' : '#666',
            border: 'none',
            borderRadius: '3px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          JavaScript
        </button>
        <button
          onClick={() => {
            setPresentation('ts');
            const params = new URLSearchParams(window.location.search);
            params.set('presentation', 'ts');
            params.set('slide', '0'); // Reset to first slide when switching
            window.history.pushState({}, '', `?${params.toString()}`);
          }}
          style={{
            margin: '0 5px',
            padding: '5px 10px',
            background: presentation === 'ts' ? '#3178c6' : '#666',
            border: 'none',
            borderRadius: '3px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          TypeScript
        </button>
      </div>

      <Deck 
        backgroundImage="url(https://ctp-presentation-media.s3.us-east-2.amazonaws.com/bg.gif)" 
        template={() => <DefaultTemplate />}
      >
        <MDXProvider components={{
          // Map markdown elements to Spectacle components
          h1: ({ children }: PropsWithChildren) => <Heading size={1}>{children}</Heading>,
          h2: ({ children }: PropsWithChildren) => <Heading size={2}>{children}</Heading>,
          h3: ({ children }: PropsWithChildren) => <Heading size={4}>{children}</Heading>,
          h4: ({ children }: PropsWithChildren) => <Heading size={5}>{children}</Heading>,
          h5: ({ children }: PropsWithChildren) => <Heading size={6}>{children}</Heading>,
          ul: UnorderedList,
          ol: OrderedList,
          li: ({ children }: PropsWithChildren) => <ListItem fontSize="15px">{children}</ListItem>,
          div: ({ children, ...props }: PropsWithChildren<any>) => {
            // First check if children itself is a problematic object
            if (children && typeof children === 'object' && !React.isValidElement(children) && !Array.isArray(children)) {
              console.error('Div received invalid object as children directly:', children, 'keys:', Object.keys(children), 'props:', props);
              return <div {...props} />;
            }
            
            // Then process children array/elements
            const processChildren = (child: any): any => {
              if (child && typeof child === 'object' && !React.isValidElement(child) && !Array.isArray(child)) {
                console.warn('Filtering out object child in div:', child, 'props:', props);
                return null;
              }
              if (Array.isArray(child)) {
                return child.map(processChildren).filter(Boolean);
              }
              return child;
            };
            
            const cleanChildren = React.Children.map(children, processChildren);
            return <div {...props}>{cleanChildren}</div>;
          },
          p: (props: PropsWithChildren) => {
            // Check for problematic children
            if (props.children && typeof props.children === 'object' && !React.isValidElement(props.children) && !Array.isArray(props.children)) {
              console.error('Paragraph has invalid object child:', props.children);
              return null;
            }
            return <Text {...props} />;
          },
          code: (props: PropsWithChildren<{ className?: string }>) => {
            // Handle empty objects that might be passed as children
            if (props.children && typeof props.children === 'object' && !React.isValidElement(props.children) && !Array.isArray(props.children)) {
              // If it's a plain object, stringify it
              const content = JSON.stringify(props.children);
              return <CodeSpan>{content}</CodeSpan>;
            }
            
            // For code blocks, this is handled by the pre component
            // This handles inline code
            if (props.className && typeof props.children === 'string') {
              return (
                <CodePane language={props.className.split('-')[1]}>
                  {props.children}
                </CodePane>
              )
            } else if (props.children) {
              return <CodeSpan>{props.children}</CodeSpan>
            } else {
              return null;
            }
          }
        }}>
          <Slides />
        </MDXProvider>
      </Deck>
    </>
  );
};

createRoot(document.getElementById('app')!).render(<App />);