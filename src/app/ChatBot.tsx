"use client";
import { useState, useRef, useEffect } from 'react';
import styles from './ChatBot.module.css';

interface Message {
  text: string;
  sender: 'user' | 'bot' | 'system';
  sql?: string;
  suggested_questions?: string[];
  query_result?: string;
}

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([
    { text: "Hi! I'm DigiBook Bot. Ask me anything!", sender: 'bot' }
  ]);
  const [input, setInput] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages(prev => [...prev, { text: userMsg, sender: 'user' }]);
    setInput('');

    try {
      const res = await fetch('http://20.244.28.186:8899/ask', {
        method: 'POST',
        headers: {
          'accept': 'text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: userMsg }),
      });
      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let finalReceived = false;
      let notificationActive = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const jsonStr = line.replace('data:', '').trim();
              if (jsonStr === '[DONE]') continue;
              const data = JSON.parse(jsonStr);
              if (data.type === 'notification') {
                setNotification(data.content);
                notificationActive = true;
              } else if (data.type === 'final') {
                setNotification(null);
                setMessages(prev => [...prev, {
                  text: data.data.answer ?? data.content ?? JSON.stringify(data),
                  sender: 'bot',
                  sql: data.data.sql_query,
                  suggested_questions: data.data.suggested_questions,
                  query_result: data.data.query_result
                }]);
                finalReceived = true;
                notificationActive = false;
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
        if (finalReceived) break;
      }
    } catch (err) {
      setNotification(null);
      setMessages(prev => [...prev, { text: 'Sorry, there was an error connecting to the server.', sender: 'bot' }]);
    }
  };

  const [tooltip, setTooltip] = useState<{ type: 'sql' | 'suggested'; idx: number } | null>(null);
  
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && tooltip) {
        setTooltip(null);
      }
    };
    
    window.addEventListener('keydown', handleEscKey);
    
    if (tooltip) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      window.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = '';
    };
  }, [tooltip]);

  return (
    <div className={styles.chatbotContainer}>
      <div className={styles.header}>DigiBook Bot 🤖</div>
      <div className={styles.messages}>
        {/* Render messages and notification box in place of system message */}
        {messages.map((msg, idx) => {
          // If notification is active, show notification box at the place of the latest system message
          if (notification && idx === messages.length - 1 && msg.sender === 'user') {
            return (
              <>
                <div
                  key={idx}
                  className={styles.userMsg}
                  style={{ position: 'relative' }}
                >
                  {/* Render user message */}
                  {msg.text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
                    if (/^\*\*[^*]+\*\*$/.test(part)) {
                      return <strong key={i}>{part.replace(/\*\*/g, '')}</strong>;
                    }
                    return <span key={i}>{part}</span>;
                  })}
                </div>
                {/* Notification with loader*/}
                <div
                  key={"notif-box"}
                  style={{
                    background: '#f5f6fa',
                    color: '#222',
                    border: '1px solid #e0e0e0',
                    borderRadius: 8,
                    padding: '12px 20px',
                    margin: '16px 0',
                    maxWidth: 480,
                    boxShadow: '0 2px 8px rgba(60,60,120,0.07)',
                    fontWeight: 500,
                    fontSize: 16,
                    textAlign: 'left',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    justifyContent: 'flex-start'
                  }}
                >
                  <span className={styles.loader} style={{ display: 'inline-block', width: 22, height: 22, flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="11" cy="11" r="9" stroke="#2563eb" strokeWidth="4" strokeDasharray="56" strokeDashoffset="28">
                        <animateTransform attributeName="transform" type="rotate" from="0 11 11" to="360 11 11" dur="0.8s" repeatCount="indefinite" />
                      </circle>
                    </svg>
                  </span>
                  <span style={{ textAlign: 'left' }}>{notification}</span>
                </div>
              </>
            );
          }
          // Normal message rendering
          return (
            <div
              key={idx}
              className={
                msg.sender === 'user' ? styles.userMsg : msg.sender === 'system' ? styles.systemMsg : styles.botMsg
              }
              style={{ position: 'relative', marginBottom: msg.sender === 'bot' && (msg.sql || msg.suggested_questions || msg.query_result) ? 24 : undefined }}
            >
              {/* Render message text with markdown bold support */}
              {msg.text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
                if (/^\*\*[^*]+\*\*$/.test(part)) {
                  return <strong key={i}>{part.replace(/\*\*/g, '')}</strong>;
                }
                return <span key={i}>{part}</span>;
              })}
              {/* Append query_result below the final answer if present */}
              {msg.sender === 'bot' && msg.query_result && (
                <pre style={{
                  background: 'rgba(0,0,0,0.04)',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginTop: 12,
                  fontSize: 15,
                  fontFamily: 'Menlo, Monaco, Consolas, monospace',
                  overflowX: 'auto',
                  boxShadow: '0 1px 4px rgba(60,60,120,0.07)'
                }}>{msg.query_result}</pre>
              )}
              {msg.sender === 'bot' && (msg.sql || msg.suggested_questions) && (
                <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
                  {msg.sql && (
                    <button
                      style={{
                        padding: '4px 10px',
                        borderRadius: 5,
                        border: 'none',
                        background: '#e0e7ff',
                        color: '#222',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: 13,
                        boxShadow: '0 1px 4px rgba(60,60,120,0.08)',
                        transition: 'all 0.2s',
                        minWidth: 0
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#d0d7ff'}
                      onMouseOut={(e) => e.currentTarget.style.background = '#e0e7ff'}
                      onClick={() => setTooltip({ type: 'sql', idx })}
                    >
                      View SQL Query
                    </button>
                  )}
                  {msg.suggested_questions && Array.isArray(msg.suggested_questions) && (
                    <button
                      style={{
                        padding: '4px 10px',
                        borderRadius: 5,
                        border: 'none',
                        background: '#e0e7ff',
                        color: '#222',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: 13,
                        boxShadow: '0 1px 4px rgba(60,60,120,0.08)',
                        transition: 'all 0.2s',
                        minWidth: 0
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#d0d7ff'}
                      onMouseOut={(e) => e.currentTarget.style.background = '#e0e7ff'}
                      onClick={() => setTooltip({ type: 'suggested', idx })}
                    >
                      View Suggested Questions
                    </button>
                  )}
                </div>
              )}
              {/* SQL Tooltip */}
              {msg.sender === 'bot' && msg.sql && tooltip && tooltip.type === 'sql' && tooltip.idx === idx && (
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.7)',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000,
                  }}
                  onClick={() => setTooltip(null)}
                >
                  <div
                    style={{
                      background: '#222',
                      color: '#fff',
                      textAlign: 'left',
                      borderRadius: 10,
                      padding: '16px 20px',
                      minWidth: 500,
                      maxWidth: '80%',
                      maxHeight: '80vh',
                      fontSize: 14,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      whiteSpace: 'pre-wrap',
                      overflow: 'auto',
                      position: 'relative',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <strong style={{ fontSize: 16 }}>SQL Query</strong>
                      <button 
                        onClick={() => setTooltip(null)} 
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: '#aaa', 
                          cursor: 'pointer', 
                          fontSize: 18,
                          padding: '0 4px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    <code>{msg.sql}</code>
                  </div>
                </div>
              )}
              {/* Suggested Questions Tooltip */}
              {msg.sender === 'bot' && msg.suggested_questions && Array.isArray(msg.suggested_questions) && tooltip && tooltip.type === 'suggested' && tooltip.idx === idx && (
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.7)',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000,
                  }}
                  onClick={() => setTooltip(null)}
                >
                  <div
                    style={{
                      background: '#222',
                      color: '#fff',
                      textAlign: 'left',
                      borderRadius: 10,
                      padding: '16px 20px',
                      minWidth: 400,
                      maxWidth: '80%',
                      maxHeight: '80vh',
                      fontSize: 14,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      whiteSpace: 'pre-wrap',
                      overflow: 'auto',
                      position: 'relative',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <strong style={{ fontSize: 16 }}>Suggested Questions</strong>
                      <button 
                        onClick={() => setTooltip(null)} 
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: '#aaa', 
                          cursor: 'pointer', 
                          fontSize: 18,
                          padding: '0 4px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    <ul style={{ margin: '8px 0 0 0', padding: 0, listStyle: 'disc inside' }}>
                      {msg.suggested_questions.map((q: string, i: number) => (
                        <li key={i} style={{ marginBottom: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}
                            onClick={() => { setInput(q); setTooltip(null); }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className={styles.inputArea}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
          className={styles.input}
        />
        <button onClick={sendMessage} className={styles.sendBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
