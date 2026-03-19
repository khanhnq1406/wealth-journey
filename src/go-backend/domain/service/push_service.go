package service

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"

	webpush "github.com/SherClockHolmes/webpush-go"
	"wealthjourney/domain/repository"
)

type pushPayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
	Icon  string `json:"icon"`
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
		contact = "mailto:admin@congdongvang.com"
	}

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

	payload, err := json.Marshal(pushPayload{
		Title: title,
		Body:  body,
		URL:   url,
		Icon:  "/icons/icon-192x192.png",
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
		})
		if err != nil {
			log.Printf("Push notification failed for endpoint %s: %v", sub.Endpoint[:min(50, len(sub.Endpoint))], err)
			continue
		}
		resp.Body.Close()
		if resp.StatusCode == http.StatusGone {
			_ = s.subRepo.DeleteByEndpoint(ctx, sub.Endpoint)
		}
	}
	return nil
}

func (s *pushService) SendToAll(ctx context.Context, title, body, url string) error {
	subs, err := s.subRepo.GetAll(ctx)
	if err != nil {
		return err
	}
	if len(subs) == 0 {
		return nil
	}

	payload, err := json.Marshal(pushPayload{
		Title: title,
		Body:  body,
		URL:   url,
		Icon:  "/icons/icon-192x192.png",
	})
	if err != nil {
		return err
	}

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
			})
			if err != nil {
				log.Printf("Push notification failed: %v", err)
				return
			}
			resp.Body.Close()
			if resp.StatusCode == http.StatusGone {
				_ = s.subRepo.DeleteByEndpoint(ctx, endpoint)
			}
		}(sub.Endpoint, sub.P256dh, sub.Auth)
	}
	wg.Wait()
	return nil
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
