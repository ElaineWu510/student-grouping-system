// ==========================================
// Team Learning Grouping System
// 團隊學習分組系統
// ==========================================

// Initialize storage
const STORAGE_KEY = 'studentGroupingData';

// Load data from localStorage
function loadData() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// Save data to localStorage
function saveData(students) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

// ==========================================
// Tab Navigation
// ==========================================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update sections
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        
        // If switching to admin, refresh data
        if (tabId === 'admin') {
            refreshAdminData();
        }
    });
});

// ==========================================
// Student Form Submission
// ==========================================
document.getElementById('studentForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    
    // Calculate scores
    const motivationScore = calculateAverage([
        formData.get('motivation1'),
        formData.get('motivation2'),
        formData.get('motivation3')
    ]);
    
    const efficacyScore = calculateAverage([
        formData.get('efficacy1'),
        formData.get('efficacy2'),
        formData.get('efficacy3')
    ]);
    
    const teamScore = calculateAverage([
        formData.get('team1'),
        formData.get('team2'),
        formData.get('team3'),
        formData.get('team4')
    ]);
    
    const skillScore = calculateAverage([
        formData.get('skill1'),
        formData.get('skill2'),
        formData.get('skill3'),
        formData.get('skill4')
    ]);
    
    // Determine role tendency based on team preferences
    const roleTendency = determineRole(
        parseInt(formData.get('team1')),
        parseInt(formData.get('team2')),
        parseInt(formData.get('team3')),
        parseInt(formData.get('team4'))
    );
    
    // Determine cognitive style
    const cognitiveStyle = `${formData.get('cognitive1')}-${formData.get('cognitive2')}`;
    
    // Create student object
    const student = {
        id: Date.now(),
        studentId: formData.get('studentId'),
        studentName: formData.get('studentName'),
        classSection: formData.get('classSection'),
        email: formData.get('email') || '',
        motivationScore: motivationScore,
        efficacyScore: efficacyScore,
        teamScore: teamScore,
        skillScore: skillScore,
        cognitiveStyle: cognitiveStyle,
        roleTendency: roleTendency,
        submittedAt: new Date().toISOString()
    };
    
    // Check for duplicate student ID
    const students = loadData();
    const existingIndex = students.findIndex(s => s.studentId === student.studentId);
    
    if (existingIndex !== -1) {
        if (confirm('此學號已存在，是否要更新資料？')) {
            students[existingIndex] = student;
        } else {
            return;
        }
    } else {
        students.push(student);
    }
    
    saveData(students);
    
    // Show success message
    document.querySelector('.questionnaire-card').classList.add('hidden');
    document.getElementById('successMessage').classList.remove('hidden');
    
    // Reset form after delay
    setTimeout(() => {
        this.reset();
        document.querySelector('.questionnaire-card').classList.remove('hidden');
        document.getElementById('successMessage').classList.add('hidden');
    }, 3000);
});

// ==========================================
// Utility Functions
// ==========================================
function calculateAverage(values) {
    const nums = values.map(v => parseInt(v)).filter(v => !isNaN(v));
    return nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : 0;
}

function determineRole(leadership, coordination, execution, creativity) {
    const roles = {
        'leader': leadership,
        'coordinator': coordination,
        'executor': execution,
        'innovator': creativity
    };
    
    const maxRole = Object.entries(roles).reduce((a, b) => a[1] > b[1] ? a : b);
    
    const roleNames = {
        'leader': '領導者',
        'coordinator': '協調者',
        'executor': '執行者',
        'innovator': '創意者'
    };
    
    return roleNames[maxRole[0]];
}

