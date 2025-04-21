import React, { useState, useRef, useEffect } from 'react';
import "./AudioPlayer.css"

const AudioPlayer = ({ currentIndex, sources }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const audioRef = useRef(null);
  const sliderRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    audio.src = sources[currentIndex];

    const updateTime = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
      }
      setDuration(audio.duration);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateTime);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateTime);
    };
  }, [currentIndex, isDragging, sources]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const updateAudioTime = (newTime) => {
    const audio = audioRef.current;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSliderChange = (e) => {
    const newTime = (e.target.value / 100) * duration;
    setCurrentTime(newTime);
    if (!isDragging) {
      updateAudioTime(newTime);
    }
  };

  const handleSliderMouseDown = () => {
    setIsDragging(true);
  };

  const handleSliderMouseUp = () => {
    setIsDragging(false);
    updateAudioTime(currentTime);
  };

  const handleSliderClick = (e) => {
    const slider = sliderRef.current;
    const bounds = slider.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const newTime = (x / bounds.width) * duration;
    updateAudioTime(newTime);
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  return (
    <div className="bg-[#94A4C1] flex -mt-5 items-center p-4 rounded-[180px]">
      <div
        className="h-10 w-10 rounded-full bg-white hover:bg-[#A9C6FF] cursor-pointer flex items-center justify-center"
        onClick={togglePlayPause}
      >
        {isPlaying ? (
          <svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 320 512">
            <path d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 384 512">
            <path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80v352c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9l288-160c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z" />
          </svg>
        )}
      </div>
      <div className="mx-4 flex-grow">
        <div className=" text-xs text-white md:text-sm  mb-4">Guided Meditation</div>
        <div className="flex items-center">
          <span className="text-white text-xs -mt-5 mr-2">{formatTime(currentTime)}</span>
          <div
            className="relative cursor-pointer flex-grow"
            onClick={handleSliderClick}
            ref={sliderRef}
          >
            <div
              className="absolute top-0 left-0 w-full h-1 bg-white rounded-lg"
            ></div>
            <div
              className="absolute top-0 left-0 h-1 bg-[#4C5DB5] rounded-lg"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            ></div>
            <input
              type="range"
              className="slider-thumb w-full h-1 bg-transparent appearance-none cursor-pointer relative z-10"
              style={{
                '--thumb-color': '#0D1E44',
              }}
              value={duration ? (currentTime / duration) * 100 : 0}
              onChange={handleSliderChange}
              onMouseDown={handleSliderMouseDown}
              onMouseUp={handleSliderMouseUp}
              onTouchStart={handleSliderMouseDown}
              onTouchEnd={handleSliderMouseUp}
            />
          </div>
          <span className="text-white text-xs -mt-5 ml-2">{formatTime(duration)}</span>
        </div>
      </div>
      <audio ref={audioRef} />
    </div>
  );
};

export default AudioPlayer;
