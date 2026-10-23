# Private site images

개인 사진은 `public/`에 넣지 않습니다. 지정된 폴더의 이미지만 인증된 서버 응답으로 제공합니다. 웹 업로드·게시글 첨부·Supabase Storage는 사용하지 않습니다.

```text
private-assets/site/
  home/hero.jpg          # Home 상단 사진 (선택)
  home/background.jpg    # 향후 Home 배경용
  board/banner.jpg       # Board 상단 사진 (선택)
  shared/landscape.jpg   # 향후 공통 사진용
```

## VSCode에서 추가

1. GitHub `tacona1016/project203`의 Settings → General에서 **Private** 저장소임을 먼저 확인합니다. 이번 작업 환경에서는 GitHub 네트워크 연결이 차단되어 공개 여부를 확정하지 못했습니다. Public이면 개인 사진을 커밋하기 전에 Private으로 전환해야 합니다. 과거 공개된 사진은 Private 전환만으로 회수되지 않습니다.
2. VSCode 탐색기에서 위 경로에 JPG 사진을 넣습니다. 파일당 8 MiB 이하를 사용합니다. PNG·WebP·AVIF를 쓰려면 `lib/site-images-config.ts`의 해당 경로 확장자도 바꿉니다. SVG·HTML·HEIC는 제공하지 않습니다.
3. `lib/site-images-config.ts`의 `SITE_IMAGES`가 실제 파일명과 일치하는지 확인합니다. 임의 URL 경로는 허용하지 않으며 새 이미지는 코드에 키를 등록해야 합니다.
4. `npm.cmd run dev`로 확인합니다. Home은 `homeHero`, Board는 `boardBanner`를 사용합니다. 파일이 없거나 형식이 잘못되면 기본 디자인을 표시합니다.
5. 저장소가 Private임을 확인한 뒤 선택한 사진만 명시적으로 추가합니다. 현재 `.gitignore`는 개인 사진의 실수 커밋을 막습니다.

```powershell
git add -f private-assets/site/board/banner.jpg
git add -f private-assets/site/home/hero.jpg
git add lib/site-images-config.ts
git commit -m "Update private site photos"
git push
```

전체 폴더를 일괄 강제 추가하지 않습니다. 같은 경로의 이미지를 교체했을 때는 이미 추적 중이므로 일반 `git add`를 사용하면 됩니다. 기존 Vercel Git 연동으로 배포되며 환경변수는 별도로 유지합니다. Vercel Preview/이전 배포에도 개인 사진이 있으므로 배포 접근 설정과 저장소 멤버 권한도 관리합니다.

## 코드에서 사용

Server Component 안에서 사용합니다. 새로운 키를 등록하면 Route Handler도 같은 허용 목록을 사용합니다.

```tsx
<PrivateSiteImage image="sharedLandscape" alt="사진의 구체적인 설명" />
```

직접 지정할 때는 `next/image`의 `unoptimized`를 사용해 `/api/site-images/<key>`를 호출합니다. 보호된 사진을 정적 import하거나 공개 이미지 최적화 경로에 전달하지 않습니다. 서버는 사이트 세션, 허용 키, 실제 경로 경계, 확장자와 파일 시그니처를 검사합니다. 응답은 `private, no-store`이며 CDN 캐시도 끕니다. `next.config.mjs`는 이미지 Route Handler와 Home/Board의 서버 추적에 이 폴더를 포함합니다.

사이트 비밀번호를 아는 사람과 저장소·Vercel에 접근 가능한 개발자는 사진을 볼 수 있습니다. 인증 후 다운로드한 사진의 재배포를 기술적으로 막는 기능은 아닙니다.
