import React, {useState} from 'react';
import HeaderComponent from "./components/header.tsx";
import "./styles/app.css";
import TopicCard from "./components/card.tsx";
import CreateTopicModal from "./components/create_topic_model.tsx";
import {useLiveQuery} from "dexie-react-hooks";
import db from "./libs/db.ts";
import {colorOptions, type Topic} from "./libs/global.ts";
import Header2 from "./components/header2.tsx";

// --- Main App Component ---
const App: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 使用 useLiveQuery 从数据库实时获取数据
    // reverse().sortBy() 是 Dexie 中高效的倒序排列方式
    const topics = useLiveQuery(
        () => db.table('topics').where('is_deleted').notEqual(1).reverse().sortBy('create_time'),
        [] // 依赖项数组，为空表示只在组件挂载时运行一次
    );

    const [currentView, setCurrentView] = useState<'list' | 'detail'>('list');
    const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    const handleCreateTopic = async (name: string, color_tag_rgb: string) => {
        try {
            const colorName = colorOptions.find(c => c.value === color_tag_rgb)?.name || 'Unknown';
            const now = Date.now();

            // 向数据库添加新记录
            await db.table('topics').add({
                name,
                color_tag: colorName,
                color_tag_rgb,
                summary: 'Newly created topic. You can add a summary here.', // 默认 summary
                create_time: now,
                update_time: now,
                is_deleted: 0,
            });
        } catch (error) {
            console.error("Failed to create topic:", error);
        }
    };

    const handleCardClick = (topic: Topic) => {
        setSelectedTopic(topic);
        setCurrentView('detail');
    };

    const handleBackToList = () => {
        setSelectedTopic(null);
        setCurrentView('list');
    };

    return (
        <>
            <div className={`app-container ${isModalOpen ? 'modal-open' : ''}`}>

                {currentView === 'list' && <HeaderComponent onNewTopicClick={openModal} />}
                {currentView === 'detail' && selectedTopic && (
                    <Header2 topicName={selectedTopic.name} onBack={handleBackToList} />
                )}

                <div className="content-area">
                    {currentView === 'list' ? (
                        topics?.map((topic) => (
                            <TopicCard
                                key={topic.id}
                                topic={topic}
                                onClick={() => handleCardClick(topic)}
                            />
                        ))
                    ) : (
                        <div>
                            <h2>Details for {selectedTopic?.name}</h2>
                            <p>Content for the selected topic will go here.</p>
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && <CreateTopicModal onClose={closeModal} onCreate={handleCreateTopic} />}
        </>
    );
};

export default App;

