import React from 'react';
import { TestResult } from './types';

interface TestResultsProps {
  results: TestResult[];
  themeColors: any;
}

export const TestResults: React.FC<TestResultsProps> = ({ results, themeColors }) => {
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const allPassed = passedCount === totalCount && totalCount > 0;
  
  return (
    <div className="test-results" style={{ 
      flex: 1, 
      overflowY: 'auto',
      overflowX: 'hidden',
      minHeight: 0,
      padding: '10px',
      backgroundColor: themeColors.backgroundSecondary
    }}>
      {results.length === 0 ? (
        <div style={{ 
          color: themeColors.muted, 
          fontStyle: 'italic',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          No tests to run
        </div>
      ) : (
        <>
          {/* Summary */}
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: allPassed ? '#1e3a1e' : '#3a1e1e',
            borderRadius: '4px',
            border: `1px solid ${allPassed ? themeColors.success : themeColors.error}`
          }}>
            <div style={{
              color: allPassed ? themeColors.success : themeColors.error,
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              {passedCount} / {totalCount} tests passed
            </div>
          </div>
          
          {/* Individual test results */}
          {results.map((result, index) => (
            <div
              key={index}
              style={{
                marginBottom: '8px',
                padding: '8px',
                backgroundColor: result.passed ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                borderRadius: '4px',
                border: `1px solid ${result.passed ? themeColors.success : themeColors.error}`,
                fontFamily: 'monospace',
                fontSize: '12px'
              }}
            >
              <div style={{ 
                color: result.passed ? themeColors.success : themeColors.error,
                fontWeight: 'bold',
                marginBottom: result.error ? '4px' : '0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '16px' }}>
                  {result.passed ? '✓' : '✗'}
                </span>
                {String(result.name || result.description || 'Test')}
                {result.duration && (
                  <span style={{ 
                    color: themeColors.muted, 
                    fontSize: '11px',
                    marginLeft: 'auto'
                  }}>
                    {result.duration}ms
                  </span>
                )}
              </div>
              {result.error && (
                <div style={{ 
                  color: themeColors.error,
                  marginTop: '4px',
                  fontSize: '11px',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {String(result.error)}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
};