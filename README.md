# Programmers AI Helper

프로그래머스 일반 연습문제와 ChatGPT Plus 웹을 사용자의 클립보드로 연결하는 개인용 Chrome Extension입니다. 문제와 현재 Python3 코드를 읽어 한국어 프롬프트를 만들고, ChatGPT에서 사용자가 복사한 Python 코드를 프로그래머스 CodeMirror 5 에디터에 삽입합니다.

설치 직후 바로 로드할 수 있는 순수 JavaScript, HTML, CSS 프로젝트입니다. npm, 번들러, 빌드, OpenAI API, API 키, 백엔드 서버가 필요하지 않습니다.

## 기능 목록

- 문제 제목, 문제 내용, 제한사항, 입출력 예, 입출력 예 설명 추출
- 현재 Python3 CodeMirror 코드 읽기
- 실행 결과와 오류 메시지 후보 추출
- 5종 한국어 프롬프트 생성
  - 문제 쉽게 설명
  - 내 코드 검토
  - 전체 풀이 요청
  - 시간복잡도 평가
  - 실행 오류 분석
- 사용자가 편집하고 초기화할 수 있는 프롬프트 미리보기와 클립보드 복사
- 기본 ChatGPT 웹 열기
- 여러 마크다운 코드 블록 중 적절한 Python 코드 선택
- CodeMirror 삽입 전 URL별 코드 백업 5개 유지
- 이전 코드 복원과 복원 직전 코드 재백업
- 지원 여부, selector, CodeMirror, 실행/제출 버튼을 확인하는 진단 UI
- 문제/코드 원문을 제외한 JSON 디버그 정보 복사

## API를 사용하지 않는 구조

```text
프로그래머스 DOM
  │ content.js: 문제·제목·언어·결과·버튼 진단
  │
  ├─ background.js
  │    └─ chrome.scripting.executeScript(world: "MAIN")
  │         └─ CodeMirror 5 getValue/setValue/focus/refresh/삽입 검증
  │
  └─ Chrome Side Panel
       ├─ 프롬프트 생성/수정/초기화
       ├─ 사용자 요청 시 클립보드 읽기/쓰기
       └─ ChatGPT 탭 열기

chrome.storage.local
  └─ URL별 최근 코드 백업 최대 5개
```

문제와 코드는 OpenAI나 다른 서버로 전송되지 않습니다. `ChatGPT 열기`는 `https://chatgpt.com/`을 새 탭으로 열 뿐입니다. 사용자가 직접 프롬프트를 붙여넣고 전송하고, 답변의 코드 블록을 직접 복사해야 합니다. 확장 프로그램은 ChatGPT DOM, 답변, 쿠키, 로그인 세션에 접근하지 않습니다.

## 지원 페이지

기본 도메인은 다음 하나뿐입니다.

```text
https://school.programmers.co.kr/*
```

실제 문제 기능은 pathname이 다음 숫자 ID 형태일 때만 활성화됩니다.

```text
/learn/courses/{숫자}/lessons/{숫자}
```

URL pathname에 다음 표현이 들어가면 기능을 비활성화합니다.

```text
assessment
exam
test
skill_check
skill-check
skill_checks
coding-test
```

문제 본문에 `test`라는 단어가 있어도 상관없습니다. 오직 URL pathname만 검사합니다. 지원하지 않는 페이지에서는 다음 메시지를 표시하고 문제·코드 기능을 비활성화합니다.

> 이 확장 프로그램은 프로그래머스 일반 연습문제에서만 사용할 수 있습니다.

현재 지원 언어는 Python3뿐입니다. 다른 언어에서는 진단만 표시하고 프롬프트 생성, 삽입, 복원을 비활성화합니다.

## 실제 채용 시험에서는 사용하지 마세요

이 프로젝트는 개인 학습용 일반 연습문제 보조 도구입니다. 실제 채용 코딩테스트, 평가, 시험, 스킬 체크, 기업 과제에서 사용하지 마세요. 해당 URL로 판별되는 페이지에서는 의도적으로 동작하지 않습니다. 제출 자동화 기능도 없습니다.

