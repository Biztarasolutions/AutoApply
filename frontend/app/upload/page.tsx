export default function UploadPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Upload Your Resume</h1>
      <p className="mb-4">Use the form below to upload a PDF or DOCX resume.</p>
      {/* Placeholder upload form */}
      <form className="flex flex-col gap-4 max-w-md">
        <input type="file" accept=".pdf,.docx" className="file-input file-input-bordered w-full" />
        <button type="submit" className="btn btn-primary">Upload</button>
      </form>
    </div>
  );
}
