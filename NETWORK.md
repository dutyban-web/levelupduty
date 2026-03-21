# Network (인적자원) — DB·캘린더 정합성

## 현재 저장 위치

| 데이터 | 저장소 | 비고 |
|--------|--------|------|
| 연락처 전체(속성, 본문 BlockNote JSON, 히스토리 배열) | **브라우저 `localStorage`** (`creative-os-network-contacts-v1`) | Supabase **전용 테이블 없음** |

`networkData.ts`의 `migrateContact()`가 v1 카드를 읽을 때 빈 문자열·빈 배열로 새 필드를 채웁니다.

## 통합 캘린더 연동

- 히스토리 항목을 추가하면 **Supabase가 연결·로그인된 경우에만** `calendar_events`에 `event_type = 'event'` 로 한 건씩 삽입합니다.
- `content` JSONB에 다음 메타를 넣습니다: `networkContactId`, `networkHistoryId`, `source: 'network_history'`, `endDate`, `color`, `note` 등.
- Life 페이지의 통합 캘린더가 `event` 타입을 이미 표시한다면 **같은 테이블**에 쌓이므로 날짜 기준으로 함께 보입니다.
- **맞지 않는 부분**: DB 스키마에 `event_type = 'network'` 같은 별도 타입은 없습니다. Network 전용으로 필터하려면 `content.source === 'network_history'` 조건을 UI에 추가해야 합니다.

## 향후 Supabase로 본문·연락처를 옮길 때

- `calendar_events`만으로는 긴 BlockNote 본문·다중 속성을 담기 부적합합니다. 일반적으로는 **`network_contacts` + `network_history` 테이블**(또는 `content` JSONB 한 덩어리)을 두고, 히스토리만 캘린더와 이중 저장하는 패턴을 권장합니다.

## 인간관계론 (전역 매뉴얼)

- **저장소**: `localStorage` 키 `creative-os-human-relations-playbook-v1` (`humanRelationsPlaybookData.ts`).
- 연락처와 **무관**한 나만의 대인관계 원칙·체크리스트입니다. 목록 화면 하단과 연락처 상세 화면 하단에 동일 컴포넌트로 표시됩니다.