## 설치 방법

1. Chrome 주소창에 `chrome://extensions`를 입력합니다.
2. 오른쪽 위의 **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**를 누릅니다.
4. 이 저장소의 `programmers-ai-helper` 폴더를 선택합니다. 선택한 폴더 바로 아래에 `manifest.json`이 있어야 합니다.
5. 이미 열어 둔 프로그래머스 페이지가 있다면 새로고침합니다.
6. Chrome 툴바의 확장 프로그램 메뉴에서 **Programmers AI Helper**를 선택합니다.
7. 필요하면 핀 아이콘으로 고정합니다. 툴바 아이콘을 누르면 Chrome 사이드 패널이 열립니다.

사이드 패널은 툴바 아이콘을 누른 마지막 탭 하나에만 활성화됩니다. 다른 탭으로 이동하면 패널이 숨겨지고, 다른 탭에서 확장 아이콘을 누르면 이전 탭의 패널은 비활성화됩니다.

Chrome 116 이상을 사용하세요. 별도의 설치 명령이나 빌드는 없습니다.

## 실제 사용 흐름

### ChatGPT Plus에서 프롬프트 사용

1. 프로그래머스 일반 연습문제를 열고 언어를 Python3로 선택합니다.
2. 사이드 패널의 상태 영역에서 일반 연습문제, Python3, CodeMirror 5 탐지를 확인합니다.
3. 원하는 프롬프트 생성 버튼을 누릅니다.
4. 미리보기 textarea에서 생성된 내용을 필요에 맞게 수정합니다.
5. 다시 만들고 싶다면 `초기화`를 눌러 미리보기와 글자 수를 비웁니다.
6. `생성된 프롬프트 복사`를 누릅니다. 이 버튼을 누를 때만 문제와 코드가 클립보드에 기록됩니다.
7. `ChatGPT 열기`를 누릅니다.
8. ChatGPT 입력창에 직접 `Ctrl+V`하고 직접 전송합니다.

확장 프로그램은 프롬프트를 ChatGPT에 자동 입력하거나 전송하지 않습니다.

### 클립보드 코드 삽입

1. ChatGPT 답변의 코드 블록 복사 버튼을 누릅니다.
2. 프로그래머스 사이드 패널에서 `클립보드 코드 삽입`을 누릅니다.
3. 줄바꿈을 LF로 통일하고 앞뒤 공백 및 마크다운 fence를 제거합니다.
4. 다음 우선순위로 블록을 선택합니다.
   1. `def solution`이 포함된 Python 코드 블록
   2. 가장 긴 `python` 또는 `python3` 코드 블록
   3. 가장 긴 `py` 코드 블록
   4. 가장 긴 일반 코드 블록
   5. 코드 블록이 없으면 전체 텍스트가 Python 코드로 보이는 경우
5. 코드로 보이지 않으면 에디터를 변경하지 않고 오류를 표시합니다.
6. 기존 코드를 먼저 백업한 뒤 CodeMirror 5 `setValue()`로 삽입합니다.
7. `getValue()`로 다시 읽은 값이 삽입 요청과 정확히 같은지 검증합니다.
8. 사용자가 코드를 확인한 후 실행 및 제출 버튼을 직접 누릅니다.

코드 블록이 하나라도 있으면 블록 바깥의 설명은 절대 삽입하지 않습니다.

## 코드 백업과 복원

- 백업 키는 문제 URL의 origin과 pathname으로 구성합니다.
- 각 백업에는 현재 문제 URL, 저장 시각, 기존 코드, 저장 이유가 들어갑니다.
- 한 URL당 최신 백업 5개만 보관합니다.
- 삽입 전에 현재 CodeMirror 값을 반드시 백업합니다.
- `이전 코드 복원`은 가장 최근 백업을 복원합니다.
- 복원하기 직전의 현재 코드도 새 백업으로 저장합니다. 따라서 잘못 복원했다면 버튼을 다시 눌러 직전 상태로 되돌릴 수 있습니다.

백업은 이 Chrome 프로필의 `chrome.storage.local`에만 저장되며 외부로 전송되지 않습니다.

