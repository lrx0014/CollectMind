import React, {useMemo, useState} from 'react';
import HeaderComponent from "./components/header.tsx";
import "./styles/app.css";
import TopicCard from "./components/topic_card.tsx";
import {useLiveQuery} from "dexie-react-hooks";
import db, {type ChatMessageRecord, type SavedPage, type Topic} from "./libs/db.ts";
import {colorOptions} from "./libs/global.ts";
import Header2 from "./components/header2.tsx";
import SavedPageCard from "./components/saved_page_card.tsx";
import {showToast} from "./components/toast.tsx";
import ConfirmationModal from "./components/confirmation.tsx";
import CreateOrUpdateTopicModal from "./components/create_or_update_topic_modal.tsx";
import {type ChatMessage} from "./components/chat_container.tsx";
import ChatContainer from "./components/chat_container.tsx";
import {prompt} from "./libs/prompt.ts";
import SettingsOverlay from "./components/settings_overlay.tsx";

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

    const [isChatMaximized, setIsChatMaximized] = useState(false);
    const [pendingAiMessages, setPendingAiMessages] = useState<Record<number, ChatMessage[]>>({});
    const [isTopicSearchActive, setIsTopicSearchActive] = useState(false);
    const [topicSearchQuery, setTopicSearchQuery] = useState("");
    const [isPageSearchActive, setIsPageSearchActive] = useState(false);
    const [pageSearchQuery, setPageSearchQuery] = useState("");
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

    const allSavedPages = useLiveQuery<SavedPage[]>(
        () => db.getAllSavedPages(),
        [],
    );

    const chatMessagesFromDb = useLiveQuery<ChatMessageRecord[]>(
        () => db.getAllChatMessages(),
        [],
    );

    const persistedChatMessagesByTopic = useMemo<Record<number, ChatMessage[]>>(() => {
        const map: Record<number, ChatMessage[]> = {};
        for (const entry of chatMessagesFromDb ?? []) {
            if (!map[entry.topic_id]) {
                map[entry.topic_id] = [];
            }
            map[entry.topic_id].push({
                id: entry.id,
                sender: entry.sender,
                text: entry.text,
            });
        }
        return map;
    }, [chatMessagesFromDb]);

    const messagesForActiveTopic = useMemo<ChatMessage[]>(() => {
        if (!selectedTopic) return [];
        const topicId = selectedTopic.id;
        const persisted = persistedChatMessagesByTopic[topicId] ?? [];
        const pending = pendingAiMessages[topicId] ?? [];
        return [...persisted, ...pending];
    }, [selectedTopic?.id, persistedChatMessagesByTopic, pendingAiMessages]);

    const pageCountByTopic = useMemo<Record<number, number>>(() => {
        const counts: Record<number, number> = {};
        for (const page of allSavedPages ?? []) {
            counts[page.topic_id] = (counts[page.topic_id] ?? 0) + 1;
        }
        return counts;
    }, [allSavedPages]);

    const normalizedTopicQuery = topicSearchQuery.trim().toLowerCase();
    const visibleTopics = (topics ?? []).filter(topic => {
        if (!normalizedTopicQuery) return true;
        return topic.name.toLowerCase().includes(normalizedTopicQuery);
    });

    const normalizedPageQuery = pageSearchQuery.trim().toLowerCase();
    const visiblePages = (savedPages ?? []).filter(page => {
        if (page.topic_id !== selectedTopic?.id) {
            return false;
        }
        if (!normalizedPageQuery) return true;
        const title = page.title?.toLowerCase() ?? "";
        const url = page.url?.toLowerCase() ?? "";
        return title.includes(normalizedPageQuery) || url.includes(normalizedPageQuery);
    });

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

                    const pageId = await db.addSavedPage({
                        topic_id: selectedTopic.id,
                        url: currentTab.url,
                        title: currentTab.title,
                        icon: `https://www.google.com/s2/favicons?domain=${new URL(currentTab.url).hostname}&sz=128`,
                    });

                    // extract text
                    let pageText = "";
                    try {
                        const [{ result } = {} as any] = await chrome.scripting.executeScript({
                            target: { tabId: currentTab.id! },
                            func: () => {
                                const root = document.querySelector("article, main, [role='main']") || document.body;
                                root.querySelectorAll("script,style,noscript,nav,header,footer,aside,form,svg")
                                    .forEach(el => el.remove());

                                let text = root.textContent ?? "";
                                if (root instanceof HTMLElement) {
                                    text = root.innerText || text;
                                }
                                return text.replace(/\s+/g, " ").trim().slice(0, 120000);
                            },
                        });
                        pageText = result || "";
                    } catch (e) {
                        console.warn("extract text failed:", e);
                    }

                    // send to background.ts
                    chrome.runtime.sendMessage({
                        type: "SUMMARIZE_SAVED_PAGE_WITH_TEXT",
                        payload: {
                            pageId,
                            url: currentTab.url,
                            title: currentTab.title,
                            text: pageText,
                        },
                    }, (resp) => {
                        if (chrome.runtime.lastError) {
                            console.warn("BG message error:", chrome.runtime.lastError);
                        } else if (!resp?.ok) {
                            console.warn("BG summarize failed:", resp?.error);
                        }
                    });

                    showToast("Page saved. Generating summary in background...");

                } else {
                    console.error("Could not get title or URL from the current tab.");
                    showToast("Cannot read current tab.");
                    return;
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
        setIsPageSearchActive(false);
        setPageSearchQuery("");
    };

    const handleBackToList = () => {
        setSelectedTopic(null);
        setCurrentView('list');
        setIsPageSearchActive(false);
        setPageSearchQuery("");
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

    const handlePageCardClick = (page: SavedPage) => {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.create({ url: page.url }).catch(error => console.error("Error creating tab:", error));
        } else {
            window.open(page.url, '_blank');
        }
    };

    const toggleTopicSearch = () => {
        setIsTopicSearchActive(prev => {
            const next = !prev;
            if (!next) {
                setTopicSearchQuery("");
            }
            return next;
        });
    };

    const togglePageSearch = () => {
        setIsPageSearchActive(prev => {
            const next = !prev;
            if (!next) {
                setPageSearchQuery("");
            }
            return next;
        });
    };

    const openSettings = () => setIsSettingsOpen(true);
    const closeSettings = () => setIsSettingsOpen(false);

    const removePendingAiMessage = (topicId: number, messageId: number) => {
        setPendingAiMessages(prev => {
            const existing = prev[topicId];
            if (!existing) return prev;
            const filtered = existing.filter(msg => msg.id !== messageId);
            if (filtered.length === existing.length) return prev;
            if (filtered.length === 0) {
                const { [topicId]: _removed, ...rest } = prev;
                return rest;
            }
            return {
                ...prev,
                [topicId]: filtered,
            };
        });
    };

    const handleClearChatHistory = async () => {
        if (!selectedTopic) return;
        const topicId = selectedTopic.id;
        try {
            await db.clearChatMessagesByTopic(topicId);
            showToast('Chat cleared.');
        } catch (error) {
            console.error('Failed to clear chat messages:', error);
            showToast('Failed to clear chat. Please try again.');
        }
        setPendingAiMessages(prev => {
            if (!prev[topicId]) return prev;
            const { [topicId]: _removed, ...rest } = prev;
            return rest;
        });
    };

    const fetchActiveTabContext = async () => {
        if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
            throw new Error('Active tab content is only available inside the Chrome extension environment.');
        }

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];

        if (!currentTab?.id) {
            throw new Error('No active tab found. Please select a tab and try again.');
        }

        const [injectionResult] = await chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            func: () => {
                const root = document.querySelector("article, main, [role='main']") || document.body;
                root.querySelectorAll("script,style,noscript,nav,header,footer,aside,form,svg").forEach(el => el.remove());

                let text = root.textContent ?? "";
                if (root instanceof HTMLElement) {
                    text = root.innerText || text;
                }

                return {
                    content: text.replace(/\s+/g, " ").trim().slice(0, 120000),
                    title: document.title,
                    url: window.location.href,
                };
            },
        });

        const result = injectionResult?.result as { content?: string; title?: string; url?: string } | undefined;
        const content = result?.content?.trim();

        if (!content) {
            throw new Error('Unable to read the active tab content. Try refreshing the page and running the query again.');
        }

        const truncatedContent = content.slice(0, 20_000);

        return {
            content: truncatedContent,
            title: result?.title ?? currentTab.title ?? 'Untitled Page',
            url: result?.url ?? currentTab.url ?? 'Unknown URL',
        };
    };

    const buildPromptInput = async (message: string, mode: 'topic' | 'page'): Promise<string> => {
        const baseInstructions = [
            'You are CollectMind, a reference-driven assistant.',
            'Use only the provided reference materials to answer the user.',
            'When you mention citing sources, it is better to indicate the title of the document instead of the document numbers.'
        ].join(' ');

        if (mode === 'topic') {
            if (!selectedTopic) {
                throw new Error('No topic selected for topic chat.');
            }

            const topicPages = (savedPages ?? [])
                .filter(page => page.topic_id === selectedTopic.id)
                .map((page, index) => {
                    const summary = page.summary?.trim() || 'Summary is not available yet.';
                    const safeTitle = page.title?.trim() || 'Untitled page';
                    return `Document ${index + 1}: ${safeTitle}\nURL: ${page.url}\nSummary:\n${summary}`;
                });

            const referenceMaterial = topicPages.length > 0
                ? topicPages.join('\n\n')
                : 'No documents available.';

            return [
                baseInstructions,
                `The conversation is about the topic: "${selectedTopic.name}".`,
                'Reference materials:',
                referenceMaterial,
                'User question:',
                message,
            ].join('\n\n');
        }

        const activeTab = await fetchActiveTabContext();
        const pageReference = `Document 1\nTitle: ${activeTab.title}\nURL: ${activeTab.url}\nContent:\n${activeTab.content}`;

        return [
            baseInstructions,
            'The conversation is about the currently open web page. Use only the provided content.',
            'Reference materials:',
            pageReference,
            'User question:',
            message,
        ].join('\n\n');
    };

    const handleSendMessage = async (message: string, mode: 'topic' | 'page') => {
        if (!selectedTopic) {
            showToast('Please select a topic before chatting.');
            return;
        }

        const topicId = selectedTopic.id;

        try {
            await db.addChatMessage({
                topic_id: topicId,
                sender: 'user',
                text: message,
            });
        } catch (error) {
            console.error('Failed to store user message:', error);
            showToast('Failed to send message. Please try again.');
            return;
        }

        setIsChatMaximized(true);

        const loadingMessageId = -Math.floor(Date.now() + Math.random() * 1000);
        const loadingMessage: ChatMessage = {
            id: loadingMessageId,
            sender: 'ai',
            text: '',
            isLoading: true,
        };

        setPendingAiMessages(prev => {
            const existing = prev[topicId] ?? [];
            return {
                ...prev,
                [topicId]: [...existing, loadingMessage],
            };
        });

        try {
            const promptInput = await buildPromptInput(message, mode);
            const aiText = await prompt(promptInput);
            await db.addChatMessage({
                topic_id: topicId,
                sender: 'ai',
                text: aiText || 'AI returned an empty response.',
            });
        } catch (error) {
            console.error('Failed to fetch AI response:', error);
            let fallbackText = 'Failed to fetch AI response. Please try again.';
            if (error instanceof Error) {
                if ((error as any).name === 'QuotaExceededError') {
                    fallbackText = 'The request is too large for the AI to handle. Please shorten the conversation or context and try again.';
                    showToast('AI request was too large. Try shortening the context.');
                } else if (error.message) {
                    fallbackText = error.message;
                    showToast('Failed to fetch AI response. Please try again.');
                } else {
                    showToast('Failed to fetch AI response. Please try again.');
                }
            } else {
                showToast('Failed to fetch AI response. Please try again.');
            }
            try {
                await db.addChatMessage({
                    topic_id: topicId,
                    sender: 'ai',
                    text: fallbackText,
                });
            } catch (storeError) {
                console.error('Failed to store fallback AI message:', storeError);
            }
        } finally {
            removePendingAiMessage(topicId, loadingMessageId);
        }
    };

    return (
        <>
            <div className={`app-container ${(createModalOpen || isSettingsOpen) ? 'modal-open' : ''}`}>
                <div className={isChatMaximized ? 'app-content-wrapper chat-active' : 'app-content-wrapper'}>
                    {currentView === 'list'
                        ? (
                            <>
                                <HeaderComponent
                                    onNewTopicClick={openModal}
                                    isSearchActive={isTopicSearchActive}
                                    searchQuery={topicSearchQuery}
                                    onToggleSearch={toggleTopicSearch}
                                    onSearchChange={(value) => setTopicSearchQuery(value)}
                                    onClearSearch={() => setTopicSearchQuery("")}
                                    onSettingsClick={openSettings}
                                />
                                <div className="content-area">
                                    {visibleTopics.map((topic) => (
                                        <TopicCard
                                            key={topic.id}
                                            topic={topic}
                                            pageCount={pageCountByTopic[topic.id] ?? 0}
                                            onClick={() => handleCardClick(topic)}
                                            onEdit={() => openEditTopic(topic)}
                                            onDelete={() => handleDeleteTopic(topic)}
                                        />
                                    ))}
                                </div>
                            </>
                        )
                        : selectedTopic && (
                        <>
                            <Header2
                                topicName={selectedTopic.name}
                                onBack={handleBackToList}
                                onAddPage={handleAddCurrentPage}
                                isSearchActive={isPageSearchActive}
                                searchQuery={pageSearchQuery}
                                onToggleSearch={togglePageSearch}
                                onSearchChange={(value) => setPageSearchQuery(value)}
                                onClearSearch={() => setPageSearchQuery("")}
                                onSettingsClick={openSettings}
                            />
                            <div className="detail-view-container">
                                <div className="content-area">
                                    {visiblePages.map(page => (
                                            <SavedPageCard
                                                key={page.id}
                                                page={page}
                                                onClick={() => handlePageCardClick(page)}
                                                onDelete={() => handleDeleteSavedPage(page.id, page.title)}
                                            />
                                        ))
                                    }
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {currentView === 'detail' && selectedTopic && (
                    <ChatContainer
                        topicName={selectedTopic.name}
                        messages={messagesForActiveTopic}
                        onSendMessage={handleSendMessage}
                        isMaximized={isChatMaximized}
                        setIsMaximized={setIsChatMaximized}
                        onClearChat={handleClearChatHistory}
                    />
                )}
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

            <SettingsOverlay
                open={isSettingsOpen}
                onClose={closeSettings}
                appName="CollectMind"
                version="0.1.0"
            />
        </>
    );
};

export default App;
