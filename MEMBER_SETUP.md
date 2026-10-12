# CSDIC 회원 서비스 연결

현재 구성: 이메일 가입·인증 → 로그인 → 관리자 승인 → 문서별 권한 확인.
연결 프로젝트: `csdic` (`ppomjjbwsunokbkauktk`), 서울 리전, Free 플랜. 홈페이지 연결 정보와 회원·문서 정책을 적용했습니다. 아래 메일 발송 설정과 최초 관리자 지정은 운영 전에 완료해야 합니다.

## 1. 프로젝트와 인증

- CSDIC용 Supabase 프로젝트를 선택합니다. 기존 자료가 있다면 변경 전 백업하고, 적용 대상 프로젝트를 확인합니다.
- Authentication에서 Email/Password를 사용하고 **Confirm email**을 켭니다.
- 비밀번호 최소 길이를 **12자**로 설정합니다. 가입과 비밀번호 변경 화면도 같은 길이를 검사합니다.
- URL Configuration의 Site URL을 `https://csdic.co.kr`로 설정합니다.
- Redirect URL에 `https://csdic.co.kr/auth.html`을 등록합니다. `www` 주소를 따로 사용할 경우 정확한 `https://www.csdic.co.kr/auth.html`도 등록합니다. 와일드카드 대신 정확한 주소를 사용합니다.
- 실제 외부 회원에게 인증 메일을 보내려면 사용자 정의 SMTP를 연결합니다. 기본 발송 서비스는 제한적인 테스트용이며 일반 가입자에게 정상 발송된다고 가정하면 안 됩니다.
- 2026-06-03 이후 생성한 Free 프로젝트는 기본 SMTP 사용 중 이메일 템플릿을 편집할 수 없습니다. 현재 기본 템플릿과 호환되는 브라우저 인증을 사용합니다. 인증 페이지는 주소의 토큰을 즉시 제거하고 서버에서 사용자를 검증합니다. 세션은 해당 탭의 sessionStorage에만 저장합니다.
- 사용자 정의 SMTP 연결 후 이메일 템플릿의 인증 링크를 아래와 같이 설정할 수 있습니다. 일회용 token hash 방식도 지원하며, 인증 페이지는 주소에서 토큰을 즉시 제거합니다.

Confirm signup 템플릿 링크:

```html
<a href="{{ .SiteURL }}/auth.html?token_hash={{ .TokenHash }}&type=email">이메일 인증</a>
```

Reset password 템플릿 링크:

```html
<a href="{{ .SiteURL }}/auth.html?token_hash={{ .TokenHash }}&type=recovery">비밀번호 재설정</a>
```

## 2. 데이터베이스와 문서

SQL Editor에서 `supabase/member-access.sql`을 적용합니다.

- 가입 시 `memberships`에 일반 회원·승인 대기 상태로 등록됩니다. 가입 메타데이터로 권한을 바꿀 수 없습니다.
- 회원은 자기 상태만 읽을 수 있습니다. 상태 변경은 승인된 관리자 전용 RPC가 처리합니다.
- `member-documents` 버킷은 **Private**입니다. 공개 버킷으로 변경하지 않습니다.
- 다운로드는 사용자 로그인 토큰으로 수행하며 서버에서 이메일 인증·승인 상태·문서별 권한을 매번 확인합니다. 공개 파일 URL이나 signed URL을 회원 자료실에 사용하지 않습니다.
- 문서를 등록하면서 모든 승인 회원 또는 특정 회원에게만 권한을 부여할 수 있습니다. 문서 열람 중지나 회원 이용 제한은 기존 로그인 토큰으로 요청해도 서버가 차단합니다.
- 기존의 광범위한 Storage 정책이 있더라도 이 버킷에는 추가적인 restrictive 정책이 적용됩니다. 다른 버킷의 공개 접근은 변경하지 않습니다.
- 지원 파일: PDF, DOCX, XLSX, PPTX, TXT, ZIP / 최대 20 MB. PDF는 인증된 요청으로 받아 브라우저에서 열람하며 다른 형식은 다운로드합니다.

