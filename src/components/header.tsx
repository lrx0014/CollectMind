import { Search, Settings } from 'lucide-react';
import '../styles/header.css'
import React from "react";

interface HeaderComponentProps {
    onNewTopicClick: () => void;
}

// --- HeaderComponent Definition ---
const HeaderComponent: React.FC<HeaderComponentProps> = ({onNewTopicClick}) => (
    <>
        <div className="header-container">
            <div>
                <button className="new-topic-button" onClick={onNewTopicClick}>
                    <span>+</span><span>New Topic</span>
                </button>
            </div>
            <div className="icon-group">
                <Search size={22} className="icon" />
                {/*<RotateCw size={22} className="icon" />*/}
                <Settings size={22} className="icon" />
            </div>
        </div>
    </>
);

export default HeaderComponent;

