// ==========================================
// Team-Based Learning Grouping Survey v3
// 團隊學習分組問卷系統
// ==========================================

// ============ 設定 ============
const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_SCRIPT_URL_HERE';
const ADMIN_SESSION_KEY = 'adminLoggedIn';

let cachedStudents = [];
let adminPassword = '';

// 動態載入 SheetJS 庫（用於產生 xlsx 檔案）
function loadSheetJS() {
    return new Promise((resolve, reject) => {
        if (window.XLSX) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ==========================================
// 初始化
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
    setupFormInteractions();
});

function checkAdminAccess() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'true') {
        document.getElementById('navTabs').classList.remove('hidden');
    }
}

function setupFormInteractions() {
    // 當選擇「以上皆無」時，取消其他選項
    const coursesNone = document.getElementById('coursesNone');
    if (coursesNone) {
        coursesNone.addEventListener('change', function() {
            if (this.checked) {
                document.querySelectorAll('input[name="courses"]:not(#coursesNone)').forEach(cb => cb.checked = false);
            }
        });
        document.querySelectorAll('input[name="courses"]:not(#coursesNone)').forEach(cb => {
            cb.addEventListener('change', function() {
                if (this.checked) coursesNone.checked = false;
            });
        });
    }

    // 團隊角色：選「沒有特別偏好」時取消其他
    const roleNone = document.querySelector('input[name="teamRole"][value="none"]');
    if (roleNone) {
        roleNone.addEventListener('change', function() {
            if (this.checked) {
                document.querySelectorAll('input[name="teamRole"]:not([value="none"])').forEach(cb => cb.checked = false);
            }
        });
        document.querySelectorAll('input[name="teamRole"]:not([value="none"])').forEach(cb => {
            cb.addEventListener('change', function() {
                if (this.checked) roleNone.checked = false;
            });
        });
    }
}

// ==========================================
// Tab Navigation
// ==========================================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        
        if (tabId === 'admin') {
            updateAdminUI();
        }
    });
});

// ==========================================
// 表單提交處理
// ==========================================
document.getElementById('studentForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // 驗證表單
    if (!validateForm()) return;
    
    showLoading();
    
    const formData = new FormData(this);
    const studentData = collectFormData(formData);
    
    try {
        if (GOOGLE_SCRIPT_URL !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
            await submitToGoogleSheets(studentData);
        }
        
        hideLoading();
        showResults(studentData);
        
    } catch (error) {
        console.error('Submission error:', error);
        hideLoading();
        showError('提交失敗，請稍後再試。您的結果分析仍會顯示。');
        showResults(studentData);
    }
});

