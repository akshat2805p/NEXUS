import { useEffect, useState } from 'react';
import { Hexagon } from 'lucide-react';
import './SplashScreen.css';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Show splash screen for 2.5 seconds total
    const timer = setTimeout(() => {
      setIsFadingOut(true);
      
      // Wait for fade out animation to finish before unmounting
      setTimeout(() => {
        onComplete();
      }, 800);
      
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`splash-container ${isFadingOut ? 'fade-out' : ''}`}>
      <div className="logo-wrapper">
        <div className="logo-icon">
          <Hexagon strokeWidth={2.5} />
        </div>
        <h1 className="logo-text">NEXUS</h1>
        <div className="loader-bar">
          <div className="loader-progress"></div>
        </div>
      </div>
    </div>
  );
}
