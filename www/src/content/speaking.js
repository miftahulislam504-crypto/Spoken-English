// Speaking content (plan sections 3.3, 6.2, 6.4 and 6.6). Shared by the app and the server.
export const FREE_OPENING = { en: 'Hi! What would you like to talk about today?', bn: 'হাই! আজ আপনি কী নিয়ে কথা বলতে চান?' };
const sc = (id, title_en, goal_en, ai_role, level, vocab_en, opening_en, opening_bn, suggest) => ({ id, title_en, goal_en, ai_role, level, vocab_en, opening_en, opening_bn, suggest });
export const SCENARIOS = [
  sc('greet', 'Greeting someone', 'Greet a person and ask how they are', 'a friendly neighbor', 'Pre-A1', ['hello', 'good morning', 'how are you', 'fine'], 'Good morning! How are you today?', 'শুভ সকাল! আজ আপনি কেমন আছেন?', ['I am fine, thank you.', 'Good morning. I am good.']),
  sc('intro', 'Introducing yourself', 'Tell your name, where you are from and what you do', 'a new classmate called Sara', 'Pre-A1', ['name', 'from', 'student', 'work'], 'Hi! I am Sara. What is your name?', 'হাই! আমি সারা। আপনার নাম কী?', ['My name is Rahim.', 'I am from Bangladesh.']),
  sc('family', 'Talking about family', 'Say who is in your family', 'a friendly colleague', 'A1', ['brother', 'sister', 'mother', 'father'], 'Do you have a big family?', 'আপনার পরিবার কি বড়?', ['Yes, I have a big family.', 'I have two brothers.']),
  sc('routine', 'Daily routines', 'Describe your day', 'a friend', 'A1', ['wake up', 'breakfast', 'go to work', 'sleep'], 'What time do you wake up?', 'আপনি কটায় ঘুম থেকে ওঠেন?', ['I wake up at six.', 'I wake up early.']),
  sc('help', 'Asking for help', 'Ask for help politely', 'a helpful passer-by', 'Pre-A1', ['excuse me', 'help', 'please', 'thank you'], 'Hello! You look lost. Can I help you?', 'হ্যালো! আপনাকে পথ হারানোর মতো লাগছে। আমি কি সাহায্য করতে পারি?', ['Excuse me, can you help me?', 'Where is the bus station?']),
  sc('shop', 'Shopping', 'Ask the price and buy something', 'a shopkeeper', 'A1', ['how much', 'buy', 'rice', 'taka'], 'Hello! Can I help you?', 'হ্যালো! আমি কি সাহায্য করতে পারি?', ['How much is this?', 'I would like two kilos of rice.']),
  sc('food', 'Ordering food', 'Order a meal and a drink', 'a waiter', 'A1', ['menu', 'would like', 'water', 'bill'], 'Welcome! What would you like to eat?', 'স্বাগতম! আপনি কী খেতে চান?', ['I would like chicken and rice.', 'Can I have water, please?']),
  sc('dir', 'Asking for directions', 'Find out where a place is', 'a local person', 'A1', ['where', 'left', 'right', 'straight'], 'Hi! Do you need help?', 'হাই! আপনার কি সাহায্য লাগবে?', ['Where is the bank?', 'Excuse me, where is the school?']),
  sc('appt', 'Making an appointment', 'Choose a day and time', 'a clinic receptionist', 'A1', ['appointment', 'Monday', 'morning', 'time'], 'Hello. How can I help you?', 'হ্যালো। আমি কীভাবে সাহায্য করতে পারি?', ['I want to make an appointment.', 'Can I come on Monday?']),
  sc('phone', 'Talking on the phone', 'Ask for a person and leave a message', 'a person answering the phone', 'A1', ['speak to', 'message', 'call', 'sorry'], 'Hello? Who is this, please?', 'হ্যালো? আপনি কে বলছেন?', ['Hello, this is Rahim.', 'Can I speak to Sara, please?'])
];
const qn = (id, text, level, hint_bn) => ({ id, text, level, hint_bn });
export const QUESTIONS = [
  qn('q1', 'What is your name?', 'Pre-A1', 'আপনার নাম কী?'), qn('q2', 'Where are you from?', 'Pre-A1', 'আপনি কোথা থেকে এসেছেন?'),
  qn('q3', 'Where do you live?', 'Pre-A1', 'আপনি কোথায় থাকেন?'), qn('q4', 'What time do you wake up?', 'Pre-A1', 'আপনি কটায় ঘুম থেকে ওঠেন?'),
  qn('q5', 'What do you like to eat?', 'A1', 'আপনি কী খেতে পছন্দ করেন?'), qn('q6', 'Do you like tea or coffee?', 'A1', 'আপনি চা পছন্দ করেন নাকি কফি?'),
  qn('q7', 'What did you do yesterday?', 'A1', 'গতকাল আপনি কী করেছেন?'), qn('q8', 'What will you do tomorrow?', 'A1', 'আগামীকাল আপনি কী করবেন?'),
  qn('q9', 'Why are you learning English?', 'A1', 'আপনি কেন ইংরেজি শিখছেন?'), qn('q10', 'Can you describe your best friend?', 'A2', 'আপনার সবচেয়ে ভালো বন্ধুর বর্ণনা দিন।')
];
export const REPEAT_SETS = [
  { id: 'phrases', title_en: 'Everyday phrases', items: [{ text: 'How are you?' }, { text: 'My name is Rahim.' }, { text: 'Where is the bank?' }, { text: 'I would like some tea, please.' }, { text: 'Can you speak slowly, please?' }, { text: 'See you tomorrow.' }] },
  { id: 'sounds', title_en: 'Difficult sounds', items: [
    { text: 'I think this is very good.', tip_bn: 'think-এর th: জিভ দাঁতের মাঝখানে রাখুন। very-র v: নিচের ঠোঁট ওপরের দাঁত ছোঁয়াবে।' },
    { text: 'The ship is near the sea.', tip_bn: 'ship-এর sh (শ) আর sea-র s (স) আলাদা করে বলুন।' },
    { text: 'A cat sat on the map.', tip_bn: 'cat-এর a মুখ খুলে বলুন, অনেকটা "ক্যাট"-এর মতো।' },
    { text: 'I go to school by bus.', tip_bn: 'school-এর আগে "ই" যোগ করবেন না। s-k-l একসঙ্গে বলুন।' },
    { text: 'The weather is very warm.', tip_bn: 'w বলার সময় ঠোঁট গোল করুন। v বলার সময় দাঁত ও ঠোঁট ছোঁয়ান।' }] },
  { id: 'stress', title_en: 'Stress and rhythm', items: [
    { text: 'I want to learn English.', stress: 'I WANT to LEARN ENglish.', tip_bn: 'বড় হাতের অংশে জোর দিন, বাকিটা হালকা বলুন।' },
    { text: 'Can you help me, please?', stress: 'Can you HELP me, PLEASE?', tip_bn: 'HELP আর PLEASE-এ জোর দিন।' },
    { text: 'Where is the bank?', stress: 'WHERE is the BANK?', tip_bn: 'প্রশ্নের মূল শব্দে জোর দিন।' },
    { text: 'I would like some tea.', stress: 'I would LIKE some TEA.', tip_bn: 'LIKE আর TEA-এ জোর দিন।' }] }
];
