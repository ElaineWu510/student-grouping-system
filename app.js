// ==========================================
// Team Learning Grouping System v2
// 團隊學習分組系統 - 安全版本
// 密碼驗證在後端進行，前端不存放密碼
// ==========================================

// ============ 重要設定 ============
// 請將以下 URL 替換為您的 Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzo0YL4Od_TNY8kp9x1ge05TpMcQoBz1iORiBQjNPJfH813kaWaSOYNovwPKDBjAFfV4A/exec";

// Session storage keys
const ADMIN_SESSION_KEY = "adminLoggedIn";

// Local cache for admin data
let cachedStudents = [];
let adminPassword = ""; // 暫存密碼用於後續 API 請求（只在記憶體中，不存檔）

// ==========================================
// API Helper Functions (處理 CORS)
// ==========================================
async function apiRequest(action, params = {}) {
  // 使用 GET 請求 + URL 參數來避免 CORS 問題
  const url = new URL(GOOGLE_SCRIPT_URL);
  url.searchParams.append("action", action);

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "object") {
      url.searchParams.append(key, JSON.stringify(value));
    } else {
      url.searchParams.append(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    redirect: "follow",
  });

  return await response.json();
}

async function apiPost(action, data = {}) {
  // 使用表單提交方式來避免 CORS
  return new Promise((resolve, reject) => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = GOOGLE_SCRIPT_URL;
    form.target = "hidden_iframe";
    form.style.display = "none";

    // 建立隱藏的 iframe
    let iframe = document.getElementById("hidden_iframe");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.name = "hidden_iframe";
      iframe.id = "hidden_iframe";
      iframe.style.display = "none";
      document.body.appendChild(iframe);
    }

    // 添加資料
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "data";
    input.value = JSON.stringify({ action, ...data });
    form.appendChild(input);

    document.body.appendChild(form);

    // 設定超時
    const timeout = setTimeout(() => {
      document.body.removeChild(form);
      resolve({ success: true }); // 假設成功
    }, 3000);

    iframe.onload = () => {
      clearTimeout(timeout);
      document.body.removeChild(form);
      resolve({ success: true });
    };

    form.submit();
  });
}

// ==========================================
// Check URL for admin access
// ==========================================
function checkAdminAccess() {
  const urlParams = new URLSearchParams(window.location.search);
  const isAdmin = urlParams.get("admin") === "true";

  if (isAdmin) {
    document.getElementById("navTabs").classList.remove("hidden");
  }
}

// ==========================================
// Admin Login Functions
// ==========================================
function isAdminLoggedIn() {
  return (
    sessionStorage.getItem(ADMIN_SESSION_KEY) === "true" && adminPassword !== ""
  );
}

function setAdminLogin(status, password = "") {
  if (status && password) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    adminPassword = password;
  } else {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    adminPassword = "";
  }
}

function updateAdminUI() {
  const loginSection = document.getElementById("adminLogin");
  const contentSection = document.getElementById("adminContent");

  if (isAdminLoggedIn()) {
    loginSection.classList.add("hidden");
    contentSection.classList.remove("hidden");
    loadStudentData();
  } else {
    loginSection.classList.remove("hidden");
    contentSection.classList.add("hidden");
  }
}

// ==========================================
// Tab Navigation
// ==========================================
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const tabId = btn.dataset.tab;
    document
      .querySelectorAll(".section")
      .forEach((s) => s.classList.remove("active"));
    document.getElementById(tabId).classList.add("active");

    if (tabId === "admin") {
      updateAdminUI();
    }
  });
});

