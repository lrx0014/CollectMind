// --- TopicCard Component Definition ---
import React from "react";
import "../styles/topic_card.css";

// --- TopicCard Prop Types ---
interface TopicCardProps {
    title: string;
    summary: string;
    tagColor: string;
}

const TopicCard: React.FC<TopicCardProps> = ({ title, summary, tagColor }) => {
    return (
        <>
            <div className="topic-card-new">
                <div className="color-tag" style={{ backgroundColor: tagColor }}></div>
                <div className="card-content">
                    <p className="card-title-new">{title}</p>
                    <p className="card-summary">{summary}</p>
                </div>
            </div>
        </>
    );
};

export default TopicCard;

