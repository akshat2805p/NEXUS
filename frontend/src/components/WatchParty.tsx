import { useState, useEffect, useRef } from 'react';
import { X, Maximize, Play, Pause, FastForward } from 'lucide-react';
import './WatchParty.css';

interface WatchPartyProps {
  roomId: string;
  ws: WebSocket | null;
  username: string;
  onClose: () => void;
  platform: 'youtube' | 'spotify' | 'netflix' | 'prime' | 'discord';
  onlineUsers: { id: number; username: string; status: string }[];
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const POPULAR_VIDEOS = [
  { id: 'jfKfPfyJRdk', title: 'lofi hip hop radio - beats to relax/study to', channel: 'Lofi Girl', thumb: 'https://img.youtube.com/vi/jfKfPfyJRdk/mqdefault.jpg' },
  { id: 'LXb3EKWsInQ', title: 'Costa Rica in 4K 60fps', channel: 'Jacob + Katie', thumb: 'https://img.youtube.com/vi/LXb3EKWsInQ/mqdefault.jpg' },
  { id: '2g811Eo7K8U', title: 'Chillout Music for Programming', channel: 'Chill Music', thumb: 'https://img.youtube.com/vi/2g811Eo7K8U/mqdefault.jpg' },
  { id: '9P6rdqiybaw', title: '10 Hours of Relaxing Ocean Waves', channel: 'Relaxation', thumb: 'https://img.youtube.com/vi/9P6rdqiybaw/mqdefault.jpg' },
  { id: '7NOSDKb0HlU', title: 'Beautiful Ambient Space Music', channel: 'Space Tunes', thumb: 'https://img.youtube.com/vi/7NOSDKb0HlU/mqdefault.jpg' },
  { id: 'M7lc1UVf-VE', title: 'YouTube Developers Live API', channel: 'Google', thumb: 'https://img.youtube.com/vi/M7lc1UVf-VE/mqdefault.jpg' },
];

export default function WatchParty({ roomId, ws, username, onClose, platform, onlineUsers }: WatchPartyProps) {
  const [videoId, setVideoId] = useState<string>(''); // Empty by default
  const [inputUrl, setInputUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);

  useEffect(() => {
    if (platform === 'youtube') setCurrentUrl(''); 
    else if (platform === 'spotify') setCurrentUrl('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M');
    else if (platform === 'netflix') setCurrentUrl('https://www.netflix.com/browse');
    else if (platform === 'prime') setCurrentUrl('https://www.primevideo.com/');
    else if (platform === 'discord') setCurrentUrl('https://discord.com/app');
  }, [platform]);

  useEffect(() => {
    if (platform === 'youtube' && videoId) {
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        
        window.onYouTubeIframeAPIReady = () => {
          playerRef.current = new window.YT.Player('yt-player', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: { autoplay: 1, controls: 1, disablekb: 0 },
            events: { onStateChange: onPlayerStateChange }
          });
        };
      } else if (!playerRef.current) {
        playerRef.current = new window.YT.Player('yt-player', {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: { autoplay: 1, controls: 1 },
          events: { onStateChange: onPlayerStateChange }
        });
      }
    }
  }, [platform, videoId]);

  // Handle incoming websocket sync events
  useEffect(() => {
    if (!ws) return;
    const handleMessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'watch_party_sync' && msg.roomId === roomId && msg.sender !== username) {
        if (!playerRef.current || !playerRef.current.seekTo) return;
        
        isSyncing.current = true;
        const state = msg.payload.state;
        const time = msg.payload.time;
        const newVideoId = msg.payload.videoId;

        if (newVideoId && newVideoId !== videoId) {
          setVideoId(newVideoId);
          playerRef.current.loadVideoById(newVideoId, time);
        } else {
          const currentTime = playerRef.current.getCurrentTime();
          if (Math.abs(currentTime - time) > 2) {
            playerRef.current.seekTo(time, true);
          }
          if (state === 'playing') playerRef.current.playVideo();
          if (state === 'paused') playerRef.current.pauseVideo();
        }
        
        setTimeout(() => { isSyncing.current = false; }, 1000);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, roomId, username, videoId]);

  const onPlayerStateChange = (event: any) => {
    if (isSyncing.current || !ws) return;
    let state = 'playing';
    if (event.data === window.YT.PlayerState.PAUSED) state = 'paused';
    if (event.data === window.YT.PlayerState.PLAYING) state = 'playing';
    
    if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.PLAYING) {
      ws.send(JSON.stringify({
        type: 'watch_party_sync',
        roomId,
        payload: { videoId, state, time: playerRef.current.getCurrentTime() }
      }));
    }
  };

  const handleSelectVideo = (vId: string) => {
    setVideoId(vId);
    if (playerRef.current && playerRef.current.loadVideoById) {
      playerRef.current.loadVideoById(vId);
    }
    if (ws) {
      ws.send(JSON.stringify({
        type: 'watch_party_sync',
        roomId,
        payload: { videoId: vId, state: 'playing', time: 0 }
      }));
    }
  };

  return (
    <div className="watch-party-overlay" ref={containerRef}>
      <div className="watch-party-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {platform === 'youtube' && <span className="wp-badge yt">YouTube Watch Party</span>}
          {platform === 'spotify' && <span className="wp-badge sp">Spotify Listen Party</span>}
          {platform === 'netflix' && <span className="wp-badge nf">Netflix Party (Extension Required)</span>}
          {platform === 'prime' && <span className="wp-badge pr">Prime Video Party (Extension Required)</span>}
          {platform === 'discord' && <span className="wp-badge dc">Discord Voice Sync</span>}
          <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>Synced with #{roomId}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="wp-btn-icon" onClick={() => {
            if (containerRef.current?.requestFullscreen) containerRef.current.requestFullscreen();
          }}><Maximize size={16} color="#FFFFFF" /></button>
          <button className="wp-btn-icon" onClick={onClose}><X size={16} color="#FFFFFF" /></button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="watch-party-content">
            {platform === 'youtube' ? (
              videoId ? (
                <div id="yt-player" className="video-player-wrapper"></div>
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#000', color: 'white', padding: 32, overflowY: 'auto' }}>
                  <h2 style={{ marginBottom: 24, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Play fill="white" /> Nexus Mini-YouTube
                  </h2>
                  <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 32 }}>
                    Browse our curated trending videos or paste any URL below to start the Watch Party instantly!
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
                    {POPULAR_VIDEOS.map(v => (
                      <div 
                        key={v.id} 
                        onClick={() => handleSelectVideo(v.id)}
                        style={{ cursor: 'pointer', background: '#111', borderRadius: 12, overflow: 'hidden', transition: 'transform 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <img src={v.thumb} alt={v.title} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
                        <div style={{ padding: 16 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.title}</div>
                          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{v.channel}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              currentUrl ? (
                <iframe 
                  src={currentUrl} 
                  className="video-player-wrapper" 
                  style={{ border: 'none', background: '#111', width: '100%', height: '100%' }}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
                />
              ) : null
            )}
          </div>

          <div className="watch-party-footer">
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              if (inputUrl) {
                if (platform === 'youtube') {
                  let vId = '';
                  if (inputUrl.includes('v=')) vId = inputUrl.split('v=')[1].split('&')[0];
                  else if (inputUrl.includes('youtu.be/')) vId = inputUrl.split('youtu.be/')[1].split('?')[0];
                  
                  if (vId) handleSelectVideo(vId);
                } else {
                  setCurrentUrl(inputUrl); 
                  if (ws) ws.send(JSON.stringify({ type: 'chat', roomId, content: `I just started sharing a ${platform} session: ${inputUrl}` }));
                }
                setInputUrl(''); 
              }
            }} style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 600 }}>
              <input 
                type="text" 
                placeholder={`Paste ${platform} URL...`}
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="wp-input"
              />
              <button type="submit" className="wp-btn-primary">Load</button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: 250, background: 'rgba(0,0,0,0.4)', borderLeft: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>
            Watching Together ({onlineUsers.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {onlineUsers.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.9rem', fontWeight: 600 }}>
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'white', fontWeight: 500 }}>{u.username}</div>
                  <div style={{ fontSize: '0.75rem', color: u.status === 'online' ? '#22c55e' : 'rgba(255,255,255,0.5)' }}>{u.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