## CodeMirror 5 접근 방식

확인된 프로그래머스 에디터 구조는 CodeMirror 5입니다.

```javascript
const editorElement = document.querySelector(".CodeMirror");
const editor = editorElement?.CodeMirror;
const code = editor.getValue();
```

삽입은 다음 API 흐름을 사용합니다.

```javascript
const backup = editor.getValue();
editor.setValue(newCode);
editor.focus();
editor.refresh();
const insertedCode = editor.getValue();
const success = insertedCode === newCode;
```

CodeMirror DOM의 `innerText`, textarea의 `value`, 키보드 이벤트 시뮬레이션은 코드 삽입에 사용하지 않습니다.

### MAIN world 실행이 필요한 이유

Chrome content script는 페이지 JavaScript와 분리된 isolated world에서 실행됩니다. DOM 요소는 볼 수 있어도 페이지가 요소에 연결한 CodeMirror JavaScript 인스턴스에 안정적으로 접근하지 못할 수 있습니다.

따라서 `background.js`가 아래 방식으로 CodeMirror 읽기와 쓰기를 실행합니다.

```javascript
chrome.scripting.executeScript({
  target: { tabId },
  world: "MAIN",
  func: codeMirrorMain,
  args: [action, newCode, SELECTORS.editor]
});
```

코드는 `args`로 전달하며 `eval`과 `new Function`은 사용하지 않습니다. 별도 script 태그 삽입 파일도 사용하지 않습니다.

## Chrome 권한과 사용 이유

| 권한 | 이유 |
| --- | --- |
| `sidePanel` | 툴바 아이콘을 누른 마지막 탭 하나에만 tab-specific 사이드 패널을 설정하고 엽니다. |
| `storage` | URL별 코드 백업 5개를 로컬에 저장합니다. |
| `tabs` | 현재 활성 탭을 확인하고 허용된 ChatGPT 주소를 새 탭으로 엽니다. |
| `scripting` | CodeMirror 인스턴스에 접근하기 위해 지원 탭의 MAIN world에서 함수를 실행합니다. 이미 열려 있던 탭에 content script가 없을 때 다시 주입하는 데도 사용합니다. |
| `clipboardRead` | 사용자가 `클립보드 코드 삽입`을 누를 때만 복사된 코드를 읽습니다. |
| `clipboardWrite` | 사용자가 프롬프트 복사 또는 디버그 정보 복사를 누를 때만 클립보드에 씁니다. |
| `https://school.programmers.co.kr/*` | 프로그래머스 스쿨 페이지의 문제 DOM과 CodeMirror에 접근합니다. |

`activeTab`은 `tabs`와 제한된 host 권한으로 필요한 기능이 충족되어 중복 선언하지 않았습니다. `<all_urls>`, cookies, webRequest 권한은 없습니다. ChatGPT host 권한도 없습니다.

## selectors.js 수정 방법

프로그램머스 DOM selector는 모두 `selectors.js`의 `SELECTORS` 객체 한 곳에 있습니다.

| 항목 | 용도 |
| --- | --- |
| `problem` | 문제 전체 영역 후보. 첫 번째로 일치하는 요소만 사용합니다. |
| `problemNoise` | 문제 복제본에서 제거할 버튼, 메뉴, 스크립트 후보입니다. |
| `sectionTitles` | 문제 소제목 진단 후보입니다. |
| `title` | h1, h2, 문제 근처 제목, breadcrumb 후보입니다. |
| `languageButton` | 현재 언어 버튼 또는 language data 속성 후보입니다. |
| `editor` | CodeMirror 5 루트 후보입니다. |
| `runButton` | 실행 버튼 진단 전용 후보입니다. |
| `submitButton` | 제출 버튼 진단 전용 후보입니다. |
| `textareas` | textarea 개수 진단 전용 후보입니다. |
| `resultCandidates` | 실행 결과/오류 영역 후보입니다. |

문제 영역 우선순위는 실제 확인 정보대로 다음과 같습니다.

1. `#tour2 .guide-section-description`
2. `#tour2`
3. `.guide-section`

