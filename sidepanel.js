"use strict";

const {
  MESSAGE_TYPES,
  UNSUPPORTED_MESSAGE,
  isSchoolUrl
} = globalThis.ProgrammersAiUtils;

const ui = {
  support: document.querySelector("#support-value"),
  language: document.querySelector("#language-value"),
  title: document.querySelector("#title-value"),
  problemLength: document.querySelector("#problem-length-value"),
  codeLength: document.querySelector("#code-length-value"),
  codeMirror: document.querySelector("#codemirror-value"),
  executionError: document.querySelector("#execution-error-value"),
  runButton: document.querySelector("#run-button-value"),
  submitButton: document.querySelector("#submit-button-value"),
  status: document.querySelector("#status-message"),
  refresh: document.querySelector("#refresh-button"),
  promptButtons: [...document.querySelectorAll(".prompt-button")],
  preview: document.querySelector("#prompt-preview"),
  previewCount: document.querySelector("#preview-count"),
  clearPreview: document.querySelector("#clear-preview-button"),
  copyPrompt: document.querySelector("#copy-prompt-button"),
  openChatGpt: document.querySelector("#open-chatgpt-button"),
  insertCode: document.querySelector("#insert-code-button"),
  restoreCode: document.querySelector("#restore-code-button"),
  backupInfo: document.querySelector("#backup-info"),
  copyDebug: document.querySelector("#copy-debug-button")
};

class UiError extends Error {
  constructor(message, details = "") {
    super(message);
    this.name = "UiError";
    this.details = details;
  }
}

let pageData = null;
let diagnostics = null;
let busy = false;
let featureEnabled = false;
let executionErrorDetected = false;

function setStatus(message, type = "info") {
  ui.status.textContent = message;
  ui.status.className = `status visible ${type}`;
}

function showError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const details = error?.details ? `\n${error.details}` : "";
  setStatus(`${message}${details}`, "error");
}

function setBooleanValue(element, value, yes = "탐지됨", no = "탐지 안 됨") {
  element.textContent = value ? yes : no;
  element.className = value ? "value-ok" : "value-bad";
}

function updateActionAvailability() {
  for (const button of ui.promptButtons) {
    const needsExecutionError = button.dataset.promptType === "error";
    button.disabled = busy || !featureEnabled || (needsExecutionError && !executionErrorDetected);
    button.title = needsExecutionError && !executionErrorDetected
      ? "실행 결과에서 오류 또는 실패가 탐지된 경우에만 사용할 수 있습니다."
      : "";
  }
  ui.insertCode.disabled = busy || !featureEnabled;
  ui.restoreCode.disabled = busy || !featureEnabled;
}

function setFeatureEnabled(enabled) {
  featureEnabled = enabled;
  updateActionAvailability();
}

function setBusy(nextBusy) {
  busy = nextBusy;
  for (const button of [
    ui.refresh,
    ...ui.promptButtons,
    ui.clearPreview,
    ui.copyPrompt,
    ui.openChatGpt,
    ui.insertCode,
    ui.restoreCode,
    ui.copyDebug
  ]) {
    button.disabled = nextBusy;
  }
  if (!nextBusy) {
    updateActionAvailability();
    ui.copyPrompt.disabled = !ui.preview.value.trim();
  }
}

function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new UiError("현재 탭을 확인하지 못했습니다.", chrome.runtime.lastError.message));
        return;
      }
      const tab = tabs[0];
      if (!tab?.id) {
        reject(new UiError("현재 탭을 찾지 못했습니다."));
        return;
      }
      resolve(tab);
    });
  });
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(
          new UiError("확장 프로그램 background와 통신하지 못했습니다.", chrome.runtime.lastError.message)
        );
        return;
      }
      if (!response?.success) {
        reject(new UiError(response?.error || "요청 처리 중 오류가 발생했습니다.", response?.details || ""));
        return;
      }
      resolve(response.data);
    });
  });
}

async function requestForActiveTab(type, payload = {}) {
  const tab = await getActiveTab();
  return sendRuntimeMessage({ type, tabId: tab.id, ...payload });
}

function isPython3(language) {
  return String(language || "").replace(/\s+/g, "").toLowerCase().includes("python3");
}

