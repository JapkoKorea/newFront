import Link from 'next/link'
import { COMPANY, companyValue } from '@/data/company.js'

const POLICY_LINKS = [
  { href: '/terms', label: '이용약관' },
  { href: '/privacy', label: '개인정보처리방침' },
  { href: '/refund', label: '취소 및 환불 정책' },
]

const SERVICE_LINKS = [
  { href: '/pricing', label: '요금 안내' },
  { href: '/reviews', label: '이용 후기' },
  { href: '/reservations', label: '예약 확인' },
]

/** 값이 없으면 아무것도 그리지 않는다. 빈 항목이나 "확인 중" 을 띄우지 않기 위함. */
function InfoItem({ label, value }) {
  if (!value) return null
  return (
    <span className="whitespace-nowrap">
      <span className="text-gray-500">{label}</span>{' '}
      <span className="text-gray-700">{value}</span>
    </span>
  )
}

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <p className="text-base font-bold text-gray-900">{COMPANY.serviceName}</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              홋카이도 비에이·후라노 지역 전문 택시투어 예약 서비스입니다.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900">서비스</p>
            <ul className="mt-1">
              {SERVICE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex min-h-11 items-center text-sm text-gray-600 hover:text-gray-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900">약관 및 정책</p>
            <ul className="mt-1">
              {POLICY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex min-h-11 items-center text-sm text-gray-600 hover:text-gray-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-6">
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            <InfoItem label="상호" value={companyValue('legalName')} />
            <InfoItem label="대표자" value={companyValue('representative')} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs">
            <InfoItem label="주소" value={companyValue('address')} />
            <InfoItem label="고객센터" value={companyValue('phone')} />
          </div>
          {/*
            전자상거래법 제10조 표시 항목. 값이 채워지면 자동으로 나온다.
            통신판매업 신고번호는 현재 면제 대상이라 비어 있다(data/company.js 참고).
          */}
          {COMPANY.businessNumber || COMPANY.mailOrderNumber ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs">
              <InfoItem label="사업자등록번호" value={COMPANY.businessNumber} />
              <InfoItem label="통신판매업 신고번호" value={COMPANY.mailOrderNumber} />
            </div>
          ) : null}
          <p className="mt-4 text-xs leading-relaxed text-gray-500">
            {COMPANY.serviceName}는 현지 운송사업자가 제공하는 택시투어 서비스의 예약을 중개하는
            통신판매중개자이며, 투어의 실제 운행은 현지 운송사업자가 수행합니다. 다만 예약 및
            결제 과정에서 발생한 문제에 대해서는 고객센터를 통해 책임 있게 안내합니다.
          </p>
          <p className="mt-3 text-xs text-gray-400">
            &copy; {new Date().getFullYear()} {COMPANY.serviceName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
