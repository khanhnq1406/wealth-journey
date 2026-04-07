package scheduler

import (
	"bytes"
	"context"
	"errors"
	"log"
	"os"
	"testing"

	"wealthjourney/domain/service"
	v1 "wealthjourney/protobuf/v1"
)

// ---------------------------------------------------------------------------
// Mock: UserPriceAlertService
// ---------------------------------------------------------------------------

type mockUserPriceAlertService struct {
	evaluateErr    error
	evaluateCalled bool
}

func (m *mockUserPriceAlertService) EvaluateAlerts(_ context.Context) error {
	m.evaluateCalled = true
	return m.evaluateErr
}

func (m *mockUserPriceAlertService) CreateAlert(_ context.Context, _ int32, _ *v1.CreateUserPriceAlertRequest) (*v1.CreateUserPriceAlertResponse, error) {
	return nil, nil
}

func (m *mockUserPriceAlertService) ListAlerts(_ context.Context, _ int32, _ *v1.ListUserPriceAlertsRequest) (*v1.ListUserPriceAlertsResponse, error) {
	return nil, nil
}

func (m *mockUserPriceAlertService) UpdateAlert(_ context.Context, _ int32, _ int32, _ *v1.UpdateUserPriceAlertRequest) (*v1.UpdateUserPriceAlertResponse, error) {
	return nil, nil
}

func (m *mockUserPriceAlertService) DeleteAlert(_ context.Context, _ int32, _ int32) (*v1.DeleteUserPriceAlertResponse, error) {
	return nil, nil
}

// Compile-time check that mockUserPriceAlertService implements service.UserPriceAlertService.
var _ service.UserPriceAlertService = &mockUserPriceAlertService{}

// ---------------------------------------------------------------------------
// Tests: UserPriceAlertJob
// ---------------------------------------------------------------------------

func TestUserPriceAlertJob_Run_LogsCompletion(t *testing.T) {
	svc := &mockUserPriceAlertService{}
	job := NewUserPriceAlertJob(svc)

	var buf bytes.Buffer
	log.SetOutput(&buf)
	defer log.SetOutput(os.Stderr)

	err := job.Run(context.Background())
	if err != nil {
		t.Fatalf("Run() unexpected error: %v", err)
	}
	if !svc.evaluateCalled {
		t.Error("Run() did not call EvaluateAlerts")
	}
	output := buf.String()
	if !containsStr(output, "completed") {
		t.Errorf("Run() log output %q does not contain %q", output, "completed")
	}
}

func TestUserPriceAlertJob_Run_LogsError(t *testing.T) {
	want := errors.New("evaluation failed")
	svc := &mockUserPriceAlertService{evaluateErr: want}
	job := NewUserPriceAlertJob(svc)

	var buf bytes.Buffer
	log.SetOutput(&buf)
	defer log.SetOutput(os.Stderr)

	got := job.Run(context.Background())
	if got == nil {
		t.Fatal("Run() expected error, got nil")
	}
	if got.Error() != want.Error() {
		t.Errorf("Run() error = %v, want %v", got, want)
	}
	output := buf.String()
	if !containsStr(output, "failed") {
		t.Errorf("Run() error log %q does not contain %q", output, "failed")
	}
}

func TestUserPriceAlertJob_ImplementsJobInterface(t *testing.T) {
	svc := &mockUserPriceAlertService{}
	job := NewUserPriceAlertJob(svc)
	var _ Job = job
}

// containsStr reports whether substr appears in s without importing "strings".
func containsStr(s, substr string) bool {
	if len(substr) == 0 {
		return true
	}
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
