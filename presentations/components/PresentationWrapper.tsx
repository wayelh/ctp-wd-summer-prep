import React from 'react';
import { Deck, DefaultTemplate } from 'spectacle';

interface PresentationWrapperProps {
  children: React.ReactNode;
}

export default function PresentationWrapper({ children }: PresentationWrapperProps) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      <Deck
        theme={{
          colors: {
            primary: '#ebe5da',
            secondary: '#fc6986',
            tertiary: '#1e2852',
            quaternary: '#ffc951',
            quinary: '#8bddfd'
          },
          fonts: {
            header: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            text: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            monospace: '"Consolas", "Menlo", monospace'
          },
          fontSizes: {
            h1: '72px',
            h2: '64px',
            h3: '56px',
            text: '44px',
            monospace: '20px'
          }
        }}
        backgroundImage="url(https://ctp-presentation-media.s3.us-east-2.amazonaws.com/bg.gif)"
        template={() => <DefaultTemplate />}
      >
        {children}
      </Deck>
    </div>
  );
}