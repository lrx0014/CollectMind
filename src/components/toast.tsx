// showToast.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { Snackbar, Alert } from "@mui/material";

let container: HTMLDivElement | null = null;
let root: ReactDOM.Root | null = null;

export function showToast(message: string, duration: number = 3000) {
    // 如果之前存在 toast，先卸载
    if (root && container) {
        root.unmount();
        container.remove();
        root = null;
        container = null;
    }

    // 创建新的容器
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);

    const Toast: React.FC = () => {
        const [open, setOpen] = React.useState(true);

        const handleClose = (_?: Event | React.SyntheticEvent) => {
            setOpen(false);
        };

        return (
            <Snackbar
                open={open}
                autoHideDuration={duration}
                onClose={handleClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    severity="info"
                    variant="filled"
                    onClose={handleClose}
                    sx={{ width: "100%" }}
                >
                    {message}
                </Alert>
            </Snackbar>
        );
    };

    root.render(<Toast />);
}
