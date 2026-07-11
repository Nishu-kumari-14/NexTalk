# NexTalk

A full-stack real-time chat application supporting 1:1 and group messaging, built with Node.js, Express, MongoDB, Socket.IO, and React.

NexTalk started as a 1:1-only messenger and was later redesigned, on a live system, to support group chat — including a schema migration, message-routing overhaul, and accurate multi-recipient delivery/read-receipt tracking. See [Architecture Highlights](#architecture-highlights) below for details.

---

## Features

- **1:1 and group messaging** — unified conversation model, one code path for both
- **Real-time delivery via Socket.IO** — room-based message routing (`socket.to(roomId)`)
- **Accurate delivery/read receipts** — WhatsApp-style semantics: a message is only marked "seen" once **every** recipient has seen it, not just one (matters for groups)
- **Typing indicators** — scoped per-conversation, supports multiple simultaneous typers in a group
- **Contact system** — send/accept/reject contact requests, with conversations created eagerly on accept
- **Group chat** — create groups with multiple members, live real-time notification to online invitees, automatic catch-up for offline members on reconnect
- **Online presence** — real-time online/offline tracking
- **Persistent, ordered message history** — paginated message loading per conversation
- **Unread counts** — per-conversation, aggregated server-side

---

## Tech Stack

**Backend:** Node.js, Express, MongoDB (Mongoose), Socket.IO, JWT authentication
**Frontend:** React, Zustand (state management), React Router, Socket.IO client

---

## Architecture Highlights

A few things worth knowing if you're reading the code or discussing this project:

### Schema migration, done live, with zero downtime
The original data model used `sender`/`receiver` fields on each message — workable for 1:1 chat, structurally incapable of representing a group. Rather than bolt on a separate parallel system for groups, the entire message/conversation model was migrated to a unified `Conversation` entity (`type: "direct" | "group"`, `members: []`), using a **dual-write strategy**: new messages were written with both old and new fields simultaneously, a backfill script migrated historical data, and only once verification confirmed zero messages were missing the new schema did the application code cut over to using it exclusively. This meant no maintenance window and no risk of messages being lost mid-migration.

### Delivery and read-receipt correctness for groups
A naive port of 1:1 "seen" logic to group chat is a common source of subtle bugs — e.g., marking a message "seen" the moment *any* group member views the chat, even if only one of five members has actually looked at it. NexTalk tracks `deliveredTo`/`seenBy` as real per-message arrays and only surfaces the "seen" tick once **all** other conversation members are accounted for:
```
expectedRecipients = members.length - 1
seenCount    >= expectedRecipients → "seen"
deliveredCount >= expectedRecipients → "delivered"
otherwise → "sent"
```

### Message routing with membership verification
Messages route by `conversationId`, not by a client-supplied recipient identifier — the server verifies the sender is actually a member of that conversation before accepting the message, closing a gap that existed in the original design.

### Known limitation — worth being upfront about
The current system runs as a single Node instance with in-memory presence tracking. It is **not yet horizontally scalable** — introducing multiple instances would require moving presence/room state into a shared store (e.g., Redis) and adding a load balancer, since Socket.IO's room broadcasts are currently scoped to a single process's memory. This is a deliberate, understood boundary, not an oversight — see the project's migration log for the planned next-step architecture.

---

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB (local instance or MongoDB Atlas)

### Installation

Clone the repo:
```bash
git clone https://github.com/<your-username>/nextalk.git
cd nextalk
```

Install backend dependencies:
```bash
cd backend
npm install
```

Install frontend dependencies:
```bash
cd ../frontend
npm install
```

### Environment Variables

Create a `.env` file inside `backend/`:
```
PORT=8080
MONGO_URI=<your MongoDB connection string>
JWT_SECRET=<your JWT secret>
```

### Running locally

Start the backend:
```bash
cd backend
node server.js
```

Start the frontend:
```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173` (or whichever port Vite assigns), connecting to the backend at `http://localhost:8080`.

---

## Project Structure

```
nextalk/
├── backend/
│   ├── models/          # Mongoose schemas (User, Message, Conversation)
│   ├── routes/          # REST routes (auth, contacts, messages, groups)
│   ├── socket/           # Socket.IO connection + event handlers
│   ├── middleware/       # Auth middleware (REST + socket)
│   └── server.js
├── frontend/
│   └── src/
│       ├── components/   # UI components (Message, ConversationList, etc.)
│       ├── pages/        # HomePage, ChatPage, LoginPage
│       ├── store/        # Zustand stores (messages, contacts)
│       ├── context/      # OnlineUsers, Typing contexts
│       └── socket.js      # Socket.IO client instance
```

---

## Roadmap

- [ ] Horizontal scaling — Redis-backed shared state, multi-instance deployment, load balancing
- [ ] Load testing — baseline vs. scaled architecture, with real throughput/latency numbers
- [ ] Send-side message acknowledgment with retry and idempotency keys (currently, delivery to offline/reconnecting users is fully reliable; a live-but-momentarily-disconnected edge case during send is not yet covered)
- [ ] Group admin controls (add/remove members, promote admins)
- [ ] Per-member read-receipt detail view ("seen by 3 of 5")