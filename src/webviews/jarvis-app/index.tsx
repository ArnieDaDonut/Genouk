import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Sparkles, ListTodo, GitBranch, Activity, Trash2, Plus, 
  Volume2, VolumeX, CheckSquare, Square, AlertCircle, 
  RefreshCw, Copy, Check, Play, Sliders 
} from 'lucide-react';
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


interface SessionTask {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'todo' | 'in_progress' | 'completed';
}

interface SessionPlan {
  goal: string;
  estimatedDuration: string;
  tasks: SessionTask[];
}

// Rough token estimate: words * 1.3
function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words * 1.3);
}

function TokenBadge({ count, label }: { count: number; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'rgba(0, 240, 255, 0.1)',
      border: '1px solid rgba(0, 240, 255, 0.25)',
      color: '#00f0ff',
      borderRadius: 4, padding: '2px 8px', fontSize: 11, fontFamily: 'monospace',
      textShadow: '0 0 5px rgba(0, 240, 255, 0.5)'
    }}>
      {label}: <strong>{count}</strong>
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#00ff66' : score >= 50 ? '#ffb700' : '#ff0055';
  const shadowColor = score >= 80 ? 'rgba(0, 255, 102, 0.4)' : score >= 50 ? 'rgba(255, 183, 0, 0.4)' : 'rgba(255, 0, 85, 0.4)';
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span className="hud-font" style={{ color: '#00f0ff', fontSize: 11 }}>PROMPT RATING</span>
        <strong style={{ color, textShadow: `0 0 8px ${shadowColor}` }}>{score}/100</strong>
      </div>
      <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ 
          width: `${score}%`, 
          background: color, 
          height: '100%', 
          transition: 'width 0.4s ease',
          boxShadow: `0 0 10px ${color}`
        }} />
      </div>
    </div>
  );
}

interface VisualizerProps {
  vibe: string;
  score: number | null;
}

const JarvisVisualizer: React.FC<VisualizerProps> = ({ vibe, score }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let angle = 0;

    const render = () => {
      // Clear with trailing opacity for scanline / holographic trail effect
      ctx.fillStyle = 'rgba(10, 16, 26, 0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = Math.min(cx, cy) - 25;

      let color = '#00f0ff'; 
      let pulseSpeed = 0.02;
      let waveCount = 2;
      let waveAmplitude = 10;
      let orbitalSpeed = 0.005;

      switch (vibe) {
        case 'fire':
          color = '#00ff66'; 
          pulseSpeed = 0.05;
          waveCount = 4;
          waveAmplitude = 15;
          orbitalSpeed = 0.02;
          break;
        case 'chill':
          color = '#00f0ff'; 
          pulseSpeed = 0.025;
          waveCount = 2;
          waveAmplitude = 8;
          orbitalSpeed = 0.005;
          break;
        case 'worried':
          color = '#ffb700'; 
          pulseSpeed = 0.04;
          waveCount = 5;
          waveAmplitude = 12;
          orbitalSpeed = 0.01;
          break;
        case 'chaos':
          color = '#ff0055'; 
          pulseSpeed = 0.1;
          waveCount = 8;
          waveAmplitude = 25;
          orbitalSpeed = 0.04;
          break;
        case 'idle':
        default:
          color = '#8a2be2'; 
          pulseSpeed = 0.008;
          waveCount = 1;
          waveAmplitude = 4;
          orbitalSpeed = 0.002;
          break;
      }

      angle += pulseSpeed;
      const pulse = 1 + Math.sin(angle) * 0.06;
      const currentRadius = radius * pulse;

      // Draw faint background concentric rings
      ctx.strokeStyle = `${color}18`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius - 12, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius + 12, 0, Math.PI * 2);
      ctx.stroke();

      // Draw dashed orbital outer ring
      ctx.strokeStyle = `${color}3b`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 12]);
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius + 16, angle * orbitalSpeed * 100, angle * orbitalSpeed * 100 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]); 

      // Draw orbiting tick marks
      ctx.strokeStyle = `${color}80`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI / 4) + angle * orbitalSpeed * 50;
        const startX = cx + Math.cos(a) * (currentRadius - 6);
        const startY = cy + Math.sin(a) * (currentRadius - 6);
        const endX = cx + Math.cos(a) * (currentRadius + 6);
        const endY = cy + Math.sin(a) * (currentRadius + 6);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }

      // Draw inner signal wave
      ctx.strokeStyle = `${color}bf`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = cx - currentRadius + 15; x < cx + currentRadius - 15; x++) {
        const nx = (x - cx) / (currentRadius - 15);
        const yLimit = Math.sqrt(Math.max(0, 1 - nx * nx)) * (currentRadius - 15);
        const wave = Math.sin(nx * Math.PI * waveCount + angle * 3.5) * waveAmplitude;
        const clampedWave = Math.max(-yLimit, Math.min(yLimit, wave));
        const y = cy + clampedWave;

        if (x === cx - currentRadius + 15) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Glitch visual scan for chaos vibe
      if (vibe === 'chaos' && Math.random() > 0.88) {
        ctx.fillStyle = `${color}88`;
        ctx.fillRect(cx - currentRadius + Math.random() * currentRadius * 2, cy - 4, 30, 2);
      }

      // Text status display
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.font = 'bold 13px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (score !== null) {
        ctx.fillText(`${score}%`, cx, cy - 2);
        ctx.font = '8px "Orbitron", sans-serif';
        ctx.fillText(vibe.toUpperCase(), cx, cy + 16);
      } else {
        ctx.fillText("IDLE", cx, cy);
      }
      ctx.shadowBlur = 0; // Reset shadow

      animationFrameId = requestAnimationFrame(render);
    };

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    render();

    window.addEventListener('resize', resizeCanvas);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [vibe, score]);

  return (
    <div style={{ position: 'relative', margin: '10px 0', border: '1px solid rgba(0, 240, 255, 0.1)', borderRadius: 6, background: 'rgba(0,0,0,0.2)' }}>
      <canvas 
        ref={canvasRef} 
        style={{ width: '100%', height: 140, display: 'block' }} 
      />
      <div style={{
        position: 'absolute', bottom: 4, left: 8, fontSize: 8, fontFamily: 'Orbitron', color: 'rgba(0, 240, 255, 0.4)'
      }}>
        GRID SYSTEM SECURE
      </div>
      <div style={{
        position: 'absolute', bottom: 4, right: 8, fontSize: 8, fontFamily: 'Orbitron', color: 'rgba(0, 240, 255, 0.4)'
      }}>
        VIBE FEEDBACK ACTIVE
      </div>
    </div>
  );
};

