// --- ChatContainer Component ---
import React, {useEffect, useRef, useState} from "react";
import {ChevronDown, ChevronUp, FileText, Folder, Send} from "lucide-react";
import "../styles/chat_container.css"

export interface ChatMessage {
    id: number;
    sender: 'user' | 'ai';
    text: string;
    isLoading?: boolean;
}

interface ChatContainerProps {
    topicName: string;
    messages: ChatMessage[];
    onSendMessage: (message: string, mode: 'topic' | 'page') => Promise<void> | void;
    isMaximized: boolean;
    setIsMaximized: (isMax: boolean) => void;
    onClearChat: () => Promise<void> | void;
}

const ChatContainer: React.FC<ChatContainerProps> = ({ topicName, messages, onSendMessage, isMaximized, setIsMaximized, onClearChat }) => {
    const [chatMode, setChatMode] = useState<'topic' | 'page'>('topic');
    const [message, setMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const placeholder = chatMode === 'topic' ? `Chat with '${topicName}'...` : "Chat with current page...";

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [message]);

    useEffect(() => {
        if (isMaximized) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isMaximized]);

    const handleSend = () => {
        const trimmed = message.trim();
        if (!trimmed) {
            return;
        }
        setMessage('');
        void onSendMessage(trimmed, chatMode);
    };

    const toggleStyle = { backgroundColor: chatMode === 'page' ? '#4A90E2' : '#50E3C2' };
    const knobStyle = { color: chatMode === 'page' ? '#4A90E2' : '#1a9c80', transform: chatMode === 'page' ? 'translateX(24px)' : 'translateX(0px)' };

    const handleToggleMaximize = () => {
        setIsMaximized(!isMaximized);
    }

    const chatInputArea = (
        <div className="chat-input-area">
            {!isMaximized && messages.length > 0 && (
                <button className="open-chat-button" onClick={handleToggleMaximize}>
                    <ChevronUp size={16} />
                </button>
            )}
            <div className="chat-input-wrapper">
                <div className="chat-mode-toggle" style={toggleStyle} onClick={() => setChatMode(prev => prev === 'topic' ? 'page' : 'topic')}>
                    <div className="toggle-knob" style={knobStyle}>
                        {chatMode === 'topic' ? <Folder size={14} /> : <FileText size={14} />}
                    </div>
                </div>
                <textarea
                    ref={textareaRef}
                    rows={1}
                    className="chat-input"
                    placeholder={placeholder}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                />
                <button className="chat-send-button" onClick={handleSend}><Send size={18} /></button>
            </div>
        </div>
    );

    if (!isMaximized) {
        return (
            <div className="chat-container">
                {chatInputArea}
            </div>
        );
    }

    return (
        <div className="chat-container maximized">
            <div className="chat-view-header">
                <button
                    className="chat-clear-button"
                    onClick={() => { void onClearChat(); }}
                    disabled={messages.length === 0}
                >
                    Clear Chat
                </button>
                <button className="chat-view-close-button" onClick={handleToggleMaximize}>
                    <ChevronDown size={20} />
                </button>
            </div>
            <div className="chat-view-messages">
                {messages.map(msg => (
                    <div key={msg.id} className={`message-bubble ${msg.sender}${msg.isLoading ? ' loading' : ''}`}>
                        {msg.isLoading ? (
                            <div className="loading-ellipsis" aria-label="Loading AI response">
                                <span />
                                <span />
                                <span />
                            </div>
                        ) : (() => {
                            const trimmedText = msg.text.replace(/\s+$/u, '');
                            const lines = trimmedText ? trimmedText.split(/\n/) : [''];
                            return lines.map((line, index) => (
                                <React.Fragment key={index}>
                                    {line}
                                    {index < lines.length - 1 && <br />}
                                </React.Fragment>
                            ));
                        })()}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            {chatInputArea}
        </div>
    );
};

export default ChatContainer;
