// Same origin as Home Assistant. Store language only, never credentials.
const language = new URLSearchParams(location.search).get("lang");
if (["en", "pt", "es"].includes(language)) {
  try { localStorage.setItem("selectedLanguage", JSON.stringify(language)); } catch {}
}
location.replace("/nexus");
