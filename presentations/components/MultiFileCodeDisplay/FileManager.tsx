import React from 'react';
import { FileContent } from './types';

interface FileManagerProps {
  files: FileContent[];
  currentFileIndex: number;
  onFileSelect: (index: number) => void;
  onReset: () => void;
  onToggleExecution: () => void;
  isExecuting: boolean;
  themeColors: any;
  scratchPadVersion?: number;
  currentTheme?: 'vs-dark' | 'vs';
  onToggleTheme?: () => void;
}

export const FileManager: React.FC<FileManagerProps> = ({
  files,
  currentFileIndex,
  onFileSelect,
  onReset,
  onToggleExecution,
  isExecuting,
  themeColors,
  scratchPadVersion,
  currentTheme,
  onToggleTheme
}) => {
  return (
    <div className="file-tabs" style={{ 
      display: 'flex', 
      backgroundColor: themeColors.background, 
      borderBottom: `1px solid ${themeColors.border}`,
      minHeight: '35px'
    }}>
      {files.map((file, index) => {
        if (!file || typeof file !== 'object') {
          console.error('[FileManager] Invalid file object:', file);
          return null;
        }
        return (
          <button
            key={file.fileName || `file-${index}`}
            className={`file-tab ${index === currentFileIndex ? 'active' : ''}`}
            onClick={() => onFileSelect(index)}
            style={{
              padding: '8px 16px',
              backgroundColor: index === currentFileIndex ? themeColors.backgroundSecondary : 'transparent',
              color: index === currentFileIndex ? themeColors.foreground : themeColors.muted,
              border: 'none',
              borderRight: '1px solid #333',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}
          >
            {file.fileName || 'Untitled'}
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      
      {/* Reset button */}
      <button
        onClick={onReset}
        style={{
          padding: '8px 16px',
          backgroundColor: themeColors.error,
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px',
          marginRight: '10px',
          borderRadius: '4px',
          transition: 'background-color 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
      >
        Reset
      </button>
      
      <button
        onClick={onToggleExecution}
        style={{
          padding: '8px 16px',
          backgroundColor: scratchPadVersion && scratchPadVersion > 0 ? themeColors.primary : themeColors.muted,
          color: scratchPadVersion && scratchPadVersion > 0 ? 'white' : themeColors.foreground,
          border: 'none',
          cursor: scratchPadVersion && scratchPadVersion > 0 ? 'pointer' : 'not-allowed',
          fontSize: '12px',
          marginRight: '10px',
          borderRadius: '4px',
          transition: 'background-color 0.2s',
          opacity: scratchPadVersion && scratchPadVersion > 0 ? 1 : 0.5
        }}
        disabled={!scratchPadVersion || scratchPadVersion === 0}
        onMouseOver={(e) => {
          if (scratchPadVersion && scratchPadVersion > 0) {
            e.currentTarget.style.backgroundColor = '#1e7ce8';
          }
        }}
        onMouseOut={(e) => {
          if (scratchPadVersion && scratchPadVersion > 0) {
            e.currentTarget.style.backgroundColor = themeColors.primary;
          }
        }}
      >
        {isExecuting ? 'Hide Output' : 'Run Code'}
      </button>
      
      {/* Theme toggle button */}
      {onToggleTheme && (
        <button
          onClick={onToggleTheme}
          style={{
            padding: '8px 16px',
            backgroundColor: currentTheme === 'vs-dark' ? '#ffffff' : '#1e1e1e',
            color: currentTheme === 'vs-dark' ? '#000000' : '#d4d4d4',
            border: '1px solid ' + (currentTheme === 'vs-dark' ? '#e5e5e5' : '#3e3e42'),
            cursor: 'pointer',
            fontSize: '12px',
            marginRight: '10px',
            borderRadius: '4px'
          }}
          title={currentTheme === 'vs-dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {currentTheme === 'vs-dark' ? '☀️' : '🌙'}
        </button>
      )}
    </div>
  );
};