import React, { useState, useRef, useEffect } from 'react';

const VideoPlayer = ({ videoUrl, title, onClose, onError, details }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const videoRef = useRef(null);

    useEffect(() => {
        setIsLoading(true);
        setHasError(false);
    }, [videoUrl]);

    const handleLoadedData = () => {
        setIsLoading(false);
    };

    const handleError = () => {
        setIsLoading(false);
        setHasError(true);
        if (onError) onError();
    };

    const handleRetry = () => {
        if (videoRef.current) {
            setIsLoading(true);
            setHasError(false);
            videoRef.current.load();
        }
    };

    return (
        <div className="relative w-full h-full min-h-[300px] bg-gradient-to-br from-[#0D1E44] to-[#1a2a4f] rounded-xl overflow-hidden">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
                </div>
            )}
            
            {hasError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-xl font-semibold mb-3 text-white">{title}</h3>
                    <p className="text-gray-300 mb-4">{details.description}</p>
                    <div className="bg-white/10 p-4 rounded-lg mb-4 w-full max-w-md">
                        <p className="text-gray-200 mb-2">🕒 Duration: {details.duration}</p>
                        <p className="text-gray-200">🎯 Focus: {details.focus}</p>
                    </div>
                    <button 
                        onClick={handleRetry}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mt-4"
                    >
                        Retry Loading
                    </button>
                </div>
            ) : (
                <video
                    ref={videoRef}
                    className={`w-full h-full ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
                    controls
                    onLoadedData={handleLoadedData}
                    onError={handleError}
                    src={videoUrl}
                >
                    Your browser does not support the video tag.
                </video>
            )}
        </div>
    );
};

export default VideoPlayer; 