// ==========================================
// Login Form Handler (Backend Verification)
// ==========================================
document
  .getElementById("loginForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const password = document.getElementById("adminPassword").value;
    const errorMsg = document.getElementById("loginError");
    const submitBtn = this.querySelector('button[type="submit"]');

    if (!password) {
      errorMsg.textContent = "請輸入密碼";
      errorMsg.classList.remove("hidden");
      return;
    }

    // Disable button during verification
    submitBtn.disabled = true;
    submitBtn.innerHTML = "<span>驗證中...</span>";

    try {
      if (GOOGLE_SCRIPT_URL === "YOUR_GOOGLE_SCRIPT_URL_HERE") {
        errorMsg.textContent = "系統尚未設定完成，請聯繫管理員";
        errorMsg.classList.remove("hidden");
        return;
      }

      // Verify password with backend using GET
      const result = await apiRequest("verify_password", { password });

      if (result.success && result.verified) {
        setAdminLogin(true, password);
        updateAdminUI();
        document.getElementById("adminPassword").value = "";
        errorMsg.classList.add("hidden");
      } else {
        errorMsg.textContent = "密碼錯誤，請重新輸入";
        errorMsg.classList.remove("hidden");
        document.getElementById("adminPassword").value = "";
        document.getElementById("adminPassword").focus();
      }
    } catch (error) {
      console.error("Login error:", error);
      errorMsg.textContent = "連線錯誤，請稍後再試";
      errorMsg.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>登入</span><span class="btn-icon">→</span>';
    }
  });

// Logout
document.getElementById("logoutBtn").addEventListener("click", function () {
  if (confirm("確定要登出嗎？")) {
    setAdminLogin(false);
    cachedStudents = [];
    updateAdminUI();
  }
});

// ==========================================
// Student Form Submission
// ==========================================
document
  .getElementById("studentForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    // Clear previous errors
    clearAllErrors();

    // Validate form
    const missingFields = validateForm();

    if (missingFields.length > 0) {
      highlightMissingFields(missingFields);
      const fieldNames = missingFields.map((f) => f.label).join("\n• ");
      alert(`請填寫以下必填欄位：\n\n• ${fieldNames}`);
      const firstMissing = document.querySelector(".form-error");
      if (firstMissing) {
        firstMissing.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    // Show loading
    showLoading();

    const formData = new FormData(this);

    // Calculate scores
    const motivationScore = calculateAverage([
      formData.get("motivation1"),
      formData.get("motivation2"),
      formData.get("motivation3"),
    ]);

    const efficacyScore = calculateAverage([
      formData.get("efficacy1"),
      formData.get("efficacy2"),
      formData.get("efficacy3"),
    ]);

    const teamScore = calculateAverage([
      formData.get("team1"),
      formData.get("team2"),
      formData.get("team3"),
      formData.get("team4"),
    ]);

    const skillScore = calculateAverage([
      formData.get("skill1"),
      formData.get("skill2"),
      formData.get("skill3"),
      formData.get("skill4"),
    ]);

    const roleTendency = determineRole(
      parseInt(formData.get("team1")),
      parseInt(formData.get("team2")),
      parseInt(formData.get("team3")),
      parseInt(formData.get("team4")),
    );

    const cognitiveStyle = `${formData.get("cognitive1")}-${formData.get("cognitive2")}`;

    // Create student data object
    const studentData = {
      studentId: formData.get("studentId"),
      studentName: formData.get("studentName"),
      classSection: formData.get("classSection"),
      email: formData.get("email") || "",
      motivationScore: motivationScore,
      efficacyScore: efficacyScore,
      teamScore: teamScore,
      skillScore: skillScore,
      cognitiveStyle: cognitiveStyle,
      roleTendency: roleTendency,
      submittedAt: new Date().toISOString(),
    };

    try {
      if (GOOGLE_SCRIPT_URL === "YOUR_GOOGLE_SCRIPT_URL_HERE") {
        throw new Error("Backend not configured");
      }

      // 使用 Google Forms 風格的提交方式（透過隱藏 iframe）
      await submitViaIframe(studentData);

      hideLoading();
      showSuccess();
    } catch (error) {
      console.error("Submission error:", error);
      hideLoading();
      document.getElementById("errorText").textContent =
        "提交失敗，請稍後再試或聯繫老師。";
      document.querySelector(".questionnaire-card").classList.add("hidden");
      document.getElementById("errorMessage").classList.remove("hidden");
    }
  });

// 透過隱藏 iframe 提交資料（避免 CORS 問題）
function submitViaIframe(studentData) {
  return new Promise((resolve, reject) => {
    // 建立隱藏的 iframe
    const iframeName = "submit_iframe_" + Date.now();
    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    // 建立表單
    const form = document.createElement("form");
    form.method = "POST";
    form.action = GOOGLE_SCRIPT_URL;
    form.target = iframeName;
    form.style.display = "none";

    // 添加資料欄位
    const dataInput = document.createElement("input");
    dataInput.type = "hidden";
    dataInput.name = "postData";
    dataInput.value = JSON.stringify({
      action: "submit",
      studentData: studentData,
    });
    form.appendChild(dataInput);

    document.body.appendChild(form);

    // 設定超時（3秒後假設成功）
    const timeout = setTimeout(() => {
      cleanup();
      resolve({ success: true });
    }, 3000);

    // iframe 載入完成
    iframe.onload = () => {
      clearTimeout(timeout);
      cleanup();
      resolve({ success: true });
    };

    iframe.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error("提交失敗"));
    };

    function cleanup() {
      if (form.parentNode) document.body.removeChild(form);
      if (iframe.parentNode) document.body.removeChild(iframe);
    }

    // 提交表單
    form.submit();
  });
}

