package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	"gorm.io/gorm"
	gorm_logger "gorm.io/gorm/logger"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"

	v1 "wealthjourney/protobuf/v1"
)

func main() {
	// Parse command line flags
	dryRun := flag.Bool("dry-run", false, "Print what would be done without making changes")
	flag.Parse()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer func() { _ = db.Close() }()

	// Disable logging for dry-run mode for faster execution
	if *dryRun {
		db.DB = db.DB.Session(&gorm.Session{Logger: gorm_logger.Default.LogMode(gorm_logger.Silent)})
	}

	ctx := context.Background()

	// Auto-migrate tables
	if *dryRun {
		fmt.Println("DRY RUN MODE - No changes will be made")
		fmt.Println("\nWould create tables:")
		fmt.Println("- merchant_category_rule")
		fmt.Println("- user_category_mapping")
		fmt.Println("- category_keyword")
	} else {
		fmt.Println("Creating tables...")
		if err := db.DB.AutoMigrate(
			&models.MerchantCategoryRule{},
			&models.UserCategoryMapping{},
			&models.CategoryKeyword{},
		); err != nil {
			log.Fatalf("Failed to migrate tables: %v", err)
		}
		fmt.Println("✓ Tables created successfully")
	}

	if *dryRun {
		// In dry-run mode, use mock category IDs
		mockCategoryMap := map[string]int32{
			"Food and Beverage": 1,
			"Transportation":    2,
			"Shopping":          3,
			"Entertainment":     4,
			"Health & Fitness":  5,
			"Bills & Utilities": 6,
			"Education":         7,
			"Salary":            8,
		}

		fmt.Printf("\nWould seed %d merchant rules\n", len(getMerchantRules(mockCategoryMap)))
		fmt.Printf("Would seed %d category keywords\n", len(getCategoryKeywords(mockCategoryMap)))
		fmt.Println("\nSample merchant rules:")
		for i, rule := range getMerchantRules(mockCategoryMap)[:5] {
			fmt.Printf("%d. %s -> Category %d (confidence: %d%%)\n", i+1, rule.MerchantPattern, rule.CategoryID, rule.Confidence)
		}
		fmt.Println("\nSample keywords:")
		for i, kw := range getCategoryKeywords(mockCategoryMap)[:5] {
			fmt.Printf("%d. %s (%s) -> Category %d (confidence: %d%%)\n", i+1, kw.Keyword, kw.Language, kw.CategoryID, kw.Confidence)
		}
		os.Exit(0)
	}

	// Create repositories
	merchantRepo := repository.NewMerchantRuleRepository(db)
	keywordRepo := repository.NewKeywordRepository(db)
	categoryRepo := repository.NewCategoryRepository(db)

	// Get first user with categories for seeding
	// Try users 9, 10 first (existing users with categories), fallback to user 1
	var firstUserID int32
	for _, uid := range []int32{10, 9, 1} {
		count, err := categoryRepo.CountByUserID(ctx, uid)
		if err == nil && count > 0 {
			firstUserID = uid
			fmt.Printf("Using user %d (has %d categories)\n", uid, count)
			break
		}
	}

	if firstUserID == 0 {
		log.Fatalf("No users with categories found. Please create default categories first using migrate-default-categories")
	}

	// Get categories for mapping (we need actual category IDs from database)
	categoryMap, err := getCategoryMapping(ctx, categoryRepo, firstUserID)
	if err != nil {
		log.Fatalf("Failed to get categories: %v", err)
	}

	// Seed merchant rules
	fmt.Println("\nSeeding merchant rules...")
	merchantRules := getMerchantRules(categoryMap)
	for _, rule := range merchantRules {
		if err := merchantRepo.Create(ctx, rule); err != nil {
			fmt.Printf("Warning: Failed to create merchant rule '%s': %v\n", rule.MerchantPattern, err)
		}
	}
	fmt.Printf("✓ Seeded %d merchant rules\n", len(merchantRules))

	// Seed category keywords
	fmt.Println("\nSeeding category keywords...")
	keywords := getCategoryKeywords(categoryMap)
	if err := keywordRepo.BulkCreate(ctx, keywords); err != nil {
		log.Fatalf("Failed to seed keywords: %v", err)
	}
	fmt.Printf("✓ Seeded %d category keywords\n", len(keywords))

	fmt.Println("\n✅ Migration completed successfully!")
	fmt.Println("\nNext steps:")
	fmt.Println("1. Verify data: SELECT COUNT(*) FROM merchant_category_rule;")
	fmt.Println("2. Verify data: SELECT COUNT(*) FROM category_keyword;")
	fmt.Println("3. Test categorization with sample transactions")
}

