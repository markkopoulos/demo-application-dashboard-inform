import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import el from "@/locales/el";
import en from "@/locales/en";

const saved = (() => {
  try {
    return localStorage.getItem("educore-lang");
  } catch {
    return null;
  }
})();

void i18n.use(initReactI18next).init({
  resources: { el: { translation: el }, en: { translation: en } },
  lng: saved === "en" ? "en" : "el", // Greek is the default
  fallbackLng: "el",
  interpolation: { escapeValue: false },
});

export function setLanguage(lng: "el" | "en") {
  void i18n.changeLanguage(lng);
  document.documentElement.lang = lng;
  try {
    localStorage.setItem("educore-lang", lng);
  } catch {
    /* storage unavailable */
  }
}

export default i18n;