// ==========================================
// Load Student Data (Admin - Requires Password)
// ==========================================
async function loadStudentData() {
  if (!adminPassword) {
    alert("請先登入");
    updateAdminUI();
    return;
  }

  try {
    if (GOOGLE_SCRIPT_URL === "YOUR_GOOGLE_SCRIPT_URL_HERE") {
      throw new Error("Backend not configured");
    }

    // Load from Google Sheets with password using GET
    const result = await apiRequest("get_data", { password: adminPassword });

    if (result.success) {
      cachedStudents = result.data || [];
    } else {
      if (result.error === "密碼錯誤") {
        alert("密碼驗證失敗，請重新登入");
        setAdminLogin(false);
        updateAdminUI();
        return;
      }
      throw new Error(result.error || "載入失敗");
    }
  } catch (error) {
    console.error("Error loading data:", error);
    alert("載入資料失敗：" + error.message);
    cachedStudents = [];
  }

  refreshAdminDisplay();
}

function refreshAdminDisplay() {
  // Update stats
  document.getElementById("totalStudents").textContent = cachedStudents.length;
  document.getElementById("classACount").textContent = cachedStudents.filter(
    (s) => s.classSection === "A",
  ).length;
  document.getElementById("classBCount").textContent = cachedStudents.filter(
    (s) => s.classSection === "B",
  ).length;

  // Update table
  const tbody = document.getElementById("studentTableBody");
  tbody.innerHTML = "";

  if (cachedStudents.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align: center; color: #7f8c8d;">目前沒有學生資料</td></tr>';
    return;
  }

  cachedStudents.forEach((student) => {
    const row = document.createElement("tr");
    const classDisplay =
      student.classSection === "A" ? "MIS 全英" : "管資 中文";
    row.innerHTML = `
            <td>${student.studentId || "-"}</td>
            <td>${student.studentName || "-"}</td>
            <td>${classDisplay}</td>
            <td>${student.motivationScore || "-"}</td>
            <td>${student.efficacyScore || "-"}</td>
            <td>${student.teamScore || "-"}</td>
            <td>${formatCognitiveStyle(student.cognitiveStyle)}</td>
            <td><span class="member-role">${student.roleTendency || "-"}</span></td>
        `;
    tbody.appendChild(row);
  });
}

// ==========================================
// Utility Functions
// ==========================================
function calculateAverage(values) {
  const nums = values.map((v) => parseInt(v)).filter((v) => !isNaN(v));
  return nums.length > 0
    ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)
    : 0;
}

function determineRole(leadership, coordination, execution, creativity) {
  const roles = {
    leader: leadership || 0,
    coordinator: coordination || 0,
    executor: execution || 0,
    innovator: creativity || 0,
  };

  const maxRole = Object.entries(roles).reduce((a, b) => (a[1] > b[1] ? a : b));

  const roleNames = {
    leader: "領導者",
    coordinator: "協調者",
    executor: "執行者",
    innovator: "創意者",
  };

  return roleNames[maxRole[0]];
}

