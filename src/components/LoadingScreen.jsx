import { useState, useEffect } from "react";
import AnimatedLogo from "./AnimatedLogo";

export default function LoadingScreen({ 
  wordListLoaded, 
  todayWord, 
  loadingError 
}) {
  const [currentStage, setCurrentStage] = useState(0);
  
  const stages = [
    { message: "Loading word dictionary...", complete: wordListLoaded },
    { message: "Loading today's target word...", complete: !!todayWord }
  ];

  useEffect(() => {
    // Update current stage based on what's loaded
    for (let i = 0; i < stages.length; i++) {
      if (!stages[i].complete) {
        setCurrentStage(i);
        return;
      }
    }
    setCurrentStage(stages.length);
  }, [wordListLoaded, todayWord]);

  if (loadingError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl max-w-md w-full">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-white mb-4">Loading Error</h2>
            <p className="text-white/90 mb-6">{loadingError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl max-w-md w-full">
        <div className="text-center">
          <AnimatedLogo />
          
          <div className="mt-8 space-y-4">
            {stages.map((stage, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  stage.complete ? 'bg-green-500' : 
                  index === currentStage ? 'bg-yellow-500 animate-pulse' : 
                  'bg-gray-500'
                }`}>
                  {stage.complete ? (
                    <span className="text-white text-sm">✓</span>
                  ) : index === currentStage ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="text-white/50 text-sm">{index + 1}</span>
                  )}
                </div>
                <div className={`flex-1 text-left ${
                  stage.complete ? 'text-green-300' : 
                  index === currentStage ? 'text-white font-semibold' : 
                  'text-white/50'
                }`}>
                  {stage.message}
                </div>
              </div>
            ))}
          </div>

          {wordListLoaded && todayWord && (
            <div className="mt-6 text-white/70 text-sm">
              Ready to play! Logging you in...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
