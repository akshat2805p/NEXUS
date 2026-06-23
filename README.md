<div align="center">

# 🌌 NEXUS

**A Next-Generation Real-Time Communication & Fintech Platform**

[![React](https://img.shields.io/badge/React-19-blue.svg?logo=react&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg?logo=typescript&logoColor=white)](#)
[![Go](https://img.shields.io/badge/Go-1.20+-00ADD8.svg?logo=go&logoColor=white)](#)
[![WebSockets](https://img.shields.io/badge/WebSockets-Realtime-orange.svg)](#)
[![Capacitor](https://img.shields.io/badge/Capacitor-Mobile-1199DA.svg?logo=capacitor&logoColor=white)](#)

Nexus is a beautifully designed, full-stack application built to seamlessly bridge the gap between instant messaging, peer-to-peer video calls, and financial tracking. Whether on the web or compiled as a native mobile app, Nexus delivers a premium, highly responsive user experience.

</div>

---

## ✨ Key Features

### 💬 Real-Time Communication
- **Lightning Fast Chat:** Instant messaging powered by Go WebSockets.
- **Voice & Video Calls:** Crystal-clear peer-to-peer WebRTC integration.
- **Media Uploads:** Send files and images seamlessly with AWS S3 integration.

### 🎭 Deep Personalization
- **Discord-style Profiles:** Fully customizable profiles with avatars, banners, and bios.
- **Smart Connections:** Link your GitHub, Twitter, Discord, and more—Nexus automatically detects the platform and renders the correct icons and colors.

### 🍿 Interactive Experiences
- **Watch Parties:** Sync your media viewing with friends across YouTube, Spotify, Netflix, and Prime Video.
- **Finance Hub:** Integrated financial tracking and metrics dashboard built right into your workspace.

### 🔐 Next-Gen Security
- **Passwordless Auth:** Secure magic links and email OTPs via Resend.
- **Biometrics (WebAuthn):** Support for modern device-level authentication.
- **Phone Verification:** SMS-based OTP verification via Twilio.

---

## 🛠️ Architecture & Tech Stack

<div align="center">
  
| **Frontend** | **Backend** | **Infrastructure** |
| :--- | :--- | :--- |
| React 19 | Go (Golang) | PostgreSQL / SQLite |
| TypeScript | GORM | Redis |
| Vite | WebSockets | AWS S3 |
| Capacitor (Mobile) | WebAuthn | Twilio & Resend |
| Lucide Icons | JWT Auth | Docker Ready |

</div>

---

## 🚀 Getting Started

### Prerequisites
Make sure you have **Node.js (v18+)** and **Go (v1.20+)** installed on your machine.

### 1. Clone the Repository
```bash
git clone https://github.com/akshat2805p/NEXUS.git
cd NEXUS
```

### 2. Launch the Backend
```bash
cd backend
# Make sure to copy .env.example to .env and add your keys
go run main.go
```

### 3. Launch the Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 📱 Mobile Deployment (iOS & Android)

Nexus is cross-platform ready. You can easily compile the web app into a native mobile application using Capacitor.

```bash
cd frontend
npm run build
npx cap add android   # or ios
npx cap sync
npx cap open android  # Opens Android Studio
```

---

<div align="center">

*Built with passion and modern web technologies.* <br>
**MIT License** • Nexus Team

</div>
