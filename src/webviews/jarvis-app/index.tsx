import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';

declare const window: any;

const greetings = [
  "Hello! I am Genouk 👋",
  "Beep boop! Ready to write some awesome code? 💻",
  "You're doing great today! 🚀",
  "Need a quick break? Remember to hydrate! 💧",
  "Analyzing workspace... looks brilliant! ✨",
  "Did someone say 'refactor'? Let's do it! 🛠️",
  "I love floating here in your editor! 🤖",
  "Type your code, and I'll keep you company! 🌟"
];

interface ChromaVideoProps {
  src: string;
  onEnded: () => void;
  onError: () => void;
}

const ChromaVideo: React.FC<ChromaVideoProps> = ({ src, onEnded, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let animationFrameId: number;
    const renderWidth = 320;
    const renderHeight = 180;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const processFrame = () => {
      if (video.paused || video.ended) return;

      // Draw the video frame to the canvas
      ctx.drawImage(video, 0, 0, renderWidth, renderHeight);

      // Get pixel data
      const frame = ctx.getImageData(0, 0, renderWidth, renderHeight);
      const l = frame.data.length;

      // Replace pixels close to RGB (42, 42, 42) with transparency
      for (let i = 0; i < l; i += 4) {
        const r = frame.data[i];
        const g = frame.data[i + 1];
        const b = frame.data[i + 2];

        // Background filter: check if in range [36, 47] and is neutral grey (R=G=B)
        if (r >= 36 && r <= 47 && g >= 36 && g <= 47 && b >= 36 && b <= 47 &&
            Math.abs(r - g) <= 2 && Math.abs(g - b) <= 2) {
          frame.data[i + 3] = 0; // Set alpha to 0 (transparent)
        }
      }

      // Put the processed image back
      ctx.putImageData(frame, 0, 0);

      // Request next frame
      animationFrameId = requestAnimationFrame(processFrame);
    };

    const handlePlay = () => {
      animationFrameId = requestAnimationFrame(processFrame);
    };

    const handleEnded = () => {
      cancelAnimationFrame(animationFrameId);
      onEnded();
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('ended', handleEnded);

    video.play().catch(err => {
      console.error("Autoplay failed:", err);
      onError();
    });

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('ended', handleEnded);
      cancelAnimationFrame(animationFrameId);
    };
  }, [src, onEnded, onError]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Hidden Video Element */}
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        style={{ display: 'none' }}
      />
      {/* Visible Canvas Element */}
      <canvas
        ref={canvasRef}
        width={320}
        height={180}
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: '100%',
          objectFit: 'contain',
          background: 'transparent',
        }}
      />
    </div>
  );
};

