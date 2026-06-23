import { useState, useRef, useEffect } from 'react';
import { X, Edit2, Check, Link as LinkIcon, Plus } from 'lucide-react';
import './UserProfile.css';

interface UserProfileProps {
  userId: number;
  username: string;
  avatar: string;
  bio: string;
  banner?: string;
  pronouns?: string;
  connections?: string; // JSON string
  isMe: boolean;
  onClose: () => void;
  onUpdate?: (updates: { avatar?: string; banner?: string; bio?: string; pronouns?: string; connections?: string }) => void;
}

interface Connection {
  id: string;
  url: string;
  platform: string;
  label: string;
}

const detectPlatform = (url: string) => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('github.com')) return 'github';
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter';
  if (lowerUrl.includes('linkedin.com')) return 'linkedin';
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('twitch.tv')) return 'twitch';
  if (lowerUrl.includes('discord.com') || lowerUrl.includes('discord.gg')) return 'discord';
  if (lowerUrl.includes('instagram.com')) return 'instagram';
  return 'website';
};

const getPlatformIcon = (platform: string) => {
  return <LinkIcon size={18} />;
};

const getPlatformColor = (platform: string) => {
  switch (platform) {
    case 'github': return '#333';
    case 'twitter': return '#1DA1F2';
    case 'linkedin': return '#0077B5';
    case 'youtube': return '#FF0000';
    case 'twitch': return '#9146FF';
    case 'discord': return '#5865F2';
    case 'instagram': return '#E1306C';
    default: return '#7289da';
  }
};

export default function UserProfile({ userId, username, avatar, bio, banner, pronouns, connections, isMe, onClose, onUpdate }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBanner, setEditBanner] = useState(banner || '');
  const [editAvatar, setEditAvatar] = useState(avatar || '');
  const [editBio, setEditBio] = useState(bio || '');
  const [editPronouns, setEditPronouns] = useState(pronouns || '');
  const [parsedConnections, setParsedConnections] = useState<Connection[]>([]);
  
  const [newConnectionUrl, setNewConnectionUrl] = useState('');
  const [showAddConnection, setShowAddConnection] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (connections) {
        setParsedConnections(JSON.parse(connections));
      }
    } catch {
      setParsedConnections([]);
    }
  }, [connections]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSave = () => {
    if (onUpdate) {
      onUpdate({
        banner: editBanner,
        avatar: editAvatar,
        bio: editBio,
        pronouns: editPronouns,
        connections: JSON.stringify(parsedConnections)
      });
    }
    setIsEditing(false);
  };

  const handleAddConnection = () => {
    if (!newConnectionUrl.trim()) return;
    let url = newConnectionUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    
    const platform = detectPlatform(url);
    const newConn: Connection = {
      id: Date.now().toString(),
      url,
      platform,
      label: platform.charAt(0).toUpperCase() + platform.slice(1)
    };

    setParsedConnections([...parsedConnections, newConn]);
    setNewConnectionUrl('');
    setShowAddConnection(false);
  };

  const removeConnection = (id: string) => {
    setParsedConnections(parsedConnections.filter(c => c.id !== id));
  };

  return (
    <div className="user-profile-popover" ref={modalRef}>
      <div className="up-banner" style={{ backgroundColor: editBanner ? 'transparent' : '#5865F2', backgroundImage: editBanner ? `url(${editBanner})` : 'none' }}>
        {isEditing && (
          <div className="up-banner-edit">
            <input type="text" placeholder="Banner Image URL" value={editBanner} onChange={e => setEditBanner(e.target.value)} />
          </div>
        )}
      </div>

      <div className="up-header">
        <div className="up-avatar-wrapper">
          <div className="up-avatar">
            {editAvatar ? <img src={editAvatar} alt="avatar" /> : username.charAt(0).toUpperCase()}
          </div>
          <div className="up-status-indicator online" />
          {isEditing && (
            <div className="up-avatar-edit">
              <input type="text" placeholder="Avatar URL" value={editAvatar} onChange={e => setEditAvatar(e.target.value)} />
            </div>
          )}
        </div>
        {!isEditing && isMe && (
          <button className="up-edit-btn" onClick={() => setIsEditing(true)}>
            <Edit2 size={14} style={{ marginRight: 6 }} /> Edit Profile
          </button>
        )}
        {isEditing && (
          <button className="up-edit-btn save" onClick={handleSave}>
            <Check size={14} style={{ marginRight: 6 }} /> Save
          </button>
        )}
      </div>

      <div className="up-content">
        <div className="up-username">
          {username}
        </div>
        
        {isEditing ? (
          <div className="up-field">
            <label>Pronouns</label>
            <input type="text" value={editPronouns} onChange={e => setEditPronouns(e.target.value)} placeholder="e.g., He/Him" />
          </div>
        ) : (
          editPronouns && <div className="up-pronouns">{editPronouns}</div>
        )}
        
        <div className="up-divider" />

        <div className="up-section">
          <div className="up-section-title">About Me</div>
          {isEditing ? (
            <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Tell us about yourself..." rows={3} />
          ) : (
            <div className="up-bio">{editBio || "No bio set."}</div>
          )}
        </div>

        <div className="up-section">
          <div className="up-section-title">Connections</div>
          <div className="up-connections-list">
            {parsedConnections.length === 0 && !isEditing && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No connections added.</div>
            )}
            {parsedConnections.map(conn => (
              <div key={conn.id} className="up-connection-item">
                <a href={conn.url} target="_blank" rel="noreferrer" className="up-connection-link" style={{ color: getPlatformColor(conn.platform) }}>
                  {getPlatformIcon(conn.platform)}
                  <span>{conn.label}</span>
                </a>
                {isEditing && (
                  <button className="up-connection-remove" onClick={() => removeConnection(conn.id)}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {isEditing && (
            <div className="up-add-connection">
              {showAddConnection ? (
                <div className="up-connection-input-row">
                  <input type="text" placeholder="Paste URL..." value={newConnectionUrl} onChange={e => setNewConnectionUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddConnection()} />
                  <button onClick={handleAddConnection} className="up-btn-small"><Check size={14} /></button>
                  <button onClick={() => setShowAddConnection(false)} className="up-btn-small danger"><X size={14} /></button>
                </div>
              ) : (
                <button className="up-add-conn-btn" onClick={() => setShowAddConnection(true)}>
                  <Plus size={14} style={{ marginRight: 4 }} /> Add Connection
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
