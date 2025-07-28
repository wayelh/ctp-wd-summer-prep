import { FileContent } from './types';

export const getLanguageFromExtension = (ext: string): string => {
  const langMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'css': 'css',
    'html': 'html',
    'json': 'json'
  };
  return langMap[ext] || 'plaintext';
};

export const parseFilesFromCode = (code: string): FileContent[] => {
  const lines = code.split('\n');
  const files: FileContent[] = [];
  let currentFile: FileContent | null = null;
  let inTest = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for file header
    if (line.startsWith('// File:')) {
      // Save previous file if exists
      if (currentFile) {
        files.push(currentFile);
      }
      
      // Start new file
      const fileName = line.trim().substring(6).trim();
      const ext = fileName.split('.').pop() || '';
      const language = getLanguageFromExtension(ext);
      
      currentFile = {
        fileName,
        content: '',
        language
      };
      inTest = false;
    } else if (currentFile) {
      // Check for test separator
      if (line.trim() === '// ***') {
        inTest = true;
        currentFile.testContent = '';
      } else if (inTest && currentFile.testContent !== undefined) {
        currentFile.testContent += (currentFile.testContent ? '\n' : '') + line;
      } else {
        currentFile.content += (currentFile.content ? '\n' : '') + line;
      }
    }
  }
  
  // Don't forget the last file
  if (currentFile) {
    files.push(currentFile);
  }
  
  // If no files were parsed, treat the entire code as a single file
  if (files.length === 0 && code.trim()) {
    const lines = code.split('\n');
    const testSeparatorIndex = lines.findIndex(line => line.trim() === '// ***');
    
    if (testSeparatorIndex !== -1) {
      const mainContent = lines.slice(0, testSeparatorIndex).join('\n').trim();
      const testContent = lines.slice(testSeparatorIndex + 1).join('\n').trim();
      
      files.push({
        fileName: 'main.tsx',
        content: mainContent,
        language: 'typescript',
        testContent: testContent
      });
    } else {
      files.push({
        fileName: 'main.tsx',
        content: code,
        language: 'typescript'
      });
    }
  }
  
  // Process files to separate test content
  return files.map(file => {
    if (!file.testContent && file.content.includes('// ***')) {
      const lines = file.content.split('\n');
      const testSeparatorIndex = lines.findIndex(line => line.trim() === '// ***');
      
      if (testSeparatorIndex !== -1) {
        const mainContent = lines.slice(0, testSeparatorIndex).join('\n').trim();
        const testContent = lines.slice(testSeparatorIndex + 1).join('\n').trim();
        
        return {
          ...file,
          content: mainContent,
          testContent: testContent
        };
      }
    }
    return file;
  });
};

// Safe base64 encoding that handles Unicode
export const safeBase64Encode = (str: string): string => {
  const bytes = new TextEncoder().encode(str);
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
  return btoa(binString);
};