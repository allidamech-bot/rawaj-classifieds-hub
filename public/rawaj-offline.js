(() => {
  let english = false;
  try { english = localStorage.getItem("rawaj-language") === "en"; } catch { /* storage restricted */ }
  document.documentElement.lang = english ? "en" : "ar";
  document.documentElement.dir = english ? "ltr" : "rtl";
  const title = document.getElementById("offline-title");
  const message = document.getElementById("offline-message");
  const retry = document.getElementById("offline-retry");
  const status = document.getElementById("offline-status");
  if (english) {
    title.textContent = "Could not connect to Rawaj";
    message.textContent = "Check your internet connection and try again.";
    retry.textContent = "Try again";
  }
  const refreshStatus = () => {
    status.textContent = navigator.onLine === false
      ? (english ? "You are offline." : "لا يوجد اتصال بالإنترنت حالياً.")
      : "";
  };
  refreshStatus();
  window.addEventListener("online", refreshStatus);
  window.addEventListener("offline", refreshStatus);
  retry.addEventListener("click", () => {
    if (navigator.onLine === false) {
      refreshStatus();
      return;
    }
    if (location.pathname === "/rawaj-offline.html") location.replace("/");
    else location.reload();
  });
})();
