import React from "react";
import {Globe} from "lucide-react";
import type {SavedPage} from "../libs/db.ts";
import "../styles/saved_page.css";

interface SavedPageCardProps {
    page: SavedPage;
}
const SavedPageCard: React.FC<SavedPageCardProps> = ({ page }) => {
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        e.currentTarget.style.display = 'none'; // Hide broken image icon
        e.currentTarget.parentElement?.classList.add('no-image'); // Add class to show fallback
    };

    return (
        <>
            <div className="page-card">
                <div className="page-logo">
                    {page.icon ? (
                        <img src={page.icon} alt="logo" onError={handleImageError}/>
                    ) : (
                        <Globe size={24} />
                    )}
                </div>
                <div className="page-info">
                    <h4 className="page-title">{page.title}</h4>
                    <p className="page-summary">{page.summary}</p>
                </div>
            </div>
        </>
    );
};

export default SavedPageCard;