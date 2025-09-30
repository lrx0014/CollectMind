import React from "react";
import {Globe, Trash2, Fullscreen} from "lucide-react";
import type {SavedPage} from "../libs/db.ts";
import "../styles/saved_page.css";

interface SavedPageCardProps {
    page: SavedPage,
    onDelete: () => void,
    onClick?: () => void,
    onViewSummary: () => void,
}

const SavedPageCard: React.FC<SavedPageCardProps> = ({page, onDelete, onClick, onViewSummary}) => {
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        e.currentTarget.style.display = 'none'; // Hide broken image icon
        e.currentTarget.parentElement?.classList.add('no-image'); // Add class to show fallback
    };

    const cleanedSummary = React.useMemo(() => {
        if (!page.summary) return '';
        return page.summary
            .split(/\n+/)
            .map(line => line.replace(/^\s*([-*•]+\s*)/, '').trim())
            .filter(Boolean)
            .join(' ');
    }, [page.summary]);

    return (
        <div className="page-card" title={page.title} onClick={onClick}>
            <div className="page-logo">
                {page.icon ? (
                    <img src={page.icon} alt="logo" onError={handleImageError}/>
                ) : (
                    <Globe size={24}/>
                )}
            </div>
            <div className="page-info">
                <h4 className="page-title">{page.title}</h4>
                <p className="page-summary">{cleanedSummary}</p>
            </div>
            <div className="card-actions">
                <button className="action-button" title="View Summary" onClick={(e) => {
                    e.stopPropagation(); /* view summary */
                    onViewSummary();
                }}>
                    <Fullscreen size={16}/>
                </button>
                <button className="action-button" title="Delete" onClick={(e) => {
                    e.stopPropagation(); /* Delete */
                    onDelete();
                }}>
                    <Trash2 size={16}/>
                </button>
            </div>
        </div>
    );
};

export default SavedPageCard;
