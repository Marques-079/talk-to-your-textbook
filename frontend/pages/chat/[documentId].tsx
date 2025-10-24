import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { api, Chat, MessageWithCitations, Document } from '@/lib/api';
import PDFViewer from '@/components/PDFViewer';

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { documentId } = router.query;
  
  const [document, setDocument] = useState<Document | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<MessageWithCitations[]>([]);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pdfViewerRef = useRef<any>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && documentId) {
      loadDocument();
      loadChats();
    }
  }, [status, documentId, router]);

  const loadDocument = async () => {
    try {
      const response = await api.get('/documents');
      const docs = response.data.documents || response.data;
      const doc = docs.find((d: Document) => d.id === documentId);
      setDocument(doc || null);
    } catch (error) {
      console.error('Failed to load document:', error);
    }
  };

  const loadChats = async () => {
    try {
      const response = await api.get('/chats', {
        params: { document_id: documentId },
      });
      const chatList = response.data.chats || response.data;
      setChats(chatList);
      
      // Create or select first chat
      if (chatList.length === 0) {
        createNewChat();
      } else {
        selectChat(chatList[0]);
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
    }
  };

  const createNewChat = async () => {
    try {
      const response = await api.post('/chats', {
        document_id: documentId,
        title: `Chat ${new Date().toLocaleString()}`,
      });
      const newChat = response.data.chat || response.data;
      setChats([...chats, newChat]);
      setCurrentChat(newChat);
      setMessages([]);
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  const selectChat = async (chat: Chat) => {
    setCurrentChat(chat);
    try {
      const response = await api.get(`/chats/${chat.id}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const askQuestion = async () => {
    if (!question.trim() || !currentChat || isAsking) return;

    const userQuestion = question;
    setQuestion('');
    setIsAsking(true);
    setCurrentAnswer('');

    // Add user message to UI
    const userMessage: MessageWithCitations = {
      message: {
        id: 'temp-user',
        role: 'user',
        content: userQuestion,
        created_at: new Date().toISOString(),
      },
      citations: [],
    };
    setMessages([...messages, userMessage]);

    try {
      // SSE request
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(session as any)?.accessToken}`,
        },
        body: JSON.stringify({
          chat_id: currentChat.id,
          question: userQuestion,
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = '';
      const citations: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'token') {
              answer += data.content;
              setCurrentAnswer(answer);
            } else if (data.type === 'citation') {
              citations.push(data.citation);
            } else if (data.type === 'done') {
              // Add assistant message
              const assistantMessage: MessageWithCitations = {
                message: {
                  id: data.message_id,
                  role: 'assistant',
                  content: answer,
                  created_at: new Date().toISOString(),
                },
                citations: citations,
              };
              setMessages((prev) => [...prev, assistantMessage]);
              setCurrentAnswer('');
            } else if (data.type === 'error') {
              alert(`Error: ${data.error}`);
            }
          }
        }
      }

      setIsAsking(false);
    } catch (error) {
      console.error('Failed to ask question:', error);
      alert('Failed to get answer');
      setIsAsking(false);
      setCurrentAnswer('');
    }
  };

  const handleCitationClick = (citation: any) => {
    if (pdfViewerRef.current) {
      pdfViewerRef.current.scrollToPage(citation.page_number);
      if (citation.char_start !== undefined && citation.char_end !== undefined) {
        pdfViewerRef.current.highlightText(citation.page_number, citation.char_start, citation.char_end);
      }
    }
  };

  if (status === 'loading' || !document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/library')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← Back to Library
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {document.title}
          </h1>
        </div>
      </header>

      {/* Main content: Chat + PDF viewer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel */}
        <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={msg.message.role === 'user' ? 'text-right' : 'text-left'}>
                <div
                  className={`inline-block max-w-3/4 px-4 py-2 rounded-lg ${
                    msg.message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.message.content}</div>
                  {msg.citations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.citations.map((cit, citIdx) => (
                        <button
                          key={citIdx}
                          onClick={() => handleCitationClick(cit)}
                          className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                        >
                          {cit.figure_num ? `Fig. ${cit.figure_num}, p. ${cit.page_number}` : `p. ${cit.page_number}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Current streaming answer */}
            {isAsking && currentAnswer && (
              <div className="text-left">
                <div className="inline-block max-w-3/4 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                  <div className="whitespace-pre-wrap">{currentAnswer}</div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && askQuestion()}
                placeholder="Ask a question..."
                disabled={isAsking}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              />
              <button
                onClick={askQuestion}
                disabled={isAsking || !question.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:cursor-not-allowed"
              >
                {isAsking ? 'Asking...' : 'Ask'}
              </button>
            </div>
          </div>
        </div>

        {/* PDF viewer */}
        <div className="w-1/2 bg-gray-100 dark:bg-gray-900">
          <PDFViewer
            ref={pdfViewerRef}
            documentId={documentId as string}
            userId={(session?.user as any)?.id}
            filename={document.filename}
          />
        </div>
      </div>
    </div>
  );
}

