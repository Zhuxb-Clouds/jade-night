import React from 'react';
import { P2PProvider } from './network/P2PContext';
import { Lobby } from './components/Lobby';
import { Board } from './components/Board';

function App() {
  return (
    <P2PProvider>
      <div className="min-h-screen bg-gray-900">
        <Lobby />
        <Board />
      </div>
    </P2PProvider>
  );
}

export default App;
