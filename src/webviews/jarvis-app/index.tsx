import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Sparkles, ListTodo, GitBranch, Volume2, VolumeX, AlertCircle, Play, Compass, LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

import { t } from './theme';
import { PromptReviewResult, SessionPlan, CodebaseTour, VibeState } from './types';
import { PromptTab } from './PromptTab';
import { ChangesTab } from './ChangesTab';
import { SessionTab } from './SessionTab';
import { TourTab } from './TourTab';
import { AudioTab } from './AudioTab';
import { Mascot, MascotMessage } from './Mascot';
import { FocusTimerCard } from './FocusTimerCard';
import { useFocusTimer, FocusPhase } from './useFocusTimer';
import { ensureAudio, setMasterVolume, playForScore, playTier, MusicCue, MusicTier } from './musicEngine';
import { PlannerView } from './PlannerView';

const BREAK_NUDGES = [
  'Break time! Stand up and stretch. 🧘',
  "You've earned a breather — hydrate. 💧",
  'Rest your eyes: look 20ft away for 20 seconds. 👀',
  'Step away for a moment, the code will wait. ☕',
  'Roll your shoulders and breathe. Back in a bit. 🌿',
];

declare const window: any;

type TabId = 'prompts' | 'session' | 'tour' | 'changes' | 'audio';

const TABS: { id: TabId; label: string; Icon: LucideIcon }[] = [
  { id: 'prompts', label: 'Prompts', Icon: Sparkles },
  { id: 'session', label: 'Session', Icon: ListTodo },
  { id: 'tour', label: 'Tour', Icon: Compass },
  { id: 'changes', label: 'Changes', Icon: GitBranch },
  { id: 'audio', label: 'Sounds', Icon: Volume2 },
];

const GLOBAL_CSS = `
  @keyframes genouk-spin { to { transform: rotate(360deg); } }
  body { margin: 0; }
  .genouk-root ::-webkit-scrollbar { width: 10px; }
  .genouk-root ::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background, rgba(128,128,128,0.4)); border-radius: 5px; }
  .genouk-root ::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground, rgba(128,128,128,0.6)); }
  .genouk-root textarea:focus, .genouk-root input:focus, .genouk-root select:focus {
    border-color: var(--vscode-focusBorder, #007fd4) !important;
  }
`;

