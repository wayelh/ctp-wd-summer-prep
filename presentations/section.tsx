import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Deck, DefaultTemplate } from 'spectacle';
import SectionRouter from './components/SectionRouter';
import { jsSections, tsSections, getSectionNavigation } from './sections.config';
import './styles.css';

const App = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const sectionId = urlParams.get('id');
  
  if (!sectionId) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        fontSize: '24px',
        fontFamily: 'Arial, sans-serif'
      }}>
        No section specified. Please provide a section ID in the URL.
      </div>
    );
  }

  // Determine if this is a JS or TS section and get navigation
  const allSections = [...jsSections, ...tsSections];
  const currentSection = allSections.find(section => section.sectionKey === sectionId);
  const isJsSection = jsSections.some(section => section.sectionKey === sectionId);
  const sections = isJsSection ? jsSections : tsSections;
  const navigation = currentSection ? getSectionNavigation(currentSection.id, sections) : null;

  return (
    <>
      {/* Navigation controls */}
      <div style={{
        position: 'fixed',
        top: 10,
        left: 10,
        right: 10,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.7)',
        padding: '10px',
        borderRadius: '5px'
      }}>
        <div>
          {navigation?.previous && (
            <a
              href={navigation.previous.url}
              style={{
                margin: '0 5px',
                padding: '5px 10px',
                background: '#28a745',
                border: 'none',
                borderRadius: '3px',
                color: 'white',
                textDecoration: 'none',
                fontSize: '12px'
              }}
            >
              ← {navigation.previous.name}
            </a>
          )}
        </div>
        
        <div style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>
          {currentSection?.name || sectionId}
        </div>
        
        <div>
          {navigation?.next && (
            <a
              href={navigation.next.url}
              style={{
                margin: '0 5px',
                padding: '5px 10px',
                background: '#28a745',
                border: 'none',
                borderRadius: '3px',
                color: 'white',
                textDecoration: 'none',
                fontSize: '12px'
              }}
            >
              {navigation.next.name} →
            </a>
          )}
        </div>
      </div>

      {/* Back to sections link */}
      <div style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        zIndex: 1000
      }}>
        <a
          href="/section-index.html"
          style={{
            padding: '8px 12px',
            background: '#007bff',
            border: 'none',
            borderRadius: '3px',
            color: 'white',
            textDecoration: 'none',
            fontSize: '12px'
          }}
        >
          All Sections
        </a>
      </div>

      <Suspense fallback={
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          fontSize: '24px',
          fontFamily: 'Arial, sans-serif'
        }}>
          Loading section...
        </div>
      }>
        <Deck backgroundImage="url(https://ctp-presentation-media.s3.us-east-2.amazonaws.com/bg.gif)" template={() => <DefaultTemplate />}>
          <SectionRouter sectionId={sectionId} />
        </Deck>
      </Suspense>
    </>
  );
};

createRoot(document.getElementById('app')!).render(<App />);