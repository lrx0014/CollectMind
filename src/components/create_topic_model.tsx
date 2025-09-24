import React, {useState} from "react";
import { X } from 'lucide-react';

import "../styles/create_topic_model.css";
import {colorOptions} from "../libs/global.ts";

interface CreateTopicModalProps {
    onClose: () => void;
    onCreate: (name: string, color: string) => void;
}

const CreateTopicModal: React.FC<CreateTopicModalProps> = ({ onClose, onCreate }) => {
    const [topicName, setTopicName] = useState('');
    const [selectedColor, setSelectedColor] = useState(colorOptions[0].value);

    const handleCreate = () => {
        // 确保 topicName 不是空的或只包含空格
        if (topicName.trim()) {
            onCreate(topicName, selectedColor);
            onClose(); // 创建后关闭模态框
        }
    };

    return (
        <>
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2 className="modal-title">Create a new topic</h2>
                        <button className="modal-close-button" onClick={onClose}>
                            <X size={24} />
                        </button>
                    </div>
                    <input
                        className="modal-input"
                        placeholder="enter topic name"
                        value={topicName}
                        onChange={(e) => setTopicName(e.target.value)}
                    />
                    <div className="color-selector-container">
                        <label className="color-selector-label">Color Tag</label>
                        <div className="select-wrapper">
                            <span className="color-preview" style={{ backgroundColor: selectedColor }}></span>
                            <select
                                className="color-selector"
                                value={selectedColor}
                                onChange={(e) => setSelectedColor(e.target.value)}
                            >
                                {colorOptions.map(color => (
                                    <option key={color.value} value={color.value}>
                                        {color.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button className="modal-create-button" onClick={handleCreate}>Create</button>
                </div>
            </div>
        </>
    );
};

export default CreateTopicModal;