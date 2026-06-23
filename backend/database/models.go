package database

import (
	"time"
)

// User model - the database struct
type User struct {
	ID        uint `gorm:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time
	Email     string `gorm:"uniqueIndex"`
	Username  string
	NexusID   string `gorm:"uniqueIndex"`
	WebAuthnUID []byte
	FullName  string
	Avatar    string
	Bio       string
	Banner    string
	Pronouns  string
	Connections string `gorm:"type:text;default:'[]'"` // JSON array of social links
	IsVerified bool `gorm:"default:false"`
	IsOnline   bool `gorm:"default:false"`
	LastSeenAt *time.Time

	// Phone verification
	PhoneNumber   string
	PhoneVerified bool   `gorm:"default:false"`
	CountryCode   string `gorm:"default:+91"`
}

// UserSettings stores user preferences and settings
type UserSettings struct {
	ID        uint `gorm:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time
	UserID    uint  `gorm:"uniqueIndex"`
	User      *User `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`

	// Notification Settings
	NotificationsEnabled    bool `gorm:"default:true"`
	SoundEnabled            bool `gorm:"default:true"`
	DesktopNotifications    bool `gorm:"default:true"`
	EmailNotifications      bool `gorm:"default:false"`
	NewMessageNotifications bool `gorm:"default:true"`

	// Privacy Settings
	AllowDirectMessages bool   `gorm:"default:true"`
	ShowOnlineStatus    bool   `gorm:"default:true"`
	AllowFriendRequests bool   `gorm:"default:true"`
	IsProfilePublic     bool   `gorm:"default:true"`
	BlockedUsers        string // JSON array of user IDs

	// Theme & Display
	Theme      string `gorm:"default:light"` // light/dark
	Language   string `gorm:"default:en"`
	Timezone   string
	DateFormat string `gorm:"default:DD/MM/YYYY"`

	// Chat Settings
	MessageSoundEnabled bool `gorm:"default:true"`
	AutoDeleteMessages  bool `gorm:"default:false"`
	AutoDeleteAfterDays int  `gorm:"default:0"`

	// Fintech Settings
	TwoFactorEnabled     bool    `gorm:"default:false"`
	BiometricAuthEnabled bool    `gorm:"default:false"`
	CurrencyPreference   string  `gorm:"default:USD"`
	TransactionAlerts    bool    `gorm:"default:true"`
	LowBalanceAlert      bool    `gorm:"default:true"`
	LowBalanceThreshold  float64 `gorm:"default:100"`
}

// Message stores chat messages with user association
type Message struct {
	ID          uint `gorm:"primaryKey"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
	RoomID      string `gorm:"index"`
	SenderID    uint   `gorm:"index"`
	Sender      User   `gorm:"foreignKey:SenderID;references:ID;constraint:OnDelete:CASCADE"`
	Content     string `gorm:"type:text"`
	MessageType string `gorm:"default:text"` // text, image, file, etc.
	Read        bool   `gorm:"default:false"`
	DeletedAt   *time.Time
	EditedAt    *time.Time
	ReplyToID   *uint              `gorm:"index"`
	ReplyTo     *Message           `gorm:"foreignKey:ReplyToID;references:ID;constraint:OnDelete:SET NULL"`
	Attachments []MessageAttachment
	Reactions   []Reaction
}

// Reaction represents an emoji reaction to a message
type Reaction struct {
	ID        uint `gorm:"primaryKey"`
	CreatedAt time.Time
	MessageID uint `gorm:"index"`
	UserID    uint `gorm:"index"`
	Emoji     string
}

// Group represents a group chat
type Group struct {
	ID          uint `gorm:"primaryKey"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Name        string
	Description string `gorm:"type:text"`
	AvatarURL   string
	CreatedByID uint
	Members     []GroupMember
}

// GroupMember represents a user's membership in a group
type GroupMember struct {
	ID        uint `gorm:"primaryKey"`
	CreatedAt time.Time
	GroupID   uint   `gorm:"index"`
	UserID    uint   `gorm:"index"`
	Role      string `gorm:"default:member"` // admin, member
}

// MessageAttachment for storing file uploads
type MessageAttachment struct {
	ID        uint `gorm:"primaryKey"`
	CreatedAt time.Time
	MessageID uint `gorm:"index"`
	FileName  string
	FileURL   string
	FileSize  int64
	FileType  string
}