function collectFormData(formData) {
    // 基本資料
    const studentId = formData.get('studentId');
    const studentName = formData.get('studentName');
    const classSection = formData.get('classSection');
    const gender = formData.get('gender');
    const nationality = formData.get('nationality') === 'other' ? formData.get('nationalityOther') : formData.get('nationality');
    const nativeLanguage = formData.get('nativeLanguage') === 'other' ? formData.get('nativeLanguageOther') : formData.get('nativeLanguage');
    
    // 英語能力
    const engReading = parseInt(formData.get('engReading')) || 0;
    const engListening = parseInt(formData.get('engListening')) || 0;
    const engSpeaking = parseInt(formData.get('engSpeaking')) || 0;
    const engWriting = parseInt(formData.get('engWriting')) || 0;
    const engAvg = ((engReading + engListening + engSpeaking + engWriting) / 4).toFixed(2);
    
    // 中文能力
    const chnReading = parseInt(formData.get('chnReading')) || 0;
    const chnListening = parseInt(formData.get('chnListening')) || 0;
    const chnSpeaking = parseInt(formData.get('chnSpeaking')) || 0;
    const chnWriting = parseInt(formData.get('chnWriting')) || 0;
    let chnAvg = 0;
    const chnScores = [chnReading, chnListening, chnSpeaking, chnWriting].filter(v => v > 0);
    if (chnScores.length > 0) {
        chnAvg = (chnScores.reduce((a, b) => a + b, 0) / chnScores.length).toFixed(2);
    }
    
    // 修過的課程
    const courses = formData.getAll('courses');
    const courseCount = courses.includes('none') ? 0 : courses.length;
    
    // IT 技能
    const itOffice = parseInt(formData.get('itOffice')) || 0;
    const itGoogle = parseInt(formData.get('itGoogle')) || 0;
    const itDatabase = parseInt(formData.get('itDatabase')) || 0;
    const itProject = parseInt(formData.get('itProject')) || 0;
    const itCollab = parseInt(formData.get('itCollab')) || 0;
    const itAI = parseInt(formData.get('itAI')) || 0;
    const itAvg = ((itOffice + itGoogle + itDatabase + itProject + itCollab + itAI) / 6).toFixed(2);
    
    // 管理知識
    const mgmtBPM = parseInt(formData.get('mgmtBPM')) || 0;
    const mgmtSCM = parseInt(formData.get('mgmtSCM')) || 0;
    const mgmtCRM = parseInt(formData.get('mgmtCRM')) || 0;
    const mgmtERP = parseInt(formData.get('mgmtERP')) || 0;
    const mgmtBI = parseInt(formData.get('mgmtBI')) || 0;
    const mgmtDT = parseInt(formData.get('mgmtDT')) || 0;
    const mgmtAvg = ((mgmtBPM + mgmtSCM + mgmtCRM + mgmtERP + mgmtBI + mgmtDT) / 6).toFixed(2);
    
    // 先備知識綜合分數 (課程*2 + IT + 管理)/3
    const priorKnowledge = ((courseCount * 2 + parseFloat(itAvg) * 2 + parseFloat(mgmtAvg) * 2) / 3).toFixed(2);
    
    // 學習動機 (MSLQ)
    const mslq11 = parseInt(formData.get('mslq11')) || 0;
    const mslq12 = parseInt(formData.get('mslq12')) || 0;
    const mslq13 = parseInt(formData.get('mslq13')) || 0;
    const mslq14 = parseInt(formData.get('mslq14')) || 0;
    const mslq15 = parseInt(formData.get('mslq15')) || 0;
    const mslq16 = parseInt(formData.get('mslq16')) || 0;
    
    const intrinsicMotivation = ((mslq11 + mslq12 + mslq13) / 3).toFixed(2);
    const extrinsicMotivation = ((mslq14 + mslq15 + mslq16) / 3).toFixed(2);
    const motivationType = parseFloat(intrinsicMotivation) > parseFloat(extrinsicMotivation) + 0.5 ? 'intrinsic' :
                           parseFloat(extrinsicMotivation) > parseFloat(intrinsicMotivation) + 0.5 ? 'extrinsic' : 'balanced';
    
    // 自我效能
    const seScores = [];
    for (let i = 17; i <= 26; i++) {
        seScores.push(parseInt(formData.get('se' + i)) || 0);
    }
    const selfEfficacy = (seScores.reduce((a, b) => a + b, 0) / seScores.length).toFixed(2);
    
    // 團隊合作
    const teamExp = parseInt(formData.get('teamExp')) || 3;
    const teamRoles = formData.getAll('teamRole');
    const teamTimes = formData.getAll('teamTime');
    
    // 開放式問題
    const bestExperience = formData.get('bestExperience') || '';
    const worstExperience = formData.get('worstExperience') || '';
    const teamLearning = formData.get('teamLearning') || '';
    const teamContribution = formData.get('teamContribution') || '';
    const specialNeeds = formData.get('specialNeeds') || '';
    
    return {
        // 基本資料
        studentId,
        studentName,
        classSection,
        gender,
        nationality,
        nativeLanguage,
        
        // 語言能力
        engAvg: parseFloat(engAvg),
        engReading, engListening, engSpeaking, engWriting,
        chnAvg: parseFloat(chnAvg) || 0,
        
        // 先備知識
        courseCount,
        courses: courses.join(','),
        itAvg: parseFloat(itAvg),
        mgmtAvg: parseFloat(mgmtAvg),
        priorKnowledge: parseFloat(priorKnowledge),
        
        // 動機
        intrinsicMotivation: parseFloat(intrinsicMotivation),
        extrinsicMotivation: parseFloat(extrinsicMotivation),
        motivationType,
        
        // 自我效能
        selfEfficacy: parseFloat(selfEfficacy),
        
        // 團隊
        teamExp,
        teamRoles: teamRoles.join(','),
        teamTimes: teamTimes.join(','),
        
        // 開放問題
        bestExperience,
        worstExperience,
        teamLearning,
        teamContribution,
        specialNeeds,
        
        // 時間戳
        submittedAt: new Date().toISOString()
    };
}

