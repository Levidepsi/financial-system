const media = document.querySelector("#about-media");
const video = document.querySelector("#about-video");
const product = document.querySelector("#about-product");
const link = document.querySelector("#raket-link");

function configuredUrl(value) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value, window.location.href);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

const videoUrl = configuredUrl(media.dataset.videoSrc);
let productUrl = configuredUrl(media.dataset.productUrl);
if (videoUrl) {
  video.src = videoUrl;
  video.hidden = false;
  document.querySelector("#video-placeholder").hidden = true;
}
if (productUrl) {
  link.href = productUrl;
  link.hidden = false;
  document.querySelector("#product-pending").hidden = true;
}
if (!productUrl) {
  fetch("/api/config", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(config => {
    productUrl = configuredUrl(config?.productUrl);
    if (!productUrl) return;
    link.href = productUrl;
    link.hidden = false;
    document.querySelector("#product-pending").hidden = true;
  }).catch(() => {});
}
video.addEventListener("ended", () => {
  if (videoUrl) product.hidden = false;
});
video.addEventListener("error", () => {
  document.querySelector("#video-error").hidden = false;
});
video.addEventListener("loadeddata", () => {
  document.querySelector("#video-error").hidden = true;
});

// Visitors may open this page directly while an older dashboard worker is active.
if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (videoUrl && video.error) video.load();
  });
  navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" })
    .then(registration => registration.update())
    .catch(() => { /* Video playback also works without offline support. */ });
}
