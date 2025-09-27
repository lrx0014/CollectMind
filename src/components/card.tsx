// --- TopicCard Component Definition ---
import React from "react";
import "../styles/topic_card.css";
import type {Topic} from "../libs/db.ts";

// --- TopicCard Prop Types ---
interface TopicCardProps {
    topic: Topic;
    onClick: () => void;
}

const TopicCard: React.FC<TopicCardProps> = ({ topic, onClick }) => {
    return (
        <div className="topic-card-new" onClick={onClick}>
            <div className="color-tag" style={{ backgroundColor: topic.color_tag_rgb }}></div>
            <div className="card-content">
                <h3 className="card-title-new">{topic.name}</h3>
                <p className="card-summary">{topic.summary}</p>
            </div>
        </div>
    );
};

export default TopicCard;

