import re

with open('src/webviews/jarvis-app/Mascot.tsx', 'r') as f:
    content = f.read()

# First conflict
part1_head = re.search(r'<<<<<<< HEAD\n(type ReactionKind.*?)=======\n', content, re.DOTALL)
part1_remote = re.search(r'=======\n(.*?)>>>>>>> 0182a83a3e060d5e29601d69ae4c59ee66971538\n', content, re.DOTALL)

if part1_head and part1_remote:
    # merge the interfaces
    merged_1 = """export interface MascotMessage {
  text: string;
  nonce: number;
}

type ReactionKind = 'cheer' | 'nod' | 'slump' | 'alarmed' | 'thumbsup' | 'save' | 'buildErr' | 'stretch' | 'perk';

interface ReactionMotion {
  animate: Record<string, any>;
  duration: number;
}

const FULL_REACTIONS: Record<ReactionKind, ReactionMotion> = {
  cheer: { animate: { y: [0, -26, 0, -12, 0], scale: [1, 1.12, 1, 1.05, 1] }, duration: 1.4 },
  nod: { animate: { y: [0, -6, 0, -4, 0] }, duration: 1.0 },
  slump: { animate: { y: [0, 10, 8], scale: [1, 0.96, 0.97], rotate: [0, -2, -1] }, duration: 1.2 },
  alarmed: { animate: { x: [0, -7, 7, -6, 6, -3, 0], rotate: [0, -3, 3, 0] }, duration: 0.9 },
  thumbsup: { animate: { y: [0, -10, 0], scale: [1, 1.06, 1] }, duration: 0.8 },
  save: { animate: { scale: [1, 0.94, 1] }, duration: 0.5 },
  buildErr: { animate: { rotate: [0, -8, 6, -4, 0], y: [0, 4, 0] }, duration: 0.9 },
  stretch: { animate: { scaleY: [1, 0.85, 1.1, 1], y: [0, 4, -2, 0] }, duration: 0.9 },
  perk: { animate: { y: [0, -8, 0], scale: [1, 1.04, 1] }, duration: 0.5 },
};

const REDUCED_REACTIONS: Record<ReactionKind, ReactionMotion> = {
  cheer: { animate: { scale: [1, 1.06, 1] }, duration: 0.6 },
  nod: { animate: { scale: [1, 1.03, 1] }, duration: 0.5 },
  slump: { animate: { opacity: [1, 0.7, 0.88] }, duration: 0.7 },
  alarmed: { animate: { opacity: [1, 0.5, 1] }, duration: 0.6 },
  thumbsup: { animate: { scale: [1, 1.04, 1] }, duration: 0.5 },
  save: { animate: { opacity: [1, 0.8, 1] }, duration: 0.4 },
  buildErr: { animate: { opacity: [1, 0.5, 1] }, duration: 0.6 },
  stretch: { animate: { scale: [1, 1.04, 1] }, duration: 0.5 },
  perk: { animate: { scale: [1, 1.04, 1] }, duration: 0.5 },
};

interface MascotProps {
  vibe: keyof typeof VIBES;
  thinking: boolean;
  review: any | null;
  changeReview: any | null;
  sessionPlan: any | null;
  sfx: (name: string) => void;
  errand: { type: string } | null;
  say?: MascotMessage | null;
  onDoubleActivate?: () => void;
}

export const Mascot: React.FC<MascotProps> = ({ vibe, thinking, review, changeReview, sessionPlan, sfx, errand, say, onDoubleActivate }) => {
  const walkSpriteUrl = window.PET_WALK_SPRITE || '';
  const videoUrl = window.PET_VIDEO || '';
"""
    content = content[:part1_head.start() - 13] + merged_1 + content[part1_remote.end():]

# Read content again after first replacement
with open('src/webviews/jarvis-app/Mascot.tsx', 'w') as f:
    f.write(content)
