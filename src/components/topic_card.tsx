// --- TopicCard Component Definition ---
import React from "react";
import "../styles/topic_card.css";
import type {Topic} from "../libs/db.ts";
import {Pencil, Trash2} from "lucide-react";

// --- TopicCard Prop Types ---
interface TopicCardProps {
    topic: Topic;
    pageCount: number;
    onClick: () => void;
    onDelete: () => void;
    onEdit: () => void;
}

const TopicCard: React.FC<TopicCardProps> = ({topic, pageCount, onClick, onDelete, onEdit}) => {
    const itemLabel = pageCount === 1 ? '1 item' : `${pageCount} items`;

    return (
        <div className="topic-card-new" onClick={onClick} title={topic.name}>
            <div className="color-tag" style={{backgroundColor: topic.color_tag_rgb}}></div>
            <div className="card-content">
                <h3 className="card-title-new">{topic.name}</h3>
                <p className="card-summary">{itemLabel}</p>
            </div>
            <div className="card-actions">
                <button className="action-button" title='Edit Topic' onClick={(e) => {
                    e.stopPropagation(); /* Edit */
                    onEdit();
                }}>
                    <Pencil size={16}/>
                </button>
                <button className="action-button" title='Delete Topic' onClick={(e) => {
                    e.stopPropagation(); /* Delete */
                    onDelete();
                }}>
                    <Trash2 size={16}/>
                </button>
            </div>
        </div>
    );
};

export default TopicCard;
