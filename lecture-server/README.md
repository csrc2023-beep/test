# 회원 자료실 강의 영상 연결

영상 원본과 썸네일은 운영 PC에 두고, CSDIC 홈페이지의 승인된 회원이 로그인 후 시청합니다. 서버가 Supabase에서 로그인 계정의 이메일 인증과 승인 상태를 확인합니다. 홈페이지 문서 자료실과 기존 회원 승인 방식은 그대로 이용합니다.

## Windows PC에서 강의 등록

1. `D:\CSDIC-Videos\lectures` 폴더를 만듭니다. 예전에 사용한 공개 테스트 폴더와 분리합니다.
2. MP4와 대표 이미지를 폴더에 복사합니다. 확장자만 다르고 이름은 동일해야 합니다. 영상 제목은 파일명에서 확장자를 뺀 부분이며 이름 순서대로 표시됩니다. 썸네일은 JPG, PNG, WebP를 지원합니다. 이미지가 없으면 기본 재생 카드가 표시됩니다.

   ```text
   D:\CSDIC-Videos\lectures\01 반도체 기초.mp4
   D:\CSDIC-Videos\lectures\01 반도체 기초.jpg
   D:\CSDIC-Videos\lectures\02 회로 설계.mp4
   D:\CSDIC-Videos\lectures\02 회로 설계.png
   ```

3. `server.py`와 `requirements.txt`를 영상 폴더 바깥의 같은 작업 폴더에 저장합니다. 그 폴더에서 PowerShell을 열고 실행합니다.

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   .\.venv\Scripts\python.exe server.py --library "D:\CSDIC-Videos\lectures"
   ```

4. PC에서 `http://127.0.0.1:8010/api/health`를 열면 `csdic-lectures-v1`이 표시됩니다. 이 주소는 서버가 실행됐는지만 확인합니다. 실제 파일은 로그인 세션 없이 열리지 않습니다. 범용 `py -m http.server`로 운영 강의 폴더를 열지 마세요.

## 외부 회원이 시청할 수 있도록 연결

- 현재 사용하는 Windows PC에서 계속 영상을 제공하려면 [HTTPS 중계 서버 연결 안내](relay/README.md)를 따릅니다.
- 홈페이지는 `https://video.csdic.co.kr`의 강의 서버에 연결하도록 구성되어 있습니다. 영상 전달을 지원하는 HTTPS 프록시를 통해 이 도메인을 운영 PC의 `http://127.0.0.1:8010`으로 연결합니다. 기존 홈페이지와 메일 DNS는 그대로 두고 영상용 호스트만 추가합니다. 예전 `trycloudflare.com` 임시 주소는 사용하지 않습니다.
- 프록시는 `/api/health`, `/api/session`, `/api/lectures` 및 하위 파일 경로를 전달해야 합니다. CORS 요청과 응답, `Authorization`, `Cookie`, `Set-Cookie`, `Range`, HTTP 206을 그대로 전달하고 영상 API 및 이미지에는 캐시를 사용하지 않습니다. 앱은 `https://csdic.co.kr`과 `https://www.csdic.co.kr`에만 자격 증명이 포함된 브라우저 요청을 허용합니다. 영상 호스트에는 별도 Cloudflare 이메일 PIN을 추가하지 않습니다.
- PC와 영상 서버가 켜져 있어야 합니다. 승인된 계정으로 모바일 데이터에서 썸네일과 영상 재생·탐색을 확인하고, 로그아웃 또는 승인 대기 계정에서는 같은 주소로도 영상이 열리지 않는지 확인합니다.
- 일반 브라우저에서 널리 지원되는 H.264 영상과 AAC 오디오가 담긴 MP4를 권장합니다. 다운로드 버튼을 숨기고 파일 접근을 검사하지만, 승인된 시청자의 녹화나 파일 추출을 막는 DRM은 포함하지 않습니다.
