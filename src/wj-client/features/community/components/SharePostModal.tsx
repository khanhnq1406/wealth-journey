"use client";

import type { PostItem } from "@/gen/protobuf/v1/community";
import { BaseModal } from "@/components/modals/BaseModal";
import { SharePostForm } from "../forms/SharePostForm";

interface SharePostModalProps {
  post: PostItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SharePostModal({ post, onClose, onSuccess }: SharePostModalProps) {
  const handleSuccess = () => {
    onSuccess?.();
    onClose();
  };

  return (
    <BaseModal
      isOpen={post !== null}
      onClose={onClose}
      title="Chia sẻ bài viết"
    >
      {post && (
        <SharePostForm
          post={post}
          onSuccess={handleSuccess}
          onCancel={onClose}
        />
      )}
    </BaseModal>
  );
}
