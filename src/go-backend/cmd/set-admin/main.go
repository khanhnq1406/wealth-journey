package main

import (
	"flag"
	"fmt"
	"log"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
)

func main() {
	email := flag.String("email", "", "Email of the user to set as admin")
	revoke := flag.Bool("revoke", false, "Revoke admin access instead of granting it")
	flag.Parse()

	if *email == "" {
		log.Fatal("Usage: set-admin -email=<user-email> [-revoke]")
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer func() { _ = db.Close() }()

	var user models.User
	if err := db.DB.Where("email = ?", *email).First(&user).Error; err != nil {
		log.Fatalf("User not found with email %q: %v", *email, err)
	}

	newValue := !*revoke

	if user.IsAdmin == newValue {
		if newValue {
			fmt.Printf("User %q (ID: %d) is already an admin.\n", user.Email, user.ID)
		} else {
			fmt.Printf("User %q (ID: %d) is already a non-admin.\n", user.Email, user.ID)
		}
		return
	}

	result := db.DB.Model(&user).Update("is_admin", newValue)
	if result.Error != nil {
		log.Fatalf("Failed to update user: %v", result.Error)
	}

	if newValue {
		fmt.Printf("Successfully granted admin access to %q (ID: %d)\n", user.Email, user.ID)
	} else {
		fmt.Printf("Successfully revoked admin access from %q (ID: %d)\n", user.Email, user.ID)
	}
}