function formatCognitiveStyle(style) {
  if (!style) return "-";
  const parts = style.split("-");
  const styles = {
    holist: "整體",
    serialist: "循序",
    intuitive: "直覺",
    analytical: "分析",
  };
  return `${styles[parts[0]] || parts[0]}/${styles[parts[1]] || parts[1]}`;
}

// ==========================================
// Form Validation
// ==========================================
function validateForm() {
  const missingFields = [];

  const basicFields = [
    { name: "studentId", label: "學號 Student ID" },
    { name: "studentName", label: "姓名 Name" },
    { name: "classSection", label: "班級 Class" },
  ];

  basicFields.forEach((field) => {
    const element = document.querySelector(`[name="${field.name}"]`);
    if (!element.value) {
      missingFields.push({ ...field, element });
    }
  });

  const radioGroups = [
    { name: "motivation1", label: "學習動機 第1題" },
    { name: "motivation2", label: "學習動機 第2題" },
    { name: "motivation3", label: "學習動機 第3題" },
    { name: "efficacy1", label: "自我效能 第1題" },
    { name: "efficacy2", label: "自我效能 第2題" },
    { name: "efficacy3", label: "自我效能 第3題" },
    { name: "cognitive1", label: "認知風格 第1題" },
    { name: "cognitive2", label: "認知風格 第2題" },
    { name: "team1", label: "團隊合作偏好 第1題" },
    { name: "team2", label: "團隊合作偏好 第2題" },
    { name: "team3", label: "團隊合作偏好 第3題" },
    { name: "team4", label: "團隊合作偏好 第4題" },
    { name: "skill1", label: "技術能力 - 資訊系統概念" },
    { name: "skill2", label: "技術能力 - 簡報製作能力" },
    { name: "skill3", label: "技術能力 - 資料分析能力" },
    { name: "skill4", label: "技術能力 - 英文讀寫能力" },
  ];

  radioGroups.forEach((group) => {
    const checked = document.querySelector(
      `input[name="${group.name}"]:checked`,
    );
    if (!checked) {
      const firstRadio = document.querySelector(`input[name="${group.name}"]`);
      missingFields.push({ ...group, element: firstRadio });
    }
  });

  return missingFields;
}

function highlightMissingFields(fields) {
  fields.forEach((field) => {
    if (field.element) {
      let container =
        field.element.closest(".form-group") ||
        field.element.closest(".likert-item") ||
        field.element.closest(".cognitive-item") ||
        field.element.closest(".skill-item");

      if (container) {
        container.classList.add("form-error");

        if (!container.querySelector(".error-message")) {
          const errorMsg = document.createElement("span");
          errorMsg.className = "error-message";
          errorMsg.textContent = "⚠️ 此欄位必填";
          container.appendChild(errorMsg);
        }
      }
    }
  });
}

function clearAllErrors() {
  document
    .querySelectorAll(".form-error")
    .forEach((el) => el.classList.remove("form-error"));
  document.querySelectorAll(".error-message").forEach((el) => el.remove());
}

// ==========================================
// UI Helpers
// ==========================================
function showLoading() {
  document.getElementById("loadingOverlay").classList.remove("hidden");
  document.getElementById("submitBtn").disabled = true;
}

function hideLoading() {
  document.getElementById("loadingOverlay").classList.add("hidden");
  document.getElementById("submitBtn").disabled = false;
}

function showSuccess() {
  document.querySelector(".questionnaire-card").classList.add("hidden");
  document.getElementById("successMessage").classList.remove("hidden");
}

function hideError() {
  document.getElementById("errorMessage").classList.add("hidden");
  document.querySelector(".questionnaire-card").classList.remove("hidden");
}

