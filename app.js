// ==========================================================================
// app.js — Translation Hub Application Logic
// All functionality preserved from index.html inline script.
// ==========================================================================

// Database Configuration
const TURSO_URL = "https://birthcertificate-khan0200.aws-ap-northeast-1.turso.io/v2/pipeline";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQ5NTcyNzAsImlkIjoiMDE5Zjk3YmUtNDIwMS03YTY3LTkxODUtODIzMGMyMmYyYjU1Iiwia2lkIjoiVFZIaHctQ1VfMTczOVlqa2dZRGpKbGJfQlVpQWVLckxTelhfbDVMUTlzRSIsInJpZCI6ImQwNGFhNWUyLTRiYTAtNGMzNC1iZjQ5LTViZTgxM2U5NjIyNiJ9.srRd3vUHK48oKsluQJk6E4xY2jHT1eqyj5oUdhmLsOeNXYt7T5MEqojBdRenZshw-3wg8TXrAaleU9LHkTFCCA";

let currentMode = 'birth'; // 'birth', 'marriage', or 'divorce'
let savedRecords = []; // Global history memory


// ==========================================================================
// 1. RECEPTIVE AND DYNAMIC DESIGN & VIEW CONTROLS
// ==========================================================================

// Tab Switching (Form vs History)
function switchTab(tab) {
  document.getElementById('tab-form').classList.toggle('active', tab === 'form');
  document.getElementById('tab-history').classList.toggle('active', tab === 'history');
  
  document.getElementById('content-form').style.display = tab === 'form' ? 'flex' : 'none';
  document.getElementById('content-history').style.display = tab === 'history' ? 'flex' : 'none';
  
  if (tab === 'history') {
    loadHistoryFromTurso();
  }
}

// Document Mode Switcher (Birth vs Marriage vs Divorce vs Grading)
function switchMode(mode) {
  if (currentMode === mode) return;
  currentMode = mode;

  // Update switcher active tab states
  document.getElementById('btn-mode-birth').classList.toggle('active', mode === 'birth');
  document.getElementById('btn-mode-marriage').classList.toggle('active', mode === 'marriage');
  document.getElementById('btn-mode-divorce').classList.toggle('active', mode === 'divorce');
  document.getElementById('btn-mode-grading')?.classList.toggle('active', mode === 'grading');

  // Update form description text
  const descText = document.getElementById('form-desc-text');
  if (descText) {
    if (mode === 'birth') {
      descText.textContent = 'Translate Uzbek birth certificates to English';
    } else if (mode === 'marriage') {
      descText.textContent = 'Translate Uzbek marriage certificates to English';
    } else if (mode === 'divorce') {
      descText.textContent = 'Translate Uzbek divorce certificates to English';
    } else {
      descText.textContent = 'Translate & convert Uzbek academic grading scales to English';
    }
  }

  // Toggle form field containers
  document.getElementById('birth-fields-container').style.display = mode === 'birth' ? 'block' : 'none';
  document.getElementById('marriage-fields-container').style.display = mode === 'marriage' ? 'block' : 'none';
  document.getElementById('divorce-fields-container').style.display = mode === 'divorce' ? 'block' : 'none';
  document.getElementById('grading-fields-container').style.display = mode === 'grading' ? 'block' : 'none';

  // Toggle preview sheets
  document.getElementById('preview-birth-sheet').style.display = mode === 'birth' ? 'block' : 'none';
  document.getElementById('preview-marriage-sheet').style.display = mode === 'marriage' ? 'block' : 'none';
  document.getElementById('preview-divorce-sheet').style.display = mode === 'divorce' ? 'block' : 'none';
  document.getElementById('preview-grading-sheet').style.display = mode === 'grading' ? 'block' : 'none';

  // Reset active record ID
  document.getElementById('currentRecordId').value = "";

  // Load database history lists and clear form
  loadHistoryFromTurso();
  clearForm();

  // If in grading mode and table is empty, load default table
  if (mode === 'grading') {
    initGradingTable();
  }
}

// Zoom Preview Sheet Controller
const zoomSlider = document.getElementById('zoom-slider');
const zoomVal = document.getElementById('zoom-val');
const certificatePreview = document.getElementById('certificate-preview');

// Auto-set initial zoom based on available preview width
function applyAdaptiveZoom() {
  const w = window.innerWidth;
  let defaultZoom;
  if (w <= 1100)      defaultZoom = 0.55;
  else if (w <= 1280) defaultZoom = 0.65;
  else if (w <= 1366) defaultZoom = 0.75;
  else if (w <= 1440) defaultZoom = 0.85;
  else                defaultZoom = 1.0;

  zoomSlider.value = defaultZoom;
  zoomVal.textContent = `${Math.round(defaultZoom * 100)}%`;
  certificatePreview.style.transform = `scale(${defaultZoom})`;
}

applyAdaptiveZoom();

// Update header height CSS var so dashboard fills the screen precisely
function syncHeaderHeight() {
  const h = document.querySelector('.app-header')?.offsetHeight || 57;
  document.documentElement.style.setProperty('--header-h', `${h}px`);
}
syncHeaderHeight();
window.addEventListener('resize', () => { syncHeaderHeight(); });

zoomSlider.addEventListener('input', (e) => {
  const scale = e.target.value;
  zoomVal.textContent = `${Math.round(scale * 100)}%`;
  certificatePreview.style.transform = `scale(${scale})`;
});

document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
  let val = parseFloat(zoomSlider.value);
  val = Math.max(0.5, val - 0.05);
  zoomSlider.value = val;
  zoomSlider.dispatchEvent(new Event('input'));
});

document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
  let val = parseFloat(zoomSlider.value);
  val = Math.min(1.5, val + 0.05);
  zoomSlider.value = val;
  zoomSlider.dispatchEvent(new Event('input'));
});

// Dark/Light Theme toggling (Bootstrap Icons)
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

themeToggle.addEventListener('click', () => {
  const currentTheme = document.body.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', newTheme);

  // Swap Bootstrap icon class
  if (newTheme === 'light') {
    themeIcon.className = 'bi bi-moon-fill';
  } else {
    themeIcon.className = 'bi bi-sun-fill';
  }
});

// Modal Manager (Bootstrap 5)
let modalCallback = null;
let _bsModal = null;

function openConfirmModal(title, body, confirmBtnText, callback) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = body;
  const confirmBtn = document.getElementById('modal-confirm-btn');
  confirmBtn.textContent = confirmBtnText;
  modalCallback = callback;
  confirmBtn.onclick = () => {
    if (modalCallback) modalCallback();
    closeModal();
  };
  if (!_bsModal) {
    _bsModal = new bootstrap.Modal(document.getElementById('confirm-modal'));
  }
  _bsModal.show();
}

function closeModal() {
  if (_bsModal) _bsModal.hide();
  modalCallback = null;
}

// Toast Manager (Bootstrap 5)
function showToast(message, type = 'success') {
  const toastEl = document.getElementById('toast-notification');
  toastEl.className = `toast align-items-center app-toast no-print ${type}`;
  document.getElementById('toast-message').textContent = message;
  const bsToast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 4000 });
  bsToast.show();
}

// ==========================================================================
// 2. TEXT PROCESSING HELPERS & REACTIVE LIVE PREVIEW SYNC
// ==========================================================================

// Helper to format Date: dd/mm/yyyy to 'Month day, year'
function formatDate(str) {
  if (!str) return '';
  const parts = str.split(/[./-]/);
  if (parts.length !== 3) return str;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  
  const dateObj = new Date(year, month, day);
  if (isNaN(dateObj.getTime())) return str;
  
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return dateObj.toLocaleDateString('en-US', options);
}

