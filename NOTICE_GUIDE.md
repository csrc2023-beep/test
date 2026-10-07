# 공지사항 등록 방법

이 홈페이지는 공개 공지를 정적 파일로 게시합니다. 공지 작성용 로그인이나 공개 업로드 API는 사용하지 않습니다.

공지 등록 요청 시 제목, 게시일, 본문, 사진, 첨부파일, 상단 고정 여부를 전달합니다. 등록 작업자는 `notices.js`의 `window.CSDIC_NOTICES` 배열에 공지를 추가하고 GitHub에 게시합니다. 목록, 상세 페이지와 메인 홈은 같은 데이터에서 표시됩니다.

## 데이터 예시 (이 문서의 예시는 실제 게시물로 표시되지 않습니다)

```javascript
window.CSDIC_NOTICES = [
  {
    id: "notice-2026-001",
    title: "공지 제목",
    date: "2026-10-07",
    author: "관리자",
    pinned: false,
    attachments: [
      { name: "안내문.pdf", path: "files/notices/notice-2026-001/guide.pdf" }
    ],
    body: [
      { type: "paragraph", text: "공지 본문입니다.\n줄바꿈도 가능합니다." },
      { type: "heading", text: "1. 안내 사항" },
      { type: "list", items: ["항목 1", "항목 2"], ordered: false },
      { type: "image", src: "assets/notices/notice-2026-001/photo.jpg", alt: "사진 설명", caption: "사진 캡션" }
    ]
  }
];
```

- `id`는 고유한 영문·숫자·하이픈·밑줄 식별자입니다. 기존 공지 수정 시 유지합니다.
- `date`는 `YYYY-MM-DD` 형식이며 공개 게시일입니다. 예약 게시 기능은 없습니다.
- `pinned: true`인 글이 상단에 표시되고, 그 안에서는 게시일 최신 순입니다.
- 첨부파일은 `files/notices/<id>/`, 사진은 `assets/notices/<id>/`에 저장합니다. 실제 파일 경로는 영문·숫자를 사용하고 화면에 표시되는 파일명은 한글을 사용할 수 있습니다.
- 제목과 본문은 일반 텍스트입니다. HTML과 스크립트를 실행하지 않습니다. 문단·제목·목록·사진 블록으로 내용을 구성합니다.
- PDF, HWP, DOCX, XLSX 등은 첨부파일 링크로 다운로드할 수 있습니다.
- 공지 파일과 첨부는 공개 자료입니다. 미공개 초안이나 개인정보, 비밀번호, 비밀키를 저장하지 않습니다.
- 사이트 파일을 추가하거나 수정할 때 `index.html`의 스크립트 버전도 갱신해 캐시를 방지합니다.
- 실제 누적 조회수는 수집하지 않습니다.

공지 주소: `#news?id=notice-2026-001`. 검색과 페이지 번호는 주소에 보존되므로 목록으로 돌아가도 검색 상태를 유지합니다.