// ==========================================
// Grouping Functions
// ==========================================
function generateGroups() {
  if (cachedStudents.length === 0) {
    alert("目前沒有學生資料！請先點擊「重新載入資料」");
    return;
  }

  const groupSize = parseInt(document.getElementById("groupSize").value);
  const strategy = document.getElementById("groupStrategy").value;

  const classA = cachedStudents.filter((s) => s.classSection === "A");
  const classB = cachedStudents.filter((s) => s.classSection === "B");

  const groupsA = createGroups(classA, groupSize, strategy);
  const groupsB = createGroups(classB, groupSize, strategy);

  displayGroups("classAGroups", groupsA, "A");
  displayGroups("classBGroups", groupsB, "B");

  document.getElementById("groupingResults").classList.remove("hidden");

  // Store for report download
  localStorage.setItem("groupingResultsA", JSON.stringify(groupsA));
  localStorage.setItem("groupingResultsB", JSON.stringify(groupsB));
}

function createGroups(students, groupSize, strategy) {
  if (students.length === 0) return [];

  let sortedStudents;

  switch (strategy) {
    case "heterogeneous":
      sortedStudents = [...students].sort((a, b) => {
        const scoreA =
          parseFloat(a.motivationScore || 0) +
          parseFloat(a.efficacyScore || 0) +
          parseFloat(a.teamScore || 0);
        const scoreB =
          parseFloat(b.motivationScore || 0) +
          parseFloat(b.efficacyScore || 0) +
          parseFloat(b.teamScore || 0);
        return scoreB - scoreA;
      });
      return createHeterogeneousGroups(sortedStudents, groupSize);

    case "homogeneous":
      sortedStudents = [...students].sort((a, b) => {
        const scoreA =
          parseFloat(a.motivationScore || 0) + parseFloat(a.efficacyScore || 0);
        const scoreB =
          parseFloat(b.motivationScore || 0) + parseFloat(b.efficacyScore || 0);
        return scoreB - scoreA;
      });
      return createHomogeneousGroups(sortedStudents, groupSize);

    case "balanced":
      return createBalancedGroups(students, groupSize);

    default:
      return createHeterogeneousGroups(students, groupSize);
  }
}

function createHeterogeneousGroups(students, groupSize) {
  const numGroups = Math.ceil(students.length / groupSize);
  const groups = Array.from({ length: numGroups }, () => []);

  let direction = 1;
  let groupIndex = 0;

  students.forEach((student) => {
    groups[groupIndex].push(student);

    if (direction === 1) {
      groupIndex++;
      if (groupIndex >= numGroups) {
        groupIndex = numGroups - 1;
        direction = -1;
      }
    } else {
      groupIndex--;
      if (groupIndex < 0) {
        groupIndex = 0;
        direction = 1;
      }
    }
  });

  return groups;
}

function createHomogeneousGroups(students, groupSize) {
  const groups = [];
  for (let i = 0; i < students.length; i += groupSize) {
    groups.push(students.slice(i, i + groupSize));
  }
  return groups;
}

function createBalancedGroups(students, groupSize) {
  const numGroups = Math.ceil(students.length / groupSize);
  const groups = Array.from({ length: numGroups }, () => []);

  const roleGroups = { 領導者: [], 協調者: [], 執行者: [], 創意者: [] };

  students.forEach((student) => {
    const role = student.roleTendency || "執行者";
    if (roleGroups[role]) {
      roleGroups[role].push(student);
    } else {
      roleGroups["執行者"].push(student);
    }
  });

  Object.values(roleGroups).forEach((roleStudents) => {
    roleStudents.forEach((student, index) => {
      groups[index % numGroups].push(student);
    });
  });

  return groups;
}

function displayGroups(containerId, groups, className) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (groups.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: #7f8c8d;">目前沒有學生資料</p>';
    return;
  }

  const classDisplayName = className === "A" ? "MIS" : "管資";

  groups.forEach((group, index) => {
    const card = document.createElement("div");
    card.className = "group-card";

    const membersHtml = group
      .map(
        (student) => `
            <li>
                <div class="member-info">
                    <span>${student.studentName || "-"}</span>
                    <span class="member-id">(${student.studentId || "-"})</span>
                </div>
                <span class="member-role">${student.roleTendency || "-"}</span>
            </li>
        `,
      )
      .join("");

    card.innerHTML = `
            <div class="group-header">
                <span class="group-name">${classDisplayName} 第${index + 1}組</span>
                <span class="group-size">${group.length}人</span>
            </div>
            <ul class="group-members">${membersHtml}</ul>
        `;

    container.appendChild(card);
  });
}