const App = () => {
  const vsCodeRef = useRef<any>(null);
  if (!vsCodeRef.current) {
    vsCodeRef.current = window.acquireVsCodeApi();
  }
  const vscode = vsCodeRef.current;

  // Tabs: 'prompts', 'session', 'changes', 'audio'
  const [activeTab, setActiveTab] = useState<'prompts' | 'session' | 'changes' | 'audio'>('prompts');
  
  // Prompt reviewer state
  const [prompt, setPrompt] = useState('');
  const [review, setReview] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  
  // Git diff reviewer state
  const [changeReview, setChangeReview] = useState<string>('');

  // Audio system state
  const [audioUris, setAudioUris] = useState<Record<string, string>>({});
  const [volume, setVolume] = useState(0.4);
  const [muted, setMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(true);
  const [vibeState, setVibeState] = useState<{
    score: number | null;
    vibe: string;
    errorsCount: number;
    warningsCount: number;
    fileName: string;
  }>({
    score: null,
    vibe: 'idle',
    errorsCount: 0,
    warningsCount: 0,
    fileName: ''
  });

  // Session Planner state
  const [sessionGoal, setSessionGoal] = useState('');
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskEst, setNewTaskEst] = useState(15);
  const [newTaskDiff, setNewTaskDiff] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [showAddTask, setShowAddTask] = useState(false);

  // Common UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const sfxAudioRef = useRef<HTMLAudioElement | null>(null);

  // Storing audio control variables in refs for the message handler closure
  const audioUrisRef = useRef<Record<string, string>>({});
  const volumeRef = useRef(0.4);
  const mutedRef = useRef(false);

  useEffect(() => {
    audioUrisRef.current = audioUris;
  }, [audioUris]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Handle messages from VS Code extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'audioUris':
          setAudioUris(message.value);
          break;
        case 'updateVibe':
          setVibeState(message.value);
          break;
        case 'playSFX': {
          const sfxType = message.value;
          const url = audioUrisRef.current[sfxType];
          if (url && sfxAudioRef.current) {
            sfxAudioRef.current.src = url;
            sfxAudioRef.current.volume = volumeRef.current * (mutedRef.current ? 0 : 1);
            sfxAudioRef.current.currentTime = 0;
            sfxAudioRef.current.play().catch(e => console.log("SFX play failed:", e));
          }
          break;
        }
        case 'sessionPlan':
          setSessionPlan(message.value);
          setSessionLoading(false);
          break;
        case 'promptReviewResult':
          setReview(message.value);
          setLoading(false);
          break;
        case 'changeReviewResult':
          setChangeReview(message.value);
          setLoading(false);
          break;
        case 'error':
          setError(message.value);
          setLoading(false);
          setSessionLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Instantiate HTML5 Audio
    backgroundAudioRef.current = new Audio();
    sfxAudioRef.current = new Audio();

    // Trigger initial state syncs
    vscode.postMessage({ type: 'getAudioUris' });
    vscode.postMessage({ type: 'getSessionPlan' });

    return () => {
      window.removeEventListener('message', handleMessage);
      if (backgroundAudioRef.current) backgroundAudioRef.current.pause();
      if (sfxAudioRef.current) sfxAudioRef.current.pause();
    };
  }, []);

  // Sync background volume
  useEffect(() => {
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.volume = volume * (muted ? 0 : 1);
    }
  }, [volume, muted]);

  // Manage Background Music Loop Transitions
  useEffect(() => {
    const url = audioUris[vibeState.vibe];
    if (!url || !backgroundAudioRef.current) return;

    const bgAudio = backgroundAudioRef.current;

    // First time initializing sound
    if (!bgAudio.src || bgAudio.src === '' || bgAudio.src === window.location.href) {
      bgAudio.src = url;
      bgAudio.loop = true;
      bgAudio.volume = volume * (muted ? 0 : 1);
      bgAudio.play().then(() => {
        setAudioUnlocked(true);
      }).catch((err) => {
        console.log("Autoplay blocked, waiting for click:", err);
        setAudioUnlocked(false);
      });
      return;
    }

    // Smooth Cross-Fade Transition
    let fadeOutVol = volume;
    const fadeOutInterval = setInterval(() => {
      fadeOutVol = Math.max(0, fadeOutVol - 0.05);
      bgAudio.volume = fadeOutVol * (muted ? 0 : 1);
      
      if (fadeOutVol <= 0) {
        clearInterval(fadeOutInterval);
        bgAudio.src = url;
        bgAudio.loop = true;
        bgAudio.load();
        
        bgAudio.play().then(() => {
          setAudioUnlocked(true);
          let fadeInVol = 0;
          const fadeInInterval = setInterval(() => {
            fadeInVol = Math.min(volume, fadeInVol + 0.05);
            bgAudio.volume = fadeInVol * (muted ? 0 : 1);
            if (fadeInVol >= volume) {
              clearInterval(fadeInInterval);
            }
          }, 25);
        }).catch((err) => {
          console.log("Autoplay blocked on fade transition:", err);
          setAudioUnlocked(false);
        });
      }
    }, 25);

    return () => {
      clearInterval(fadeOutInterval);
    };
  }, [vibeState.vibe, audioUris]);

  const unlockAudio = () => {
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.play().then(() => {
        setAudioUnlocked(true);
      }).catch(err => console.error("Unlock failed:", err));
    }
  };

  const handleReviewPrompt = () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setReview(null);
    vscode.postMessage({ type: 'reviewPrompt', value: prompt });
  };

  const handleUseImproved = () => {
    setPrompt(review.improvedPrompt);
    setReview(null);
    textareaRef.current?.focus();
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(review.improvedPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReviewChanges = () => {
    setLoading(true);
    setError('');
    setChangeReview('');
    vscode.postMessage({ type: 'reviewChanges' });
  };

  // Session Planner commands
  const handleGenerateSessionPlan = () => {
    if (!sessionGoal.trim()) return;
    setSessionLoading(true);
    setError('');
    setSessionPlan(null);
    vscode.postMessage({ type: 'generateSessionPlan', value: sessionGoal });
  };

  const handleToggleTask = (taskId: string) => {
    if (!sessionPlan) return;
    const updatedTasks = sessionPlan.tasks.map(t => {
      if (t.id === taskId) {
        let nextStatus: 'todo' | 'in_progress' | 'completed' = 'todo';
        if (t.status === 'todo') nextStatus = 'in_progress';
        else if (t.status === 'in_progress') nextStatus = 'completed';
        return { ...t, status: nextStatus };
      }
      return t;
    });

    const updatedPlan = { ...sessionPlan, tasks: updatedTasks };
    setSessionPlan(updatedPlan);
    vscode.postMessage({ type: 'saveSessionPlan', value: updatedPlan });
  };

  const handleDeleteTask = (taskId: string) => {
    if (!sessionPlan) return;
    const updatedTasks = sessionPlan.tasks.filter(t => t.id !== taskId);
    const updatedPlan = { ...sessionPlan, tasks: updatedTasks };
    setSessionPlan(updatedPlan);
    vscode.postMessage({ type: 'saveSessionPlan', value: updatedPlan });
  };

  const handleAddTask = () => {
    if (!sessionPlan || !newTaskTitle.trim()) return;
    const newTask: SessionTask = {
      id: `custom-${Date.now()}`,
      title: newTaskTitle,
      description: 'Manually added custom task.',
      estimatedMinutes: newTaskEst,
      difficulty: newTaskDiff,
      status: 'todo'
    };
    const updatedPlan = {
      ...sessionPlan,
      tasks: [...sessionPlan.tasks, newTask]
    };
    setSessionPlan(updatedPlan);
    vscode.postMessage({ type: 'saveSessionPlan', value: updatedPlan });
    setNewTaskTitle('');
    setShowAddTask(false);
  };

  const handleResetSession = () => {
    setSessionPlan(null);
    setSessionGoal('');
    vscode.postMessage({ type: 'saveSessionPlan', value: null });
  };

  const liveTokens = estimateTokens(prompt);
  const savings = review ? review.estimatedOriginalTokens - review.estimatedImprovedTokens : 0;

  // Session calculations
  const totalTasks = sessionPlan?.tasks.length || 0;
  const completedTasks = sessionPlan?.tasks.filter(t => t.status === 'completed').length || 0;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="jarvis-container" style={{
      fontFamily: "'Inter', sans-serif",
      color: '#e2e8f0',
      padding: '12px 10px',
      fontSize: 13,
      lineHeight: 1.5
    }}>
      {/* Google Fonts link & Custom CSS Rules */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Inter:wght@300;400;600&display=swap');
        
        .hud-font {
          font-family: 'Orbitron', sans-serif;
          letter-spacing: 1px;
        }
        .jarvis-card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(0, 240, 255, 0.15);
          border-radius: 6px;
          padding: 12px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .jarvis-card:hover {
          border-color: rgba(0, 240, 255, 0.35);
          box-shadow: 0 0 12px rgba(0, 240, 255, 0.15);
        }
        .tab-btn {
          flex: 1;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: #64748b;
          padding: 8px 4px;
          cursor: pointer;
          font-size: 10px;
          font-family: 'Orbitron', sans-serif;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .tab-btn.active {
          color: #00f0ff;
          border-bottom-color: #00f0ff;
          text-shadow: 0 0 8px rgba(0, 240, 255, 0.5);
        }
        .cyber-input {
          width: 100%;
          box-sizing: border-box;
          background: rgba(15, 23, 42, 0.8);
          color: #f8fafc;
          border: 1px solid rgba(0, 240, 255, 0.2);
          border-radius: 4px;
          padding: 8px 10px;
          outline: none;
          font-size: 13px;
          line-height: 1.5;
          transition: border-color 0.2s;
        }
        .cyber-input:focus {
          border-color: #00f0ff;
          box-shadow: 0 0 8px rgba(0, 240, 255, 0.2);
        }
        .cyber-btn {
          width: 100%;
          background: linear-gradient(135deg, rgba(0, 240, 255, 0.1) 0%, rgba(0, 80, 255, 0.15) 100%);
          border: 1px solid #00f0ff;
          color: #00f0ff;
          font-family: 'Orbitron', sans-serif;
          font-weight: 600;
          font-size: 11px;
          padding: 8px 0;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-shadow: 0 0 4px rgba(0, 240, 255, 0.4);
          letter-spacing: 0.5px;
        }
        .cyber-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(0, 240, 255, 0.25) 0%, rgba(0, 80, 255, 0.3) 100%);
          box-shadow: 0 0 10px rgba(0, 240, 255, 0.4);
        }
        .cyber-btn:disabled {
          opacity: 0.5;
          border-color: rgba(255, 255, 255, 0.1);
          color: #64748b;
          text-shadow: none;
          cursor: not-allowed;
        }
        .task-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 8px 6px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          transition: background 0.2s;
        }
        .task-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .badge-easy { background: rgba(0, 255, 102, 0.1); border: 1px solid rgba(0, 255, 102, 0.25); color: #00ff66; }
        .badge-medium { background: rgba(255, 183, 0, 0.1); border: 1px solid rgba(255, 183, 0, 0.25); color: #ffb700; }
        .badge-hard { background: rgba(255, 0, 85, 0.1); border: 1px solid rgba(255, 0, 85, 0.25); color: #ff0055; }
      `}} />

      {/* Autoplay Blocker Overlay */}
      {!audioUnlocked && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
          background: 'rgba(5, 8, 15, 0.96)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center'
        }}>
          <div className="jarvis-card" style={{ maxWidth: 260, border: '1px solid #00f0ff' }}>
            <Activity size={32} style={{ color: '#00f0ff', marginBottom: 12, animation: 'pulse 2s infinite' }} />
            <h3 className="hud-font" style={{ margin: '0 0 8px', fontSize: 13, color: '#00f0ff' }}>NEURAL AUDIO LINK</h3>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 16px' }}>
              JARVIS audio protocols require manual authorization. Establish standard link.
            </p>
            <button className="cyber-btn" onClick={unlockAudio} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Play size={12} fill="currentColor" /> CONNECT AUDIO
            </button>
          </div>
        </div>
      )}

      {/* Futuristic Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid rgba(0, 240, 255, 0.15)', paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} style={{ color: '#00f0ff', animation: 'spin 4s linear infinite' }} />
          <h1 className="hud-font" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#00f0ff', textShadow: '0 0 8px rgba(0, 240, 255, 0.3)' }}>
            JARVIS ASSISTANT
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {muted ? (
            <VolumeX size={14} style={{ color: '#ff0055', cursor: 'pointer' }} onClick={() => setMuted(false)} />
          ) : (
            <Volume2 size={14} style={{ color: '#00f0ff', cursor: 'pointer' }} onClick={() => setMuted(true)} />
          )}
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748b' }}>
            v0.0.1
          </span>
        </div>
      </div>

      {/* Holographic Vibe Telemetry */}
      <JarvisVisualizer vibe={vibeState.vibe} score={vibeState.score} />

      {vibeState.fileName && (
        <div style={{ fontSize: 10, opacity: 0.6, margin: '-6px 0 10px', textAlign: 'center', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          MONITORING: {vibeState.fileName}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: 'rgba(255, 255, 255, 0.02)', padding: 2, borderRadius: 4 }}>
        <button className={`tab-btn ${activeTab === 'prompts' ? 'active' : ''}`} onClick={() => setActiveTab('prompts')}>
          <Sparkles size={14} />
          PROMPTS
        </button>
        <button className={`tab-btn ${activeTab === 'session' ? 'active' : ''}`} onClick={() => setActiveTab('session')}>
          <ListTodo size={14} />
          SESSION
        </button>
        <button className={`tab-btn ${activeTab === 'changes' ? 'active' : ''}`} onClick={() => setActiveTab('changes')}>
          <GitBranch size={14} />
          CHANGES
        </button>
        <button className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`} onClick={() => setActiveTab('audio')}>
          <Sliders size={14} />
          SOUNDS
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 4, background: 'rgba(255, 0, 85, 0.1)', border: '1px solid rgba(255, 0, 85, 0.3)', color: '#ff0055', fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* TAB CONTENT: PROMPTS */}
      {activeTab === 'prompts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="jarvis-card">
            <h3 className="hud-font" style={{ margin: '0 0 8px', fontSize: 11, color: '#00f0ff' }}>OPTIMIZE DRAFT PROMPT</h3>
            
            <div style={{ position: 'relative' }}>
              <textarea
                ref={textareaRef}
                rows={5}
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); setReview(null); }}
                placeholder="Write your prompt instruction here..."
                className="cyber-input"
                style={{ resize: 'vertical' }}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReviewPrompt(); }}
              />
              {prompt && (
                <div style={{ position: 'absolute', bottom: 8, right: 8, opacity: 0.5, fontSize: 10, fontFamily: 'monospace' }}>
                  ~{liveTokens} tokens
                </div>
              )}
            </div>

            <button
              onClick={handleReviewPrompt}
              disabled={loading || !prompt.trim()}
              className="cyber-btn"
              style={{ marginTop: 8 }}
            >
              {loading ? '⟳  ANALYZING CONTEXT...' : '⚡  RUN TOKEN OPTIMIZATION  (Ctrl+Enter)'}
            </button>
          </div>

          {review && (
            <div className="jarvis-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ScoreBar score={review.score} />

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                <TokenBadge count={review.estimatedOriginalTokens} label="Original" />
                <span style={{ opacity: 0.5, fontSize: 11 }}>→</span>
                <TokenBadge count={review.estimatedImprovedTokens} label="Optimized" />
                {savings > 0 && (
                  <span style={{ fontSize: 10, color: '#00ff66', fontWeight: 600, textShadow: '0 0 5px rgba(0, 255, 102, 0.3)' }}>
                    -{savings} tokens ({Math.round((savings / review.estimatedOriginalTokens) * 100)}%)
                  </span>
                )}
              </div>

              {/* Feedback */}
              <div style={{ fontSize: 12, padding: '8px 10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4, lineHeight: 1.5 }}>
                <strong className="hud-font" style={{ fontSize: 10, color: '#ffb700', display: 'block', marginBottom: 4 }}>JARVIS FEEDBACK</strong>
                <p style={{ margin: 0, opacity: 0.85 }}>{review.feedback}</p>
              </div>

              {/* Issues detected */}
              {review.tokenIssues?.length > 0 && (
                <div>
                  <strong className="hud-font" style={{ fontSize: 10, color: '#ff0055', display: 'block', marginBottom: 4 }}>WASTEFUL PATTERNS REMOVED</strong>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, opacity: 0.8, lineHeight: 1.6 }}>
                    {review.tokenIssues.map((issue: string, i: number) => (
                      <li key={i} style={{ color: '#ff789a' }}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Improved Prompt */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong className="hud-font" style={{ fontSize: 10, color: '#00f0ff' }}>OPTIMIZED OUTLINE</strong>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={handleCopy} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 10 }}>
                      {copied ? '✓ COPIED' : 'COPY'}
                    </button>
                    <button onClick={handleUseImproved} style={{ background: 'rgba(0, 240, 255, 0.1)', border: '1px solid #00f0ff', color: '#00f0ff', padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 10 }}>
                      INSERT ↑
                    </button>
                  </div>
                </div>
                <pre style={{
                  margin: 0, padding: '10px', borderRadius: 4, fontSize: 11,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, fontFamily: 'monospace', color: '#cbd5e1'
                }}>
                  {review.improvedPrompt}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: SESSION PLANNER */}
      {activeTab === 'session' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!sessionPlan ? (
            <div className="jarvis-card">
              <h3 className="hud-font" style={{ margin: '0 0 6px', fontSize: 11, color: '#00f0ff' }}>INITIALIZE SESSION PROTOCOL</h3>
              <p style={{ margin: '0 0 10px', fontSize: 11, opacity: 0.7 }}>Define your high-level goal, and JARVIS will generate a structured checklist of tasks.</p>
              
              <textarea
                rows={4}
                value={sessionGoal}
                onChange={(e) => setSessionGoal(e.target.value)}
                placeholder="e.g. Add JWT auth with middleware and store active session in context..."
                className="cyber-input"
                style={{ resize: 'vertical' }}
              />

              <button
                onClick={handleGenerateSessionPlan}
                disabled={sessionLoading || !sessionGoal.trim()}
                className="cyber-btn"
                style={{ marginTop: 8 }}
              >
                {sessionLoading ? '⟳  CALCULATING ARCHITECTURE PLAN...' : '📋  GENERATE SESSION PLAN'}
              </button>
            </div>
          ) : (
            <div className="jarvis-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 9, fontFamily: 'Orbitron', color: '#ffb700' }}>SESSION PLAN ACTIVE</span>
                  <h3 style={{ margin: '2px 0 4px', fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>{sessionPlan.goal}</h3>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>Duration: {sessionPlan.estimatedDuration}</span>
                </div>
                <button 
                  onClick={handleResetSession}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'Orbitron' }}
                >
                  <RefreshCw size={10} /> RESET
                </button>
              </div>

              {/* Progress Tracker */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span className="hud-font" style={{ color: '#00f0ff', fontSize: 10 }}>PROGRESS TELEMETRY</span>
                  <span>{completedTasks}/{totalTasks} ({completionPercentage}%)</span>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${completionPercentage}%`, 
                    background: '#00ff66', 
                    height: '100%', 
                    transition: 'width 0.3s ease',
                    boxShadow: '0 0 6px rgba(0, 255, 102, 0.5)'
                  }} />
                </div>
              </div>

              {/* Task Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 4, background: 'rgba(0,0,0,0.1)' }}>
                {sessionPlan.tasks.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', opacity: 0.5, fontSize: 11 }}>
                    No tasks remaining. Add custom tasks below.
                  </div>
                ) : (
                  sessionPlan.tasks.map((task) => (
                    <div key={task.id} className="task-row" style={{ opacity: task.status === 'completed' ? 0.5 : 1 }}>
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        style={{ background: 'transparent', border: 'none', padding: 0, margin: '2px 0 0', cursor: 'pointer', color: task.status === 'completed' ? '#00ff66' : '#64748b' }}
                      >
                        {task.status === 'completed' ? (
                          <CheckSquare size={16} />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, color: task.status === 'completed' ? '#94a3b8' : '#e2e8f0', textDecoration: task.status === 'completed' ? 'line-through' : 'none', fontSize: 12 }}>
                            {task.title}
                          </span>
                          <span className={`hud-font badge-${task.difficulty}`} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2 }}>
                            {task.difficulty.toUpperCase()}
                          </span>
                        </div>
                        <p style={{ margin: '3px 0 0', fontSize: 11, opacity: 0.7, lineHeight: 1.4 }}>
                          {task.description}
                        </p>
                        <span style={{ fontSize: 9, opacity: 0.5, fontFamily: 'monospace', display: 'block', marginTop: 4 }}>
                          EST: {task.estimatedMinutes} mins | STATUS: {task.status === 'in_progress' ? 'RUNNING' : task.status.toUpperCase()}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ff0055', cursor: 'pointer', padding: 2 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add Custom Task Panel */}
              {showAddTask ? (
                <div className="jarvis-card" style={{ background: 'rgba(255,255,255,0.02)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h4 className="hud-font" style={{ margin: 0, fontSize: 10, color: '#00f0ff' }}>ADD CUSTOM SUBTASK</h4>
                  
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Task name..."
                    className="cyber-input"
                    style={{ padding: '4px 8px', fontSize: 12 }}
                  />

                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 9, opacity: 0.6, display: 'block', marginBottom: 2 }}>EST. MINUTES</label>
                      <input
                        type="number"
                        value={newTaskEst}
                        onChange={(e) => setNewTaskEst(parseInt(e.target.value) || 15)}
                        className="cyber-input"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 9, opacity: 0.6, display: 'block', marginBottom: 2 }}>DIFFICULTY</label>
                      <select
                        value={newTaskDiff}
                        onChange={(e: any) => setNewTaskDiff(e.target.value)}
                        className="cyber-input"
                        style={{ padding: '4px 8px', fontSize: 12, background: 'rgba(15,23,42,1)' }}
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button className="cyber-btn" onClick={handleAddTask} disabled={!newTaskTitle.trim()} style={{ padding: '4px 0', flex: 1 }}>
                      ADD
                    </button>
                    <button className="cyber-btn" onClick={() => setShowAddTask(false)} style={{ padding: '4px 0', flex: 1, borderColor: '#ff0055', color: '#ff0055' }}>
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddTask(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)', border: '1px dashed rgba(0, 240, 255, 0.25)',
                    color: '#00f0ff', borderRadius: 4, padding: '8px 0', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, fontFamily: 'Orbitron'
                  }}
                >
                  <Plus size={12} /> ADD SESSION SUBTASK
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: CHANGES */}
      {activeTab === 'changes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="jarvis-card">
            <h3 className="hud-font" style={{ margin: '0 0 6px', fontSize: 11, color: '#00f0ff' }}>WORKSPACE DIFF SCAN</h3>
            <p style={{ margin: '0 0 10px', fontSize: 11, opacity: 0.7 }}>Requests a review of all unstaged changes in the current workspace folder.</p>

            <button
              onClick={handleReviewChanges}
              disabled={loading}
              className="cyber-btn"
            >
              {loading ? '⟳  SCANNING WORKSPACE...' : '🔍  RUN DIAGNOSTIC CHECK'}
            </button>
          </div>

          {changeReview && (
            <div className="jarvis-card">
              <strong className="hud-font" style={{ fontSize: 10, color: '#00f0ff', display: 'block', marginBottom: 8 }}>DIAGNOSTIC REPORT</strong>
              <div style={{
                margin: 0, padding: '10px', borderRadius: 4, fontSize: 11,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, fontFamily: 'monospace', color: '#cbd5e1'
              }}>
                {changeReview}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: SOUND SETTINGS */}
      {activeTab === 'audio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="jarvis-card">
            <h3 className="hud-font" style={{ margin: '0 0 10px', fontSize: 11, color: '#00f0ff' }}>AUDIO ENGINE SETTINGS</h3>
            
            {/* Volume HUD */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>SIGNAL OUTPUT VOLUME</span>
                <span style={{ color: '#00f0ff', fontFamily: 'monospace' }}>{Math.round(volume * 100)}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {muted ? (
                  <VolumeX size={16} style={{ color: '#ff0055', cursor: 'pointer' }} onClick={() => setMuted(false)} />
                ) : (
                  <Volume2 size={16} style={{ color: '#00f0ff', cursor: 'pointer' }} onClick={() => setMuted(true)} />
                )}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  style={{
                    flex: 1,
                    height: 4,
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 2,
                    outline: 'none',
                    accentColor: '#00f0ff',
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>

            {/* Diagnostics HUD Panel */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
              <h4 className="hud-font" style={{ margin: '0 0 8px', fontSize: 10, color: '#ffb700' }}>COMPILER COGNITION</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.6 }}>Active Vibe Loop:</span>
                  <strong className="hud-font" style={{ color: vibeState.vibe === 'chaos' ? '#ff0055' : vibeState.vibe === 'fire' ? '#00ff66' : '#00f0ff' }}>
                    {vibeState.vibe.toUpperCase()}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.6 }}>Compiler Score:</span>
                  <strong>{vibeState.score !== null ? `${vibeState.score}/100` : 'N/A (No File)'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.6 }}>Workspace Errors:</span>
                  <span style={{ color: vibeState.errorsCount > 0 ? '#ff0055' : '#00ff66' }}>{vibeState.errorsCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.6 }}>Workspace Warnings:</span>
                  <span style={{ color: vibeState.warningsCount > 0 ? '#ffb700' : '#00ff66' }}>{vibeState.warningsCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="jarvis-card">
            <h4 className="hud-font" style={{ margin: '0 0 6px', fontSize: 10, color: '#00f0ff' }}>HUD BROADCAST MATRIX</h4>
            <p style={{ margin: 0, fontSize: 10, opacity: 0.5, lineHeight: 1.4 }}>
              JARVIS synthesizes low-frequency bio-ambient waveforms depending on editor state. Fire loops stimulate high concentration, whilst Chaos loops flash alerts to clear high-severity compilation bottlenecks.
            </p>
          </div>
        </div>
      )}
      <GenoukPet />
    </div>
  );
};

const GenoukPet = () => {
  const images = window.PET_IMAGES || [];
  const videoUrl = window.PET_VIDEO || '';
  const walkSpriteUrl = window.PET_WALK_SPRITE || '';

  const [greetingText, setGreetingText] = useState(greetings[0]);
  const [greetingVisible, setGreetingVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [videoActive, setVideoActive] = useState(!!videoUrl);
  const [showRobot, setShowRobot] = useState(!videoUrl);

  // Animation controller states
  const [isPlaying, setIsPlaying] = useState(true);
  const [fps, setFps] = useState(12);
  const [currentFrame, setCurrentFrame] = useState(0);

  // Sprite dimensions
  const frameWidth = 128;
  const frameHeight = 128;
  const columns = 5;
  const frameCount = 25;
  
  // Display scale — bigger = larger sprite on screen
  const displayScale = 2.5;
  const displayWidth = frameWidth * displayScale;
  const displayHeight = frameHeight * displayScale;

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

  // Handle animation loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = 1000 / fps;
    const timer = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % frameCount);
    }, interval);
    return () => clearInterval(timer);
  }, [isPlaying, fps]);

  // Trigger a reaction on click
  const handleRobotClick = () => {
    // Pick a random greeting
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    setGreetingText(randomGreeting);
    setGreetingVisible(true);
  };

  const col = currentFrame % columns;
  const row = Math.floor(currentFrame / columns);

  // CSS background-image sprite approach: position the sheet so only the target frame shows.
  // bgPos offsets move the sheet left/up to reveal the correct column/row.
  const bgPosX = -(col * displayWidth);
  const bgPosY = -(row * displayHeight);
  // background-size must be the full scaled sheet dimensions
  const bgSizeW = columns * displayWidth;           // 5 cols × 192px = 960px
  const bgSizeH = (frameCount / columns) * displayHeight; // 5 rows × 192px = 960px

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: 'auto',
      marginTop: '20px',
      overflow: 'hidden',
      background: 'transparent',
      fontFamily: 'var(--vscode-font-family, system-ui, -apple-system, sans-serif)',
      position: 'relative',
      padding: '16px 8px',
      boxSizing: 'border-box',
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
          top: '60px',
        }}
      />

      {/* Speech bubble */}
      <div style={{ height: '70px', display: 'flex', alignItems: 'flex-end', marginBottom: '8px', zIndex: 2 }}>
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

      {/* Content Container (holds either the Video or the Sprite Robot) */}
      <div style={{
        position: 'relative',
        width: '95%',
        maxWidth: '280px',
        height: '340px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
        marginBottom: '10px',
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
                animate={{
                  y: [0, -8, 0],
                }}
                transition={{
                  y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={handleRobotClick}
                style={{
                  // Viewport: exactly one frame wide and tall
                  width: `${displayWidth}px`,
                  height: `${displayHeight}px`,
                  flexShrink: 0,
                  cursor: 'pointer',
                  userSelect: 'none',
                  // CSS background-image sprite: crop to one frame via background-position
                  backgroundImage: walkSpriteUrl ? `url('${walkSpriteUrl}')` : 'none',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: `${bgSizeW}px ${bgSizeH}px`,
                  backgroundPosition: `${bgPosX}px ${bgPosY}px`,
                  imageRendering: 'pixelated',
                  filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.3))',
                }}
              />
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
          marginBottom: '12px',
          zIndex: 0,
        }}
      />
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

