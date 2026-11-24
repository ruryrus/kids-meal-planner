#!/usr/bin/env python3
"""data/menus.json 에 하루치 식단을 안전하게 추가하는 도우미.

사용법
  1) 그날 식단을 담은 JSON 파일(day 객체 하나)을 만든다.  예: /tmp/day.json
     {
       "date": "2026-11-25",
       "weekday": "수",
       "note": "생선·콩 — 앞선 이틀과 단백질이 겹치지 않게",
       "meals": [ { ... meal 객체 ... }, ... ]
     }
  2) 실행
     python3 tools/add_day.py /tmp/day.json
  3) 커밋 & 푸시 (스크립트가 명령만 알려 준다)

검사하는 것
  - date 형식(YYYY-MM-DD)과 중복 여부
  - meals 4개, slot 이 breakfast1/breakfast2/dinner1/dinner2 인지
  - id 고유성, 필수 필드(name, ingredients, steps, sources)
  - tools/make_icons.py 와 마찬가지로 외부 의존성 없음(Python 표준 라이브러리만)
"""

import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "menus.json"
SLOTS = ["breakfast1", "breakfast2", "dinner1", "dinner2"]
SLOT_LABEL = {"breakfast1": "아침 ①", "breakfast2": "아침 ②",
              "dinner1": "저녁 ①", "dinner2": "저녁 ②"}
KST = timezone(timedelta(hours=9))


def fail(msg):
    print("ERROR:", msg, file=sys.stderr)
    sys.exit(1)


def main():
    if len(sys.argv) != 2:
        fail("사용법: python3 tools/add_day.py <day.json>")
    incoming = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    data = json.loads(DATA.read_text(encoding="utf-8"))

    date = incoming.get("date", "")
    if len(date) != 10 or date.count("-") != 2:
        fail(f"date 형식이 이상합니다: {date!r} (YYYY-MM-DD)")
    if any(d["date"] == date for d in data["days"]):
        fail(f"{date} 식단이 이미 있습니다. 새 날짜만 추가하세요.")

    meals = incoming.get("meals", [])
    if len(meals) != 4:
        fail(f"meals는 4개여야 합니다 (지금 {len(meals)}개)")
    slots = [m.get("slot") for m in meals]
    if sorted(slots) != sorted(SLOTS):
        fail(f"slot 구성이 맞지 않습니다: {slots}")

    existing_ids = {m["id"] for d in data["days"] for m in d["meals"]}
    for m in meals:
        for key in ("id", "name", "ingredients", "steps", "sources"):
            if not m.get(key):
                fail(f"{m.get('name', m.get('id'))} 메뉴에 {key} 가 없습니다.")
        if m["id"] in existing_ids:
            fail(f"id 중복: {m['id']}")
        m.setdefault("slotLabel", SLOT_LABEL[m["slot"]])
        m.setdefault("tags", [])
        m.setdefault("keywords", [])

    data["days"].append({
        "date": date,
        "weekday": incoming.get("weekday", ""),
        "note": incoming.get("note", ""),
        "meals": meals,
    })
    data["days"].sort(key=lambda d: d["date"], reverse=True)
    data.setdefault("app", {})["updatedAt"] = datetime.now(KST).replace(microsecond=0).isoformat()

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK: {date} 식단 4개를 추가했습니다. (총 {len(data['days'])}일)")
    print("이제 아래를 실행하세요:")
    print('  git add data/menus.json')
    print(f'  git commit -m "식단 추가: {date}"')
    print("  git push")


if __name__ == "__main__":
    main()
