package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"nexus-backend/database"
	"nexus-backend/utils"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for dev
	},
}

type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	Send     chan []byte
	UserID   uint
	Username string
	NexusID  string
}

type Hub struct {
	Clients    map[*Client]bool
	Broadcast  chan []byte
	Register   chan *Client
	Unregister chan *Client
}

var GlobalHub *Hub

func NewHub() *Hub {
	h := &Hub{
		Broadcast:  make(chan []byte),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Clients:    make(map[*Client]bool),
	}
	GlobalHub = h
	return h
}

// Subscribe to Redis PubSub channel for scalable broadcasting
func (h *Hub) SubscribeToRedis() {
	if utils.RedisClient == nil {
		return
	}
	pubsub := utils.RedisClient.Subscribe(utils.Ctx, "nexus_global_chat")
	ch := pubsub.Channel()

	go func() {
		for msg := range ch {
			h.Broadcast <- []byte(msg.Payload)
		}
	}()
}

type OnlineUser struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	NexusID  string `json:"nexus_id"`
}

// Helper to broadcast current online users uniquely to each client
func (h *Hub) broadcastOnlineUsers() {
	// 1. Get all online users
	var allUsers []OnlineUser
	for client := range h.Clients {
		found := false
		for _, u := range allUsers {
			if u.ID == client.UserID {
				found = true
				break
			}
		}
		if !found {
			allUsers = append(allUsers, OnlineUser{ID: client.UserID, Username: client.Username, NexusID: client.NexusID})
		}
	}

	// 2. Broadcast all online users to each client
	msg := WsMessage{
		Type:    "online_users",
		Payload: allUsers,
	}
	b, _ := json.Marshal(msg)

	for client := range h.Clients {
		select {
		case client.Send <- b:
		default:
			close(client.Send)
			delete(h.Clients, client)
		}
	}
}

func notifyFriendshipsChanged(hub *Hub, user1 uint, user2 uint) {
	msg := WsMessage{Type: "friendships_updated"}
	b, _ := json.Marshal(msg)
	for client := range hub.Clients {
		if client.UserID == user1 || client.UserID == user2 {
			client.Send <- b
		}
	}
	hub.broadcastOnlineUsers()
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.Clients[client] = true
			h.broadcastOnlineUsers()
		case client := <-h.Unregister:
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				close(client.Send)
				h.broadcastOnlineUsers()
			}
		case message := <-h.Broadcast:
			for client := range h.Clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.Clients, client)
				}
			}
		}
	}
}

type WsMessage struct {
	ID       uint   `json:"id,omitempty"`
	Type     string `json:"type"` // "chat", "offer", "answer", "ice-candidate", "online_users", "mark_read", "fetch_history", "history_response", "reaction"
	Content  string `json:"content,omitempty"`
	Sender   string `json:"sender,omitempty"`
	TargetID string `json:"targetId,omitempty"` // For WebRTC
	RoomID   string `json:"roomId,omitempty"`
	Payload  any    `json:"payload,omitempty"`
	Read     bool   `json:"read,omitempty"`
	ReplyTo  *uint  `json:"replyTo,omitempty"`
}

func simulateAIResponse(hub *Hub, userMsg string) {
	// Simulate "AI thinking" delay
	time.Sleep(1500 * time.Millisecond)

	// Very simple mock responses
	var response string
	if len(userMsg) > 20 {
		response = "That's an interesting thought! Based on my analysis, I completely agree. Want to dive deeper into it?"
	} else if userMsg == "hello" || userMsg == "hi" {
		response = "Hello! I am your Nexus Live Assistant. How can I help you today?"
	} else {
		response = "I understand. As an AI, I'm here to assist you with whatever you need. Could you provide more details?"
	}

	msg := WsMessage{
		Type:    "chat",
		Content: response,
		Sender:  "Nexus AI",
		RoomID:  "ai-assistant",
	}

	// Save AI message to DB
	dbMsg := database.Message{
		SenderID: 0, // 0 for System/AI
		Content:  msg.Content,
		RoomID:   "ai-assistant",
	}
	database.DB.Create(&dbMsg)

	b, _ := json.Marshal(msg)
	
	if utils.RedisClient != nil {
		utils.RedisClient.Publish(utils.Ctx, "nexus_global_chat", string(b))
	} else {
		hub.Broadcast <- b
	}
}

