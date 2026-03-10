"use client";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { CommunityFeed } from "@/features/community/components/CommunityFeed";
import { CommunityLeftSidebar } from "@/features/community/components/CommunityLeftSidebar";
import { CommunityRightSidebar } from "@/features/community/components/CommunityRightSidebar";
import { CreatePostBox } from "@/features/community/components/CreatePostBox";
import { MobileSubNav } from "@/features/community/components/MobileSubNav";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";

export default function CommunityPage() {
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  const currentUser = {
    id: user?.id ?? 0,
    name: user?.name ?? "User",
    picture: user?.picture ?? "",
  };

  return (
    <div className="flex flex-col h-full -m-4 sm:-m-6 lg:-m-8">
      {/* Mobile sub-navigation - shown below sm */}
      <div className="sm:hidden">
        <MobileSubNav />
      </div>

      {/* Desktop body - 3 column */}
      <div className="flex gap-6 p-4 sm:px-8 sm:py-6 flex-1 min-h-0">
        {/* Left sidebar - hidden on mobile */}
        <CommunityLeftSidebar className="hidden sm:flex w-[280px] shrink-0" currentUser={currentUser} />

        {/* Center feed - fill width */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Create post box */}
          <CreatePostBox currentUser={currentUser} />

          {/* Feed list */}
          <CommunityFeed currentUser={currentUser} />
        </div>

        {/* Right sidebar - hidden on mobile and tablet */}
        <CommunityRightSidebar className="hidden lg:flex w-[280px] shrink-0" />
      </div>
    </div>
  );
}
