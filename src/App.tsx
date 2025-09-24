import React from 'react';
import HeaderComponent from "./components/header.tsx";
import "./styles/app.css";
import TopicCard from "./components/card.tsx";


// --- Mock Data for Cards ---
const topics = [
    {
        title: 'Mock Topic 1',
        summary: 'This document outlines the strategy and timeline for migrating our legacy component library to the new design system. Key milestones and potential risks are detailed within.',
        tagColor: '#4A90E2'
    },
    {
        title: 'Mock Topic 2',
        summary: 'A comprehensive list of objectives and key results for the engineering department for the fourth quarter. Focus areas include performance improvements and security enhancements.',
        tagColor: '#50E3C2'
    },
    {
        title: 'Mock Topic 3',
        summary: 'Findings from the recent security audit of the user authentication and session management flows. This is a very long summary to test the line clamp functionality to ensure that it correctly truncates text that exceeds three lines, providing a clean and consistent look across all cards.',
        tagColor: '#F5A623'
    },
    {
        title: 'Mock Topic 4',
        summary: 'Analysis of recent API traffic spikes and a proposal for implementing a more robust rate-limiting strategy to ensure service stability.',
        tagColor: '#D0021B'
    },
    {
        title: 'Mock Topic 5',
        summary: 'Initial mockups and user flow diagrams for the redesigned user onboarding experience. Feedback is requested from all stakeholders.',
        tagColor: '#bd93f9' // Purple
    },
    {
        title: 'Mock Topic 6',
        summary: 'This document outlines the strategy and timeline for migrating our legacy component library to the new design system. Key milestones and potential risks are detailed within.',
        tagColor: '#4A90E2'
    },
    {
        title: 'Mock Topic 7',
        summary: 'A comprehensive list of objectives and key results for the engineering department for the fourth quarter. Focus areas include performance improvements and security enhancements.',
        tagColor: '#50E3C2'
    },
    {
        title: 'Mock Topic 8',
        summary: 'Findings from the recent security audit of the user authentication and session management flows. This is a very long summary to test the line clamp functionality to ensure that it correctly truncates text that exceeds three lines, providing a clean and consistent look across all cards.',
        tagColor: '#F5A623'
    },
    {
        title: 'Mock Topic 9',
        summary: 'Analysis of recent API traffic spikes and a proposal for implementing a more robust rate-limiting strategy to ensure service stability.',
        tagColor: '#D0021B'
    },
    {
        title: 'Mock Topic 10',
        summary: 'Initial mockups and user flow diagrams for the redesigned user onboarding experience. Feedback is requested from all stakeholders.',
        tagColor: '#bd93f9' // Purple
    },
];

// --- Main App Component ---
const App: React.FC = () => (
    <>
        <div className="app-container">
            <HeaderComponent />
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
    </>
);

export default App;

