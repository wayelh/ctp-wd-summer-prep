import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const App = () => {
  const cardStyle = {
    padding: '30px',
    margin: '20px',
    backgroundColor: '#f9f9f9',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    textAlign: 'center' as const,
    textDecoration: 'none',
    color: '#333',
    transition: 'all 0.3s ease',
    display: 'block',
    cursor: 'pointer'
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        maxWidth: '800px',
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '60px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '48px',
          marginBottom: '20px',
          color: '#333',
          fontWeight: 'bold'
        }}>
          CTP Presentations
        </h1>
        
        <p style={{
          fontSize: '20px',
          color: '#666',
          marginBottom: '50px',
          lineHeight: '1.5'
        }}>
          Choose how you'd like to experience the content:
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '30px',
          marginBottom: '40px'
        }}>
          <a
            href="/sections-index.html"
            style={cardStyle}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#e8f4fd';
              e.currentTarget.style.borderColor = '#61dafb';
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#f9f9f9';
              e.currentTarget.style.borderColor = '#e0e0e0';
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              fontSize: '36px',
              marginBottom: '15px'
            }}>📚</div>
            <h2 style={{
              fontSize: '24px',
              marginBottom: '15px',
              color: '#333'
            }}>
              Individual Sections
            </h2>
            <p style={{
              fontSize: '16px',
              color: '#666',
              margin: 0,
              lineHeight: '1.4'
            }}>
              Browse and jump between sections independently. Perfect for targeted learning or quick reference.
            </p>
          </a>

          <a
            href="/combined.html?presentation=js"
            style={cardStyle}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#fff8e1';
              e.currentTarget.style.borderColor = '#f7df1e';
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#f9f9f9';
              e.currentTarget.style.borderColor = '#e0e0e0';
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              fontSize: '36px',
              marginBottom: '15px'
            }}>🟨</div>
            <h2 style={{
              fontSize: '24px',
              marginBottom: '15px',
              color: '#333'
            }}>
              Full JavaScript Course
            </h2>
            <p style={{
              fontSize: '16px',
              color: '#666',
              margin: 0,
              lineHeight: '1.4'
            }}>
              Complete presentation with all JavaScript sections in one flow. Traditional slide experience.
            </p>
          </a>

          <a
            href="/combined.html?presentation=ts"
            style={cardStyle}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#e3f2fd';
              e.currentTarget.style.borderColor = '#3178c6';
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#f9f9f9';
              e.currentTarget.style.borderColor = '#e0e0e0';
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              fontSize: '36px',
              marginBottom: '15px'
            }}>🟦</div>
            <h2 style={{
              fontSize: '24px',
              marginBottom: '15px',
              color: '#333'
            }}>
              Full TypeScript Course
            </h2>
            <p style={{
              fontSize: '16px',
              color: '#666',
              margin: 0,
              lineHeight: '1.4'
            }}>
              Complete presentation with all TypeScript sections in one flow. Traditional slide experience.
            </p>
          </a>
        </div>

        <div style={{
          padding: '20px',
          backgroundColor: '#f0f8ff',
          borderLeft: '4px solid #61dafb',
          borderRadius: '4px',
          textAlign: 'left'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>💡 Tip</h3>
          <p style={{ margin: 0, color: '#666' }}>
            The individual sections format is great for instructors who want to teach specific topics or students who want to review particular concepts without going through the entire presentation.
          </p>
        </div>
      </div>
    </div>
  );
};

createRoot(document.getElementById('app')!).render(<App />);