"use client";

import { useState } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { CommunityFeed } from "@/features/community/components/CommunityFeed";
import { CommunityLeftSidebar } from "@/features/community/components/CommunityLeftSidebar";
import { CommunityRightSidebar } from "@/features/community/components/CommunityRightSidebar";
import { CreatePostBox } from "@/features/community/components/CreatePostBox";
import { MobileSubNav } from "@/features/community/components/MobileSubNav";
import { SavedPostsView } from "@/features/community/components/SavedPostsView";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";

type CommunityView = "feed" | "profile" | "saved" | "following" | "notifications";
type MobileView = "feed" | "saved" | "profile" | "notifications";

export default function CommunityPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeView, setActiveView] = useState<CommunityView>("feed");
  const [mobileView, setMobileView] = useState<MobileView>("feed");
  const [hashtagFilter, setHashtagFilter] = useState<string>("");

  const handleHashtagClick = (tag: string) => {
    setHashtagFilter(tag);
    setActiveView("feed");
    setMobileView("feed");
  };

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

  const renderCenterContent = (view: CommunityView | MobileView) => {
    if (view === "saved") {
      return <SavedPostsView currentUser={currentUser} onHashtagClick={handleHashtagClick} />;
    }
    if (view === "notifications") {
      return (
        <div className="bg-white sm:rounded-2xl border-b sm:border border-v2-border-light overflow-hidden">
          <NotificationPanel />
        </div>
      );
    }
    return (
      <>
        <CreatePostBox currentUser={currentUser} />
        <CommunityFeed
          currentUser={currentUser}
          hashtag={hashtagFilter}
          onHashtagClick={handleHashtagClick}
        />
      </>
    );
  };

  return (
    <div className="flex flex-col sm:h-full -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8">
      {/* Mobile sub-navigation */}
      <div className="sm:hidden">
        <MobileSubNav
          activeView={mobileView}
          onViewChange={setMobileView}
        />
      </div>

      {/* Desktop body - 3 column */}
      <div className="flex gap-6 p-4 sm:px-8 sm:py-6 sm:flex-1 sm:min-h-0">
        {/* Left sidebar - hidden on mobile */}
        <CommunityLeftSidebar
          className="hidden sm:flex w-[280px] shrink-0"
          currentUser={currentUser}
          activeView={activeView}
          onViewChange={setActiveView}
        />

        {/* Center feed - fill width */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Desktop view */}
          <div className="hidden sm:flex flex-col gap-4">
            {renderCenterContent(activeView)}
          </div>
          {/* Mobile view */}
          <div className="flex flex-col gap-4 sm:hidden">
            {renderCenterContent(mobileView)}
          </div>
        </div>

        {/* Right sidebar - hidden on mobile and tablet */}
        <CommunityRightSidebar
          className="hidden lg:flex w-[280px] shrink-0"
          onHashtagClick={handleHashtagClick}
        />
      </div>
    </div>
  );
}
