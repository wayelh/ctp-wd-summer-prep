import React from 'react';
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
  CodePane
} from 'spectacle';
import IntroSlides from './js-intro-sections/introduction.mdx';
import './styles.css';

const App = () => {
  return (
    <Deck backgroundImage="url(https://ctp-presentation-media.s3.us-east-2.amazonaws.com/bg.gif)" template={() => <DefaultTemplate />}>
      <IntroSlides components={{
        h2: Heading,
        ul: UnorderedList,
        ol: OrderedList,
        li: ({ children }: any) => <ListItem fontSize="30px">{children}</ListItem>,
        p: Text,
        code: (props: any) => {
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
  );
};

createRoot(document.getElementById('app')!).render(<App />);