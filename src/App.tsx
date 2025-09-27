import React, {useState} from 'react';
import HeaderComponent from "./components/header.tsx";
import "./styles/app.css";
import TopicCard from "./components/card.tsx";
import CreateTopicModal from "./components/create_topic_model.tsx";
import {useLiveQuery} from "dexie-react-hooks";
import db, {type Topic} from "./libs/db.ts";
import {colorOptions} from "./libs/global.ts";
import Header2 from "./components/header2.tsx";
import SavedPageCard from "./components/saved_page.tsx";
import {showToast} from "./components/toast.tsx";

// --- Main App Component ---
const App: React.FC = () => {

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentView, setCurrentView] = useState<'list' | 'detail'>('list');
    const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    const topics = useLiveQuery(
        () => db.getAllTopics(),
        []
    );

    const savedPages = useLiveQuery(
        () => selectedTopic ? db.getSavedPagesByTopicId(selectedTopic.id) : db.getAllSavedPages(),
        [selectedTopic],
    );

    const handleCreateTopic = async (name: string, color_tag_rgb: string) => {
        try {
            const colorName = colorOptions.find(c => c.value === color_tag_rgb)?.name || 'Unknown';

            await db.addTopic({
                name,
                color_tag: colorName,
                color_tag_rgb,
            });
        } catch (error) {
            console.error("Failed to create topic:", error);
        }
    };

    const handleAddCurrentPage = async () => {
        if (!selectedTopic) return;

        // within Chrome
        if (typeof chrome !== "undefined" && chrome.tabs) {
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                const currentTab = tabs[0];

                if (currentTab && currentTab.url && currentTab.title) {

                    const isAlreadySaved = savedPages?.filter(page => page.topic_id === selectedTopic.id)
                        .some(page => page.url === currentTab.url);

                    if (isAlreadySaved) {
                        showToast("You've saved this page once.");
                        return;
                    }

                    await db.addSavedPage({
                        topic_id: selectedTopic.id,
                        url: currentTab.url,
                        title: currentTab.title,
                        icon: `https://www.google.com/s2/favicons?domain=${new URL(currentTab.url).hostname}&sz=128`,
                    });
                } else {
                    console.error("Could not get title or URL from the current tab.");
                }
            } catch (error) {
                console.error("Error querying tabs:", error);
            }
        } else {
            // not a chrome env
            console.warn("Chrome API not available. Using mock data for debugging.");
            try {
                await db.addSavedPage({
                    topic_id: selectedTopic.id,
                    url: "https://google.com",
                    title: 'Mock Page Title',
                    icon: 'https://www.google.com/s2/favicons?domain=example.com&sz=128',
                });
            } catch (error) {
                console.error("Failed to add current page:", error);
            }
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
                    <Header2 topicName={selectedTopic.name} onBack={handleBackToList} onAddPage={handleAddCurrentPage} />
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
                        savedPages?.map(page => (
                                <SavedPageCard key={page.id} page={page} />
                            ))
                    )}
                </div>
            </div>

            {isModalOpen && <CreateTopicModal onClose={closeModal} onCreate={handleCreateTopic} />}
        </>
    );
};

export default App;