function formatBackup(backup) {
  if (!backup?.count) {
    return "현재 URL에 저장된 코드 백업이 없습니다.";
  }
  const latestDate = new Date(backup.latest.createdAt);
  const formattedDate = Number.isNaN(latestDate.getTime())
    ? backup.latest.createdAt
    : latestDate.toLocaleString("ko-KR");
  return `현재 URL 백업 ${backup.count}/5개 · 최근 ${formattedDate} · ${backup.latest.codeLength}자`;
}

function updateDiagnostics(data) {
  diagnostics = data;
  const supported = Boolean(data.supportedPage);
  setBooleanValue(ui.support, supported, "일반 연습문제", "지원하지 않음");
  ui.language.textContent = data.languageText || "언어를 찾지 못함";
  ui.title.textContent = data.title || "제목을 찾지 못함";
  ui.problemLength.textContent = `${Number(data.problemTextLength || 0).toLocaleString("ko-KR")}자`;
  ui.codeLength.textContent = `${Number(data.codeLength || 0).toLocaleString("ko-KR")}자`;
  setBooleanValue(
    ui.codeMirror,
    data.codeMirrorElementFound && data.codeMirrorInstanceFound,
    "CodeMirror 5 인스턴스 탐지",
    data.codeMirrorElementFound ? "DOM만 탐지" : "탐지 안 됨"
  );
  executionErrorDetected = Boolean(data.executionErrorDetected);
  if (executionErrorDetected) {
    ui.executionError.textContent = `탐지됨 (${(data.executionErrorSignals || []).join(", ")})`;
    ui.executionError.className = "value-bad";
  } else if (data.resultFound) {
    ui.executionError.textContent = "오류 신호 없음";
    ui.executionError.className = "value-ok";
  } else {
    ui.executionError.textContent = "실행 결과 없음";
    ui.executionError.className = "";
  }
  setBooleanValue(ui.runButton, data.runButtonFound);
  setBooleanValue(ui.submitButton, data.submitButtonFound);

  const python3 = isPython3(data.languageText);
  setFeatureEnabled(supported && python3);
  if (!supported) {
    setStatus(UNSUPPORTED_MESSAGE, "error");
  } else if (!python3) {
    setStatus("현재 언어가 Python3가 아닙니다. Python3를 선택한 뒤 새로고침하세요.", "warning");
  } else if (data.errors?.length) {
    setStatus(`진단 경고:\n- ${data.errors.join("\n- ")}`, "warning");
  }
}

function updatePageData(data) {
  pageData = data;
  ui.title.textContent = data.title;
  ui.language.textContent = data.language;
  ui.problemLength.textContent = `${data.problemTextLength.toLocaleString("ko-KR")}자`;
  ui.codeLength.textContent = `${data.codeLength.toLocaleString("ko-KR")}자`;
  setBooleanValue(
    ui.codeMirror,
    data.codeMirrorFound && data.codeMirrorInstanceFound,
    "CodeMirror 5 인스턴스 탐지",
    data.codeMirrorFound ? "DOM만 탐지" : "탐지 안 됨"
  );
  executionErrorDetected = Boolean(data.executionErrorDetected);
  if (executionErrorDetected) {
    ui.executionError.textContent = `탐지됨 (${(data.executionErrorSignals || []).join(", ")})`;
    ui.executionError.className = "value-bad";
  } else if (data.executionResultFound) {
    ui.executionError.textContent = "오류 신호 없음";
    ui.executionError.className = "value-ok";
  } else {
    ui.executionError.textContent = "실행 결과 없음";
    ui.executionError.className = "";
  }
  setBooleanValue(ui.runButton, data.runButtonFound);
  setBooleanValue(ui.submitButton, data.submitButtonFound);
  ui.backupInfo.textContent = formatBackup(data.backup);

  const python3 = isPython3(data.language);
  setFeatureEnabled(python3);
  if (!data.codeMirrorInstanceFound && data.editorError) {
    setStatus(data.editorError, "warning");
  }
}

