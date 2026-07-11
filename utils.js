(() => {
  "use strict";

  const MESSAGE_TYPES = Object.freeze({
    GET_PAGE_DATA: "GET_PAGE_DATA",
    GET_EDITOR_CODE: "GET_EDITOR_CODE",
    SET_EDITOR_CODE: "SET_EDITOR_CODE",
    CHECK_EDITOR: "CHECK_EDITOR",
    RESTORE_EDITOR_CODE: "RESTORE_EDITOR_CODE",
    GET_DIAGNOSTICS: "GET_DIAGNOSTICS",
    GET_PAGE_DIAGNOSTICS: "GET_PAGE_DIAGNOSTICS",
    GET_DOM_DATA: "GET_DOM_DATA",
    GET_DOM_DIAGNOSTICS: "GET_DOM_DIAGNOSTICS",
    OPEN_CHATGPT: "OPEN_CHATGPT"
  });

  const UNSUPPORTED_MESSAGE =
    "이 확장 프로그램은 프로그래머스 일반 연습문제에서만 사용할 수 있습니다.";
  const SCHOOL_ORIGIN = "https://school.programmers.co.kr";
  const DEFAULT_CHATGPT_URL = "https://chatgpt.com/";
  const BLOCKED_PATH_TERMS = Object.freeze([
    "assessment",
    "exam",
    "test",
    "skill_check",
    "skill-check",
    "skill_checks",
    "coding-test"
  ]);

  function parseUrl(rawUrl) {
    try {
      return new URL(rawUrl);
    } catch {
      return null;
    }
  }

  function isSchoolUrl(rawUrl) {
    return parseUrl(rawUrl)?.origin === SCHOOL_ORIGIN;
  }

  function analyzePageSupport(rawUrl) {
    const url = parseUrl(rawUrl);
    if (!url || url.origin !== SCHOOL_ORIGIN) {
      return { supported: false, reason: UNSUPPORTED_MESSAGE, blockedTerm: null };
    }

    const pathname = decodeURIComponent(url.pathname).toLowerCase();
    const blockedTerm = BLOCKED_PATH_TERMS.find((term) => pathname.includes(term)) || null;
    const generalLessonPattern = /^\/learn\/courses\/\d+\/lessons\/\d+\/?$/;
    const supported = !blockedTerm && generalLessonPattern.test(pathname);

    return {
      supported,
      reason: supported ? "" : UNSUPPORTED_MESSAGE,
      blockedTerm
    };
  }

  function backupStorageKey(rawUrl) {
    const url = parseUrl(rawUrl);
    const stableUrl = url ? `${url.origin}${url.pathname}` : String(rawUrl || "unknown");
    return `programmersAiHelper:backups:${encodeURIComponent(stableUrl)}`;
  }

  globalThis.ProgrammersAiUtils = Object.freeze({
    MESSAGE_TYPES,
    UNSUPPORTED_MESSAGE,
    SCHOOL_ORIGIN,
    DEFAULT_CHATGPT_URL,
    BLOCKED_PATH_TERMS,
    parseUrl,
    isSchoolUrl,
    analyzePageSupport,
    backupStorageKey
  });
})();
