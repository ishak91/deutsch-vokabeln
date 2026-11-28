// The app's pages, grouped. Shell builds the sidebar, phone tab bar and menu sheet from this; Today uses it for quick links.
export const GROUPS = [
  { title: null, items: [{ href: "/", label: "Today", icon: "today" }] },
  { title: "Practice", items: [
    { href: "/learn", label: "Flashcards", icon: "cards", desc: "Spaced-repetition reviews and new words" },
    { href: "/sentences", label: "Sentences", icon: "sentences", desc: "Translate German sentences" },
    { href: "/articles", label: "der · die · das", icon: "articles", desc: "Pick the right article" },
    { href: "/plurals", label: "Plurals", icon: "plurals", desc: "Type the plural form" },
    { href: "/verbs", label: "Verbs", icon: "verbs", desc: "Present, Präteritum, Perfekt" },
  ] },
  { title: "Skills", items: [
    { href: "/dictation", label: "Dictation", icon: "dictation", desc: "Listen and type" },
    { href: "/speak", label: "Speaking", icon: "speak", desc: "Role play with the AI partner" },
    { href: "/write", label: "Writing", icon: "write", desc: "B1-style emails and posts" },
  ] },
  { title: "Track", items: [
    { href: "/words", label: "Words", icon: "words" },
    { href: "/progress", label: "Progress", icon: "progress" },
  ] },
];
export const SETTINGS = { href: "/settings", label: "Settings", icon: "settings" };
export const ADMIN = [
  { href: "/users", label: "Users", icon: "users" },
  { href: "/ai", label: "AI teacher", icon: "ai" },
];
// the phone tab bar: the four most used pages, the rest sit behind "Menu"
export const TABS = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/learn", label: "Flashcards", icon: "cards" },
  { href: "/sentences", label: "Sentences", icon: "sentences" },
  { href: "/progress", label: "Progress", icon: "progress" },
];
