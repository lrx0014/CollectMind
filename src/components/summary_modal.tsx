import React from "react";
import "../styles/summary_modal.css";

interface SummaryModalProps {
    open: boolean;
    title: string;
    content: string;
    onClose: () => void;
}

const SummaryModal: React.FC<SummaryModalProps> = ({ open, title, content, onClose }) => {
    const sanitizedContent = React.useMemo(() => {
        if (!content) return "<p>No summary available.</p>";
        const normalized = content
            .trim()
            .split(/\n+/)
            .map(line => line.replace(/^\s*([-*•]+\s*)/, '').trim())
            .filter(Boolean)
            .map(line => `<p>${line}</p>`)
            .join("") || "<p>No summary available.</p>";
        return normalized;
    }, [content]);

    if (!open) return null;

    return (
        <div className="summary-modal" role="dialog" aria-modal="true">
            <div className="summary-modal-backdrop" onClick={onClose} />
            <div className="summary-modal-content">
                <div className="summary-modal-header">
                    <h2 className="summary-modal-title">{title}</h2>
                    <button className="summary-modal-close" onClick={onClose} aria-label="Close summary">&times;</button>
                </div>
                <div className="summary-modal-body" dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
            </div>
        </div>
    );
};

export default SummaryModal;
