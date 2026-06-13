"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useDropzone } from 'react-dropzone';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function UploadPage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    await handleUpload(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
  });

  const handleUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    setProgress(0);
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx'].includes(fileExt ?? '')) {
      setError('Unsupported file type. Only PDF and DOCX are allowed.');
      setUploading(false);
      return;
    }
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('User not authenticated');

      const filePath = `resumes/${authUser.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file, {
          upsert: false,
          cacheControl: '0',
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      setProgress(100);

      // Call processing API
      const response = await fetch('/api/resume/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, fileName: file.name, fileType: file.type, userId: authUser.id }),
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Processing failed: ${err}`);
      }
      // Success – redirect to dashboard
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">Upload Your Resume</h1>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 w-full max-w-md text-center cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-lg text-blue-600">Drop the file here …</p>
        ) : (
          <p className="text-lg text-gray-600">Drag &amp; drop PDF or DOCX here, or click to select a file (max 10 MB)</p>
        )}
      </div>
      {uploading && (
        <div className="mt-4 w-full max-w-md">
          <div className="bg-gray-200 rounded-full h-2.5 mb-4">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <p>{progress}% uploaded</p>
        </div>
      )}
      {error && <p className="mt-4 text-red-600">{error}</p>}
    </div>
  );
}