## 3. 최초 관리자

홈페이지에서 운영자 계정을 가입하고 이메일 인증을 완료한 뒤, 프로젝트 소유자가 해당 계정의 **정확한 이메일**을 확인해 SQL Editor에서 승격합니다. 가입만 했거나 가장 먼저 가입한 계정을 자동으로 관리자로 만들지 않습니다.

```sql
-- 이메일을 실제 운영자 계정으로 바꾸고, 해당 계정이 정확히 한 건인지 먼저 확인합니다.
select id,email,email_confirmed_at from auth.users where email='REPLACE_WITH_ADMIN_EMAIL';

update public.memberships m set role='admin',status='approved'
from auth.users u
where m.user_id=u.id and u.email='REPLACE_WITH_ADMIN_EMAIL'
  and u.email_confirmed_at is not null;
```

일반 관리 화면은 관리자 역할 부여 기능을 제공하지 않습니다. 관리자 계정 권한은 프로젝트 소유자가 관리합니다.

## 4. 홈페이지 연결 정보

`member-config.js`에 Project URL과 **Publishable key**만 넣습니다. 공개 `anon` 키도 지원하지만 새 프로젝트는 Publishable key를 권장합니다. `sb_secret_...`, `service_role` 키, DB 비밀번호, SMTP 비밀번호는 이 파일이나 공개 GitHub에 넣지 않습니다.

```js
window.CSDIC_MEMBER_CONFIG = Object.freeze({
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  publishableKey: "sb_publishable_YOUR_PUBLIC_KEY",
  bucket: "member-documents"
});
```

SDK 2.117.3은 `vendor/`에 고정하여 포함했습니다. 로그인 상태는 브라우저의 해당 탭 sessionStorage에 저장하며 로그아웃·페이지 이동 시 문서의 임시 Blob URL을 회수합니다. 클라이언트 화면의 표시 여부가 접근 권한을 결정하지 않습니다.

## 5. 활성화 전 실제 서비스 검증

1. 운영자 계정으로 회원가입·이메일 인증·로그인·비밀번호 재설정을 실제 메일로 확인합니다.
2. 회원이 승인 전에는 목록과 파일을 받지 못하는지 확인합니다.
3. 관리자 승인 후 허용된 문서를 받을 수 있는지 확인합니다.
4. 특정 회원용 문서를 다른 승인 회원은 받지 못하는지 확인합니다.
5. 비회원이 파일 경로를 알고 직접 요청해도 받지 못하는지 확인합니다.
6. 회원이 자기 승인 상태·관리자 역할을 수정할 수 없는지 확인합니다.
7. 이미 로그인한 회원을 이용 제한하거나 문서 열람을 중지한 뒤 새 파일 요청이 차단되는지 확인합니다.

로컬 PostgreSQL 정책 검증은 `npm ci` 후 `npm run test:members`로 실행합니다. 이 검증은 Supabase의 실제 SMTP·Auth·Storage HTTP 통합 검증을 대체하지 않습니다.

2026-10-12 적용 검증: 실제 Supabase PostgreSQL에서도 가입 시 승인 대기, 비회원·미승인·미인증 접근 차단, 문서별 권한, 자기 권한 변경 차단, 관리자 승인, 기존 로그인 토큰의 이용 제한 반영을 확인했습니다. 검증용 데이터는 트랜잭션을 되돌려 남기지 않았습니다. Security Advisor 경고는 없습니다. 실제 이메일 발송·사용자 가입과 최초 관리자 계정은 별도 확인이 필요합니다.

## 운영 참고

회원자료는 GitHub의 공개 폴더에 올리지 않습니다. 관리 화면에서만 비공개 저장소에 등록합니다. 이미 회원에게 전달된 파일 사본은 회수하거나 재공유를 완전히 방지할 수 없습니다.

공식 문서:
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/storage/buckets/fundamentals
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/auth/sessions/implicit-flow
- https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier
