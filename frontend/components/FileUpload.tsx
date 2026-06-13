'use client';

import { useState, useRef } from 'react';
import { Upload, File, AlertCircle, Check } from 'lucide-react';

interface FileUploadProps {
  onFileLoaded: (base64Data: string, mimeType: string, fileName: string, file: File) => void;
  accept?: string;
  maxSizeMB?: number;
}

export default function FileUpload({
  onFileLoaded,
  accept = '.pdf,.docx,.doc',
  maxSizeMB = 5
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const processFile = (selectedFile: File) => {
    setError(null);
    
    // Check file size
    if (selectedFile.size > maxSizeMB * 1024 * 1024) {
      setError(`File size exceeds the limit of ${maxSizeMB}MB.`);
      return;
    }

    // Check file extension
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = accept.split(',').map(e => e.trim().replace('.', '').toLowerCase());
    if (ext && !allowedExtensions.includes(ext)) {
      setError(`Only ${accept} files are supported.`);
      return;
    }

    setFile(selectedFile);
    setUploading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // Convert data URL to base64
      const base64Data = result.split(',')[1];
      const mimeType = selectedFile.type || getMimeTypeByExtension(ext);
      
      onFileLoaded(base64Data, mimeType, selectedFile.name, selectedFile);
      setUploading(false);
    };
    reader.onerror = () => {
      setError('Failed to read file.');
      setUploading(false);
    };
    reader.readAsDataURL(selectedFile);
  };

  const getMimeTypeByExtension = (ext?: string) => {
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'doc': return 'application/msword';
      default: return 'application/octet-stream';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        style={{
          border: `2px dashed ${isDragOver ? 'var(--color-primary)' : 'var(--border-color)'}`,
          background: isDragOver ? 'rgba(124, 58, 237, 0.05)' : 'rgba(0, 0, 0, 0.2)',
          borderRadius: 'var(--radius-md)',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'var(--transition)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          minHeight: '180px'
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={accept}
          style={{ display: 'none' }}
        />

        {uploading ? (
          <div style={{ animation: 'spin 1s linear infinite', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', width: '32px', height: '32px' }} />
        ) : file ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
              <Check size={24} color="var(--color-accent)" />
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>{file.name}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB • Ready</span>
          </div>
        ) : (
          <>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={22} color="var(--text-muted)" />
            </div>
            <div>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                Drag & drop your resume file here
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Supports PDF, DOCX or DOC up to {maxSizeMB}MB
              </p>
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-danger)', background: 'rgba(239, 68, 68, 0.05)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
