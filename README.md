# 우리의 9월

2026년 9월 팀 챌린지 기록판입니다. 기존 7~8월 프로젝트와 분리된 새 프로젝트이며, 공동 저장은 Google Sheets + Google Apps Script Web App 방식으로 동작합니다.

## 파일 구성

- `index.html`: 화면과 `window.CONFIG.syncUrl` 설정
- `style.css`: 모바일 우선 대시보드 디자인
- `app.js`: 기록 입력, 마감 판정, 벌금, 순위, Google Apps Script 동기화
- `Code.gs`: Google Apps Script 서버 코드
- `README.md`: 설치와 배포 안내

## Google Sheets Records 헤더

시트 이름은 `Records`입니다. 첫 행은 아래 순서입니다.

```text
key | date | participantId | participantName | status | note | gymVisit | updatedAt
```

`key`는 `YYYY-MM-DD_participantId`입니다.

예:

```text
2026-09-08_geundo
```

## 저장 데이터 예시

```js
{
  date: "2026-09-08",
  participantId: "geundo",
  participantName: "근도",
  status: "S",
  note: "러닝 30분 완료",
  gymVisit: false,
  updatedAt: "2026-09-08T12:34:56.000Z"
}
```

재선의 헬스장 방문 기록:

```js
{
  date: "2026-09-08",
  participantId: "jaeseon",
  participantName: "재선",
  status: "S",
  note: "헬스장 완료",
  gymVisit: true,
  updatedAt: "2026-09-08T12:34:56.000Z"
}
```

상태값:

- 성공: `S`
- 실패: `F`
- 패스: `P`

무단은 시트에 저장하지 않습니다. 한국 날짜 기준으로 `지난 날짜 + 기록 없음 + 자동 패스 아님`이면 화면에서 자동 계산합니다.

## 로컬 실행

`index.html`을 더블클릭해서 화면을 볼 수 있습니다. `syncUrl`이 비어 있으면 현재 기기의 localStorage에만 저장됩니다.

공동 저장까지 확인하려면 GitHub Pages 같은 웹 주소로 접속하는 방식을 권장합니다.

## Google Sheets 새로 만들기

1. Google Drive를 엽니다.
2. `새로 만들기`를 클릭합니다.
3. `Google 스프레드시트`를 클릭합니다.
4. 문서 이름을 `우리의 9월`처럼 입력합니다.
5. 첫 번째 시트 이름을 `Records`로 바꿉니다.
6. 첫 행에 아래 헤더를 입력합니다.

```text
key | date | participantId | participantName | status | note | gymVisit | updatedAt
```

헤더를 직접 만들지 않아도 `Code.gs`가 처음 실행될 때 자동으로 만들 수 있습니다.

## Apps Script 만들기

1. Google Sheets 상단 메뉴에서 `확장 프로그램`을 클릭합니다.
2. `Apps Script`를 클릭합니다.
3. 기본으로 만들어진 `Code.gs`를 엽니다.
4. 기존 내용을 모두 지웁니다.
5. 이 프로젝트의 `Code.gs` 전체 내용을 붙여넣습니다.
6. 저장 아이콘을 클릭합니다.

## 새 배포 만들기

1. Apps Script 오른쪽 위 `배포`를 클릭합니다.
2. `새 배포`를 클릭합니다.
3. `유형 선택` 옆 톱니바퀴 아이콘을 클릭합니다.
4. `웹 앱`을 선택합니다.
5. 설명에 `september challenge api`처럼 입력합니다.
6. `다음 사용자로 실행`은 `나`를 선택합니다.
7. `액세스 권한이 있는 사용자`는 `모든 사용자`를 선택합니다.
8. `배포`를 클릭합니다.
9. 권한 승인 화면이 나오면 Google 계정을 선택하고 승인합니다.
10. `/exec`로 끝나는 웹 앱 URL을 복사합니다.

URL 예:

```text
https://script.google.com/macros/s/배포_ID/exec
```

## index.html에 syncUrl 입력

`index.html` 맨 아래의 설정을 찾습니다.

```html
<script>
  window.CONFIG = {
    syncUrl: "",
  };
</script>
```

복사한 `/exec` URL을 넣습니다.

```js
window.CONFIG = {
  syncUrl: "https://script.google.com/macros/s/배포_ID/exec",
};
```

