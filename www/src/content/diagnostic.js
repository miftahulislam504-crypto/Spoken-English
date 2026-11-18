// Placement check tasks (plan section 5). Correct answer = index into options.
export const tasks = [
  { id: 'd1', skill: 'listening', type: 'listen_choose', audio_en: 'Hello, how are you?', prompt_en: 'Listen. Choose the best reply.', hint_bn: 'শুনুন এবং সবচেয়ে ভালো উত্তরটি বেছে নিন।', options: ['My name is Rahim.', 'I am fine, thank you.', 'It is Monday.'], answer: 1 },
  { id: 'd2', skill: 'vocabulary', type: 'meaning', text_en: 'I am a student.', prompt_en: 'What does this sentence mean?', hint_bn: 'বাক্যটির অর্থ কী?', options: ['আমি একজন শিক্ষক।', 'আমি একটি বই।', 'আমি একজন ছাত্র।'], answer: 2 },
  { id: 'd3', skill: 'sentence', type: 'answer', text_en: 'What is your name?', prompt_en: 'Someone asks you this. Choose the best answer.', hint_bn: 'কেউ আপনার নাম জানতে চাইছে। সঠিক উত্তর বেছে নিন।', options: ['I am fine.', 'Yes, please.', 'My name is Rahim.'], answer: 2 },
  { id: 'd4', skill: 'speaking', type: 'repeat', audio_en: 'Nice to meet you.', prompt_en: 'Listen, then say it aloud.', hint_bn: 'শুনুন, তারপর জোরে বলুন।' }
];
