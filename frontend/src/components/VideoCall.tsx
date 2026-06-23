import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, PhoneCall } from 'lucide-react';
import './VideoCall.css';

interface VideoCallProps {
  ws: WebSocket | null;
  incomingSignal: any;
  voiceOnly?: boolean;
  roomId: string;
  onClose: () => void;
}

const iceConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function VideoCall({ ws, incomingSignal, voiceOnly = false, onClose }: VideoCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(voiceOnly);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'receiving' | 'connected'>('idle');
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: !voiceOnly ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000
          },
        });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setCallStatus(incomingSignal?.type === 'offer' ? 'receiving' : 'idle');
      } catch {
        alert('Could not access camera/microphone');
        onClose();
      }
    };
    start();
    return () => {
      endCall(false);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!incomingSignal || !pcRef.current) return;
    const pc = pcRef.current;
    (async () => {
      if (incomingSignal.type === 'answer' && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal.payload));
        setCallStatus('connected');
        startTimer();
      } else if (incomingSignal.type === 'ice-candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(incomingSignal.payload));
      }
    })();
  }, [incomingSignal]);

  useEffect(() => {
    if (localStream && callStatus === 'idle' && !incomingSignal) {
      startCall();
    }
  }, [localStream, callStatus, incomingSignal]);

  const startTimer = () => {
    timerRef.current = window.setInterval(() => setCallDuration(d => d + 1), 1000);
  };

  const formatDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const createPC = () => {
    const pc = new RTCPeerConnection(iceConfig);
    localStream?.getTracks().forEach(t => pc.addTrack(t, localStream));
    pc.onicecandidate = e => {
      if (e.candidate && ws) ws.send(JSON.stringify({ type: 'ice-candidate', payload: e.candidate, roomId: incomingSignal?.roomId || roomId }));
    };
    pc.ontrack = e => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      setCallStatus('connected');
      startTimer();
    };
    return pc;
  };

  const startCall = async () => {
    if (!ws) return;
    setCallStatus('calling');
    const pc = createPC();
    pcRef.current = pc;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', payload: offer, roomId: incomingSignal?.roomId || roomId }));
  };

  const answerCall = async () => {
    if (!ws || !incomingSignal) return;
    const pc = createPC();
    pcRef.current = pc;
    await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal.payload));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: 'answer', payload: answer, roomId: incomingSignal.roomId || roomId }));
    setCallStatus('connected');
    startTimer();
  };

  const endCall = (notify = true) => {
    try {
      pcRef.current?.close();
    } catch (e) { }
    pcRef.current = null;

    try {
      localStream?.getTracks().forEach(t => t.stop());
    } catch (e) { }

    if (notify) {
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'hangup', roomId: incomingSignal?.roomId || roomId }));
        }
      } catch (e) {
        console.error('WebSocket send error:', e);
      }
      onClose();
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const at = localStream.getAudioTracks()[0];
      if (at) { at.enabled = !at.enabled; setIsMuted(!isMuted); }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const vt = localStream.getVideoTracks()[0];
      if (vt) { vt.enabled = !vt.enabled; setIsVideoOff(!isVideoOff); }
    }
  };

  return (
    <div className="video-call-overlay">
      <div className="video-call-header">
        <div className="vc-header-left">
          <div className="vc-status-dot" style={{ background: callStatus === 'connected' ? 'var(--success)' : '#E8A21A' }} />
          <span>{callStatus === 'connected' ? (voiceOnly ? 'Voice Call' : 'Video Call') : callStatus === 'calling' ? 'Calling...' : callStatus === 'receiving' ? 'Incoming call...' : voiceOnly ? 'Voice Call' : 'Video Call'}</span>
          {callStatus === 'connected' && <span className="vc-timer">{formatDuration(callDuration)}</span>}
        </div>
      </div>

      <div className="video-grid">
        <div className="video-container remote">
          <video ref={remoteVideoRef} autoPlay playsInline className="video-element" />
          {callStatus !== 'connected' && (
            <div className="video-placeholder">
              {callStatus === 'calling' && <div className="ringing-ring" />}
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem', marginTop: 16 }}>
                {callStatus === 'idle' && 'Press call to start'}
                {callStatus === 'calling' && 'Ringing...'}
                {callStatus === 'receiving' && `Incoming call from ${incomingSignal?.sender || 'someone'}`}
              </div>
            </div>
          )}
        </div>
        {!voiceOnly && (
          <div className="video-container local">
            <video ref={localVideoRef} autoPlay playsInline muted className="video-element" />
            <div className="video-label">You</div>
          </div>
        )}
        {voiceOnly && localStream && (
          <div className="voice-avatar">
            <div className="voice-avatar-ring" />
            <div className="voice-avatar-inner">🎙</div>
          </div>
        )}
      </div>

      <div className="call-controls">
        <button className={`ctrl-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        {!voiceOnly && (
          <button className={`ctrl-btn ${isVideoOff ? 'active' : ''}`} onClick={toggleVideo} title="Toggle camera">
            {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
        )}
        {callStatus === 'idle' && (
          <button className="ctrl-btn start" onClick={startCall} title="Start Call"><PhoneCall size={22} /></button>
        )}
        {callStatus === 'receiving' && (
          <button className="ctrl-btn start" onClick={answerCall} title="Answer"><PhoneCall size={22} /></button>
        )}
        <button className="ctrl-btn end" onClick={() => endCall(true)} title="End Call"><PhoneOff size={22} /></button>
      </div>
    </div>
  );
}
