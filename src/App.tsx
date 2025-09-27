import React, {useState} from 'react';
import HeaderComponent from "./components/header.tsx";
import "./styles/app.css";
import TopicCard from "./components/topic_card.tsx";
import {useLiveQuery} from "dexie-react-hooks";
import db, {type SavedPage, type Topic} from "./libs/db.ts";
import {colorOptions} from "./libs/global.ts";
import Header2 from "./components/header2.tsx";
import SavedPageCard from "./components/saved_page.tsx";
import {showToast} from "./components/toast.tsx";
import ConfirmationModal from "./components/confirmation.tsx";
import CreateOrUpdateTopicModal from "./components/create_or_update_topic_modal.tsx";

// --- Main App Component ---
const App: React.FC = () => {

    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [currentView, setCurrentView] = useState<'list' | 'detail'>('list');
    const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

    const openModal = () => setCreateModalOpen(true);
    const closeModal = () => setCreateModalOpen(false);

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmTitle, setConfirmTitle] = useState("");
    const [confirmMessage, setConfirmMessage] = useState("");
    const [confirmAction, setConfirmAction] = useState<() => Promise<void> | void>(() => {});

    const openConfirm = (
        title: string,
        message: string,
        onConfirm: () => Promise<void> | void
    ) => {
        setConfirmTitle(title);
        setConfirmMessage(message);
        setConfirmAction(() => onConfirm);
        setConfirmOpen(true);
    };

    const closeConfirm = () => setConfirmOpen(false);

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

    const openEditTopic = (topic: Topic) => {
        setEditingTopic(topic);
        setEditModalOpen(true);
    };

    const closeEditTopic = () => {
        setEditingTopic(null);
        setEditModalOpen(false);
    };

    const topics = useLiveQuery(
        () => db.getAllTopics(),
        []
    );

    const savedPages = useLiveQuery<SavedPage[]>(
        () => {
            if (!selectedTopic) return [] as SavedPage[];
            return db.getSavedPagesByTopicId(selectedTopic.id);
        },
        [selectedTopic?.id],
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

    const handleDeleteTopic = (topic: Topic) => {
        openConfirm(
            "Delete Topic",
            `Are you sure you want to delete the topic "${topic.name}"? All the saved pages within it will also be removed.`,
            async () => {
                try {
                    await db.deleteTopicAndItsPages(topic.id);
                    if (selectedTopic?.id === topic.id) {
                        setSelectedTopic(null);
                        setCurrentView('list');
                    }
                    showToast("Topic deleted.");
                } catch (e) {
                    console.error(e);
                    showToast("Failed to delete topic.");
                } finally {
                    closeConfirm();
                }
            }
        );
    };

    const handleDeleteSavedPage = (pageId: number, title?: string) => {
        openConfirm(
            "Delete Page",
            `Are you sure you want to delete${title ? ` "${title}"` : ""}?`,
            async () => {
                try {
                    await db.deletePage(pageId);
                    showToast("Page deleted.");
                } catch (e) {
                    console.error(e);
                    showToast("Failed to delete page.");
                } finally {
                    closeConfirm();
                }
            }
        );
    };

    return (
        <>
            <div className={`app-container ${createModalOpen ? 'modal-open' : ''}`}>

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
                                onDelete={(e?: React.MouseEvent) => {
                                    e?.stopPropagation?.();
                                    handleDeleteTopic(topic);
                                }}
                                onEdit={() => openEditTopic(topic)}
                            />
                        ))
                    ) : (
                        savedPages?.map(page => (
                                <SavedPageCard key={page.id} page={page}
                                               onDelete={(e?: React.MouseEvent) => {
                                                   e?.stopPropagation?.();
                                                   handleDeleteSavedPage(page.id, page.title);
                                               }}
                                />
                            ))
                    )}
                </div>
            </div>

            {createModalOpen && <CreateOrUpdateTopicModal mode="create" onClose={closeModal} onCreate={handleCreateTopic} />}

            {editModalOpen && editingTopic && (
                <CreateOrUpdateTopicModal
                    mode="edit"
                    initialName={editingTopic.name}
                    initialColor={editingTopic.color_tag_rgb}
                    onClose={closeEditTopic}
                    onUpdate={async (name, color) => {
                        try {
                            await db.topics.update(editingTopic.id, {
                                name,
                                color_tag: colorOptions.find(c => c.value === color)?.name ?? "Unknown",
                                color_tag_rgb: color,
                                update_time: Date.now(),
                            });
                            showToast("Topic updated.");
                        } catch (err) {
                            console.error(err);
                            showToast("Failed to update topic.");
                        }
                    }}
                />
            )}

            <ConfirmationModal
                open={confirmOpen}
                title={confirmTitle}
                message={confirmMessage}
                onClose={closeConfirm}
                onConfirm={async () => {
                    await confirmAction?.();
                }}
            />
        </>
    );
};

export default App;

