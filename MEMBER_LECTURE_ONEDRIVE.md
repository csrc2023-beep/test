# CSDIC 회원 자료실에 OneDrive 강의 영상 올리기

동영상은 학교 또는 직장용 OneDrive에 보관합니다. CSDIC에는 강의 제목, 보기 링크, 압축된 썸네일만 저장됩니다. 회원이 썸네일을 누르면 OneDrive 재생 화면이 새 탭에서 열립니다. 연구실 PC를 영상 서버로 켜 둘 필요는 없습니다.

## 영상 등록

1. 학교 OneDrive에 외부 공유가 허용된 MP4를 업로드합니다. 처음에는 공유해도 되는 테스트 영상으로 확인합니다.
2. 파일 옆 **공유 → 링크 설정**에서 **특정 사용자 / 보기 가능 / 다운로드 차단**을 선택합니다. 실제 시청할 승인 회원 이메일을 지정합니다. 로그인 또는 이메일 인증이 필요할 수 있습니다. 학교에서 외부 사용자 공유를 제한하거나 다운로드 차단 옵션을 제공하지 않으면 해당 영상은 등록하지 않습니다. **링크가 있는 모든 사용자**를 선택하지 않습니다.
3. 공유 설정을 완료한 **보기 링크**를 복사합니다. `https://…sharepoint.com/…` 형식의 학교 또는 직장용 영상 링크를 사용합니다. `1drv.ms` 주소만 보이면 OneDrive 웹의 영상 페이지에서 긴 `sharepoint.com` 영상 보기 링크를 확인합니다. 학교에서 설정한 대상과 다운로드 차단이 그 링크에서도 유지되는지 아래처럼 테스트합니다.
4. CSDIC 관리자 계정에서 **회원 관리 → OneDrive 강의 영상 등록**을 엽니다. 강의 제목, 링크, 썸네일 사진을 넣고 공유 설정 확인란을 체크해 등록합니다. 사진은 선택이며 등록 시 압축합니다. JPG, PNG, WebP를 사용할 수 있습니다.
5. 두 브라우저나 별도 계정으로 확인합니다. 지정한 시청자 계정으로는 영상 재생이 되고 다운로드 메뉴가 없는지, 지정하지 않은 계정에는 같은 링크를 보내도 열리지 않는지 확인합니다. 소유자 계정으로는 다운로드할 수 있으므로 소유자 화면만으로 확인하지 않습니다.

## 회원 권한 관리

- CSDIC은 승인된 회원에게만 게시된 강의의 목록, 링크, 썸네일을 제공합니다. 실제 동영상 접근은 OneDrive의 공유 권한이 결정합니다. 두 서비스의 승인 상태는 자동으로 동기화되지 않습니다.
- CSDIC에서 회원을 차단하거나 강의를 숨길 때는, 필요하면 OneDrive의 **액세스 관리**에서도 해당 사용자를 제거하거나 공유 링크를 삭제합니다. 기존 공유 링크나 직접 부여된 더 넓은 권한도 함께 확인합니다. 다운로드 차단은 화면 녹화를 막는 기능이 아닙니다.

## 홈페이지 설정

이미 가입·승인 기능을 설치한 Supabase 프로젝트에 `supabase/member-lectures.sql`을 적용합니다. `member_lectures`의 RLS로 승인 회원 조회와 관리자 쓰기를 분리하고, `member-lecture-thumbnails`는 비공개로 유지합니다. 동영상 원본과 실제 공유 링크를 공개 GitHub 파일에 작성하지 않습니다.

- [Microsoft: 특정 사용자에게 외부 공유](https://support.microsoft.com/en-us/sharepoint/lists/sharepoint-sharing-and-permissions/external-or-guest-sharing-in-onedrive-sharepoint-and-lists)
- [Microsoft: 보기 전용 파일 다운로드 차단](https://support.microsoft.com/ko-kr/onedrive/block-downloads-for-view-only-files-in-sharepoint-and-onedrive)
