// ===============================
// SELECT ELEMENTS
// ===============================
const dropArea = document.querySelector(".drag-area"),
  dragText = dropArea.querySelector("header"),
  button = document.querySelector("button"),
  input = dropArea.querySelector("input"),
  icon = dropArea.querySelector(".icon"),
  sensitive = document.querySelector(".sensitive"),
  nonsensitive = document.querySelector(".non-sensitive"),
  progressStatus = document.querySelector("#progressStatus"),
  progressBar = document.querySelector("#progressBar"),
  toggle = document.querySelector(".toggle-button"),
  navlinks = document.querySelector(".navbar-links"),
  chk = document.getElementById("chk");

// ===============================
// NAVBAR TOGGLE
// ===============================
toggle.addEventListener("click", () => {
  navlinks.classList.toggle("active");
});

// ===============================
// DARK MODE
// ===============================
chk.addEventListener("change", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
});

if (localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark");
  chk.checked = true;
}

// ===============================
// FILE UPLOAD
// ===============================
button.addEventListener("click", () => input.click());
input.addEventListener("change", (event) => loadFile(event));

dropArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropArea.classList.add("active");
});

dropArea.addEventListener("dragleave", () => dropArea.classList.remove("active"));

dropArea.addEventListener("drop", (e) => {
  e.preventDefault();
  dropArea.classList.remove("active");
  const files = e.dataTransfer.files;
  if (files[0]) {
    input.files = files;
    loadFile({ target: { files } });
  }
});

// ===============================
// LOAD FILE
// ===============================
let isLoading = false;

const loadFile = (event) => {
  if (isLoading) return;
  isLoading = true;

  const image = document.getElementById("output");
  const photo = event.target.files[0];
  if (!photo) {
    isLoading = false;
    return;
  }

  dropArea.classList.add("active");
  sensitive.style.display = "none";
  nonsensitive.style.display = "none";
  progressStatus.style.display = "none";
  progressBar.style.display = "none";
  progressBar.style.width = "0%";
  progressBar.innerHTML = "0%";

  const validExtensions = ["image/jpeg", "image/jpg", "image/png"];
  if (!validExtensions.includes(photo.type)) {
    alert("This is not an Image File!");
    dropArea.classList.remove("active");
    dragText.style.display = "block";
    icon.style.display = "block";
    image.style.display = "none";
    isLoading = false;
    return;
  }

  const photoURL = URL.createObjectURL(photo);
  image.src = photoURL;
  image.style.display = "block";
  icon.style.display = "none";
  dragText.style.display = "none";
  progressStatus.style.display = "block";
  progressBar.style.display = "block";

  setTimeout(() => {
    classify().finally(() => {
      isLoading = false;
    });
  }, 150);
};

// ===============================
// CLASSIFICATION
// ===============================
const classify = async () => {
  const image = document.getElementById("output");

  const imagePredictionArray = await classifyImage(image);
  const image_conf = imagePredictionArray[0];

  const text = await extractText(image);
  const textPredictionArray = await classifyText(text);
  const text_conf = textPredictionArray[0];

  progressStatus.style.display = "none";
  progressBar.style.display = "none";

  if (image_conf > 0.5 || text_conf > 0.5) {
    sensitive.style.display = "block";
    nonsensitive.style.display = "none";
    console.log("Sensitive");
  } else {
    sensitive.style.display = "none";
    nonsensitive.style.display = "block";
    console.log("Non-sensitive");
    saveNonSensitiveImage(image);
  }
};

// ===============================
// OCR TEXT EXTRACTION
// ===============================
const extractText = async (image) => {
  let prgs = 0;
  const text = await Tesseract.recognize(image.src, "eng", {
    logger: (m) => {
      if (m.status === "recognizing text") {
        prgs = 50 + Math.ceil(m.progress * 100) / 2;
        progressBar.style.width = prgs + "%";
        progressBar.innerHTML = prgs + "%";
      }
    },
  }).then(({ data: { text } }) => text);

  return text.replace(/[\r\n]+/g, " ");
};

// ===============================
// IMAGE CLASSIFICATION
// ===============================
const classifyImage = async (image) => {
  const tensor = tf.browser.fromPixels(image).resizeBilinear([150, 150]).div(tf.scalar(255)).expandDims(0);
  return await image_model.predict(tensor).data();
};

// ===============================
// TEXT CLASSIFICATION
// ===============================
const classifyText = async (text) => {
  const max_length = 60;
  const tokens = text.split(" ");
  const word_index = await fetch("./models/text_model/word_index.json").then((res) => res.json());

  const padded = new Array(max_length).fill(0);
  for (let i = 0; i < max_length; i++) {
    padded[i] = word_index[tokens[i]?.toLowerCase()] || 1;
    if (i === tokens.length - 1) break;
  }

  const tensor = tf.tensor([padded]);
  return await text_model.predict(tensor).data();
};

// ===============================
// LOAD MODELS
// ===============================
let text_model, image_model;
const setupPage = async () => {
  text_model = await tf.loadLayersModel("./models/text_model/model.json");
  image_model = await tf.loadLayersModel("./models/image_model/model.json");
};
setupPage();

// ===============================
// SAVE NON-SENSITIVE IMAGE
// ===============================
function saveNonSensitiveImage(img) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0, img.width, img.height);

  const imgBase64 = canvas.toDataURL("image/png");
  let gallery = JSON.parse(localStorage.getItem("nonSensitiveGallery")) || [];

  if (!gallery.includes(imgBase64)) {
    gallery.push(imgBase64);
    localStorage.setItem("nonSensitiveGallery", JSON.stringify(gallery));
    console.log("✅ Non-sensitive image saved to gallery.");
  } else {
    console.log("⚠️ Image already exists in gallery. Not saved again.");
  }
}