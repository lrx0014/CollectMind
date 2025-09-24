import React, {useState} from 'react';
import HeaderComponent from "./components/header.tsx";
import "./styles/app.css";
import TopicCard from "./components/card.tsx";
import CreateTopicModal from "./components/create_topic_model.tsx";


// --- Initial Mock Data ---
const initialTopics = [
    {
        title: 'Component Library Migration Plan',
        summary: 'This document outlines the strategy and timeline for migrating our legacy component library to the new design system. Key milestones and potential risks are detailed within.',
        tagColor: '#4A90E2' // Blue
    },
    {
        title: 'Q4 2025 Engineering Goals & OKRs',
        summary: 'A comprehensive list of objectives and key results for the engineering department for the fourth quarter. Focus areas include performance improvements and security enhancements.',
        tagColor: '#50E3C2' // Green
    },
];

// --- Main App Component ---
const App: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    // 将 topic 列表变成一个 state，以便我们可以添加新项
    const [topics, setTopics] = useState(initialTopics);

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    const handleCreateTopic = (name: string, color: string) => {
        const newTopic = {
            title: name,
            summary: 'Newly created topic. You can add a summary here.',
            tagColor: color,
        };
        // 将新创建的 topic 添加到列表的开头
        setTopics([newTopic, ...topics]);
    };

    return (
        <>
            <div className={`app-container ${isModalOpen ? 'modal-open' : ''}`}>

                <HeaderComponent onNewTopicClick={openModal} />

                <div className="content-area">
                    {topics.map((topic, index) => (
                        <TopicCard
                            key={index}
                            title={topic.title}
                            summary={topic.summary}
                            tagColor={topic.tagColor}
                        />
                    ))}
                </div>
            </div>

            {isModalOpen && <CreateTopicModal onClose={closeModal} onCreate={handleCreateTopic} />}
        </>
    );
};

export default App;

