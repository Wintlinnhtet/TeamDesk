import React, { useState } from "react";
import { FaEllipsisV } from "react-icons/fa";
import AccessListModal from "./AccessListModal";

const FolderCard = ({ folder }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const handleManageAccess = () => {
    setMenuOpen(false);
    setModalOpen(true);
  };

  const handleSaveAccess = (updatedPeople) => {
    console.log("Updated access for folder:", folder.name, updatedPeople);
    setModalOpen(false);
  };

  return (
    <div className="p-4 bg-white shadow rounded-2xl flex justify-between items-center relative">
      <div>
        <h3 className="text-lg font-semibold">{folder.name}</h3>
        <p className="text-sm text-gray-500">{folder.description}</p>
      </div>

      {/* Kebab Button */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-full hover:bg-gray-100"
        >
          <FaEllipsisV className="w-5 h-5" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-40 bg-white border rounded-lg shadow-md z-10">
            <button
              onClick={handleManageAccess}
              className="w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              Manage Access
            </button>
            <button className="w-full text-left px-4 py-2 hover:bg-gray-100">
              Share
            </button>
            <button className="w-full text-left px-4 py-2 hover:bg-gray-100">
              Download
            </button>
          </div>
        )}
      </div>

      {/* Access List Modal */}
      <AccessListModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        people={folder.people}
        onSave={handleSaveAccess}
      />
    </div>
  );
};

export default FolderCard;
