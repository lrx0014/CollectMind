import React, {useState} from 'react';
import HeaderComponent from "./components/header.tsx";
import "./styles/app.css";
import TopicCard from "./components/card.tsx";
import CreateTopicModal from "./components/create_topic_model.tsx";
import {useLiveQuery} from "dexie-react-hooks";
import db from "./libs/db.ts";
import {colorOptions} from "./libs/global.ts";

// --- Main App Component ---
const App: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 使用 useLiveQuery 从数据库实时获取数据
    // reverse().sortBy() 是 Dexie 中高效的倒序排列方式
    const topics = useLiveQuery(
        () => db.table('topics').where('is_deleted').notEqual(1).reverse().sortBy('create_time'),
        [] // 依赖项数组，为空表示只在组件挂载时运行一次
    );

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

    return (
        <>
            <div className={`app-container ${isModalOpen ? 'modal-open' : ''}`}>

                <HeaderComponent onNewTopicClick={openModal} />

                <div className="content-area">
                    {topics?.map((topic: any) => (
                        <TopicCard
                            key={topic.id}
                            title={topic.name}
                            summary={topic.summary}
                            tagColor={topic.color_tag_rgb}
                        />
                    ))}
                </div>
            </div>

            {isModalOpen && <CreateTopicModal onClose={closeModal} onCreate={handleCreateTopic} />}
        </>
    );
};

export default App;