// ==========================================
// 顯示結果分析
// ==========================================
function showResults(data) {
    // 隱藏問卷，顯示結果
    document.querySelector('.questionnaire-card').classList.add('hidden');
    document.getElementById('resultsSection').classList.remove('hidden');
    
    // 基本資料
    document.getElementById('studentNameDisplay').textContent = data.studentName;
    document.getElementById('studentIdDisplay').textContent = `學號：${data.studentId}`;
    
    // 先備知識
    const knowledgePercent = Math.min(100, (data.priorKnowledge / 10) * 100);
    const knowledgeMeter = document.getElementById('knowledgeMeter');
    knowledgeMeter.style.width = knowledgePercent + '%';
    knowledgeMeter.className = 'meter-fill ' + getLevel(knowledgePercent);
    document.getElementById('knowledgeLabel').textContent = getLevelText(knowledgePercent);
    document.getElementById('knowledgeScore').textContent = `綜合分數：${data.priorKnowledge.toFixed(1)} / 10`;
    
    // IT 能力
    const itPercent = (data.itAvg / 5) * 100;
    const itMeter = document.getElementById('itMeter');
    itMeter.style.width = itPercent + '%';
    itMeter.className = 'meter-fill ' + getLevel(itPercent);
    document.getElementById('itLabel').textContent = getLevelText(itPercent);
    document.getElementById('itScore').textContent = `平均分數：${data.itAvg.toFixed(1)} / 5`;
    
    // 動機類型
    const motivationType = document.getElementById('motivationType');
    const badge = motivationType.querySelector('.type-badge');
    badge.className = 'type-badge ' + data.motivationType;
    const typeNames = { intrinsic: '內在導向', extrinsic: '外在導向', balanced: '均衡型' };
    badge.textContent = typeNames[data.motivationType];
    
    const motivationDetail = document.getElementById('motivationDetail');
    motivationDetail.textContent = `內在動機：${data.intrinsicMotivation.toFixed(1)} | 外在動機：${data.extrinsicMotivation.toFixed(1)}`;
    
    // 自我效能
    const efficacyPercent = (data.selfEfficacy / 5) * 100;
    const efficacyMeter = document.getElementById('efficacyMeter');
    efficacyMeter.style.width = efficacyPercent + '%';
    efficacyMeter.className = 'meter-fill ' + getLevel(efficacyPercent);
    document.getElementById('efficacyLabel').textContent = getLevelText(efficacyPercent);
    document.getElementById('efficacyScore').textContent = `平均分數：${data.selfEfficacy.toFixed(1)} / 5`;
    
    // 團隊角色
    const roleNames = {
        leader: '領導者',
        ideator: '創意發想者',
        implementer: '執行者',
        analyzer: '分析者',
        facilitator: '協調者',
        researcher: '資料蒐集者',
        presenter: '簡報者',
        none: '彈性配合'
    };
    const teamRolesContainer = document.getElementById('teamRoles');
    teamRolesContainer.innerHTML = '';
    const roles = data.teamRoles.split(',').filter(r => r);
    if (roles.length === 0) roles.push('none');
    roles.forEach(role => {
        const tag = document.createElement('span');
        tag.className = 'role-tag';
        tag.textContent = roleNames[role] || role;
        teamRolesContainer.appendChild(tag);
    });
    
    // 語言能力
    const languageBars = document.getElementById('languageBars');
    languageBars.innerHTML = `
        <div class="lang-bar-item">
            <span class="lang-bar-label">英語閱讀</span>
            <div class="lang-bar"><div class="lang-bar-fill" style="width: ${data.engReading * 20}%"></div></div>
            <span class="lang-bar-score">${data.engReading}/5</span>
        </div>
        <div class="lang-bar-item">
            <span class="lang-bar-label">英語聽力</span>
            <div class="lang-bar"><div class="lang-bar-fill" style="width: ${data.engListening * 20}%"></div></div>
            <span class="lang-bar-score">${data.engListening}/5</span>
        </div>
        <div class="lang-bar-item">
            <span class="lang-bar-label">英語口說</span>
            <div class="lang-bar"><div class="lang-bar-fill" style="width: ${data.engSpeaking * 20}%"></div></div>
            <span class="lang-bar-score">${data.engSpeaking}/5</span>
        </div>
        <div class="lang-bar-item">
            <span class="lang-bar-label">英語寫作</span>
            <div class="lang-bar"><div class="lang-bar-fill" style="width: ${data.engWriting * 20}%"></div></div>
            <span class="lang-bar-score">${data.engWriting}/5</span>
        </div>
    `;
    
    // 滾動到結果區
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

function getLevel(percent) {
    if (percent >= 70) return 'high';
    if (percent >= 40) return 'medium';
    return 'low';
}

function getLevelText(percent) {
    if (percent >= 80) return '非常高';
    if (percent >= 60) return '高';
    if (percent >= 40) return '中等';
    if (percent >= 20) return '基礎';
    return '入門';
}

// ==========================================
// API 函式
// ==========================================
async function apiRequest(action, params = {}) {
    const url = new URL(GOOGLE_SCRIPT_URL);
    url.searchParams.append('action', action);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
    }
    const response = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
    return await response.json();
}

async function submitToGoogleSheets(studentData) {
    return new Promise((resolve, reject) => {
        const iframeName = 'submit_iframe_' + Date.now();
        const iframe = document.createElement('iframe');
        iframe.name = iframeName;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = GOOGLE_SCRIPT_URL;
        form.target = iframeName;
        form.style.display = 'none';
        
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'postData';
        input.value = JSON.stringify({ action: 'submit', studentData });
        form.appendChild(input);
        
        document.body.appendChild(form);
        
        const timeout = setTimeout(() => {
            cleanup();
            resolve({ success: true });
        }, 3000);
        
        iframe.onload = () => {
            clearTimeout(timeout);
            cleanup();
            resolve({ success: true });
        };
        
        function cleanup() {
            if (form.parentNode) document.body.removeChild(form);
            if (iframe.parentNode) document.body.removeChild(iframe);
        }
        
        form.submit();
    });
}

