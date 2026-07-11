(() => {
  "use strict";

  // 프로그래머스 DOM selector는 반드시 이 파일에서만 관리합니다.
  globalThis.SELECTORS = Object.freeze({
    problem: [
      "#tour2 .guide-section-description",
      "#tour2",
      ".guide-section"
    ],
    problemNoise: [
      "button",
      "nav",
      "script",
      "style",
      "noscript",
      "[role='button']",
      ".challenge-settings",
      ".button-section"
    ],
    sectionTitles: [
      ".guide-section-title"
    ],
    title: [
      "h1",
      "h2",
      ".challenge-title",
      ".algorithm-title .challenge-title",
      ".lesson-content[data-lesson-title]",
      ".breadcrumb .active"
    ],
    languageButton: [
      ".btn.btn-sm.btn-dark.dropdown-toggle",
      ".dropdown-language .dropdown-toggle",
      ".challenge-content[data-language]"
    ],
    editor: [
      ".CodeMirror"
    ],
    runButton: [
      "button#run-code",
      "#run-code"
    ],
    submitButton: [
      "button#submit-code",
      "#submit-code"
    ],
    textareas: [
      "textarea"
    ],
    resultCandidates: [
      "#output .console-content",
      "#output-wrapper .alert",
      "#output-wrapper",
      ".output-section .console-output",
      ".output-section",
      "#test-result",
      ".test-result",
      ".result-section",
      "[data-testid*='result']",
      "[data-testid*='output']",
      "[class*='result'] [class*='console']"
    ]
  });
})();
