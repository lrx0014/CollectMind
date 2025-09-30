import React, {useEffect} from "react";
import "../styles/settings_overlay.css";

interface SettingsOverlayProps {
    open: boolean;
    onClose: () => void;
    appName: string;
    version: string;
}

const SettingsOverlay: React.FC<SettingsOverlayProps> = ({ open, onClose, appName, version }) => {
    useEffect(() => {
        if (!open) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    if (!open) {
        return null;
    }

    return (
        <div className="settings-overlay" role="dialog" aria-modal="true">
            <div className="settings-backdrop" onClick={onClose} />
            <div className="settings-content">
                <button className="settings-close" onClick={onClose} aria-label="Close settings">&times;</button>
                <img
                    className="settings-logo"
                    src="/images/icon_origin.png"
                    alt={`${appName} logo`}
                    width={96}
                    height={96}
                />
                <h1 className="settings-title">{appName}</h1>
                <p className="settings-version">Version {version}</p>
            </div>
        </div>
    );
};

export default SettingsOverlay;