// ==========================================
// 表單驗證
// ==========================================
function validateForm() {
    clearAllErrors();
    
    const requiredFields = [
        { name: 'studentId', label: '學號' },
        { name: 'studentName', label: '姓名' },
        { name: 'classSection', label: '上課班級', type: 'radio' },
        { name: 'gender', label: '性別', type: 'radio' },
        { name: 'nationality', label: '國籍', type: 'radio' },
        { name: 'nativeLanguage', label: '母語', type: 'radio' },
        { name: 'engReading', label: '英語閱讀能力', type: 'radio' },
        { name: 'engListening', label: '英語聽力能力', type: 'radio' },
        { name: 'engSpeaking', label: '英語口說能力', type: 'radio' },
        { name: 'engWriting', label: '英語寫作能力', type: 'radio' },
        { name: 'itOffice', label: 'Microsoft Office 熟悉度', type: 'radio' },
        { name: 'itGoogle', label: 'Google Workspace 熟悉度', type: 'radio' },
        { name: 'itDatabase', label: '資料庫軟體熟悉度', type: 'radio' },
        { name: 'itProject', label: '專案管理工具熟悉度', type: 'radio' },
        { name: 'itCollab', label: '線上協作工具熟悉度', type: 'radio' },
        { name: 'itAI', label: 'AI 工具熟悉度', type: 'radio' },
        { name: 'mgmtBPM', label: '企業流程管理理解度', type: 'radio' },
        { name: 'mgmtSCM', label: '供應鏈管理理解度', type: 'radio' },
        { name: 'mgmtCRM', label: '顧客關係管理理解度', type: 'radio' },
        { name: 'mgmtERP', label: '企業資源規劃理解度', type: 'radio' },
        { name: 'mgmtBI', label: '商業智慧理解度', type: 'radio' },
        { name: 'mgmtDT', label: '數位轉型理解度', type: 'radio' },
        { name: 'mslq11', label: '學習動機第11題', type: 'radio' },
        { name: 'mslq12', label: '學習動機第12題', type: 'radio' },
        { name: 'mslq13', label: '學習動機第13題', type: 'radio' },
        { name: 'mslq14', label: '學習動機第14題', type: 'radio' },
        { name: 'mslq15', label: '學習動機第15題', type: 'radio' },
        { name: 'mslq16', label: '學習動機第16題', type: 'radio' },
        { name: 'se17', label: '自我效能第17題', type: 'radio' },
        { name: 'se18', label: '自我效能第18題', type: 'radio' },
        { name: 'se19', label: '自我效能第19題', type: 'radio' },
        { name: 'se20', label: '自我效能第20題', type: 'radio' },
        { name: 'se21', label: '自我效能第21題', type: 'radio' },
        { name: 'se22', label: '自我效能第22題', type: 'radio' },
        { name: 'se23', label: '自我效能第23題', type: 'radio' },
        { name: 'se24', label: '自我效能第24題', type: 'radio' },
        { name: 'se25', label: '自我效能第25題', type: 'radio' },
        { name: 'se26', label: '自我效能第26題', type: 'radio' },
        { name: 'teamExp', label: '團隊合作經驗', type: 'radio' }
    ];
    
    const missing = [];
    
    requiredFields.forEach(field => {
        if (field.type === 'radio') {
            const checked = document.querySelector(`input[name="${field.name}"]:checked`);
            if (!checked) {
                missing.push(field);
                highlightField(field.name, 'radio');
            }
        } else {
            const element = document.querySelector(`[name="${field.name}"]`);
            if (!element || !element.value.trim()) {
                missing.push(field);
                highlightField(field.name, 'input');
            }
        }
    });
    
    if (missing.length > 0) {
        alert(`請填寫以下必填欄位（共 ${missing.length} 項未填）：\n\n• ` + missing.slice(0, 5).map(f => f.label).join('\n• ') + (missing.length > 5 ? `\n... 及其他 ${missing.length - 5} 項` : ''));
        
        const firstError = document.querySelector('.form-error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return false;
    }
    
    return true;
}

function highlightField(name, type) {
    let element;
    if (type === 'radio') {
        element = document.querySelector(`input[name="${name}"]`);
    } else {
        element = document.querySelector(`[name="${name}"]`);
    }
    
    if (element) {
        const container = element.closest('.rating-row') || element.closest('.likert-item') || 
                         element.closest('.form-group') || element.closest('.radio-group');
        if (container) {
            container.classList.add('form-error');
        }
    }
}

function clearAllErrors() {
    document.querySelectorAll('.form-error').forEach(el => el.classList.remove('form-error'));
}

// ==========================================
// UI Helpers
// ==========================================
function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
    document.getElementById('submitBtn').disabled = true;
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
    document.getElementById('submitBtn').disabled = false;
}

function showError(message) {
    alert(message);
}

function hideError() {
    document.getElementById('errorMessage').classList.add('hidden');
    document.querySelector('.questionnaire-card').classList.remove('hidden');
}

// ==========================================
// 管理後台
// ==========================================
function isAdminLoggedIn() {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true' && adminPassword !== '';
}

function setAdminLogin(status, password = '') {
    if (status && password) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        adminPassword = password;
    } else {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        adminPassword = '';
    }
}

function updateAdminUI() {
    const loginSection = document.getElementById('adminLogin');
    const contentSection = document.getElementById('adminContent');
    
    if (isAdminLoggedIn()) {
        loginSection.classList.add('hidden');
        contentSection.classList.remove('hidden');
        loadStudentData();
    } else {
        loginSection.classList.remove('hidden');
        contentSection.classList.add('hidden');
    }
}

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const password = document.getElementById('adminPassword').value;
    const errorMsg = document.getElementById('loginError');
    const submitBtn = this.querySelector('button[type="submit"]');
    
    if (!password) {
        errorMsg.textContent = '請輸入密碼';
        errorMsg.classList.remove('hidden');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>驗證中...</span>';
    
    try {
        // 離線測試模式：密碼為 elaine510510 即可登入
        if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
            if (password === 'elaine510510') {
                setAdminLogin(true, password);
                updateAdminUI();
                document.getElementById('adminPassword').value = '';
                errorMsg.classList.add('hidden');
                alert('⚠️ 離線測試模式\n\nGoogle Script 尚未設定，目前為測試模式。\n請點擊「載入測試資料」來測試功能。');
            } else {
                errorMsg.textContent = '密碼錯誤';
                errorMsg.classList.remove('hidden');
                document.getElementById('adminPassword').value = '';
            }
            return;
        }
        
        const result = await apiRequest('verify_password', { password });
        
        if (result.success && result.verified) {
            setAdminLogin(true, password);
            updateAdminUI();
            document.getElementById('adminPassword').value = '';
            errorMsg.classList.add('hidden');
        } else {
            errorMsg.textContent = '密碼錯誤';
            errorMsg.classList.remove('hidden');
            document.getElementById('adminPassword').value = '';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorMsg.textContent = '連線錯誤';
        errorMsg.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>登入</span><span class="btn-icon">→</span>';
    }
});

document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm('確定要登出嗎？')) {
        setAdminLogin(false);
        cachedStudents = [];
        updateAdminUI();
    }
});

