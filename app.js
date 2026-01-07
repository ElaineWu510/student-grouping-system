// ==========================================
// Team-Based Learning Grouping Survey v3
// 團隊學習分組問卷系統
// ==========================================

// ============ 設定 ============
const GOOGLE_SCRIPT_URL = 'https://script.google.com/a/macros/gms.ndhu.edu.tw/s/AKfycbwU1wJ6wd6CAlijMCXPBuBhiKe8ePb8p2VImVHTPuxNXTj3VjZDkI-QhGeGzjqiNbOqGg/exec';
const ADMIN_SESSION_KEY = 'adminLoggedIn';

let cachedStudents = [];
let adminPassword = '';

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
    
    try {
        const result = await apiRequest('get_data', { password: adminPassword });
        if (result.success) {
            cachedStudents = result.data || [];
        }
    } catch (error) {
        console.error('Error loading data:', error);
        cachedStudents = [];
    }
    
    refreshAdminDisplay();
}

function refreshAdminDisplay() {
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
    
    if (cachedStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #7f8c8d;">目前沒有資料</td></tr>';
        resetDetailedStats();
        return;
    }
    
    cachedStudents.forEach(s => {
        const row = document.createElement('tr');
        const motivationTypes = { intrinsic: '內在', extrinsic: '外在', balanced: '均衡' };
        row.innerHTML = `
            <td>${s.studentId || '-'}</td>
            <td>${s.studentName || '-'}</td>
            <td>${s.gender === 'male' ? '男' : s.gender === 'female' ? '女' : '-'}</td>
            <td>${s.nationality || '-'}</td>
            <td>${s.priorKnowledge || '-'}</td>
            <td>${s.itAvg || '-'}</td>
            <td>${motivationTypes[s.motivationType] || '-'}</td>
            <td>${s.selfEfficacy || '-'}</td>
            <td>${s.teamExp || '-'}</td>
        `;
        tbody.appendChild(row);
    });
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
    const testStudents = [
        { studentId: '411012001', studentName: '王小明', gender: 'male', nationality: 'taiwan', nativeLanguage: 'chinese', engAvg: 3.5, chnAvg: 5, courses: 'management,intro_cs,database', courseCount: 3, itAvg: 4.2, mgmtAvg: 3.8, priorKnowledge: 5.5, intrinsicMotivation: 4.2, extrinsicMotivation: 3.5, motivationType: 'intrinsic', selfEfficacy: 4.1, teamExp: 4, teamRoles: 'leader,analyzer', worstExperience: '老師上課太快，跟不上進度', specialNeeds: '' },
        { studentId: '411012002', studentName: '李小華', gender: 'female', nationality: 'taiwan', nativeLanguage: 'chinese', engAvg: 4.2, chnAvg: 5, courses: 'management,ecommerce', courseCount: 2, itAvg: 3.5, mgmtAvg: 4.0, priorKnowledge: 4.8, intrinsicMotivation: 3.8, extrinsicMotivation: 4.5, motivationType: 'extrinsic', selfEfficacy: 3.8, teamExp: 3, teamRoles: 'presenter,facilitator', worstExperience: '分組報告時組員不配合', specialNeeds: '希望能有更多實作練習' },
        { studentId: '411012003', studentName: 'John Smith', gender: 'male', nationality: 'other', nativeLanguage: 'english', engAvg: 5, chnAvg: 2.5, courses: 'intro_cs', courseCount: 1, itAvg: 4.8, mgmtAvg: 2.5, priorKnowledge: 3.2, intrinsicMotivation: 4.5, extrinsicMotivation: 3.2, motivationType: 'intrinsic', selfEfficacy: 4.5, teamExp: 5, teamRoles: 'ideator,implementer', worstExperience: 'Language barrier in group discussions', specialNeeds: 'Need English materials' },
        { studentId: '411012004', studentName: '張美玲', gender: 'female', nationality: 'taiwan', nativeLanguage: 'chinese', engAvg: 3.8, chnAvg: 5, courses: 'management,database,crm', courseCount: 3, itAvg: 3.2, mgmtAvg: 4.5, priorKnowledge: 5.8, intrinsicMotivation: 4.0, extrinsicMotivation: 4.0, motivationType: 'balanced', selfEfficacy: 3.5, teamExp: 4, teamRoles: 'researcher,analyzer', worstExperience: '考試範圍太大，準備不及', specialNeeds: '' },
        { studentId: '411012005', studentName: '陳大偉', gender: 'male', nationality: 'taiwan', nativeLanguage: 'chinese', engAvg: 2.8, chnAvg: 5, courses: 'intro_cs,ecommerce', courseCount: 2, itAvg: 4.5, mgmtAvg: 3.0, priorKnowledge: 4.2, intrinsicMotivation: 3.5, extrinsicMotivation: 4.8, motivationType: 'extrinsic', selfEfficacy: 3.2, teamExp: 2, teamRoles: 'implementer', worstExperience: '作業太多，時間不夠用', specialNeeds: '有打工，希望作業彈性繳交' },
        { studentId: '411012006', studentName: 'Maria Garcia', gender: 'female', nationality: 'other', nativeLanguage: 'other', engAvg: 4.5, chnAvg: 1.8, courses: 'management', courseCount: 1, itAvg: 3.8, mgmtAvg: 4.2, priorKnowledge: 3.5, intrinsicMotivation: 4.8, extrinsicMotivation: 3.0, motivationType: 'intrinsic', selfEfficacy: 4.2, teamExp: 4, teamRoles: 'leader,presenter', worstExperience: 'Too much theory, not enough practice', specialNeeds: 'Need Chinese language support' },
        { studentId: '411012007', studentName: '林志豪', gender: 'male', nationality: 'taiwan', nativeLanguage: 'chinese', engAvg: 3.2, chnAvg: 5, courses: 'database,crm,ecommerce', courseCount: 3, itAvg: 4.0, mgmtAvg: 3.5, priorKnowledge: 5.2, intrinsicMotivation: 3.2, extrinsicMotivation: 4.2, motivationType: 'extrinsic', selfEfficacy: 3.8, teamExp: 3, teamRoles: 'researcher', worstExperience: '老師不給問問題的機會', specialNeeds: '' },
        { studentId: '411012008', studentName: '黃雅琪', gender: 'female', nationality: 'taiwan', nativeLanguage: 'chinese', engAvg: 4.0, chnAvg: 5, courses: 'management,intro_cs', courseCount: 2, itAvg: 3.0, mgmtAvg: 4.8, priorKnowledge: 4.5, intrinsicMotivation: 4.5, extrinsicMotivation: 3.8, motivationType: 'intrinsic', selfEfficacy: 4.0, teamExp: 5, teamRoles: 'facilitator,presenter', worstExperience: '缺乏互動，只有單向講課', specialNeeds: '' },
        { studentId: '411012009', studentName: '吳建宏', gender: 'male', nationality: 'hongkong', nativeLanguage: 'chinese', engAvg: 4.2, chnAvg: 4.8, courses: 'intro_cs,database', courseCount: 2, itAvg: 4.5, mgmtAvg: 3.2, priorKnowledge: 4.8, intrinsicMotivation: 4.0, extrinsicMotivation: 4.0, motivationType: 'balanced', selfEfficacy: 4.3, teamExp: 4, teamRoles: 'analyzer,implementer', worstExperience: '課程內容與實務脫節', specialNeeds: '' },
        { studentId: '411012010', studentName: '周佳蓉', gender: 'female', nationality: 'taiwan', nativeLanguage: 'chinese', engAvg: 3.5, chnAvg: 5, courses: 'management,crm', courseCount: 2, itAvg: 2.8, mgmtAvg: 4.0, priorKnowledge: 4.0, intrinsicMotivation: 3.8, extrinsicMotivation: 4.5, motivationType: 'extrinsic', selfEfficacy: 3.0, teamExp: 3, teamRoles: 'researcher,facilitator', worstExperience: '評分標準不清楚', specialNeeds: '視力不好，希望座位前排' }
    ];
    
    cachedStudents = testStudents;
    refreshAdminDisplay();
    alert('已載入 10 筆測試資料！\n\n請點擊「執行智慧分組」進行分組，\n然後即可下載 Excel 報告。');
}

