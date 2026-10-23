const blockedTerms = [
  "ass", "asshole", "bastard", "behenchod", "bhenchod", "betichod", "bhosda", "bhosdi", "bhosdike", "bsdk",
  "chodu", "chod", "chut", "chutiya", "chutiye", "cock", "cunt", "dick", "dickhead", "fag", "faggot", "fuck",
  "fucker", "fucking", "gaand", "gaandu", "gandu", "harami", "laude", "lawde", "lodu", "lund", "madarchod",
  "maderchod", "motherfucker", "nigger", "nigga", "pussy", "randi", "retard", "shit", "shitty", "slut", "whore"
];

const blockedPatterns = blockedTerms.map((term) => {
  const separatedLetters = [...term].map((letter) => `${letter}[^a-z0-9]*?`).join("");
  return new RegExp(`(?:^|[^a-z0-9])${separatedLetters}(?:$|[^a-z0-9])`, "i");
});

const containsBlockedChatLanguage = (message) => {
  if (typeof message !== "string" || !message.trim()) return false;
  const normalized = message.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[013457@]/g, (character) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a" })[character]);
  return blockedPatterns.some((pattern) => pattern.test(normalized));
};

const containsPersonalContactDetails = (message) => {
  const text = String(message || "");
  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phonePattern = /(?=(?:\D*\d){10,})\+?\d[\d\s().-]{8,}\d/;
  return emailPattern.test(text) || phonePattern.test(text);
};

module.exports = { containsBlockedChatLanguage, containsPersonalContactDetails };
