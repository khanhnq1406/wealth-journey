"use client";

interface PostBodyProps {
  content: string;
  imageUrl?: string;
}

export function PostBody({ content, imageUrl }: PostBodyProps) {
  return (
    <div className="mt-3">
      <p className="font-vietnam text-sm leading-relaxed text-v2-text-primary whitespace-pre-wrap break-words">
        {content}
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
    </div>
  );
}
