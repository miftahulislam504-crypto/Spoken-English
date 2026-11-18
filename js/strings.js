// English UI string catalog. All user-facing interface text lives here (plan section 4).
// Lesson content and Bengali teaching explanations are kept separately, never in this file.
export const LOCALE = { ui_locale: 'en', target_language: 'en' };

export const S = {
  appName: 'Spoken English Coach', home: 'Home', learn: 'Learn', speak: 'AI Speak', listening: 'Listening',
  progress: 'Progress', settings: 'Settings', profile: 'Profile and settings', back: 'Back', phase: 'Phase',
  hello: 'Hello', level: 'Current level', starter: 'Pre-A1 / Starter',
  continueLearning: 'Continue Learning', continueEmpty: 'Your learning path will appear here after setup.',
  startSpeaking: 'Start Speaking', startHint: 'Practice a short guided conversation.',
  dailyGoal: 'Daily Goal', minutes: 'minutes', today: 'minutes practiced today',
  recommended: 'Recommended review', recommendedEmpty: 'Mistakes you make will be collected here so you can review them.',
  weekly: 'Weekly summary', weeklyEmpty: 'Your practice summary appears after your first week.',
  learnIntro: 'Structured lessons, from your first greeting to full conversations.',
  speakIntro: 'Speak with your AI coach. Beginners start with guided conversations.',
  listeningIntro: 'Train your ear with short clips at slow, normal, and natural speed.',
  progressIntro: 'Estimates based on your practice. They show direction, not exact scores.',
  sections: 'Sections', modes: 'Modes',
  displayName: 'Display name', explanationLanguage: 'Explanation language', bengaliSupport: 'Bengali support level',
  accent: 'English accent for listening', reminders: 'Daily practice reminder',
  prefsNote: 'Changes are saved on this device automatically.', moreSettings: 'More settings',
  optBengali: 'Bengali', optEnglish: 'English', optFull: 'Full support', optSome: 'Some support', optMinimal: 'Minimal support',
  optMixed: 'Mixed accents', optAmerican: 'American', optBritish: 'British'
};

// [label, phase in which the section becomes functional] (see progress.md)
export const SECTIONS = {
  learn: [['Learning Path', 3], ['Courses', 3], ['Lessons', 3], ['Grammar in Context', 3], ['Vocabulary', 8],
          ['Sentence Patterns', 3], ['Practice Exercises', 3], ['Review Queue', 8], ['Bookmarks', 8]],
  speak: [['Guided Conversation', 6], ['Roleplay', 6], ['Free Conversation', 6], ['Repeat After Me', 7],
          ['Answer a Question', 6], ['Review My Mistakes', 8]],
  listening: [['Beginner Dialogues', 4], ['Listen and Choose', 4], ['Listen and Answer', 4], ['Dictation', 4],
              ['Short Stories', 4], ['Everyday Conversations', 4], ['Slow / Normal / Natural Speed', 4], ['Accent Exposure', 4]],
  progress: [['Overall Learning Summary', 9], ['Listening Comprehension', 9], ['Sentence Formation', 9], ['Grammar Accuracy', 9],
             ['Speaking Fluency', 9], ['Pronunciation / Intelligibility', 9], ['Vocabulary in Use', 9], ['Mistake Trends', 9],
             ['Weekly Report', 9], ['Learning Streak and Practice Time', 9]],
  settings: [['Profile and learning goals', 2], ['Audio and microphone permissions', 2], ['Subscription and billing', 10],
             ['Privacy and data controls', 12], ['Downloaded lessons', 12], ['Help and feedback', 12], ['Account deletion', 5]]
};

export const t = (k) => (k in S ? S[k] : k);
