import React, { PropsWithChildren } from 'react';
import { createRoot } from 'react-dom/client';
import { CodeSpan, Deck, DefaultTemplate, Heading, ListItem, OrderedList, Text, UnorderedList } from 'spectacle';
import Slides from './1.intro.to.js.mdx';
import CodeDisplay from './components/CodeDisplayWithSlideTracking';
import './styles.css'

const Presentation = () => (
  <Deck backgroundImage="url(https://ctp-presentation-media.s3.us-east-2.amazonaws.com/bg.gif)">
    <Slides components={{
      h2: Heading, ul: UnorderedList, ol: OrderedList, li: ({ children }: PropsWithChildren) => <ListItem fontSize="30px">{children}</ListItem>, p: Text, code: (props: { className: string, children: string }) => {
        if (props.className) {
          return (
            <CodeDisplay language={props.className.split('-')[1]}>
              {props.children}
            </CodeDisplay>
          )
        } else {
          return <code>{props.children}</code>
        }
      }
    }} />
  </Deck>
);

createRoot(document.getElementById('app')!).render(<Presentation />);