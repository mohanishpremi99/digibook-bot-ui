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

const trendyBotReplies = [
  "Hey there! 👋 How can I help you today?",
  "That's awesome! Tell me more.",
  "Let me check that for you...",
  "Here's what I found!",
  "Thanks for chatting with me! 💬"
];

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([
    { text: "Hi! I'm DigiBook Bot. Ask me anything!", sender: 'bot' }
  ]);
  const [input, setInput] = useState('');
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
      const res = await fetch('http://127.0.0.1:8000/ask', {
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
                setMessages(prev => [...prev, { text: data.content, sender: 'system' }]);
              } else if (data.type === 'final') {
                setMessages(prev => [...prev, {
                  text: data.data.answer ?? data.content ?? JSON.stringify(data),
                  sender: 'bot',
                  sql: data.data.sql_query,
                  suggested_questions: data.data.suggested_questions,
                  query_result: data.data.query_result
                }]);
              }
              // Optionally handle other types if needed
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { text: 'Sorry, there was an error connecting to the server.', sender: 'bot' }]);
    }
  };

  // Tooltip state for each bot message, with flicker fix
  const [tooltip, setTooltip] = useState<{ type: 'sql' | 'suggested'; idx: number } | null>(null);
  const tooltipTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleTooltipEnter = (type: 'sql' | 'suggested', idx: number) => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setTooltip({ type, idx });
  };
  const handleTooltipLeave = () => {
    tooltipTimeout.current = setTimeout(() => setTooltip(null), 120);
  };

  return (
    <div className={styles.chatbotContainer}>
      <div className={styles.header}>DigiBook Bot 🤖</div>
      <div className={styles.messages}>
        {messages.map((msg, idx) => (
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
                color: '#222',
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
                      transition: 'background 0.2s',
                      minWidth: 0
                    }}
                    onClick={() => setTooltip(tooltip && tooltip.type === 'sql' && tooltip.idx === idx ? null : { type: 'sql', idx })}
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
                      transition: 'background 0.2s',
                      minWidth: 0
                    }}
                    onClick={() => setTooltip(tooltip && tooltip.type === 'suggested' && tooltip.idx === idx ? null : { type: 'suggested', idx })}
                  >
                    View Suggested Questions
                  </button>
                )}
              </div>
            )}
            {/* SQL Tooltip */}
            {msg.sender === 'bot' && msg.sql && tooltip && tooltip.type === 'sql' && tooltip.idx === idx && (
              <span
                style={{
                  background: '#222',
                  color: '#fff',
                  textAlign: 'left',
                  borderRadius: 6,
                  padding: '8px 12px',
                  position: 'absolute',
                  zIndex: 10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bottom: 'calc(100% + 50px)',
                  minWidth: 500,
                  maxWidth: 500,
                  fontSize: 13,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  whiteSpace: 'pre-wrap',
                }}
                onMouseEnter={() => handleTooltipEnter('sql', idx)}
                onMouseLeave={handleTooltipLeave}
              >
                <strong>SQL Query:</strong>
                <br />
                <code>{msg.sql}</code>
              </span>
            )}
            {/* Suggested Questions Tooltip */}
            {msg.sender === 'bot' && msg.suggested_questions && Array.isArray(msg.suggested_questions) && tooltip && tooltip.type === 'suggested' && tooltip.idx === idx && (
              <span
                style={{
                  background: '#222',
                  color: '#fff',
                  textAlign: 'left',
                  borderRadius: 6,
                  padding: '8px 12px',
                  position: 'absolute',
                  zIndex: 10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bottom: 'calc(100% + 50px)',
                  minWidth: 340,
                  maxWidth: 500,
                  fontSize: 13,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  whiteSpace: 'pre-wrap',
                }}
                onMouseEnter={() => handleTooltipEnter('suggested', idx)}
                onMouseLeave={handleTooltipLeave}
              >
                <strong>Suggested Questions:</strong>
                <ul style={{ margin: '8px 0 0 0', padding: 0, listStyle: 'disc inside' }}>
                  {msg.suggested_questions.map((q: string, i: number) => (
                    <li key={i} style={{ marginBottom: 4 }}>{q}</li>
                  ))}
                </ul>
              </span>
            )}
          </div>
        ))}
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
          ➤
        </button>
      </div>
    </div>
  );
}
