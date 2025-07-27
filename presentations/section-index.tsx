import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { jsSections, tsSections } from './sections.config';
import './styles.css';

const App = () => {
  const [activeTab, setActiveTab] = useState<'js' | 'ts'>('js');
  const sections = activeTab === 'js' ? jsSections : tsSections;

  const sectionCardStyle = {
    display: 'block',
    padding: '20px',
    margin: '10px 0',
    backgroundColor: '#f9f9f9',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    textDecoration: 'none',
    color: '#333',
    transition: 'all 0.3s ease',
    ':hover': {
      backgroundColor: '#e8f4fd',
      borderColor: '#61dafb',
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '40px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
      }}>
        <h1 style={{
          textAlign: 'center',
          marginBottom: '30px',
          color: '#333',
          fontSize: '36px'
        }}>
          CTP Presentations
        </h1>
        
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '30px'
        }}>
          <button
            onClick={() => setActiveTab('js')}
            style={{
              padding: '12px 24px',
              margin: '0 10px',
              backgroundColor: activeTab === 'js' ? '#f7df1e' : '#e0e0e0',
              color: activeTab === 'js' ? '#333' : '#666',
              border: 'none',
              borderRadius: '6px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            JavaScript
          </button>
          <button
            onClick={() => setActiveTab('ts')}
            style={{
              padding: '12px 24px',
              margin: '0 10px',
              backgroundColor: activeTab === 'ts' ? '#3178c6' : '#e0e0e0',
              color: activeTab === 'ts' ? 'white' : '#666',
              border: 'none',
              borderRadius: '6px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            TypeScript
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '15px'
        }}>
          {sections.map((section, index) => (
            <a
              key={section.id}
              href={section.url}
              style={sectionCardStyle}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#e8f4fd';
                e.currentTarget.style.borderColor = '#61dafb';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#f9f9f9';
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '5px'
                  }}>
                    Section {index + 1}
                  </div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    {section.name}
                  </div>
                </div>
                <div style={{
                  fontSize: '24px',
                  color: '#61dafb'
                }}>
                  →
                </div>
              </div>
            </a>
          ))}
        </div>

        <div style={{
          marginTop: '40px',
          padding: '20px',
          backgroundColor: '#f0f8ff',
          borderLeft: '4px solid #61dafb',
          borderRadius: '4px'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>Navigation Guide</h3>
          <p style={{ margin: 0, color: '#666' }}>
            Each section is a standalone presentation. Use the navigation links at the beginning and end of each section to move between them, or return to this index at any time.
          </p>
        </div>
      </div>
    </div>
  );
};

createRoot(document.getElementById('app')!).render(<App />);