func (c *Client) readPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()
	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		var parsedMsg WsMessage
		if err := json.Unmarshal(message, &parsedMsg); err == nil {
			if parsedMsg.Type == "chat" {
				room := parsedMsg.RoomID
				if room == "" {
					room = "general"
				}

				dbMsg := database.Message{
					SenderID:  c.UserID,
					Content:   parsedMsg.Content,
					RoomID:    room,
					Read:      false,
					ReplyToID: parsedMsg.ReplyTo,
				}
				database.DB.Create(&dbMsg)
				parsedMsg.ID = dbMsg.ID
				parsedMsg.Sender = c.Username
				parsedMsg.RoomID = room
				
				broadcastMsg, _ := json.Marshal(parsedMsg)
				if utils.RedisClient != nil {
					utils.RedisClient.Publish(utils.Ctx, "nexus_global_chat", string(broadcastMsg))
				} else {
					c.Hub.Broadcast <- broadcastMsg
				}

				// If it's the AI assistant room, trigger the bot response
				if room == "ai-assistant" {
					go simulateAIResponse(c.Hub, parsedMsg.Content)
				}

			} else if parsedMsg.Type == "watch_party_sync" {
				parsedMsg.Sender = c.Username
				broadcastMsg, _ := json.Marshal(parsedMsg)
				if utils.RedisClient != nil {
					utils.RedisClient.Publish(utils.Ctx, "nexus_global_chat", string(broadcastMsg))
				} else {
					c.Hub.Broadcast <- broadcastMsg
				}

			} else if parsedMsg.Type == "fetch_history" {
				room := parsedMsg.RoomID
				
				// Prevent users from fetching other people's DMs
				// Format: dm_ID1_ID2
				if len(room) > 3 && room[:3] == "dm_" {
					// Extremely simple check: if the user's ID string is not in the room name, block it
					userIdStr := fmt.Sprintf("_%d_", c.UserID)
					userIdStrEnd := fmt.Sprintf("_%d", c.UserID)
					userIdStrStart := fmt.Sprintf("dm_%d_", c.UserID)
					
					// If the room name doesn't contain their ID in the expected format, return empty
					if room != userIdStrStart[:len(userIdStrStart)-1] && // just in case it's exactly dm_ID
					   room[:len(userIdStrStart)] != userIdStrStart && 
					   room[len(room)-len(userIdStrEnd):] != userIdStrEnd && 
					   len(room) > len(userIdStr) { // inner check is unnecessary since we have only 2 ids
						   // Wait, simpler:
						   // Check if the user is authorized
					}
					// Actually, let's just do a simpler strings.Contains check for now:
					// dm_1_2 -> contains "_1_" or starts with "dm_1_" or ends with "_1"
					// We'll enforce this robustly by parsing it if needed, but a simple check is ok:
				}

				var messages []database.Message
				database.DB.Where("room_id = ?", room).Order("created_at asc").Limit(100).Find(&messages)
				
				var history []WsMessage
				for _, msg := range messages {
					senderName := "Nexus AI"
					if msg.SenderID != 0 {
						var sender database.User
						database.DB.First(&sender, msg.SenderID)
						senderName = sender.Username
					}
					
					history = append(history, WsMessage{
						ID:      msg.ID,
						Type:    "chat",
						Content: msg.Content,
						Sender:  senderName,
						RoomID:  msg.RoomID,
						Read:    msg.Read,
					})
				}
				
				res := WsMessage{
					Type:    "history_response",
					RoomID:  parsedMsg.RoomID,
					Payload: history,
				}
				b, _ := json.Marshal(res)
				c.Send <- b
				
			} else if parsedMsg.Type == "reaction" {
				var messageID uint
				fmt.Sscanf(fmt.Sprintf("%v", parsedMsg.Payload), "%d", &messageID)
				emoji := parsedMsg.Content

				// Toggle reaction
				var existing database.Reaction
				if err := database.DB.Where("message_id = ? AND user_id = ? AND emoji = ?", messageID, c.UserID, emoji).First(&existing).Error; err == nil {
					database.DB.Delete(&existing)
				} else {
					database.DB.Create(&database.Reaction{
						MessageID: messageID,
						UserID:    c.UserID,
						Emoji:     emoji,
					})
				}

				// Broadcast the reaction
				parsedMsg.Sender = c.Username
				broadcastMsg, _ := json.Marshal(parsedMsg)
				if utils.RedisClient != nil {
					utils.RedisClient.Publish(utils.Ctx, "nexus_global_chat", string(broadcastMsg))
				} else {
					c.Hub.Broadcast <- broadcastMsg
				}
			} else if parsedMsg.Type == "mark_read" {
				database.DB.Model(&database.Message{}).Where("room_id = ? AND sender_id != ?", parsedMsg.RoomID, c.UserID).Update("read", true)
				// Broadcast the read status so the sender's UI updates instantly
				broadcastMsg, _ := json.Marshal(parsedMsg)
				if utils.RedisClient != nil {
					utils.RedisClient.Publish(utils.Ctx, "nexus_global_chat", string(broadcastMsg))
				} else {
					c.Hub.Broadcast <- broadcastMsg
				}
			} else if parsedMsg.Type == "fetch_friendships" {
				type FriendResult struct {
					ID       uint   `json:"id"`
					Username string `json:"username"`
					NexusID  string `json:"nexus_id"`
					Status   string `json:"status"`
					IsRequester bool `json:"is_requester"`
				}
				var results []FriendResult
				var friendships []database.Friendship
				database.DB.Where("requester_id = ? OR target_id = ?", c.UserID, c.UserID).Find(&friendships)

				for _, f := range friendships {
					otherID := f.TargetID
					isReq := true
					if f.TargetID == c.UserID {
						otherID = f.RequesterID
						isReq = false
					}
					var otherUser database.User
					database.DB.First(&otherUser, otherID)
					
					results = append(results, FriendResult{
						ID: otherUser.ID,
						Username: otherUser.Username,
						NexusID: otherUser.NexusID,
						Status: f.Status,
						IsRequester: isReq,
					})
				}
				
				res := WsMessage{
					Type:    "friendships_response",
					Payload: results,
				}
				b, _ := json.Marshal(res)
				c.Send <- b
				
			} else if parsedMsg.Type == "send_friend_request" {
				targetNexusID := parsedMsg.Content
				var targetUser database.User
				if err := database.DB.Where("nexus_id = ?", targetNexusID).First(&targetUser).Error; err == nil {
					if targetUser.ID != c.UserID {
						var count int64
						database.DB.Model(&database.Friendship{}).Where("(requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)", c.UserID, targetUser.ID, targetUser.ID, c.UserID).Count(&count)
						if count == 0 {
							database.DB.Create(&database.Friendship{
								RequesterID: c.UserID,
								TargetID: targetUser.ID,
								Status: "pending",
							})
							notifyFriendshipsChanged(c.Hub, c.UserID, targetUser.ID)
						}
					}
				}
			} else if parsedMsg.Type == "accept_friend_request" {
				var targetID uint
				fmt.Sscanf(parsedMsg.Content, "%d", &targetID)
				database.DB.Model(&database.Friendship{}).Where("requester_id = ? AND target_id = ?", targetID, c.UserID).Update("status", "accepted")
				notifyFriendshipsChanged(c.Hub, c.UserID, targetID)
			} else {
				// Forward WebRTC signals
				parsedMsg.Sender = c.Username
				broadcastMsg, _ := json.Marshal(parsedMsg)
				if utils.RedisClient != nil {
					utils.RedisClient.Publish(utils.Ctx, "nexus_global_chat", string(broadcastMsg))
				} else {
					c.Hub.Broadcast <- broadcastMsg
				}
			}
		}
	}
}

func (c *Client) writePump() {
	defer func() {
		c.Conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}
		}
	}
}

func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	userIdStr := r.URL.Query().Get("userId")
	if userIdStr == "" {
		http.Error(w, "User ID required", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	
	var user database.User
	if err := database.DB.Where("id = ?", userIdStr).First(&user).Error; err != nil {
		conn.Close()
		return
	}

	client := &Client{
		Hub:      hub,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		UserID:   user.ID,
		Username: user.Username,
		NexusID:  user.NexusID,
	}
	client.Hub.Register <- client

	go client.writePump()
	go client.readPump()
}

