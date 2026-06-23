import { useState, useEffect } from 'react';
import SplashScreen from './components/SplashScreen';
import Auth from './components/Auth';
import ChatDashboard from './components/ChatDashboard';
import { initializeCapacitor } from './utils/capacitor';
import './App.css';

interface UserSession {
  username: string;
  userId: number;
  nexusId: string;
  phoneVerified: boolean;
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    initializeCapacitor();

    const token     = localStorage.getItem('nexus_token');
    const user      = localStorage.getItem('nexus_user');
    const userId    = localStorage.getItem('nexus_user_id');
    const nexusId   = localStorage.getItem('nexus_id');
    const phoneVer  = localStorage.getItem('nexus_phone_verified') === 'true';

    if (token && user && userId && nexusId) {
      setSession({
        username:      user,
        userId:        parseInt(userId, 10),
        nexusId,
        phoneVerified: phoneVer,
      });
    }
  }, []);

  const handleLogin = (username: string, userId: number, nexusId: string, phoneVerified: boolean) => {
    localStorage.setItem('nexus_phone_verified', phoneVerified.toString());
    setSession({ username, userId, nexusId, phoneVerified });
  };

  const handleLogout = () => {
    localStorage.clear();
    setSession(null);
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}

      {!showSplash && (
        session ? (
          // key={session.userId} forces a full remount when user changes → clean state
          <ChatDashboard
            key={session.userId}
            username={session.username}
            userId={session.userId}
            nexusId={session.nexusId}
            onLogout={handleLogout}
          />
        ) : (
          <Auth onLogin={handleLogin} />
        )
      )}
    </>
  );
}

export default App;
