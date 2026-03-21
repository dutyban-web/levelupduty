# 포모도로 · 퀘스트 시간 데이터 흐름

## 퀘스트를 어제/오늘 나눠서 했을 때

| 저장소 | 동작 |
|--------|------|
| `quests.time_spent_sec` | **누적 합산**. 완료할 때마다 `addQuestTimeSpent`로 그날 경과 초가 더해짐. 날짜와 무관하게 **전체 몰입 시간**이 쌓임. |
| `quests.pomodoro_count` | **누적**. 완료(자연 종료)마다 +1. |
| `daily_logs` (해당 일자) | **그날만**. `upsertDailyLog(오늘, 1, 초)`로 일별 포모 수·몰입 초가 올라감. |
| `calendar_events` `event_type=focus_log` | **세션 단위**. 완료 시점의 `event_date`(오늘)와 `start_time_local`, 퀘스트 메타가 들어감. 위클리 그리드는 여기 + 로컬 로그를 사용. |
| 로컬 `pomodoroLogData` | Supabase와 병행 **백업 시트**. 동일 세션은 `remoteId`로 중복 표시 방지. |

즉, **퀘스트 카드에 보이는 총 시간/도장**은 여러 날에 걸친 합이 맞고, **일별 대시보드·위클리**은 “그날 완료한 세션” 기준입니다.

## 위클리 포모도로 뷰

- Life → 통합 캘린더 → **「위클리 포모도로」** 탭.
- `fetchCalendarEventsInRange('focus_log', …)` + 로컬 로그 병합.
- 수동 입력 시 `insertCalendarEvent(focus_log)` 및 로컬 append, `daily_logs`에도 반영(연결 시).
