/**
 * Genouk's lines, keyed by mood/context instead of one flat array. Pick a bank
 * with `quip(bank)` for a random line, or compose a contextual one (e.g. a prompt
 * score) inline at the call site. Keep lines short — they live in a small bubble.
 */
export type QuipBank =
  | 'greeting'
  | 'idle'
  | 'chill'
  | 'fire'
  | 'worried'
  | 'chaos'
  | 'sleep'
  | 'thinking'
  | 'cheer'
  | 'nod'
  | 'slump'
  | 'blocker'
  | 'clean'
  | 'save'
  | 'buildOk'
  | 'buildErr'
  | 'sessionDone'
  | 'sessionMilestone'
  | 'nudge';

export const QUIPS: Record<QuipBank, string[]> = {
  greeting: ["Hi, I'm Genouk! 👋", 'Back at it? Let me know if you want a prompt reviewed.'],

  // resting / mood
  idle: ['All quiet. Type something and I’ll help.', 'Standing by. 🟢'],
  chill: ['Clean editor. Nice. 🌿', 'No errors in sight — keep going.'],
  fire: ['You’re on a roll. 🔥', 'Shipping mode engaged.'],
  worried: ['A few things need a look.', 'Some warnings creeping in 👀'],
  chaos: ['Whoa — errors everywhere. Want a hand?', 'It’s getting spicy in here. 🌶️'],
  sleep: ['Zzz…', '😴'],

  // process
  thinking: ['Reading your repo…', 'Thinking…', 'Let me look at that…'],

  // prompt review reactions
  cheer: ['Strong prompt! 🎉', 'That one’s tight — send it.'],
  nod: ['Decent. The suggestions sharpen it.', 'Workable — tighten the edges.'],
  slump: ['Rough one — check the suggestions.', 'Let’s firm this prompt up.'],

  // change review reactions
  blocker: ['Found a blocker — don’t commit yet.', 'Hold up, there’s a blocker. 🛑'],
  clean: ['Diff looks clean. 👍', 'Nothing blocking — ship it.'],

  // save / build (playSFX)
  save: ['Saved.', '✍️'],
  buildOk: ['Build passed! 🎉', 'Green build. 🟢'],
  buildErr: ['Build broke. 🤦', 'Build failed — check the output.'],

  // session companion
  sessionDone: ['Task done! ✅', 'One down. 💪'],
  sessionMilestone: ['Halfway there. Keep going!', 'All tasks done — nice work! 🏁'],
  nudge: ['Want me to scan your changes before you commit?', 'Got a diff — review it before committing?'],
};

/** A random line from a bank. */
export function quip(bank: QuipBank): string {
  const lines = QUIPS[bank];
  return lines[Math.floor(Math.random() * lines.length)];
}

/** Map a 0-100 prompt score to a reaction bank. */
export function bankForScore(score: number): 'cheer' | 'nod' | 'slump' {
  if (score >= 80) return 'cheer';
  if (score >= 50) return 'nod';
  return 'slump';
}