저장 후 페이지를 새로고침하면 상단에 `공동 저장 모드`가 표시됩니다.

## Google Apps Script 테스트

1. 브라우저 주소창에 `/exec` URL을 붙여넣습니다.
2. 아래처럼 JSON이 나오면 GET 조회가 정상입니다.

```json
{"ok":true,"records":[],"data":[]}
```

3. 웹페이지에서 오늘 기록을 하나 저장합니다.
4. Google Sheets의 `Records` 시트에 행이 생겼는지 확인합니다.
5. 웹페이지에서 `기록 새로고침`을 클릭합니다.
6. 기록이 유지되면 공동 저장이 정상입니다.

## GitHub 업로드

1. GitHub에서 새 저장소를 만듭니다.
2. `index.html`, `style.css`, `app.js`를 업로드합니다.
3. `README.md`도 같이 올려도 됩니다.
4. `Code.gs`는 웹페이지 파일이 아니라 Apps Script에 붙여넣는 서버 코드입니다.

## GitHub Pages 활성화

1. GitHub 저장소에서 `Settings`를 클릭합니다.
2. 왼쪽 메뉴에서 `Pages`를 클릭합니다.
3. `Deploy from a branch`를 선택합니다.
4. 브랜치를 선택합니다.
5. 폴더는 루트(`/`)를 선택합니다.
6. `Save`를 클릭합니다.
7. 생성된 `github.io` 주소로 접속합니다.

## 팀원에게 공유

1. `github.io` 주소로 접속합니다.
2. 상단에 `공동 저장 모드`가 표시되는지 확인합니다.
3. 기록을 하나 저장합니다.
4. Google Sheets에 저장되는지 확인합니다.
5. 팀원에게 `github.io` 링크를 공유합니다.

내 컴퓨터를 꺼도 GitHub Pages와 Google Apps Script는 계속 동작합니다. 팀원은 같은 주소로 접속하면 같은 Google Sheets 기록을 봅니다.

## Code.gs 변경 시 주의

`Code.gs`를 수정한 뒤 저장만 하면 이미 배포된 Web App에 바로 반영되지 않을 수 있습니다. 서버 코드를 바꾼 뒤에는 반드시 새 버전으로 다시 배포하세요.

1. Apps Script에서 `Code.gs`를 수정합니다.
2. 저장 아이콘을 클릭합니다.
3. `배포`를 클릭합니다.
4. `배포 관리`를 클릭합니다.
5. 현재 웹 앱 배포의 연필 아이콘을 클릭합니다.
6. `버전`에서 `새 버전`을 선택합니다.
7. `배포`를 클릭합니다.
8. 기존 `/exec` URL은 그대로 사용합니다.

## 기능 규칙

- 기간: 2026년 9월 1일 - 2026년 9월 30일
- 오늘 기록만 입력 및 수정 가능
- 지난 날짜는 수정 불가
- 지난 날짜 중 기록이 없으면 무단 자동 계산
- 미래 날짜는 입력 불가
- 근도 토요일, 일요일은 자동 패스
- 자동 패스는 성공률과 벌금에서 제외
- 재선에게만 `오늘 헬스장 방문` 체크박스 표시
- 재선의 헬스장 주간 횟수는 `성공 + gymVisit true`만 포함
- 기록 저장은 편집창의 `완료` 버튼을 눌렀을 때만 실행
- 자동 30초 조회 없음
- `setInterval` 사용 없음
- 서버 전체 기록 삭제 기능 없음

## 점검 시나리오

- 2026년 9월 1일에는 기록 가능
- 2026년 9월 30일에는 기록 가능
- 2026년 8월 31일은 기간 밖이라 입력 불가
- 2026년 10월 1일은 기간 밖이라 입력 불가
- 오늘 기록은 수정 가능
- 지난 날짜 기록은 수정 불가
- 지난 날짜 미입력은 무단
- 무단 벌금은 3,000원
- 실패 벌금은 2,000원
- 패스 벌금은 0원
- 근도 토요일, 일요일은 자동 패스
- 재선 gymVisit 주간 횟수는 성공 기록만 계산
- 근제와 민경은 매일 집계
- 저장 성공 후 서버 기록을 다시 불러옴
- 브라우저 새로고침 후 기록 유지
