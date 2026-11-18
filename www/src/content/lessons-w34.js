// Week 3 and Week 4 lessons (plan section 7).
import { v, warm, hear, teach, say, pick, order, write, own, lesson } from './lessons.js';
const TR = 'বাংলা থেকে ইংরেজিতে লিখুন।';

export const lessons = [
  // Week 3
  lesson('l16', 'w3', 16, 'Asking for help', ['Get attention politely', 'Ask for help with Can you ...?'], ['l15'], [
    warm('Which sentence is a question?', ['Please open the door.', 'Can you help me?', 'I am fine.'], 1),
    hear('Excuse me. Can you help me, please?', 'মাফ করবেন। আপনি কি আমাকে একটু সাহায্য করতে পারেন?'),
    teach('Asking for help politely', 'Excuse me. Can you + verb + me, please?', ['Excuse me.', 'Can you help me, please?', 'Can you open the door, please?', 'Thank you for your help.'],
      [v('excuse me', 'মাফ করবেন'), v('help', 'সাহায্য'), v('can', 'পারা'), v('open', 'খোলা')], "কাউকে ডাকতে Excuse me বলুন। সাহায্য চাইতে 'Can you ... please?' ব্যবহার করুন।"),
    say('Can you help me, please?'),
    pick('Listen. What does the speaker want?', ['Help', 'Tea', 'A book'], 0, 'Excuse me. Can you help me, please?'),
    pick("You need someone's attention. What do you say first?", ['Excuse me.', 'Goodbye.', 'I am fine.'], 0),
    order(['you', 'Can', 'me', 'help', 'please'], ['Can you help me, please?']),
    own('Ask the AI for help politely.', ['can you', 'excuse me'], 3, 'Can you help me, please?')
  ], 'A1'),
  lesson('l17', 'w3', 17, 'Asking for directions', ['Ask where a place is', 'Understand left, right and straight'], ['l16'], [
    warm('Which word asks about a place?', ['Where', 'When', 'Who'], 0),
    hear('Where is the bank? Go straight, then turn left.', 'ব্যাংক কোথায়? সোজা যান, তারপর বাঁয়ে ঘুরুন।'),
    teach('Asking and giving directions', 'Where is + place? / Go straight. / Turn left. / Turn right.', ['Where is the bank?', 'Go straight.', 'Turn left.', 'Turn right.', 'It is near the school.'],
      [v('straight', 'সোজা'), v('left', 'বাঁ'), v('right', 'ডান'), v('near', 'কাছে')], "জায়গা খুঁজতে 'Where is ...?' জিজ্ঞেস করুন। উত্তরে Go straight, Turn left, Turn right বলা হয়।"),
    say('Where is the bank?'),
    pick('Listen. Where do you turn?', ['Left', 'Right', 'Straight'], 0, 'Turn left at the school.'),
    pick('Choose the correct question.', ['Where the bank is?', 'Where is the bank?', 'Is where the bank?'], 1),
    order(['is', 'Where', 'the', 'bank'], ['Where is the bank?']),
    write('Write in English: ডানে ঘুরুন।', ['Turn right'], TR)
  ], 'A1'),
  lesson('l18', 'w3', 18, 'Shopping language', ['Ask the price', 'Ask if a shop has something'], ['l17'], [
    warm('Choose the correct question.', ['Where is the bank?', 'Where the bank is?', 'Is where the bank?'], 0),
    hear('How much is this? It is fifty taka.', 'এটার দাম কত? পঞ্চাশ টাকা।'),
    teach('Shopping language', 'How much is this? / Do you have + noun?', ['How much is this?', 'It is fifty taka.', 'Do you have rice?', 'I want to buy two kilos.'],
      [v('how much', 'কত'), v('taka', 'টাকা'), v('buy', 'কেনা'), v('kilo', 'কেজি')], "দাম জানতে 'How much is this?' জিজ্ঞেস করুন। কিছু আছে কি না জানতে 'Do you have ...?' ব্যবহার করুন।"),
    say('How much is this?'),
    pick('Listen. How much is it?', ['Fifty taka', 'Five taka', 'Fifteen taka'], 0, 'It is fifty taka.'),
    pick('You want to know the price. What do you ask?', ['How much is this?', 'Where is this?', 'Who is this?'], 0),
    order(['much', 'How', 'is', 'this'], ['How much is this?']),
    own('Ask the AI if it has something you want.', ['do you have'], 4, 'Do you have rice?')
  ], 'A1'),
  lesson('l19', 'w3', 19, 'Food and ordering', ['Order food politely', 'Ask for the bill'], ['l18'], [
    warm('Choose the correct question.', ['How much is this?', 'How is much this?', 'Much how is this?'], 0),
    hear('I would like rice and fish, please.', 'আমি ভাত আর মাছ চাই।'),
    teach('Ordering food politely', 'I would like + food, please. / Can I have + food?', ['I would like rice, please.', 'Can I have water?', 'The bill, please.', 'It is very good.'],
      [v('rice', 'ভাত'), v('water', 'পানি'), v('bill', 'বিল'), v('would like', 'চাই (ভদ্রভাবে)')], "ভদ্রভাবে খাবার চাইতে 'I would like ...' বা 'Can I have ...?' বলুন।"),
    say('I would like rice, please.'),
    pick('Listen. What does the speaker want?', ['Rice and fish', 'Tea and milk', 'Water only'], 0, 'I would like rice and fish, please.'),
    pick('You want water. What do you say?', ['Can I have water?', 'Where is water?', 'I am water.'], 0),
    order(['like', 'I', 'would', 'tea', 'please'], ['I would like tea, please.']),
    own('Order something to eat or drink.', ['i would like', 'can i have'], 4, 'I would like rice, please.')
  ], 'A1'),
  lesson('l20', 'w3', 20, 'Question formation', ['Make positive, negative and question forms', 'Add a question word'], ['l19'], [
    warm('Choose the correct short answer: Do you like tea?', ['Yes, I do.', 'Yes, I am.', 'Yes, I like.'], 0),
    hear('Do you live in Dhaka? Where does she work?', 'আপনি কি ঢাকায় থাকেন? সে কোথায় কাজ করে?'),
    teach('Positive, negative and question forms', 'I live. / I do not live. / Do you live? / Where do you live?', ['I live in Dhaka.', 'I do not live in Dhaka.', 'Do you live in Dhaka?', 'Where does she work?'],
      [v('live', 'থাকা'), v('work', 'কাজ করা'), v('do not', 'করি না'), v('does', 'করে')], 'ইতিবাচক: I live। নেতিবাচক: I do not live। প্রশ্ন: Do you live? প্রশ্ন-শব্দ বসালে: Where do you live? he/she-এর সঙ্গে does।'),
    say('Where does she work?'),
    pick('Choose the correct question.', ['Does she works in Dhaka?', 'Does she work in Dhaka?', 'She does work in Dhaka?'], 1),
    pick('Choose the negative sentence.', ['I do not live in Dhaka.', 'I not live in Dhaka.', 'I live not in Dhaka.'], 0),
    order(['you', 'Where', 'do', 'live'], ['Where do you live?']),
    write('Make a question: She works in Dhaka. (Does ...)', ['Does she work in Dhaka'], 'Does দিয়ে প্রশ্ন বানান।')
  ], 'A1'),
  lesson('l21', 'w3', 21, 'Place and time expressions', ['Use in, on and at'], ['l20'], [
    warm('Choose the correct sentence.', ['I live in Dhaka.', 'I live on Dhaka.', 'I live at Dhaka.'], 0),
    hear('I am at home. I go to work on Monday.', 'আমি বাসায় আছি। আমি সোমবার কাজে যাই।'),
    teach('in, on and at', 'in + city / morning, on + day, at + time / place', ['I live in Dhaka.', 'I go to school on Monday.', 'I wake up at six.', 'I am at home.', 'I read in the morning.'],
      [v('in', 'মধ্যে, -এ'), v('on', '-এ (দিন)'), v('at', '-এ (সময়, জায়গা)'), v('home', 'বাসা')], 'শহর ও সকাল-বিকেলের আগে in, বারের নামের আগে on, সময় ও নির্দিষ্ট জায়গার আগে at ব্যবহার করুন।'),
    say('I go to school on Monday.'),
    pick('Choose the correct word: I go to school ___ Monday.', ['in', 'on', 'at'], 1),
    pick('Choose the correct word: I wake up ___ six.', ['at', 'on', 'in'], 0),
    order(['live', 'I', 'in', 'Dhaka'], ['I live in Dhaka.']),
    own('Tell the AI where you live.', ['i live in'], 4, 'I live in Dhaka.')
  ], 'A1'),
  lesson('l22', 'w3', 22, 'Understanding short requests', ['Understand Please + verb', 'Follow a short request'], ['l21'], [
    warm('Choose the correct word: Please ___ the door.', ['open', 'opens', 'opening'], 0),
    hear('Please close the window.', 'অনুগ্রহ করে জানালাটা বন্ধ করুন।'),
    teach('Short requests', 'Please + verb. / Can you + verb, please?', ['Please sit down.', 'Please close the window.', 'Can you wait, please?', 'Please come here.'],
      [v('close', 'বন্ধ করা'), v('sit down', 'বসা'), v('wait', 'অপেক্ষা করা'), v('come', 'আসা')], "অনুরোধ বোঝাতে Please দিয়ে শুরু করুন বা 'Can you ..., please?' বলুন।"),
    say('Please sit down.'),
    pick('Listen. What should you do?', ['Close the window', 'Open the door', 'Sit down'], 0, 'Please close the window.'),
    pick('Listen. What should you do?', ['Wait', 'Come here', 'Go home'], 0, 'Can you wait, please?'),
    pick('Listen. What should you do?', ['Sit down', 'Stand up', 'Open your book'], 0, 'Please sit down.'),
    write('Write a polite request: close the door.', ['Please close the door', 'Can you close the door, please'], 'দরজা বন্ধ করার ভদ্র অনুরোধ লিখুন।')
  ], 'A1'),
  lesson('l23', 'w3', 23, 'Guided roleplay: at a shop', ['Follow a shop dialogue with hints', 'Say your own line'], ['l22'], [
    warm('Which sentence is polite?', ['Give me tea.', 'Can I have tea, please?', 'Tea now.'], 1),
    hear('Hello. Can I help you? Yes, I would like tea, please.', 'হ্যালো। আমি কি সাহায্য করতে পারি? হ্যাঁ, আমি চা চাই।'),
    teach('Shop dialogue', 'Shopkeeper: Can I help you? You: I would like ..., please.', ['Can I help you?', 'I would like tea, please.', 'How much is it?', 'It is ten taka. Thank you.'],
      [v('shopkeeper', 'দোকানদার'), v('price', 'দাম')], 'দোকানে আগে শুভেচ্ছা, তারপর কী চান বলুন, শেষে দাম জিজ্ঞেস করে ধন্যবাদ দিন।'),
    say('I would like tea, please.'),
    pick('Shopkeeper: Hello. Can I help you? Choose your reply.', ['I would like tea, please.', 'I am from Dhaka.', 'Goodbye.'], 0),
    pick('Shopkeeper: Here is your tea. What do you ask?', ['How much is it?', 'Where are you from?', 'What is your name?'], 0),
    pick('Shopkeeper: It is ten taka. What do you say?', ['Thank you.', 'I am fine.', 'Turn left.'], 0),
    own('Write your own line to buy something.', ['i would like', 'can i have', 'do you have'], 4, 'I would like tea, please.')
  ], 'A1'),
  // Week 4
  lesson('l24', 'w4', 24, 'Talking about the past', ['Say what happened yesterday', 'Use was and were'], ['l23'], [
    warm('Choose the correct sentence.', ['I live in Dhaka.', 'I lives in Dhaka.', 'I living in Dhaka.'], 0),
    hear('Yesterday I went to school. I was happy.', 'গতকাল আমি স্কুলে গিয়েছিলাম। আমি খুশি ছিলাম।'),
    teach('Past events', 'verb + ed / went, ate, saw / was, were', ['I played football yesterday.', 'I went to school.', 'She ate rice.', 'We were at home.', 'I was happy.'],
      [v('yesterday', 'গতকাল'), v('went', 'গিয়েছিলাম (go)'), v('ate', 'খেয়েছিলাম (eat)'), v('was', 'ছিলাম, ছিল')], 'অতীতের ঘটনা বলতে ক্রিয়ার অতীত রূপ ব্যবহার করুন। play হয় played, কিন্তু go হয় went, eat হয় ate। am/is-এর অতীত was, are-এর অতীত were।'),
    say('I went to school yesterday.'),
    pick('Choose the correct sentence.', ['I go to school yesterday.', 'I went to school yesterday.', 'I goed to school yesterday.'], 1),
    pick('Listen. What did she eat?', ['Rice', 'Fish', 'Bread'], 0, 'She ate rice.'),
    order(['was', 'I', 'happy', 'yesterday'], ['I was happy yesterday.', 'Yesterday I was happy.']),
    write('Write in English: আমি গতকাল স্কুলে গিয়েছিলাম।', ['I went to school yesterday', 'Yesterday I went to school'], TR)
  ], 'A2'),
  lesson('l25', 'w4', 25, 'Simple future plans', ['Use will and going to'], ['l24'], [
    warm('Choose the past form of go.', ['goed', 'went', 'gone'], 1),
    hear('Tomorrow I will go to Dhaka. I am going to visit my friend.', 'কাল আমি ঢাকায় যাব। আমি বন্ধুর সঙ্গে দেখা করতে যাচ্ছি।'),
    teach('Future plans', 'will + verb / am going to + verb', ['I will go tomorrow.', 'She will call you.', 'I am going to learn English.', 'We are going to eat.'],
      [v('tomorrow', 'আগামীকাল'), v('will', 'করব (ভবিষ্যৎ)'), v('going to', 'করতে যাচ্ছি'), v('visit', 'দেখা করা')], 'ভবিষ্যতের কথা বলতে will + ক্রিয়া বা am/is/are going to + ক্রিয়া ব্যবহার করুন।'),
    say('I will go tomorrow.'),
    pick('Choose the correct sentence.', ['I will goes tomorrow.', 'I will go tomorrow.', 'I will going tomorrow.'], 1),
    pick('Listen. When will she call?', ['Tomorrow', 'Yesterday', 'Never'], 0, 'She will call you tomorrow.'),
    order(['going', 'I', 'to', 'am', 'learn', 'English'], ['I am going to learn English.']),
    own('Tell the AI one plan for tomorrow.', ['i will', 'i am going to'], 4, 'I will go to school tomorrow.')
  ], 'A2'),
  lesson('l26', 'w4', 26, 'Linking sentences', ['Join ideas with and, but, because, so'], ['l25'], [
    warm('Choose the correct word: I will ___ tomorrow.', ['go', 'went', 'goes'], 0),
    hear('I like tea, but I do not like coffee.', 'আমি চা পছন্দ করি, কিন্তু কফি পছন্দ করি না।'),
    teach('and, but, because, so', 'sentence + and / but / because / so + sentence', ['I like tea and coffee.', 'I like tea, but I do not like coffee.', 'I am happy because I am at home.', 'I am tired, so I will sleep.'],
      [v('and', 'এবং'), v('but', 'কিন্তু'), v('because', 'কারণ'), v('so', 'তাই')], 'and দিয়ে যোগ করুন, but দিয়ে বিপরীত বোঝান, because দিয়ে কারণ বলুন, so দিয়ে ফল বলুন।'),
    say('I like tea, but I do not like coffee.'),
    pick('Choose the correct word: I am tired, ___ I will sleep.', ['but', 'so', 'because'], 1),
    pick('Choose the correct word: I am happy ___ I am at home.', ['because', 'but', 'so'], 0),
    order(['like', 'I', 'tea', 'and', 'coffee'], ['I like tea and coffee.']),
    own('Join two ideas with because.', ['i'], 5, 'I am happy because I am at home.', 'because')
  ], 'A2'),
  lesson('l27', 'w4', 27, 'Describing people and places', ['Describe a person', 'Describe a place'], ['l26'], [
    warm('Choose the correct word: I am happy ___ I am at home.', ['because', 'but', 'so'], 0),
    hear('My friend is tall and kind. His house is big.', 'আমার বন্ধু লম্বা আর দয়ালু। তার বাড়ি বড়।'),
    teach('Describing with adjectives', 'He / she / it + is + adjective', ['He is tall.', 'She is kind.', 'My house is small.', 'Dhaka is a big city.'],
      [v('tall', 'লম্বা'), v('kind', 'দয়ালু'), v('big', 'বড়'), v('small', 'ছোট'), v('beautiful', 'সুন্দর')], 'মানুষ বা জায়গার গুণ বলতে is/are-এর পরে বিশেষণ বসান, যেমন He is tall।'),
    say('She is kind.'),
    pick('Listen. What is his house like?', ['Big', 'Small', 'Old'], 0, 'His house is big.'),
    pick('Choose the correct sentence.', ['She kind is.', 'She is kind.', 'She are kind.'], 1),
    order(['is', 'Dhaka', 'a', 'big', 'city'], ['Dhaka is a big city.']),
    own('Describe a person or a place you know.', ['he is', 'she is', 'my', 'it is'], 3, 'My house is small.')
  ], 'A2'),
  lesson('l28', 'w4', 28, 'Clarification phrases', ['Say you do not understand', 'Ask someone to repeat or speak slowly'], ['l27'], [
    warm('Which sentence is polite?', ['Say again.', 'Can you repeat that, please?', 'What?'], 1),
    hear('Sorry, I do not understand. Can you speak slowly, please?', 'দুঃখিত, আমি বুঝতে পারছি না। আপনি কি ধীরে বলতে পারেন?'),
    teach('When you do not understand', 'Sorry? / Can you repeat that? / What does ... mean?', ['Sorry, I do not understand.', 'Can you repeat that, please?', 'Can you speak slowly, please?', 'What does this word mean?'],
      [v('understand', 'বোঝা'), v('repeat', 'আবার বলা'), v('slowly', 'ধীরে'), v('mean', 'মানে হওয়া')], 'না বুঝলে ভয় পাবেন না। ভদ্রভাবে বলুন: Sorry, I do not understand। তারপর repeat বা slowly বলে অনুরোধ করুন।'),
    say('Can you repeat that, please?'),
    pick('You did not hear. What do you say?', ['Can you repeat that, please?', 'I am fine.', 'Goodbye.'], 0),
    pick('Listen. What does the speaker want?', ['Slow speech', 'A book', 'Tea'], 0, 'Can you speak slowly, please?'),
    order(['do', 'I', 'not', 'understand'], ['I do not understand.']),
    own('Ask the AI to repeat or speak slowly.', ['can you', 'sorry', 'please'], 3, 'Can you speak slowly, please?')
  ], 'A2'),
  lesson('l29', 'w4', 29, 'Listening: longer dialogues', ['Find the question, the answer and one detail'], ['l28'], [
    warm('Which phrase asks someone to repeat?', ['Can you repeat that?', 'Where is the bank?', 'I am fine.'], 0),
    hear('Excuse me. Where is the bank? Go straight, then turn left. It is near the school. Thank you.', 'মাফ করবেন। ব্যাংক কোথায়? সোজা যান, তারপর বাঁয়ে ঘুরুন। এটা স্কুলের কাছে। ধন্যবাদ।'),
    teach('Listening to longer dialogues', 'Listen for the question, the answer and one detail', ['Where is the bank? Go straight, then turn left.', 'How much is this? It is fifty taka.', 'What did you do yesterday? I went to school.'],
      [v('then', 'তারপর'), v('detail', 'তথ্য, বিস্তারিত')], 'লম্বা সংলাপে আগে প্রশ্নটি, তারপর উত্তর, শেষে একটি গুরুত্বপূর্ণ তথ্য (সময়, জায়গা বা দাম) ধরুন।'),
    say('Go straight, then turn left.'),
    pick('Listen. Where is the bank?', ['Near the school', 'Near the market', 'At home'], 0, 'Where is the bank? Go straight, then turn left. It is near the school.'),
    pick('Listen. How much is it?', ['Fifty taka', 'Fifteen taka', 'Five taka'], 0, 'How much is this? It is fifty taka. Thank you.'),
    pick('Listen. What did the speaker do yesterday?', ['Went to school', 'Went to the shop', 'Stayed at home'], 0, 'What did you do yesterday? I went to school.'),
    pick('Listen. What do you do first?', ['Go straight', 'Turn left', 'Stop'], 0, 'Go straight, then turn left.')
  ], 'A2'),
  lesson('l30', 'w4', 30, 'Mixed-skill review', ['Practice listening, grammar, sentences and speaking from all four weeks'], ['l29'], [
    pick('Listen. Choose the best reply.', ['I am fine, thank you.', 'Goodbye.', 'It is Monday.'], 0, 'How are you?'),
    pick('Choose the correct sentence.', ['She eat rice.', 'She eats rice.', 'She eating rice.'], 1),
    order(['do', 'I', 'not', 'like', 'coffee'], ['I do not like coffee.']),
    pick('Listen. How much is it?', ['Fifty taka', 'Fifteen taka', 'Five taka'], 0, 'It is fifty taka.'),
    pick('Choose the correct word: I live ___ Dhaka.', ['in', 'on', 'at'], 0),
    order(['is', 'Where', 'the', 'bank'], ['Where is the bank?']),
    write('Write in English: আমি গতকাল স্কুলে গিয়েছিলাম।', ['I went to school yesterday', 'Yesterday I went to school'], TR),
    own('Tell the AI what you will do tomorrow.', ['i will', 'i am going to'], 4, 'I will go to school tomorrow.')
  ], 'A2'),
  { ...lesson('l31', 'w4', 31, 'Progress check', ['See how far you have come in 30 days'], ['l30'], [
    pick('Listen. Choose the best answer.', ['My name is Rahim.', 'I am fine.', 'Thank you.'], 0, 'What is your name?'),
    pick('Listen. Where do you turn?', ['Left', 'Right', 'Straight'], 0, 'Turn left at the school.'),
    pick('Choose the correct sentence.', ['He go to school.', 'He goes to school.', 'He going to school.'], 1),
    pick('Choose the correct word: They ___ happy.', ['is', 'am', 'are'], 2),
    order(['would', 'I', 'like', 'tea', 'please'], ['I would like tea, please.']),
    order(['going', 'I', 'to', 'am', 'learn', 'English'], ['I am going to learn English.']),
    write('Write in English: আমি ইংরেজি বলতে চাই।', ['I want to speak English', 'I want to speak in English'], TR),
    own('Tell the AI about your day.', ['i'], 4, 'I wake up at six.'),
    own('Ask the AI for help politely.', ['can you', 'excuse me'], 3, 'Can you help me, please?')
  ], 'A2'), completion_criteria: { min_score: 0 }, assessment: true }
];
