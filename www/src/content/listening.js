// Listening content (plan sections 3.4 and 6.3). audio_source records where each clip comes from (see docs/audio-licensing.md).
export const SECTIONS = ['dialogues', 'conversations', 'choose', 'answer', 'dictation', 'stories'];
export const SPEED_SAMPLE = 'Excuse me. Could you tell me the way to the station, please?';
export const ACCENT_PHRASES = ['Excuse me, could you help me, please?', 'I would like a cup of tea.', 'What time is it now?'];
const SRC = 'device-tts';
const who = (lines) => lines.map((text, i) => ({ who: i % 2 ? 'B' : 'A', text }));
const dlg = (id, section, title_en, level, lines, qs) => ({ id, section, kind: 'dialogue', title_en, level, lines: who(lines), qs, audio_source: SRC });
const clip = (id, title_en, level, audio, q) => ({ id, section: 'choose', kind: 'clip', title_en, level, audio, q, audio_source: SRC });
const ans = (id, title_en, level, audio, prompt, accept) => ({ id, section: 'answer', kind: 'answer', title_en, level, audio, prompt, accept, audio_source: SRC });
const dict = (id, title_en, level, sentences) => ({ id, section: 'dictation', kind: 'dictation', title_en, level, sentences, audio_source: SRC });
const story = (id, title_en, level, text, qs) => ({ id, section: 'stories', kind: 'story', title_en, level, text, qs, audio_source: SRC });

export const items = [
  dlg('ld1', 'dialogues', 'Meeting someone', 'Pre-A1', ['Hello. What is your name?', 'My name is Sara.', 'Nice to meet you, Sara.', 'Nice to meet you too.'],
    [['What is her name?', ['Rahim', 'Sara', 'Mina'], 1], ['What do they say to each other?', ['Good night', 'See you tomorrow', 'Nice to meet you'], 2]]),
  dlg('ld2', 'dialogues', 'Asking the time', 'Pre-A1', ['Excuse me. What time is it?', "It is six o'clock.", 'Thank you.', 'You are welcome.'],
    [['What time is it?', ["Five o'clock", "Six o'clock", "Seven o'clock"], 1], ['What does the second person say at the end?', ['Thank you.', 'You are welcome.', 'Goodbye.'], 1]]),
  dlg('ld3', 'dialogues', 'At the market', 'A1', ['How much is this?', 'It is forty taka.', 'That is too expensive.', 'Thirty-five taka, then.'],
    [['What is the first price?', ['Fourteen taka', 'Forty taka', 'Fifty taka'], 1], ['What does the buyer think?', ['It is cheap.', 'It is too expensive.', 'It is very good.'], 1]]),
  dlg('le1', 'conversations', 'On the bus', 'A1', ['Does this bus go to the station?', 'Yes, it does.', 'How long does it take?', 'About twenty minutes.'],
    [['Where does the bus go?', ['The market', 'The school', 'The station'], 2], ['How long does it take?', ['Two minutes', 'Twenty minutes', 'Fifty minutes'], 1]]),
  dlg('le2', 'conversations', 'On the phone', 'A1', ['Hello. Can I speak to Rahim, please?', 'Sorry, he is not here.', 'Can you ask him to call me?', 'Yes, of course.'],
    [['Who does the caller want to speak to?', ['Sara', 'The teacher', 'Rahim'], 2], ['What does the caller ask?', ['To bring tea', 'To call back', 'To open the door'], 1]]),
  dlg('le3', 'conversations', 'At a restaurant', 'A2', ['Can I have the menu, please?', 'Here you are.', 'I would like chicken and rice.', 'Anything to drink?', 'Water, please.'],
    [['What does the customer order to eat?', ['Fish and bread', 'Chicken and rice', 'Only tea'], 1], ['What does the customer drink?', ['Milk', 'Coffee', 'Water'], 2]]),
  clip('lc1', 'Turn left', 'Pre-A1', 'Where is the bank? Turn left at the school.', ['Where do you turn?', ['Right', 'Left', 'Straight'], 1]),
  clip('lc2', 'Breakfast time', 'Pre-A1', 'I get up at six and I eat breakfast at seven.', ['When does the speaker eat breakfast?', ['At six', 'At seven', 'At eight'], 1]),
  clip('lc3', 'At school', 'A1', 'She is not at home. She is at school.', ['Where is she?', ['At home', 'At work', 'At school'], 2]),
  clip('lc4', 'Tomorrow plan', 'A2', 'We will visit my uncle tomorrow.', ['When will they visit?', ['Today', 'Yesterday', 'Tomorrow'], 2]),
  ans('la1', 'Her name', 'Pre-A1', 'My name is Sara. I am from Dhaka.', 'Type her name.', ['Sara']),
  ans('la2', 'Family', 'A1', 'I have two brothers and one sister.', 'How many brothers does the speaker have? Type a number.', ['two', '2']),
  ans('la3', 'Shop hours', 'A1', "The shop opens at nine o'clock.", 'What time does the shop open? Type the number.', ['nine', '9', "nine o'clock", "9 o'clock"]),
  dict('lt1', 'Dictation 1', 'Pre-A1', ['I like tea and coffee.', 'Where is the bank?', 'She goes to school at eight.']),
  dict('lt2', 'Dictation 2', 'A1', ['Can you help me, please?', 'I am going to learn English.', 'We went to the market yesterday.']),
  story('ls1', 'A day with Rahim', 'A1', 'Rahim wakes up at six. He eats rice and fish. Then he goes to school by bus. In the evening he plays football with his friends.',
    [['What does Rahim eat?', ['Bread and tea', 'Rice and fish', 'Only milk'], 1], ['How does he go to school?', ['By boat', 'On foot', 'By bus'], 2], ['What does he do in the evening?', ['Reads a book', 'Plays football', 'Watches TV'], 1]]),
  story('ls2', 'The lost bag', 'A2', 'Mina lost her bag on the bus. She went to the bus station. A man helped her. He found the bag, and she said thank you.',
    [['Where did Mina lose her bag?', ['At school', 'On the bus', 'At home'], 1], ['Who helped her?', ['A teacher', 'A friend', 'A man'], 2]])
];