// Helper to translate year digits to written English words
function getWrittenYear(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split(/[./-]/);
  if (parts.length !== 3) return '';
  const year = parseInt(parts[2], 10);
  if (isNaN(year)) return '';

  const units = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  function numberToWords(num) {
    if (num === 0) return "zero";
    let words = "";
    if (num >= 1000) {
      const thousands = Math.floor(num / 1000);
      words += numberToWords(thousands) + " thousand ";
      num %= 1000;
    }
    if (num >= 100) {
      const hundreds = Math.floor(num / 100);
      words += units[hundreds] + " hundred ";
      num %= 100;
    }
    if (num > 0) {
      if (words !== "") words += "and ";
      if (num < 10) words += units[num];
      else if (num < 20) words += teens[num - 10];
      else {
        const tenDigit = Math.floor(num / 10);
        const unitDigit = num % 10;
        words += tens[tenDigit];
        if (unitDigit > 0) words += " " + units[unitDigit];
      }
    }
    return words.trim();
  }

  const result = numberToWords(year);
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// Input elements and corresponding preview element IDs (Birth certificate)
const syncMapping = {
  fullName: { previewId: 'preview-fullName', format: val => val ? val.toUpperCase() : '' },
  dob: { previewId: 'preview-dob', format: val => formatDate(val) },
  region: { previewId: 'preview-region', format: val => val ? val.charAt(0).toUpperCase() + val.slice(1).toLowerCase() : '' },
  city: { previewId: 'preview-city', format: val => val ? val.charAt(0).toUpperCase() + val.slice(1).toLowerCase() : '' },
  entryNumber: { previewId: 'preview-entryNumber', format: val => val || '_____' },
  registryDate: { previewId: 'preview-registryDate', format: val => formatDate(val) || '__________' },
  fatherName: { previewId: 'preview-fatherName', format: val => val ? val.toUpperCase() : '' },
  fatherNationality: { previewId: 'preview-fatherNationality', format: val => val || '' },
  motherName: { previewId: 'preview-motherName', format: val => val ? val.toUpperCase() : '' },
  motherNationality: { previewId: 'preview-motherNationality', format: val => val || '' },
  regCity: { previewId: 'preview-regCity', format: val => val ? `Civil registry office of ${val} district` : '' },
  issueDate: { previewId: 'preview-issueDate', format: val => formatDate(val) },
  headName: { previewId: 'preview-headName', format: val => val || '' },
  idNumber: { previewId: 'preview-idNumber', format: val => val || '' }
};

// Input elements and corresponding preview element IDs (Marriage certificate)
const marriageSyncMapping = {
  husbandName: { previewId: 'preview-m-husbandName', format: val => val ? val.toUpperCase() : '' },
  husbandDob: { previewId: 'preview-m-husbandDob', format: val => formatDate(val) },
  husbandBirthPlace: { previewId: 'preview-m-husbandBirthPlace', format: val => val || '' },
  husbandCitizenship: { previewId: 'preview-m-husbandCitizenship', format: val => val ? val.toUpperCase() : '' },
  wifeName: { previewId: 'preview-m-wifeName', format: val => val ? val.toUpperCase() : '' },
  wifeDob: { previewId: 'preview-m-wifeDob', format: val => formatDate(val) },
  wifeBirthPlace: { previewId: 'preview-m-wifeBirthPlace', format: val => val || '' },
  wifeCitizenship: { previewId: 'preview-m-wifeCitizenship', format: val => val ? val.toUpperCase() : '' },
  marriageDate: { previewId: 'preview-m-marriageDate', format: val => formatDate(val) },
  marriageDateWords: { previewId: 'preview-m-marriageDateWords', format: val => val || '' },
  recordNumber: { previewId: 'preview-m-recordNumber', format: val => val || '' },
  recordDate: { previewId: 'preview-m-recordDate', format: val => formatDate(val) },
  husbandNewSurname: { previewId: 'preview-m-husbandNewSurname', format: val => val ? val.toUpperCase() : '' },
  wifeNewSurname: { previewId: 'preview-m-wifeNewSurname', format: val => val ? val.toUpperCase() : '' },
  regPlace: { previewId: 'preview-m-regPlace', format: val => val ? (val.toLowerCase().startsWith('civil') ? val : `Civil registry office of ${val}`) : '' },
  issueDate: { previewId: 'preview-m-issueDate', inputId: 'm-issueDate', format: val => formatDate(val) },
  chairmanName: { previewId: 'preview-m-chairmanName', format: val => val || '' },
  certNumber: { previewId: 'preview-m-certNumber', format: val => val || '' }
};

// Input elements and corresponding preview element IDs (Divorce certificate)
const divorceSyncMapping = {
  husbandName: { previewId: 'preview-d-husbandName', inputId: 'divorceHusbandName', format: val => val ? val.toUpperCase() : '' },
  wifeName: { previewId: 'preview-d-wifeName', inputId: 'divorceWifeName', format: val => val ? val.toUpperCase() : '' },
  recordNumber: { previewId: 'preview-d-recordNumber', inputId: 'divorceRecordNumber', format: val => val || '' },
  recordDate: { previewId: 'preview-d-recordDate', inputId: 'divorceRecordDate', format: val => formatDate(val) },
  husbandNewSurname: { previewId: 'preview-d-husbandSurname', inputId: 'divorceHusbandSurname', format: val => val ? val.toUpperCase() : '' },
  wifeNewSurname: { previewId: 'preview-d-wifeSurname', inputId: 'divorceWifeSurname', format: val => val ? val.toUpperCase() : '' },
  regPlace: { previewId: 'preview-d-regPlace', inputId: 'divorceRegPlace', format: val => val || '' },
  headName: { previewId: 'preview-d-headName', inputId: 'divorceHeadName', format: val => val || '' },
  sealText: { previewId: 'preview-d-sealText', inputId: 'divorceSealText', format: val => val || '' },
  certNumber: { previewId: 'preview-d-certNumber', inputId: 'divorceCertNumber', format: val => val || '' }
};

// Input elements and corresponding preview element IDs (Grading Scale)
const gradingSyncMapping = {
  headerTitle: { previewId: 'preview-g-headerTitle', inputId: 'gradingHeaderTitle', format: val => val ? val.toUpperCase() : '' },
  institution: { previewId: 'preview-g-institution', inputId: 'gradingInstitution', format: val => val ? val.toUpperCase() : '' },
  subtitle: { previewId: 'preview-g-subtitle', inputId: 'gradingSubtitle', format: val => val || '' },
  studentName: { previewId: 'preview-g-studentName', inputId: 'gradingStudentName', format: val => val ? val.toUpperCase() : '' },
  studyYears: { previewId: 'preview-g-studyYears', inputId: 'gradingStudyYears', format: val => val || '' },
  avgScore: { previewId: 'preview-g-avgScore', inputId: 'gradingAvgScore', format: val => val || '' },
  maxScore: { previewId: 'preview-g-maxScore', inputId: 'gradingMaxScore', format: val => val || '' },
  percentage: { previewId: 'preview-g-percentage', inputId: 'gradingPercentage', format: val => val || '' },
  maxPercentage: { previewId: 'preview-g-maxPercentage', inputId: 'gradingMaxPercentage', format: val => val || '' },
  noteText: { previewId: 'preview-g-noteText', inputId: 'gradingNoteText', format: val => val || '' },
  officerTitle: { previewId: 'preview-g-officerTitle', inputId: 'gradingOfficerTitle', format: val => val || '' },
  officerName: { previewId: 'preview-g-officerName', inputId: 'gradingOfficerName', format: val => val || '' },
  issueDate: { previewId: 'preview-g-issueDate', inputId: 'gradingIssueDate', format: val => formatDate(val) }
};

function initGradingTable() {
  const container = document.getElementById('preview-g-tableContainer');
  if (container && (!container.innerHTML.trim() || !container.querySelector('table'))) {
    container.innerHTML = `
      <table class="grading-scale-table">
        <thead>
          <tr>
            <th>Grade</th>
            <th>The USA<br>%</th>
            <th>Russia<br>%</th>
            <th>South Korea<br>%</th>
            <th colspan="2">Grade<br>(Uzbekistan)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td contenteditable="true">A+</td>
            <td contenteditable="true">97-100</td>
            <td rowspan="3" contenteditable="true" style="vertical-align:middle;">87 – 100</td>
            <td contenteditable="true">95 – 100</td>
            <td rowspan="3" contenteditable="true" style="vertical-align:middle; font-weight:bold;">5</td>
            <td rowspan="3" contenteditable="true" style="vertical-align:middle; font-weight:bold;">Excellent</td>
          </tr>
          <tr>
            <td contenteditable="true">A</td>
            <td contenteditable="true">93-96</td>
            <td rowspan="2" contenteditable="true" style="vertical-align:middle;">90 – 94</td>
          </tr>
          <tr>
            <td contenteditable="true">A-</td>
            <td contenteditable="true">90-92</td>
          </tr>
          <tr>
            <td contenteditable="true">B+</td>
            <td contenteditable="true">87-89</td>
            <td rowspan="5" contenteditable="true" style="vertical-align:middle;">74 – 86</td>
            <td contenteditable="true">85 – 89</td>
            <td rowspan="6" contenteditable="true" style="vertical-align:middle; font-weight:bold;">4</td>
            <td rowspan="6" contenteditable="true" style="vertical-align:middle; font-weight:bold;">Good</td>
          </tr>
          <tr>
            <td contenteditable="true">B</td>
            <td contenteditable="true">83-86</td>
            <td rowspan="2" contenteditable="true" style="vertical-align:middle;">80 – 84</td>
          </tr>
          <tr>
            <td contenteditable="true">B-</td>
            <td contenteditable="true">80-82</td>
          </tr>
          <tr>
            <td contenteditable="true">C+</td>
            <td contenteditable="true">77-79</td>
            <td rowspan="2" contenteditable="true" style="vertical-align:middle;">75 – 79</td>
          </tr>
          <tr>
            <td contenteditable="true">C</td>
            <td contenteditable="true">73-76</td>
          </tr>
          <tr>
            <td contenteditable="true">C-</td>
            <td contenteditable="true">70-72</td>
            <td rowspan="4" contenteditable="true" style="vertical-align:middle;">60 – 73</td>
            <td rowspan="2" contenteditable="true" style="vertical-align:middle;">70 – 74</td>
          </tr>
          <tr>
            <td contenteditable="true">D+</td>
            <td contenteditable="true">67-69</td>
            <td rowspan="3" contenteditable="true" style="vertical-align:middle; font-weight:bold;">3</td>
            <td rowspan="3" contenteditable="true" style="vertical-align:middle; font-weight:bold;">Satisfactory</td>
          </tr>
          <tr>
            <td contenteditable="true">D</td>
            <td contenteditable="true">63-66</td>
            <td rowspan="2" contenteditable="true" style="vertical-align:middle;">60 – 64</td>
          </tr>
          <tr>
            <td contenteditable="true">D-</td>
            <td contenteditable="true">60-62</td>
          </tr>
          <tr>
            <td contenteditable="true">F</td>
            <td contenteditable="true">0-59</td>
            <td contenteditable="true">0 – 59</td>
            <td contenteditable="true">0 – 59</td>
            <td contenteditable="true" style="font-weight:bold;">2</td>
            <td contenteditable="true" style="font-weight:bold;">Unsatisfactory</td>
          </tr>
        </tbody>
      </table>
    `;
  }
}

let isSyncingFromPaper = false;

function initPaperEditing() {
  const mappingGroups = [syncMapping, marriageSyncMapping, divorceSyncMapping, gradingSyncMapping];
  
  mappingGroups.forEach(mapping => {
    Object.keys(mapping).forEach(key => {
      const config = mapping[key];
      const previewEl = document.getElementById(config.previewId);
      const inputId = config.inputId || key;
      const inputEl = document.getElementById(inputId);
      
      if (!previewEl || !inputEl) return;
    
    // Make the element editable
    previewEl.setAttribute('contenteditable', 'true');
    previewEl.style.outline = 'none'; // prevent ugly focus ring on paper
    previewEl.setAttribute('spellcheck', 'false');
    previewEl.setAttribute('data-gramm', 'false');
    previewEl.setAttribute('data-gramm_editor', 'false');
    previewEl.setAttribute('data-enable-grammarly', 'false');
    
    // Listen to changes on the paper
    previewEl.addEventListener('input', (e) => {
      isSyncingFromPaper = true;
      let val = e.target.textContent;
      
      // Crude check: if it looks like a placeholder, don't sync it as real value
      if (val.includes('[')) val = ''; 
      
      inputEl.value = val;
      
      // Dispatch input event on the real input to trigger validation and auto-formatting
      inputEl.dispatchEvent(new Event('input'));
      
      isSyncingFromPaper = false;
    });

    // When focused, if it has a placeholder, clear it so they can type cleanly
    previewEl.addEventListener('focus', (e) => {
      if (previewEl.querySelector('.placeholder-text')) {
        previewEl.innerHTML = '';
      }
    });

    // When blurred, sync the formatted value back to the paper to ensure it stays clean
    previewEl.addEventListener('blur', (e) => {
      // Re-trigger updatePreviewField with the finalized value to restore placeholders if empty
      // and apply any styling like capitalization or date slashes.
      updatePreviewField(key, inputEl.value);
    });
  });
  }); // End of mappingGroups.forEach

  // Make the birth date (in words) dynamically editable as well, since it derives from dob
  const dobWordsEl = document.getElementById('preview-dobWords');
  if (dobWordsEl && !dobWordsEl.hasAttribute('contenteditable')) {
    dobWordsEl.setAttribute('contenteditable', 'true');
    dobWordsEl.style.outline = 'none';
    dobWordsEl.setAttribute('spellcheck', 'false');
    dobWordsEl.setAttribute('data-gramm', 'false');
    dobWordsEl.setAttribute('data-gramm_editor', 'false');
    dobWordsEl.setAttribute('data-enable-grammarly', 'false');
  }
}

// Initialize listeners for real-time reactivity
function initReactivity() {
  // Birth reactivity
  Object.keys(syncMapping).forEach(key => {
    const inputId = syncMapping[key].inputId || key;
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('input', (e) => {
      let value = e.target.value;

      // Auto-format Date fields: dd/mm/yyyy
      if (inputId === 'dob' || inputId === 'registryDate' || inputId === 'issueDate') {
        if (!e.inputType || !e.inputType.startsWith('delete')) {
          let digits = value.replace(/\D/g, '');
          if (digits.length > 8) digits = digits.slice(0, 8);
          
          let formatted = '';
          if (digits.length > 0) {
            formatted += digits.slice(0, 2);
            if (digits.length === 2 && value.length === 2) formatted += '/';
          }
          if (digits.length > 2) {
            formatted += '/' + digits.slice(2, 4);
            if (digits.length === 4 && value.length === 5) formatted += '/';
          }
          if (digits.length > 4) {
            formatted += '/' + digits.slice(4, 8);
          }
          e.target.value = formatted;
          value = formatted;
        }
      }

      // Case styling rules
      if (inputId === 'fullName' || inputId === 'fatherName' || inputId === 'motherName') {
        const cursorPosition = e.target.selectionStart;
        e.target.value = value.toUpperCase();
        e.target.setSelectionRange(cursorPosition, cursorPosition);
        value = e.target.value;
      } else if (inputId === 'region' || inputId === 'city') {
        const cursorPosition = e.target.selectionStart;
        if (value.length > 0) {
          e.target.value = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
        }
        e.target.setSelectionRange(cursorPosition, cursorPosition);
        value = e.target.value;
      }

      validateField(key, value);
      if (!isSyncingFromPaper) updatePreviewField(key, value);
    });
  });

  // Marriage reactivity
  Object.keys(marriageSyncMapping).forEach(key => {
    const inputId = marriageSyncMapping[key].inputId || key;
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('input', (e) => {
      let value = e.target.value;

      // Auto-format Date fields: dd/mm/yyyy
      if (inputId === 'husbandDob' || inputId === 'wifeDob' || inputId === 'marriageDate' || inputId === 'recordDate' || inputId === 'm-issueDate') {
        if (!e.inputType || !e.inputType.startsWith('delete')) {
          let digits = value.replace(/\D/g, '');
          if (digits.length > 8) digits = digits.slice(0, 8);
          
          let formatted = '';
          if (digits.length > 0) {
            formatted += digits.slice(0, 2);
            if (digits.length === 2 && value.length === 2) formatted += '/';
          }
          if (digits.length > 2) {
            formatted += '/' + digits.slice(2, 4);
            if (digits.length === 4 && value.length === 5) formatted += '/';
          }
          if (digits.length > 4) {
            formatted += '/' + digits.slice(4, 8);
          }
          e.target.value = formatted;
          value = formatted;
        }
      }

      // Case styling rules
      if (inputId === 'husbandName' || inputId === 'wifeName' || inputId === 'husbandNewSurname' || inputId === 'wifeNewSurname') {
        const cursorPosition = e.target.selectionStart;
        e.target.value = value.toUpperCase();
        e.target.setSelectionRange(cursorPosition, cursorPosition);
        value = e.target.value;
      }

      // Auto-generate Marriage Date in Words
      if (inputId === 'marriageDate') {
        const wordsInput = document.getElementById('marriageDateWords');
        if (wordsInput) {
          wordsInput.value = getWrittenYear(value);
          if (!isSyncingFromPaper) updatePreviewField('marriageDateWords', wordsInput.value);
        }
      }

      validateField(key, value);
      if (!isSyncingFromPaper) updatePreviewField(key, value);
    });
  });

  // Divorce reactivity
  Object.keys(divorceSyncMapping).forEach(key => {
    const inputId = divorceSyncMapping[key].inputId;
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('input', (e) => {
      let value = e.target.value;

      // Auto-format Date fields: dd/mm/yyyy
      if (inputId === 'divorceRecordDate' || inputId === 'divorceIssueDate') {
        if (!e.inputType || !e.inputType.startsWith('delete')) {
          let digits = value.replace(/\D/g, '');
          if (digits.length > 8) digits = digits.slice(0, 8);
          
          let formatted = '';
          if (digits.length > 0) {
            formatted += digits.slice(0, 2);
            if (digits.length === 2 && value.length === 2) formatted += '/';
          }
          if (digits.length > 2) {
            formatted += '/' + digits.slice(2, 4);
            if (digits.length === 4 && value.length === 5) formatted += '/';
          }
          if (digits.length > 4) {
            formatted += '/' + digits.slice(4, 8);
          }
          e.target.value = formatted;
          value = formatted;
        }
      }

      // Case styling rules
      if (inputId === 'divorceHusbandName' || inputId === 'divorceWifeName' || inputId === 'divorceHusbandSurname' || inputId === 'divorceWifeSurname' || inputId === 'divorceGivenTo') {
        const cursorPosition = e.target.selectionStart;
        e.target.value = value.toUpperCase();
        e.target.setSelectionRange(cursorPosition, cursorPosition);
        value = e.target.value;
      }

      validateField(key, value);
      if (!isSyncingFromPaper) updatePreviewField(key, value);
    });
  });

  // Grading Scale reactivity
  Object.keys(gradingSyncMapping).forEach(key => {
    const inputId = gradingSyncMapping[key].inputId;
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('input', (e) => {
      let value = e.target.value;

      if (inputId === 'gradingIssueDate') {
        if (!e.inputType || !e.inputType.startsWith('delete')) {
          let digits = value.replace(/\D/g, '');
          if (digits.length > 8) digits = digits.slice(0, 8);
          
          let formatted = '';
          if (digits.length > 0) {
            formatted += digits.slice(0, 2);
            if (digits.length === 2 && value.length === 2) formatted += '/';
          }
          if (digits.length > 2) {
            formatted += '/' + digits.slice(2, 4);
            if (digits.length === 4 && value.length === 5) formatted += '/';
          }
          if (digits.length > 4) {
            formatted += '/' + digits.slice(4, 8);
          }
          e.target.value = formatted;
          value = formatted;
        }
      }

      if (inputId === 'gradingHeaderTitle' || inputId === 'gradingInstitution' || inputId === 'gradingStudentName') {
        const cursorPosition = e.target.selectionStart;
        e.target.value = value.toUpperCase();
        e.target.setSelectionRange(cursorPosition, cursorPosition);
        value = e.target.value;
      }

      if (!isSyncingFromPaper) updatePreviewField(key, value);
    });
  });

  // Setup click-to-edit on the paper itself
  initPaperEditing();
}

// Dynamic field update routing
function updatePreviewField(key, rawValue) {
  // Always use the active mode, which prevents duplicate key conflicts
  // (like issueDate existing in both birth and divorce)
  updatePreviewFieldForced(currentMode, key, rawValue);
}

// Helper to sync preview sheet HTML
function updatePreviewFieldForced(mode, inputId, rawValue) {
  let config;
  if (mode === 'birth') config = syncMapping[inputId];
  else if (mode === 'marriage') config = marriageSyncMapping[inputId];
  else if (mode === 'divorce') config = divorceSyncMapping[inputId];
  else config = gradingSyncMapping[inputId];

  if (!config) return;
  const previewEl = document.getElementById(config.previewId);
  if (!previewEl) return;

  const formattedVal = config.format(rawValue);

  if (!rawValue) {
    let placeholderText = "";
    if (mode === 'birth') {
      switch (inputId) {
        case 'fullName': placeholderText = "[CITIZEN NAME]"; break;
        case 'dob': placeholderText = "[DATE OF BIRTH]"; break;
        case 'region': placeholderText = "[REGION]"; break;
        case 'city': placeholderText = "[CITY / DISTRICT]"; break;
        case 'entryNumber': placeholderText = "[ENTRY NO]"; break;
        case 'registryDate': placeholderText = "[REGISTRY DATE]"; break;
        case 'fatherName': placeholderText = "[FATHER NAME]"; break;
        case 'fatherNationality': placeholderText = "[NATIONALITY]"; break;
        case 'motherName': placeholderText = "[MOTHER NAME]"; break;
        case 'motherNationality': placeholderText = "[NATIONALITY]"; break;
        case 'regCity': placeholderText = "[REGISTRATION PLACE]"; break;
        case 'issueDate': placeholderText = "[DATE OF ISSUE]"; break;
        case 'headName': placeholderText = "[HEAD NAME]"; break;
        case 'idNumber': placeholderText = "[ID NUMBER]"; break;
        default: placeholderText = "______";
      }
      previewEl.innerHTML = `<span class="placeholder-text">${placeholderText}</span>`;
    } else if (mode === 'marriage') {
      switch (inputId) {
        case 'husbandName': placeholderText = "[HUSBAND CITIZEN NAME]"; break;
        case 'husbandDob': placeholderText = "[DATE OF BIRTH]"; break;
        case 'husbandBirthPlace': placeholderText = "[BIRTH PLACE]"; break;
        case 'husbandCitizenship': placeholderText = "[CITIZENSHIP]"; break;
        case 'wifeName': placeholderText = "[WIFE CITIZEN NAME]"; break;
        case 'wifeDob': placeholderText = "[DATE OF BIRTH]"; break;
        case 'wifeBirthPlace': placeholderText = "[BIRTH PLACE]"; break;
        case 'wifeCitizenship': placeholderText = "[CITIZENSHIP]"; break;
        case 'marriageDate': placeholderText = "[MARRIAGE DATE]"; break;
        case 'marriageDateWords': placeholderText = "[MARRIAGE DATE IN WORDS]"; break;
        case 'recordNumber': placeholderText = "[RECORD NO]"; break;
        case 'recordDate': placeholderText = "[RECORD DATE]"; break;
        case 'husbandNewSurname': placeholderText = "[HUSBAND SURNAME]"; break;
        case 'wifeNewSurname': placeholderText = "[WIFE SURNAME]"; break;
        case 'regPlace': placeholderText = "[REGISTRATION PLACE]"; break;
        case 'issueDate': placeholderText = "[DATE OF ISSUE]"; break;
        case 'chairmanName': placeholderText = "[CHAIRMAN NAME]"; break;
        case 'certNumber': placeholderText = "[CERTIFICATE NO]"; break;
        default: placeholderText = "______";
      }
      previewEl.innerHTML = `<span class="placeholder-text">${placeholderText}</span>`;
    } else if (mode === 'divorce') {
      // Divorce mode placeholders
      switch (inputId) {
        case 'husbandName': placeholderText = "[HUSBAND CITIZEN NAME]"; break;
        case 'wifeName': placeholderText = "[WIFE CITIZEN NAME]"; break;
        case 'recordNumber': placeholderText = "[RECORD NO]"; break;
        case 'recordDate': placeholderText = "[RECORD DATE]"; break;
        case 'husbandNewSurname': placeholderText = "[HUSBAND SURNAME]"; break;
        case 'wifeNewSurname': placeholderText = "[WIFE SURNAME]"; break;
        case 'regPlace': placeholderText = "[REGISTRATION PLACE]"; break;
        case 'givenTo': placeholderText = "[RECIPIENT NAME]"; break;
        case 'issueDate': placeholderText = "[DATE OF ISSUE]"; break;
        case 'headName': placeholderText = "[HEAD NAME]"; break;
        case 'sealText': placeholderText = "[OFFICIAL SEAL TEXT]"; break;
        case 'certNumber': placeholderText = "[CERTIFICATE NO]"; break;
        default: placeholderText = "______";
      }
      previewEl.innerHTML = `<span class="placeholder-text">${placeholderText}</span>`;
    } else {
      // Grading Scale mode placeholders
      switch (inputId) {
        case 'headerTitle': placeholderText = "MINISTRY OF PRESCHOOL AND SCHOOL EDUCATION OF THE REPUBLIC OF UZBEKISTAN"; break;
        case 'institution': placeholderText = "[INSTITUTION NAME]"; break;
        case 'subtitle': placeholderText = "ACADEMIC PROGRESS NOTE"; break;
        case 'studentName': placeholderText = "[STUDENT NAME]"; break;
        case 'studyYears': placeholderText = "[STUDY YEARS]"; break;
        case 'avgScore': placeholderText = "[AVERAGE SCORE]"; break;
        case 'percentage': placeholderText = "[PERCENTAGE]"; break;
        case 'noteText':
          previewEl.textContent = "Conversion of the total points for the discipline from 100-point scale to the equivalent of a 5-point scale is carried out in accordance with the scales given below.";
          return;
        case 'officerTitle': placeholderText = "DIRECTOR OF"; break;
        case 'officerName': placeholderText = "[OFFICER NAME]"; break;
        case 'issueDate': placeholderText = "[DATE OF ISSUE]"; break;
        case 'certNumber': placeholderText = "[REFERENCE NO]"; break;
        case 'sealText': placeholderText = "[OFFICIAL SEAL TEXT]"; break;
        default: placeholderText = "______";
      }
      previewEl.innerHTML = `<span class="placeholder-text">${placeholderText}</span>`;
    }
  } else {
    previewEl.textContent = formattedVal;
  }

  if (mode === 'grading' && inputId === 'institution') {
    const instInText = document.getElementById('preview-g-instInText');
    if (instInText) instInText.textContent = formattedVal || '[INSTITUTION NAME]';
  }
  // Special handling: Birth year in words
  if (mode === 'birth' && inputId === 'dob') {
    const wordsEl = document.getElementById('preview-dobWords');
    if (wordsEl) {
      const spelling = getWrittenYear(rawValue);
      wordsEl.innerHTML = spelling ? spelling : `<span class="placeholder-text">[BIRTH YEAR IN WORDS]</span>`;
    }
  }
}

// Force validation of fields
function validateField(id, val) {
  const dateRegex = /^\d{2}[./-]\d{2}[./-]\d{4}$/;
  let isValid = true;

  const birthRequired = ['fullName', 'region', 'city'];
  const birthDates = ['dob', 'registryDate', 'issueDate'];
  
  const marriageRequired = ['husbandName', 'husbandDob', 'husbandBirthPlace', 'husbandCitizenship', 'wifeName', 'wifeDob', 'wifeBirthPlace', 'wifeCitizenship', 'marriageDate', 'marriageDateWords', 'recordNumber', 'recordDate', 'regPlace', 'issueDate', 'chairmanName', 'certNumber'];
  const marriageDates = ['husbandDob', 'wifeDob', 'marriageDate', 'recordDate', 'issueDate'];

  const divorceRequired = ['husbandName', 'wifeName', 'recordNumber', 'recordDate', 'husbandNewSurname', 'wifeNewSurname', 'regPlace', 'givenTo', 'issueDate', 'headName', 'sealText', 'certNumber'];
  const divorceDates = ['recordDate', 'issueDate'];

  let activeRequired, activeDates;
  if (currentMode === 'birth') {
    activeRequired = birthRequired;
    activeDates = birthDates;
  } else if (currentMode === 'marriage') {
    activeRequired = marriageRequired;
    activeDates = marriageDates;
  } else if (currentMode === 'divorce') {
    activeRequired = divorceRequired;
    activeDates = divorceDates;
  } else {
    activeRequired = [];
    activeDates = ['issueDate'];
  }

  let mapping;
  if (currentMode === 'birth') mapping = syncMapping;
  else if (currentMode === 'marriage') mapping = marriageSyncMapping;
  else if (currentMode === 'divorce') mapping = divorceSyncMapping;
  else mapping = gradingSyncMapping;

  const inputId = (mapping[id] && mapping[id].inputId) ? mapping[id].inputId : id;
  const errEl = document.getElementById(`${inputId}Error`);
  if (!errEl) return true;

  const trimmedVal = val.trim();

  if (activeRequired.includes(id) && !activeDates.includes(id)) {
    const matches = !!trimmedVal;
    errEl.style.display = matches ? 'none' : 'block';
    isValid = matches;
  } else if (activeDates.includes(id)) {
    const isRequired = id === 'dob' || id === 'husbandDob' || id === 'wifeDob' || id === 'marriageDate' || id === 'recordDate';
    const matches = dateRegex.test(trimmedVal);
    if (isRequired) {
      errEl.style.display = matches ? 'none' : 'block';
      isValid = matches;
    } else {
      const hasText = !!trimmedVal;
      errEl.style.display = (!hasText || matches) ? 'none' : 'block';
      isValid = !hasText || matches;
    }
  }
  return isValid;
}

// Validate entire form before saving
function validateForm() {
  let isFormValid = true;
  let mapping;
  if (currentMode === 'birth') mapping = syncMapping;
  else if (currentMode === 'marriage') mapping = marriageSyncMapping;
  else if (currentMode === 'divorce') mapping = divorceSyncMapping;
  else mapping = gradingSyncMapping;

  Object.keys(mapping).forEach(key => {
    const inputId = mapping[key].inputId || key;
    const input = document.getElementById(inputId);
    const isValid = validateField(key, input ? input.value : '');
    if (!isValid) isFormValid = false;
  });
  return isFormValid;
}

// ==========================================================================
// 3. TURSO DATABASE INTEGRATION
// ==========================================================================

// Connection badge state
function setDbStatus(state, message = "") {
  const badge = document.getElementById('db-status-badge');
  const dot = document.getElementById('db-status-dot');
  const text = document.getElementById('db-status-text');

  if (!badge || !dot || !text) return;

  dot.className = 'status-dot';
  
  if (state === 'connecting') {
    dot.classList.add('connecting');
    text.textContent = 'Turso Connecting';
    badge.title = 'Connecting to Turso...';
  } else if (state === 'connected') {
    dot.classList.add('connected');
    text.textContent = 'Turso Online';
    badge.title = 'Successfully connected to Turso SQLite database';
  } else {
    dot.classList.add('error');
    text.textContent = 'Turso Offline';
    badge.title = `Error: ${message || 'Failed connection'}. Click to retry.`;
  }
}

// Direct HTTP implementation of query pipeline
async function runTursoQuery(sql, args = []) {
  const hranaArgs = args.map(arg => {
    if (arg === null || arg === undefined) {
      return { type: "null" };
    } else if (typeof arg === "number") {
      return { type: "integer", value: arg.toString() };
    } else {
      return { type: "text", value: arg.toString() };
    }
  });

  const response = await fetch(TURSO_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TURSO_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql: sql,
            args: hranaArgs
          }
        },
        {
          type: "close"
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
  }

  const payload = await response.json();
  const executeResult = payload.results[0];

  if (executeResult.type === "error") {
    throw new Error(executeResult.error.message || "SQLite Execution Error");
  }

  const result = executeResult.response.result;
  const cols = result.cols.map(c => c.name);
  
  const parsedRows = result.rows.map(row => {
    const obj = {};
    cols.forEach((col, idx) => {
      const cell = row[idx];
      if (cell.type === "null") {
        obj[col] = null;
      } else if (cell.type === "integer") {
        obj[col] = parseInt(cell.value, 10);
      } else if (cell.type === "float") {
        obj[col] = parseFloat(cell.value);
      } else {
        obj[col] = cell.value;
      }
    });
    return obj;
  });

  return {
    rows: parsedRows,
    affectedRowCount: result.affected_row_count,
    lastInsertRowid: result.last_insert_rowid
  };
}

