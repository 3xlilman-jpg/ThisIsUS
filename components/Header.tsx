import React from 'react';

interface HeaderProps {
    onSwitchUser: () => void;
    activeView: 'creative' | 'culinary';
    setActiveView: (view: 'creative' | 'culinary') => void;
}

export const Header: React.FC<HeaderProps> = ({ onSwitchUser, activeView, setActiveView }) => {
  return (
    <header className="bg-black/30 backdrop-blur-sm sticky top-0 z-10 border-b border-amber-500/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-4">
            <div className="text-amber-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-amber-400 tracking-wider">
                ThisIsUs
              </h1>
              <p className="text-xs text-gray-400">Creative Suite</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
              <div className="flex items-center bg-gray-800 rounded-full p-1">
                  <button onClick={() => setActiveView('creative')} className={`px-4 py-1 text-sm font-medium rounded-full transition-colors ${activeView === 'creative' ? 'bg-amber-500 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Creative Suite</button>
                  <button onClick={() => setActiveView('culinary')} className={`px-4 py-1 text-sm font-medium rounded-full transition-colors ${activeView === 'culinary' ? 'bg-amber-500 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Culinary Corner</button>
              </div>
              <button
                  onClick={onSwitchUser}
                  className="text-gray-400 hover:text-amber-400 transition-colors duration-300 text-sm font-medium"
              >
                  Switch User
              </button>
          </div>
        </div>
      </div>
    </header>
  );
};
