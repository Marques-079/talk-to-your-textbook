#!/bin/bash
set -e

echo "🧪 Testing Retrieval Pipeline"
echo ""

BASE_URL="http://localhost:8000"

# Step 1: Login
echo "1️⃣  Authenticating..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Login failed"
    echo "$LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Authenticated successfully"
echo ""

# Step 2: Get documents
echo "2️⃣  Fetching documents..."
DOCS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/documents" \
  -H "Authorization: Bearer $TOKEN")

echo "$DOCS_RESPONSE" | python3 -m json.tool > /tmp/docs.json

DOC_ID=$(cat /tmp/docs.json | python3 -c "
import json, sys
docs = json.load(sys.stdin)
for doc in docs:
    if doc.get('status') == 'done':
        print(doc['id'])
        break
" 2>/dev/null || echo "")

if [ -z "$DOC_ID" ]; then
    echo "❌ No completed documents found"
    echo "Documents:"
    cat /tmp/docs.json
    exit 1
fi

echo "✅ Using document: $DOC_ID"
echo ""

# Step 3: Get or create chat
echo "3️⃣  Getting or creating chat..."
CHATS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/chats?document_id=$DOC_ID" \
  -H "Authorization: Bearer $TOKEN")

CHAT_ID=$(echo $CHATS_RESPONSE | python3 -c "
import json, sys
data = json.load(sys.stdin)
if isinstance(data, list) and len(data) > 0:
    print(data[0]['id'])
" 2>/dev/null || echo "")

if [ -z "$CHAT_ID" ]; then
    echo "Creating new chat..."
    CREATE_CHAT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/chats" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"document_id\":\"$DOC_ID\"}")
    
    CHAT_ID=$(echo $CREATE_CHAT_RESPONSE | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(data.get('id', ''))
" 2>/dev/null || echo "")
fi

if [ -z "$CHAT_ID" ]; then
    echo "❌ Failed to get or create chat"
    exit 1
fi

echo "✅ Using chat: $CHAT_ID"
echo ""

# Step 4: Ask a question
echo "4️⃣  Testing RAG + OpenAI pipeline..."
echo "   Question: 'What is this document about?'"
echo "   Streaming response:"
echo ""

curl -s -X POST "$BASE_URL/api/ask" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\":\"$CHAT_ID\",\"question\":\"What is this document about?\"}" > /tmp/ask_response.txt

# Display the response
cat /tmp/ask_response.txt | head -20
echo ""

# Check if there's an error in the response
if grep -q '"type":"error"' /tmp/ask_response.txt; then
    echo "❌ Error in response:"
    cat /tmp/ask_response.txt
    exit 1
fi

# Check if we got a successful response
HAS_TOKENS=$(grep -c 'type.*token' /tmp/ask_response.txt)
HAS_DONE=$(grep -c 'type.*done' /tmp/ask_response.txt)

if [ "$HAS_TOKENS" -gt 0 ] && [ "$HAS_DONE" -gt 0 ]; then
    echo ""
    echo "✅ RAG + OpenAI pipeline working!"
    echo "✅ Streaming response received successfully!"
    echo "✅ SQLAlchemy session error FIXED!"
    echo ""
    echo "============================================================"
    echo "🎉 RETRIEVAL PIPELINE TEST PASSED!"
    echo "============================================================"
    exit 0
else
    echo "❌ Incomplete response received (tokens: $HAS_TOKENS, done: $HAS_DONE)"
    exit 1
fi

