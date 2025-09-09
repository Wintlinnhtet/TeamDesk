import React, { useState, useEffect } from "react";

const AccessListModal = ({ open, onClose, people, onSave }) => {
  const [localPeople, setLocalPeople] = useState([]);

  useEffect(() => {
    setLocalPeople(people || []);
  }, [people]);

  const handleAccessChange = (index, newAccess) => {
    const updated = [...localPeople];
    updated[index].access = newAccess;
    setLocalPeople(updated);
  };

  const handleSave = () => {
    onSave(localPeople);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-40 z-50">
      <div className="bg-white rounded-2xl shadow-lg p-6 w-96">
        <h2 className="text-lg font-semibold mb-4">Manage Access</h2>
        <ul className="space-y-3 max-h-60 overflow-y-auto">
          {localPeople.map((person, index) => (
            <li key={index} className="flex justify-between items-center">
              <span>{person.name}</span>
              <select
                value={person.access}
                onChange={(e) => handleAccessChange(index, e.target.value)}
                className="border rounded p-1 text-sm"
              >
                <option value="Read">Read</option>
                <option value="Read & Write">Read & Write</option>
                <option value="Manage">Manage</option>
              </select>
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessListModal;
