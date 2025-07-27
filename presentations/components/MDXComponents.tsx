import React from 'react';
import { Version, TestVersion } from './CodeDisplayContext';

// Custom code component that renders as Version when inside a File component
export const CodeFence: React.FC<{ children: string; className?: string }> = ({ children, className }) => {
  // Check if we're inside a Tests component by looking for a data attribute
  const isInTests = React.useRef(false);
  
  React.useEffect(() => {
    // Check if any parent element has data-tests attribute
    const checkParent = (element: HTMLElement | null): boolean => {
      if (!element) return false;
      if (element.hasAttribute('data-tests')) return true;
      return checkParent(element.parentElement);
    };
    
    const currentElement = document.currentScript?.parentElement;
    isInTests.current = checkParent(currentElement || null);
  }, []);
  
  // Use TestVersion for test code, Version for regular code
  const Component = isInTests.current ? TestVersion : Version;
  
  return <Component>{children}</Component>;
};

// MDX components configuration
export const mdxComponents = {
  pre: ({ children, ...props }: any) => {
    // Extract the code content from the pre > code structure
    if (children?.props?.children && typeof children.props.children === 'string') {
      return <CodeFence {...props}>{children.props.children}</CodeFence>;
    }
    // Fallback to default pre rendering
    return <pre {...props}>{children}</pre>;
  },
  code: ({ children, ...props }: any) => {
    // Inline code stays as is
    if (!props.className?.includes('language-')) {
      return <code {...props}>{children}</code>;
    }
    // Block code is handled by the pre component
    return <code {...props}>{children}</code>;
  }
};