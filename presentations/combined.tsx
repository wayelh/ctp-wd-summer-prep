import React, { PropsWithChildren, useContext, useState } from 'react';
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
import CodeDisplay, { Version } from './components/CodeDisplayWithSlideTracking';
import './styles.css'
import { CodeDisplayContext } from './components/CodeDisplayContext';

const App = () => {
  // Check URL or localStorage for presentation choice
  const urlParams = new URLSearchParams(window.location.search);
  const presentationParam = urlParams.get('presentation') || 'js';
  const [presentation, setPresentation] = useState<'js' | 'ts'>(presentationParam as 'js' | 'ts');

  const Slides = presentation === 'js' ? JSIntroSlides : TSIntroSlides;

  return (
    <>
      {/* Simple presentation selector */}
      <div style={{
        position: 'fixed',
        top: 10,
        right: 10,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        padding: '10px',
        borderRadius: '5px'
      }}>
        <button
          onClick={() => {
            setPresentation('js');
            window.history.pushState({}, '', '?presentation=js');
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
            window.history.pushState({}, '', '?presentation=ts');
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
        <a
          href="/sections.html"
          style={{
            margin: '0 5px',
            padding: '5px 10px',
            background: '#28a745',
            border: 'none',
            borderRadius: '3px',
            color: 'white',
            textDecoration: 'none',
            fontSize: '12px'
          }}
        >
          Sections
        </a>
      </div>

      <Deck backgroundImage="url(https://ctp-presentation-media.s3.us-east-2.amazonaws.com/bg.gif)" template={() => <DefaultTemplate />}>
        <Slides components={{
          // Map markdown elements to Spectacle components
          h1: ({ children }: PropsWithChildren) => <Heading size={1}>{children}</Heading>,
          h2: ({ children }: PropsWithChildren) => <Heading size={2}>{children}</Heading>,
          h3: ({ children }: PropsWithChildren) => <Heading size={4}>{children}</Heading>,
          h4: ({ children }: PropsWithChildren) => <Heading size={5}>{children}</Heading>,
          h5: ({ children }: PropsWithChildren) => <Heading size={6}>{children}</Heading>,
          ul: UnorderedList,
          ol: OrderedList,
          li: ({ children }: PropsWithChildren) => <ListItem fontSize="30px">{children}</ListItem>,
          p: ({ children }: PropsWithChildren) => <Text fontSize="16px">{children}</Text>,
          code: (props: PropsWithChildren<{ className?: string }>) => {
            if (useContext(CodeDisplayContext)) {
              // If we're in a CodeDisplay context, use CodeDisplay component
              return (
                
                  {props.children}
                
              );
            }
            if (props.className && typeof props.children === 'string') {
              return (
                <CodePane language={props.className.split('-')[1]}>
                  {props.children}
                </CodePane>
              )
            } else {
              return <CodeSpan>{props.children}</CodeSpan>
            }
          }
        }} />
      </Deck>
    </>
  );
};

createRoot(document.getElementById('app')!).render(<App />);