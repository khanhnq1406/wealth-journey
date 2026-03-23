"use client";

import type { PostItem } from "@/gen/protobuf/v1/community";
import { Avatar } from "./Avatar";
import { tokenizeContent } from "../utils/hashtag";
import { HashtagLink } from "./HashtagLink";

interface SharedPostEmbedProps {
  sharedPost: PostItem;
  onHashtagClick?: (tag: string) => void;
}

export function SharedPostEmbed({ sharedPost, onHashtagClick }: SharedPostEmbedProps) {
  const tokens = tokenizeContent(sharedPost.content ?? "");

  return (
    <div className="mt-3 border border-v2-border-light rounded-xl p-3 bg-v2-bg-primary">
      <div className="flex items-center gap-2 mb-2">
        <Avatar
          name={sharedPost.userName ?? ""}
          imageUrl={sharedPost.userPicture}
          size="sm"
        />
        <span className="font-roboto text-sm font-medium text-v2-text-primary">
          {sharedPost.userName}
        </span>
      </div>
      <p className="font-roboto text-sm leading-relaxed text-v2-text-secondary whitespace-pre-wrap break-words">
        {tokens.map((token, i) =>
          token.type === "hashtag" ? (
            <HashtagLink
              key={i}
              tag={token.value}
              onClick={onHashtagClick}
            />
          ) : (
            <span key={i}>{token.value}</span>
          )
        )}
      </p>
      {sharedPost.imageUrl && (
        <div className="mt-2 rounded-lg overflow-hidden">
          <img
            src={sharedPost.imageUrl}
            alt=""
            className="w-full h-[140px] object-cover"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
