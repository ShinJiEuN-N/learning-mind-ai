const state = {
  currentPlan: null,
  timer: null,
  secondsLeft: 0,
  running: false,
  records: JSON.parse(localStorage.getItem("learningMindRecords") || "[]"),
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 41;
const energyLabels = {
  1: "소진",
  2: "매우 낮음",
  3: "낮음",
  4: "보통",
  5: "조금 충분",
  6: "충분",
  7: "매우 충분",
};

const patterns = {
  unclear: {
    title: "시작점을 보이게 하는 계획",
    message:
      "자기조절학습에서는 목표를 작게 정하고 다음 행동을 분명히 만드는 것이 시작 장벽을 낮추는 데 중요해요.",
    steps: ["공부할 범위 제목만 훑기", "오늘 다룰 한 단원이나 한 페이지 고르기", "첫 행동을 1문장으로 적기"],
  },
  anxiety: {
    title: "평가 불안을 낮추는 계획",
    message:
      "시험이나 실패 걱정은 회피를 키울 수 있어요. 오늘은 결과보다 통제 가능한 작은 행동에 초점을 맞춰요.",
    steps: ["가장 익숙한 예제 1개 보기", "틀려도 채점하지 말고 표시만 남기기", "마지막에 할 수 있었던 것 1개 적기"],
  },
  perfection: {
    title: "완벽주의를 낮추는 계획",
    message:
      "완벽하게 하려는 마음은 시작을 늦출 수 있어요. 오늘의 기준은 완성도가 아니라 시도입니다.",
    steps: ["초안처럼 개념 5줄 적기", "시간 안에 문제 2개만 풀기", "완성도 대신 완료 여부 체크하기"],
  },
  attention: {
    title: "주의 전환을 돕는 계획",
    message:
      "주의가 자주 새는 날에는 의지보다 환경과 단서가 중요해요. 짧은 타이머와 분명한 끝점을 사용해요.",
    steps: ["알림 끄고 화면 하나만 남기기", "10분 타이머 켜기", "한 페이지나 한 구간만 끝내기"],
  },
  lowValue: {
    title: "의미와 보상을 붙이는 계획",
    message:
      "흥미나 보상이 멀게 느껴지면 미루기 쉬워요. 공부의 가치를 아주 가까운 보상과 연결해봅시다.",
    steps: ["이 공부가 필요한 이유 1개 적기", "쉬운 문제나 짧은 영상부터 시작하기", "끝나면 작은 보상 1개 정하기"],
  },
  overload: {
    title: "인지 부담을 줄이는 계획",
    message:
      "양이 많아 보이면 뇌는 시작보다 회피를 택하기 쉬워요. 전체가 아니라 가장 작은 묶음 하나만 잡아봐요.",
    steps: ["해야 할 것을 3개 이하로 나누기", "가장 부담 낮은 것 1개 선택하기", "선택한 것만 15분 진행하기"],
  },
};

const tabs = document.querySelectorAll(".tab");
const views = {
  checkin: document.querySelector("#checkinView"),
  coach: document.querySelector("#coachView"),
  records: document.querySelector("#recordsView"),
};

tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

document.querySelector("#energyInput").addEventListener("input", (event) => {
  document.querySelector("#energyValue").textContent = event.target.value;
  updateReadiness();
});

document.querySelector("#checkinForm").addEventListener("input", updateReadiness);
document.querySelector("#checkinForm").addEventListener("submit", (event) => {
  event.preventDefault();
  createPlan();
  switchView("coach");
});

document.querySelector("#startTimerButton").addEventListener("click", startTimer);
document.querySelector("#pauseTimerButton").addEventListener("click", toggleTimer);
document.querySelector("#finishSessionButton").addEventListener("click", finishSession);
document.querySelector("#saveReflectionButton").addEventListener("click", saveReflection);
document.querySelector("#planButton").addEventListener("click", (event) => {
  event.preventDefault();
  createPlan();
  switchView("coach");
});

function switchView(name) {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === name));
  Object.entries(views).forEach(([key, view]) => view.classList.toggle("active", key === name));
  if (name === "records") renderRecords();
}

function selectedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
}

function updateReadiness() {
  const energy = Number(document.querySelector("#energyInput").value);
  const time = Number(document.querySelector("#timeInput").value);
  const mood = selectedValue("mood");
  const moodPenaltyMap = {
    보통: 0,
    지루함: 7,
    좌절: 10,
    무기력: 11,
    압도: 12,
    불안: 12,
  };
  const moodPenalty = moodPenaltyMap[mood] ?? 8;
  const focusConfidence = Math.min(time, 30) / 30;
  const score = Math.max(20, Math.min(95, Math.round(22 + energy * 7 + focusConfidence * 18 - moodPenalty)));
  document.querySelector("#energyLabel").textContent = energyLabels[energy];
  document.querySelector("#ringValue").textContent = score;
  document.querySelector(".ring-progress").style.strokeDashoffset =
    String(RING_CIRCUMFERENCE * (1 - score / 100));
}

