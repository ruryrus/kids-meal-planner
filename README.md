# 아이들 식단표 (PWA)

아이들과 함께 먹는 **아침 ①·② / 저녁 ①·②** 메뉴와 레시피를 날짜별로 쌓아 두는 식단 웹앱입니다.
안드로이드 크롬에서 주소를 열고 **⋮ → 홈 화면에 추가**를 누르면 단독 앱처럼 실행됩니다.

- 배포 주소: https://ruryrus.github.io/kids-meal-planner/
- 저장소: https://github.com/ruryrus/kids-meal-planner

## 매일 식단 추가하는 방법 (브리핑에서 하루 1회)

1. `data/menus.json`의 `days` 배열 **맨 뒤에 오늘 날짜 블록을 추가**합니다.
2. `app.updatedAt`을 현재 시각으로 바꿉니다.
3. 커밋 & 푸시하면 몇 초 뒤 앱에 반영됩니다. (앱은 열 때마다 `menus.json`을 네트워크에서 먼저 받아옵니다.)

```bash
cd <로컬 저장소 경로>
# data/menus.json 수정 후
git add data/menus.json
git commit -m "식단 추가: 2026-11-25 (수)"
git push
```

## `data/menus.json` 스키마

```jsonc
{
  "schemaVersion": 1,
  "app": {
    "title": "아이들 식단표",
    "subtitle": "아침 ①·② · 저녁 ①·②",
    "updatedAt": "2026-11-24T11:45:00+09:00"   // ISO 8601, 앱 상단 '최근 업데이트'에 표시
  },
  "days": [                                     // 최신 날짜를 뒤에 추가(앱은 날짜 내림차순 정렬)
    {
      "date": "2026-11-24",                     // YYYY-MM-DD (필수, 고유)
      "weekday": "화",                           // 요일 한 글자(표시용)
      "note": "닭안심·새우·돼지고기·면 — …",      // 그날 식단 한 줄 설명(선택)
      "meals": [                                // 4개 권장
        {
          "id": "2026-11-24-breakfast1",         // 고유 ID (장보기 체크 저장 키)
          "slot": "breakfast1",                  // breakfast1 | breakfast2 | dinner1 | dinner2
          "slotLabel": "아침 ①",                  // 화면 표시용
          "emoji": "🍗",
          "name": "닭안심 간장조림 & 밥",
          "summary": "한 줄 소개",
          "tags": ["저지방 단백질", "식이섬유"],   // 영양소 뱃지 (2~4개)
          "nutrients": "닭안심 고단백·저지방 단백질, …",
          "servings": "3인분",
          "minutes": 20,                          // 조리 시간(분, 숫자)
          "difficulty": "쉬움",                    // 선택
          "keywords": ["닭", "간장조림"],           // 검색 보조 키워드
          "ingredients": [
            { "group": "재료", "name": "닭안심", "amount": "300g" }
          ],
          "steps": ["첫 번째 조리 순서", "두 번째 …"],
          "kidTip": "아이용 팁 한 단락",
          "sources": [
            {
              "type": "원문",                      // "원문" | "참고" | "대안"
              "title": "레시피 제목",
              "author": "작성자",
              "url": "https://www.10000recipe.com/recipe/…",
              "rating": "★5.0 · 후기 136"          // 선택
            }
          ]
        }
      ]
    }
  ]
}
```

### 규칙

- `date`는 `YYYY-MM-DD`, 같은 날짜를 두 번 넣지 마세요.
- `id`는 `날짜-slot` 형태를 유지하면 장보기 체크 기록이 이어집니다.
- `ingredients[].group`이 같으면 화면에서 한 묶음으로 보입니다. (예: `재료`, `양념`, `육수`)
- `sources[].type`이 `참고`면 "같은 메뉴를 공개 레시피로 확인한 링크"로 표시됩니다.
- JSON 문법이 깨지면 앱이 새 데이터를 못 읽으므로, 저장 후 아래로 검증하세요.

```bash
python3 -m json.tool data/menus.json > /dev/null && echo OK
```

## 파일 구성

```
index.html            화면 뼈대
styles.css            디자인(따뜻한 크림 톤, 모바일 퍼스트)
app.js                데이터 로드·검색·상세 시트·장보기 체크(localStorage)
data/menus.json       식단 데이터 (매일 갱신하는 유일한 파일)
manifest.webmanifest  PWA 설정(standalone, 아이콘)
sw.js                 서비스 워커: 최신 데이터 우선 + 오프라인 캐시
icons/                앱 아이콘 (tools/make_icons.py로 생성)
tools/make_icons.py   아이콘 생성 스크립트 (Pillow)
```

## 캐시 갱신

`sw.js`의 `VERSION`을 올리면 앱 껍데기 캐시가 새로 만들어집니다.
`data/menus.json`은 서비스 워커가 **네트워크 우선**으로 처리하므로, 푸시만 하면 따로 손댈 필요가 없습니다.