async function loadCurrentInformation({ announce = false } = {}) {
  const tab = await getActiveTab();
  if (!isSchoolUrl(tab.url)) {
    pageData = null;
    diagnostics = {
      url: tab.url || "",
      pathname: "",
      supportedPage: false,
      documentTitle: tab.title || "",
      errors: [UNSUPPORTED_MESSAGE]
    };
    updateDiagnostics(diagnostics);
    return null;
  }

  const diagnosticData = await sendRuntimeMessage({
    type: MESSAGE_TYPES.GET_DIAGNOSTICS,
    tabId: tab.id
  });
  updateDiagnostics(diagnosticData);
  if (!diagnosticData.supportedPage) {
    pageData = null;
    ui.backupInfo.textContent = "지원 페이지에서만 백업을 확인할 수 있습니다.";
    return null;
  }

  const data = await sendRuntimeMessage({ type: MESSAGE_TYPES.GET_PAGE_DATA, tabId: tab.id });
  updatePageData(data);
  if (announce) {
    setStatus("현재 문제, 코드, 실행 결과와 진단 정보를 새로 읽었습니다.", "success");
  }
  return data;
}

function promptSection(title, value, emptyText = "찾지 못함") {
  return [`## ${title}`, String(value || "").trim() || emptyText].join("\n");
}

function pythonFence(code) {
  return ["```python", String(code || "").trimEnd() || "# 현재 코드를 읽지 못함", "```"].join("\n");
}

const PROMPT_INSTRUCTIONS = Object.freeze({
  explain: [
    "초보자도 이해할 수 있도록 문제를 쉽게 설명해 주세요.",
    "입력과 출력의 의미를 설명하고, 제공된 예제를 단계별로 풀어 설명해 주세요.",
    "정답 코드나 완성된 알고리즘은 바로 제공하지 마세요."
  ],
  review: [
    "현재 코드를 최대한 유지하면서 검토해 주세요.",
    "문법 오류와 논리 오류를 구분하고, 잘한 점도 설명해 주세요.",
    "수정이 필요한 줄과 이유를 구체적으로 알려 주세요.",
    "바로 전체 정답으로 대체하지 말고 수정 방향을 설명한 뒤, 마지막에 개선 코드를 제공해 주세요."
  ],
  solution: [
    "풀이 아이디어와 단계별 과정을 설명해 주세요.",
    "시간복잡도와 공간복잡도, 주의할 반례를 포함해 주세요.",
    "프로그래머스 solution 함수 형태의 Python3 완성 코드를 제공해 주세요.",
    "완성 코드는 반드시 하나의 ```python 코드 블록으로 출력해 주세요."
  ],
  complexity: [
    "현재 코드의 시간복잡도와 공간복잡도를 분석해 주세요.",
    "문제 제한사항을 기준으로 통과 가능한지 판단해 주세요.",
    "더 효율적인 대안이 있다면 핵심 아이디어와 개선되는 복잡도를 설명해 주세요."
  ],
  error: [
    "실행 결과 또는 오류 메시지를 해석해 주세요.",
    "오류가 발생한 줄을 추정하고 문법 오류, 타입 오류, 인덱스 오류, 논리 오류를 구분해 주세요.",
    "기존 코드를 최대한 유지한 수정 방향과 수정 코드를 제공해 주세요."
  ]
});

function buildPrompt(type, data) {
  const instruction = PROMPT_INSTRUCTIONS[type];
  if (!instruction) {
    throw new UiError("알 수 없는 프롬프트 종류입니다.");
  }

  const requiresCode = ["review", "complexity", "error"].includes(type);
  if (requiresCode && !data.currentCode.trim()) {
    throw new UiError(
      "현재 CodeMirror 코드를 읽지 못해 이 프롬프트를 만들 수 없습니다.",
      data.editorError || "CodeMirror 진단 정보를 확인해 주세요."
    );
  }

  return [
    "다음 프로그래머스 일반 연습문제를 Python3 기준으로 도와주세요.",
    "답변은 한국어로 작성하고, 문제에 없는 조건을 가정하면 그 내용을 명시해 주세요.",
    "==================== 문제 ====================",
    promptSection("문제 제목", data.title),
    promptSection("현재 언어", data.language),
    promptSection("문제 내용", data.problemText),
    "==================== 현재 코드 ====================",
    promptSection("사용자가 작성한 Python3 코드", pythonFence(data.currentCode)),
    "==================== 실행 결과 ====================",
    promptSection("실행 결과 또는 오류 메시지", data.executionResult),
    "==================== 요청 ====================",
    instruction.map((item) => `- ${item}`).join("\n")
  ].join("\n\n");
}