// Database initialization on start
async function initializeDatabase() {
  setDbStatus('connecting');
  try {
    const sqlBirth = `
      CREATE TABLE IF NOT EXISTS birth_certificates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        dob TEXT NOT NULL,
        writtenYear TEXT NOT NULL,
        region TEXT NOT NULL,
        city TEXT NOT NULL,
        entryNumber TEXT,
        registryDate TEXT,
        fatherName TEXT,
        fatherNationality TEXT,
        motherName TEXT,
        motherNationality TEXT,
        regCity TEXT,
        issueDate TEXT,
        headName TEXT,
        idNumber TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    const sqlMarriage = `
      CREATE TABLE IF NOT EXISTS marriage_certificates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        husbandName TEXT NOT NULL,
        husbandDob TEXT NOT NULL,
        husbandBirthPlace TEXT NOT NULL,
        husbandCitizenship TEXT NOT NULL,
        wifeName TEXT NOT NULL,
        wifeDob TEXT NOT NULL,
        wifeBirthPlace TEXT NOT NULL,
        wifeCitizenship TEXT NOT NULL,
        marriageDate TEXT NOT NULL,
        marriageDateWords TEXT NOT NULL,
        recordNumber TEXT NOT NULL,
        recordDate TEXT NOT NULL,
        husbandNewSurname TEXT NOT NULL,
        wifeNewSurname TEXT NOT NULL,
        regPlace TEXT NOT NULL,
        issueDate TEXT NOT NULL,
        chairmanName TEXT NOT NULL,
        certNumber TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    const sqlDivorce = `
      CREATE TABLE IF NOT EXISTS divorce_certificates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        husbandName TEXT NOT NULL,
        wifeName TEXT NOT NULL,
        recordNumber TEXT NOT NULL,
        recordDate TEXT NOT NULL,
        husbandNewSurname TEXT NOT NULL,
        wifeNewSurname TEXT NOT NULL,
        regPlace TEXT NOT NULL,
        givenTo TEXT NOT NULL,
        issueDate TEXT NOT NULL,
        headName TEXT NOT NULL,
        sealText TEXT NOT NULL,
        certNumber TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    const sqlGrading = `
      CREATE TABLE IF NOT EXISTS grading_scales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        headerTitle TEXT,
        institution TEXT,
        subtitle TEXT,
        studentName TEXT,
        studyYears TEXT,
        avgScore TEXT,
        percentage TEXT,
        noteText TEXT,
        officerTitle TEXT,
        officerName TEXT,
        issueDate TEXT,
        certNumber TEXT,
        sealText TEXT,
        presetType TEXT,
        tableHtml TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await runTursoQuery(sqlBirth);
    await runTursoQuery(sqlMarriage);
    await runTursoQuery(sqlDivorce);
    await runTursoQuery(sqlGrading);
    setDbStatus('connected');
    console.log("Turso database schemas verified.");
    await loadHistoryFromTurso();
  } catch (err) {
    console.error("Database initialization failed:", err);
    setDbStatus('error', err.message);
    showToast("Database Offline. Edits will not save.", "error");
  }
}

