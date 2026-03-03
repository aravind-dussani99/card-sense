export function setAuthToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("cardsense_token", token);
  document.cookie = `cardsense_token=${token}; Path=/; SameSite=Lax`;
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("cardsense_token");
  document.cookie = "cardsense_token=; Max-Age=0; Path=/; SameSite=Lax";
}

export function getAuthToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("cardsense_token") || "";
}
