const fs = require('fs');
const path = require('path');

const jsSections = [
  { id: 'introduction', name: 'Introduction', file: 'introduction.mdx' },
  { id: 'html-basics', name: 'HTML Basics', file: 'html-basics.mdx' },
  { id: 'css-fundamentals', name: 'CSS Fundamentals', file: 'css-fundamentals.mdx' },
  { id: 'variables-and-types', name: 'Variables & Types', file: 'variables-and-types.mdx' },
  { id: 'functions', name: 'Functions', file: 'functions.mdx' },
  { id: 'control-flow', name: 'Control Flow', file: 'control-flow.mdx' },
  { id: 'objects-and-arrays', name: 'Objects & Arrays', file: 'objects-and-arrays.mdx' },
  { id: 'dom-manipulation', name: 'DOM Manipulation', file: 'dom-manipulation.mdx' },
  { id: 'async-javascript', name: 'Async JavaScript', file: 'async-javascript.mdx' },
  { id: 'error-handling', name: 'Error Handling', file: 'error-handling.mdx' },
  { id: 'advanced-functions', name: 'Advanced Functions', file: 'advanced-functions.mdx' },
  { id: 'prototypes', name: 'Prototypes', file: 'prototypes.mdx' },
  { id: 'modules', name: 'Modules', file: 'modules.mdx' },
  { id: 'modern-features', name: 'Modern Features', file: 'modern-features.mdx' },
  { id: 'common-pitfalls', name: 'Common Pitfalls', file: 'common-pitfalls.mdx' },
  { id: 'best-practices', name: 'Best Practices', file: 'best-practices.mdx' }
];

const tsSections = [
  { id: 'introduction', name: 'Introduction', file: 'introduction.mdx' },
  { id: 'type-basics', name: 'Type Basics', file: 'type-basics.mdx' },
  { id: 'interfaces-and-types', name: 'Interfaces & Types', file: 'interfaces-and-types.mdx' },
  { id: 'unions-and-literals', name: 'Unions & Literals', file: 'unions-and-literals.mdx' },
  { id: 'generics', name: 'Generics', file: 'generics.mdx' },
  { id: 'type-guards', name: 'Type Guards', file: 'type-guards.mdx' },
  { id: 'utility-types', name: 'Utility Types', file: 'utility-types.mdx' },
  { id: 'classes-and-oop', name: 'Classes & OOP', file: 'classes-and-oop.mdx' },
  { id: 'modules-and-namespaces', name: 'Modules & Namespaces', file: 'modules-and-namespaces.mdx' },
  { id: 'async-types', name: 'Async Types', file: 'async-types.mdx' },
  { id: 'common-patterns', name: 'Common Patterns', file: 'common-patterns.mdx' },
  { id: 'react-typescript', name: 'React & TypeScript', file: 'react-typescript.mdx' },
  { id: 'testing-typescript', name: 'Testing TypeScript', file: 'testing-typescript.mdx' },
  { id: 'migration-strategies', name: 'Migration Strategies', file: 'migration-strategies.mdx' },
  { id: 'ecosystem-and-tools', name: 'Ecosystem & Tools', file: 'ecosystem-and-tools.mdx' }
];

function generateSectionFile(section, prefix, sectionsDir) {
  const componentName = section.file.replace('.mdx', '').split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('');
  
  const content = `import React, { PropsWithChildren, useContext } from 'react';
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
import ${componentName}Slides from './${sectionsDir}/${section.file}';
import { Version } from './components/CodeDisplayWithSlideTracking';
import './styles.css';
import { CodeDisplayContext } from './components/CodeDisplayContext';
import SectionNavigation from './components/SectionNavigation';
import { getSectionNavigation, ${prefix}Sections } from './sections.config';

const App = () => {
  const nav = getSectionNavigation('${section.id}', ${prefix}Sections);

  return (
    <Deck backgroundImage="url(https://ctp-presentation-media.s3.us-east-2.amazonaws.com/bg.gif)" template={() => <DefaultTemplate />}>
      {/* Navigation slide at start */}
      <SectionNavigation 
        type="start"
        currentSection={nav?.current.name || '${section.name}'}
        previousSection={nav?.previous}
        nextSection={nav?.next}
      />

      <${componentName}Slides components={{
        // Map markdown elements to Spectacle components
        h2: Heading,
        ul: UnorderedList,
        ol: OrderedList,
        li: ({ children }: PropsWithChildren) => <ListItem fontSize="30px">{children}</ListItem>,
        p: Text,
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

      {/* Navigation slide at end */}
      <SectionNavigation 
        type="end"
        currentSection={nav?.current.name || '${section.name}'}
        previousSection={nav?.previous}
        nextSection={nav?.next}
      />
    </Deck>
  );
};

createRoot(document.getElementById('app')!).render(<App />);`;

  const fileName = `${prefix}-${section.id}.tsx`;
  fs.writeFileSync(fileName, content);
  console.log(`Generated ${fileName}`);
}

// Generate JavaScript sections
console.log('Generating JavaScript section files...');
jsSections.forEach(section => {
  generateSectionFile(section, 'js', 'js-intro-sections');
});

// Generate TypeScript sections
console.log('Generating TypeScript section files...');
tsSections.forEach(section => {
  generateSectionFile(section, 'ts', 'ts-intro-sections');
});

console.log('All section files generated!');