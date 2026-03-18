import { useState, useEffect } from 'react';
import { ArrowRight, Gamepad2, Users, Zap } from 'lucide-react';

export default function StartupPage({ onStartGame }) {
  const [isLoading, setIsLoading] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const fullText = 'Welcome to KiChain';

  // Typing animation for title
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < fullText.length) {
        setDisplayText(fullText.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setIsLoading(true);
    // Simulate loading
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsLoading(false);
    onStartGame?.();
  };

  const features = [
    {
      icon: Gamepad2,
      title: 'Play & Compete',
      description: 'Join exciting game sessions'
    },
    {
      icon: Users,
      title: 'Multiplayer',
      description: 'Connect with other players'
    },
    {
      icon: Zap,
      title: 'Real-time',
      description: 'Instant action & updates'
    }
  ];

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Title with typing animation */}
        <div className="mb-8">
          <h1 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-4">
            {displayText}
            {displayText.length < fullText.length && (
              <span className="animate-pulse">|</span>
            )}
          </h1>
          <p className="text-gray-400 text-lg animate-fade-in">
            Dive into an immersive multiplayer experience
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6 hover:border-blue-400/50 transition-all duration-300 hover:bg-slate-800/80 group"
                style={{
                  animation: `slideUp 0.6s ease-out ${0.2 + index * 0.1}s both`
                }}
              >
                <Icon className="w-8 h-8 text-blue-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-400">{feature.description}</p>
              </div>
            );
          })}
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={isLoading}
          className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed animate-fade-in"
        >
          <span>{isLoading ? 'Initializing...' : 'Start Game'}</span>
          {!isLoading && (
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          )}
          {isLoading && (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          )}
        </button>

        {/* Footer text */}
        <p className="text-gray-500 text-sm mt-8">
          Get ready for an adventure • Solo or Multiplayer
        </p>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.8s ease-out 0.6s both;
        }

        .delay-1000 {
          animation-delay: 1000ms;
        }
      `}</style>
    </div>
  );
}
