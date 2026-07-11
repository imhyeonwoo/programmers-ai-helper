"use strict";

importScripts("selectors.js", "utils.js");

const {
  MESSAGE_TYPES,
  UNSUPPORTED_MESSAGE,
  DEFAULT_CHATGPT_URL,
  analyzePageSupport,
  backupStorageKey
} = globalThis.ProgrammersAiUtils;

const MAX_BACKUPS_PER_URL = 5;
const ACTIVE_PANEL_TAB_KEY = "programmersAiHelper:activePanelTabId";

class BackgroundError extends Error {
  constructor(message, details = "") {
    super(message);
    this.name = "BackgroundError";
    this.details = details;
  }
}

function success(data) {
  return { success: true, data };
}

function failure(error) {
  return {
    success: false,
    error: error instanceof Error ? error.message : String(error),
    details: error?.details || ""
  };
}

async function disableAllTabPanels() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map((tab) =>
      chrome.sidePanel.setOptions({ tabId: tab.id, enabled: false }).catch((error) => {
        console.error(`탭 ${tab.id} 사이드 패널 비활성화 실패:`, error);
      })
    )
  );
  await chrome.storage.session.remove(ACTIVE_PANEL_TAB_KEY);
}

chrome.runtime.onInstalled.addListener(() => {
  disableAllTabPanels().catch((error) => console.error("사이드 패널 초기화 실패:", error));
});

chrome.runtime.onStartup.addListener(() => {
  disableAllTabPanels().catch((error) => console.error("사이드 패널 초기화 실패:", error));
});

chrome.action.onClicked.addListener((tab) => {
  if (!Number.isInteger(tab.id)) {
    return;
  }

  const previousTabPromise = chrome.storage.session.get(ACTIVE_PANEL_TAB_KEY);
  const configurePromise = chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: "sidepanel.html",
    enabled: true
  });

  // open()은 사용자 클릭의 동기 호출 구간에서 시작해야 합니다.
  const openPromise = chrome.sidePanel.open({ tabId: tab.id });

  Promise.all([previousTabPromise, configurePromise, openPromise])
    .then(async ([previous]) => {
      const previousTabId = previous[ACTIVE_PANEL_TAB_KEY];
      if (Number.isInteger(previousTabId) && previousTabId !== tab.id) {
        await chrome.sidePanel
          .setOptions({ tabId: previousTabId, enabled: false })
          .catch(() => undefined);
      }
      await chrome.storage.session.set({ [ACTIVE_PANEL_TAB_KEY]: tab.id });
    })
    .catch((error) => {
      console.error("탭 전용 사이드 패널 열기 실패:", error);
    });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const stored = await chrome.storage.session.get(ACTIVE_PANEL_TAB_KEY);
    if (stored[ACTIVE_PANEL_TAB_KEY] === tabId) {
      await chrome.storage.session.remove(ACTIVE_PANEL_TAB_KEY);
    }
  } catch (error) {
    console.error("사이드 패널 탭 상태 정리 실패:", error);
  }
});

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function isMissingReceiverError(error) {
  const message = String(error?.message || error);
  return (
    message.includes("Receiving end does not exist") ||
    message.includes("Could not establish connection")
  );
}

async function sendContentMessage(tabId, message) {
  try {
    return await sendTabMessage(tabId, message);
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["selectors.js", "utils.js", "content.js"]
    });
    return sendTabMessage(tabId, message);
  }
}

async function getRequestedTab(tabId) {
  if (!Number.isInteger(tabId)) {
    throw new BackgroundError("현재 탭 정보를 확인하지 못했습니다. 사이드 패널을 다시 열어 주세요.");
  }
  try {
    return await chrome.tabs.get(tabId);
  } catch (error) {
    throw new BackgroundError("대상 탭이 닫혔거나 접근할 수 없습니다.", String(error));
  }
}

function assertSupportedTab(tab) {
  const support = analyzePageSupport(tab.url);
  if (!support.supported) {
    throw new BackgroundError(UNSUPPORTED_MESSAGE);
  }
  return support;
}

