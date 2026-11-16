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
const productUrl = configuredUrl(media.dataset.productUrl);
if (videoUrl) {
  video.src = videoUrl;
  video.hidden = false;
  document.querySelector("#video-placeholder").hidden = true;
}
if (productUrl) link.href = productUrl;
video.addEventListener("ended", () => {
  if (videoUrl && productUrl) product.hidden = false;
});
video.addEventListener("error", () => {
  document.querySelector("#video-error").hidden = false;
});
