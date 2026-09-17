import React from 'react';
import '../styles/confirmation.css';

interface ConfirmationModalProps {
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onClose: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ open, title, message, onConfirm, onClose }) => {
    if (!open) return null;

    return (
        <div className="confirmation-overlay" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title">
            <div className="confirmation-backdrop" onClick={onClose} />
            <div className="confirmation-content">
                <h2 id="confirmation-title" className="confirmation-title">{title}</h2>
                <p className="confirmation-message">{message}</p>
                <div className="confirmation-actions">
                    <button type="button" className="confirmation-button confirmation-button--ghost" onClick={onClose} autoFocus>
                        Close
                    </button>
                    <button type="button" className="confirmation-button confirmation-button--danger" onClick={onConfirm}>
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
