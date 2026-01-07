/**
 * ============================================
 * Google Apps Script - TBL 分組問卷系統後端
 * ============================================
 * 
 * 部署步驟：
 * 1. 建立 Google Sheets
 * 2. 擴充功能 → Apps Script
 * 3. 貼上此程式碼
 * 4. 部署 → 新增部署 → 網頁應用程式
 * 5. 執行身分：我 / 存取權限：任何人
 * 6. 複製網址到 app.js
 */

// ========== 設定 ==========
const ADMIN_PASSWORD = 'elaine510510';
const SHEET_NAME = 'TBL問卷資料';

// ========== 初始化 ==========
function initSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = [
      'ID', '學號', '姓名', '性別', '國籍', '母語',
      '英語平均', '英語閱讀', '英語聽力', '英語口說', '英語寫作',
      '中文平均', '修課數', '修過課程',
      'IT平均', '管理平均', '先備知識',
      '內在動機', '外在動機', '動機類型',
      '自我效能', '團隊經驗', '偏好角色', '可用時段',
      '最佳經驗', '最差經驗', '團隊學習期望', '團隊貢獻', '特殊需求',
      '提交時間'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

// ========== POST 請求 ==========
function doPost(e) {
  try {
    let data;
    
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseError) {
        if (e.parameter && e.parameter.postData) {
          data = JSON.parse(e.parameter.postData);
        }
      }
    } else if (e.parameter && e.parameter.postData) {
      data = JSON.parse(e.parameter.postData);
    }
    
    if (!data) {
      return HtmlService.createHtmlOutput('<html><body>Invalid request</body></html>');
    }
    
    const action = data.action;
    
    if (action === 'submit') {
      const lock = LockService.getScriptLock();
      
      try {
        lock.waitLock(30000);
        
        const sheet = initSheet();
        const s = data.studentData;
        
        // 檢查是否已存在
        const allData = sheet.getDataRange().getValues();
        let existingRow = -1;
        
        for (let i = 1; i < allData.length; i++) {
          if (allData[i][1] === s.studentId) {
            existingRow = i + 1;
            break;
          }
        }
        
        const rowData = [
          existingRow > 0 ? allData[existingRow - 1][0] : Utilities.getUuid(),
          s.studentId,
          s.studentName,
          s.gender,
          s.nationality,
          s.nativeLanguage,
          s.engAvg,
          s.engReading,
          s.engListening,
          s.engSpeaking,
          s.engWriting,
          s.chnAvg,
          s.courseCount,
          s.courses,
          s.itAvg,
          s.mgmtAvg,
          s.priorKnowledge,
          s.intrinsicMotivation,
          s.extrinsicMotivation,
          s.motivationType,
          s.selfEfficacy,
          s.teamExp,
          s.teamRoles,
          s.teamTimes,
          s.bestExperience,
          s.worstExperience,
          s.teamLearning,
          s.teamContribution,
          s.specialNeeds,
          s.submittedAt || new Date().toISOString()
        ];
        
        if (existingRow > 0) {
          sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
        } else {
          sheet.appendRow(rowData);
        }
        
      } finally {
        lock.releaseLock();
      }
    }
    
    return HtmlService.createHtmlOutput('<html><body><script>window.close();</script>提交成功</body></html>');
    
  } catch (error) {
    return HtmlService.createHtmlOutput('<html><body>Error: ' + error.toString() + '</body></html>');
  }
}

// ========== GET 請求 ==========
function doGet(e) {
  const action = e.parameter.action;
  const password = e.parameter.password;
  
  let result;
  
  if (action === 'verify_password') {
    result = { success: true, verified: password === ADMIN_PASSWORD };
  }
  else if (action === 'get_data') {
    if (password !== ADMIN_PASSWORD) {
      result = { success: false, error: '密碼錯誤' };
    } else {
      const sheet = initSheet();
      const allData = sheet.getDataRange().getValues();
      
      if (allData.length <= 1) {
        result = { success: true, data: [] };
      } else {
        const students = [];
        for (let i = 1; i < allData.length; i++) {
          const row = allData[i];
          students.push({
            id: row[0],
            studentId: row[1],
            studentName: row[2],
            gender: row[3],
            nationality: row[4],
            nativeLanguage: row[5],
            engAvg: row[6],
            engReading: row[7],
            engListening: row[8],
            engSpeaking: row[9],
            engWriting: row[10],
            chnAvg: row[11],
            courseCount: row[12],
            courses: row[13],
            itAvg: row[14],
            mgmtAvg: row[15],
            priorKnowledge: row[16],
            intrinsicMotivation: row[17],
            extrinsicMotivation: row[18],
            motivationType: row[19],
            selfEfficacy: row[20],
            teamExp: row[21],
            teamRoles: row[22],
            teamTimes: row[23],
            bestExperience: row[24],
            worstExperience: row[25],
            teamLearning: row[26],
            teamContribution: row[27],
            specialNeeds: row[28],
            submittedAt: row[29]
          });
        }
        result = { success: true, data: students };
      }
    }
  }
  else {
    result = { message: 'TBL Grouping Survey API v3' };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========== 測試 ==========
function testInit() {
  initSheet();
  Logger.log('初始化完成');
}
