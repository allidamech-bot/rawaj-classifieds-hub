/* global document, localStorage, location */
try {
  if (localStorage.getItem("rawaj-language") === "en") {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
    document.getElementById("title").textContent = "Connection unavailable";
    document.getElementById("message").textContent =
      "Check your internet connection and try again to access Rawaj.";
    document.getElementById("retry").textContent = "Retry";
  }
} catch {
  // Arabic remains accessible when browser storage is unavailable.
}
document.getElementById("retry").addEventListener("click", () => {
  if (navigator.onLine === false) return;
  if (location.pathname === "/rawaj-offline.html") location.replace("/");
  else location.reload();
});
