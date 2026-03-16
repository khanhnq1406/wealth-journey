"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { CommunityFeed } from "@/features/community/components/CommunityFeed";
import { CommunityLeftSidebar } from "@/features/community/components/CommunityLeftSidebar";
import { CommunityRightSidebar } from "@/features/community/components/CommunityRightSidebar";
import { CreatePostBox } from "@/features/community/components/CreatePostBox";
import { MobileSubNav } from "@/features/community/components/MobileSubNav";
import { SavedPostsView } from "@/features/community/components/SavedPostsView";
import { SuggestedUsers } from "@/features/community/components/SuggestedUsers";
import { TrendingTopics } from "@/features/community/components/TrendingTopics";
import { ProfileView } from "@/features/community/components/ProfileView";
import { FollowingView } from "@/features/community/components/FollowingView";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";

type CommunityView = "feed" | "profile" | "saved" | "following" | "notifications";
type MobileView = "feed" | "saved" | "profile" | "notifications";

export default function CommunityPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeView, setActiveView] = useState<CommunityView>("feed");
  const [mobileView, setMobileView] = useState<MobileView>("feed");
  const [hashtagFilter, setHashtagFilter] = useState<string>("");
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [followingTab, setFollowingTab] = useState<"following" | "followers">("following");
  const searchParams = useSearchParams();

  // Handle ?view=profile URL param from navbar navigation
  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam === "profile") {
      setActiveView("profile");
      setMobileView("profile");
      setProfileUserId(null); // Own profile
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Run once on mount only

  const handleHashtagClick = (tag: string) => {
    setHashtagFilter(tag);
    setProfileUserId(null);
    setActiveView("feed");
    setMobileView("feed");
  };

  const handleUserClick = (userId: number) => {
    setProfileUserId(userId);
    setActiveView("profile");
    setMobileView("profile");
  };

  const handleViewChange = (view: CommunityView) => {
    if (view === "profile") {
      setProfileUserId(null); // Reset to own profile when clicking sidebar nav
    }
    if (view === "feed") {
      setProfileUserId(null); // Clear other user context when going back to feed
    }
    setActiveView(view);
  };

  const handleMobileViewChange = (view: MobileView) => {
    if (view === "profile") {
      setProfileUserId(null); // Reset to own profile when clicking mobile nav
    }
    setMobileView(view);
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
    if (view === "profile") {
      const targetId = profileUserId ?? currentUser.id;
      return (
        <ProfileView
          targetUserId={targetId}
          currentUser={currentUser}
          onBack={profileUserId ? () => {
            setProfileUserId(null);
            setActiveView("feed");
            setMobileView("feed");
          } : undefined}
          onUserClick={handleUserClick}
          onHashtagClick={handleHashtagClick}
          onFollowingClick={(tab) => {
            setFollowingTab(tab);
            setActiveView("following");
          }}
        />
      );
    }
    if (view === "following") {
      return (
        <FollowingView
          currentUser={currentUser}
          targetUserId={profileUserId ?? undefined}
          onUserClick={handleUserClick}
          initialTab={followingTab}
          onBack={profileUserId ? () => setActiveView("profile") : undefined}
        />
      );
    }
    return (
      <>
        <CreatePostBox currentUser={currentUser} />
        <CommunityFeed
          currentUser={currentUser}
          hashtag={hashtagFilter}
          onHashtagClick={handleHashtagClick}
          onUserClick={handleUserClick}
        />
        {/* Suggested users + trending topics — mobile only (desktop uses right sidebar) */}
        <div className="flex flex-col gap-4 lg:hidden">
          <SuggestedUsers />
          <TrendingTopics onHashtagClick={handleHashtagClick} />
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col sm:h-full -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8">
      {/* Mobile sub-navigation */}
      <div className="sm:hidden">
        <MobileSubNav
          activeView={mobileView}
          onViewChange={handleMobileViewChange}
        />
      </div>

      {/* Desktop body - 3 column */}
      <div className="flex gap-6 p-4 sm:px-8 sm:py-6 sm:flex-1 sm:min-h-0">
        {/* Left sidebar - hidden on mobile */}
        <CommunityLeftSidebar
          className="hidden sm:flex w-[280px] shrink-0"
          currentUser={currentUser}
          activeView={activeView}
          onViewChange={handleViewChange}
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
