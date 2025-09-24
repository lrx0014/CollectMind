import React from "react";
import {ChevronLeft, Plus} from "lucide-react";

const toolbar2Styles = `
  .toolbar2-container {
    padding: 10px 20px; display: flex; justify-content: space-between;
    align-items: center; background-color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }
  .back-link {
    display: flex; align-items: center; gap: 8px; color: #555;
    text-decoration: none; cursor: pointer; font-size: 16px;
  }
  .back-link:hover { color: #000; }
  .add-page-button {
    display: flex; align-items: center; gap: 8px; background-color: #fcefee;
    border: none; border-radius: 20px; padding: 10px 20px;
    font-size: 16px; font-weight: 500; color: #D0021B;
    cursor: pointer; transition: background-color 0.2s ease;
  }
  .add-page-button:hover { background-color: #f9e0dd; }
`;
interface Toolbar2Props {
    topicName: string;
    onBack: () => void;
}
const Header2: React.FC<Toolbar2Props> = ({ topicName, onBack }) => {
    return (
        <>
            <style>{toolbar2Styles}</style>
            <div className="toolbar2-container">
                <div onClick={onBack} className="back-link">
                    <ChevronLeft size={22} />
                    <span>{topicName} (Back)</span>
                </div>

                <button className="add-page-button">
                    <Plus size={20} />
                    <span>Add current page</span>
                </button>
            </div>
        </>
    );
};

export default Header2;