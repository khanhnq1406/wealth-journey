"use client";

interface HashtagLinkProps {
  tag: string;
  onClick?: (tag: string) => void;
}

export function HashtagLink({ tag, onClick }: HashtagLinkProps) {
  if (!onClick) {
    return <span className="text-bg font-medium">{tag}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onClick(tag.slice(1))}
      className="text-bg font-medium hover:underline"
    >
      {tag}
    </button>
  );
}