// 이 함수는 chrome.scripting.executeScript의 MAIN world에서 독립적으로 실행됩니다.
function codeMirrorMain(action, newCode, editorSelectors) {
  const findEditorElement = () => {
    for (const selector of editorSelectors || []) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          return { element, selector };
        }
      } catch {
        // 다음 selector 후보를 확인합니다.
      }
    }
    return { element: null, selector: null };
  };

  const found = findEditorElement();
  if (!found.element) {
    return {
      success: false,
      error: "CodeMirror 5 에디터를 찾지 못했습니다.",
      data: { elementFound: false, instanceFound: false, selector: null, codeLength: 0 }
    };
  }

  const editor = found.element.CodeMirror;
  const instanceFound = Boolean(
    editor && typeof editor.getValue === "function" && typeof editor.setValue === "function"
  );
  if (!instanceFound) {
    return {
      success: false,
      error: "CodeMirror 인스턴스에 접근하지 못했습니다.",
      data: { elementFound: true, instanceFound: false, selector: found.selector, codeLength: 0 }
    };
  }

  try {
    if (action === "CHECK") {
      const code = editor.getValue();
      return {
        success: true,
        data: {
          elementFound: true,
          instanceFound: true,
          selector: found.selector,
          codeLength: typeof code === "string" ? code.length : 0
        }
      };
    }

    if (action === "GET") {
      const code = editor.getValue();
      return {
        success: true,
        data: {
          code,
          codeLength: code.length,
          elementFound: true,
          instanceFound: true,
          selector: found.selector
        }
      };
    }

    if (action === "SET") {
      if (typeof newCode !== "string") {
        return { success: false, error: "삽입할 코드는 문자열이어야 합니다." };
      }

      const backup = editor.getValue();
      editor.setValue(newCode);
      editor.focus();
      editor.refresh();
      const insertedCode = editor.getValue();
      const verified = insertedCode === newCode;

      return {
        success: verified,
        error: verified ? "" : "CodeMirror에 삽입된 값이 요청한 코드와 일치하지 않습니다.",
        data: {
          verified,
          insertedLength: insertedCode.length,
          previousLength: backup.length,
          elementFound: true,
          instanceFound: true,
          selector: found.selector
        }
      };
    }

    return { success: false, error: "알 수 없는 CodeMirror 작업입니다." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      data: {
        elementFound: true,
        instanceFound: true,
        selector: found.selector
      }
    };
  }
}

async function executeCodeMirror(tabId, action, newCode = null) {
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: codeMirrorMain,
      args: [action, newCode, globalThis.SELECTORS.editor]
    });
  } catch (error) {
    throw new BackgroundError(
      "CodeMirror 작업을 페이지 MAIN world에서 실행하지 못했습니다.",
      String(error)
    );
  }

  const result = results?.[0]?.result;
  if (!result) {
    throw new BackgroundError("CodeMirror 작업 결과를 받지 못했습니다.");
  }
  return result;
}

async function getBackups(rawUrl) {
  const key = backupStorageKey(rawUrl);
  const stored = await chrome.storage.local.get(key);
  const backups = Array.isArray(stored[key]) ? stored[key] : [];
  return { key, backups };
}

async function saveBackup(rawUrl, code, reason) {
  const { key, backups } = await getBackups(rawUrl);
  const backup = {
    id: crypto.randomUUID(),
    url: rawUrl,
    createdAt: new Date().toISOString(),
    reason,
    code
  };
  const nextBackups = [backup, ...backups].slice(0, MAX_BACKUPS_PER_URL);
  await chrome.storage.local.set({ [key]: nextBackups });
  return { backup, count: nextBackups.length };
}

async function getBackupSummary(rawUrl) {
  const { backups } = await getBackups(rawUrl);
  return {
    count: backups.length,
    latest: backups[0]
      ? {
          id: backups[0].id,
          createdAt: backups[0].createdAt,
          reason: backups[0].reason,
          codeLength: backups[0].code.length
        }
      : null
  };
}

async function getDomData(tabId) {
  const response = await sendContentMessage(tabId, { type: MESSAGE_TYPES.GET_DOM_DATA });
  if (!response?.success) {
    throw new BackgroundError(response?.error || "문제 페이지 정보를 읽지 못했습니다.");
  }
  return response.data;
}

async function getDomDiagnostics(tabId) {
  const response = await sendContentMessage(tabId, {
    type: MESSAGE_TYPES.GET_DOM_DIAGNOSTICS
  });
  if (!response?.success) {
    throw new BackgroundError(response?.error || "페이지 진단 정보를 읽지 못했습니다.");
  }
  return response.data;
}

function isPython3Language(language) {
  return String(language || "").replace(/\s+/g, "").toLowerCase().includes("python3");
}

async function assertPython3Tab(tab) {
  const domData = await getDomData(tab.id);
  if (!isPython3Language(domData.language)) {
    throw new BackgroundError("현재 언어가 Python3가 아닙니다. Python3를 선택해 주세요.");
  }
  return domData;
}

async function handleGetPageData(tab) {
  assertSupportedTab(tab);
  const domData = await getDomData(tab.id);
  const backup = await getBackupSummary(tab.url);

  if (!isPython3Language(domData.language)) {
    return {
      ...domData,
      currentCode: "",
      codeLength: 0,
      codeMirrorFound: false,
      codeMirrorInstanceFound: false,
      editorSelector: null,
      editorError: "현재 언어가 Python3가 아닙니다. Python3를 선택해 주세요.",
      backup
    };
  }

  const editorResult = await executeCodeMirror(tab.id, "GET");

  return {
    ...domData,
    currentCode: editorResult.success ? editorResult.data.code : "",
    codeLength: editorResult.success ? editorResult.data.codeLength : 0,
    codeMirrorFound: Boolean(editorResult.data?.elementFound),
    codeMirrorInstanceFound: Boolean(editorResult.data?.instanceFound),
    editorSelector: editorResult.data?.selector || null,
    editorError: editorResult.success ? "" : editorResult.error,
    backup
  };
}

