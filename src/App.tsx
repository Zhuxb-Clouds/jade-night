import { useState } from "react";
import { P2PProvider } from "./network/P2PContext";
import { Lobby } from "./components/Lobby";
import { Board } from "./components/Board";
import CardGallery from "./components/CardGallery";

function App() {
  const [currentView, setCurrentView] = useState<"game" | "gallery">("game");

  return (
    <div className="min-h-screen">
      {/* 导航栏 */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-white font-serif">玉盏</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentView("game")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentView === "game"
                    ? "bg-purple-600 text-white shadow-md"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                游戏大厅
              </button>
              <button
                onClick={() => setCurrentView("gallery")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentView === "gallery"
                    ? "bg-purple-600 text-white shadow-md"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                卡牌图鉴
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 内容区域 */}
      <div className="pt-16">
        {currentView === "game" ? (
          <P2PProvider>
            <div className="min-h-screen bg-gray-900">
              <Lobby />
              <Board />
            </div>
          </P2PProvider>
        ) : (
          <CardGallery />
        )}
      </div>
    </div>
  );
}

export default App;
