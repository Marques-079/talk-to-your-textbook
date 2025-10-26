# API Contract

Base URL: `http://localhost:8000/api`

## Authentication

All authenticated endpoints require `Authorization: Bearer <JWT_TOKEN>` header.

## Core Types

### Document
```typescript
{
  id: string;              // UUIDv4
  user_id: string;         // UUIDv4
  title: string;
  filename: string;
  status: 'queued' | 'running' | 'done' | 'error';
  error_message?: string;
  page_count?: number;
  created_at: string;      // ISO 8601
  updated_at: string;
}
```

### Page
```typescript
{
  id: string;
  document_id: string;
  page_number: number;
  text: string;
  created_at: string;
}
```

### Chunk
```typescript
{
  id: string;
  document_id: string;
  page_id: string;
  page_number: number;
  text: string;
  char_start: number;
  char_end: number;
  heading_path?: string;
  created_at: string;
}
```

### Figure
```typescript
{
  id: string;
  document_id: string;
  page_id: string;
  figure_num: number;
  caption?: string;
  bbox: { x: number; y: number; width: number; height: number };
  schema_json?: {
    x_axis?: { name: string; units?: string };
    y_axis?: { name: string; units?: string };
    series?: Array<{ label: string; trend: string }>;
    key_points?: string[];
    confidence?: number;
  };
  created_at: string;
}
```

### Chat
```typescript
{
  id: string;
  user_id: string;
  document_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}
```

### Message
```typescript
{
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
```

### Citation
```typescript
{
  id: string;
  message_id: string;
  page_number: number;
  figure_num?: number;
  char_start?: number;
  char_end?: number;
  bbox?: { x: number; y: number; width: number; height: number };
}
```

## Endpoints

### Authentication

#### POST /api/auth/signup
```typescript
Request: {
  email: string;
  password: string;
  name?: string;
}
Response: {
  user: {
    id: string;
    email: string;
    name?: string;
  }
}
```

#### POST /api/auth/signin
```typescript
Request: {
  email: string;
  password: string;
}
Response: {
  access_token: string;
  user: {
    id: string;
    email: string;
    name?: string;
  }
}
```

#### POST /api/auth/signout
```typescript
Response: { success: true }
```

### Documents

#### GET /api/presign
```typescript
Query: {
  filename: string;
  content_type: string;
}
Response: {
  doc_id: string;
  upload_url: string;
  expires_in: number;
}
```

#### POST /api/ingest
```typescript
Query: {
  doc_id: string;
}
Response: {
  success: true;
  document: Document;
}
```

#### GET /api/ingest/status
```typescript
Query: {
  doc_id: string;
}
Response: {
  status: 'queued' | 'running' | 'done' | 'error';
  progress?: number;
  error_message?: string;
}
```

#### GET /api/documents
```typescript
Response: {
  documents: Document[];
}
```

#### DELETE /api/documents/:doc_id
```typescript
Response: {
  success: true;
}
```

### Chats

#### GET /api/chats
```typescript
Query: {
  document_id?: string;
}
Response: {
  chats: Chat[];
}
```

#### POST /api/chats
```typescript
Request: {
  document_id: string;
  title?: string;
}
Response: {
  chat: Chat;
}
```

#### GET /api/chats/:chat_id/messages
```typescript
Response: {
  messages: Array<{
    message: Message;
    citations: Citation[];
  }>;
}
```

#### DELETE /api/chats/:chat_id
```typescript
Response: {
  success: true;
}
```

### Q&A

#### POST /api/ask (SSE)
```typescript
Request: {
  chat_id: string;
  question: string;
}

SSE Events:
{
  type: 'token';
  content: string;
}
{
  type: 'citation';
  citation: Citation;
}
{
  type: 'done';
  message_id: string;
}
{
  type: 'error';
  error: string;
}
```

### Health

#### GET /api/healthz
```typescript
Response: {
  status: 'ok';
  version: string;
}
```

