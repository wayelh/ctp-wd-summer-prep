import React from 'react';
import { ConsoleOutput as ConsoleOutputType } from './types';

interface ConsoleOutputProps {
  outputs: ConsoleOutputType[];
  themeColors: any;
}

export const ConsoleOutput: React.FC<ConsoleOutputProps> = ({ outputs, themeColors }) => {
  return (
    <div className="console-output" style={{ 
      flex: 1, 
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '10px',
      backgroundColor: themeColors.backgroundSecondary
    }}>
      {outputs.length === 0 ? (
        <div style={{ 
          color: themeColors.muted, 
          fontStyle: 'italic',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          Click Run to execute code
        </div>
      ) : (
        outputs.map((output, index) => (
          <div
            key={index}
            style={{
              color: output.type === 'error' ? themeColors.error : 
                     output.type === 'warn' ? themeColors.warning : 
                     output.type === 'info' ? themeColors.info : themeColors.foreground,
              marginBottom: '4px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'monospace',
              fontSize: '12px',
              lineHeight: '1.4'
            }}
          >
            <span style={{ 
              color: output.type === 'error' ? themeColors.error : 
                     output.type === 'warn' ? themeColors.warning : 
                     themeColors.muted,
              marginRight: '8px'
            }}>
              [{output.timestamp instanceof Date ? output.timestamp.toLocaleTimeString() : new Date(output.timestamp).toLocaleTimeString()}]
            </span>
            {String(output.message || '')}
          </div>
        ))
      )}
    </div>
  );
};