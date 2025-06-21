const API_BASE = "https://pw-api-75332756c41b.herokuapp.com";

const overlay = document.getElementById("overlay");
const main = document.getElementById("main");
const subjectsDiv = document.getElementById("subjects");
const chaptersDiv = document.getElementById("chapters");
const loader = document.getElementById("loader");
const backBtn = document.getElementById("backBtn");
const searchInput = document.getElementById("searchInput");
const todayWrapper = document.getElementById("todayWrapper");
const todayClassesDiv = document.getElementById("todayClasses");

let viewStack = [];
let allBatches = [];
let currentLectureUrl = "";

function showLoader(show) {
  loader.style.display = show ? "block" : "none";
}

function clearAll() {
  main.style.display = "none";
  subjectsDiv.style.display = "none";
  chaptersDiv.style.display = "none";
  backBtn.style.display = viewStack.length ? "block" : "none";
  todayWrapper.style.display = "none";
  document.getElementById("lectureSection").style.display = "none";
}

function show(div) {
  clearAll();
  div.style.display = div.id === "lectureSection" ? "block" : "flex";
}

function appendCard(container, title, image, onClick) {
  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `
    ${image ? `<img src="${image}" alt="${title}" />` : ""}
    <div class="card-title">${title}</div>
  `;
  div.onclick = onClick;
  container.appendChild(div);
}

async function loadBatches() {
  showLoader(true);
  try {
    const res = await fetch(`${API_BASE}/api/pw/batches`);
    const data = await res.json();
    allBatches = data;
    renderBatches(data);
  } catch (err) {
    console.error("Failed to load batches:", err);
  } finally {
    showLoader(false);
  }
}

function renderBatches(batches) {
  main.innerHTML = "";
  show(main);
  searchInput.style.display = "block";
  batches.forEach(batch => {
    appendCard(main, batch.name, batch.image, () => {
      viewStack.push(() => renderBatches(batches));
      loadSubjects(API_BASE + batch.url, batch.url);
    });
  });
}

async function loadSubjects(subjectUrl, rawBatchUrl) {
  showLoader(true);
  subjectsDiv.innerHTML = "";
  searchInput.style.display = "none";
  try {
    const res = await fetch(subjectUrl);
    const subjects = await res.json();
    show(subjectsDiv);
    subjects.forEach(subject => {
      appendCard(subjectsDiv, subject.name, null, () => {
        viewStack.push(() => loadSubjects(subjectUrl, rawBatchUrl));
        loadChapters(API_BASE + subject.url);
      });
    });

    const batchId = decodeURIComponent(rawBatchUrl.split("=")[1]);
    const todayRes = await fetch(`${API_BASE}/api/pw/todayclass?batchId=${encodeURIComponent(batchId)}`);
    const todayClasses = await todayRes.json();
    todayWrapper.style.display = "block";
    todayClassesDiv.innerHTML = todayClasses.length === 0
      ? '<div style="color: gray; padding: 10px;">No live classes today.</div>'
      : "";

    todayClasses.forEach(cls => {
      const card = document.createElement("div");
      card.className = "today-card";
      card.innerHTML = `
        ${cls.image ? `<img src="${cls.image}" style="width: 100%; border-radius: 6px; margin-bottom: 5px;">` : ""}
        <div class="today-card-title">${cls.title}</div>
      `;
      card.onclick = () => openVideo(cls.url);
      todayClassesDiv.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to load subjects or today's classes:", err);
  } finally {
    showLoader(false);
  }
}

async function loadChapters(chapterUrl) {
  showLoader(true);
  chaptersDiv.innerHTML = "";
  try {
    const res = await fetch(chapterUrl);
    const chapters = await res.json();
    show(chaptersDiv);
    chapters.forEach(ch => {
      appendCard(chaptersDiv, ch.name, null, () => {
        viewStack.push(() => loadChapters(chapterUrl));
        loadLectures(API_BASE + ch.url);
      });
    });
  } catch (err) {
    console.error("Failed to load chapters:", err);
  } finally {
    showLoader(false);
  }
}

function loadLectures(lectureUrl) {
  currentLectureUrl = lectureUrl;
  switchLectureTab('lectures');
}

function switchLectureTab(type) {
  const apiMap = {
    lectures: '/api/pw/lectures',
    notes: '/api/pw/notes',
    dppnotes: '/api/pw/dppnotes',
    dpplecture: '/api/pw/dpplecture',
  };

  const replacements = {
    notes: "/notes",
    dppnotes: "/DppNotes",
    dpplecture: "/DppVideos"
  };

  const chapterId = new URLSearchParams(currentLectureUrl.split("?")[1]).get("chapterId") || "";
  const urlType = chapterId.replace("/videos", replacements[type] || "/videos");

  ["lectures", "notes", "dppnotes", "dpplecture"].forEach(tab => {
    document.getElementById("tab-" + tab).classList.remove("active");
  });
  document.getElementById("tab-" + type).classList.add("active");

  const lectureContent = document.getElementById("lectureContent");
  lectureContent.innerHTML = "";
  showLoader(true);

  fetch(`${API_BASE}${apiMap[type]}?chapterId=${encodeURIComponent(urlType)}`)
    .then(res => res.json())
    .then(items => {
      show(document.getElementById("lectureSection"));
      if (!items || items.length === 0) {
        lectureContent.innerHTML = `<div style="color: gray; font-size: 1.1rem; margin-top: 20px; text-align: center;">No content found.</div>`;
        return;
      }

      items.forEach(item => {
        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
          ${item.image || item.thumbnail ? `<img src="${item.image || item.thumbnail}" alt="${item.title}" />` : ""}
          <div class="card-title">${item.title}</div>
        `;
        div.onclick = () => openVideo(item.url);
        lectureContent.appendChild(div);
      });
    })
    .catch(err => console.error("Failed to load section:", err))
    .finally(() => showLoader(false));
}

async function openVideo(url) {
  if (url.endsWith(".pdf") || url.includes("youtube.com") || url.includes("youtu.be")) {
    window.open(url, "_blank");
    return;
  }

  overlay.style.display = "flex";
  try {
    const res = await fetch(`${API_BASE}/api/pw/video?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    let query = "";

    if (typeof data === "string") {
      query = `?type=live&url=${encodeURIComponent(data)}`;
    } else if (typeof data === "object" && data.url && !data.keys) {
      query = `?type=live&url=${encodeURIComponent(data.url)}`;
    } else if (data.url && data.keys?.length) {
      const [keyid, key] = data.keys[0].split(":");
      query = `?type=drm&url=${encodeURIComponent(data.url)}&keyid=${keyid}&key=${key}`;
      if (data.pssh) query += `&pssh=${encodeURIComponent(data.pssh)}`;
    } else {
      alert("Unsupported video format.");
      return;
    }

    window.location.href = `pwplayer.html${query}`;
  } catch (err) {
    console.error("Video load failed:", err);
    alert("Failed to load video.");
  } finally {
    overlay.style.display = "none";
  }
}

backBtn.onclick = () => {
  if (viewStack.length) {
    const lastView = viewStack.pop();
    lastView();
  }
};

searchInput.addEventListener("input", () => {
  const keyword = searchInput.value.toLowerCase();
  const filtered = allBatches.filter(b => b.name.toLowerCase().includes(keyword));
  renderBatches(filtered);
});

loadBatches();
