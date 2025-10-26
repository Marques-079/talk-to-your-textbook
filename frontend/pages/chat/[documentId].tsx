import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { api, Chat, MessageWithCitations, Document } from '@/lib/api';
import PDFViewer from '@/components/PDFViewer';
import ThemeToggle from '@/components/ThemeToggle';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, documentId]);

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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/ask`, {
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
              
              // Auto-scroll only the first citation (top priority)
              if (citations.length === 1 && pdfViewerRef.current) {
                const firstCitation = data.citation;
                pdfViewerRef.current.scrollToPage(firstCitation.page_number);
              }
            } else if (data.type === 'done') {
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
    }
  };

  if (status === 'loading' || !document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/library')}
            className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
          >
            ← Back to Library
          </button>
          <div className="flex items-center">
            <div className="w-6 h-6 bg-black dark:bg-white rounded-full mr-2"></div>
            <h1 className="text-lg font-semibold text-black dark:text-white">
              {document.title}
            </h1>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Main content: Chat + PDF viewer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel */}
        <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={msg.message.role === 'user' ? 'text-right' : 'text-left'}>
                <div
                  className={`inline-block max-w-3/4 px-4 py-2 rounded-lg ${
                    msg.message.role === 'user'
                      ? 'bg-black dark:bg-white text-white dark:text-black'
                      : 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.message.content}</div>
                  {msg.citations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.citations.slice(0, 3).map((cit, citIdx) => (
                        <button
                          key={citIdx}
                          onClick={() => handleCitationClick(cit)}
                          className={`text-xs px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors ${
                            citIdx === 0 
                              ? 'bg-yellow-200 dark:bg-yellow-600 text-black dark:text-white font-semibold' 
                              : 'bg-gray-200 dark:bg-gray-600 text-black dark:text-white'
                          }`}
                        >
                          {cit.figure_num ? `Fig. ${cit.figure_num}, p. ${cit.page_number}` : `p. ${cit.page_number}`}
                        </button>
                      ))}
                      {msg.citations.length > 3 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          +{msg.citations.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Current streaming answer */}
            {isAsking && currentAnswer && (
              <div className="text-left">
                <div className="inline-block max-w-3/4 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-black dark:text-white">
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
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white bg-white dark:bg-gray-700 text-black dark:text-white disabled:opacity-50"
              />
              <button
                onClick={askQuestion}
                disabled={isAsking || !question.trim()}
                className="px-6 py-2 bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white dark:text-black font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white disabled:cursor-not-allowed transition-colors"
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