async function loadStudentData() {
    if (!adminPassword) return;
    
    // 離線測試模式：不從 Google Sheets 讀取
    if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
        // 保持現有的 cachedStudents（測試資料）
        refreshAdminDisplay();
        return;
    }
    
    try {
        const result = await apiRequest('get_data', { password: adminPassword });
        if (result.success) {
            cachedStudents = result.data || [];
        }
    } catch (error) {
        console.error('Error loading data:', error);
        alert('載入資料失敗，請檢查網路連線');
    }
    
    refreshAdminDisplay();
}

function refreshAdminDisplay() {
    const filter = document.getElementById('tableClassFilter')?.value || 'all';
    const filteredStudents = filter === 'all' 
        ? cachedStudents 
        : cachedStudents.filter(s => s.classSection === filter);
    
    // 統計總人數（全部）
    document.getElementById('totalStudents').textContent = cachedStudents.length;
    document.getElementById('maleCount').textContent = cachedStudents.filter(s => s.gender === 'male').length;
    document.getElementById('femaleCount').textContent = cachedStudents.filter(s => s.gender === 'female').length;
    document.getElementById('intlCount').textContent = cachedStudents.filter(s => s.nationality !== 'taiwan').length;
    
    // 計算詳細統計
    if (cachedStudents.length > 0) {
        updateDetailedStats();
    }
    
    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '';
    
    if (filteredStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #7f8c8d;">目前沒有資料</td></tr>';
        if (cachedStudents.length === 0) resetDetailedStats();
        return;
    }
    
    const classNames = {
        'morning_english': '早上(英)',
        'afternoon_chinese': '下午(中)'
    };
    
    filteredStudents.forEach(s => {
        const row = document.createElement('tr');
        const motivationTypes = { intrinsic: '內在', extrinsic: '外在', balanced: '均衡' };
        row.innerHTML = `
            <td>${classNames[s.classSection] || '-'}</td>
            <td>${s.studentId || '-'}</td>
            <td>${s.studentName || '-'}</td>
            <td>${s.gender === 'male' ? '男' : s.gender === 'female' ? '女' : '-'}</td>
            <td>${s.nationality || '-'}</td>
            <td>${s.priorKnowledge || '-'}</td>
            <td>${s.itAvg || '-'}</td>
            <td>${motivationTypes[s.motivationType] || '-'}</td>
            <td>${s.selfEfficacy || '-'}</td>
            <td><button class="btn btn-danger" onclick="deleteStudent('${s.studentId}')">🗑️ 刪除</button></td>
        `;
        tbody.appendChild(row);
    });
}

// 監聽表格篩選變更
document.getElementById('tableClassFilter')?.addEventListener('change', refreshAdminDisplay);

// 刪除學生功能
async function deleteStudent(studentId) {
    if (!confirm(`確定要刪除學號 ${studentId} 的資料嗎？\n此操作無法復原！`)) {
        return;
    }
    
    try {
        if (GOOGLE_SCRIPT_URL !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
            // 呼叫 API 刪除
            const result = await apiRequest('delete_student', { 
                password: adminPassword, 
                studentId: studentId 
            });
            
            if (!result.success) {
                alert('刪除失敗：' + (result.error || '未知錯誤'));
                return;
            }
        }
        
        // 從本地快取中移除
        cachedStudents = cachedStudents.filter(s => s.studentId !== studentId);
        refreshAdminDisplay();
        alert('已成功刪除！');
        
    } catch (error) {
        console.error('Delete error:', error);
        alert('刪除失敗，請稍後再試');
    }
}

function updateDetailedStats() {
    const n = cachedStudents.length;
    if (n === 0) return;
    
    // 語言能力統計
    const engScores = cachedStudents.map(s => parseFloat(s.engAvg) || 0).filter(v => v > 0);
    const chnScores = cachedStudents.map(s => parseFloat(s.chnAvg) || 0).filter(v => v > 0);
    document.getElementById('avgEngScore').textContent = engScores.length > 0 
        ? (engScores.reduce((a, b) => a + b, 0) / engScores.length).toFixed(2) : '-';
    document.getElementById('avgChnScore').textContent = chnScores.length > 0 
        ? (chnScores.reduce((a, b) => a + b, 0) / chnScores.length).toFixed(2) : '-';
    
    // 先備知識統計 - 計算各課程修習人數
    const courseNames = {
        'management': '管理學 Management',
        'intro_cs': '計算機概論 Intro to CS',
        'database': '資料庫管理 Database',
        'crm': '顧客關係管理 CRM',
        'ecommerce': '電子商務 E-commerce'
    };
    const courseCounts = {};
    Object.keys(courseNames).forEach(key => courseCounts[key] = 0);
    
    cachedStudents.forEach(s => {
        if (s.courses) {
            const courses = s.courses.split(',');
            courses.forEach(c => {
                if (courseCounts.hasOwnProperty(c)) {
                    courseCounts[c]++;
                }
            });
        }
    });
    
    // 排序取前三名
    const sortedCourses = Object.entries(courseCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
    
    document.getElementById('topCourse1').textContent = sortedCourses[0] 
        ? `${courseNames[sortedCourses[0][0]]} (${sortedCourses[0][1]}人)` : '-';
    document.getElementById('topCourse2').textContent = sortedCourses[1] 
        ? `${courseNames[sortedCourses[1][0]]} (${sortedCourses[1][1]}人)` : '-';
    document.getElementById('topCourse3').textContent = sortedCourses[2] 
        ? `${courseNames[sortedCourses[2][0]]} (${sortedCourses[2][1]}人)` : '-';
    
    // 最差學習經驗彙整
    const worstExpList = document.getElementById('worstExpList');
    const worstExps = cachedStudents.filter(s => s.worstExperience && s.worstExperience.trim() !== '');
    
    if (worstExps.length === 0) {
        worstExpList.innerHTML = '<p class="no-data">尚無資料 No data yet</p>';
    } else {
        worstExpList.innerHTML = worstExps.map(s => `
            <div class="worst-exp-item">
                <div class="student-info">${s.studentName} (${s.studentId})</div>
                <div class="exp-content">${s.worstExperience}</div>
            </div>
        `).join('');
    }
    
    // 特別需求彙整
    const specialNeedsList = document.getElementById('specialNeedsList');
    const specialNeeds = cachedStudents.filter(s => s.specialNeeds && s.specialNeeds.trim() !== '');
    
    if (specialNeeds.length === 0) {
        specialNeedsList.innerHTML = '<p class="no-data">尚無資料 No data yet</p>';
    } else {
        specialNeedsList.innerHTML = specialNeeds.map(s => `
            <div class="worst-exp-item">
                <div class="student-info">${s.studentName} (${s.studentId})</div>
                <div class="exp-content">${s.specialNeeds}</div>
            </div>
        `).join('');
    }
}

function resetDetailedStats() {
    const ids = ['avgEngScore', 'avgChnScore', 'topCourse1', 'topCourse2', 'topCourse3'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '-';
    });
    document.getElementById('worstExpList').innerHTML = '<p class="no-data">尚無資料 No data yet</p>';
    document.getElementById('specialNeedsList').innerHTML = '<p class="no-data">尚無資料 No data yet</p>';
}

