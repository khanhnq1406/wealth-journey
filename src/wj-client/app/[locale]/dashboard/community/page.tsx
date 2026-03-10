"use client";

import { useState } from "react";
import { CommunityTabBar } from "@/features/community/components/CommunityTabBar";
import { CommunityFeed } from "@/features/community/components/CommunityFeed";
import { CommunityLeftSidebar } from "@/features/community/components/CommunityLeftSidebar";
import { CommunityRightSidebar } from "@/features/community/components/CommunityRightSidebar";
import { CreatePostBox } from "@/features/community/components/CreatePostBox";

export default function CommunityPage() {
  const [topicFilter, setTopicFilter] = useState("");

  return (
    <div className="flex flex-col h-full -m-4 sm:-m-6 lg:-m-8">
      {/* Mobile tab bar - shown below sm */}
      <CommunityTabBar
        className="sm:hidden"
        activeFilter={topicFilter}
        onFilterChange={setTopicFilter}
      />

      {/* Desktop body - 3 column */}
      <div className="flex gap-6 p-4 sm:px-8 sm:py-6 flex-1 min-h-0">
        {/* Left sidebar - hidden on mobile */}
        <CommunityLeftSidebar className="hidden sm:flex w-[280px] shrink-0" />

        {/* Center feed - fill width */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Desktop topic filter */}
          <CommunityTabBar
            className="hidden sm:block rounded-2xl"
            activeFilter={topicFilter}
            onFilterChange={setTopicFilter}
          />

          {/* Create post box */}
          <CreatePostBox />

          {/* Feed list */}
          <CommunityFeed topicFilter={topicFilter} />
        </div>

        {/* Right sidebar - hidden on mobile and tablet */}
        <CommunityRightSidebar className="hidden lg:flex w-[280px] shrink-0" />
      </div>
    </div>
  );
}