function generateGroups() {
    if (cachedStudents.length === 0) {
        alert('目前沒有學生資料！');
        return;
    }
    
    const groupSize = parseInt(document.getElementById('groupSize').value);
    const strategy = document.getElementById('groupStrategy').value;
    
    const groups = createGroups(cachedStudents, groupSize, strategy);
    displayGroups(groups);
    
    document.getElementById('groupingResults').classList.remove('hidden');
    localStorage.setItem('groupingResults', JSON.stringify(groups));
}

function createGroups(students, groupSize, strategy) {
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
    
    const numGroups = Math.ceil(scored.length / groupSize);
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
    
    return groups;
}

function displayGroups(groups) {
    const container = document.getElementById('groupsContainer');
    container.innerHTML = '';
    
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

function downloadExcel() {
    const groups = JSON.parse(localStorage.getItem('groupingResults') || '[]');
    if (groups.length === 0) {
        alert('請先執行分組！');
        return;
    }
    
    // 建立 Excel XML 格式 (SpreadsheetML)
    const now = new Date();
    const motivationTypeNames = { intrinsic: '內在導向', extrinsic: '外在導向', balanced: '均衡型' };
    
    let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Size="12"/>
   <Interior ss:Color="#1e3a5f" ss:Pattern="Solid"/>
   <Font ss:Color="#FFFFFF" ss:Bold="1"/>
  </Style>
  <Style ss:ID="Wrap">
   <Alignment ss:WrapText="1" ss:Vertical="Top"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="分組結果">
  <Table>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="50"/>
   <Column ss:Width="70"/>
   <Column ss:Width="100"/>
   <Column ss:Width="120"/>
   <Column ss:Width="80"/>
   <Column ss:Width="70"/>
   <Column ss:Width="200"/>
   <Column ss:Width="200"/>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">學號</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">姓名</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">組別</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">綜合分數</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">語言能力</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">先備知識</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">學習動機</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">自我效能</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">最差的學習經驗</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">對本課程的特別需求</Data></Cell>
   </Row>`;
    
    groups.forEach((group, groupIndex) => {
        group.forEach(s => {
            // 語言能力：英文 X.X / 中文 X.X
            const langStr = `英文 ${s.engAvg || '-'} / 中文 ${s.chnAvg || '-'}`;
            
            // 先備知識：修過的課程
            const courseNames = {
                'management': '管理學',
                'intro_cs': '計算機概論',
                'database': '資料庫管理',
                'crm': '顧客關係管理',
                'ecommerce': '電子商務',
                'none': '無'
            };
            let priorStr = '-';
            if (s.courses) {
                const courseList = s.courses.split(',').filter(c => c && c !== 'none');
                if (courseList.length > 0) {
                    priorStr = courseList.map(c => courseNames[c] || c).join('、');
                } else {
                    priorStr = '無';
                }
            }
            
            // 學習動機類型
            const motivationType = motivationTypeNames[s.motivationType] || s.motivationType || '-';
            
            // 自我效能分數
            const efficacyStr = s.selfEfficacy ? parseFloat(s.selfEfficacy).toFixed(1) : '-';
            
            // 最差學習經驗
            const worstExp = s.worstExperience || '';
            
            // 特別需求
            const specialNeeds = s.specialNeeds || '';
            
            xmlContent += `
   <Row ss:Height="45">
    <Cell><Data ss:Type="String">${escapeXml(s.studentId || '')}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(s.studentName || '')}</Data></Cell>
    <Cell><Data ss:Type="Number">${groupIndex + 1}</Data></Cell>
    <Cell><Data ss:Type="Number">${s.compositeScore ? s.compositeScore.toFixed(2) : 0}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(langStr)}</Data></Cell>
    <Cell ss:StyleID="Wrap"><Data ss:Type="String">${escapeXml(priorStr)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(motivationType)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(efficacyStr)}</Data></Cell>
    <Cell ss:StyleID="Wrap"><Data ss:Type="String">${escapeXml(worstExp)}</Data></Cell>
    <Cell ss:StyleID="Wrap"><Data ss:Type="String">${escapeXml(specialNeeds)}</Data></Cell>
   </Row>`;
        });
    });
    
    xmlContent += `
  </Table>
 </Worksheet>
</Workbook>`;
    
    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `分組報告_${now.toISOString().split('T')[0]}.xls`;
    a.click();
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
