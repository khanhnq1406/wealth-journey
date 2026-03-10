"use client";

import type { PostItem } from "@/gen/protobuf/v1/community";
import { tokenizeContent } from "../utils/hashtag";
import { HashtagLink } from "./HashtagLink";
import { SharedPostEmbed } from "./SharedPostEmbed";

interface PostBodyProps {
  content: string;
  imageUrl?: string;
  sharedPost?: PostItem;
  onHashtagClick?: (tag: string) => void;
}

export function PostBody({ content, imageUrl, sharedPost, onHashtagClick }: PostBodyProps) {
  const tokens = tokenizeContent(content);

  return (
    <div className="mt-3">
      <p className="font-vietnam text-sm leading-relaxed text-v2-text-primary whitespace-pre-wrap break-words">
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
      {imageUrl && (
        <div className="mt-3 rounded-xl overflow-hidden">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-[180px] sm:h-[220px] object-cover"
            loading="lazy"
          />
        </div>
      )}
      {sharedPost && (
        <SharedPostEmbed
          sharedPost={sharedPost}
          onHashtagClick={onHashtagClick}
        />
      )}
    </div>
  );
}
