import React, { PropsWithChildren, useState } from 'react';
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
  Box
} from 'spectacle';
import JSIntroSlides from './js-intro-sections/index.mdx';
import TSIntroSlides from './ts-intro-sections/index.mdx';
import CodeDisplay from './components/CodeDisplayWithSlideTracking';
import './styles.css'

// Define all MDX components
const mdxComponents: Parameters<typeof MDXProvider>[0]["components"] = {
  // Map markdown elements to Spectacle components
  h2: Heading,
  ul: UnorderedList,
  ol: OrderedList,
  li: ({ children }: PropsWithChildren) => <ListItem fontSize="30px">{children}</ListItem>,
  p: Text,
  code: (props: PropsWithChildren<{ className?: string }>) => {
    if (props.className && typeof props.children === 'string') {
      return (
        <CodeDisplay language={props.className.split('-')[1]}>
          {props.children}
        </CodeDisplay>
      )
    } else {
      return <CodeSpan>{props.children}</CodeSpan>
    }
  },
  // Make Spectacle components available in MDX
  SlideLayout,
  Image,
  FlexBox,
  Box,
  UnorderedList,
  ListItem
};

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
      </div>
      
      <MDXProvider disableParentContext={false} components={mdxComponents}>
        <Deck backgroundImage="url(https://ctp-presentation-media.s3.us-east-2.amazonaws.com/bg.gif)">
          <Slides />
        </Deck>
      </MDXProvider>
    </>
  );
};

createRoot(document.getElementById('app')!).render(<App />);