// ==========================================
// Admin Functions
// ==========================================
function refreshAdminData() {
    const students = loadData();
    
    // Update stats
    document.getElementById('totalStudents').textContent = students.length;
    document.getElementById('classACount').textContent = students.filter(s => s.classSection === 'A').length;
    document.getElementById('classBCount').textContent = students.filter(s => s.classSection === 'B').length;
    
    // Update table
    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '';
    
    students.forEach(student => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.studentId}</td>
            <td>${student.studentName}</td>
            <td>${student.classSection}班</td>
            <td>${student.motivationScore}</td>
            <td>${student.efficacyScore}</td>
            <td>${student.teamScore}</td>
            <td>${formatCognitiveStyle(student.cognitiveStyle)}</td>
            <td><span class="member-role">${student.roleTendency}</span></td>
        `;
        tbody.appendChild(row);
    });
}

function formatCognitiveStyle(style) {
    const parts = style.split('-');
    const styles = {
        'holist': '整體',
        'serialist': '循序',
        'intuitive': '直覺',
        'analytical': '分析'
    };
    return `${styles[parts[0]] || parts[0]}/${styles[parts[1]] || parts[1]}`;
}

// ==========================================
// Intelligent Grouping Algorithm
// ==========================================
function generateGroups() {
    const students = loadData();
    const groupSize = parseInt(document.getElementById('groupSize').value);
    const strategy = document.getElementById('groupStrategy').value;
    
    if (students.length === 0) {
        alert('目前沒有學生資料，請先填寫問卷！');
        return;
    }
    
    // Separate by class
    const classA = students.filter(s => s.classSection === 'A');
    const classB = students.filter(s => s.classSection === 'B');
    
    // Generate groups for each class
    const groupsA = createGroups(classA, groupSize, strategy);
    const groupsB = createGroups(classB, groupSize, strategy);
    
    // Display results
    displayGroups('classAGroups', groupsA, 'A');
    displayGroups('classBGroups', groupsB, 'B');
    
    document.getElementById('groupingResults').classList.remove('hidden');
    
    // Store grouping results
    localStorage.setItem('groupingResultsA', JSON.stringify(groupsA));
    localStorage.setItem('groupingResultsB', JSON.stringify(groupsB));
}

function createGroups(students, groupSize, strategy) {
    if (students.length === 0) return [];
    
    let sortedStudents;
    
    switch (strategy) {
        case 'heterogeneous':
            // Sort by composite score for heterogeneous grouping
            sortedStudents = [...students].sort((a, b) => {
                const scoreA = parseFloat(a.motivationScore) + parseFloat(a.efficacyScore) + parseFloat(a.teamScore);
                const scoreB = parseFloat(b.motivationScore) + parseFloat(b.efficacyScore) + parseFloat(b.teamScore);
                return scoreB - scoreA;
            });
            return createHeterogeneousGroups(sortedStudents, groupSize);
            
        case 'homogeneous':
            // Sort and group similar students together
            sortedStudents = [...students].sort((a, b) => {
                const scoreA = parseFloat(a.motivationScore) + parseFloat(a.efficacyScore);
                const scoreB = parseFloat(b.motivationScore) + parseFloat(b.efficacyScore);
                return scoreB - scoreA;
            });
            return createHomogeneousGroups(sortedStudents, groupSize);
            
        case 'balanced':
            // Balance based on roles
            return createBalancedGroups(students, groupSize);
            
        default:
            return createHeterogeneousGroups(students, groupSize);
    }
}

function createHeterogeneousGroups(students, groupSize) {
    const numGroups = Math.ceil(students.length / groupSize);
    const groups = Array.from({ length: numGroups }, () => []);
    
    // Distribute students using snake draft
    let direction = 1;
    let groupIndex = 0;
    
    students.forEach((student, index) => {
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
    
    // Categorize students by role
    const roleGroups = {
        '領導者': [],
        '協調者': [],
        '執行者': [],
        '創意者': []
    };
    
    students.forEach(student => {
        if (roleGroups[student.roleTendency]) {
            roleGroups[student.roleTendency].push(student);
        } else {
            roleGroups['執行者'].push(student);
        }
    });
    
    // Distribute each role type across groups
    Object.values(roleGroups).forEach(roleStudents => {
        roleStudents.forEach((student, index) => {
            const targetGroup = index % numGroups;
            groups[targetGroup].push(student);
        });
    });
    
    return groups;
}

function displayGroups(containerId, groups, className) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (groups.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">目前沒有學生資料</p>';
        return;
    }
    
    groups.forEach((group, index) => {
        const card = document.createElement('div');
        card.className = 'group-card';
        
        const membersHtml = group.map(student => `
            <li>
                <div class="member-info">
                    <span>${student.studentName}</span>
                    <span class="member-id">(${student.studentId})</span>
                </div>
                <span class="member-role">${student.roleTendency}</span>
            </li>
        `).join('');
        
        card.innerHTML = `
            <div class="group-header">
                <span class="group-name">${className}班 第${index + 1}組</span>
                <span class="group-size">${group.length}人</span>
            </div>
            <ul class="group-members">
                ${membersHtml}
            </ul>
        `;
        
        container.appendChild(card);
    });
}

// ==========================================
// Export Functions
// ==========================================
function downloadReport() {
    const students = loadData();
    const groupsA = JSON.parse(localStorage.getItem('groupingResultsA') || '[]');
    const groupsB = JSON.parse(localStorage.getItem('groupingResultsB') || '[]');
    
    if (groupsA.length === 0 && groupsB.length === 0) {
        alert('請先執行智慧分組！');
        return;
    }
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-TW');
    const timeStr = now.toLocaleTimeString('zh-TW');
    
    let report = `
================================================================================
                        團隊學習分組報告
                   Team Learning Grouping Report
================================================================================

產生時間：${dateStr} ${timeStr}
總學生數：${students.length} 人
A班學生：${students.filter(s => s.classSection === 'A').length} 人
B班學生：${students.filter(s => s.classSection === 'B').length} 人
分組策略：${document.getElementById('groupStrategy').selectedOptions[0].text}
每組人數：${document.getElementById('groupSize').value} 人

================================================================================
                              A班分組結果
================================================================================
`;
    
    groupsA.forEach((group, index) => {
        report += `\n【第${index + 1}組】(${group.length}人)\n`;
        report += '-'.repeat(50) + '\n';
        group.forEach(student => {
            report += `  ${student.studentId}\t${student.studentName}\t${student.roleTendency}\n`;
        });
    });
    
    report += `
================================================================================
                              B班分組結果
================================================================================
`;
    
    groupsB.forEach((group, index) => {
        report += `\n【第${index + 1}組】(${group.length}人)\n`;
        report += '-'.repeat(50) + '\n';
        group.forEach(student => {
            report += `  ${student.studentId}\t${student.studentName}\t${student.roleTendency}\n`;
        });
    });
    
    report += `
================================================================================
                            學生詳細資料
================================================================================

學號\t\t姓名\t\t班級\t動機\t效能\t團隊\t認知風格\t\t角色
`;
    
    students.forEach(s => {
        report += `${s.studentId}\t${s.studentName}\t${s.classSection}\t${s.motivationScore}\t${s.efficacyScore}\t${s.teamScore}\t${formatCognitiveStyle(s.cognitiveStyle)}\t\t${s.roleTendency}\n`;
    });
    
    report += `
================================================================================
                             報告結束
================================================================================
`;
    
    // Download file
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `分組報告_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadCSV() {
    const students = loadData();
    
    if (students.length === 0) {
        alert('目前沒有學生資料！');
        return;
    }
    
    // Create CSV header
    let csv = '\uFEFF'; // BOM for Excel UTF-8
    csv += '學號,姓名,班級,電子郵件,動機分數,效能分數,團隊分數,技能分數,認知風格,角色傾向,提交時間\n';
    
    // Add data rows
    students.forEach(s => {
        csv += `${s.studentId},${s.studentName},${s.classSection},${s.email},${s.motivationScore},${s.efficacyScore},${s.teamScore},${s.skillScore},${formatCognitiveStyle(s.cognitiveStyle)},${s.roleTendency},${s.submittedAt}\n`;
    });
    
    // Download file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `學生資料_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function clearData() {
    if (confirm('確定要清除所有學生資料嗎？此操作無法復原！')) {
        if (confirm('再次確認：這將刪除所有問卷資料和分組結果！')) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem('groupingResultsA');
            localStorage.removeItem('groupingResultsB');
            refreshAdminData();
            document.getElementById('groupingResults').classList.add('hidden');
            alert('所有資料已清除！');
        }
    }
}

// ==========================================
// Event Listeners
// ==========================================
document.getElementById('generateGroups').addEventListener('click', generateGroups);
document.getElementById('downloadReport').addEventListener('click', downloadReport);
document.getElementById('downloadCSV').addEventListener('click', downloadCSV);
document.getElementById('clearData').addEventListener('click', clearData);

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    refreshAdminData();
});
