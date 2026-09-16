import {Library, Search, Settings} from 'lucide-react';
import '../styles/header.css'
import React, {useEffect, useRef} from "react";

interface HeaderComponentProps {
    onNewTopicClick: () => void;
    isSearchActive: boolean;
    searchQuery: string;
    onToggleSearch: () => void;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
    onSettingsClick: () => void;
    onLibraryChatClick?: () => void;
}

// --- HeaderComponent Definition ---
const HeaderComponent: React.FC<HeaderComponentProps> = ({
    onNewTopicClick,
    isSearchActive,
    searchQuery,
    onToggleSearch,
    onSearchChange,
    onClearSearch,
    onSettingsClick,
    onLibraryChatClick,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isSearchActive) {
            inputRef.current?.focus();
        }
    }, [isSearchActive]);

    const handleCloseSearch = () => {
        onClearSearch();
        onToggleSearch();
    };

    return (
        <div className={`header-container${isSearchActive ? ' search-active' : ''}`}>
            {!isSearchActive && (
                <div>
                    <button className="new-topic-button" onClick={onNewTopicClick}>
                        <span>+</span><span>New Topic</span>
                    </button>
                </div>
            )}
            <div className={`icon-group${isSearchActive ? ' search-active' : ''}`}>
                {isSearchActive ? (
                    <div className="search-input-wrapper">
                        <Search size={16} className="search-input-icon" />
                        <input
                            ref={inputRef}
                            className="search-input"
                            type="text"
                            placeholder="Search topics..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    handleCloseSearch();
                                }
                            }}
                        />
                        <button
                            type="button"
                            className="search-cancel-button"
                            onClick={handleCloseSearch}
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <Search size={22} className="icon" onClick={onToggleSearch} />
                )}
                {!isSearchActive && onLibraryChatClick && (
                    <Library size={22} className="icon" onClick={onLibraryChatClick} aria-label="Ask across all bookmarks" />
                )}
                {!isSearchActive && (
                    <Settings size={22} className="icon" onClick={onSettingsClick} />
                )}
            </div>
        </div>
    );
};

export default HeaderComponent;