// Friendship manages friend relationships and requests
type Friendship struct {
	ID          uint `gorm:"primaryKey"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
	RequesterID uint   `gorm:"index"`
	Requester   User   `gorm:"foreignKey:RequesterID;references:ID;constraint:OnDelete:CASCADE"`
	TargetID    uint   `gorm:"index"`
	Target      User   `gorm:"foreignKey:TargetID;references:ID;constraint:OnDelete:CASCADE"`
	Status      string `gorm:"default:pending"` // pending, accepted, blocked
	RespondedAt *time.Time
}

// Authenticator stores WebAuthn public key credentials per user
type Authenticator struct {
	ID           uint `gorm:"primaryKey"`
	CreatedAt    time.Time
	UserID       uint   `gorm:"index"`
	User         User   `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`
	CredentialID []byte `gorm:"uniqueIndex"`
	PublicKey    []byte
	AAGUID       []byte
	SignCount    uint32
	CloneWarning bool
}

// OTP stores one-time passwords for authentication
type OTP struct {
	ID        uint `gorm:"primaryKey"`
	CreatedAt time.Time
	Email     string `gorm:"index"`
	Phone     string `gorm:"index"`
	Code      string
	Type      string `gorm:"default:email"` // email | phone
	ExpiresAt time.Time
	UsedAt    *time.Time
}

// WebAuthnSession is a temporary session store for WebAuthn ceremonies
type WebAuthnSession struct {
	ID        uint `gorm:"primaryKey"`
	CreatedAt time.Time
	Email     string `gorm:"index"`
	Challenge string
	ExpiresAt time.Time
}

// ============ FINTECH MODELS ============

// Account represents a financial account (bank account, wallet, etc.)
type Account struct {
	ID        uint `gorm:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time
	UserID    uint `gorm:"index"`
	User      User `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`

	AccountType   string  `gorm:"default:checking"` // checking, savings, investment, crypto
	AccountName   string
	AccountNumber string
	Balance       float64 `gorm:"default:0"`
	Currency      string  `gorm:"default:INR"`
	Provider      string  // bank name, payment processor, etc.
	IsActive      bool    `gorm:"default:true"`
	IsVerified    bool    `gorm:"default:false"`
}

// Transaction records financial transactions
type Transaction struct {
	ID        uint `gorm:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time
	UserID    uint    `gorm:"index"`
	User      User    `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`
	AccountID uint    `gorm:"index"`
	Account   Account `gorm:"foreignKey:AccountID;references:ID;constraint:OnDelete:SET NULL"`

	TransactionType string  `gorm:"index"` // transfer, payment, deposit, withdrawal
	Amount          float64
	Currency        string `gorm:"default:INR"`
	Description     string
	Status          string `gorm:"default:pending"` // pending, completed, failed, cancelled

	FromUserID *uint
	ToUserID   *uint

	Category string // bills, groceries, transport, etc.
	Tags     string // JSON array

	ReferenceNumber string `gorm:"uniqueIndex"`
	ReceiptURL      string

	CompletedAt   *time.Time
	FailureReason string
}

// BudgetGoal for expense tracking and budgeting
type BudgetGoal struct {
	ID        uint `gorm:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time
	UserID    uint `gorm:"index"`
	User      User `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`

	Category     string  `gorm:"index"`
	TargetAmount float64
	SpentAmount  float64 `gorm:"default:0"`
	Currency     string  `gorm:"default:INR"`

	StartDate      time.Time
	EndDate        time.Time
	Period         string // monthly, quarterly, yearly
	AlertThreshold int    // percentage
	IsActive       bool   `gorm:"default:true"`
}

// PaymentMethod stores payment details (cards, wallets, etc.)
type PaymentMethod struct {
	ID        uint `gorm:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time
	UserID    uint `gorm:"index"`
	User      User `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`

	MethodType    string `gorm:"index"` // credit_card, debit_card, paypal, crypto, etc.
	DisplayName   string
	TokenizedData string // encrypted token for card details

	IsDefault  bool `gorm:"default:false"`
	IsVerified bool `gorm:"default:false"`
	IsActive   bool `gorm:"default:true"`

	ExpiryDate *time.Time
	LastUsedAt *time.Time
}
