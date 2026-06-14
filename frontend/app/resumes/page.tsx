export default function UploadResumesPage() {
  return (
    <div style={{ padding: '3rem' }} className="glass-panel">
      <h1 className="grad-text" style={{ fontSize: '2rem', marginBottom: '1rem' }}>Upload Resume</h1>
      <p style={{ marginBottom: '1rem' }}>Drag and drop your PDF or DOCX file below, or click to select.</p>
      {/* Placeholder UI */}
      <input type="file" accept=".pdf,.docx" />
    </div>
  );
}
