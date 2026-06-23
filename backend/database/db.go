package database

import (
	"log"
	"os"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() {
	// Use DATABASE_PATH env var or fall back to nexus.db in the current directory
	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "nexus.db"
	}

	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Fatalf("❌ Failed to open SQLite database at %s: %v", dbPath, err)
	}

	// Enable WAL mode for better concurrent read performance
	DB.Exec("PRAGMA journal_mode=WAL")
	DB.Exec("PRAGMA foreign_keys=ON")

	// Migrate all schemas
	err = DB.AutoMigrate(
		&User{},
		&Message{},
		&MessageAttachment{},
		&Reaction{},
		&Group{},
		&GroupMember{},
		&OTP{},
		&Authenticator{},
		&WebAuthnSession{},
		&Friendship{},
		&UserSettings{},
		&Account{},
		&Transaction{},
		&BudgetGoal{},
		&PaymentMethod{},
	)
	if err != nil {
		log.Fatalf("❌ Failed to migrate database: %v", err)
	}

	log.Printf("✅ SQLite database connected (%s) and all tables migrated successfully", dbPath)
}
