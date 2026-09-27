import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { HomeScreen } from './features/home/HomeScreen';
import { VerticalFeedScreen } from './features/feed/VerticalFeedScreen';
import { BookDetailScreen } from './features/book/BookDetailScreen';
import { CategoriesScreen } from './features/categories/CategoriesScreen';
import { LibraryScreen } from './features/library/LibraryScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { AdminPipelineScreen } from './features/pipeline/AdminPipelineScreen';
import { AdminRoute } from './features/pipeline/AdminRoute';
import { BottomNavBar } from './features/navigation/BottomNavBar';
import { VideoPlayer } from './features/player/VideoPlayer';
import { MiniPlayer } from './features/player/MiniPlayer';
import { UnlockModal } from './features/player/UnlockModal';
import { CoinShopModal } from './features/player/CoinShopModal';
import { VipModal } from './features/player/VipModal';

function AppLayout() {
  const location = useLocation();
  // Don't show bottom nav bar inside the feed screen to have 100% immersive vertical video experience
  const isFeed = location.pathname === '/feed';

  return (
    <div className="relative min-h-screen bg-[#090a0f] text-slate-100 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Route Views */}
      <main className="w-full">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/feed" element={<VerticalFeedScreen />} />
          <Route path="/book/:bookId" element={<BookDetailScreen />} />
          <Route path="/categories" element={<CategoriesScreen />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/studio" element={<AdminRoute><AdminPipelineScreen /></AdminRoute>} />
          <Route path="*" element={<HomeScreen />} />
        </Routes>
      </main>

      {/* Persistent Mini Player */}
      <MiniPlayer />

      {/* Fullscreen Video Player modal/overlay */}
      <VideoPlayer />

      {/* Wallet modals: global so they open from any screen, above the player */}
      <UnlockModal />
      <CoinShopModal />
      <VipModal />

      {/* Fixed Bottom Mobile Navigation Bar */}
      <BottomNavBar />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