// Save current form fields to Turso SQLite database
async function saveToDatabase() {
  if (!validateForm()) {
    showToast("Please fix the validation errors in the form.", "error");
    return 'validation_failed';
  }

  const currentRecordId = document.getElementById("currentRecordId").value;
  let recordIdToSave = currentRecordId;

  if (currentMode === 'birth') {
    const formData = {
      fullName: document.getElementById("fullName").value.trim().toUpperCase(),
      dob: document.getElementById("dob").value.trim(),
      writtenYear: getWrittenYear(document.getElementById("dob").value.trim()),
      region: document.getElementById("region").value.trim(),
      city: document.getElementById("city").value.trim(),
      entryNumber: document.getElementById("entryNumber").value.trim(),
      registryDate: document.getElementById("registryDate").value.trim(),
      fatherName: document.getElementById("fatherName").value.trim().toUpperCase(),
      fatherNationality: document.getElementById("fatherNationality").value.trim(),
      motherName: document.getElementById("motherName").value.trim().toUpperCase(),
      motherNationality: document.getElementById("motherNationality").value.trim(),
      regCity: document.getElementById("regCity").value.trim(),
      issueDate: document.getElementById("issueDate").value.trim(),
      headName: document.getElementById("headName").value.trim(),
      idNumber: document.getElementById("idNumber").value.trim()
    };

    if (!recordIdToSave) {
      try {
        let checkSql = "";
        let checkParams = [];
        if (formData.idNumber) {
          checkSql = "SELECT id FROM birth_certificates WHERE idNumber = ? LIMIT 1;";
          checkParams = [formData.idNumber];
        } else if (formData.fullName && formData.dob) {
          checkSql = "SELECT id FROM birth_certificates WHERE fullName = ? AND dob = ? LIMIT 1;";
          checkParams = [formData.fullName, formData.dob];
        }
        if (checkSql) {
          const checkRes = await runTursoQuery(checkSql, checkParams);
          if (checkRes.rows && checkRes.rows.length > 0) {
            recordIdToSave = checkRes.rows[0].id;
            document.getElementById("currentRecordId").value = recordIdToSave;
          }
        }
      } catch (checkErr) {
        console.error("Error checking for existing record:", checkErr);
      }
    }

    try {
      if (recordIdToSave) {
        const sql = `
          UPDATE birth_certificates SET 
            fullName = ?, dob = ?, writtenYear = ?, region = ?, city = ?, 
            entryNumber = ?, registryDate = ?, fatherName = ?, fatherNationality = ?, 
            motherName = ?, motherNationality = ?, regCity = ?, issueDate = ?, 
            headName = ?, idNumber = ?
          WHERE id = ?;
        `;
        await runTursoQuery(sql, [
          formData.fullName, formData.dob, formData.writtenYear, formData.region, formData.city,
          formData.entryNumber, formData.registryDate, formData.fatherName, formData.fatherNationality,
          formData.motherName, formData.motherNationality, formData.regCity, formData.issueDate,
          formData.headName, formData.idNumber, parseInt(recordIdToSave, 10)
        ]);
        showToast(`Successfully updated database record for ${formData.fullName}`);
      } else {
        const sql = `
          INSERT INTO birth_certificates (
            fullName, dob, writtenYear, region, city, 
            entryNumber, registryDate, fatherName, fatherNationality, 
            motherName, motherNationality, regCity, issueDate, 
            headName, idNumber
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        const result = await runTursoQuery(sql, [
          formData.fullName, formData.dob, formData.writtenYear, formData.region, formData.city,
          formData.entryNumber, formData.registryDate, formData.fatherName, formData.fatherNationality,
          formData.motherName, formData.motherNationality, formData.regCity, formData.issueDate,
          formData.headName, formData.idNumber
        ]);
        if (result.lastInsertRowid) {
          document.getElementById("currentRecordId").value = result.lastInsertRowid;
        }
        showToast(`Successfully saved record for ${formData.fullName} to database`);
      }
      loadHistoryFromTurso();
      return 'success';
    } catch (err) {
      console.error("Failed to save record:", err);
      showToast("Database offline. Exporting document without saving.", "warning");
      return 'db_error';
    }
  } else if (currentMode === 'marriage') {
    // Marriage Mode Saving
    const formData = {
      husbandName: document.getElementById("husbandName").value.trim().toUpperCase(),
      husbandDob: document.getElementById("husbandDob").value.trim(),
      husbandBirthPlace: document.getElementById("husbandBirthPlace").value.trim(),
      husbandCitizenship: document.getElementById("husbandCitizenship").value.trim().toUpperCase(),
      wifeName: document.getElementById("wifeName").value.trim().toUpperCase(),
      wifeDob: document.getElementById("wifeDob").value.trim(),
      wifeBirthPlace: document.getElementById("wifeBirthPlace").value.trim(),
      wifeCitizenship: document.getElementById("wifeCitizenship").value.trim().toUpperCase(),
      marriageDate: document.getElementById("marriageDate").value.trim(),
      marriageDateWords: document.getElementById("marriageDateWords").value.trim(),
      recordNumber: document.getElementById("recordNumber").value.trim(),
      recordDate: document.getElementById("recordDate").value.trim(),
      husbandNewSurname: document.getElementById("husbandNewSurname").value.trim().toUpperCase(),
      wifeNewSurname: document.getElementById("wifeNewSurname").value.trim().toUpperCase(),
      regPlace: document.getElementById("regPlace").value.trim(),
      issueDate: document.getElementById("m-issueDate").value.trim(),
      chairmanName: document.getElementById("chairmanName").value.trim(),
      certNumber: document.getElementById("certNumber").value.trim()
    };

    if (!recordIdToSave) {
      try {
        let checkSql = "";
        let checkParams = [];
        if (formData.certNumber) {
          checkSql = "SELECT id FROM marriage_certificates WHERE certNumber = ? LIMIT 1;";
          checkParams = [formData.certNumber];
        } else if (formData.husbandName && formData.wifeName && formData.marriageDate) {
          checkSql = "SELECT id FROM marriage_certificates WHERE husbandName = ? AND wifeName = ? AND marriageDate = ? LIMIT 1;";
          checkParams = [formData.husbandName, formData.wifeName, formData.marriageDate];
        }
        if (checkSql) {
          const checkRes = await runTursoQuery(checkSql, checkParams);
          if (checkRes.rows && checkRes.rows.length > 0) {
            recordIdToSave = checkRes.rows[0].id;
            document.getElementById("currentRecordId").value = recordIdToSave;
          }
        }
      } catch (checkErr) {
        console.error("Error checking for existing marriage record:", checkErr);
      }
    }

    try {
      if (recordIdToSave) {
        const sql = `
          UPDATE marriage_certificates SET 
            husbandName = ?, husbandDob = ?, husbandBirthPlace = ?, husbandCitizenship = ?,
            wifeName = ?, wifeDob = ?, wifeBirthPlace = ?, wifeCitizenship = ?,
            marriageDate = ?, marriageDateWords = ?, recordNumber = ?, recordDate = ?,
            husbandNewSurname = ?, wifeNewSurname = ?, regPlace = ?, issueDate = ?,
            chairmanName = ?, certNumber = ?
          WHERE id = ?;
        `;
        await runTursoQuery(sql, [
          formData.husbandName, formData.husbandDob, formData.husbandBirthPlace, formData.husbandCitizenship,
          formData.wifeName, formData.wifeDob, formData.wifeBirthPlace, formData.wifeCitizenship,
          formData.marriageDate, formData.marriageDateWords, formData.recordNumber, formData.recordDate,
          formData.husbandNewSurname, formData.wifeNewSurname, formData.regPlace, formData.issueDate,
          formData.chairmanName, formData.certNumber, parseInt(recordIdToSave, 10)
        ]);
        showToast(`Successfully updated marriage record for ${formData.husbandName} & ${formData.wifeName}`);
      } else {
        const sql = `
          INSERT INTO marriage_certificates (
            husbandName, husbandDob, husbandBirthPlace, husbandCitizenship,
            wifeName, wifeDob, wifeBirthPlace, wifeCitizenship,
            marriageDate, marriageDateWords, recordNumber, recordDate,
            husbandNewSurname, wifeNewSurname, regPlace, issueDate,
            chairmanName, certNumber
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        const result = await runTursoQuery(sql, [
          formData.husbandName, formData.husbandDob, formData.husbandBirthPlace, formData.husbandCitizenship,
          formData.wifeName, formData.wifeDob, formData.wifeBirthPlace, formData.wifeCitizenship,
          formData.marriageDate, formData.marriageDateWords, formData.recordNumber, formData.recordDate,
          formData.husbandNewSurname, formData.wifeNewSurname, formData.regPlace, formData.issueDate,
          formData.chairmanName, formData.certNumber
        ]);
        if (result.lastInsertRowid) {
          document.getElementById("currentRecordId").value = result.lastInsertRowid;
        }
        showToast(`Successfully saved marriage record for ${formData.husbandName} & ${formData.wifeName} to database`);
      }
      loadHistoryFromTurso();
      return 'success';
    } catch (err) {
      console.error("Failed to save marriage record:", err);
      showToast("Database offline. Exporting document without saving.", "warning");
      return 'db_error';
    }
  } else if (currentMode === 'divorce') {
    // Divorce Mode Saving
    const formData = {
      husbandName: document.getElementById("divorceHusbandName").value.trim().toUpperCase(),
      wifeName: document.getElementById("divorceWifeName").value.trim().toUpperCase(),
      recordNumber: document.getElementById("divorceRecordNumber").value.trim(),
      recordDate: document.getElementById("divorceRecordDate").value.trim(),
      husbandNewSurname: document.getElementById("divorceHusbandSurname").value.trim().toUpperCase(),
      wifeNewSurname: document.getElementById("divorceWifeSurname").value.trim().toUpperCase(),
      regPlace: document.getElementById("divorceRegPlace").value.trim(),
      givenTo: document.getElementById("divorceGivenTo").value.trim().toUpperCase(),
      issueDate: document.getElementById("divorceIssueDate").value.trim(),
      headName: document.getElementById("divorceHeadName").value.trim(),
      sealText: document.getElementById("divorceSealText").value.trim(),
      certNumber: document.getElementById("divorceCertNumber").value.trim()
    };

    if (!recordIdToSave) {
      try {
        let checkSql = "";
        let checkParams = [];
        if (formData.certNumber) {
          checkSql = "SELECT id FROM divorce_certificates WHERE certNumber = ? LIMIT 1;";
          checkParams = [formData.certNumber];
        } else if (formData.husbandName && formData.wifeName && formData.recordNumber) {
          checkSql = "SELECT id FROM divorce_certificates WHERE husbandName = ? AND wifeName = ? AND recordNumber = ? LIMIT 1;";
          checkParams = [formData.husbandName, formData.wifeName, formData.recordNumber];
        }
        if (checkSql) {
          const checkRes = await runTursoQuery(checkSql, checkParams);
          if (checkRes.rows && checkRes.rows.length > 0) {
            recordIdToSave = checkRes.rows[0].id;
            document.getElementById("currentRecordId").value = recordIdToSave;
          }
        }
      } catch (checkErr) {
        console.error("Error checking for existing divorce record:", checkErr);
      }
    }

    try {
      if (recordIdToSave) {
        const sql = `
          UPDATE divorce_certificates SET 
            husbandName = ?, wifeName = ?, recordNumber = ?, recordDate = ?,
            husbandNewSurname = ?, wifeNewSurname = ?, regPlace = ?, givenTo = ?, 
            issueDate = ?, headName = ?, sealText = ?, certNumber = ?
          WHERE id = ?;
        `;
        await runTursoQuery(sql, [
          formData.husbandName, formData.wifeName, formData.recordNumber, formData.recordDate,
          formData.husbandNewSurname, formData.wifeNewSurname, formData.regPlace, formData.givenTo,
          formData.issueDate, formData.headName, formData.sealText, formData.certNumber, parseInt(recordIdToSave, 10)
        ]);
        showToast(`Successfully updated divorce record for ${formData.husbandName} & ${formData.wifeName}`);
      } else {
        const sql = `
          INSERT INTO divorce_certificates (
            husbandName, wifeName, recordNumber, recordDate,
            husbandNewSurname, wifeNewSurname, regPlace, givenTo,
            issueDate, headName, sealText, certNumber
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        const result = await runTursoQuery(sql, [
          formData.husbandName, formData.wifeName, formData.recordNumber, formData.recordDate,
          formData.husbandNewSurname, formData.wifeNewSurname, formData.regPlace, formData.givenTo,
          formData.issueDate, formData.headName, formData.sealText, formData.certNumber
        ]);
        if (result.lastInsertRowid) {
          document.getElementById("currentRecordId").value = result.lastInsertRowid;
        }
        showToast(`Successfully saved divorce record for ${formData.husbandName} & ${formData.wifeName} to database`);
      }
      loadHistoryFromTurso();
      return 'success';
    } catch (err) {
      console.error("Failed to save divorce record:", err);
      showToast("Database offline. Exporting document without saving.", "warning");
      return 'db_error';
    }
  } else if (currentMode === 'grading') {
    const tableContainer = document.getElementById('preview-g-tableContainer');
    const formData = {
      headerTitle: document.getElementById("gradingHeaderTitle").value.trim().toUpperCase(),
      institution: document.getElementById("gradingInstitution").value.trim().toUpperCase(),
      subtitle: document.getElementById("gradingSubtitle").value.trim(),
      studentName: document.getElementById("gradingStudentName").value.trim().toUpperCase(),
      studyYears: document.getElementById("gradingStudyYears").value.trim(),
      avgScore: document.getElementById("gradingAvgScore").value.trim(),
      percentage: document.getElementById("gradingPercentage").value.trim(),
      noteText: document.getElementById("gradingNoteText").value.trim(),
      officerTitle: document.getElementById("gradingOfficerTitle").value.trim(),
      officerName: document.getElementById("gradingOfficerName").value.trim(),
      issueDate: document.getElementById("gradingIssueDate").value.trim(),
      certNumber: document.getElementById("gradingCertNumber").value.trim(),
      sealText: document.getElementById("gradingSealText").value.trim(),
      presetType: currentGradingPreset,
      tableHtml: tableContainer ? tableContainer.innerHTML : ""
    };

    if (!recordIdToSave) {
      try {
        let checkSql = "";
        let checkParams = [];
        if (formData.certNumber) {
          checkSql = "SELECT id FROM grading_scales WHERE certNumber = ? LIMIT 1;";
          checkParams = [formData.certNumber];
        } else if (formData.studentName) {
          checkSql = "SELECT id FROM grading_scales WHERE studentName = ? LIMIT 1;";
          checkParams = [formData.studentName];
        }
        if (checkSql) {
          const checkRes = await runTursoQuery(checkSql, checkParams);
          if (checkRes.rows && checkRes.rows.length > 0) {
            recordIdToSave = checkRes.rows[0].id;
            document.getElementById("currentRecordId").value = recordIdToSave;
          }
        }
      } catch (checkErr) {
        console.error("Error checking for existing grading scale record:", checkErr);
      }
    }

    try {
      if (recordIdToSave) {
        const sql = `
          UPDATE grading_scales SET 
            headerTitle = ?, institution = ?, subtitle = ?, studentName = ?,
            studyYears = ?, avgScore = ?, percentage = ?, noteText = ?,
            officerTitle = ?, officerName = ?, issueDate = ?, certNumber = ?,
            sealText = ?, presetType = ?, tableHtml = ?
          WHERE id = ?;
        `;
        await runTursoQuery(sql, [
          formData.headerTitle, formData.institution, formData.subtitle, formData.studentName,
          formData.studyYears, formData.avgScore, formData.percentage, formData.noteText,
          formData.officerTitle, formData.officerName, formData.issueDate, formData.certNumber,
          formData.sealText, formData.presetType, formData.tableHtml, parseInt(recordIdToSave, 10)
        ]);
        showToast(`Successfully updated grading scale record`);
      } else {
        const sql = `
          INSERT INTO grading_scales (
            headerTitle, institution, subtitle, studentName,
            studyYears, avgScore, percentage, noteText,
            officerTitle, officerName, issueDate, certNumber,
            sealText, presetType, tableHtml
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        const result = await runTursoQuery(sql, [
          formData.headerTitle, formData.institution, formData.subtitle, formData.studentName,
          formData.studyYears, formData.avgScore, formData.percentage, formData.noteText,
          formData.officerTitle, formData.officerName, formData.issueDate, formData.certNumber,
          formData.sealText, formData.presetType, formData.tableHtml
        ]);
        if (result.lastInsertRowid) {
          document.getElementById("currentRecordId").value = result.lastInsertRowid;
        }
        showToast(`Successfully saved grading scale record to database`);
      }
      loadHistoryFromTurso();
      return 'success';
    } catch (err) {
      console.error("Failed to save grading scale record:", err);
      showToast("Database offline. Exporting document without saving.", "warning");
      return 'db_error';
    }
  }
}

// Load saved database history records
async function loadHistoryFromTurso() {
  const container = document.getElementById("records-list-container");
  if (!container) return;
  
  try {
    let table = 'birth_certificates';
    if (currentMode === 'marriage') table = 'marriage_certificates';
    if (currentMode === 'divorce') table = 'divorce_certificates';
    if (currentMode === 'grading') table = 'grading_scales';

    const result = await runTursoQuery(`SELECT * FROM ${table} ORDER BY id DESC;`);
    savedRecords = result.rows;
    renderHistoryList(savedRecords);
  } catch (err) {
    console.error("Failed to load database history:", err);
    container.innerHTML = `<div class="empty-history" style="color: var(--error);">Failed to load database records: ${err.message}</div>`;
  }
}

// Render historical lists in HTML
function renderHistoryList(records) {
  const container = document.getElementById("records-list-container");
  if (!container) return;
  
  if (records.length === 0) {
    container.innerHTML = '<div class="empty-history">No saved translation records found.</div>';
    return;
  }

  container.innerHTML = "";
  records.forEach(rec => {
    const card = document.createElement("div");
    card.className = "record-card";
    card.onclick = () => loadRecordIntoForm(rec.id);

    let titleText = "";
    let metaHTML = "";

    if (currentMode === 'birth') {
      titleText = rec.fullName;
      metaHTML = `
        <span><strong>DOB:</strong> ${rec.dob}</span>
        <span><strong>Entry:</strong> ${rec.entryNumber || 'N/A'}</span>
        <span><strong>ID:</strong> ${rec.idNumber || 'N/A'}</span>
      `;
    } else if (currentMode === 'marriage') {
      titleText = `${rec.husbandName} & ${rec.wifeName}`;
      metaHTML = `
        <span><strong>Married:</strong> ${rec.marriageDate}</span>
        <span><strong>Record:</strong> ${rec.recordNumber || 'N/A'}</span>
        <span><strong>Cert:</strong> ${rec.certNumber || 'N/A'}</span>
      `;
    } else if (currentMode === 'divorce') {
      titleText = `${rec.husbandName} & ${rec.wifeName}`;
      metaHTML = `
        <span><strong>Divorced:</strong> ${rec.recordDate}</span>
        <span><strong>Record:</strong> ${rec.recordNumber || 'N/A'}</span>
        <span><strong>Cert:</strong> ${rec.certNumber || 'N/A'}</span>
      `;
    } else {
      titleText = rec.studentName || rec.institution || rec.subtitle || 'Grading Scale';
      metaHTML = `
        <span><strong>Ref:</strong> ${rec.certNumber || 'N/A'}</span>
        <span><strong>Preset:</strong> ${rec.presetType === 'uwed' ? 'UWED Scale' : 'Progress Note'}</span>
      `;
    }

    card.innerHTML = `
      <div class="record-name">${titleText}</div>
      <div class="record-meta">
        ${metaHTML}
      </div>
      <div class="record-actions">
        <button class="record-btn" onclick="event.stopPropagation(); loadRecordIntoForm(${rec.id});" title="Load into editor">Edit</button>
        <button class="record-btn" onclick="event.stopPropagation(); quickExportWord(${rec.id});" title="Download Word file">Word</button>
        <button class="record-btn record-btn-delete" onclick="event.stopPropagation(); askDeleteRecord(${rec.id}, '${titleText.replace(/'/g, "\\'")}');" title="Delete record from database">Delete</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// Filter history on search
function filterHistory() {
  const query = document.getElementById("search-history").value.trim().toLowerCase();
  if (!query) {
    renderHistoryList(savedRecords);
    return;
  }
  
  let filtered = [];
  if (currentMode === 'birth') {
    filtered = savedRecords.filter(rec => 
      rec.fullName.toLowerCase().includes(query) || 
      rec.idNumber.toLowerCase().includes(query) ||
      rec.entryNumber.toLowerCase().includes(query) ||
      rec.dob.includes(query)
    );
  } else if (currentMode === 'marriage') {
    filtered = savedRecords.filter(rec => 
      rec.husbandName.toLowerCase().includes(query) || 
      rec.wifeName.toLowerCase().includes(query) ||
      rec.certNumber.toLowerCase().includes(query) ||
      rec.recordNumber.toLowerCase().includes(query) ||
      rec.marriageDate.includes(query)
    );
  } else if (currentMode === 'divorce') {
    filtered = savedRecords.filter(rec => 
      rec.husbandName.toLowerCase().includes(query) || 
      rec.wifeName.toLowerCase().includes(query) ||
      rec.certNumber.toLowerCase().includes(query) ||
      rec.recordNumber.toLowerCase().includes(query) ||
      rec.recordDate.includes(query)
    );
  } else {
    filtered = savedRecords.filter(rec => 
      (rec.studentName || '').toLowerCase().includes(query) || 
      (rec.institution || '').toLowerCase().includes(query) ||
      (rec.subtitle || '').toLowerCase().includes(query) ||
      (rec.certNumber || '').toLowerCase().includes(query)
    );
  }
  renderHistoryList(filtered);
}

// Load a database record details back into the active form
function loadRecordIntoForm(id) {
  const record = savedRecords.find(r => r.id === id);
  if (!record) return;

  document.getElementById("currentRecordId").value = record.id;
  
  let mapping;
  if (currentMode === 'birth') mapping = syncMapping;
  else if (currentMode === 'marriage') mapping = marriageSyncMapping;
  else if (currentMode === 'divorce') mapping = divorceSyncMapping;
  else mapping = gradingSyncMapping;

  if (currentMode === 'grading') {
    if (record.presetType) currentGradingPreset = record.presetType;
    if (record.tableHtml) {
      const container = document.getElementById('preview-g-tableContainer');
      if (container) container.innerHTML = record.tableHtml;
    }
    const studentBlock = document.getElementById('preview-g-studentProgressBlock');
    if (studentBlock) {
      studentBlock.style.display = (record.presetType === 'progress_note' || record.studentName) ? 'block' : 'none';
    }
  }

  // Populate fields
  Object.keys(mapping).forEach(key => {
    const inputId = mapping[key].inputId || key;
    const input = document.getElementById(inputId);
    if (input) {
      input.value = record[key] || "";
      
      // Re-trigger live formatting and preview syncing
      updatePreviewFieldForced(currentMode, key, input.value);
      if (typeof validateField === 'function') validateField(key, input.value);
    }
  });
  
  switchTab('form');
  const displayName = record.studentName || record.fullName || `${record.husbandName || ''} & ${record.wifeName || ''}` || 'Record';
  showToast(`Loaded details for ${displayName}`);
}

// Action dialog to delete record
function askDeleteRecord(id, name) {
  openConfirmModal(
    "Delete Record?",
    `Are you sure you want to permanently delete the record of "${name}" from Turso database?`,
    "Delete Permanent",
    () => deleteRecordFromDb(id, name)
  );
}

// SQL query to remove record
async function deleteRecordFromDb(id, name) {
  try {
    let table = 'birth_certificates';
    if (currentMode === 'marriage') table = 'marriage_certificates';
    if (currentMode === 'divorce') table = 'divorce_certificates';
    if (currentMode === 'grading') table = 'grading_scales';

    await runTursoQuery(`DELETE FROM ${table} WHERE id = ?;`, [id]);
    showToast(`Deleted record for ${name}`);
    
    // Reset current record ID if we deleted the currently edited one
    const currentIdVal = document.getElementById("currentRecordId").value;
    if (currentIdVal && parseInt(currentIdVal, 10) === id) {
      document.getElementById("currentRecordId").value = "";
      clearForm();
    }
    
    loadHistoryFromTurso();
  } catch (err) {
    console.error("Failed to delete record:", err);
    showToast(`Delete failed: ${err.message}`, "error");
  }
}


// ==========================================================================
// 4. EXPORT UTILITIES (WORD & PDF & PRINT)
// ==========================================================================

// Native Microsoft Word Export helper
function getWordDocumentHtml(element) {
  // Clone preview structure for export
  const clone = element.cloneNode(true);
  
  // Remove inactive sheets if they exist in this clone to prevent exporting all tabs
  ['birth', 'marriage', 'divorce', 'grading'].forEach(mode => {
    if (typeof currentMode !== 'undefined' && mode !== currentMode) {
      const sheet = clone.querySelector(`#preview-${mode}-sheet`);
      if (sheet) sheet.remove();
    }
  });

  // Remove any placeholders
  clone.querySelectorAll('.placeholder-text').forEach(el => {
    el.textContent = '_____________________';
    el.style.color = '#000000';
  });

  // Remove contenteditable to prevent Word from applying weird styles
  clone.querySelectorAll('[contenteditable]').forEach(el => {
    el.removeAttribute('contenteditable');
    el.removeAttribute('spellcheck');
    el.style.outline = '';
  });

  const bodyHtml = clone.innerHTML;

  return `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <title>Certificate Translation</title>
      ${'<!--'}[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]${'-->'}
      <style>
        @page {
          size: A4 portrait;
          margin: 0.5cm 1.5cm 0.5cm 1.5cm;
        }
        body { 
          font-family: 'Times New Roman', Times, serif; 
          font-size: 11pt; 
          line-height: 1.4; 
          color: #000000;
        }
        .translation-header {
          text-align: right;
          font-size: 10pt;
          font-style: italic;
          margin-bottom: 10px;
          text-transform: uppercase;
          font-weight: bold;
          border-bottom: 1px solid #111;
          padding-bottom: 4px;
        }
        .doc-title-container {
          text-align: center;
          margin-bottom: 15px;
        }
        .doc-country {
          font-size: 12pt;
          font-weight: bold;
          margin-bottom: 4px;
        }
        .doc-title {
          font-size: 13pt;
          font-weight: bold;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
        }
        .grading-scale-table th, .grading-scale-table td {
          border: 1px solid #000;
          padding: 4px 5px;
          text-align: center;
          font-size: 9pt;
        }
        td {
          padding: 3px 0;
          vertical-align: top;
        }
        .label {
          width: 35%;
          font-weight: bold;
        }
        .value {
          width: 65%;
          border-bottom: 1px solid #000000;
        }
        .font-bold {
          font-weight: bold;
        }
        .uppercase {
          text-transform: uppercase;
        }
        .sub-grid {
          margin-top: 2px;
        }
        .sub-grid-item {
          margin-bottom: 4px;
        }
        .registry-sentence {
          margin: 14px 0;
          text-align: left;
          text-indent: 0.5in;
          line-height: 1.6;
          font-size: 11pt;
        }
        .registry-sentence span {
          border-bottom: 1px solid #000000;
        }
        .section-title {
          font-weight: bold;
          font-size: 12pt;
          margin-top: 10px;
          margin-bottom: 8px;
          border-bottom: 1px solid #333;
          padding-bottom: 2px;
        }
        .signature-section {
          margin-top: 25px;
          clear: both;
        }
        .signature-officer {
          float: left;
          width: 45%;
          font-weight: bold;
        }
        .signature-signed {
          float: left;
          width: 20%;
          text-align: center;
          font-style: italic;
        }
        .signature-name {
          float: right;
          width: 35%;
          text-align: right;
          font-weight: bold;
          border-bottom: 1px solid #000000;
        }
        .footer-section {
          margin-top: 20px;
          clear: both;
        }
        .official-seal {
          float: left;
          width: 45%;
          font-size: 8pt;
        }
        .id-number-section {
          float: right;
          width: 35%;
          text-align: center;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      ${bodyHtml}
    </body>
    </html>
  `;
}

// Export current editor preview to Word Document file (.doc)
async function exportWord() {
  const saveResult = await saveToDatabase();
  if (saveResult === 'validation_failed') return;

  const element = document.getElementById('certificate-preview');
  const htmlString = getWordDocumentHtml(element);
  
  const blob = new Blob(['\ufeff' + htmlString], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  
  let name = "";
  let filename = "";
  if (currentMode === 'birth') {
    name = document.getElementById('fullName').value.trim() || 'Birth';
    filename = `${name.replace(/\s+/g, '_')}_BirthCertificate_Translation.doc`;
  } else if (currentMode === 'marriage') {
    const hName = document.getElementById('husbandName').value.trim() || 'Husband';
    const wName = document.getElementById('wifeName').value.trim() || 'Wife';
    name = `${hName}_${wName}`;
    filename = `${name.replace(/\s+/g, '_')}_MarriageCertificate_Translation.doc`;
  } else if (currentMode === 'divorce') {
    const hName = document.getElementById('divorceHusbandName').value.trim() || 'Husband';
    const wName = document.getElementById('divorceWifeName').value.trim() || 'Wife';
    name = `${hName}_${wName}`;
    filename = `${name.replace(/\s+/g, '_')}_DivorceCertificate_Translation.doc`;
  } else {
    name = document.getElementById('gradingStudentName').value.trim() || 'GradingScale';
    filename = `${name.replace(/\s+/g, '_')}_GradingScale_Translation.doc`;
  }
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast("Downloaded Word translation document (.doc)");
}

// Helper to download arbitrary record history values as Word file
function quickExportWord(id) {
  const record = savedRecords.find(r => r.id === id);
  if (!record) return;
  
  if (currentMode === 'birth') {
    const tempDiv = document.createElement('div');
    tempDiv.style.display = 'none';
    document.body.appendChild(tempDiv);
    
    tempDiv.innerHTML = `
      <div id="temp-cert-preview">
        <div class="translation-header">Translated from Uzbek</div>
        <div class="doc-title-container">
          <div class="doc-country">REPUBLIC OF UZBEKISTAN</div>
          <div class="doc-title">BIRTH CERTIFICATE</div>
        </div>
        <table class="certificate-table">
          <tr><td class="label">Citizen:</td><td class="value font-bold uppercase">${record.fullName}</td></tr>
          <tr><td class="label">Born on:</td><td class="value">${formatDate(record.dob)}</td></tr>
          <tr><td class="label">(in words):</td><td class="value">${getWrittenYear(record.dob)}</td></tr>
          <tr>
            <td class="label">Birth Place:</td>
            <td class="value">
              <div class="sub-grid">
                <div class="sub-grid-item"><strong>State:</strong> <span>Uzbekistan</span></div>
                <div class="sub-grid-item"><strong>Region of:</strong> <span>${record.region}</span></div>
                <div class="sub-grid-item"><strong>City of, village:</strong> <span>${record.city}</span></div>
              </div>
            </td>
          </tr>
        </table>
        <div class="registry-sentence">
          in certification of this, entry No <span>${record.entryNumber || '_____'}</span> was made into the Birth Registry on <span>${formatDate(record.registryDate) || '__________'}</span> year.
        </div>
        <div class="section-title">Parents:</div>
        <table class="parents-table">
          <tr><td class="label">Father:</td><td class="value font-bold uppercase">${record.fatherName}</td></tr>
          <tr><td class="label">Nationality:</td><td class="value">${record.fatherNationality}</td></tr>
          <tr><td class="label">Mother:</td><td class="value font-bold uppercase">${record.motherName}</td></tr>
          <tr><td class="label">Nationality:</td><td class="value">${record.motherNationality}</td></tr>
        </table>
        <div class="section-title">REGISTRATION OFFICE & DETAILS</div>
        <table class="registry-office-table">
          <tr><td class="label">Registration Place:</td><td class="value">Civil registry office of ${record.regCity} district</td></tr>
          <tr><td class="label">Date of issue:</td><td class="value">${formatDate(record.issueDate)}</td></tr>
        </table>
        <div class="signature-section">
          <div class="signature-officer">Head of the Civil Registry Office</div>
          <div class="signature-signed">(signed)</div>
          <div class="signature-name">${record.headName}</div>
        </div>
        <div class="footer-section">
          <div class="official-seal"><strong>Official Seal</strong></div>
          <div class="id-number-section">${record.idNumber}</div>
          <div class="footer-spacer"></div>
        </div>
      </div>
    `;

    const htmlString = getWordDocumentHtml(tempDiv.querySelector('#temp-cert-preview'));
    const blob = new Blob(['\ufeff' + htmlString], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${record.fullName.replace(/\s+/g, '_')}_BirthCertificate_Translation.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    tempDiv.remove();
    showToast(`Exported ${record.fullName} to Word`);
  } else if (currentMode === 'marriage') {
    // Marriage quick export
    const tempDiv = document.createElement('div');
    tempDiv.style.display = 'none';
    document.body.appendChild(tempDiv);
    
    const regFormatted = record.regPlace.toLowerCase().startsWith('civil') ? record.regPlace : `Civil registry office of ${record.regPlace}`;

    tempDiv.innerHTML = `
      <div id="temp-cert-preview">
        <div class="translation-header">Translated from Uzbek into English</div>
        <div class="doc-title-container">
          <div class="doc-title" style="text-align: center; font-size: 14pt; font-weight: bold; margin-top: 30px; margin-bottom: 20px;">MARRIAGE CERTIFICATE</div>
        </div>
        <table class="certificate-table" style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <tr><td class="label" style="width: 35%; font-weight: bold;">Citizen:</td><td class="value font-bold uppercase" style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000;">${record.husbandName}</td></tr>
          <tr><td class="label" style="font-weight: bold;">was born:</td><td class="value" style="border-bottom: 1px solid #000;">${formatDate(record.husbandDob)}</td></tr>
          <tr><td class="label" style="font-weight: bold;">Birth Place:</td><td class="value" style="border-bottom: 1px solid #000;">${record.husbandBirthPlace}</td></tr>
          <tr><td class="label" style="font-weight: bold;">Citizenship:</td><td class="value font-bold uppercase" style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000;">${record.husbandCitizenship}</td></tr>
        </table>
        <table class="certificate-table" style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <tr><td class="label" style="width: 35%; font-weight: bold;">Citizen:</td><td class="value font-bold uppercase" style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000;">${record.wifeName}</td></tr>
          <tr><td class="label" style="font-weight: bold;">was born:</td><td class="value" style="border-bottom: 1px solid #000;">${formatDate(record.wifeDob)}</td></tr>
          <tr><td class="label" style="font-weight: bold;">Birth Place:</td><td class="value" style="border-bottom: 1px solid #000;">${record.wifeBirthPlace}</td></tr>
          <tr><td class="label" style="font-weight: bold;">Citizenship:</td><td class="value font-bold uppercase" style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000;">${record.wifeCitizenship}</td></tr>
        </table>
        <div class="registry-sentence" style="margin: 24px 0; text-indent: 0.5in; text-align: left; font-size: 11pt; line-height: 1.6;">
          were married on <span style="border-bottom: 1px solid #000;">${formatDate(record.marriageDate)}</span> (<span style="border-bottom: 1px solid #000;">${record.marriageDateWords}</span>)
        </div>
        <div class="registry-sentence" style="margin: 24px 0; text-align: left; font-size: 11pt; line-height: 1.6;">
          Marriage record № <span style="border-bottom: 1px solid #000;">${record.recordNumber}</span> was filed on <span style="border-bottom: 1px solid #000;">${formatDate(record.recordDate)}</span>.
        </div>
        <div class="registry-sentence" style="margin: 24px 0; font-weight: bold; text-align: left; font-size: 11pt; line-height: 1.6;">
          In the marriage the following surnames were given to:
        </div>
        <table class="parents-table" style="width: 100%; border-collapse: collapse; margin-top: 5px;">
          <tr><td class="label" style="width: 35%; font-weight: bold;">Husband:</td><td class="value font-bold uppercase" style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000;">${record.husbandNewSurname}</td></tr>
          <tr><td class="label" style="font-weight: bold;">Wife:</td><td class="value font-bold uppercase" style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000;">${record.wifeNewSurname}</td></tr>
        </table>
        <table class="registry-office-table" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr><td class="label" style="width: 35%; font-weight: bold;">Place of registration:</td><td class="value" style="border-bottom: 1px solid #000;">${regFormatted}</td></tr>
          <tr><td class="label" style="font-weight: bold;">Date of issue:</td><td class="value" style="border-bottom: 1px solid #000;">${formatDate(record.issueDate)}</td></tr>
        </table>
        <div class="signature-section" style="margin-top: 40px; clear: both;">
          <div class="signature-officer" style="float: left; width: 45%; font-weight: bold;">Chairman of the Civil Registry Office</div>
          <div class="signature-signed" style="float: left; width: 20%; text-align: center; font-style: italic;">(signed)</div>
          <div class="signature-name" style="float: right; width: 35%; text-align: right; font-weight: bold; border-bottom: 1px solid #000000;">${record.chairmanName}</div>
        </div>
        <div class="footer-section" style="margin-top: 30px; clear: both;">
          <div class="official-seal" style="float: left; width: 35%; font-weight: bold;">Official Seal:</div>
          <div class="id-number-section" style="float: left; width: 30%; text-align: center; font-weight: bold; border: none;">${record.certNumber}</div>
          <div class="footer-spacer" style="float: right; width: 35%;"></div>
        </div>
      </div>
    `;

    const htmlString = getWordDocumentHtml(tempDiv.querySelector('#temp-cert-preview'));
    const blob = new Blob(['\ufeff' + htmlString], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = `${record.husbandName.replace(/\s+/g, '_')}_${record.wifeName.replace(/\s+/g, '_')}`;
    a.download = `${name}_MarriageCertificate_Translation.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    tempDiv.remove();
    showToast(`Exported ${record.husbandName} & ${record.wifeName} to Word`);
  } else {
    // Divorce quick export
    const tempDiv = document.createElement('div');
    tempDiv.style.display = 'none';
    document.body.appendChild(tempDiv);

    tempDiv.innerHTML = `
      <div id="temp-cert-preview">
        <div class="translation-header">Translated from Uzbek into English</div>
        <div style="text-align: center; font-size: 10pt; font-weight: bold; margin-top: 15px; text-transform: uppercase;">-STATE EMBLEM OF THE REPUBLIC OF UZBEKISTAN-</div>
        <div class="doc-title-container" style="margin-top: 20px; margin-bottom: 25px;">
          <div class="doc-title" style="text-align: center; font-size: 14pt; font-weight: bold;">DIVORCE CERTIFICATE</div>
        </div>

        <table class="certificate-table" style="width: 100%; border-collapse: collapse; margin-bottom: 5px;">
          <tr>
            <td class="label" style="width: 25%; font-weight: bold;">Citizen:</td>
            <td class="value font-bold uppercase" style="font-weight: bold; text-transform: uppercase; text-align: center; border-bottom: 1px solid #000;">${record.husbandName}</td>
          </tr>
          <tr>
            <td></td>
            <td style="font-size: 9pt; text-align: center; padding-top: 2px;">(Full name)</td>
          </tr>
        </table>

        <table class="certificate-table" style="width: 100%; border-collapse: collapse; margin-top: 5px; margin-bottom: 5px;">
          <tr>
            <td class="label" style="width: 25%; font-weight: bold;">and citizen:</td>
            <td class="value font-bold uppercase" style="font-weight: bold; text-transform: uppercase; text-align: center; border-bottom: 1px solid #000;">${record.wifeName}</td>
          </tr>
          <tr>
            <td></td>
            <td style="font-size: 9pt; text-align: center; padding-top: 2px;">(Full name)</td>
          </tr>
        </table>

        <div class="registry-sentence" style="margin: 15px 0; text-align: left;">are dissolved their marriage.</div>
        <div class="registry-sentence" style="margin: 15px 0; font-weight: bold; text-align: left;">
          Record № <span style="border-bottom: 1px solid #000;">${record.recordNumber}</span> was filed on <span style="border-bottom: 1px solid #000;">${formatDate(record.recordDate)}</span>,
        </div>
        <div class="registry-sentence" style="margin: 20px 0; font-weight: bold; text-align: left;">Following surnames were given after the marriage dissolution:</div>

        <table class="parents-table" style="width: 100%; border-collapse: collapse; margin-top: 5px;">
          <tr><td class="label" style="width: 25%; font-weight: bold;">Husband:</td><td class="value font-bold uppercase" style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000;">${record.husbandNewSurname}</td></tr>
          <tr><td class="label" style="font-weight: bold;">Wife:</td><td class="value font-bold uppercase" style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000;">${record.wifeNewSurname}</td></tr>
        </table>

        <table class="registry-office-table" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr><td class="label" style="width: 35%; font-weight: bold;">Registration Place:</td><td class="value" style="font-style: italic; border-bottom: 1px solid #000;">${record.regPlace}</td></tr>
          <tr><td class="label" style="font-weight: bold;">The certificate is given to:</td><td class="value font-bold uppercase" style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000;">${record.givenTo}</td></tr>
          <tr><td class="label" style="font-weight: bold;">Date of issue:</td><td class="value" style="font-style: italic; border-bottom: 1px solid #000;">${formatDate(record.issueDate)}</td></tr>
        </table>

        <div class="signature-section" style="margin-top: 40px; clear: both;">
          <div class="signature-officer" style="float: left; width: 45%; font-weight: bold;">Head of the Civil Registry office</div>
          <div class="signature-signed" style="float: left; width: 20%; text-align: center; font-style: italic;">(signed)</div>
          <div class="signature-name" style="float: right; width: 35%; text-align: right; font-weight: bold; border-bottom: 1px solid #000000;">${record.headName}</div>
        </div>

        <div class="footer-section" style="margin-top: 30px; clear: both;">
          <div class="official-seal" style="float: left; width: 45%; font-size: 8pt; font-style: italic; font-weight: normal; white-space: pre-line;">${record.sealText}</div>
          <div class="id-number-section" style="float: left; width: 35%; text-align: center; font-weight: bold; border: none; font-size: 11pt;">${record.certNumber}</div>
          <div class="footer-spacer" style="float: right; width: 20%;"></div>
        </div>
      </div>
    `;

    const htmlString = getWordDocumentHtml(tempDiv.querySelector('#temp-cert-preview'));
    const blob = new Blob(['\ufeff' + htmlString], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = `${record.husbandName.replace(/\s+/g, '_')}_${record.wifeName.replace(/\s+/g, '_')}`;
    a.download = `${name}_DivorceCertificate_Translation.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    tempDiv.remove();
    showToast(`Exported ${record.husbandName} & ${record.wifeName} to Word`);
  }
}

// Export current editor preview page to PDF format using html2pdf.js
async function exportPDF() {
  const saveResult = await saveToDatabase();
  if (saveResult === 'validation_failed') return;

  const element = document.getElementById('certificate-preview');
  element.classList.add('pdf-exporting');

  // Temporarily isolate the active sheet by removing inactive sheets from the DOM
  const hiddenElements = [];
  ['birth', 'marriage', 'divorce', 'grading'].forEach(mode => {
    if (mode !== currentMode) {
      const el = document.getElementById(`preview-${mode}-sheet`);
      if (el && el.parentNode) {
        hiddenElements.push({ el, next: el.nextSibling, parent: el.parentNode });
        el.parentNode.removeChild(el);
      }
    }
  });

  let name = "";
  let filename = "";
  if (currentMode === 'birth') {
    name = document.getElementById('fullName').value.trim() || 'Birth';
    filename = `${name.replace(/\s+/g, '_')}_BirthCertificate_Translation.pdf`;
  } else if (currentMode === 'marriage') {
    const hName = document.getElementById('husbandName').value.trim() || 'Husband';
    const wName = document.getElementById('wifeName').value.trim() || 'Wife';
    name = `${hName}_${wName}`;
    filename = `${name.replace(/\s+/g, '_')}_MarriageCertificate_Translation.pdf`;
  } else if (currentMode === 'divorce') {
    const hName = document.getElementById('divorceHusbandName').value.trim() || 'Husband';
    const wName = document.getElementById('divorceWifeName').value.trim() || 'Wife';
    name = `${hName}_${wName}`;
    filename = `${name.replace(/\s+/g, '_')}_DivorceCertificate_Translation.pdf`;
  } else {
    name = document.getElementById('gradingStudentName').value.trim() || 'GradingScale';
    filename = `${name.replace(/\s+/g, '_')}_GradingScale_Translation.pdf`;
  }
  
  const opt = {
    margin:       0,
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2.5, useCORS: true, logging: false },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    showToast("Generating PDF download...");
    await html2pdf().set(opt).from(element).save();
    showToast("Downloaded PDF Document");
  } catch (err) {
    console.error("PDF generation failed:", err);
    showToast("Failed to generate PDF.", "error");
  } finally {
    element.classList.remove('pdf-exporting');
    
    // Restore hidden elements
    hiddenElements.forEach(item => {
      item.parent.insertBefore(item.el, item.next);
    });
  }
}

// Print current document preview with auto-save
async function printDocument() {
  const saveResult = await saveToDatabase();
  if (saveResult === 'validation_failed') return;
  
  window.print();
}

// Clear all inputs and restore placeholders
function clearForm() {
  const form = document.getElementById("certificateForm");
  if (form) {
    form.reset();
  }
  document.getElementById("currentRecordId").value = "";
  
  // Reset preview fields to placeholders for birth mode
  const birthFields = ['fullName', 'dob', 'region', 'city', 'entryNumber', 'registryDate', 'fatherName', 'fatherNationality', 'motherName', 'motherNationality', 'regCity', 'issueDate', 'headName', 'idNumber'];
  birthFields.forEach(key => {
    const mapping = syncMapping[key] || {};
    const inputId = mapping.inputId || key;
    const input = document.getElementById(inputId);
    updatePreviewFieldForced('birth', key, input ? input.value : "");
    const errEl = document.getElementById(`${inputId}Error`);
    if (errEl) errEl.style.display = 'none';
  });

  // Reset preview fields to placeholders for marriage mode
  const marriageFields = ['husbandName', 'husbandDob', 'husbandBirthPlace', 'husbandCitizenship', 'wifeName', 'wifeDob', 'wifeBirthPlace', 'wifeCitizenship', 'marriageDate', 'marriageDateWords', 'recordNumber', 'recordDate', 'husbandNewSurname', 'wifeNewSurname', 'regPlace', 'issueDate', 'chairmanName', 'certNumber'];
  marriageFields.forEach(key => {
    const mapping = marriageSyncMapping[key] || {};
    const inputId = mapping.inputId || key;
    const input = document.getElementById(inputId);
    updatePreviewFieldForced('marriage', key, input ? input.value : "");
    const errEl = document.getElementById(`${inputId}Error`);
    if (errEl) errEl.style.display = 'none';
  });

  // Reset preview fields to placeholders for divorce mode
  const divorceFields = ['husbandName', 'wifeName', 'recordNumber', 'recordDate', 'husbandNewSurname', 'wifeNewSurname', 'regPlace', 'givenTo', 'issueDate', 'headName', 'sealText', 'certNumber'];
  divorceFields.forEach(key => {
    const mapping = divorceSyncMapping[key] || {};
    const inputId = mapping.inputId || key;
    const input = document.getElementById(inputId);
    updatePreviewFieldForced('divorce', key, input ? input.value : "");
    const errEl = document.getElementById(`${inputId}Error`);
    if (errEl) errEl.style.display = 'none';
  });

  // Reset preview fields to placeholders for grading mode
  const gradingFields = ['headerTitle', 'institution', 'subtitle', 'studentName', 'studyYears', 'avgScore', 'maxScore', 'percentage', 'maxPercentage', 'noteText', 'officerTitle', 'officerName', 'issueDate'];
  gradingFields.forEach(key => {
    const mapping = gradingSyncMapping[key] || {};
    const inputId = mapping.inputId || key;
    const input = document.getElementById(inputId);
    updatePreviewFieldForced('grading', key, input ? input.value : "");
  });

  if (currentMode === 'grading') {
    initGradingTable();
  }
  
  showToast("Form cleared.");
}


// Setup Autocomplete suggestions from database history
function initAutocomplete() {
  const fields = ['region', 'city', 'regCity', 'headName', 'husbandBirthPlace', 'wifeBirthPlace', 'regPlace', 'chairmanName', 'divorceRegPlace', 'divorceHeadName', 'gradingHeaderTitle'];

  fields.forEach(fieldId => {
    const input = document.getElementById(fieldId);
    if (!input) return;

    // Create suggestions container dynamically
    let suggestionsContainer = document.getElementById(`suggestions-${fieldId}`);
    if (!suggestionsContainer) {
      suggestionsContainer = document.createElement('div');
      suggestionsContainer.className = 'autocomplete-suggestions';
      suggestionsContainer.id = `suggestions-${fieldId}`;
      input.parentNode.appendChild(suggestionsContainer);
    }

    const showSuggestions = () => {
      const typedVal = input.value.trim().toLowerCase();
      
      let defaultVals = [];
      if (fieldId === 'region') {
        defaultVals = ['Andijan', 'Bukhara', 'Fergana', 'Jizzakh', 'Khorezm', 'Namangan', 'Navoi', 'Samarkand', 'Sirdaryo', 'Surxondaryo', 'Tashkent', 'Karakalpakstan', 'Kashkadaryo'];
      } else if (fieldId === 'gradingHeaderTitle') {
        defaultVals = [
          'MINISTRY OF PRESCHOOL AND SCHOOL EDUCATION OF THE REPUBLIC OF UZBEKISTAN',
          'MINISTRY OF CULTURE OF THE REPUBLIC OF UZBEKISTAN',
          'MINISTRY OF HIGHER EDUCATION, SCIENCE AND INNOVATION OF THE REPUBLIC OF UZBEKISTAN'
        ];
      }
      
      const allVals = [
        ...defaultVals,
        ...savedRecords.map(r => r[fieldId] || '')
      ]
        .map(v => v.trim())
        .filter(v => v !== '');
      
      const uniqueVals = [...new Set(allVals)];
      const matches = uniqueVals.filter(v => 
        v.toLowerCase().includes(typedVal)
      );

      if (matches.length > 0) {
        suggestionsContainer.innerHTML = '';
        matches.forEach(match => {
          const div = document.createElement('div');
          div.className = 'autocomplete-suggestion';
          div.textContent = match;
          div.addEventListener('click', () => {
            input.value = match;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            suggestionsContainer.style.display = 'none';
          });
          suggestionsContainer.appendChild(div);
        });
        suggestionsContainer.style.display = 'block';
      } else {
        suggestionsContainer.style.display = 'none';
      }
    };

    input.addEventListener('focus', showSuggestions);
    input.addEventListener('input', showSuggestions);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-field-wrapper')) {
      document.querySelectorAll('.autocomplete-suggestions').forEach(el => {
        el.style.display = 'none';
      });
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initializeDatabase();
  initAutocomplete();
  initReactivity();

  // Force initial synchronization of any pre-filled default values (e.g. 'Uzbek')
  // to the paper preview right on page load.
  setTimeout(() => {
    if (currentMode === 'birth') {
      Object.keys(syncMapping).forEach(key => {
        const inputId = syncMapping[key].inputId || key;
        const input = document.getElementById(inputId);
        if (input && input.value) {
          updatePreviewFieldForced('birth', key, input.value);
        }
      });
    }
  }, 50);
});