async function handleSetEditorCode(tab, newCode) {
  assertSupportedTab(tab);
  await assertPython3Tab(tab);
  if (typeof newCode !== "string" || !newCode.trim()) {
    throw new BackgroundError("삽입할 Python 코드가 비어 있습니다.");
  }

  const current = await executeCodeMirror(tab.id, "GET");
  if (!current.success) {
    throw new BackgroundError(current.error);
  }

  const backup = await saveBackup(tab.url, current.data.code, "before-insert");
  const inserted = await executeCodeMirror(tab.id, "SET", newCode);
  if (!inserted.success) {
    throw new BackgroundError(inserted.error);
  }

  return {
    ...inserted.data,
    backupCount: backup.count,
    backupCreatedAt: backup.backup.createdAt
  };
}

async function handleRestoreEditorCode(tab) {
  assertSupportedTab(tab);
  await assertPython3Tab(tab);
  const { backups } = await getBackups(tab.url);
  const targetBackup = backups[0];
  if (!targetBackup) {
    throw new BackgroundError("현재 URL에 복원할 이전 코드가 없습니다.");
  }

  const current = await executeCodeMirror(tab.id, "GET");
  if (!current.success) {
    throw new BackgroundError(current.error);
  }

  await saveBackup(tab.url, current.data.code, "before-restore");
  const restored = await executeCodeMirror(tab.id, "SET", targetBackup.code);
  if (!restored.success) {
    throw new BackgroundError(restored.error);
  }

  const summary = await getBackupSummary(tab.url);
  return {
    ...restored.data,
    restoredFrom: targetBackup.createdAt,
    backup: summary
  };
}

async function handleDiagnostics(tab) {
  const support = analyzePageSupport(tab.url);
  const errors = [];
  let domDiagnostics;

  try {
    domDiagnostics = await getDomDiagnostics(tab.id);
  } catch (error) {
    errors.push(error.message);
    domDiagnostics = {
      url: tab.url || "",
      pathname: globalThis.ProgrammersAiUtils.parseUrl(tab.url)?.pathname || "",
      supportedPage: support.supported,
      documentTitle: tab.title || "",
      errorMessages: [error.message]
    };
  }

  let editorDiagnostics = {
    elementFound: false,
    instanceFound: false,
    selector: null,
    codeLength: 0,
    skipped: !support.supported
  };

  if (support.supported) {
    try {
      const editor = await executeCodeMirror(tab.id, "CHECK");
      editorDiagnostics = {
        ...(editor.data || editorDiagnostics),
        error: editor.success ? "" : editor.error,
        skipped: false
      };
      if (!editor.success) {
        errors.push(editor.error);
      }
    } catch (error) {
      errors.push(error.message);
      editorDiagnostics.error = error.message;
    }
  } else {
    errors.push(UNSUPPORTED_MESSAGE);
  }

  return {
    ...domDiagnostics,
    supportedPage: support.supported,
    blockedPathTerm: support.blockedTerm,
    codeMirrorElementFound: Boolean(editorDiagnostics.elementFound),
    codeMirrorInstanceFound: Boolean(editorDiagnostics.instanceFound),
    editorSelector: editorDiagnostics.selector || null,
    codeLength: editorDiagnostics.codeLength || 0,
    errors: [...new Set([...(domDiagnostics.errorMessages || []), ...errors].filter(Boolean))]
  };
}

async function handleMessage(message) {
  const type = message?.type;

  if (type === MESSAGE_TYPES.OPEN_CHATGPT) {
    const createdTab = await chrome.tabs.create({ url: DEFAULT_CHATGPT_URL });
    return { tabId: createdTab.id, url: DEFAULT_CHATGPT_URL };
  }

  const tab = await getRequestedTab(message?.tabId);
  switch (type) {
    case MESSAGE_TYPES.GET_PAGE_DATA:
      return handleGetPageData(tab);
    case MESSAGE_TYPES.GET_EDITOR_CODE: {
      assertSupportedTab(tab);
      await assertPython3Tab(tab);
      const result = await executeCodeMirror(tab.id, "GET");
      if (!result.success) {
        throw new BackgroundError(result.error);
      }
      return result.data;
    }
    case MESSAGE_TYPES.CHECK_EDITOR: {
      assertSupportedTab(tab);
      const result = await executeCodeMirror(tab.id, "CHECK");
      if (!result.success) {
        throw new BackgroundError(result.error);
      }
      return result.data;
    }
    case MESSAGE_TYPES.SET_EDITOR_CODE:
      return handleSetEditorCode(tab, message.code);
    case MESSAGE_TYPES.RESTORE_EDITOR_CODE:
      return handleRestoreEditorCode(tab);
    case MESSAGE_TYPES.GET_DIAGNOSTICS:
    case MESSAGE_TYPES.GET_PAGE_DIAGNOSTICS:
      return handleDiagnostics(tab);
    default:
      throw new BackgroundError("알 수 없는 확장 프로그램 요청입니다.");
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse(success(data)))
    .catch((error) => sendResponse(failure(error)));
  return true;
});
