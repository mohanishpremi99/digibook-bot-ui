"use client";
import { useState, useRef, useEffect } from 'react';
import styles from './ChatBot.module.css';

interface Message {
  text: string;
  sender: 'user' | 'bot' | 'system';
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
                console.log('Notification:', data.content);
                setMessages(prev => [...prev, { text: data.content, sender: 'system' }]);
              } else if (data.type === 'final') {
                console.log('Final response (full object):', data.data);
                const answer = data.data.answer ?? data.content ?? JSON.stringify(data);
                setMessages(prev => [...prev, { text: answer, sender: 'bot' }]);
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

  return (
    <div className={styles.chatbotContainer}>
      <div className={styles.header}>DigiBook Bot 🤖</div>
      <div className={styles.messages}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={
              msg.sender === 'user' ? styles.userMsg : styles.botMsg
            }
          >
            {msg.text}
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
