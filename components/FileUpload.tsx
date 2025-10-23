import React, { useCallback, useState } from 'react';
import { UploadIcon } from './icons';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div className="mt-8 text-left">
        <label className="text-lg font-semibold text-gray-300">2. Upload your product image</label>
        <div 
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          className={`mt-2 p-8 border-2 border-dashed rounded-2xl transition-all duration-300 text-center ${isDragging ? 'border-amber-400 bg-amber-500/10' : 'border-gray-600 hover:border-amber-500/50'}`}
        >
            <input
                type="file"
                id="file-upload"
                className="hidden"
                accept="image/jpeg, image/png, application/pdf"
                onChange={handleFileChange}
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <UploadIcon className={`w-12 h-12 transition-colors duration-300 ${isDragging ? 'text-amber-400' : 'text-gray-500'}`} />
                <span className="mt-4 text-lg font-semibold text-gray-300">
                    Drag & drop your file here
                </span>
                <span className="text-gray-500">or</span>
                <span className="mt-1 font-bold text-amber-400 hover:text-amber-300">
                    Browse files
                </span>
                <p className="mt-4 text-xs text-gray-500">Supports: JPEG, PNG. PDF support is limited.</p>
            </label>
        </div>
    </div>
  );
};