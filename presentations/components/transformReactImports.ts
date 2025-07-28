
/**
 * Transform React imports from default imports to namespace imports
 * This allows the code to work with ES modules from CDNs
 */
export function transformReactImports(code: string): string {
  // Transform default React import to namespace import
  code = code.replace(
    /import\s+React\s+from\s+['"]react['"]/g,
    "import * as React from 'react'"
  );
  
  // Transform React with named imports to namespace import with destructuring
  code = code.replace(
    /import\s+React\s*,\s*\{\s*([^}]+)\s*\}\s+from\s+['"]react['"]/g,
    (match, namedImports) => {
      const cleanedImports = namedImports.split(',').map((i: string) => i.trim()).join(', ');
      return `import * as React from 'react';\nconst { ${cleanedImports} } = React`;
    }
  );
  
  // Transform named imports only (no React) to namespace import with destructuring
  code = code.replace(
    /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]react['"]/g,
    (match, namedImports) => {
      const cleanedImports = namedImports.split(',').map((i: string) => i.trim()).join(', ');
      return `import * as React from 'react';\nconst { ${cleanedImports} } = React`;
    }
  );
  
  // Transform ReactDOM imports
  code = code.replace(
    /import\s+ReactDOM\s+from\s+['"]react-dom(?:\/client)?['"]/g,
    "import * as ReactDOM from 'react-dom/client'"
  );
  
  // Transform named imports from ReactDOM
  code = code.replace(
    /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]react-dom(?:\/client)?['"]/g,
    (match, namedImports) => {
      const cleanedImports = namedImports.split(',').map((i: string) => i.trim()).join(', ');
      return `import * as ReactDOM from 'react-dom/client';\nconst { ${cleanedImports} } = ReactDOM`;
    }
  );
  
  return code;
}

/**
 * Transform TypeScript/JSX code for execution in the browser
 * This includes React import transformations
 */
export function transformCodeForExecution(code: string, filename: string): string {
  // Skip transformation for non-React files
  if (!filename.match(/\.(jsx?|tsx?)$/)) {
    return code;
  }
  
  // Apply React import transformations
  code = transformReactImports(code);
  
  // Add any other transformations here if needed
  
  return code;
}