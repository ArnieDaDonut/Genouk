import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { t } from './theme';

declare const window: any;

const greetings = [
  "Hi, I'm Genouk 👋",
  'Tighten that prompt before you send it.',
  "Run a diff review before you commit — I'll find the blockers.",
  'Vague prompts get vague code. Give me specifics.',
  'Need a plan? The Session tab breaks your goal into tasks.',
  'Hydrate. Then ship. 💧',
];

interface ChromaVideoProps {
  src: string;
  onEnded: () => void;
  onError: () => void;
}

/** Plays the intro video with the grey background keyed out to transparency. */
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
      ctx.drawImage(video, 0, 0, renderWidth, renderHeight);
      const frame = ctx.getImageData(0, 0, renderWidth, renderHeight);
      const l = frame.data.length;
      for (let i = 0; i < l; i += 4) {
        const r = frame.data[i];
        const g = frame.data[i + 1];
        const b = frame.data[i + 2];
        if (r >= 36 && r <= 47 && g >= 36 && g <= 47 && b >= 36 && b <= 47 &&
            Math.abs(r - g) <= 2 && Math.abs(g - b) <= 2) {
          frame.data[i + 3] = 0;
        }
      }
      ctx.putImageData(frame, 0, 0);
      animationFrameId = requestAnimationFrame(processFrame);
    };

    const handlePlay = () => { animationFrameId = requestAnimationFrame(processFrame); };
    const handleEnded = () => { cancelAnimationFrame(animationFrameId); onEnded(); };

    video.addEventListener('play', handlePlay);
    video.addEventListener('ended', handleEnded);
    video.play().catch(() => onError());

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('ended', handleEnded);
      cancelAnimationFrame(animationFrameId);
    };
  }, [src, onEnded, onError]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <video ref={videoRef} src={src} muted playsInline style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={320} height={180} style={{ width: '100%', height: 'auto', maxHeight: '100%', objectFit: 'contain', background: 'transparent' }} />
    </div>
  );
};

export interface MascotMessage {
  text: string;
  /** Bump on every send so identical text re-triggers the bubble. */
  nonce: number;
}

interface MascotProps {
  /** Push a message to make Genouk pop up and speak (break reminders, task nudges). */
  say?: MascotMessage | null;
}

/**
 * The Genouk mascot. Personality lives here (idle float + click-to-talk speech
 * bubbles). It also speaks on command via the `say` prop, which the App uses to
 * deliver focus-timer break reminders and "what to work on" nudges.
 */
export const Mascot: React.FC<MascotProps> = ({ say }) => {
  const videoUrl = window.PET_VIDEO || '';
  const waveSpriteUrl = window.PET_WAVE_SPRITE || '';

  const [greetingText, setGreetingText] = useState(greetings[0]);
  const [greetingVisible, setGreetingVisible] = useState(false);
  const [videoActive, setVideoActive] = useState(!!videoUrl);
  const [showRobot, setShowRobot] = useState(!videoUrl);
  const [currentFrame, setCurrentFrame] = useState(0);

  // External messages (focus-timer reminders, task nudges). Forces the robot
  // visible — cutting the one-time intro video short if it is somehow still up —
  // and holds the bubble a little longer than a casual click greeting.
  useEffect(() => {
    if (!say || !say.text) return;
    setVideoActive(false);
    setShowRobot(true);
    setGreetingText(say.text);
    setGreetingVisible(true);
    const timer = setTimeout(() => setGreetingVisible(false), 9000);
    return () => clearTimeout(timer);
  }, [say?.nonce]);

  // Sprite sheet geometry
  const frameWidth = 128;
  const frameHeight = 128;
  const columns = 5;
  const frameCount = 25;
  const displayScale = 2.6;
  const displayWidth = frameWidth * displayScale;
  const displayHeight = frameHeight * displayScale;

  useEffect(() => {
    if (!showRobot) return;
    setGreetingVisible(true);
    const timer = setTimeout(() => setGreetingVisible(false), 6000);
    return () => clearTimeout(timer);
  }, [showRobot]);

  useEffect(() => {
    const fps = 12;
    const timer = setInterval(() => setCurrentFrame((prev) => (prev + 1) % frameCount), 1000 / fps);
    return () => clearInterval(timer);
  }, []);

  const handleClick = () => {
    setGreetingText(greetings[Math.floor(Math.random() * greetings.length)]);
    setGreetingVisible(true);
  };

  const col = currentFrame % columns;
  const row = Math.floor(currentFrame / columns);
  const bgPosX = -(col * displayWidth);
  const bgPosY = -(row * displayHeight);
  const bgSizeW = columns * displayWidth;
  const bgSizeH = (frameCount / columns) * displayHeight;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginTop: t.space.sm,
        overflow: 'hidden',
        position: 'relative',
        padding: `${t.space.sm}px ${t.space.sm}px 0`,
        boxSizing: 'border-box',
      }}
    >
      {/* Speech bubble */}
      <div style={{ minHeight: 44, display: 'flex', alignItems: 'flex-end', marginBottom: t.space.sm, zIndex: 2 }}>
        <AnimatePresence mode="wait">
          {greetingVisible && showRobot && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              style={{
                background: t.color.accentBg,
                color: t.color.accentFg,
                padding: '8px 12px',
                borderRadius: '12px 12px 12px 3px',
                fontSize: t.font.size.md,
                fontWeight: t.font.weight.medium,
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                position: 'relative',
                maxWidth: 220,
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              {greetingText}
              <div
                style={{
                  position: 'absolute',
                  bottom: -6,
                  left: 8,
                  borderWidth: '6px 6px 0 0',
                  borderStyle: 'solid',
                  borderColor: `${t.color.accentBg} transparent transparent transparent`,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div
        style={{
          position: 'relative',
          width: '95%',
          maxWidth: 320,
          height: displayHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        <AnimatePresence>
          {videoActive && (
            <motion.div
              exit={{ opacity: 0 }}
              transition={{ duration: t.motion.slow }}
              style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChromaVideo
                src={videoUrl}
                onEnded={() => { setVideoActive(false); setShowRobot(true); }}
                onError={() => { setVideoActive(false); setShowRobot(true); }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showRobot && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: t.motion.slow }}
              style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ y: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
                onClick={handleClick}
                title="Click me"
                style={{
                  width: displayWidth,
                  height: displayHeight,
                  flexShrink: 0,
                  cursor: 'pointer',
                  userSelect: 'none',
                  backgroundImage: waveSpriteUrl ? `url('${waveSpriteUrl}')` : 'none',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: `${bgSizeW}px ${bgSizeH}px`,
                  backgroundPosition: `${bgPosX}px ${bgPosY}px`,
                  imageRendering: 'pixelated',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
