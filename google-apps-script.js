/**
 * ============================================
 * Google Apps Script - TBL 分組問卷系統後端 v4
 * ============================================
 *
 * 部署步驟：
 * 1. 開啟 Google Sheets（同一個試算表即可）
 * 2. 擴充功能 → Apps Script
 * 3. 貼上此程式碼（取代原有內容）
 * 4. 部署 → 管理部署項目 → 編輯 → 新增版本 → 部署
 *    （或 部署 → 新增部署 → 類型選「網頁應用程式」）
 * 5. 執行身分：我 / 存取權限：任何人
 * 6. 複製產生的網址到 app.js 第 7 行 GOOGLE_SCRIPT_URL
 *
 * 工作表說明：
 *   - 早上班（morning.html 提交）→ 寫入「早上班」工作表
 *   - 下午班（afternoon.html 提交）→ 寫入「下午班」工作表
 *   - 兩張工作表會在第一次提交時自動建立
 */

// ========== 設定 ==========
const ADMIN_PASSWORD = 'elaine510510';

// 工作表欄位標題（國籍已改為 Email）
const HEADERS = [
  'ID', '學號', '姓名', 'Email', '性別', '母語',
  '英語平均', '英語閱讀', '英語聽力', '英語口說', '英語寫作',
  '中文平均', '修課數', '修過課程',
  'IT平均', '管理平均', '先備知識',
  '內在動機', '外在動機', '動機類型',
  '自我效能', '團隊經驗', '偏好角色', '可用時段',
  '最佳經驗', '最差經驗', '團隊學習期望', '團隊貢獻', '特殊需求',
  '班別', '提交時間'
];

// ========== 初始化工作表 ==========
function initSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    // 自動調整欄寬
    sheet.autoResizeColumns(1, HEADERS.length);
  }

  return sheet;
}

// ========== POST 請求（問卷提交）==========
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

    if (data.action === 'submit') {
      // 決定寫入哪個工作表
      const sheetName = data.sheetName || '回覆';
      const lock = LockService.getScriptLock();

      try {
        lock.waitLock(30000);

        const sheet = initSheet(sheetName);
        const s = data.studentData;

        // 檢查同學號是否已存在 → 更新而非重複新增
        const allData = sheet.getDataRange().getValues();
        let existingRow = -1;
        for (let i = 1; i < allData.length; i++) {
          if (String(allData[i][1]) === String(s.studentId)) {
            existingRow = i + 1;
            break;
          }
        }

        const rowData = [
          existingRow > 0 ? allData[existingRow - 1][0] : Utilities.getUuid(),
          s.studentId,
          s.studentName,
          s.email || '',           // Email（取代國籍）
          s.gender,
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
          s.classSection,
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

    return HtmlService.createHtmlOutput(
      '<html><body><script>window.close();</script>提交成功</body></html>'
    );

  } catch (error) {
    return HtmlService.createHtmlOutput(
      '<html><body>Error: ' + error.toString() + '</body></html>'
    );
  }
}

// ========== GET 請求（管理後台）==========
function doGet(e) {
  const action   = e.parameter.action;
  const password = e.parameter.password;
  const sheetName = e.parameter.sheetName || '';  // 可傳 '早上班' 或 '下午班'

  let result;

  if (action === 'verify_password') {
    result = { success: true, verified: password === ADMIN_PASSWORD };
  }
  else if (action === 'get_data') {
    if (password !== ADMIN_PASSWORD) {
      result = { success: false, error: '密碼錯誤' };
    } else {
      // 若有指定工作表就只讀該表，否則讀取所有工作表合併
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let students = [];

      const sheetsToRead = sheetName
        ? [sheetName]
        : ['早上班', '下午班'];

      sheetsToRead.forEach(function(name) {
        const sheet = ss.getSheetByName(name);
        if (!sheet) return;

        const allData = sheet.getDataRange().getValues();
        if (allData.length <= 1) return;

        for (let i = 1; i < allData.length; i++) {
          const row = allData[i];
          if (!row[1]) continue;  // 跳過空列
          students.push({
            id:                  row[0],
            studentId:           row[1],
            studentName:         row[2],
            email:               row[3],
            gender:              row[4],
            nativeLanguage:      row[5],
            engAvg:              row[6],
            engReading:          row[7],
            engListening:        row[8],
            engSpeaking:         row[9],
            engWriting:          row[10],
            chnAvg:              row[11],
            courseCount:         row[12],
            courses:             row[13],
            itAvg:               row[14],
            mgmtAvg:             row[15],
            priorKnowledge:      row[16],
            intrinsicMotivation: row[17],
            extrinsicMotivation: row[18],
            motivationType:      row[19],
            selfEfficacy:        row[20],
            teamExp:             row[21],
            teamRoles:           row[22],
            teamTimes:           row[23],
            bestExperience:      row[24],
            worstExperience:     row[25],
            teamLearning:        row[26],
            teamContribution:    row[27],
            specialNeeds:        row[28],
            classSection:        row[29],
            submittedAt:         row[30]
          });
        }
      });

      result = { success: true, data: students };
    }
  }
  else if (action === 'delete_student') {
    if (password !== ADMIN_PASSWORD) {
      result = { success: false, error: '密碼錯誤' };
    } else {
      const studentId = e.parameter.studentId;
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let deleted = false;

      ['早上班', '下午班'].forEach(function(name) {
        const sheet = ss.getSheetByName(name);
        if (!sheet || deleted) return;
        const allData = sheet.getDataRange().getValues();
        for (let i = allData.length - 1; i >= 1; i--) {
          if (String(allData[i][1]) === String(studentId)) {
            sheet.deleteRow(i + 1);
            deleted = true;
            break;
          }
        }
      });

      result = { success: deleted, error: deleted ? null : '找不到該學號' };
    }
  }
  else {
    result = { message: 'TBL Grouping Survey API v4' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========== 手動測試用 ==========
function testInit() {
  initSheet('早上班');
  initSheet('下午班');
  Logger.log('兩張工作表初始化完成');
}
