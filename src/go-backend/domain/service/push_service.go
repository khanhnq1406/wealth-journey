package service

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"

	webpush "github.com/SherClockHolmes/webpush-go"
	"wealthjourney/domain/repository"
)

type pushPayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
	Icon  string `json:"icon"`
	Tag   string `json:"tag"`
}

type pushService struct {
	subRepo        repository.PushSubscriptionRepository
	vapidPublicKey string
	vapidPrivate   string
	vapidContact   string
}

func NewPushService(subRepo repository.PushSubscriptionRepository) PushService {
	pubKey := os.Getenv("VAPID_PUBLIC_KEY")
	privKey := os.Getenv("VAPID_PRIVATE_KEY")
	contact := os.Getenv("VAPID_CONTACT")

	if pubKey == "" || privKey == "" {
		log.Println("VAPID keys not configured, push notifications disabled")
		return &noopPushService{}
	}
	if contact == "" {
		contact = "admin@congdongvang.com"
	}
	// webpush-go auto-prepends "mailto:" to the Subscriber field (the VAPID
	// JWT "sub" claim).  If the env var already contains the prefix we must
	// strip it, otherwise the JWT ends up with "mailto:mailto:…" which Apple
	// strictly rejects with {"reason":"BadJwtToken"}.
	contact = strings.TrimPrefix(contact, "mailto:")

	return &pushService{
		subRepo:        subRepo,
		vapidPublicKey: pubKey,
		vapidPrivate:   privKey,
		vapidContact:   contact,
	}
}

func (s *pushService) GetVAPIDPublicKey() string {
	return s.vapidPublicKey
}

func (s *pushService) SendToUser(ctx context.Context, userID int32, title, body, url string) error {
	subs, err := s.subRepo.GetByUserID(ctx, userID)
	if err != nil {
		return err
	}
	log.Printf("[push] SendToUser uid=%d subs=%d title=%q", userID, len(subs), title)

	payload, err := json.Marshal(pushPayload{
		Title: title,
		Body:  body,
		URL:   url,
		Icon:  "/icons/icon-192x192.png",
		Tag:   "cdv-" + url,
	})
	if err != nil {
		return err
	}

	for _, sub := range subs {
		resp, err := webpush.SendNotification(payload, &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys: webpush.Keys{
				P256dh: sub.P256dh,
				Auth:   sub.Auth,
			},
		}, &webpush.Options{
			Subscriber:      s.vapidContact,
			VAPIDPublicKey:  s.vapidPublicKey,
			VAPIDPrivateKey: s.vapidPrivate,
			TTL:             86400,
			Urgency:         webpush.UrgencyHigh,
		})
		if err != nil {
			log.Printf("Push notification failed for endpoint %s: %v", sub.Endpoint[:min(50, len(sub.Endpoint))], err)
			continue
		}
		s.handlePushResponse(ctx, resp, sub.Endpoint)
	}
	return nil
}

func (s *pushService) SendToAll(ctx context.Context, title, body, url string) error {
	subs, err := s.subRepo.GetAll(ctx)
	if err != nil {
		return err
	}
	log.Printf("[push] SendToAll subs=%d title=%q", len(subs), title)
	if len(subs) == 0 {
		return nil
	}

	payload, err := json.Marshal(pushPayload{
		Title: title,
		Body:  body,
		URL:   url,
		Icon:  "/icons/icon-192x192.png",
		Tag:   "cdv-" + url,
	})
	if err != nil {
		return err
	}
	log.Printf("[push] payload=%s", string(payload))

	sem := make(chan struct{}, 20)
	var wg sync.WaitGroup

	for _, sub := range subs {
		wg.Add(1)
		sem <- struct{}{}
		go func(endpoint, p256dh, auth string) {
			defer wg.Done()
			defer func() { <-sem }()

			resp, err := webpush.SendNotification(payload, &webpush.Subscription{
				Endpoint: endpoint,
				Keys: webpush.Keys{
					P256dh: p256dh,
					Auth:   auth,
				},
			}, &webpush.Options{
				Subscriber:      s.vapidContact,
				VAPIDPublicKey:  s.vapidPublicKey,
				VAPIDPrivateKey: s.vapidPrivate,
				TTL:             86400,
				Urgency:         webpush.UrgencyHigh,
			})
			if err != nil {
				log.Printf("Push notification failed: %v", err)
				return
			}
			s.handlePushResponse(ctx, resp, endpoint)
		}(sub.Endpoint, sub.P256dh, sub.Auth)
	}
	wg.Wait()
	return nil
}

// handlePushResponse processes the HTTP response from a push endpoint.
// It cleans up gone (410) subscriptions and removes Apple subscriptions
// that persistently return 403 (Forbidden), which typically indicates
// an invalid or revoked subscription rather than a transient VAPID error.
func (s *pushService) handlePushResponse(ctx context.Context, resp *http.Response, endpoint string) {
	defer func() { _ = resp.Body.Close() }()

	truncated := endpoint
	if len(truncated) > 50 {
		truncated = truncated[:50]
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Printf("[push] ✓ delivered to %s... (HTTP %d)", truncated, resp.StatusCode)
		return
	}

	switch resp.StatusCode {
	case http.StatusGone: // 410
		log.Printf("Push subscription gone (410), removing: %s...", truncated)
		_ = s.subRepo.DeleteByEndpoint(ctx, endpoint)

	case http.StatusForbidden: // 403
		// Read response body for diagnostics (Apple sometimes includes error details).
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		bodyStr := string(body)
		log.Printf("Push endpoint returned HTTP 403 for %s... body=%s", truncated, bodyStr)

		// Apple returns 403 for both JWT errors (BadJwtToken) and invalid
		// subscriptions.  Only remove the subscription when Apple confirms
		// the subscription itself is invalid — NOT when the JWT is rejected,
		// since that is a server-side configuration issue.
		if strings.Contains(endpoint, "web.push.apple.com") && !strings.Contains(bodyStr, "BadJwtToken") {
			log.Printf("Removing invalid Apple push subscription: %s...", truncated)
			_ = s.subRepo.DeleteByEndpoint(ctx, endpoint)
		}

	default:
		log.Printf("Push endpoint returned HTTP %d for %s...", resp.StatusCode, truncated)
	}
}

// noopPushService is returned when VAPID keys are not configured.
type noopPushService struct{}

func (n *noopPushService) SendToUser(_ context.Context, _ int32, _, _, _ string) error {
	return nil
}
func (n *noopPushService) SendToAll(_ context.Context, _, _, _ string) error {
	return nil
}
func (n *noopPushService) GetVAPIDPublicKey() string {
	return ""
}
