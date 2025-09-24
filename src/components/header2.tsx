import React from "react";
import {ChevronLeft, Plus, Search, Settings} from "lucide-react";
import "../styles/header2.css";

interface Toolbar2Props {
    topicName: string;
    onBack: () => void;
}

const Header2: React.FC<Toolbar2Props> = ({onBack }) => {
    return (
        <>
            <div className="toolbar2-container">
                <div onClick={onBack} className="back-link">
                    <ChevronLeft size={22} />
                    <span>Back</span>
                </div>

                <button className="add-page-button">
                    <Plus size={20} />
                    <span>Add Page</span>
                </button>

                <div className="icon-group">
                    <Search size={22} className="icon" />
                    {/*<RotateCw size={22} className="icon" />*/}
                    <Settings size={22} className="icon" />
                </div>
            </div>
        </>
    );
};

export default Header2;