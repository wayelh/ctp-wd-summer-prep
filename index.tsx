import React from 'react';
import { createRoot } from 'react-dom/client';
import { CodeSpan, Deck, DefaultTemplate, Heading, ListItem, MarkdownSlideSet, OrderedList, Text, UnorderedList } from 'spectacle';
import Slides from './slides.mdx';
import CodeDisplay from './components/CodeDisplayWithSlideTracking';

const Presentation = () => (
  <Deck template={() => <DefaultTemplate />}>
    <Slides components={{
      h2: Heading, ul: UnorderedList, ol: OrderedList, li: ListItem, p: Text, code: (props: { className: string, children: string }) => {
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