CodeMirror는 `.CodeMirror`, 언어 버튼은 `.btn.btn-sm.btn-dark.dropdown-toggle`, 실행/제출은 각각 `button#run-code`, `button#submit-code`를 우선합니다.

프로그램머스 DOM이 바뀌면 해당 배열의 맨 앞에 새 후보를 추가하고, Chrome 확장 관리 화면과 문제 탭을 모두 새로고침하세요. selector가 일치하지 않을 때 조용히 실패하지 않고 상태 메시지와 디버그 JSON에 어느 후보가 탐지되지 않았는지 표시합니다.

## DOM 변경 시 디버깅

1. 사이드 패널의 `현재 정보 새로고침`을 누릅니다.
2. `디버그 정보 복사`를 누릅니다.
3. JSON의 다음 항목을 확인합니다.
   - URL, pathname, 지원 여부, 차단 pathname 표현
   - `document.title`
   - 문제/title/language selector별 탐지 결과
   - 문제 텍스트 길이
   - `.CodeMirror` DOM 및 인스턴스 탐지 여부
   - 코드 길이
   - 실행/제출 버튼 탐지 여부
   - textarea 개수
   - 실행 결과 후보별 탐지, 표시 여부, 텍스트 길이, 키워드 점수
   - 오류 메시지
4. DevTools Console에서 `document.querySelector("후보")`를 실행합니다.
5. 새 selector를 `selectors.js`의 적절한 배열에 추가합니다.

디버그 JSON에는 문제 전체 텍스트와 코드 전체 텍스트가 들어가지 않습니다.

## 테스트 방법

### 1. 설치 및 지원 범위

1. `chrome://extensions`에서 압축 해제 상태로 로드합니다.
2. 일반 연습문제에서 사이드 패널이 열리는지 확인합니다.
3. 다른 탭으로 전환했을 때 패널이 숨겨지는지 확인합니다.
4. 다른 탭에서 확장 아이콘을 누르면 새 탭에서만 열리고 이전 탭 패널은 비활성화되는지 확인합니다.
5. 상태가 `일반 연습문제`, 언어가 `Python3`인지 확인합니다.
6. 목록 페이지나 pathname에 `assessment`, `exam`, `test`, `skill-check`, `coding-test`가 들어간 페이지에서는 정확한 미지원 메시지가 나오는지 확인합니다.

### 2. 문제와 코드 추출

1. 상태 영역의 문제 제목과 문제 길이를 확인합니다.
2. CodeMirror 상태가 `CodeMirror 5 인스턴스 탐지`인지 확인합니다.
3. 에디터 코드를 수정하고 `현재 정보 새로고침`을 눌러 코드 길이가 바뀌는지 확인합니다.
4. 5개 프롬프트 버튼을 각각 눌러 요청 내용이 서로 다른지 확인합니다.
5. 미리보기 내용을 수정한 뒤 복사하여 수정 내용이 클립보드에 들어가는지 확인합니다.
6. `초기화`를 눌렀을 때 미리보기, 글자 수, 복사 버튼 상태가 초기화되는지 확인합니다.

### 3. 실행 결과

1. 실행 전에는 `실행 오류` 상태가 `실행 결과 없음`이고 `실행 오류 분석` 버튼이 비활성화되는지 확인합니다.
2. 오류가 나는 코드를 프로그래머스에서 직접 실행합니다.
3. `현재 정보 새로고침` 후 상태에 `Traceback`, `Error`, `Exception`, `실패` 등의 오류 신호가 표시되는지 확인합니다.
4. 이때만 활성화된 `실행 오류 분석`을 눌러 프롬프트에 화면의 실행 결과와 오류가 포함되는지 확인합니다.
5. 정상 실행 결과에서는 `오류 신호 없음`이 표시되고 버튼이 다시 비활성화되는지 확인합니다.

### 4. 코드 블록 선택과 검증

다음처럼 설명과 여러 블록이 섞인 텍스트를 복사합니다.

````text
설명 문장입니다.

```python
print("보조 예시")
```

```python
def solution(n):
    return n
```
````

