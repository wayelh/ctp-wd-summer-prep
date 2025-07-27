import React, { lazy, Suspense, useEffect, useState } from 'react';
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
  CodePane,
  SlideLayout
} from 'spectacle';
import { CodeDisplayContext } from './CodeDisplayContext';
import { Version } from './CodeDisplayWithSlideTracking';
import { PropsWithChildren } from 'react';

// Dynamic imports for all sections
const sectionImports: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  // JavaScript sections
  'js-introduction': () => import('../js-intro-sections/introduction.mdx'),
  'js-html-basics': () => import('../js-intro-sections/html-basics.mdx'),
  'js-css-fundamentals': () => import('../js-intro-sections/css-fundamentals.mdx'),
  'js-variables-and-types': () => import('../js-intro-sections/variables-and-types.mdx'),
  'js-functions': () => import('../js-intro-sections/functions.mdx'),
  'js-control-flow': () => import('../js-intro-sections/control-flow.mdx'),
  'js-objects-and-arrays': () => import('../js-intro-sections/objects-and-arrays.mdx'),
  'js-dom-manipulation': () => import('../js-intro-sections/dom-manipulation.mdx'),
  'js-async-javascript': () => import('../js-intro-sections/async-javascript.mdx'),
  'js-error-handling': () => import('../js-intro-sections/error-handling.mdx'),
  'js-advanced-functions': () => import('../js-intro-sections/advanced-functions.mdx'),
  'js-prototypes': () => import('../js-intro-sections/prototypes.mdx'),
  'js-modules': () => import('../js-intro-sections/modules.mdx'),
  'js-modern-features': () => import('../js-intro-sections/modern-features.mdx'),
  'js-common-pitfalls': () => import('../js-intro-sections/common-pitfalls.mdx'),
  'js-best-practices': () => import('../js-intro-sections/best-practices.mdx'),
  
  // TypeScript sections
  'ts-introduction': () => import('../ts-intro-sections/introduction.mdx'),
  'ts-type-basics': () => import('../ts-intro-sections/type-basics.mdx'),
  'ts-interfaces-and-types': () => import('../ts-intro-sections/interfaces-and-types.mdx'),
  'ts-unions-and-literals': () => import('../ts-intro-sections/unions-and-literals.mdx'),
  'ts-generics': () => import('../ts-intro-sections/generics.mdx'),
  'ts-type-guards': () => import('../ts-intro-sections/type-guards.mdx'),
  'ts-utility-types': () => import('../ts-intro-sections/utility-types.mdx'),
  'ts-classes-and-oop': () => import('../ts-intro-sections/classes-and-oop.mdx'),
  'ts-modules-and-namespaces': () => import('../ts-intro-sections/modules-and-namespaces.mdx'),
  'ts-async-types': () => import('../ts-intro-sections/async-types.mdx'),
  'ts-common-patterns': () => import('../ts-intro-sections/common-patterns.mdx'),
  'ts-react-typescript': () => import('../ts-intro-sections/react-typescript.mdx'),
  'ts-testing-typescript': () => import('../ts-intro-sections/testing-typescript.mdx'),
  'ts-migration-strategies': () => import('../ts-intro-sections/migration-strategies.mdx'),
  'ts-ecosystem-and-tools': () => import('../ts-intro-sections/ecosystem-and-tools.mdx')
};

interface SectionRouterProps {
  sectionId: string;
}

const SectionRouter: React.FC<SectionRouterProps> = ({ sectionId }) => {
  const [sectionModule, setSectionModule] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSection = async () => {
      try {
        setError(null);
        setSectionModule(null);
        
        const importFn = sectionImports[sectionId];
        if (!importFn) {
          setError(`Section "${sectionId}" not found`);
          return;
        }

        const module = await importFn();
        setSectionModule(module);
      } catch (err) {
        setError(`Failed to load section: ${err}`);
      }
    };

    loadSection();
  }, [sectionId]);

  if (error) {
    return (
      <SlideLayout.Full>
        <Heading>Error</Heading>
        <Text>{error}</Text>
      </SlideLayout.Full>
    );
  }

  if (!sectionModule) {
    return (
      <SlideLayout.Full>
        <Heading>Loading...</Heading>
      </SlideLayout.Full>
    );
  }

  const SectionComponent = sectionModule.default;

  return (
    <SectionComponent components={{
      h2: Heading,
      ul: UnorderedList,
      ol: OrderedList,
      li: ({ children }: PropsWithChildren) => <ListItem fontSize="30px">{children}</ListItem>,
      p: Text,
      code: (props: PropsWithChildren<{ className?: string }>) => {
        if (React.useContext(CodeDisplayContext)) {
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
  );
};

export default SectionRouter;