const App = () => {
  const vsCodeRef = useRef<any>(null);
  if (!vsCodeRef.current) vsCodeRef.current = window.acquireVsCodeApi();
  const vscode = vsCodeRef.current;

  const [activeTab, setActiveTab] = useState<TabId>('prompts');

  // Prompt review
  const [prompt, setPrompt] = useState('');
  const [review, setReview] = useState<PromptReviewResult | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);

  // Change review
  const [changeReview, setChangeReview] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);

  // Session
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Codebase tour
  const [tour, setTour] = useState<CodebaseTour | null>(null);
  const [tourLoading, setTourLoading] = useState(false);

  // Live (narrated) tour playback
  const [tourPlaying, setTourPlaying] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [activeStop, setActiveStop] = useState<number | null>(null);
  const [walkSignal, setWalkSignal] = useState(0);

  // Mascot speech (focus-timer reminders + task nudges)
  const [mascotSay, setMascotSay] = useState<MascotMessage | null>(null);
  const sayNonce = useRef(0);
  const sessionPlanRef = useRef<SessionPlan | null>(null);
  useEffect(() => { sessionPlanRef.current = sessionPlan; }, [sessionPlan]);

  const speak = (text: string) => {
    sayNonce.current += 1;
    setMascotSay({ text, nonce: sayNonce.current });
  };

  /** First in-progress task, else first todo, else null. */
  const nextTaskTitle = (): string | null => {
    const plan = sessionPlanRef.current;
    if (!plan) return null;
    const inProgress = plan.tasks.find((x) => x.status === 'in_progress');
    if (inProgress) return inProgress.title;
    const todo = plan.tasks.find((x) => x.status === 'todo');
    return todo ? todo.title : null;
  };

  const handlePhaseEnd = (_ended: FocusPhase, next: FocusPhase) => {
    if (next === 'break') {
      speak(BREAK_NUDGES[Math.floor(Math.random() * BREAK_NUDGES.length)]);
    } else {
      const task = nextTaskTitle();
      speak(task ? `Break's over. Next up: ${task}` : "Break's over — let's get back to it. 🚀");
    }
  };

  const timer = useFocusTimer(handlePhaseEnd);

  /** Start the timer and have Genouk announce the current focus task. */
  const startFocus = () => {
    timer.start();
    if (timer.phase === 'focus') {
      const task = nextTaskTitle();
      speak(task ? `Focus time. Work on: ${task}` : "Focus time — let's go. 💪");
    }
  };

  // Audio + diagnostics
  const [audioUris, setAudioUris] = useState<Record<string, string>>({});
  const [volume, setVolume] = useState(0.4);
  const [muted, setMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(true);
  const [vibe, setVibe] = useState<VibeState>({ score: null, vibe: 'idle', errorsCount: 0, warningsCount: 0, fileName: '' });

  // Last score-reactive music phrase that played (synthesized live, see musicEngine).
  const [musicCue, setMusicCue] = useState<MusicCue | null>(null);

  // Latest playSFX event, surfaced to the Mascot. nonce makes repeats re-trigger.
  const [sfx, setSfx] = useState<{ kind: string; nonce: number } | null>(null);

  // A review the user just triggered — sends Genouk over to "press" that button.
  const [errand, setErrand] = useState<{ kind: string; nonce: number } | null>(null);

  const [error, setError] = useState('');

  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const sfxAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrisRef = useRef<Record<string, string>>({});
  const volumeRef = useRef(0.4);
  const mutedRef = useRef(false);

  useEffect(() => { audioUrisRef.current = audioUris; }, [audioUris]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // Host -> webview messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'audioUris':
          setAudioUris(message.value);
          break;
        case 'updateVibe':
          setVibe(message.value);
          break;
        case 'playSFX': {
          setSfx({ kind: message.value, nonce: Date.now() });
          const url = audioUrisRef.current[message.value];
          if (url && sfxAudioRef.current) {
            sfxAudioRef.current.src = url;
            sfxAudioRef.current.volume = volumeRef.current * (mutedRef.current ? 0 : 1);
            sfxAudioRef.current.currentTime = 0;
            sfxAudioRef.current.play().catch(() => {});
          }
          break;
        }
        case 'sessionPlan':
          setSessionPlan(message.value);
          setSessionLoading(false);
          break;
        case 'tourResult':
          setTour(message.value);
          setTourLoading(false);
          break;
        case 'promptReviewResult':
          setReview(message.value);
          setPromptLoading(false);
          // Play a synthesized phrase that matches how good the prompt scored.
          if (typeof message.value?.score === 'number') {
            setMusicCue(playForScore(message.value.score));
          }
          break;
        case 'changeReviewResult':
          setChangeReview(message.value);
          setChangeLoading(false);
          break;
        case 'error':
          setError(message.value);
          setPromptLoading(false);
          setChangeLoading(false);
          setSessionLoading(false);
          setTourLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    backgroundAudioRef.current = new Audio();
    sfxAudioRef.current = new Audio();
    vscode.postMessage({ type: 'getAudioUris' });
    vscode.postMessage({ type: 'getSessionPlan' });
    vscode.postMessage({ type: 'getTour' });

    return () => {
      window.removeEventListener('message', handleMessage);
      backgroundAudioRef.current?.pause();
      sfxAudioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (backgroundAudioRef.current) backgroundAudioRef.current.volume = volume * (muted ? 0 : 1);
    // Keep the synthesized score-music at the same level as the rest of the audio.
    setMasterVolume(volume, muted);
  }, [volume, muted]);

  // Background loop cross-fade on vibe change
  useEffect(() => {
    const url = audioUris[vibe.vibe];
    if (!url || !backgroundAudioRef.current) return;
    const bgAudio = backgroundAudioRef.current;

    if (!bgAudio.src || bgAudio.src === '' || bgAudio.src === window.location.href) {
      bgAudio.src = url;
      bgAudio.loop = true;
      bgAudio.volume = volume * (muted ? 0 : 1);
      bgAudio.play().then(() => setAudioUnlocked(true)).catch(() => setAudioUnlocked(false));
      return;
    }

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
            if (fadeInVol >= volume) clearInterval(fadeInInterval);
          }, 25);
        }).catch(() => setAudioUnlocked(false));
      }
    }, 25);

    return () => clearInterval(fadeOutInterval);
  }, [vibe.vibe, audioUris]);

  const unlockAudio = () => {
    backgroundAudioRef.current?.play().then(() => setAudioUnlocked(true)).catch(() => {});
  };

  const handleReviewPrompt = () => {
    if (!prompt.trim()) return;
    // This click is our user gesture — unlock Web Audio now so the score phrase can
    // play the moment the review returns. Also sync the master volume on first start.
    ensureAudio().then(() => setMasterVolume(volume, muted)).catch(() => {});
    setPromptLoading(true);
    setError('');
    setReview(null);
    setErrand({ kind: 'reviewPrompt', nonce: Date.now() });
    vscode.postMessage({ type: 'reviewPrompt', value: prompt });
  };

  const handleReviewChanges = () => {
    setChangeLoading(true);
    setError('');
    setChangeReview('');
    setErrand({ kind: 'reviewChanges', nonce: Date.now() });
    vscode.postMessage({ type: 'reviewChanges' });
  };

  const handleGenerateSession = (goal: string) => {
    if (!goal.trim()) return;
    setSessionLoading(true);
    setError('');
    setSessionPlan(null);
    setErrand({ kind: 'generateSession', nonce: Date.now() });
    vscode.postMessage({ type: 'generateSessionPlan', value: goal });
  };

  const handleSaveSession = (plan: SessionPlan | null) => {
    setSessionPlan(plan);
    vscode.postMessage({ type: 'saveSessionPlan', value: plan });
  };

  const handleGenerateTour = (description: string) => {
    setTourLoading(true);
    setError('');
    setTour(null);
    vscode.postMessage({ type: 'generateTour', value: description });
  };

  const handleResetTour = () => {
    setTour(null);
  };

  const handleOpenFile = (file: string) => {
    vscode.postMessage({ type: 'openFile', value: file });
  };

  const startLiveTour = () => {
    if (!tour || tour.stops.length === 0) return;
    setActiveTab('tour');
    setTourStep(0);
    setTourPlaying(true);
  };

  const stopLiveTour = () => {
    setTourPlaying(false);
    setActiveStop(null);
  };

  // Drive the narrated tour: each step switches to the Tour tab, opens the stop's
  // file, makes Genouk walk + speak, then schedules the next step. Reading time
  // scales with the blurb length.
  useEffect(() => {
    if (!tourPlaying || !tour || tour.stops.length === 0) return;

    if (tourStep >= tour.stops.length) {
      speak("That's the whole tour — you're all caught up. 🎉");
      setTourPlaying(false);
      setActiveStop(null);
      return;
    }

    const stop = tour.stops[tourStep];
    setActiveStop(tourStep);
    setActiveTab('tour');
    if (stop.file) vscode.postMessage({ type: 'revealInFile', value: { file: stop.file, symbol: stop.symbol } });
    setWalkSignal(Date.now());
    speak(`Stop ${tourStep + 1} of ${tour.stops.length} — ${stop.title}. ${stop.what}`);

    const words = `${stop.title} ${stop.what}`.split(/\s+/).length;
    const ms = Math.min(17000, Math.max(7000, words * 360));
    const id = window.setTimeout(() => setTourStep((s) => s + 1), ms);
    return () => clearTimeout(id);
  }, [tourPlaying, tourStep, tour]);

  return (
    <div
      className="genouk-root"
      style={{
        fontFamily: t.font.ui,
        color: t.color.fg,
        background: t.color.bg,
        padding: `${t.space.md}px ${t.space.md}px 0`,
        fontSize: t.font.size.md,
        lineHeight: 1.5,
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />

      {/* Audio unlock overlay */}
      {!audioUnlocked && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'var(--vscode-editor-background, rgba(0,0,0,0.92))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: t.space.lg,
          }}
        >
          <div style={{ maxWidth: 260, textAlign: 'center', background: t.color.surface, border: `1px solid ${t.color.border}`, borderRadius: t.radius.md, padding: t.space.lg }}>
            <h3 style={{ margin: `0 0 ${t.space.sm}px`, fontSize: t.font.size.md, color: t.color.fg }}>Enable sound?</h3>
            <p style={{ fontSize: t.font.size.base, color: t.color.muted, margin: `0 0 ${t.space.md}px`, lineHeight: 1.5 }}>
              Browsers block autoplay until you interact. Click to start Genouk's ambient audio.
            </p>
            <button
              onClick={unlockAudio}
              style={{ display: 'inline-flex', alignItems: 'center', gap: t.space.xs, background: t.color.accentBg, color: t.color.accentFg, border: 'none', borderRadius: t.radius.sm, padding: '6px 14px', cursor: 'pointer', fontSize: t.font.size.md }}
            >
              <Play size={12} fill="currentColor" /> Enable
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.space.md }}>
        <h1 style={{ margin: 0, fontSize: t.font.size.lg, fontWeight: t.font.weight.semibold, color: t.color.fg, letterSpacing: 0.2 }}>
          Genouk
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: t.space.sm }}>
          <button
            onClick={() => setMuted(!muted)}
            title={muted ? 'Unmute' : 'Mute'}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted ? t.color.bad : t.color.muted, padding: 0, display: 'flex' }}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <span style={{ fontSize: t.font.size.xs, fontFamily: t.font.mono, color: t.color.muted }}>v0.0.1</span>
        </div>
      </div>

      {/* Genouk character — docked at the top so he's front and centre */}
      <Mascot
        vibe={vibe}
        thinking={promptLoading || changeLoading || sessionLoading}
        review={review}
        changeReview={changeReview}
        sessionPlan={sessionPlan}
        sfx={sfx}
        errand={errand}
        say={mascotSay}
        walkSignal={walkSignal}
        onDoubleActivate={() => {
          setActiveTab('prompts');
          handleReviewPrompt();
        }}
      />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.color.border}`, marginBottom: t.space.md }}>
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? t.color.accent : 'transparent'}`,
                color: active ? t.color.fg : t.color.muted,
                padding: '8px 4px',
                cursor: 'pointer',
                fontSize: t.font.size.sm,
                fontWeight: active ? t.font.weight.semibold : t.font.weight.normal,
                fontFamily: t.font.ui,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                marginBottom: -1,
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </div>

      {error && (
        <div
          style={{
            marginBottom: t.space.md,
            padding: `8px 10px`,
            borderRadius: t.radius.sm,
            background: t.color.errorBg,
            border: `1px solid ${t.color.errorBorder}`,
            color: t.color.fg,
            fontSize: t.font.size.base,
            display: 'flex',
            gap: t.space.sm,
            alignItems: 'flex-start',
          }}
        >
          <AlertCircle size={14} style={{ color: t.color.bad, flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      {/* Tab content — keyed so motion replays on switch */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: t.motion.base }}
      >
        {activeTab === 'prompts' && (
          <PromptTab prompt={prompt} setPrompt={setPrompt} review={review} setReview={setReview} loading={promptLoading} onReview={handleReviewPrompt} />
        )}
        {activeTab === 'session' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
            <FocusTimerCard timer={timer} onStart={startFocus} />
            <SessionTab
              plan={sessionPlan}
              loading={sessionLoading}
              onGenerate={handleGenerateSession}
              onSave={handleSaveSession}
              onPopout={() => vscode.postMessage({ type: 'openPlanner' })}
            />
          </div>
        )}
        {activeTab === 'tour' && (
          <TourTab
            tour={tour}
            loading={tourLoading}
            onGenerate={handleGenerateTour}
            onReset={handleResetTour}
            onOpenFile={handleOpenFile}
            playing={tourPlaying}
            activeStop={activeStop}
            onPlay={startLiveTour}
            onStop={stopLiveTour}
          />
        )}
        {activeTab === 'changes' && (
          <ChangesTab changeReview={changeReview} loading={changeLoading} onReview={handleReviewChanges} />
        )}
        {activeTab === 'audio' && (
          <AudioTab
            volume={volume}
            setVolume={setVolume}
            muted={muted}
            setMuted={setMuted}
            vibe={vibe}
            musicCue={musicCue}
            onPreviewTier={(tier: MusicTier) => {
              ensureAudio()
                .then(() => { setMasterVolume(volume, muted); setMusicCue(playTier(tier)); })
                .catch(() => {});
            }}
          />
        )}
      </motion.div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(window.GENOUK_VIEW === 'planner' ? <PlannerView /> : <App />);