1. `클립보드 코드 삽입`을 누릅니다.
2. `def solution` 블록만 삽입되는지 확인합니다.
3. 마크다운과 블록 밖 설명이 들어가지 않는지 확인합니다.
4. 상태에 삽입값 검증 성공과 글자 수가 표시되는지 확인합니다.
5. 자연어만 복사한 경우 에디터가 바뀌지 않고 오류가 표시되는지 확인합니다.
6. 실행과 제출이 자동으로 시작되지 않는지 확인합니다.

### 5. 백업과 복원

1. 서로 다른 코드를 6번 삽입합니다.
2. 백업 표시가 최대 `5/5개`인지 확인합니다.
3. `이전 코드 복원`으로 직전 코드가 돌아오는지 확인합니다.
4. 복원 직전 코드도 저장되어 버튼을 다시 누르면 되돌릴 수 있는지 확인합니다.
5. 페이지 새로고침 후에도 같은 URL의 백업이 유지되는지 확인합니다.

### 6. 디버그와 개인정보

1. `디버그 정보 복사` 후 JSON을 확인합니다.
2. 문제 본문 전체와 코드 원문이 들어 있지 않은지 확인합니다.
3. DevTools Network에서 확장 프로그램이 외부 분석/API 요청을 만들지 않는지 확인합니다.
4. ChatGPT 탭 외에 외부 URL이 열리지 않는지 확인합니다.

## 보안 및 개인정보 보호

- 문제와 코드는 사용자가 프롬프트 복사를 누를 때만 클립보드에 기록됩니다.
- 클립보드는 사용자가 코드 삽입을 누를 때만 읽습니다.
- 외부 분석, 광고, 텔레메트리, API 요청이 없습니다.
- 쿠키, 로그인 정보, 세션, 토큰 권한이 없습니다.
- API 키 입력란이 없습니다.
- `eval`, `new Function`, 사용자 입력을 넣는 `innerHTML`을 사용하지 않습니다.
- 사용자 데이터는 textarea의 `value` 또는 요소의 `textContent`로만 표시합니다.
- 실행 및 제출 버튼은 존재 여부만 진단합니다. 클릭 호출은 구현되어 있지 않습니다.

## 알려진 제약사항

- 문제 제목과 실행 결과 selector는 페이지 종류에 따라 달라질 수 있어 후보 방식으로 탐색합니다. 실제 페이지에서 `디버그 정보 복사` 결과를 보고 조정해야 할 수 있습니다.
- 실행 결과는 현재 DOM에 보이는 후보만 사용합니다. hidden 요소와 지나치게 큰 텍스트 영역은 제외합니다.
- 문제 텍스트는 렌더링된 DOM 기준입니다. 이미지 안의 글자나 아직 렌더링되지 않은 수식은 읽지 못할 수 있습니다.
- CodeMirror 6의 `.cm-editor`, Monaco, Ace, 일반 textarea 직접 쓰기는 지원하지 않습니다. 확인된 CodeMirror 5 인스턴스 API만 사용합니다.
- Python 코드 판별은 안전을 위한 휴리스틱입니다. 매우 짧거나 특이한 유효 Python 코드는 거부될 수 있으며, 반대로 Python처럼 보이는 텍스트가 통과할 가능성도 있습니다.
- URL별 백업은 최근 5개이며 버전 이름 지정, 내보내기, 클라우드 동기화는 없습니다.
- ChatGPT 로그인, Plus 구독 확인, 대화 선택, 붙여넣기, 전송, 답변 생성, 답변 복사는 자동화하지 않습니다.

## 파일 구조

```text
programmers-ai-helper/
├─ manifest.json
├─ background.js
├─ content.js
├─ selectors.js
├─ sidepanel.html
├─ sidepanel.js
├─ sidepanel.css
├─ utils.js
└─ README.md
```

아이콘은 필수 항목이 아니므로 외부 저작권 자산과 바이너리 생성 과정을 피하기 위해 포함하지 않았습니다. Chrome은 아이콘 없이도 확장 프로그램을 로드할 수 있습니다.
