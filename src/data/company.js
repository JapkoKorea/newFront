// 사업자 정보 — 전자상거래법 제10조(신원 등의 표시) 및 PG 심사 필수 항목.
//
// !! 배포 전 반드시 실제 값으로 채울 것 !!
// 빈 문자열로 두면 화면에 "확인 중"으로 표시되며, 허위 정보가 노출되지 않는다.
// PG(토스페이먼츠) 심사에서는 아래 항목이 모두 채워져 있어야 통과한다.

export const COMPANY = {
  serviceName: '잽코 택시투어',
  // 상호(법인명 또는 개인사업자 상호)
  legalName: '잽코',
  // 대표자명
  representative: '이남준',
  // 사업자등록번호 (000-00-00000)
  businessNumber: '',
  // 통신판매업 신고번호 (제0000-지역-0000호)
  mailOrderNumber: '',
  // 사업장 주소
  address: '서울시 영등포구 여의서로 43 401',
  // 고객센터 전화번호
  phone: '010-4953-7944',
  // 고객센터 이메일
  email: '',
  // 개인정보 보호책임자
  privacyOfficer: '',
  // 호스팅 제공자
  hostingProvider: 'Vercel Inc.',
}

/** 값이 비어 있으면 "확인 중"으로 대체한다. 허위 표기 방지. */
export function companyValue(key) {
  const value = COMPANY[key]
  return value && String(value).trim() ? value : '확인 중'
}

/**
 * 고객센터 연락처 한 줄. 채워진 것만 이어 붙인다.
 *
 * 이메일이 비어 있는데 "010-0000-0000, 확인 중"처럼 쓰면 오히려 어색하다.
 * 있는 것만 보여준다.
 */
export function contactLine() {
  const parts = [COMPANY.phone, COMPANY.email].map((v) => (v || '').trim()).filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : '확인 중'
}

/**
 * 개인정보 보호책임자.
 *
 * 따로 지정하지 않았으면 대표자가 맡는다. 별도 담당자를 두면
 * COMPANY.privacyOfficer 에 이름을 넣는다.
 */
export function privacyOfficerName() {
  const officer = (COMPANY.privacyOfficer || '').trim()
  if (officer) return officer
  const rep = (COMPANY.representative || '').trim()
  return rep || '확인 중'
}

/** 정책 문서 최종 개정일. 내용을 고칠 때마다 갱신할 것. */
export const POLICY_REVISION_DATE = '2026-08-25'
