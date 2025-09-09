import React, { useState } from 'react';
import FileCard from './FileCard';

const sampleFiles = [
  {
    id: 1,
    name: 'Quarterly_Report.pdf',
    size: '1.2 MB',
    people: [
      { id: 1, name: 'You', access: 'Manage' },
      { id: 2, name: 'Alice Chen', access: 'Read & Write' },
      { id: 3, name: 'Bob Tan', access: 'Read' },
    ],
  },
  {
    id: 2,
    name: 'Project_Plan.docx',
    size: '850 KB',
    people: [
      { id: 4, name: 'Eve', access: 'Read & Write' },
      { id: 5, name: 'Charlie', access: 'Read' },
    ],
  },
];

const FileListPage = () => {
  const [files, setFiles] = useState(sampleFiles);

  const handleSaveAccess = (fileId, updatedPeople) => {
    setFiles((prev) => prev.map(f => f.id === fileId ? { ...f, people: updatedPeople } : f));
    console.log('Updated access for file', fileId, updatedPeople);
  };

  return (
    <div className="p-6 space-y-4">
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          onSaveAccess={(updatedPeople) => handleSaveAccess(file.id, updatedPeople)}
        />
      ))}
    </div>
  );
};

export default FileListPage;
