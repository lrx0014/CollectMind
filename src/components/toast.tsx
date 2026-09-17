// showToast.tsx
//
// Small self-mounting toast, replacing the previous MUI Snackbar/Alert
// implementation — @mui/material + @emotion pulled in a lot of bundle weight
// for the only two components in the app that used Material styling (this
// and confirmation.tsx), while everything else here is hand-rolled CSS.
import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/toast.css";

let container: HTMLDivElement | null = null;
let root: ReactDOM.Root | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function teardown() {
    if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
    }
    if (root && container) {
        root.unmount();
        container.remove();
        root = null;
        container = null;
    }
}

export function showToast(message: string, duration: number = 3000) {
    // If a toast is already showing, replace it rather than stacking.
    teardown();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);

    const Toast: React.FC = () => {
        const [closing, setClosing] = React.useState(false);

        const close = React.useCallback(() => {
            setClosing(true);
            // Let the fade-out transition play before actually unmounting.
            window.setTimeout(teardown, 180);
        }, []);

        React.useEffect(() => {
            hideTimer = setTimeout(close, duration);
            return () => {
                if (hideTimer) clearTimeout(hideTimer);
            };
        }, [close]);

        return (
            <div className={`app-toast${closing ? " app-toast-closing" : ""}`} role="status">
                <span className="app-toast-message">{message}</span>
                <button type="button" className="app-toast-close" aria-label="Dismiss" onClick={close}>&times;</button>
            </div>
        );
    };

    root.render(<Toast />);
}
