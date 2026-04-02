package handlers

import (
	"testing"

	"wealthjourney/domain/service"

	"github.com/stretchr/testify/assert"
)

func TestMergeConfig_UserAlertTemplates(t *testing.T) {
	current := service.PriceAlertConfig{
		CooldownMinutes:            120,
		TopMoversCount:             5,
		Categories:                 map[string]service.PriceAlertCategoryConfig{},
		UserAlertTitleTemplate:     "Current title {name}",
		UserAlertAboveBodyTemplate: "Current above {price}",
		UserAlertBelowBodyTemplate: "Current below {price}",
	}

	// Partial update: only title changed
	update := service.PriceAlertConfig{
		UserAlertTitleTemplate: "New title {name}",
	}

	merged := mergeConfig(current, update)
	assert.Equal(t, "New title {name}", merged.UserAlertTitleTemplate)
	assert.Equal(t, "Current above {price}", merged.UserAlertAboveBodyTemplate) // unchanged
	assert.Equal(t, "Current below {price}", merged.UserAlertBelowBodyTemplate) // unchanged
}
