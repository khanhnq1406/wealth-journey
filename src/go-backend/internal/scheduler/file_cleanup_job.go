package scheduler

import (
	"context"
	"log"
	"time"

	"wealthjourney/domain/service"
)

// FileCleanupJob removes uploaded files older than the threshold.
type FileCleanupJob struct {
	importSvc service.ImportService
}

func NewFileCleanupJob(importSvc service.ImportService) *FileCleanupJob {
	return &FileCleanupJob{importSvc: importSvc}
}

func (j *FileCleanupJob) Name() string            { return "file-cleanup" }
func (j *FileCleanupJob) Interval() time.Duration  { return 1 * time.Hour }
func (j *FileCleanupJob) StartupDelay() time.Duration { return 5 * time.Second }

func (j *FileCleanupJob) Run(ctx context.Context) error {
	deleted, err := j.importSvc.CleanupExpiredFiles(ctx)
	if err != nil {
		return err
	}
	log.Printf("INFO: File cleanup completed: %d files deleted", deleted)
	return nil
}
