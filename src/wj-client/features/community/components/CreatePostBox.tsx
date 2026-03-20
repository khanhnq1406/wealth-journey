"use client";

import { useState } from "react";
import { Avatar } from "./Avatar";
import { BaseModal } from "@/components/modals/BaseModal";
import { CreatePostForm } from "../forms/CreatePostForm";
import { ImageIcon } from "lucide-react";

interface CreatePostBoxProps {
  currentUser: { id: number; name: string; picture: string };
  onPostCreated?: () => void;
}

export function CreatePostBox({ currentUser, onPostCreated }: CreatePostBoxProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="bg-v2-maroon-800 sm:rounded-2xl border-b sm:border border-v2-border-light p-4">
        <div className="flex items-center gap-3">
          <Avatar
            name={currentUser.name}
            imageUrl={currentUser.picture}
            size="md"
          />
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 text-left px-4 py-2.5 rounded-full bg-v2-bg-primary border border-v2-border-light text-v2-text-tertiary font-vietnam text-sm hover:bg-v2-border-light transition-colors"
          >
            Chia sẻ kiến thức tài chính...
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-v2-border-light">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-v2-text-secondary hover:bg-v2-bg-primary transition-colors font-vietnam text-sm"
          >
            <ImageIcon size={18} className="text-v2-text-tertiary" />
            <span>Ảnh</span>
          </button>
        </div>
      </div>

      <BaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Tạo bài viết"
      >
        <CreatePostForm
          currentUser={currentUser}
          onSuccess={() => {
            setIsModalOpen(false);
            onPostCreated?.();
          }}
        />
      </BaseModal>
    </>
  );
}