const App = () => {
  const images = window.PET_IMAGES || [];
  const videoUrl = window.PET_VIDEO || '';

  const [greetingText, setGreetingText] = useState(greetings[0]);
  const [greetingVisible, setGreetingVisible] = useState(false);
  const [animationState, setAnimationState] = useState<'idle' | 'spin' | 'jump' | 'wave'>('idle');
  const [isHovered, setIsHovered] = useState(false);
  const [videoActive, setVideoActive] = useState(!!videoUrl);
  const [showRobot, setShowRobot] = useState(!videoUrl);

  // Show the greeting bubble and handle timer after the robot has faded in
  useEffect(() => {
    if (showRobot) {
      setGreetingVisible(true);
      const timer = setTimeout(() => {
        setGreetingVisible(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [showRobot]);

  // Trigger a reaction on click
  const handleRobotClick = () => {
    // Pick a random animation (spin, jump, wave)
    const states: ('spin' | 'jump' | 'wave')[] = ['spin', 'jump', 'wave'];
    const nextState = states[Math.floor(Math.random() * states.length)];
    setAnimationState(nextState);

    // Pick a random greeting
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    setGreetingText(randomGreeting);
    setGreetingVisible(true);
  };

  // Define motion animation variants
  const robotVariants = {
    idle: {
      y: [0, -10, 0],
      rotate: [0, -1.5, 1.5, -1.5, 1.5, 0],
      transition: {
        y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
        rotate: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
      },
    },
    hover: {
      scale: 1.06,
      y: [0, -16, 0],
      rotate: [0, -3, 3, -3, 3, 0],
      transition: {
        y: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
        rotate: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
      },
    },
    spin: {
      rotate: 360,
      scale: [1, 1.15, 0.9, 1],
      transition: { duration: 0.6, ease: 'easeInOut' },
    },
    jump: {
      y: [0, -45, 10, -5, 0],
      scaleY: [1, 0.75, 1.25, 0.9, 1],
      transition: { duration: 0.8, ease: 'easeInOut' },
    },
    wave: {
      rotate: [0, -12, 8, -12, 8, 0],
      scale: [1, 1.05, 1],
      transition: { duration: 0.8, ease: 'easeInOut' },
    },
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100vh',
      overflow: 'hidden',
      background: 'transparent',
      fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, sans-serif)',
      position: 'relative',
    }}>
      {/* Soft background pulse glow */}
      <motion.div
        animate={{
          opacity: isHovered && showRobot ? [0.15, 0.25, 0.15] : (showRobot ? [0.06, 0.12, 0.06] : 0),
          scale: isHovered && showRobot ? 1.1 : 1.0,
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          width: '320px',
          height: '320px',
          background: 'radial-gradient(circle, var(--vscode-button-background, #007acc) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Speech bubble */}
      <div style={{ height: '70px', display: 'flex', alignItems: 'flex-end', marginBottom: '16px', zIndex: 2 }}>
        <AnimatePresence mode="wait">
          {greetingVisible && showRobot && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, y: -15 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{
                background: 'var(--vscode-button-background, #007acc)',
                color: 'var(--vscode-button-foreground, #ffffff)',
                padding: '8px 14px',
                borderRadius: '16px 16px 16px 4px',
                fontSize: '13px',
                fontWeight: 500,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                position: 'relative',
                maxWidth: '220px',
                textAlign: 'center',
                lineHeight: '1.4',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              {greetingText}
              <div style={{
                position: 'absolute',
                bottom: '-6px',
                left: '8px',
                borderWidth: '6px 6px 0 0',
                borderStyle: 'solid',
                borderColor: 'var(--vscode-button-background, #007acc) transparent transparent transparent',
              }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content Container (holds either the Video or the Robot) */}
      <div style={{
        position: 'relative',
        width: '95%',
        maxWidth: '280px',
        height: '280px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
      }}>
        <AnimatePresence>
          {videoActive && (
            <motion.div
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChromaVideo
                src={videoUrl}
                onEnded={() => {
                  setVideoActive(false);
                  setShowRobot(true);
                }}
                onError={() => {
                  setVideoActive(false);
                  setShowRobot(true);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showRobot && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <motion.div
                animate={animationState !== 'idle' ? animationState : (isHovered ? 'hover' : 'idle')}
                variants={robotVariants}
                onAnimationComplete={() => {
                  if (animationState !== 'idle') {
                    setAnimationState('idle');
                  }
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={handleRobotClick}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                {images.length > 0 && (
                  <img
                    src={images[0]}
                    alt="Genouk Pet"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 10px 16px rgba(0,0,0,0.35)) contrast(1.05)',
                    }}
                  />
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Holographic floor ring */}
      <motion.div
        animate={{
          scale: isHovered && showRobot ? [1.0, 1.15, 1.0] : (showRobot ? [0.95, 1.05, 0.95] : 0),
          opacity: isHovered && showRobot ? [0.5, 0.8, 0.5] : (showRobot ? [0.3, 0.5, 0.3] : 0),
        }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: '130px',
          height: '12px',
          background: 'radial-gradient(ellipse, var(--vscode-button-background, #007acc) 0%, rgba(0,0,0,0) 75%)',
          borderRadius: '50%',
          filter: 'blur(1px)',
          marginTop: '12px',
          zIndex: 0,
        }}
      />
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