// ==========================================
// Export Functions
// ==========================================
function downloadReport() {
  const groupsA = JSON.parse(localStorage.getItem("groupingResultsA") || "[]");
  const groupsB = JSON.parse(localStorage.getItem("groupingResultsB") || "[]");

  if (groupsA.length === 0 && groupsB.length === 0) {
    alert("請先執行智慧分組！");
    return;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString("zh-TW");
  const timeStr = now.toLocaleTimeString("zh-TW");

  let report = `
================================================================================
                        團隊學習分組報告
                   Team Learning Grouping Report
================================================================================

產生時間：${dateStr} ${timeStr}
總學生數：${cachedStudents.length} 人
MIS 全英班 (DMSI20090、MSF_10180)：${cachedStudents.filter((s) => s.classSection === "A").length} 人
管理資訊系統 中文班 (IM__10600)：${cachedStudents.filter((s) => s.classSection === "B").length} 人
分組策略：${document.getElementById("groupStrategy").selectedOptions[0].text}
每組人數：${document.getElementById("groupSize").value} 人

================================================================================
                    MIS 全英班分組結果 (9:00-12:00)
                    DMSI20090、MSF_10180
================================================================================
`;

  groupsA.forEach((group, index) => {
    report += `\n【第${index + 1}組】(${group.length}人)\n`;
    report += "-".repeat(50) + "\n";
    group.forEach((student) => {
      report += `  ${student.studentId}\t${student.studentName}\t${student.roleTendency}\n`;
    });
  });

  report += `
================================================================================
                 管理資訊系統 中文班分組結果 (2:00-5:00)
                          IM__10600
================================================================================
`;

  groupsB.forEach((group, index) => {
    report += `\n【第${index + 1}組】(${group.length}人)\n`;
    report += "-".repeat(50) + "\n";
    group.forEach((student) => {
      report += `  ${student.studentId}\t${student.studentName}\t${student.roleTendency}\n`;
    });
  });

  report += `
================================================================================
                            學生詳細資料
================================================================================

學號\t\t姓名\t\t班級\t動機\t效能\t團隊\t認知風格\t\t角色
`;

  cachedStudents.forEach((s) => {
    const classDisplay = s.classSection === "A" ? "MIS" : "管資";
    report += `${s.studentId}\t${s.studentName}\t${classDisplay}\t${s.motivationScore}\t${s.efficacyScore}\t${s.teamScore}\t${formatCognitiveStyle(s.cognitiveStyle)}\t\t${s.roleTendency}\n`;
  });

  report += `
================================================================================
                             報告結束
================================================================================
`;

  const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `分組報告_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadCSV() {
  if (cachedStudents.length === 0) {
    alert("目前沒有學生資料！");
    return;
  }

  let csv = "\uFEFF";
  csv +=
    "學號,姓名,班級,電子郵件,動機分數,效能分數,團隊分數,技能分數,認知風格,角色傾向,提交時間\n";

  cachedStudents.forEach((s) => {
    const classDisplay = s.classSection === "A" ? "MIS全英班" : "管資中文班";
    csv += `${s.studentId},${s.studentName},${classDisplay},${s.email || ""},${s.motivationScore},${s.efficacyScore},${s.teamScore},${s.skillScore || ""},${formatCognitiveStyle(s.cognitiveStyle)},${s.roleTendency},${s.submittedAt}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `學生資料_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================
// Event Listeners
// ==========================================
document
  .getElementById("generateGroups")
  .addEventListener("click", generateGroups);
document
  .getElementById("downloadReport")
  .addEventListener("click", downloadReport);
document.getElementById("downloadCSV").addEventListener("click", downloadCSV);
document
  .getElementById("refreshData")
  .addEventListener("click", loadStudentData);

// ==========================================
// Initial Load
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  checkAdminAccess();
});
