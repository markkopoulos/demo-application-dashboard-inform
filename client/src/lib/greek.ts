/** Greek vocative for first names, used in greetings ("Καλημέρα, Νίκο!"). Covers the common masculine patterns. */
const ACCENTED = /[άέήίόύώΐΰ]/;
const VOWELS = /[αεηιουωάέήίόύώϊϋΐΰ]/;

export function vocative(name: string): string {
  if (!name) return name;
  if (name.endsWith("ης") || name.endsWith("ής")) return name.slice(0, -1); // Γιάννης → Γιάννη
  if (name.endsWith("ας") || name.endsWith("άς")) return name.slice(0, -1); // Κώστας → Κώστα
  if (name.endsWith("ος") || name.endsWith("ός")) {
    const stem = name.slice(0, -2);
    const accentIdx = [...stem].findIndex((c) => ACCENTED.test(c));
    // Accent on the antepenultimate syllable → -ε (Στέφανος → Στέφανε); otherwise → -ο (Νίκος → Νίκο).
    const afterAccent = accentIdx >= 0 ? [...stem].slice(accentIdx + 1).join("") : "";
    return stem + (VOWELS.test(afterAccent) ? "ε" : "ο");
  }
  return name;
}

export function timeOfDay(date = new Date()): "morning" | "afternoon" | "evening" {
  const h = date.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

/** ISO weekday 1 (Mon) … 7 (Sun). */
export const isoWeekday = (date = new Date()) => ((date.getDay() + 6) % 7) + 1;
