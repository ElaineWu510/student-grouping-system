// ==========================================
// Team-Based Learning Grouping Survey v3
// 團隊學習分組問卷系統
// ==========================================

// ============ 設定 ============
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwaUmgG8rBGyue62jylhAPZVzCb48k0XEUxjrgtsx8SGR3b3Ko0jdaBQoWp9yAlmOSggQ/exec';
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
    const chnReading = formData.get('chnReading');
    const chnListening = formData.get('chnListening');
    const chnSpeaking = formData.get('chnSpeaking');
    const chnWriting = formData.get('chnWriting');
    let chnAvg = 'N/A';
    if (chnReading !== 'na' && chnListening !== 'na') {
        const chnScores = [chnReading, chnListening, chnSpeaking, chnWriting].filter(v => v !== 'na').map(v => parseInt(v));
        if (chnScores.length > 0) {
            chnAvg = (chnScores.reduce((a, b) => a + b, 0) / chnScores.length).toFixed(2);
        }
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
        chnAvg: chnAvg === 'N/A' ? chnAvg : parseFloat(chnAvg),
        
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
        if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
            errorMsg.textContent = '系統尚未設定完成';
            errorMsg.classList.remove('hidden');
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
    
    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '';
    
    if (cachedStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #7f8c8d;">目前沒有資料</td></tr>';
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

// ==========================================
// 分組功能
// ==========================================
document.getElementById('generateGroups').addEventListener('click', generateGroups);
document.getElementById('downloadReport').addEventListener('click', downloadReport);
document.getElementById('downloadCSV').addEventListener('click', downloadCSV);
document.getElementById('refreshData').addEventListener('click', loadStudentData);

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
