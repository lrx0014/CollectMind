import React, {useEffect, useRef} from "react";
import {ChevronLeft, Plus, Search, Settings} from "lucide-react";
import "../styles/header2.css";

interface Toolbar2Props {
    topicName: string;
    onBack: () => void;
    onAddPage: () => void;
    isSearchActive: boolean;
    searchQuery: string;
    onToggleSearch: () => void;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
    onSettingsClick: () => void;
}

const Header2: React.FC<Toolbar2Props> = ({
    topicName,
    onBack,
    onAddPage,
    isSearchActive,
    searchQuery,
    onToggleSearch,
    onSearchChange,
    onClearSearch,
    onSettingsClick,
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

    const pagePlaceholder = topicName ? `Search ${topicName}...` : 'Search pages...';

    return (
        <>
            <div className={`toolbar2-container${isSearchActive ? ' search-active' : ''}`}>
                {!isSearchActive && (
                    <div onClick={onBack} className="back-link">
                        <ChevronLeft size={22} />
                        <span>Back</span>
                    </div>
                )}

                {!isSearchActive && (
                    <button className="add-page-button" onClick={onAddPage}>
                        <Plus size={20} />
                        <span>Add Page</span>
                    </button>
                )}

                <div className={`icon-group${isSearchActive ? ' search-active' : ''}`}>
                    {isSearchActive ? (
                        <div className="search-input-wrapper">
                            <Search size={16} className="search-input-icon" />
                            <input
                                ref={inputRef}
                                className="search-input"
                                type="text"
                                placeholder={pagePlaceholder}
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
                    {!isSearchActive && (
                        <Settings size={22} className="icon" onClick={onSettingsClick} />
                    )}
                </div>
            </div>
        </>
    );
};

export default Header2;
