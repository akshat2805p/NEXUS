# Nexus (DevRA)

Nexus is a full-stack, real-time messaging and fintech application built for seamless communication and modern integrations. It features real-time chat, video calls, a finance dashboard, watch parties, and fully customizable user profiles.

## 🚀 Features

- **Real-Time Chat & DMs**: Lightning-fast messaging powered by WebSockets.
- **Voice & Video Calls**: Peer-to-peer WebRTC integration for seamless communication.
- **Discord-style User Profiles**: Fully customizable profiles with avatars, banners, bios, pronouns, and auto-detecting social connections.
- **Finance Hub**: Integrated financial tracking and metrics dashboard.
- **Watch Parties**: Synchronized media viewing for platforms like YouTube, Spotify, Netflix, and Prime Video.
- **Modern Authentication**: Passwordless magic links, WebAuthn (biometrics), and phone verification.
- **File Uploads**: Direct S3 media uploads for sending files and images in chat.
- **Cross-Platform Ready**: Built with Capacitor for easy iOS and Android deployment.

## 🛠️ Tech Stack

**Frontend:**
- React 19 + TypeScript
- Vite
- Capacitor (for mobile builds)
- CSS (Custom modern styling)
- Lucide React (Icons)

**Backend:**
- Go (Golang)
- GORM (SQLite / PostgreSQL)
- WebSockets (gorilla/websocket)
- WebAuthn Server
- AWS S3 (for media)
- Redis

## 📦 Installation & Setup

### Prerequisites
- Node.js (v18+)
- Go (v1.20+)
- AWS Account (for S3 media uploads)

### 1. Clone the repository
```bash
git clone https://github.com/akshat2805p/DevRA.git
cd DevRA
```

### 2. Backend Setup
```bash
cd backend
# Rename .env.example to .env and fill in your credentials
go run main.go
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 📱 Mobile Build (Capacitor)
Nexus can be deployed as a native iOS or Android app.
```bash
cd frontend
npm run build
npx cap add android # or ios
npx cap sync
npx cap open android # Opens Android Studio
```

## 📄 License
MIT
