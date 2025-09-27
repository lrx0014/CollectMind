import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import "../styles/create_topic_model.css";
import { colorOptions } from "../libs/global.ts";

type Mode = "create" | "edit";

interface CreateOrUpdateTopicModalProps {
    onClose: () => void;

    // mode：create | edit
    mode?: Mode;

    initialName?: string;
    initialColor?: string;

    // high priority. otherwise onCreate and onUpdate could be applied
    onSubmit?: (values: { name: string; color: string }, mode: Mode) => void;

    onCreate?: (name: string, color: string) => void;
    onUpdate?: (name: string, color: string) => void;

    // optional：customize modal title（default: “Create a new topic” / “Edit topic”）
    titleOverride?: string;

    // optional: customize button name
    submitTextOverride?: string;
}

const CreateOrUpdateTopicModal: React.FC<CreateOrUpdateTopicModalProps> = ({
                                                                               onClose,
                                                                               mode = "create",
                                                                               initialName = "",
                                                                               initialColor = colorOptions[0].value,
                                                                               onSubmit,
                                                                               onCreate,
                                                                               onUpdate,
                                                                               titleOverride,
                                                                               submitTextOverride,
                                                                           }) => {
    const [topicName, setTopicName] = useState(initialName);
    const [selectedColor, setSelectedColor] = useState(initialColor);

    useEffect(() => {
        setTopicName(initialName);
    }, [initialName]);

    useEffect(() => {
        setSelectedColor(initialColor);
    }, [initialColor]);

    const isCreate = mode === "create";
    const title = titleOverride ?? (isCreate ? "Create a new topic" : "Edit topic");
    const submitText = submitTextOverride ?? (isCreate ? "Create" : "Save");

    const handleSubmit = () => {
        const name = topicName.trim();
        if (!name) return;

        if (onSubmit) {
            onSubmit({ name, color: selectedColor }, mode);
            onClose();
            return;
        }

        if (isCreate && onCreate) {
            onCreate(name, selectedColor);
            onClose();
            return;
        }

        if (!isCreate && onUpdate) {
            onUpdate(name, selectedColor);
            onClose();
            return;
        }

        onClose();
    };

    // Enter-key
    const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button className="modal-close-button" onClick={onClose} aria-label="Close">
                        <X size={24} />
                    </button>
                </div>

                <input
                    className="modal-input"
                    placeholder="enter topic name"
                    value={topicName}
                    onChange={(e) => setTopicName(e.target.value)}
                    onKeyDown={onKeyDown}
                />

                <div className="color-selector-container">
                    <label className="color-selector-label">Color Tag</label>
                    <div className="select-wrapper">
                        <span className="color-preview" style={{ backgroundColor: selectedColor }} />
                        <select
                            className="color-selector"
                            value={selectedColor}
                            onChange={(e) => setSelectedColor(e.target.value)}
                        >
                            {colorOptions.map((color) => (
                                <option key={color.value} value={color.value}>
                                    {color.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <button
                    className="modal-create-button"
                    onClick={handleSubmit}
                    disabled={!topicName.trim()}
                >
                    {submitText}
                </button>
            </div>
        </div>
    );
};

export default CreateOrUpdateTopicModal;
