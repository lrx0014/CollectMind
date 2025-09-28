import React, {useEffect, useRef, useState} from "react";
import {FileText, Folder, Send} from "lucide-react";
import "../styles/chat_box.css";

interface ChatInputProps { topicName: string; }
const ChatInput: React.FC<ChatInputProps> = ({ topicName }) => {
    const [chatMode, setChatMode] = useState<'topic' | 'page'>('topic');
    const [message, setMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const placeholder = chatMode === 'topic' ? `Chat with '${topicName}'...` : "Chat with current page...";

    // 自动增高
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [message]);

    const toggleStyle = {
        backgroundColor: chatMode === 'page' ? '#4A90E2' : '#50E3C2',
    };

    const knobStyle = {
        color: chatMode === 'page' ? '#4A90E2' : '#1a9c80',
    };


    return (
        <div className="chat-input-container">
            <div className="chat-input-wrapper">
                <div
                    className={`chat-mode-toggle ${chatMode === 'page' ? 'page-mode' : ''}`}
                    style={toggleStyle}
                    onClick={() => setChatMode(prev => prev === 'topic' ? 'page' : 'topic')}
                >
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
                />
                <button className="chat-send-button"><Send size={18} /></button>
            </div>
        </div>
    );
};

export default ChatInput;