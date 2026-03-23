"use client";

interface HashtagLinkProps {
  tag: string;
  onClick?: (tag: string) => void;
}

export function HashtagLink({ tag, onClick }: HashtagLinkProps) {
  if (!onClick) {
    return <span className="text-v2-gold-primary font-medium">{tag}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onClick(tag.slice(1))}
      className="text-v2-gold-primary font-medium hover:underline hover:text-v2-gold-light"
    >
      {tag}
    </button>
  );
}
