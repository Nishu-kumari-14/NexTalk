# NexTalk

A real-time chat application built with React, Node.js, Socket.IO, and MongoDB.

## Tech Stack

**Frontend:** React (Vite), Zustand, Socket.IO client, React Router  
**Backend:** Node.js, Express, Socket.IO, MongoDB (Mongoose)  
**Auth:** JWT, bcrypt  

## Features

- Real-time messaging with Socket.IO
- Online presence indicators
- Message delivery and seen status (✓ ✓✓ 🔵✓✓)
- Typing indicators
- Unread message counts
- In-app toast notifications
- Browser push notifications
- Contact management system
- Global state management with Zustand

## Architecture

- Single global socket connection with store-level listeners
- Zustand stores (useMessageStore, useContactStore) own all socket events
- UI components are purely reactive — zero socket interaction
- Local-first message buffering — messages stored in Zustand before rendering

## Setup

### Backend
cd backend
npm install
cp .env.example .env    # fill in your values
npm start

### Frontend
cd frontend
npm install
npm run dev