function createPlan() {
  const subject = document.querySelector("#subjectInput").value.trim() || "오늘 공부";
  const reason = selectedValue("reason");
  const mood = selectedValue("mood");
  const energy = Number(document.querySelector("#energyInput").value);
  const focusTime = Number(document.querySelector("#timeInput").value);
  const pattern = patterns[reason];
  const duration = choosePlanDuration(energy, focusTime, mood);

  state.currentPlan = {
    subject,
    reason,
    mood,
    energy,
    focusTime,
    duration,
    pattern: pattern.title,
    message: pattern.message,
    steps: pattern.steps,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  window.learningMindState = state;

  document.querySelector("#patternTitle").textContent = pattern.title;
  document.querySelector("#coachMessage").textContent = `${subject}를 끝내는 것이 아니라 시작하는 데 집중해요. ${pattern.message}`;
  document.querySelector("#planDuration").textContent = `${duration}분`;
  document.querySelector("#planList").innerHTML = pattern.steps.map((step) => `<li>${step}</li>`).join("");
  resetTimer(duration * 60);
}

function choosePlanDuration(energy, focusTime, mood) {
  const lowCapacity = energy <= 2 || ["불안", "압도", "무기력", "좌절"].includes(mood);
  const highCapacity = energy >= 6 && focusTime >= 25 && mood === "보통";

  if (lowCapacity) return 10;
  if (highCapacity) return 25;
  if (focusTime <= 10) return 10;
  if (focusTime <= 20) return 15;
  return 20;
}

function resetTimer(seconds) {
  clearInterval(state.timer);
  state.timer = null;
  state.running = false;
  state.secondsLeft = seconds;
  document.querySelector("#pauseTimerButton").textContent = "일시정지";
  renderTimer();
  window.learningMindState = state;
}

function startTimer() {
  if (!state.currentPlan || state.running) return;
  state.running = true;
  state.timer = setInterval(() => {
    state.secondsLeft = Math.max(0, state.secondsLeft - 1);
    renderTimer();
    if (state.secondsLeft === 0) finishSession();
  }, 1000);
}

function toggleTimer() {
  if (!state.currentPlan) return;
  if (state.running) {
    clearInterval(state.timer);
    state.running = false;
    document.querySelector("#pauseTimerButton").textContent = "계속";
  } else {
    document.querySelector("#pauseTimerButton").textContent = "일시정지";
    startTimer();
  }
}

function renderTimer() {
  const minutes = String(Math.floor(state.secondsLeft / 60)).padStart(2, "0");
  const seconds = String(state.secondsLeft % 60).padStart(2, "0");
  document.querySelector("#timerText").textContent = `${minutes}:${seconds}`;
}

function finishSession() {
  if (!state.currentPlan) return;
  clearInterval(state.timer);
  state.running = false;
  state.currentPlan.completed = true;
  document.querySelector("#timerText").textContent = "완료";
  window.learningMindState = state;
}

function saveReflection() {
  if (!state.currentPlan) return;
  const reflection = document.querySelector("#reflectionInput").value.trim();
  const record = {
    ...state.currentPlan,
    reflection: reflection || "회고를 남기지 않았습니다.",
    savedAt: new Date().toISOString(),
  };
  state.records.unshift(record);
  window.learningMindState = state;
  localStorage.setItem("learningMindRecords", JSON.stringify(state.records));
  document.querySelector("#reflectionInput").value = "";
  switchView("records");
}

function renderRecords() {
  document.querySelector("#recordCount").textContent = `${state.records.length}회`;
  const completed = state.records.filter((record) => record.completed).length;
  const completionRate = state.records.length ? Math.round((completed / state.records.length) * 100) : 0;
  const averageEnergy = state.records.length
    ? (state.records.reduce((sum, record) => sum + record.energy, 0) / state.records.length).toFixed(1)
    : "0.0";

  document.querySelector("#completionRate").textContent = `${completionRate}%`;
  document.querySelector("#averageEnergy").textContent = averageEnergy;
  renderMoodChart();

  const list = document.querySelector("#recordList");
  if (!state.records.length) {
    list.innerHTML = '<p class="empty-state">아직 저장된 기록이 없습니다.</p>';
    return;
  }

  list.innerHTML = state.records
    .map((record) => {
      const date = new Intl.DateTimeFormat("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(record.savedAt));
      return `
        <article class="record-card">
          <strong>${record.subject}</strong>
          <p>${record.reflection}</p>
          <div class="record-meta">
            <span>${date}</span>
            <span>${record.pattern}</span>
            <span>${record.mood}</span>
            <span>${record.duration}분</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMoodChart() {
  const moods = ["불안", "압도", "지루함", "좌절", "무기력", "보통"];
  const max = Math.max(1, ...moods.map((mood) => state.records.filter((record) => record.mood === mood).length));
  document.querySelector("#moodChart").innerHTML = moods
    .map((mood) => {
      const count = state.records.filter((record) => record.mood === mood).length;
      const width = Math.round((count / max) * 100);
      return `
        <div class="chart-row">
          <span>${mood}</span>
          <div class="bar-track"><div class="bar" style="width:${width}%"></div></div>
          <span>${count}</span>
        </div>
      `;
    })
    .join("");
}

function resetRecords() {
  localStorage.removeItem("learningMindRecords");
  state.records = [];
  renderRecords();
  updateReadiness();
}

updateReadiness();
renderRecords();
