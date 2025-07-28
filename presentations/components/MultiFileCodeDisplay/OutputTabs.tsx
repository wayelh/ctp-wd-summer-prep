import React from 'react';
import { TestResult } from './types';

interface OutputTabsProps {
  activeTab: 'code' | 'console' | 'tests' | 'preview' | 'diff';
  onTabChange: (tab: 'code' | 'console' | 'tests' | 'preview' | 'diff') => void;
  testResults: TestResult[];
  showPreview: boolean;
  showDiff: boolean;
  themeColors: any;
  isPaneExpanded: boolean;
  isPaneCollapsed: boolean;
  onToggleExpand: () => void;
  onToggleCollapse: () => void;
}

export const OutputTabs: React.FC<OutputTabsProps> = ({
  activeTab,
  onTabChange,
  testResults,
  showPreview,
  showDiff,
  themeColors,
  isPaneExpanded,
  isPaneCollapsed,
  onToggleExpand,
  onToggleCollapse
}) => {
  const passedTests = testResults.filter(r => r.passed).length;
  
  return (
    <div style={{ 
      display: 'flex', 
      backgroundColor: themeColors.backgroundSecondary, 
      borderBottom: `1px solid ${themeColors.border}`,
      position: 'relative'
    }}>
      {showPreview && (
        <button
          onClick={() => onTabChange('preview')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeTab === 'preview' ? themeColors.backgroundSecondary : 'transparent',
            color: activeTab === 'preview' ? themeColors.foreground : themeColors.muted,
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: 'monospace',
            transition: 'all 0.2s'
          }}
        >
          Preview
        </button>
      )}
      
      <button
        onClick={() => onTabChange('console')}
        style={{
          padding: '8px 16px',
          backgroundColor: activeTab === 'console' ? themeColors.backgroundSecondary : 'transparent',
          color: activeTab === 'console' ? themeColors.foreground : themeColors.muted,
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px',
          fontFamily: 'monospace',
          transition: 'all 0.2s'
        }}
      >
        Console
      </button>
      
      <button
        onClick={() => onTabChange('tests')}
        style={{
          padding: '8px 16px',
          backgroundColor: activeTab === 'tests' ? themeColors.backgroundSecondary : 'transparent',
          color: activeTab === 'tests' ? themeColors.foreground : themeColors.muted,
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px',
          fontFamily: 'monospace',
          transition: 'all 0.2s'
        }}
      >
        Tests {testResults.length > 0 && `(${passedTests}/${testResults.length})`}
      </button>
      
      {showDiff && (
        <button
          onClick={() => onTabChange('diff')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeTab === 'diff' ? themeColors.backgroundSecondary : 'transparent',
            color: activeTab === 'diff' ? themeColors.foreground : themeColors.muted,
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: 'monospace',
            transition: 'all 0.2s'
          }}
        >
          Solutions
        </button>
      )}
      
      {/* Collapse/Expand controls */}
      <div style={{ 
        marginLeft: 'auto', 
        display: 'flex', 
        gap: '4px',
        paddingRight: '8px'
      }}>
        <button
          onClick={onToggleExpand}
          disabled={isPaneExpanded}
          style={{
            padding: '4px 8px',
            backgroundColor: 'transparent',
            color: isPaneExpanded ? themeColors.muted : themeColors.foreground,
            border: `1px solid ${isPaneExpanded ? themeColors.muted : themeColors.border}`,
            borderRadius: '4px',
            cursor: isPaneExpanded ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            opacity: isPaneExpanded ? 0.5 : 1
          }}
          title="Expand output pane"
        >
          ⬆
        </button>
        
        <button
          onClick={onToggleCollapse}
          disabled={isPaneCollapsed}
          style={{
            padding: '4px 8px',
            backgroundColor: 'transparent',
            color: isPaneCollapsed ? themeColors.muted : themeColors.foreground,
            border: `1px solid ${isPaneCollapsed ? themeColors.muted : themeColors.border}`,
            borderRadius: '4px',
            cursor: isPaneCollapsed ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            opacity: isPaneCollapsed ? 0.5 : 1
          }}
          title="Collapse output pane"
        >
          ⬇
        </button>
      </div>
    </div>
  );
};