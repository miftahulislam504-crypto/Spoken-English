// Versioned lesson content (plan section 8). Stages follow the 6-stage structure in section 7.
export const courses = [
  { id: 'c1', title_en: 'Beginner Starter', description_en: 'Your first 30 days of English, one week at a time.', level: 'Pre-A1', content_version: 1, published_status: 'published' }
];
const review = { stage: 'review', type: 'review' };
export const v = (en, bn) => ({ en, bn });
export const warm = (prompt_en, options, answer) => ({ stage: 'warmup', type: 'choose', scored: false, prompt_en, options, answer });
export const hear = (audio_en, meaning_bn) => ({ stage: 'listen', type: 'listen', audio_en, meaning_bn });
export const teach = (grammar_en, pattern_en, examples_en, vocabulary, explanation_bn) => ({ stage: 'learn', type: 'teach', grammar_en, pattern_en, examples_en, vocabulary, explanation_bn });
export const say = (text_en) => ({ stage: 'speak', type: 'repeat', text_en });
export const pick = (prompt_en, options, answer, audio_en) => (audio_en ? { stage: 'practice', type: 'listen_choose', audio_en, prompt_en, options, answer } : { stage: 'practice', type: 'choose', prompt_en, options, answer });
export const order = (tiles, accept) => ({ stage: 'practice', type: 'order', prompt_en: 'Put the words in order.', tiles, accept });
export const write = (prompt_en, accept, hint_bn) => ({ stage: 'practice', type: 'type', prompt_en, accept, hint_bn });
export const own = (prompt_en, starts, min_words, example_en, contains) => ({ stage: 'practice', type: 'pattern', prompt_en, rule: { starts, min_words, contains }, example_en });
export const lesson = (id, week, seq, title_en, learning_objectives, prerequisite_lesson_ids, steps, level = 'Pre-A1') => ({
  id, course_id: 'c1', week, title_en, level, sequence_number: seq, learning_objectives, prerequisite_lesson_ids,
  estimated_duration_seconds: 600, content_version: 1, published_status: 'published', completion_criteria: { min_score: 0.6 }, steps: [...steps, review]
});
const TR = 'বাংলা থেকে ইংরেজিতে লিখুন।';

