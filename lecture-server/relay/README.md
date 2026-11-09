# 지금 사용하는 PC를 CSDIC에 연결하기

이 설정은 영상을 기존 Windows PC에 보관합니다. `video.csdic.co.kr`의 HTTPS 요청을 공인 IP가 있는 Linux 중계 서버가 받고, Windows PC가 시작한 SSH 연결을 통해 기존 강의 서버로 전달합니다. 학교 PC의 방화벽에 수신 포트를 추가하거나 영상 파일을 중계 서버에 복사할 필요가 없습니다. 사용 중인 네트워크에서 이런 운영 연결이 허용되어 있어야 합니다.

## 1. Windows PC에서 강의 서버와 SSH 확인

기존 강의 서버 창을 켜 둡니다. Windows PC의 새 PowerShell 창에서 실행합니다.

```powershell
Invoke-RestMethod 'http://127.0.0.1:8010/api/health'
ssh -V
```

서버 확인 결과는 `csdic-lectures-v1`입니다. SSH 클라이언트가 없다면 [Microsoft의 OpenSSH 설치 안내](https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_firstuse)에 따라 **클라이언트만** 설치합니다.

중계 서버 접속용 키를 만듭니다. 처음 한 번만 실행하고, 이미 같은 파일이 있으면 덮어쓰지 않습니다.

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh" | Out-Null
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\csdic_video_relay" -C "csdic-video-relay"
Get-Content "$env:USERPROFILE\.ssh\csdic_video_relay.pub"
```

중계 서버에 등록할 것은 `.pub` 공개키 한 줄뿐입니다. 개인키나 비밀번호는 PC 밖으로 보내지 않습니다.

## 2. 공인 IPv4가 있는 Linux 중계 서버에서 준비

기존에 운영 권한이 있는 중계 서버 또는 VPS에서 관리자 계정으로 설정합니다. 배포판 안내에 따라 [Caddy를 설치](https://caddyserver.com/docs/install)합니다.

1. `csdic-relay`라는 별도 일반 계정을 만들고, Windows에서 만든 공개키만 그 계정의 `~/.ssh/authorized_keys`에 등록합니다. `.ssh`는 해당 계정 소유이며 권한은 `700`, `authorized_keys`는 `600`으로 둡니다.
2. [sshd_config.fragment](sshd_config.fragment)의 블록을 `/etc/ssh/sshd_config` **맨 끝**에 추가합니다. 이 계정은 셸 접속 없이 `127.0.0.1:18010` 하나만 전달할 수 있습니다. 관리용 SSH 세션을 유지하면서 `sudo sshd -t`로 검증한 뒤 SSH 서비스를 다시 불러옵니다. Debian/Ubuntu에서는 일반적으로 `sudo systemctl reload ssh`를 사용합니다.
3. [Caddyfile](Caddyfile)의 사이트 블록을 `/etc/caddy/Caddyfile`에 추가합니다. 기존 사이트 블록이 있다면 보존합니다. `sudo caddy validate --config /etc/caddy/Caddyfile`로 확인합니다. 외부 방화벽에서 이 HTTPS 사이트에 필요한 TCP `80`, `443`을 허용합니다. 중계용 `18010`은 외부에 열지 않습니다.
4. My가비아 DNS 관리툴에서 `csdic.co.kr`의 **A / 호스트 `video` / 값 `중계 서버의 공인 IPv4`** 한 줄만 추가합니다. `@`, `www`, 네임서버, 메일 레코드는 유지합니다. DNS가 새 IP를 가리킨 뒤 `sudo systemctl reload caddy`를 실행합니다. Caddy가 도메인의 HTTPS 인증서를 발급합니다.

## 3. Windows PC에서 중계 서버에 연결하고 확인

Windows PC의 새 PowerShell 창에서 `$csdicRelay`를 중계 서버의 공인 IPv4나 SSH 접속용 호스트명으로 바꾸어 실행합니다. 처음 접속 시 표시되는 서버 지문은 중계 서버 관리자 화면에서 확인한 지문과 비교합니다.

```powershell
$csdicRelay = '중계 서버의 공인 IPv4 또는 SSH 호스트명'
ssh -NT -i "$env:USERPROFILE\.ssh\csdic_video_relay" -o IdentitiesOnly=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R '127.0.0.1:18010:127.0.0.1:8010' "csdic-relay@$csdicRelay"
```

성공하면 터미널이 프롬프트로 돌아오지 않고 연결을 유지합니다. 기존 강의 서버 창과 SSH 창을 둘 다 켜 둡니다.

- **중계 서버에서:** `curl -fsS http://127.0.0.1:18010/api/health`가 `csdic-lectures-v1`을 표시하는지 확인합니다.
- **휴대폰 모바일 데이터에서:** [외부 연결 확인 주소](https://video.csdic.co.kr/api/health)에서 같은 결과를 확인합니다. [강의 목록 주소](https://video.csdic.co.kr/api/lectures)를 로그인 없이 직접 열면 `401`이 정상입니다.
- **CSDIC 회원 자료실에서:** 승인된 계정으로 로그인하고 테스트 썸네일을 눌러 재생합니다. 승인 대기 계정에서는 영상을 열 수 없어야 합니다. 회원에게 공유할 주소는 [CSDIC 회원 자료실](https://csdic.co.kr/#resources)입니다.
