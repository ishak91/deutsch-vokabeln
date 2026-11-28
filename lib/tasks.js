// Practice tasks in the style of the B1 exam (Telc / Goethe), shared by the pages and the AI prompts.
// The German here is written and checked by hand; the AI only reacts to it.

// Speaking partner: the AI plays a role, the learner speaks (or types) German.
export const TALKS = [
  { id: "party", part: "Plan together (B1 Sprechen Teil 1)", title: "Eine Abschiedsparty planen",
    en: "A colleague is leaving. Plan a goodbye party together: when, where, food and drinks, a present.",
    role: "a friendly colleague of the student. You both want to plan a goodbye party for your colleague Julia, who is leaving the company" },
  { id: "ausflug", part: "Plan together (B1 Sprechen Teil 1)", title: "Einen Ausflug planen",
    en: "Plan a Saturday trip with a friend from your German course: where to go, how to get there, what to take.",
    role: "a friend from the student's German course. You want to plan a trip for next Saturday together" },
  { id: "vorstellen", part: "Introduce yourself", title: "Sich vorstellen",
    en: "The examiner asks about you: name, where you're from, work, family, hobbies, why you learn German.",
    role: "a friendly examiner at the start of a German exam. Ask the student about themselves, one simple question at a time" },
  { id: "wochenende", part: "Small talk", title: "Über das Wochenende sprechen",
    en: "Tell a friend what you did last weekend. Good practice for the Perfekt.",
    role: "a friend of the student. It is Monday and you ask what the student did at the weekend" },
  { id: "restaurant", part: "Everyday situation", title: "Im Restaurant",
    en: "Order food and drinks, ask about a dish, then pay.",
    role: "a waiter in a German restaurant. The student is the guest" },
  { id: "arzt", part: "Everyday situation", title: "Einen Arzttermin machen",
    en: "Call the doctor's practice, say what's wrong and find an appointment time.",
    role: "the receptionist at a doctor's practice. The student calls you to make an appointment" },
  { id: "wohnung", part: "Everyday situation", title: "Eine Wohnung besichtigen",
    en: "You visit a flat to rent. Ask about the rent, the rooms, and when you can move in.",
    role: "a landlord showing a flat to the student, who wants to rent it" },
];

// Writing: an email or forum post. words = the target length in the exam.
export const WRITES = [
  { id: "w1", part: "Informal email (Teil 1)", words: 80,
    de: "Sie haben am Wochenende mit Freunden einen Ausflug gemacht. Schreiben Sie Ihrer Freundin Anna eine E-Mail.",
    points: ["Beschreiben Sie: Wohin sind Sie gefahren?", "Begründen Sie: Was hat Ihnen besonders gut gefallen?", "Machen Sie einen Vorschlag für einen gemeinsamen Ausflug."],
    en: "You went on a trip with friends at the weekend. Write to your friend Anna: where you went, what you liked most and why, and suggest a trip together." },
  { id: "w2", part: "Informal email (Teil 1)", words: 80,
    de: "Sie sind vor Kurzem in eine neue Wohnung umgezogen. Schreiben Sie Ihrem Freund Markus eine E-Mail.",
    points: ["Beschreiben Sie Ihre neue Wohnung.", "Erklären Sie, warum Sie umgezogen sind.", "Laden Sie Markus zu einer Party in der neuen Wohnung ein."],
    en: "You recently moved to a new flat. Write to your friend Markus: describe the flat, say why you moved, and invite him to a party there." },
  { id: "w3", part: "Opinion in a forum (Teil 2)", words: 80,
    de: "In einem Online-Forum lesen Sie: „Kinder sollten erst mit 14 Jahren ein eigenes Handy bekommen.“ Schreiben Sie Ihre Meinung.",
    points: [],
    en: "In an online forum you read: \"Children should only get their own phone at 14.\" Write your opinion, with reasons." },
  { id: "w4", part: "Opinion in a forum (Teil 2)", words: 80,
    de: "Das Thema im Forum ist: „Wohnt man besser in der Stadt oder auf dem Land?“ Schreiben Sie Ihre Meinung.",
    points: [],
    en: "The forum topic is: \"Is it better to live in the city or in the countryside?\" Write your opinion, with reasons." },
  { id: "w5", part: "Formal message (Teil 3)", words: 40,
    de: "Sie haben morgen einen Termin bei Ihrer Ärztin, Frau Dr. Weber, aber Sie können nicht kommen. Schreiben Sie der Praxis.",
    points: ["Entschuldigen Sie sich höflich.", "Bitten Sie um einen neuen Termin."],
    en: "You have an appointment with your doctor, Dr. Weber, tomorrow, but you can't come. Write to the practice: apologise politely and ask for a new appointment." },
  { id: "w6", part: "Formal message (Teil 3)", words: 40,
    de: "Ihr Deutschkurs hat nächsten Montag einen Test, aber an dem Tag müssen Sie arbeiten. Schreiben Sie Ihrer Kursleiterin, Frau Schmidt.",
    points: ["Entschuldigen Sie sich.", "Fragen Sie, wann Sie den Test nachschreiben können."],
    en: "Your German course has a test next Monday, but you have to work that day. Write to your teacher, Ms Schmidt: apologise and ask when you can take the test later." },
];

export const talkById = (id) => TALKS.find(t => t.id === id);
export const writeById = (id) => WRITES.find(t => t.id === id);
