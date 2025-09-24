import { Search, RotateCw, Settings } from 'lucide-react';
import '../styles/header.css'
import React from "react";

// --- HeaderComponent Definition ---
const HeaderComponent: React.FC = () => (
    <>
        <div className="header-container">
            <div>
                <button className="new-topic-button"><span>+</span><span>New Topic</span></button>
            </div>
            <div className="icon-group">
                <Search size={22} className="icon" />
                <RotateCw size={22} className="icon" />
                <Settings size={22} className="icon" />
            </div>
        </div>
    </>
);

export default HeaderComponent;