async function writeClipboard(text) {
  if (!navigator.clipboard?.writeText) {
    throw new UiError("이 Chrome 환경에서는 클립보드 쓰기를 사용할 수 없습니다.");
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    throw new UiError(
      "클립보드에 쓰지 못했습니다.",
      "사이드 패널에 포커스를 두고 Chrome의 클립보드 권한을 확인해 주세요."
    );
  }
}

async function readClipboard() {
  if (!navigator.clipboard?.readText) {
    throw new UiError("이 Chrome 환경에서는 클립보드 읽기를 사용할 수 없습니다.");
  }
  try {
    return await navigator.clipboard.readText();
  } catch (error) {
    throw new UiError(
      "클립보드를 읽지 못했습니다.",
      "사이드 패널에 포커스를 두고 Chrome의 클립보드 권한을 확인해 주세요."
    );
  }
}

function normalizeCode(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function isLikelyPythonCode(code) {
  const value = normalizeCode(code);
  if (!value || value.length > 200000) {
    return false;
  }
  if (/^\s*def\s+solution\s*\(/m.test(value)) {
    return true;
  }

  const lines = value.split("\n").filter((line) => line.trim());
  const syntaxSignals = lines.filter((line) =>
    /^\s*(?:def\s+\w+\s*\(|class\s+\w+|from\s+\w+|import\s+\w+|for\s+.+:|while\s+.+:|if\s+.+:|elif\s+.+:|else\s*:|try\s*:|except\b.*:|return\b|yield\b|@\w+|#)/.test(
      line
    )
  ).length;
  const assignmentSignals = lines.filter((line) =>
    /^\s*[A-Za-z_]\w*(?:\[[^\]]+\])?\s*(?:=|\+=|-=|\*=|\/=|\/\/=|%=)/.test(line)
  ).length;
  return syntaxSignals >= 2 || (syntaxSignals >= 1 && assignmentSignals >= 1);
}

function extractClipboardCode(clipboardText) {
  const text = String(clipboardText || "").replace(/\r\n?/g, "\n");
  const blocks = [];
  const fencePattern = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match;

  while ((match = fencePattern.exec(text)) !== null) {
    const language = match[1].trim().toLowerCase().split(/\s+/)[0] || "";
    const code = normalizeCode(match[2]);
    blocks.push({
      language,
      code,
      isPython: ["python", "python3", "py"].includes(language),
      hasSolution: /^\s*def\s+solution\s*\(/m.test(code)
    });
  }

  const codeLikeBlocks = blocks.filter((block) => isLikelyPythonCode(block.code));
  const solutionPython = codeLikeBlocks
    .filter((block) => block.isPython && block.hasSolution)
    .sort((a, b) => b.code.length - a.code.length);
  const pythonBlocks = codeLikeBlocks
    .filter((block) => ["python", "python3"].includes(block.language))
    .sort((a, b) => b.code.length - a.code.length);
  const pyBlocks = codeLikeBlocks
    .filter((block) => block.language === "py")
    .sort((a, b) => b.code.length - a.code.length);
  const genericBlocks = codeLikeBlocks
    .filter((block) => !block.isPython)
    .sort((a, b) => b.code.length - a.code.length);

  const selected = solutionPython[0] || pythonBlocks[0] || pyBlocks[0] || genericBlocks[0];
  if (selected) {
    return {
      code: selected.code,
      source: selected.hasSolution
        ? "def solution이 포함된 Python 코드 블록"
        : selected.isPython
          ? "가장 긴 Python 코드 블록"
          : "가장 긴 일반 코드 블록"
    };
  }

  if (!blocks.length) {
    const plainCode = normalizeCode(text.replace(/^(?:python|python3|py)\s*\n/i, ""));
    if (isLikelyPythonCode(plainCode)) {
      return { code: plainCode, source: "Python 코드로 판단한 일반 텍스트" };
    }
  }

  throw new UiError(
    "클립보드 내용이 Python 코드로 보이지 않아 에디터를 변경하지 않았습니다.",
    "ChatGPT의 Python 코드 블록 복사 버튼을 누른 뒤 다시 시도해 주세요."
  );
}

async function runTask(task) {
  if (busy) {
    return;
  }
  setBusy(true);
  try {
    await task();
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

for (const button of ui.promptButtons) {
  button.addEventListener("click", () => {
    runTask(async () => {
      const data = await loadCurrentInformation();
      if (!data || !isPython3(data.language)) {
        throw new UiError("Python3 일반 연습문제에서만 프롬프트를 만들 수 있습니다.");
      }
      if (button.dataset.promptType === "error" && !data.executionErrorDetected) {
        throw new UiError(
          "현재 실행 결과에서 오류나 실패를 탐지하지 못했습니다.",
          "프로그래머스에서 코드를 실행해 오류가 표시된 뒤 현재 정보를 새로고침하세요."
        );
      }
      const prompt = buildPrompt(button.dataset.promptType, data);
      ui.preview.value = prompt;
      ui.previewCount.textContent = `${prompt.length.toLocaleString("ko-KR")}자`;
      ui.copyPrompt.disabled = false;
      setStatus("프롬프트를 생성했습니다. 내용을 수정한 뒤 복사 버튼을 누르세요.", "success");
    });
  });
}

ui.preview.addEventListener("input", () => {
  ui.previewCount.textContent = `${ui.preview.value.length.toLocaleString("ko-KR")}자`;
  ui.copyPrompt.disabled = busy || !ui.preview.value.trim();
});

ui.clearPreview.addEventListener("click", () => {
  ui.preview.value = "";
  ui.previewCount.textContent = "0자";
  ui.copyPrompt.disabled = true;
  setStatus("프롬프트 미리보기를 초기화했습니다.", "success");
});

ui.copyPrompt.addEventListener("click", () => {
  runTask(async () => {
    const prompt = ui.preview.value.trim();
    if (!prompt) {
      throw new UiError("복사할 프롬프트가 없습니다.");
    }
    await writeClipboard(prompt);
    setStatus("수정된 프롬프트를 클립보드에 복사했습니다.", "success");
  });
});

ui.refresh.addEventListener("click", () => {
  runTask(() => loadCurrentInformation({ announce: true }));
});

ui.openChatGpt.addEventListener("click", () => {
  runTask(async () => {
    const result = await sendRuntimeMessage({
      type: MESSAGE_TYPES.OPEN_CHATGPT
    });
    setStatus(`ChatGPT 탭을 열었습니다. 직접 붙여넣고 전송하세요.\n${result.url}`, "success");
  });
});

ui.insertCode.addEventListener("click", () => {
  runTask(async () => {
    if (!featureEnabled) {
      throw new UiError("Python3 일반 연습문제에서만 코드를 삽입할 수 있습니다.");
    }
    const clipboard = await readClipboard();
    const extracted = extractClipboardCode(clipboard);
    const result = await requestForActiveTab(MESSAGE_TYPES.SET_EDITOR_CODE, {
      code: extracted.code
    });
    if (!result.verified) {
      throw new UiError("삽입된 코드 검증에 실패했습니다. 에디터 값이 일치하지 않습니다.");
    }
    await loadCurrentInformation();
    setStatus(
      `${extracted.source}을 선택했습니다.\nCodeMirror 삽입값 검증 성공 (${result.insertedLength}자). 실행과 제출은 직접 눌러 주세요.`,
      "success"
    );
  });
});

ui.restoreCode.addEventListener("click", () => {
  runTask(async () => {
    if (!featureEnabled) {
      throw new UiError("Python3 일반 연습문제에서만 코드를 복원할 수 있습니다.");
    }
    const result = await requestForActiveTab(MESSAGE_TYPES.RESTORE_EDITOR_CODE);
    if (!result.verified) {
      throw new UiError("복원된 코드 검증에 실패했습니다.");
    }
    await loadCurrentInformation();
    setStatus(
      `이전 코드를 복원하고 복원 직전 코드도 새 백업으로 저장했습니다.\n복원 시점: ${new Date(
        result.restoredFrom
      ).toLocaleString("ko-KR")}`,
      "success"
    );
  });
});

ui.copyDebug.addEventListener("click", () => {
  runTask(async () => {
    const freshDiagnostics = await requestForActiveTab(MESSAGE_TYPES.GET_DIAGNOSTICS);
    diagnostics = freshDiagnostics;
    const debugJson = JSON.stringify(freshDiagnostics, null, 2);
    await writeClipboard(debugJson);
    setStatus("문제 원문과 코드 원문을 제외한 디버그 정보를 복사했습니다.", "success");
  });
});

runTask(async () => {
  await loadCurrentInformation();
});
