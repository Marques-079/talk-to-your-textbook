import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { api, Document } from '@/lib/api';

export default function Library() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      loadDocuments();
    }
  }, [status, router]);

  // Poll for status updates when documents are processing
  useEffect(() => {
    // Check if any documents are currently processing
    const hasProcessingDocs = documents.some(
      (doc) => doc.status === 'queued' || doc.status === 'running'
    );

    if (!hasProcessingDocs || status !== 'authenticated') {
      return;
    }

    // Poll every 3 seconds
    const interval = setInterval(async () => {
      try {
        const response = await api.get('/documents');
        const latestDocs = response.data.documents || response.data;
        
        // Only update if there are actual changes to avoid unnecessary re-renders
        setDocuments((prevDocs) => {
          const hasChanges = latestDocs.some((latestDoc: Document) => {
            const prevDoc = prevDocs.find((d) => d.id === latestDoc.id);
            return (
              !prevDoc ||
              prevDoc.status !== latestDoc.status ||
              prevDoc.page_count !== latestDoc.page_count
            );
          });

          return hasChanges ? latestDocs : prevDocs;
        });
      } catch (error) {
        console.error('Failed to poll documents:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, status]);

  const loadDocuments = async () => {
    try {
      const response = await api.get('/documents');
      setDocuments(response.data.documents || response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.includes('pdf')) {
      alert('Please select a PDF file');
      return;
    }

    setUploading(true);
    setUploadProgress('Getting upload URL...');

    try {
      // Get presigned URL
      const presignResponse = await api.get('/presign', {
        params: {
          filename: file.name,
          content_type: 'application/pdf',
        },
      });

      const { doc_id, upload_url } = presignResponse.data;

      // Upload to MinIO
      setUploadProgress('Uploading PDF...');
      await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': 'application/pdf',
        },
      });

      // Trigger ingestion
      setUploadProgress('Processing document...');
      await api.post('/ingest', null, {
        params: { doc_id },
      });

      setUploadProgress('');
      setUploading(false);
      loadDocuments();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload document');
      setUploadProgress('');
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await api.delete(`/documents/${docId}`);
      loadDocuments();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete document');
    }
  };

  const openChat = (docId: string) => {
    router.push(`/chat/${docId}`);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Library
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {session?.user?.email}
            </span>
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload section */}
        <div className="mb-8">
          <label className="block">
            <span className="sr-only">Choose PDF file</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                dark:file:bg-blue-900 dark:file:text-blue-200
                hover:file:bg-blue-100 dark:hover:file:bg-blue-800
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>
          {uploadProgress && (
            <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
              {uploadProgress}
            </p>
          )}
        </div>

        {/* Documents grid */}
        {documents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No documents yet. Upload a PDF to get started!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 truncate">
                  {doc.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {doc.filename}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mb-4 transition-all duration-300">
                  {doc.page_count ? `${doc.page_count} pages` : 'Processing...'}
                </p>
                
                {/* Status badge */}
                <div className="mb-4 transition-all duration-500">
                  {doc.status === 'done' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 animate-fade-in">
                      Ready
                    </span>
                  )}
                  {doc.status === 'running' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                      Processing...
                    </span>
                  )}
                  {doc.status === 'queued' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Queued
                    </span>
                  )}
                  {doc.status === 'error' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                      Error
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => openChat(doc.id)}
                    disabled={doc.status !== 'done'}
                    className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:cursor-not-allowed transition-all duration-300"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