// getCategoryMapping retrieves category IDs by name for a user
func getCategoryMapping(ctx context.Context, categoryRepo repository.CategoryRepository, userID int32) (map[string]int32, error) {
	categoryMap := make(map[string]int32)

	// Get expense categories
	expenseType := v1.CategoryType_CATEGORY_TYPE_EXPENSE
	expenses, _, err := categoryRepo.ListByUserID(ctx, userID, &expenseType, repository.ListOptions{Limit: 100})
	if err != nil {
		return nil, fmt.Errorf("failed to list expense categories: %w", err)
	}

	for _, cat := range expenses {
		categoryMap[cat.Name] = cat.ID
	}

	// Get income categories
	incomeType := v1.CategoryType_CATEGORY_TYPE_INCOME
	incomes, _, err := categoryRepo.ListByUserID(ctx, userID, &incomeType, repository.ListOptions{Limit: 100})
	if err != nil {
		return nil, fmt.Errorf("failed to list income categories: %w", err)
	}

	for _, cat := range incomes {
		categoryMap[cat.Name] = cat.ID
	}

	if len(categoryMap) == 0 {
		return nil, fmt.Errorf("no categories found for user %d. Please create default categories first", userID)
	}

	return categoryMap, nil
}

// getMerchantRules returns merchant categorization rules
func getMerchantRules(categoryMap map[string]int32) []*models.MerchantCategoryRule {
	rules := []*models.MerchantCategoryRule{}

	// Coffee shops - Food and Beverage
	if catID, ok := categoryMap["Food and Beverage"]; ok {
		coffeeShops := []string{
			"Highlands Coffee", "Starbucks", "The Coffee House", "Phuc Long",
			"Cong Caphe", "Trung Nguyen", "Passio Coffee", "Urban Station",
			"Cafe Amazon", "Milano Coffee", "Kafe", "Cong Ca Phe",
		}
		for _, shop := range coffeeShops {
			rules = append(rules, &models.MerchantCategoryRule{
				MerchantPattern: shop,
				MatchType:       models.MatchTypeContains,
				CategoryID:      catID,
				Confidence:      100,
				Region:          "VN",
				IsActive:        true,
			})
		}
	}

	// Transportation - Transportation
	if catID, ok := categoryMap["Transportation"]; ok {
		transport := []string{
			"Grab", "Be", "Gojek", "Xanh SM", "Mai Linh", "Vinasun",
			"Grabbike", "Grabcar", "Grabfood", "Befood", "Becar", "Bebike",
		}
		for _, service := range transport {
			rules = append(rules, &models.MerchantCategoryRule{
				MerchantPattern: service,
				MatchType:       models.MatchTypeContains,
				CategoryID:      catID,
				Confidence:      100,
				Region:          "VN",
				IsActive:        true,
			})
		}
	}

	// Convenience stores - Shopping
	if catID, ok := categoryMap["Shopping"]; ok {
		stores := []string{
			"Circle K", "Ministop", "GS25", "Family Mart", "B's Mart",
			"7-Eleven", "Shop&Go", "VinMart+",
		}
		for _, store := range stores {
			rules = append(rules, &models.MerchantCategoryRule{
				MerchantPattern: store,
				MatchType:       models.MatchTypeContains,
				CategoryID:      catID,
				Confidence:      100,
				Region:          "VN",
				IsActive:        true,
			})
		}
	}

	// Supermarkets - Shopping
	if catID, ok := categoryMap["Shopping"]; ok {
		supermarkets := []string{
			"VinMart", "Co.opmart", "Lotte Mart", "Big C", "Aeon", "Mega Market",
			"Emart", "Tops Market", "Satra", "Maximark",
		}
		for _, market := range supermarkets {
			rules = append(rules, &models.MerchantCategoryRule{
				MerchantPattern: market,
				MatchType:       models.MatchTypeContains,
				CategoryID:      catID,
				Confidence:      100,
				Region:          "VN",
				IsActive:        true,
			})
		}
	}

	// E-commerce - Shopping
	if catID, ok := categoryMap["Shopping"]; ok {
		ecommerce := []string{
			"Shopee", "Lazada", "Tiki", "Sendo", "FPT Shop",
			"The Gioi Di Dong", "Dien May Xanh", "CellphoneS", "Nguyen Kim",
		}
		for _, site := range ecommerce {
			rules = append(rules, &models.MerchantCategoryRule{
				MerchantPattern: site,
				MatchType:       models.MatchTypeContains,
				CategoryID:      catID,
				Confidence:      100,
				Region:          "VN",
				IsActive:        true,
			})
		}
	}

	// Fast food - Food and Beverage
	if catID, ok := categoryMap["Food and Beverage"]; ok {
		fastFood := []string{
			"KFC", "Lotteria", "Jollibee", "Pizza Hut", "Domino's",
			"McDonald's", "Burger King", "Popeyes", "Texas Chicken",
		}
		for _, restaurant := range fastFood {
			rules = append(rules, &models.MerchantCategoryRule{
				MerchantPattern: restaurant,
				MatchType:       models.MatchTypeContains,
				CategoryID:      catID,
				Confidence:      100,
				Region:          "VN",
				IsActive:        true,
			})
		}
	}

	// Entertainment - Entertainment
	if catID, ok := categoryMap["Entertainment"]; ok {
		entertainment := []string{
			"CGV", "Galaxy Cinema", "Lotte Cinema", "BHD Star",
			"Netflix", "Spotify", "YouTube Premium",
		}
		for _, venue := range entertainment {
			rules = append(rules, &models.MerchantCategoryRule{
				MerchantPattern: venue,
				MatchType:       models.MatchTypeContains,
				CategoryID:      catID,
				Confidence:      100,
				Region:          "VN",
				IsActive:        true,
			})
		}
	}

	// Healthcare - Health & Fitness
	if catID, ok := categoryMap["Health & Fitness"]; ok {
		healthcare := []string{
			"Phong Kham", "Benh Vien", "Hospital", "Pharmacy", "Nha Thuoc",
			"Guardian", "Pharmacity", "Medicare", "California Fitness",
			"Gym", "Yoga", "Fitness",
		}
		for _, service := range healthcare {
			rules = append(rules, &models.MerchantCategoryRule{
				MerchantPattern: service,
				MatchType:       models.MatchTypeContains,
				CategoryID:      catID,
				Confidence:      100,
				Region:          "VN",
				IsActive:        true,
			})
		}
	}

	// Utilities - Bills & Utilities
	if catID, ok := categoryMap["Bills & Utilities"]; ok {
		utilities := []string{
			"EVN HCM", "EVN", "Sawaco", "VNPT", "Viettel", "FPT Telecom",
			"MobiFone", "VinaPhone", "Dien Luc", "Cap Nuoc",
		}
		for _, utility := range utilities {
			rules = append(rules, &models.MerchantCategoryRule{
				MerchantPattern: utility,
				MatchType:       models.MatchTypeContains,
				CategoryID:      catID,
				Confidence:      100,
				Region:          "VN",
				IsActive:        true,
			})
		}
	}

	return rules
}