export const lessons = [
  // Week 1
  lesson('l1', 'w1', 1, 'Greetings and polite words', ['Say hello and goodbye', 'Ask and answer How are you?', 'Use please and thank you'], [], [
    warm('Which word is a greeting?', ['Window', 'Hello', 'Seven'], 1),
    hear('Hello! How are you?', 'হ্যালো! আপনি কেমন আছেন?'),
    teach('Greeting and replying', 'How are you? / I am fine, thank you.', ['Hello.', 'How are you?', 'I am fine, thank you.', 'Goodbye.'],
      [v('Hello', 'হ্যালো, নমস্কার'), v('Goodbye', 'বিদায়'), v('Please', 'অনুগ্রহ করে'), v('Thank you', 'ধন্যবাদ')],
      'দেখা হলে Hello বলুন। কেমন আছেন জানতে How are you? বলুন। উত্তরে বলুন I am fine, thank you.'),
    say('How are you?'),
    pick('Listen. Choose the best reply.', ['My name is Rahim.', 'I am fine, thank you.', 'Goodbye.'], 1, 'How are you?'),
    pick('You want to say thanks. What do you say?', ['Please.', 'Goodbye.', 'Thank you.'], 2),
    order(['am', 'thank', 'I', 'fine', 'you'], ['I am fine, thank you.']),
    write('Type a reply to: How are you?', ['I am fine, thank you', 'I am fine', 'I am good', 'I am well', 'Fine, thank you'], 'How are you? এর একটি উত্তর লিখুন।')
  ]),
  lesson('l2', 'w1', 2, 'Names and introductions', ['Say your name', 'Ask someone their name', 'Say Nice to meet you'], ['l1'], [
    warm('How do you reply to: How are you?', ['Goodbye.', 'I am fine, thank you.', 'Please.'], 1),
    hear('Hello. My name is Rahim.', 'হ্যালো। আমার নাম রহিম।'),
    teach('Telling your name', 'My name is + name / I am + name', ['My name is Rahim.', 'I am Rahim.', 'What is your name?', 'Nice to meet you.'],
      [v('name', 'নাম'), v('my', 'আমার'), v('your', 'আপনার')],
      "নিজের নাম বলতে 'My name is' বা 'I am' ব্যবহার করুন। অন্যের নাম জানতে 'What is your name?' জিজ্ঞেস করুন।"),
    say('My name is Rahim.'),
    pick('Listen. Choose the best answer.', ['I am fine.', 'My name is Rahim.', 'Thank you.'], 1, 'What is your name?'),
    pick('Someone says: Nice to meet you. What do you say?', ['Nice to meet you too.', 'Goodbye.', 'Please.'], 0),
    order(['is', 'name', 'My', 'Rahim'], ['My name is Rahim.']),
    own('Tell the AI your name.', ['my name is', 'i am'], 3, 'My name is Rahim.')
  ]),
  lesson('l4', 'w1', 3, 'Pronouns with am, is, are', ['Use I, you, he, she, we, they', 'Choose am, is or are'], ['l2'], [
    warm('How do you tell your name?', ['My name is Rahim.', 'Goodbye.', 'Please.'], 0),
    hear('I am a student. She is a teacher.', 'আমি একজন ছাত্র। সে একজন শিক্ষক।'),
    teach('Pronouns with am, is, are', 'I am / you are / he is / she is / we are / they are',
      ['I am a student.', 'You are a teacher.', 'He is my friend.', 'She is at home.', 'We are happy.', 'They are in Dhaka.'],
      [v('I', 'আমি'), v('you', 'তুমি, আপনি'), v('he', 'সে (পুরুষ)'), v('she', 'সে (নারী)'), v('we', 'আমরা'), v('they', 'তারা')],
      'I-এর সঙ্গে am, he/she-এর সঙ্গে is, আর you/we/they-এর সঙ্গে are বসে।'),
    say('She is a teacher.'),
    pick('Choose the correct word: He ___ my friend.', ['am', 'is', 'are'], 1),
    pick('Choose the correct word: They ___ happy.', ['is', 'am', 'are'], 2),
    order(['is', 'teacher', 'a', 'She'], ['She is a teacher.']),
    write('Write in English: আমরা খুশি।', ['We are happy'], TR)
  ]),
  lesson('l5', 'w1', 4, 'Yes/no questions', ['Ask yes/no questions with am, is, are', 'Give short answers'], ['l4'], [
    warm('Choose the correct word: I ___ a student.', ['am', 'is', 'are'], 0),
    hear('Are you a student? Yes, I am.', 'আপনি কি ছাত্র? হ্যাঁ, আমি ছাত্র।'),
    teach('Yes/no questions with am, is, are', 'Are you ...? Yes, I am. / No, I am not.',
      ['Are you a student?', 'Yes, I am.', 'No, I am not.', 'Is she a teacher?', 'Yes, she is.'],
      [v('yes', 'হ্যাঁ'), v('no', 'না'), v('not', 'না (নেতিবাচক)')],
      'প্রশ্নে am/is/are বাক্যের শুরুতে আসে। উত্তরে Yes বা No বলে ছোট উত্তর দিন।'),
    say('Are you a student?'),
    pick('Someone asks: Are you a student? Choose a short answer.', ['Yes, you are.', 'Yes, I am.', 'I am Rahim.'], 1),
    pick('Listen. What is the question about?', ['A book', 'A teacher', 'A day'], 1, 'Is she a teacher?'),
    order(['you', 'Are', 'a', 'student'], ['Are you a student?']),
    write('Answer with No: Is he a teacher?', ['No, he is not'], 'No দিয়ে উত্তর দিন।')
  ]),
  lesson('l6', 'w1', 5, 'Simple personal information', ['Say where you are from', 'Say your age and job'], ['l5'], [
    warm('Which one is a question?', ['I am a student.', 'Are you a student?', 'She is a teacher.'], 1),
    hear('I am from Bangladesh. I am twenty years old.', 'আমি বাংলাদেশ থেকে এসেছি। আমার বয়স কুড়ি বছর।'),
    teach('Talking about yourself', 'I am from + place. / I am + number + years old.',
      ['I am from Bangladesh.', 'I am twenty years old.', 'I am a student.', 'I am from Dhaka.'],
      [v('from', 'থেকে'), v('years old', 'বছর বয়স'), v('student', 'ছাত্র'), v('teacher', 'শিক্ষক')],
      "নিজের দেশ বা শহর বলতে 'I am from', বয়স বলতে 'I am ... years old' ব্যবহার করুন।"),
    say('I am from Bangladesh.'),
    pick('Listen. Choose the best answer.', ['I am twenty years old.', 'I am from Bangladesh.', 'I am a teacher.'], 1, 'Where are you from?'),
    pick('How do you say your age?', ['I am from twenty.', 'I am twenty years old.', 'I have twenty.'], 1),
    order(['from', 'am', 'I', 'Dhaka'], ['I am from Dhaka.']),
    own('Tell the AI where you are from.', ['i am from'], 4, 'I am from Bangladesh.')
  ]),
  lesson('l7', 'w1', 6, 'Numbers, days and classroom words', ['Count from one to ten', 'Say the days', 'Understand classroom instructions'], ['l6'], [
    warm('Which word is a number?', ['book', 'seven', 'window'], 1),
    hear('Open your book. Listen and repeat.', 'আপনার বই খুলুন। শুনুন এবং বলুন।'),
    teach('Numbers, days and classroom instructions', 'one, two, three ... ten / Monday ... Sunday',
      ['One, two, three.', 'Today is Friday.', 'Open your book.', 'Listen and repeat.'],
      [v('one', 'এক'), v('two', 'দুই'), v('three', 'তিন'), v('ten', 'দশ'), v('Monday', 'সোমবার'), v('Friday', 'শুক্রবার'), v('Sunday', 'রবিবার')],
      'এক থেকে দশ গুনতে শিখুন। দিনের নাম বড় হাতের অক্ষরে শুরু হয়। ক্লাসে শুনবেন Open your book, Listen, Repeat।'),
    say('Open your book.'),
    pick('Listen. Which day is it?', ['Monday', 'Friday', 'Sunday'], 1, 'Today is Friday.'),
    pick('The teacher says: Open your book. What do you do?', ['Open the book.', 'Close the door.', 'Sit down.'], 0),
    order(['is', 'Today', 'Monday'], ['Today is Monday.']),
    write('Write the number in English: 3', ['three'], 'সংখ্যাটি ইংরেজি শব্দে লিখুন।')
  ]),
  lesson('l8', 'w1', 7, 'Listening: short greetings', ['Understand greetings through the day', 'Reply to a short greeting'], ['l7'], [
    warm('Which word means goodbye?', ['Hello', 'Goodbye', 'Please'], 1),
    hear('Good morning. How are you today?', 'শুভ সকাল। আজ আপনি কেমন আছেন?'),
    teach('Greetings through the day', 'Good morning / Good afternoon / Good evening / Good night',
      ['Good morning.', 'Good afternoon.', 'Good evening.', 'Good night.', 'See you tomorrow.'],
      [v('morning', 'সকাল'), v('afternoon', 'দুপুর, বিকেল'), v('evening', 'সন্ধ্যা'), v('night', 'রাত')],
      'দিনের সময় অনুযায়ী শুভেচ্ছা বদলায়। রাতে বিদায়ের সময় Good night বলা হয়।'),
    say('Good morning.'),
    pick('Listen. When do we say this?', ['In the morning', 'In the evening', 'At night'], 1, 'Good evening.'),
    pick('Listen. Choose the best reply.', ['Good morning. I am fine.', 'Goodbye.', 'My name is Rahim.'], 0, 'Good morning. How are you?'),
    pick('Listen. What does it mean?', ['আবার কাল দেখা হবে', 'আজ রাতে দেখা হবে', 'আমি আপনাকে চিনি না'], 0, 'See you tomorrow.'),
    write('Write a greeting for the morning.', ['Good morning'], 'সকালের শুভেচ্ছা লিখুন।')
  ]),
  // Week 2
  lesson('l9', 'w2', 8, 'Common verbs and present simple', ['Use common verbs', 'Add s for he and she'], ['l8'], [
    warm('Choose the correct word: She ___ a teacher.', ['am', 'is', 'are'], 1),
    hear('I eat rice. She eats fish.', 'আমি ভাত খাই। সে মাছ খায়।'),
    teach('Present simple with common verbs', 'I / you / we / they + verb. He / she + verb + s',
      ['I eat rice.', 'You go to school.', 'She eats fish.', 'He reads a book.', 'They play football.'],
      [v('eat', 'খাওয়া'), v('go', 'যাওয়া'), v('read', 'পড়া'), v('play', 'খেলা')],
      'অভ্যাস বা সাধারণ সত্য বলতে present simple ব্যবহার হয়। he/she-এর সঙ্গে ক্রিয়ার শেষে s বসে।'),
    say('She eats fish.'),
    pick('Choose the correct sentence.', ['He eat rice.', 'He eats rice.', 'He eating rice.'], 1),
    pick('Listen. What do they play?', ['Cricket', 'Football', 'Chess'], 1, 'They play football.'),
    order(['reads', 'She', 'a', 'book'], ['She reads a book.']),
    write('Write in English: আমি ভাত খাই।', ['I eat rice'], TR)
  ], 'A1'),
  lesson('l10', 'w2', 9, 'Daily routines', ['Talk about your day', 'Say the time with at'], ['l9'], [
    warm('Choose the correct sentence.', ['I goes to school.', 'I go to school.', 'I going to school.'], 1),
    hear('I wake up at six. I go to work.', 'আমি ছয়টায় ঘুম থেকে উঠি। আমি কাজে যাই।'),
    teach('Talking about your day', 'I + verb + at + time',
      ['I wake up at six.', 'I eat breakfast at seven.', 'I go to school at eight.', 'I sleep at ten.'],
      [v('wake up', 'ঘুম থেকে ওঠা'), v('breakfast', 'সকালের নাস্তা'), v('sleep', 'ঘুমানো'), v('work', 'কাজ')],
      "সময় বলতে 'at' ব্যবহার করুন, যেমন at six।"),
    say('I wake up at six.'),
    pick('Listen. What time is breakfast?', ['At six', 'At seven', 'At eight'], 1, 'I eat breakfast at seven.'),
    pick('Choose the correct sentence.', ['I sleep at ten.', 'I sleep on ten.', 'I sleep ten at.'], 0),
    order(['school', 'I', 'to', 'go', 'at', 'eight'], ['I go to school at eight.']),
    own('Tell the AI one thing you do every day.', ['i'], 3, 'I wake up at six.')
  ], 'A1'),
  lesson('l11', 'w2', 10, 'Likes and dislikes', ['Say what you like', 'Say what you do not like'], ['l10'], [
    warm('Choose the correct word: She ___ tea.', ['like', 'likes', 'liking'], 1),
    hear('I like tea. I do not like coffee.', 'আমি চা পছন্দ করি। আমি কফি পছন্দ করি না।'),
    teach('Likes and dislikes', 'I like + noun. / I do not like + noun.',
      ['I like tea.', 'I do not like coffee.', 'She likes fish.', 'He does not like milk.'],
      [v('like', 'পছন্দ করা'), v('tea', 'চা'), v('coffee', 'কফি'), v('fish', 'মাছ')],
      'পছন্দ বোঝাতে like, অপছন্দ বোঝাতে do not like। he/she-এর সঙ্গে likes ও does not like।'),
    say('I like tea.'),
    pick('Choose the correct sentence.', ['I not like coffee.', 'I do not like coffee.', 'I am not like coffee.'], 1),
    pick('Listen. What does she like?', ['Tea', 'Fish', 'Milk'], 1, 'She likes fish.'),
    order(['not', 'I', 'do', 'like', 'coffee'], ['I do not like coffee.']),
    own('Tell the AI something you like.', ['i like'], 3, 'I like tea.')
  ], 'A1'),
  lesson('l3', 'w2', 11, 'Say what you want to do', ['Use I want to + verb', 'Make your own sentence'], ['l11'], [
    warm('Choose the correct sentence.', ['I like tea.', 'I tea like.', 'Like I tea.'], 0),
    hear('I want to learn English.', 'আমি ইংরেজি শিখতে চাই।'),
    teach('Saying what you want to do', 'I want to + verb', ['I want to learn English.', 'I want to speak English.', 'I want to eat rice.'],
      [v('learn', 'শেখা'), v('speak', 'বলা'), v('eat', 'খাওয়া')], "কী করতে চান বলতে 'I want to' এর পরে একটি ক্রিয়া বসান।"),
    say('I want to learn English.'),
    pick('Choose the correct sentence.', ['I want learn English.', 'I want to learn English.', 'I to want learn English.'], 1),
    order(['to', 'want', 'I', 'speak', 'English'], ['I want to speak English.']),
    write('Write in English: আমি ইংরেজি বলতে চাই।', ['I want to speak English', 'I want to speak in English'], TR),
    own('Tell the AI something you want to do.', ['i want to'], 4, 'I want to learn English.')
  ], 'A1'),
  lesson('l12', 'w2', 12, 'Question words', ['Ask with What, Where, Who, When, Why, How'], ['l3'], [
    warm('Choose the correct sentence.', ['I want to learn English.', 'I want learn English.', 'I to want learn English.'], 0),
    hear('What is your name? Where do you live?', 'আপনার নাম কী? আপনি কোথায় থাকেন?'),
    teach('Basic question words', 'What / Where / Who / When / Why / How + question',
      ['What is your name?', 'Where do you live?', 'Who is he?', 'When do you eat?', 'How are you?'],
      [v('what', 'কী'), v('where', 'কোথায়'), v('who', 'কে'), v('when', 'কখন'), v('why', 'কেন'), v('how', 'কেমন, কীভাবে')],
      'প্রশ্ন শুরু করতে What, Where, Who, When, Why, How ব্যবহার করুন।'),
    say('Where do you live?'),
    pick('Which word asks about a place?', ['Who', 'Where', 'When'], 1),
    pick('Listen. What does the question ask about?', ['A person', 'A time', 'A place'], 1, 'When do you eat?'),
    order(['is', 'What', 'name', 'your'], ['What is your name?']),
    write('Ask in English: তুমি কোথায় থাকো?', ['Where do you live'], TR)
  ], 'A1'),
  lesson('l13', 'w2', 13, 'Time and frequency', ['Say how often you do things', 'Say the time with o\'clock'], ['l12'], [
    warm('Which word asks about time?', ['Where', 'When', 'Who'], 1),
    hear('I always drink tea. I never drink coffee.', 'আমি সবসময় চা খাই। আমি কখনো কফি খাই না।'),
    teach('How often?', 'always / usually / sometimes / never + verb',
      ['I always drink tea.', 'I usually go at eight.', 'I sometimes read a book.', 'I never eat fish.', "It is six o'clock."],
      [v('always', 'সবসময়'), v('usually', 'সাধারণত'), v('sometimes', 'মাঝে মাঝে'), v('never', 'কখনো না'), v("o'clock", 'ঘড়িতে ... টা')],
      'কত ঘন ঘন কিছু করেন বোঝাতে always, usually, sometimes, never ক্রিয়ার আগে বসে।'),
    say('I usually go at eight.'),
    pick('Choose the correct sentence.', ['I always tea drink.', 'I always drink tea.', 'Always I drinks tea.'], 1),
    pick('Listen. What is the time?', ["Five o'clock", "Six o'clock", "Seven o'clock"], 1, "It is six o'clock."),
    order(['never', 'I', 'coffee', 'drink'], ['I never drink coffee.']),
    own('Tell the AI something you sometimes do.', ['i sometimes'], 4, 'I sometimes read a book.')
  ], 'A1'),
  lesson('l14', 'w2', 14, 'Short answers', ['Answer with Yes, I do / No, I do not', 'Use does for he and she'], ['l13'], [
    warm('Which word means "not ever"?', ['always', 'never', 'sometimes'], 1),
    hear('Do you like tea? Yes, I do.', 'আপনি কি চা পছন্দ করেন? হ্যাঁ, করি।'),
    teach('Short answers with do and does', 'Do you ...? Yes, I do. / No, I do not.',
      ['Do you like tea? Yes, I do.', 'Do you eat fish? No, I do not.', 'Does she read? Yes, she does.', 'Does he go? No, he does not.'],
      [v('do', 'করা (প্রশ্নে)'), v('does', 'করে (he/she-এর সঙ্গে)')],
      'Do/Does দিয়ে প্রশ্ন করলে উত্তরে Yes, I do বা No, I do not বলুন। he/she হলে does ব্যবহার করুন।'),
    say('Yes, I do.'),
    pick('Do you like tea? Choose a short answer.', ['Yes, I am.', 'Yes, I do.', 'Yes, I like.'], 1),
    pick('Does she read a book? Choose a short answer.', ['Yes, she does.', 'Yes, she do.', 'Yes, she is.'], 0),
    order(['do', 'No', 'I', 'not'], ['No, I do not.']),
    write('Answer with No: Do you eat fish?', ['No, I do not'], 'No দিয়ে উত্তর দিন।')
  ], 'A1'),
  lesson('l15', 'w2', 15, 'Listening: routine dialogues', ['Follow a short routine dialogue', 'Find the time and the answer'], ['l14'], [
    warm('Choose the correct sentence.', ['She go to work.', 'She goes to work.', 'She going to work.'], 1),
    hear('Do you wake up early? Yes, I always wake up at six.', 'আপনি কি ভোরে ওঠেন? হ্যাঁ, আমি সবসময় ছয়টায় উঠি।'),
    teach('Understanding routine dialogues', 'Question + short answer + detail',
      ['Do you wake up early? Yes, I do.', 'What time do you eat? At seven.', 'Do you go to school? No, I do not.'],
      [v('early', 'আগে, ভোরে'), v('late', 'দেরিতে'), v('every day', 'প্রতিদিন')],
      'সংলাপ শুনলে আগে প্রশ্নটি ধরুন, তারপর উত্তরের সময় বা তথ্য খুঁজুন।'),
    say('What time do you eat?'),
    pick('Listen. Does the speaker wake up early?', ['Yes', 'No', 'The speaker does not say'], 0, 'Do you wake up early? Yes, I do.'),
    pick('Listen. What time does the speaker eat?', ['At six', 'At seven', 'At eight'], 1, 'What time do you eat? At seven.'),
    pick('Listen. Does the speaker go to school?', ['Yes', 'No', 'Sometimes'], 1, 'Do you go to school? No, I do not.'),
    write('Write a short answer: Do you like tea?', ['Yes, I do', 'No, I do not'], 'ছোট উত্তর লিখুন।')
  ], 'A1')
];