// ==========================================
// 分組功能
// ==========================================
document.getElementById('generateGroups').addEventListener('click', generateGroups);
document.getElementById('downloadExcel').addEventListener('click', downloadExcel);
document.getElementById('downloadReport').addEventListener('click', downloadReport);
document.getElementById('downloadCSV').addEventListener('click', downloadCSV);
document.getElementById('refreshData').addEventListener('click', loadStudentData);
document.getElementById('loadTestData').addEventListener('click', loadTestData);

// 載入測試資料
function loadTestData() {
    const firstNames = ['王', '李', '張', '劉', '陳', '楊', '黃', '趙', '吳', '周', '林', '鄭', '許', '謝', '郭'];
    const lastNames = ['小明', '小華', '志偉', '美玲', '俊傑', '雅婷', '建宏', '佳蓉', '冠廷', '怡君', '宗翰', '詩涵', '彥廷', '雨潔', '柏翰'];
    const engFirstNames = ['John', 'Mary', 'David', 'Sarah', 'Michael', 'Emma', 'James', 'Olivia', 'William', 'Sophia', 'Daniel', 'Isabella', 'Lucas', 'Mia', 'Henry'];
    const engLastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Chen', 'Kim', 'Nguyen', 'Patel', 'Wang'];
    
    const courseOptions = ['management', 'intro_cs', 'database', 'crm', 'ecommerce'];
    const roleOptions = ['leader', 'ideator', 'implementer', 'analyzer', 'facilitator', 'researcher', 'presenter'];
    const nationalities = ['taiwan', 'taiwan', 'taiwan', 'taiwan', 'china', 'hongkong', 'macau', 'other'];
    
    const worstExperiences = [
        '老師上課太快，跟不上進度',
        '分組報告時組員不配合',
        '考試範圍太大，準備不及',
        '作業太多，時間不夠用',
        '缺乏互動，只有單向講課',
        '課程內容與實務脫節',
        '評分標準不清楚',
        '小組成員程度差異太大',
        '報告截止日期太緊迫',
        'Language barrier in discussions',
        'Too much theory, not enough practice',
        'Group members not responding on time'
    ];
    
    const specialNeedsOptions = [
        '',
        '',
        '',
        '希望能有更多實作練習',
        '有打工，希望作業彈性繳交',
        '視力不好，希望座位前排',
        'Need English materials',
        'Need Chinese language support',
        '希望多一些案例討論',
        ''
    ];
    
    const testStudents = [];
    
    // 產生 60 位學生（早上班 30 人，下午班 30 人）
    for (let i = 0; i < 60; i++) {
        const isEnglishClass = i < 30;
        const classSection = isEnglishClass ? 'morning_english' : 'afternoon_chinese';
        const isForeign = Math.random() < (isEnglishClass ? 0.3 : 0.1);
        
        let studentName, nationality, nativeLanguage, engAvg, chnAvg;
        
        if (isForeign) {
            studentName = engFirstNames[Math.floor(Math.random() * engFirstNames.length)] + ' ' + 
                         engLastNames[Math.floor(Math.random() * engLastNames.length)];
            nationality = 'other';
            nativeLanguage = Math.random() < 0.7 ? 'english' : 'other';
            engAvg = (4 + Math.random()).toFixed(2);
            chnAvg = (1 + Math.random() * 2).toFixed(2);
        } else {
            studentName = firstNames[Math.floor(Math.random() * firstNames.length)] + 
                         lastNames[Math.floor(Math.random() * lastNames.length)];
            nationality = nationalities[Math.floor(Math.random() * 4)]; // 主要是台灣
            nativeLanguage = 'chinese';
            engAvg = isEnglishClass ? (3.5 + Math.random() * 1.5).toFixed(2) : (2 + Math.random() * 2).toFixed(2);
            chnAvg = (4.5 + Math.random() * 0.5).toFixed(2);
        }
        
        // 隨機選擇修過的課程
        const numCourses = Math.floor(Math.random() * 4);
        const shuffledCourses = [...courseOptions].sort(() => Math.random() - 0.5);
        const courses = numCourses === 0 ? ['none'] : shuffledCourses.slice(0, numCourses);
        
        // 隨機選擇角色
        const numRoles = 1 + Math.floor(Math.random() * 2);
        const shuffledRoles = [...roleOptions].sort(() => Math.random() - 0.5);
        const teamRoles = shuffledRoles.slice(0, numRoles);
        
        const gender = Math.random() < 0.5 ? 'male' : 'female';
        const itAvg = (2 + Math.random() * 3).toFixed(2);
        const mgmtAvg = (2 + Math.random() * 3).toFixed(2);
        const priorKnowledge = ((courses.length * 2 + parseFloat(itAvg) * 2 + parseFloat(mgmtAvg) * 2) / 3).toFixed(2);
        
        const intrinsicMotivation = (2.5 + Math.random() * 2.5).toFixed(2);
        const extrinsicMotivation = (2.5 + Math.random() * 2.5).toFixed(2);
        let motivationType = 'balanced';
        if (parseFloat(intrinsicMotivation) - parseFloat(extrinsicMotivation) > 0.5) {
            motivationType = 'intrinsic';
        } else if (parseFloat(extrinsicMotivation) - parseFloat(intrinsicMotivation) > 0.5) {
            motivationType = 'extrinsic';
        }
        
        testStudents.push({
            studentId: `41101${String(2001 + i).slice(-4)}`,
            studentName: studentName,
            classSection: classSection,
            gender: gender,
            nationality: nationality,
            nativeLanguage: nativeLanguage,
            engAvg: parseFloat(engAvg),
            chnAvg: parseFloat(chnAvg),
            courses: courses.join(','),
            courseCount: courses.includes('none') ? 0 : courses.length,
            itAvg: parseFloat(itAvg),
            mgmtAvg: parseFloat(mgmtAvg),
            priorKnowledge: parseFloat(priorKnowledge),
            intrinsicMotivation: parseFloat(intrinsicMotivation),
            extrinsicMotivation: parseFloat(extrinsicMotivation),
            motivationType: motivationType,
            selfEfficacy: parseFloat((2.5 + Math.random() * 2.5).toFixed(2)),
            teamExp: Math.floor(2 + Math.random() * 4),
            teamRoles: teamRoles.join(','),
            worstExperience: worstExperiences[Math.floor(Math.random() * worstExperiences.length)],
            specialNeeds: specialNeedsOptions[Math.floor(Math.random() * specialNeedsOptions.length)]
        });
    }
    
    cachedStudents = testStudents;
    refreshAdminDisplay();
    
    const morningCount = testStudents.filter(s => s.classSection === 'morning_english').length;
    const afternoonCount = testStudents.filter(s => s.classSection === 'afternoon_chinese').length;
    
    alert(`已載入 ${testStudents.length} 筆測試資料！\n\n• 早上班（全英語）：${morningCount} 人\n• 下午班（中文）：${afternoonCount} 人\n\n請選擇班級後點擊「執行智慧分組」`);
}

