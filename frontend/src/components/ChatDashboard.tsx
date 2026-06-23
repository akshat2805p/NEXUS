import { useState, useEffect, useRef } from 'react';
import { Hexagon, Hash, Send, MessageSquare, Bot, Users, Video, Smile, Mic, Headphones, Settings, Check, CheckCheck, Phone, UserPlus, X, Search, TrendingUp, Plus } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import VideoCall from './VideoCall';
import SettingsModal from './SettingsModal';
import FinanceHub from './FinanceHub';
import WatchParty from './WatchParty';
import UserProfile from './UserProfile';
import './ChatDashboard.css';

interface ChatDashboardProps {
  username: string;
  userId: number;
  nexusId: string;
  onLogout: () => void;
}

interface Message {
  id?: number;
  type: string;
  content?: string;
  sender?: string;
  roomId?: string;
  payload?: any;
  read?: boolean;
  createdAt?: string;
  replyTo?: number;
  reactions?: { [emoji: string]: number };
}

interface OnlineUser {
  id: number;
  username: string;
}

interface Friend {
  id: number;
  username: string;
  nexus_id: string;
  email: string;
  phone_number: string;
  status: string;
  is_requester: boolean;
}

interface SearchResult {
  id: number;
  username: string;
  nexus_id: string;
  email: string;
  phone_number: string;
}

type ActiveView = 'chat' | 'friends' | 'finance';

