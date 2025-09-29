import React from "react";
import {Globe, Trash2} from "lucide-react";
import type {SavedPage} from "../libs/db.ts";
import "../styles/saved_page.css";

interface SavedPageCardProps {
    page: SavedPage,
    onDelete: () => void,
    onClick?: () => void
}

const SavedPageCard: React.FC<SavedPageCardProps> = ({page, onDelete, onClick}) => {
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
                <button className="action-button" onClick={(e) => {
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