function generateGroups() {
    const classFilter = document.getElementById('classFilter').value;
    const classStudents = cachedStudents.filter(s => s.classSection === classFilter);
    
    if (classStudents.length === 0) {
        const className = classFilter === 'morning_english' ? '早上班（全英語）' : '下午班（中文）';
        alert(`${className} 目前沒有學生資料！`);
        return;
    }
    
    const strategy = document.getElementById('groupStrategy').value;
    
    const groups = createGroups(classStudents, 10, strategy);  // 固定 10 組
    displayGroups(groups, classFilter);
    
    document.getElementById('groupingResults').classList.remove('hidden');
    
    // 儲存時記錄班級資訊
    const groupData = {
        classSection: classFilter,
        groups: groups
    };
    localStorage.setItem('groupingResults', JSON.stringify(groups));
    localStorage.setItem('groupingClass', classFilter);
}

function createGroups(students, numGroups, strategy) {
    if (students.length === 0) return [];
    
    // 計算綜合分數用於分組
    const scored = students.map(s => ({
        ...s,
        compositeScore: (parseFloat(s.priorKnowledge) || 0) * 0.3 + 
                       (parseFloat(s.selfEfficacy) || 3) * 0.2 +
                       (parseFloat(s.itAvg) || 3) * 0.2 +
                       (parseInt(s.teamExp) || 3) * 0.15 +
                       (parseFloat(s.engAvg) || 3) * 0.15
    }));
    
    // 排序
    scored.sort((a, b) => b.compositeScore - a.compositeScore);
    
    // 固定 10 組
    const groups = Array.from({ length: numGroups }, () => []);
    
    if (strategy === 'heterogeneous') {
        // 異質分組：蛇形分配
        let direction = 1;
        let groupIndex = 0;
        
        scored.forEach(student => {
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
    } else {
        // 均衡分組：考慮性別和國籍
        const males = scored.filter(s => s.gender === 'male');
        const females = scored.filter(s => s.gender === 'female');
        const others = scored.filter(s => s.gender !== 'male' && s.gender !== 'female');
        
        [males, females, others].forEach(group => {
            group.forEach((student, index) => {
                groups[index % numGroups].push(student);
            });
        });
    }
    
    // 移除空組
    return groups.filter(g => g.length > 0);
}

function displayGroups(groups, classSection) {
    const container = document.getElementById('groupsContainer');
    container.innerHTML = '';
    
    const className = classSection === 'morning_english' ? '早上班（全英語）' : '下午班（中文）';
    const header = document.createElement('h4');
    header.className = 'groups-class-header';
    header.textContent = `📋 ${className} - 共 ${groups.length} 組`;
    container.appendChild(header);
    
    groups.forEach((group, index) => {
        const card = document.createElement('div');
        card.className = 'group-card';
        
        const membersHtml = group.map(s => `
            <li>
                <span>${s.studentName} (${s.studentId})</span>
                <span class="member-role">綜合 ${s.compositeScore.toFixed(1)}</span>
            </li>
        `).join('');
        
        card.innerHTML = `
            <div class="group-header">
                <span class="group-name">第 ${index + 1} 組</span>
                <span class="group-size">${group.length}人</span>
            </div>
            <ul class="group-members">${membersHtml}</ul>
        `;
        
        container.appendChild(card);
    });
}

function downloadReport() {
    const groups = JSON.parse(localStorage.getItem('groupingResults') || '[]');
    if (groups.length === 0) {
        alert('請先執行分組！');
        return;
    }
    
    const now = new Date();
    let report = `團隊學習分組報告\n產生時間：${now.toLocaleString('zh-TW')}\n總人數：${cachedStudents.length}\n\n`;
    
    groups.forEach((group, i) => {
        report += `【第 ${i + 1} 組】(${group.length}人)\n`;
        group.forEach(s => {
            report += `  ${s.studentId}\t${s.studentName}\t綜合分數: ${s.compositeScore.toFixed(1)}\n`;
        });
        report += '\n';
    });
    
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `分組報告_${now.toISOString().split('T')[0]}.txt`;
    a.click();
}

async function downloadExcel() {
    const groups = JSON.parse(localStorage.getItem('groupingResults') || '[]');
    if (groups.length === 0) {
        alert('請先執行分組！');
        return;
    }
    
    // 載入 SheetJS
    try {
        await loadSheetJS();
    } catch (error) {
        alert('載入 Excel 庫失敗，請檢查網路連線');
        return;
    }
    
    const now = new Date();
    const motivationTypeNames = { intrinsic: '內在導向', extrinsic: '外在導向', balanced: '均衡型' };
    const courseNames = {
        'management': '管理學',
        'intro_cs': '計算機概論',
        'database': '資料庫管理',
        'crm': '顧客關係管理',
        'ecommerce': '電子商務',
        'none': '無'
    };
    
    // 準備資料
    const data = [];
    
    // 標題列
    data.push(['學號', '姓名', '組別', '綜合分數', '語言能力', '先備知識', '學習動機', '自我效能', '最差的學習經驗', '對本課程的特別需求']);
    
    // 資料列
    groups.forEach((group, groupIndex) => {
        group.forEach(s => {
            // 語言能力
            const langStr = `英文 ${s.engAvg || '-'} / 中文 ${s.chnAvg || '-'}`;
            
            // 先備知識
            let priorStr = '-';
            if (s.courses) {
                const courseList = s.courses.split(',').filter(c => c && c !== 'none');
                if (courseList.length > 0) {
                    priorStr = courseList.map(c => courseNames[c] || c).join('、');
                } else {
                    priorStr = '無';
                }
            }
            
            // 學習動機
            const motivationType = motivationTypeNames[s.motivationType] || s.motivationType || '-';
            
            // 自我效能
            const efficacyStr = s.selfEfficacy ? parseFloat(s.selfEfficacy).toFixed(1) : '-';
            
            data.push([
                s.studentId || '',
                s.studentName || '',
                groupIndex + 1,
                s.compositeScore ? parseFloat(s.compositeScore.toFixed(2)) : 0,
                langStr,
                priorStr,
                motivationType,
                efficacyStr,
                s.worstExperience || '',
                s.specialNeeds || ''
            ]);
        });
    });
    
    // 建立工作表
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // 設定欄寬
    ws['!cols'] = [
        { wch: 12 },  // 學號
        { wch: 10 },  // 姓名
        { wch: 6 },   // 組別
        { wch: 10 },  // 綜合分數
        { wch: 20 },  // 語言能力
        { wch: 25 },  // 先備知識
        { wch: 10 },  // 學習動機
        { wch: 10 },  // 自我效能
        { wch: 40 },  // 最差的學習經驗
        { wch: 40 }   // 對本課程的特別需求
    ];
    
    // 建立工作簿
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '分組結果');
    
    // 下載
    XLSX.writeFile(wb, `分組報告_${now.toISOString().split('T')[0]}.xlsx`);
}

function escapeXml(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function downloadCSV() {
    if (cachedStudents.length === 0) {
        alert('沒有資料！');
        return;
    }
    
    let csv = '\uFEFF學號,姓名,性別,國籍,英語平均,先備知識,IT能力,管理知識,內在動機,外在動機,動機類型,自我效能,團隊經驗\n';
    
    cachedStudents.forEach(s => {
        csv += `${s.studentId},${s.studentName},${s.gender},${s.nationality},${s.engAvg},${s.priorKnowledge},${s.itAvg},${s.mgmtAvg},${s.intrinsicMotivation},${s.extrinsicMotivation},${s.motivationType},${s.selfEfficacy},${s.teamExp}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `問卷資料_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}