export default function ChatDashboard({ username, userId, onLogout }: ChatDashboardProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [activeRoom, setActiveRoom] = useState('general');
  const [activeChatTitle, setActiveChatTitle] = useState('general');
  const [activeView, setActiveView] = useState<ActiveView>('chat');
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  // Watch Party
  const [watchPartyPlatform, setWatchPartyPlatform] = useState<'youtube' | 'spotify' | 'netflix' | 'prime' | 'discord' | null>(null);

  const [customChannels, setCustomChannels] = useState<{id: string, label: string}[]>(() => {
    const saved = localStorage.getItem('nexus_custom_channels');
    return saved ? JSON.parse(saved) : [];
  });

  const handleCreateChannel = () => {
    const name = prompt('Enter new channel name:');
    if (name && name.trim()) {
      const id = name.toLowerCase().replace(/\s+/g, '-');
      const newChannels = [...customChannels, { id, label: name }];
      setCustomChannels(newChannels);
      localStorage.setItem('nexus_custom_channels', JSON.stringify(newChannels));
      switchRoom(id, name);
    }
  };

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeMessageIdForReaction, setActiveMessageIdForReaction] = useState<number | null>(null);
  const [replyToMsg, setReplyToMsg] = useState<Message | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showChannelInvite, setShowChannelInvite] = useState(false);
  const [channelInvites, setChannelInvites] = useState<{roomId: string, roomName: string, inviter: string}[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [friendsTab, setFriendsTab] = useState<'online' | 'all' | 'pending'>('online');
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [incomingSignal, setIncomingSignal] = useState<any>(null);
  
  // Profile state
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [userProfileData, setUserProfileData] = useState<any>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('nexus_token') || '';

  const getDMRoomId = (id1: number, id2: number) => 'dm_' + [id1, id2].sort((a, b) => a - b).join('_');

  // Load friends and profile from API
  const loadFriends = async () => {
    try {
      const res = await fetch('/api/friends', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setFriends(await res.json());
    } catch {}
  };

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUserProfileData(await res.json());
    } catch {}
  };

  useEffect(() => {
    loadFriends();
    loadProfile();
  }, []);

  // WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws?userId=${userId}`);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'fetch_history', roomId: 'general' }));
    };

    socket.onmessage = (event) => {
      const msg: Message = JSON.parse(event.data);
      if (msg.type === 'online_users') { setOnlineUsers(msg.payload || []); return; }
      if (msg.type === 'history_response') {
        setMessages(prev => {
          const filtered = prev.filter(m => m.roomId !== msg.roomId);
          return [...filtered, ...(msg.payload || [])];
        });
        return;
      }
      if (msg.type === 'mark_read') {
        setMessages(prev => prev.map(m => m.roomId === msg.roomId ? { ...m, read: true } : m));
        return;
      }
      if (msg.type === 'friendships_updated') { loadFriends(); return; }
      if (msg.type === 'reaction') {
        setMessages(prev => prev.map(m => {
          if (m.id === msg.payload) {
            const reactions = { ...(m.reactions || {}) };
            reactions[msg.content!] = (reactions[msg.content!] || 0) + 1;
            return { ...m, reactions };
          }
          return m;
        }));
        return;
      }
      if (msg.type === 'channel_invite') {
        if (String(msg.payload) === String(userId)) {
          setChannelInvites(prev => {
            if (prev.some(i => i.roomId === msg.roomId)) return prev;
            return [...prev, { roomId: msg.roomId!, roomName: msg.content!, inviter: msg.sender! }];
          });
        }
        return;
      }
      if (msg.sender === username && msg.type !== 'chat') return;
      if (msg.type === 'chat') {
        setMessages(prev => [...prev, msg]);
        if (msg.roomId === activeRoom && msg.sender !== username) {
          socket.send(JSON.stringify({ type: 'mark_read', roomId: activeRoom }));
        }
      } else if (['offer', 'answer', 'ice-candidate', 'hangup'].includes(msg.type)) {
        if (msg.roomId && msg.roomId.startsWith('dm_') && !msg.roomId.includes(String(userId))) return;
        
        if (msg.type === 'hangup') {
          if (msg.roomId === activeRoom || msg.roomId.includes(String(userId))) {
            setIsVideoActive(false);
            setIncomingSignal(null);
          }
          return;
        }

        if (msg.type === 'offer') setIsVideoActive(true);
        setIncomingSignal(msg);
      }
    };

    setWs(socket);
    return () => socket.close();
  }, [username]);

  useEffect(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'fetch_history', roomId: activeRoom }));
      ws.send(JSON.stringify({ type: 'mark_read', roomId: activeRoom }));
    }
  }, [activeRoom, ws]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeRoom]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !ws) return;
    ws.send(JSON.stringify({ type: 'chat', roomId: activeRoom, content: inputValue, replyTo: replyToMsg?.id }));
    setInputValue('');
    setReplyToMsg(null);
    setShowEmojiPicker(false);
  };

  const handleReaction = (emoji: string, msgId: number) => {
    if (!ws) return;
    ws.send(JSON.stringify({ type: 'reaction', roomId: activeRoom, content: emoji, payload: msgId }));
    setActiveMessageIdForReaction(null);
  };

  const handleLogout = () => {
    localStorage.clear();
    if (ws) ws.close();
    onLogout();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !ws) return;
    
    setIsUploading(true);
    try {
      // Get Presigned URL
      const res = await fetch('/api/media/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name, contentType: file.type })
      });
      if (!res.ok) throw new Error('Failed to get upload URL');
      
      const { url, key } = await res.json();
      
      // Upload directly to S3
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });
      
      // Send message with media attachment
      const mediaUrl = `https://${process.env.AWS_S3_BUCKET || 'nexus-bucket'}.s3.amazonaws.com/${key}`;
      ws.send(JSON.stringify({ 
        type: 'chat', 
        roomId: activeRoom, 
        content: `[File: ${file.name}]`, // Or just the URL
        payload: { mediaUrl, mediaType: file.type }
      }));
    } catch (err) {
      alert('Upload failed. Please check AWS configuration.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Friend search
  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSearchResults(await res.json());
    } catch {} finally { setSearchLoading(false); }
  };

  const sendFriendRequest = async (targetId: number) => {
    try {
      await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target_id: targetId }),
      });
      setShowAddFriend(false);
      setSearchQuery('');
      setSearchResults([]);
      loadFriends();
    } catch {}
  };

  const inviteUser = async (email: string) => {
    if (!email.includes('@')) {
      alert('Please enter a valid email to invite.');
      return;
    }
    try {
      const res = await fetch('/api/friends/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        alert('Invitation sent successfully!');
        setShowAddFriend(false);
        setSearchQuery('');
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to send invite');
      }
    } catch {}
  };

  const respondFriend = async (requesterId: number, action: 'accept' | 'decline') => {
    await fetch('/api/friends/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ requester_id: requesterId, action }),
    });
    loadFriends();
  };

  const handleProfileUpdate = async (updates: any) => {
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        loadProfile();
      }
    } catch {}
  };

  const activeMessages = messages.filter(m => m.roomId === activeRoom);
  const otherOnline = onlineUsers.filter(u => u.id !== userId);
  const acceptedFriends = friends.filter(f => f.status === 'accepted');
  const pendingFriends = friends.filter(f => f.status === 'pending');
  const onlineFriendIds = new Set(onlineUsers.map(u => u.id));

  const switchRoom = (roomId: string, title: string) => {
    setActiveRoom(roomId);
    setActiveChatTitle(title);
    setActiveView('chat');
  };

  return (
    <div className="dashboard-container">
      {channelInvites.map((invite, idx) => (
        <div key={idx} style={{ position: 'fixed', bottom: 20 + idx*110, right: 20, zIndex: 1000, background: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: 12, boxShadow: 'var(--shadow-md)', border: '1.5px solid var(--accent-primary)', minWidth: 280 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            📥 Channel Invitation
          </div>
          <div style={{ fontSize: '0.9rem', marginBottom: 14, color: 'var(--text-secondary)' }}>
            <strong style={{color: 'var(--text-primary)'}}>{invite.inviter}</strong> invited you to join <strong style={{color: 'var(--text-primary)'}}>#{invite.roomName}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" style={{ flex: 1 }} onClick={() => {
              const newChannels = [...customChannels, { id: invite.roomId, label: invite.roomName }];
              setCustomChannels(newChannels);
              localStorage.setItem('nexus_custom_channels', JSON.stringify(newChannels));
              switchRoom(invite.roomId, invite.roomName);
              setChannelInvites(prev => prev.filter((_, i) => i !== idx));
            }}>Join Channel</button>
            <button className="primary" style={{ flex: 1, background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} onClick={() => setChannelInvites(prev => prev.filter((_, i) => i !== idx))}>Decline</button>
          </div>
        </div>
      ))}
      
      {showChannelInvite && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowChannelInvite(false)}>
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title">Invite to #{activeChatTitle}</div>
              <button onClick={() => setShowChannelInvite(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {onlineUsers.filter(u => u.id !== userId).map(u => (
                <div key={u.id} className="search-result">
                  <div className="search-result-info">
                    <div className="search-result-name">{u.username}</div>
                  </div>
                  <button className="primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => {
                    ws?.send(JSON.stringify({ type: 'channel_invite', roomId: activeRoom, content: activeChatTitle, payload: u.id }));
                    setShowChannelInvite(false);
                    alert(`Invitation sent to ${u.username}!`);
                  }}>Invite</button>
                </div>
              ))}
              {onlineUsers.filter(u => u.id !== userId).length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>No other users are currently online to invite.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {isVideoActive && (
        <VideoCall ws={ws} incomingSignal={incomingSignal} voiceOnly={isVoiceActive} roomId={activeRoom}
          onClose={() => { setIsVideoActive(false); setIsVoiceActive(false); setIncomingSignal(null); }} />
      )}
      {watchPartyPlatform && (
        <WatchParty 
          roomId={activeRoom} 
          ws={ws} 
          username={username} 
          platform={watchPartyPlatform}
          onlineUsers={onlineUsers}
          onClose={() => setWatchPartyPlatform(null)} 
        />
      )}
      {showSettings && (
        <SettingsModal username={username} email={localStorage.getItem('nexus_email') || ''}
          onClose={() => setShowSettings(false)} onLogout={handleLogout}
          onClearHistory={() => setMessages([])} 
          onStartWatchParty={(platform) => {
            setWatchPartyPlatform(platform);
            setShowSettings(false);
          }}
        />
      )}
      {showAddFriend && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddFriend(false)}>
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title">Add Friend</div>
              <button onClick={() => setShowAddFriend(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.87rem', color: 'var(--text-secondary)', marginBottom: 14 }}>Search by username, email, phone, or NexusID</p>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" placeholder="e.g. john@email.com or +919876..." value={searchQuery}
                onChange={e => handleSearch(e.target.value)} autoFocus
                style={{ paddingLeft: 36 }} />
            </div>
            {searchLoading && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>Searching...</p>}
            {searchResults.map(r => (
              <div key={r.id} className="search-result">
                <div className="avatar">{r.username.charAt(0)}</div>
                <div className="search-result-info">
                  <div className="search-result-name">{r.username}</div>
                  <div className="search-result-sub">{r.nexus_id} · {r.email}</div>
                </div>
                <button className="primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => sendFriendRequest(r.id)}>
                  <UserPlus size={14} /> Add
                </button>
              </div>
            ))}
            {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 12 }}>No users found on Nexus.</p>
                {searchQuery.includes('@') && (
                  <button className="primary" onClick={() => inviteUser(searchQuery)} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                    <Mail size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Invite via Email
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Server Sidebar */}
      <div className="server-sidebar">
        <div className={`server-icon ${activeView !== 'friends' && activeView !== 'finance' ? 'active' : ''}`}
          onClick={() => setActiveView('chat')} title="Chat">
          <Hexagon size={26} />
        </div>
        <div className="server-divider" />
        <div className={`server-icon ${activeView === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveView('friends')} title="Friends">
          <Users size={22} />
        </div>
        <div className={`server-icon ${activeView === 'finance' ? 'active' : ''}`}
          onClick={() => setActiveView('finance')} title="Finance Hub">
          <TrendingUp size={22} />
        </div>
      </div>

      {/* Channel Sidebar */}
      <div className="channel-sidebar">
        <div className="workspace-header">
          <Hexagon size={16} color="var(--accent-primary)" /> Nexus
        </div>
        <div className="channel-list">
          <div className="channel-category">
            Channels
            <span className="channel-category-add" onClick={handleCreateChannel} title="Create Channel"><Plus size={14} /></span>
          </div>
          {[{ id: 'general', label: 'general' }, { id: 'ai-assistant', label: 'ai-assistant' }, ...customChannels].map(ch => (
            <div key={ch.id} className={`channel-item ${activeRoom === ch.id && activeView === 'chat' ? 'active' : ''}`}
              onClick={() => switchRoom(ch.id, ch.label)}>
              {ch.id === 'ai-assistant' ? <Bot size={16} className="channel-icon" /> : <Hash size={16} className="channel-icon" />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.label}</span>
            </div>
          ))}

          <div className="channel-category">
            Direct Messages
            <span className="channel-category-add" onClick={() => setShowAddFriend(true)} title="Add Friend"><UserPlus size={14} /></span>
          </div>
          {acceptedFriends.map(f => {
            const roomId = getDMRoomId(userId, f.id);
            return (
              <div key={f.id} className={`channel-item ${activeRoom === roomId && activeView === 'chat' ? 'active' : ''}`}
                onClick={() => switchRoom(roomId, f.username)}>
                <div className="user-status-avatar" style={{ width: 18, height: 18, flexShrink: 0 }}>
                  <div className="avatar" style={{ width: 18, height: 18, fontSize: '0.55rem' }}>{f.username.charAt(0)}</div>
                  {onlineFriendIds.has(f.id) && <div className="status-indicator" style={{ width: 7, height: 7 }} />}
                </div>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.username}</span>
              </div>
            );
          })}
        </div>

        <div className="user-controls">
          <div className="user-controls-left" onClick={() => setShowUserProfile(!showUserProfile)} style={{ cursor: 'pointer' }}>
            <div className="user-status-avatar">
              <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.85rem', background: userProfileData.avatar ? 'transparent' : 'var(--accent-primary)', overflow: 'hidden' }}>
                {userProfileData.avatar ? <img src={userProfileData.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : username.charAt(0)}
              </div>
              <div className="status-indicator" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name">{username}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Online</div>
            </div>
          </div>
          <div className="user-controls-actions">
            <button title="Mute"><Mic size={16} /></button>
            <button title="Deafen"><Headphones size={16} /></button>
            <button title="Settings" onClick={() => setShowSettings(true)}><Settings size={16} /></button>
          </div>
          
          {showUserProfile && (
            <UserProfile
              userId={userId}
              username={username}
              avatar={userProfileData.avatar}
              bio={userProfileData.bio}
              banner={userProfileData.banner}
              pronouns={userProfileData.pronouns}
              connections={userProfileData.connections}
              isMe={true}
              onClose={() => setShowUserProfile(false)}
              onUpdate={handleProfileUpdate}
            />
          )}
        </div>
      </div>

      {/* Main Content */}
      {activeView === 'finance' ? (
        <FinanceHub />
      ) : activeView === 'friends' ? (
        <div className="friends-dashboard">
          <div className="friends-main">
            <div className="friends-header">
              <Users size={20} color="var(--text-muted)" />
              <span>Friends</span>
              <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }} />
              {(['online', 'all', 'pending'] as const).map(t => (
                <button key={t} className={`friends-tab ${friendsTab === t ? 'active' : ''}`} onClick={() => setFriendsTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}{t === 'pending' && pendingFriends.length > 0 ? ` (${pendingFriends.length})` : ''}
                </button>
              ))}
              <button className="friends-tab" style={{ marginLeft: 'auto', background: 'var(--accent-primary)', color: 'white' }}
                onClick={() => setShowAddFriend(true)}>
                Add Friend
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {friendsTab === 'online' && (
                otherOnline.length === 0 ? (
                  <div className="friends-empty-state"><Users size={40} opacity={0.3} /><p>No friends online right now.</p></div>
                ) : otherOnline.map(u => (
                  <div key={u.id} className="friend-row" onClick={() => { switchRoom(getDMRoomId(userId, u.id), u.username); }}>
                    <div className="user-status-avatar">
                      <div className="avatar">{u.username.charAt(0)}</div>
                      <div className="status-indicator" />
                    </div>
                    <div className="friend-info">
                      <div className="friend-name">{u.username}</div>
                      <div className="friend-sub">Online</div>
                    </div>
                    <div className="friend-actions">
                      <button className="friend-action-btn" title="Message" onClick={e => { e.stopPropagation(); switchRoom(getDMRoomId(userId, u.id), u.username); }}><MessageSquare size={16} /></button>
                      <button className="friend-action-btn" title="Voice Call" onClick={e => { e.stopPropagation(); setIsVoiceActive(true); setIsVideoActive(true); }}><Phone size={16} /></button>
                      <button className="friend-action-btn" title="Video Call" onClick={e => { e.stopPropagation(); setIsVideoActive(true); setIsVoiceActive(false); }}><Video size={16} /></button>
                    </div>
                  </div>
                ))
              )}
              {friendsTab === 'all' && (
                acceptedFriends.length === 0 ? (
                  <div className="friends-empty-state"><Users size={40} opacity={0.3} /><p>No friends yet. Add some!</p></div>
                ) : acceptedFriends.map(f => (
                  <div key={f.id} className="friend-row">
                    <div className="user-status-avatar">
                      <div className="avatar">{f.username.charAt(0)}</div>
                      {onlineFriendIds.has(f.id) && <div className="status-indicator" />}
                    </div>
                    <div className="friend-info">
                      <div className="friend-name">{f.username}</div>
                      <div className="friend-sub">{onlineFriendIds.has(f.id) ? 'Online' : 'Offline'}</div>
                    </div>
                    <div className="friend-actions">
                      <button className="friend-action-btn" title="Message" onClick={() => switchRoom(getDMRoomId(userId, f.id), f.username)}><MessageSquare size={16} /></button>
                    </div>
                  </div>
                ))
              )}
              {friendsTab === 'pending' && (
                pendingFriends.length === 0 ? (
                  <div className="friends-empty-state"><Users size={40} opacity={0.3} /><p>No pending requests.</p></div>
                ) : pendingFriends.map(f => (
                  <div key={f.id} className="friend-row">
                    <div className="avatar">{f.username.charAt(0)}</div>
                    <div className="friend-info">
                      <div className="friend-name">{f.username}</div>
                      <div className="friend-sub">{f.is_requester ? 'Outgoing request' : 'Incoming request'}</div>
                    </div>
                    {!f.is_requester && (
                      <div className="friend-actions">
                        <button className="friend-action-btn accept" title="Accept" onClick={() => respondFriend(f.id, 'accept')}><Check size={16} /></button>
                        <button className="friend-action-btn danger" title="Decline" onClick={() => respondFriend(f.id, 'decline')}><X size={16} /></button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="active-now-sidebar">
            <div className="active-now-header">Active Now</div>
            {otherOnline.length === 0 ? (
              <div className="active-now-card"><h3>It's quiet...</h3><p>When friends are active, you'll see them here.</p></div>
            ) : otherOnline.map(u => {
              const isFriend = acceptedFriends.some(f => f.id === u.id);
              const isPending = pendingFriends.some(f => f.id === u.id);
              return (
                <div key={u.id} className="active-now-card" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div className="avatar" style={{ width: 30, height: 30, fontSize: '0.78rem' }}>{u.username.charAt(0)}</div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{u.username}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Online</div></div>
                  {!isFriend && !isPending && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); sendFriendRequest(u.id); }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 4 }}
                      title="Add Friend"
                    >
                      <UserPlus size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="chat-area">
            <div className="chat-header">
              <div className="header-title">
                {activeRoom === 'ai-assistant' ? <Bot size={20} color="var(--accent-primary)" /> :
                 activeRoom.startsWith('dm_') ? <div className="avatar" style={{ width: 22, height: 22, fontSize: '0.65rem' }}>{activeChatTitle.charAt(0)}</div> :
                 <Hash size={20} color="var(--text-muted)" />}
                {activeChatTitle}
              </div>
              {activeRoom !== 'ai-assistant' && (
                <div className="header-actions">
                  <button className="header-action-btn" onClick={() => { setIsVoiceActive(true); setIsVideoActive(true); }}>
                    <Phone size={15} /> Voice Call
                  </button>
                  <button className="header-action-btn call-btn" onClick={() => { setIsVideoActive(true); setIsVoiceActive(false); }}>
                    <Video size={15} /> Video Call
                  </button>
                  {!activeRoom.startsWith('dm_') && (
                    <button className="header-action-btn" onClick={() => setShowChannelInvite(true)}>
                      <UserPlus size={15} /> Add Members
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="messages-container">
              {activeMessages.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60 }}>
                  {activeRoom === 'ai-assistant' ? (
                    <><Bot size={44} style={{ margin: '0 auto 12px', opacity: 0.5, display: 'block', color: 'var(--accent-primary)' }} />
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: 6 }}>Nexus AI Assistant</h3>
                    <p style={{ fontSize: '0.9rem' }}>Ask me anything!</p></>
                  ) : activeRoom.startsWith('dm_') ? (
                    <><div className="avatar" style={{ width: 60, height: 60, fontSize: '1.6rem', margin: '0 auto 12px' }}>{activeChatTitle.charAt(0)}</div>
                    <h3 style={{ color: 'var(--text-primary)' }}>{activeChatTitle}</h3>
                    <p style={{ fontSize: '0.88rem' }}>Start of your conversation</p></>
                  ) : (
                    <><Hash size={44} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                    <h3 style={{ color: 'var(--text-primary)' }}>Welcome to #{activeChatTitle}</h3>
                    <p style={{ fontSize: '0.88rem' }}>Start of the channel</p></>
                  )}
                </div>
              )}
              {activeMessages.map((msg, idx) => {
                const isAI = msg.sender === 'Nexus AI';
                const isMe = msg.sender === username;
                return (
                  <div key={idx} className="message-block" style={{ position: 'relative' }} 
                    onMouseEnter={(e) => { e.currentTarget.querySelector('.msg-actions')?.classList.remove('hidden'); }}
                    onMouseLeave={(e) => { e.currentTarget.querySelector('.msg-actions')?.classList.add('hidden'); }}>
                    
                    {msg.replyTo && (
                      <div style={{ paddingLeft: 40, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                        ↳ Replying to a message
                      </div>
                    )}

                    <div className={`message-avatar ${isAI ? 'ai' : ''}`}>
                      {isAI ? <Bot size={18} /> : msg.sender?.charAt(0).toUpperCase()}
                    </div>
                    <div className="message-content" style={{ flex: 1 }}>
                      <div className="message-meta">
                        <span className={`message-sender ${isAI ? 'ai' : ''}`}>{msg.sender}</span>
                        <span className="message-time">{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
                      </div>
                      <div className="message-text">
                        {msg.content}
                        {msg.payload?.mediaUrl && (
                          <div style={{ marginTop: 8 }}>
                            {msg.payload.mediaType?.startsWith('image/') ? (
                              <img src={msg.payload.mediaUrl} alt="attachment" style={{ maxWidth: 200, borderRadius: 8 }} />
                            ) : (
                              <a href={msg.payload.mediaUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>Download Attachment</a>
                            )}
                          </div>
                        )}
                        {isMe && activeRoom.startsWith('dm_') && (
                          <span className={`read-receipts ${msg.read ? 'read' : ''}`}>
                            {msg.read ? <CheckCheck size={14} /> : <Check size={14} />}
                          </span>
                        )}
                      </div>
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                          {Object.entries(msg.reactions).map(([emoji, count]) => (
                            <div key={emoji} style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 12, fontSize: '0.75rem' }}>
                              {emoji} {count as number}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Hover Actions */}
                    {!isAI && (
                      <div className="msg-actions hidden" style={{ position: 'absolute', right: 10, top: 10, display: 'flex', gap: 5, background: 'var(--bg-secondary)', padding: 4, borderRadius: 8 }}>
                        <button onClick={() => setActiveMessageIdForReaction(msg.id!)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} title="React"><Smile size={14}/></button>
                        <button onClick={() => setReplyToMsg(msg)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} title="Reply">↰</button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              {showEmojiPicker && (
                <div className="emoji-picker-container" ref={emojiPickerRef}>
                  <EmojiPicker onEmojiClick={e => {
                    if (activeMessageIdForReaction) {
                      handleReaction(e.emoji, activeMessageIdForReaction);
                      setShowEmojiPicker(false);
                    } else {
                      setInputValue(p => p + e.emoji);
                    }
                  }} theme={Theme.LIGHT} />
                </div>
              )}
              {replyToMsg && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, padding: '8px 12px', background: 'var(--bg-secondary)', borderTopLeftRadius: 8, borderTopRightRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Replying to <strong>{replyToMsg.sender}</strong>: {replyToMsg.content?.substring(0, 50)}...
                  </div>
                  <button onClick={() => setReplyToMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14}/></button>
                </div>
              )}
              <form className="input-wrapper" onSubmit={sendMessage}>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                <button type="button" className="action-btn" title="Upload Media" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <div style={{ transform: 'rotate(45deg)' }}>{isUploading ? '⏳' : '📎'}</div>
                </button>
                <button type="button" className="action-btn" onClick={() => { setActiveMessageIdForReaction(null); setShowEmojiPicker(!showEmojiPicker); }}>
                  <Smile size={20} />
                </button>
                <input type="text" className="chat-input"
                  placeholder={`Message ${activeRoom.startsWith('dm_') ? '@' : '#'}${activeChatTitle}`}
                  value={inputValue} onChange={e => setInputValue(e.target.value)} />
                <button type="submit" className="send-btn" disabled={!inputValue.trim()}>
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>

          <div className="right-sidebar">
            <div className="workspace-header" style={{ fontSize: '0.82rem' }}>
              <Users size={14} style={{ marginRight: 6 }} /> Online — {onlineUsers.length}
            </div>
            <div className="sidebar-content">
              {onlineUsers.map(u => {
                const isMe = u.id === userId;
                const isFriend = acceptedFriends.some(f => f.id === u.id);
                const isPending = pendingFriends.some(f => f.id === u.id);
                return (
                  <div key={u.id} className="user-item" onClick={() => !isMe && switchRoom(getDMRoomId(userId, u.id), u.username)} style={{ cursor: isMe ? 'default' : 'pointer' }}>
                    <div className="user-status-avatar">
                      <div className="avatar">{u.username.charAt(0)}</div>
                      <div className="status-indicator" />
                    </div>
                    <div className="user-item-name">{u.username}{isMe && " (You)"}</div>
                    {!isMe && !isFriend && !isPending && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); sendFriendRequest(u.id); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                        title="Add Friend"
                      >
                        <UserPlus size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {channelInvites.map((inv, idx) => (
        <div key={idx} style={{ position: 'fixed', bottom: 20 + idx * 110, right: 20, zIndex: 1000, background: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: 12, boxShadow: 'var(--shadow-md)', border: '1.5px solid var(--accent-primary)', minWidth: 280 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Hash size={16} color="var(--accent-primary)" /> Channel Invitation
          </h4>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <strong>{inv.inviter}</strong> invited you to join <strong>#{inv.roomName}</strong>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" style={{ flex: 1, padding: '6px' }} onClick={() => {
              if (!customChannels.some(c => c.id === inv.roomId)) {
                setCustomChannels(prev => [...prev, { id: inv.roomId, label: inv.roomName }]);
              }
              setChannelInvites(prev => prev.filter((_, i) => i !== idx));
              switchRoom(inv.roomId, inv.roomName);
            }}>Join</button>
            <button className="secondary" style={{ flex: 1, padding: '6px' }} onClick={() => setChannelInvites(prev => prev.filter((_, i) => i !== idx))}>Decline</button>
          </div>
        </div>
      ))}
    </div>
  );
}
