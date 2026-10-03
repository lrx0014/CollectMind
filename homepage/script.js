const lightbox = document.querySelector(".screenshot-lightbox");
const lightboxImage = lightbox.querySelector(".lightbox-image");
const lightboxCaption = lightbox.querySelector(".lightbox-caption");
const closeButton = lightbox.querySelector(".lightbox-close");

document.querySelectorAll(".screenshot-trigger").forEach((trigger) => {
    trigger.addEventListener("click", () => {
        const image = trigger.querySelector("img");
        const caption = trigger.closest(".screenshot-card").querySelector("figcaption");

        lightboxImage.src = image.currentSrc || image.src;
        lightboxImage.alt = image.alt;
        lightboxCaption.textContent = caption.textContent;
        lightbox.showModal();
        document.body.classList.add("lightbox-open");
    });
});

closeButton.addEventListener("click", () => lightbox.close());

lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
        lightbox.close();
    }
});

lightbox.addEventListener("close", () => {
    document.body.classList.remove("lightbox-open");
    lightboxImage.removeAttribute("src");
});
