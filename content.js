(() => {
  "use strict";

  if (globalThis.__PROGRAMMERS_AI_HELPER_CONTENT_V2_LOADED__) {
    return;
  }
  globalThis.__PROGRAMMERS_AI_HELPER_CONTENT_V2_LOADED__ = true;

  const SELECTORS = globalThis.SELECTORS;
  const { MESSAGE_TYPES, UNSUPPORTED_MESSAGE, analyzePageSupport } =
    globalThis.ProgrammersAiUtils;
  const RESULT_KEYWORDS = [
    "테스트 결과",
    "실행 결과",
    "정확성",
    "실패",
    "성공",
    "Traceback",
    "Error",
    "Exception",
    "출력",
    "기댓값",
    "실행한 결괏값"
  ];
  const EXECUTION_ERROR_PATTERNS = [
    { label: "Traceback", pattern: /\bTraceback\b/i },
    { label: "Python 예외", pattern: /\b(?:Syntax|Type|Index|Key|Value|Name|Attribute|ZeroDivision|Runtime|Import|Memory|Recursion)Error\b/i },
    { label: "Error", pattern: /\bError\b/i },
    { label: "Exception", pattern: /\bException\b/i },
    { label: "실패", pattern: /(?:테스트\s*)?실패|실패했습니다/ },
    { label: "런타임 오류", pattern: /런타임\s*(?:에러|오류)/ },
    { label: "컴파일 오류", pattern: /컴파일\s*(?:에러|오류)/ }
  ];
  const EMPTY_RESULT_TEXTS = new Set([
    "",
    "실행 결과",
    "실행 결과가 여기에 표시됩니다.",
    "실행 결과 실행 중지",
    "테스트 결과"
  ]);

  function responseSuccess(data) {
    return { success: true, data };
  }

  function responseFailure(error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function findFirstWithSelector(selectors, root = document) {
    for (const selector of selectors || []) {
      try {
        const element = root.querySelector(selector);
        if (element) {
          return { element, selector };
        }
      } catch (error) {
        console.warn(`잘못된 selector를 건너뜁니다: ${selector}`, error);
      }
    }
    return { element: null, selector: null };
  }

  function selectorDetections(selectors, root = document) {
    return (selectors || []).map((selector) => {
      try {
        const elements = [...root.querySelectorAll(selector)];
        return { selector, found: elements.length > 0, count: elements.length };
      } catch (error) {
        return { selector, found: false, count: 0, error: String(error) };
      }
    });
  }

  function isVisible(element) {
    if (!element || element.hidden || element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    const style = getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || "1") !== 0 &&
      element.getClientRects().length > 0
    );
  }

  function dedupeConsecutiveLines(text) {
    const result = [];
    for (const line of normalizeText(text).split("\n")) {
      const normalizedLine = line.trim();
      if (!normalizedLine || result[result.length - 1] !== normalizedLine) {
        result.push(normalizedLine);
      }
    }
    return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function extractProblem() {
    const matched = findFirstWithSelector(SELECTORS.problem);
    if (!matched.element) {
      throw new Error(
        "문제 영역을 찾지 못했습니다. selectors.js의 problem selector를 확인해 주세요."
      );
    }

    const clone = matched.element.cloneNode(true);
    for (const noiseSelector of SELECTORS.problemNoise) {
      try {
        for (const element of clone.querySelectorAll(noiseSelector)) {
          element.remove();
        }
      } catch (error) {
        console.warn(`문제 영역 정리 selector 오류: ${noiseSelector}`, error);
      }
    }

    const text = dedupeConsecutiveLines(clone.innerText || clone.textContent);
    if (!text) {
      throw new Error(
        "문제 영역은 찾았지만 텍스트가 비어 있습니다. 페이지 로딩 후 다시 시도해 주세요."
      );
    }
    return { text, selector: matched.selector, length: text.length };
  }

  function isUsableTitle(text) {
    const value = normalizeText(text);
    const excluded = new Set([
      "문제 설명",
      "제한사항",
      "제한 조건",
      "입출력 예",
      "입출력 예 설명",
      "코딩테스트 연습"
    ]);
    return value.length >= 2 && value.length <= 200 && !excluded.has(value);
  }

  function extractTitle() {
    for (const selector of SELECTORS.title) {
      let elements;
      try {
        elements = [...document.querySelectorAll(selector)];
      } catch {
        continue;
      }

      for (const element of elements) {
        const value = normalizeText(element.dataset?.lessonTitle || element.textContent);
        if (isUsableTitle(value)) {
          return { title: value, selector, source: "dom" };
        }
      }
    }

    const fromDocumentTitle = normalizeText(document.title)
      .replace(/^코딩테스트 연습\s*[-|]\s*/i, "")
      .replace(/\s*[|]\s*프로그래머스(?:\s*스쿨)?\s*$/i, "")
      .trim();
    if (isUsableTitle(fromDocumentTitle)) {
      return { title: fromDocumentTitle, selector: null, source: "document.title" };
    }
    return { title: "제목을 찾지 못함", selector: null, source: "fallback" };
  }

  function extractLanguage() {
    const matched = findFirstWithSelector(SELECTORS.languageButton);
    const language = normalizeText(
      matched.element?.dataset?.language || matched.element?.textContent
    );
    return {
      language: language || "언어를 찾지 못함",
      selector: matched.selector,
      found: Boolean(matched.element)
    };
  }

  function resultKeywordScore(text) {
    return RESULT_KEYWORDS.reduce(
      (score, keyword) => score + (text.toLowerCase().includes(keyword.toLowerCase()) ? 1 : 0),
      0
    );
  }

  function collectResultCandidates() {
    const candidates = [];
    const seen = new Set();

    for (const selector of SELECTORS.resultCandidates) {
      let elements;
      try {
        elements = [...document.querySelectorAll(selector)];
      } catch (error) {
        candidates.push({
          selector,
          found: false,
          visible: false,
          textLength: 0,
          keywordScore: 0,
          error: String(error)
        });
        continue;
      }

      if (!elements.length) {
        candidates.push({
          selector,
          found: false,
          visible: false,
          textLength: 0,
          keywordScore: 0
        });
        continue;
      }

      for (const element of elements) {
        if (seen.has(element)) {
          continue;
        }
        seen.add(element);
        const text = normalizeText(element.innerText || element.textContent);
        candidates.push({
          selector,
          found: true,
          visible: isVisible(element),
          textLength: text.length,
          keywordScore: resultKeywordScore(text),
          text
        });
      }
    }
    return candidates;
  }

  function extractResult() {
    const candidates = collectResultCandidates();
    const usable = candidates
      .filter(
        (candidate) =>
          candidate.found &&
          candidate.visible &&
          candidate.textLength > 0 &&
          candidate.textLength <= 20000 &&
          !EMPTY_RESULT_TEXTS.has(candidate.text)
      )
      .sort(
        (a, b) =>
          b.keywordScore - a.keywordScore ||
          Number(b.visible) - Number(a.visible) ||
          b.textLength - a.textLength
      );

    const best = usable[0];
    const found = Boolean(best);
    const text =
      best?.text || "실행 결과 영역을 찾지 못했습니다. 코드를 실행한 후 다시 시도하세요.";
    const errorSignals = found
      ? EXECUTION_ERROR_PATTERNS.filter((item) => item.pattern.test(text)).map((item) => item.label)
      : [];

    return {
      text,
      found,
      errorDetected: errorSignals.length > 0,
      errorSignals,
      selector: best?.selector || null,
      candidates: candidates.map(({ text, ...diagnostic }) => diagnostic)
    };
  }

  function buildDiagnostics(errorMessages = []) {
    const support = analyzePageSupport(location.href);
    const problemMatch = findFirstWithSelector(SELECTORS.problem);
    const title = extractTitle();
    const language = extractLanguage();
    const editorMatch = findFirstWithSelector(SELECTORS.editor);
    const runMatch = findFirstWithSelector(SELECTORS.runButton);
    const submitMatch = findFirstWithSelector(SELECTORS.submitButton);
    const result = extractResult();
    let problemLength = 0;

    try {
      problemLength = extractProblem().length;
    } catch (error) {
      errorMessages.push(error.message);
    }

    let textareaCount = 0;
    for (const item of selectorDetections(SELECTORS.textareas)) {
      textareaCount += item.count;
    }

    return {
      url: location.href,
      pathname: location.pathname,
      supportedPage: support.supported,
      blockedPathTerm: support.blockedTerm,
      documentTitle: document.title,
      problemSelectorDetections: selectorDetections(SELECTORS.problem),
      problemSelector: problemMatch.selector,
      problemTextLength: problemLength,
      sectionTitleDetections: selectorDetections(SELECTORS.sectionTitles),
      titleSelectorDetections: selectorDetections(SELECTORS.title),
      titleSelector: title.selector,
      titleSource: title.source,
      title: title.title,
      languageSelectorDetections: selectorDetections(SELECTORS.languageButton),
      languageSelector: language.selector,
      languageText: language.language,
      codeMirrorElementFound: Boolean(editorMatch.element),
      codeMirrorSelector: editorMatch.selector,
      codeMirrorInstanceFound: false,
      codeLength: 0,
      runButtonFound: Boolean(runMatch.element),
      runButtonSelector: runMatch.selector,
      submitButtonFound: Boolean(submitMatch.element),
      submitButtonSelector: submitMatch.selector,
      textareaCount,
      resultFound: result.found,
      executionErrorDetected: result.errorDetected,
      executionErrorSignals: result.errorSignals,
      resultSelector: result.selector,
      resultCandidateDetections: result.candidates,
      errorMessages: [...new Set(errorMessages.filter(Boolean))]
    };
  }

  function getDomData() {
    const support = analyzePageSupport(location.href);
    if (!support.supported) {
      throw new Error(UNSUPPORTED_MESSAGE);
    }

    const problem = extractProblem();
    const title = extractTitle();
    const language = extractLanguage();
    const result = extractResult();
    const runButton = findFirstWithSelector(SELECTORS.runButton);
    const submitButton = findFirstWithSelector(SELECTORS.submitButton);

    return {
      url: location.href,
      pathname: location.pathname,
      supportedPage: true,
      title: title.title,
      titleSelector: title.selector,
      titleSource: title.source,
      problemText: problem.text,
      problemTextLength: problem.length,
      problemSelector: problem.selector,
      language: language.language,
      languageSelector: language.selector,
      languageFound: language.found,
      executionResult: result.text,
      executionResultFound: result.found,
      executionErrorDetected: result.errorDetected,
      executionErrorSignals: result.errorSignals,
      resultSelector: result.selector,
      runButtonFound: Boolean(runButton.element),
      submitButtonFound: Boolean(submitButton.element),
      diagnostics: buildDiagnostics()
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      if (message?.type === MESSAGE_TYPES.GET_DOM_DATA) {
        sendResponse(responseSuccess(getDomData()));
        return false;
      }
      if (message?.type === MESSAGE_TYPES.GET_DOM_DIAGNOSTICS) {
        sendResponse(responseSuccess(buildDiagnostics()));
        return false;
      }
      sendResponse(responseFailure(new Error("알 수 없는 content script 요청입니다.")));
    } catch (error) {
      sendResponse(responseFailure(error));
    }
    return false;
  });
})();