// getCategoryKeywords returns category keywords in Vietnamese and English
func getCategoryKeywords(categoryMap map[string]int32) []*models.CategoryKeyword {
	keywords := []*models.CategoryKeyword{}

	// Food and Beverage keywords
	if catID, ok := categoryMap["Food and Beverage"]; ok {
		foodKeywords := map[string]models.Language{
			// Vietnamese
			"ca phe":     models.LanguageVietnamese,
			"com":        models.LanguageVietnamese,
			"pho":        models.LanguageVietnamese,
			"bun":        models.LanguageVietnamese,
			"banh mi":    models.LanguageVietnamese,
			"quan an":    models.LanguageVietnamese,
			"nha hang":   models.LanguageVietnamese,
			"an sang":    models.LanguageVietnamese,
			"an trua":    models.LanguageVietnamese,
			"an toi":     models.LanguageVietnamese,
			"do uong":    models.LanguageVietnamese,
			"tra sua":    models.LanguageVietnamese,
			// English
			"coffee":     models.LanguageEnglish,
			"cafe":       models.LanguageEnglish,
			"restaurant": models.LanguageEnglish,
			"food":       models.LanguageEnglish,
			"drink":      models.LanguageEnglish,
			"breakfast":  models.LanguageEnglish,
			"lunch":      models.LanguageEnglish,
			"dinner":     models.LanguageEnglish,
			"meal":       models.LanguageEnglish,
			"pizza":      models.LanguageEnglish,
			"burger":     models.LanguageEnglish,
		}
		for kw, lang := range foodKeywords {
			confidence := int32(80)
			if lang == models.LanguageVietnamese {
				confidence = 85
			}
			keywords = append(keywords, &models.CategoryKeyword{
				CategoryID: catID,
				Keyword:    kw,
				Language:   lang,
				Confidence: confidence,
				IsActive:   true,
			})
		}
	}

	// Transportation keywords
	if catID, ok := categoryMap["Transportation"]; ok {
		transportKeywords := map[string]models.Language{
			// Vietnamese
			"xe":        models.LanguageVietnamese,
			"taxi":      models.LanguageVietnamese,
			"xe om":     models.LanguageVietnamese,
			"xe buyt":   models.LanguageVietnamese,
			"xe may":    models.LanguageVietnamese,
			"dau xe":    models.LanguageVietnamese,
			"xang":      models.LanguageVietnamese,
			"parkingtruc": models.LanguageVietnamese,
			// English
			"ride":      models.LanguageEnglish,
			"transport": models.LanguageEnglish,
			"fuel":      models.LanguageEnglish,
			"gas":       models.LanguageEnglish,
			"parking":   models.LanguageEnglish,
			"toll":      models.LanguageEnglish,
			"bus":       models.LanguageEnglish,
			"metro":     models.LanguageEnglish,
		}
		for kw, lang := range transportKeywords {
			confidence := int32(75)
			if lang == models.LanguageVietnamese {
				confidence = 80
			}
			keywords = append(keywords, &models.CategoryKeyword{
				CategoryID: catID,
				Keyword:    kw,
				Language:   lang,
				Confidence: confidence,
				IsActive:   true,
			})
		}
	}

	// Shopping keywords
	if catID, ok := categoryMap["Shopping"]; ok {
		shoppingKeywords := map[string]models.Language{
			// Vietnamese
			"mua":        models.LanguageVietnamese,
			"mua sam":    models.LanguageVietnamese,
			"sieu thi":   models.LanguageVietnamese,
			"cua hang":   models.LanguageVietnamese,
			"shop":       models.LanguageVietnamese,
			"quan ao":    models.LanguageVietnamese,
			"giay dep":   models.LanguageVietnamese,
			// English
			"shopping":   models.LanguageEnglish,
			"store":      models.LanguageEnglish,
			"market":     models.LanguageEnglish,
			"mall":       models.LanguageEnglish,
			"clothes":    models.LanguageEnglish,
			"shoes":      models.LanguageEnglish,
			"electronics": models.LanguageEnglish,
			"purchase":   models.LanguageEnglish,
		}
		for kw, lang := range shoppingKeywords {
			confidence := int32(75)
			if lang == models.LanguageVietnamese {
				confidence = 80
			}
			keywords = append(keywords, &models.CategoryKeyword{
				CategoryID: catID,
				Keyword:    kw,
				Language:   lang,
				Confidence: confidence,
				IsActive:   true,
			})
		}
	}

	// Entertainment keywords
	if catID, ok := categoryMap["Entertainment"]; ok {
		entertainmentKeywords := map[string]models.Language{
			// Vietnamese
			"phim":       models.LanguageVietnamese,
			"rap":        models.LanguageVietnamese,
			"xem phim":   models.LanguageVietnamese,
			"game":       models.LanguageVietnamese,
			"karaoke":    models.LanguageVietnamese,
			// English
			"movie":      models.LanguageEnglish,
			"cinema":     models.LanguageEnglish,
			"film":       models.LanguageEnglish,
			"concert":    models.LanguageEnglish,
			"ticket":     models.LanguageEnglish,
			"streaming":  models.LanguageEnglish,
		}
		for kw, lang := range entertainmentKeywords {
			confidence := int32(75)
			if lang == models.LanguageVietnamese {
				confidence = 80
			}
			keywords = append(keywords, &models.CategoryKeyword{
				CategoryID: catID,
				Keyword:    kw,
				Language:   lang,
				Confidence: confidence,
				IsActive:   true,
			})
		}
	}

	// Health & Fitness keywords
	if catID, ok := categoryMap["Health & Fitness"]; ok {
		healthKeywords := map[string]models.Language{
			// Vietnamese
			"benh vien":  models.LanguageVietnamese,
			"phong kham": models.LanguageVietnamese,
			"bac si":     models.LanguageVietnamese,
			"thuoc":      models.LanguageVietnamese,
			"kham benh":  models.LanguageVietnamese,
			"tap gym":    models.LanguageVietnamese,
			"the thao":   models.LanguageVietnamese,
			// English
			"hospital":   models.LanguageEnglish,
			"clinic":     models.LanguageEnglish,
			"doctor":     models.LanguageEnglish,
			"medicine":   models.LanguageEnglish,
			"pharmacy":   models.LanguageEnglish,
			"gym":        models.LanguageEnglish,
			"fitness":    models.LanguageEnglish,
			"yoga":       models.LanguageEnglish,
		}
		for kw, lang := range healthKeywords {
			confidence := int32(75)
			if lang == models.LanguageVietnamese {
				confidence = 80
			}
			keywords = append(keywords, &models.CategoryKeyword{
				CategoryID: catID,
				Keyword:    kw,
				Language:   lang,
				Confidence: confidence,
				IsActive:   true,
			})
		}
	}

	// Bills & Utilities keywords
	if catID, ok := categoryMap["Bills & Utilities"]; ok {
		utilityKeywords := map[string]models.Language{
			// Vietnamese
			"dien":       models.LanguageVietnamese,
			"nuoc":       models.LanguageVietnamese,
			"internet":   models.LanguageVietnamese,
			"dien thoai": models.LanguageVietnamese,
			"tien dien":  models.LanguageVietnamese,
			"tien nuoc":  models.LanguageVietnamese,
			// English
			"electricity": models.LanguageEnglish,
			"water":      models.LanguageEnglish,
			"utility":    models.LanguageEnglish,
			"bill":       models.LanguageEnglish,
			"phone":      models.LanguageEnglish,
			"telecom":    models.LanguageEnglish,
		}
		for kw, lang := range utilityKeywords {
			confidence := int32(75)
			if lang == models.LanguageVietnamese {
				confidence = 80
			}
			keywords = append(keywords, &models.CategoryKeyword{
				CategoryID: catID,
				Keyword:    kw,
				Language:   lang,
				Confidence: confidence,
				IsActive:   true,
			})
		}
	}

	// Education keywords
	if catID, ok := categoryMap["Education"]; ok {
		educationKeywords := map[string]models.Language{
			// Vietnamese
			"hoc":        models.LanguageVietnamese,
			"truong":     models.LanguageVietnamese,
			"hoc phi":    models.LanguageVietnamese,
			"khoa hoc":   models.LanguageVietnamese,
			// English
			"school":     models.LanguageEnglish,
			"education":  models.LanguageEnglish,
			"course":     models.LanguageEnglish,
			"tuition":    models.LanguageEnglish,
			"book":       models.LanguageEnglish,
		}
		for kw, lang := range educationKeywords {
			confidence := int32(75)
			if lang == models.LanguageVietnamese {
				confidence = 80
			}
			keywords = append(keywords, &models.CategoryKeyword{
				CategoryID: catID,
				Keyword:    kw,
				Language:   lang,
				Confidence: confidence,
				IsActive:   true,
			})
		}
	}

	// Salary keywords (Income)
	if catID, ok := categoryMap["Salary"]; ok {
		salaryKeywords := map[string]models.Language{
			// Vietnamese
			"luong":      models.LanguageVietnamese,
			"tien luong": models.LanguageVietnamese,
			// English
			"salary":     models.LanguageEnglish,
			"wage":       models.LanguageEnglish,
			"payroll":    models.LanguageEnglish,
		}
		for kw, lang := range salaryKeywords {
			confidence := int32(85)
			if lang == models.LanguageVietnamese {
				confidence = 90
			}
			keywords = append(keywords, &models.CategoryKeyword{
				CategoryID: catID,
				Keyword:    kw,
				Language:   lang,
				Confidence: confidence,
				IsActive:   true,
			})
		}
	}

	return keywords
}
