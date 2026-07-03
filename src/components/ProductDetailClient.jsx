'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  MapPin,
  Car,
  CreditCard,
  MessageCircle,
  Gift,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { saveTourBookingPrefill } from '@/lib/bookingPrefill.js'

const SEASON_COLOR = {
  winter: 'bg-blue-100 text-blue-800',
  summer: 'bg-pink-100 text-pink-800',
  all_season: 'bg-green-100 text-green-800',
}

const SEASON_LABEL = {
  winter: '겨울',
  summer: '여름',
  all_season: '사계절',
}

const yen = (value) => `${value.toLocaleString('ko-KR')}엔`
const won = (value) => `${value.toLocaleString('ko-KR')}원`

function Section({ icon: Icon, title, children }) {
  return (
    <section className="border-t border-gray-100 py-8">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
        {Icon ? <Icon className="h-5 w-5 text-yellow-500" /> : null}
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function ProductDetailClient({ product }) {
  const router = useRouter()

  const startBookingFlow = () => {
    saveTourBookingPrefill({
      selectedSpots: product.courseSpots,
      startStep: 1,
      courseName: product.name,
      courseId: product.cta.courseId,
    })
    router.push(product.cta.bookingHref)
  }

  return (
    <div className="min-h-screen bg-white pt-20 pb-28 px-4">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-6 flex items-center gap-1 text-sm text-gray-500">
          <Link href="/" className="hover:text-yellow-500">홈</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/products" className="hover:text-yellow-500">상품</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900">{product.name}</span>
        </nav>

        {/* 히어로 */}
        <div className="overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.heroImage}
            alt={product.heroImageAlt}
            className="h-56 w-full object-cover sm:h-72"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${SEASON_COLOR[product.season]}`}>
            {SEASON_LABEL[product.season]}
          </span>
          {product.badge ? (
            <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-semibold text-gray-900">
              {product.badge}
            </span>
          ) : null}
        </div>

        <h1 className="mt-3 text-2xl font-bold text-gray-900">{product.name}</h1>
        <p className="mt-2 text-gray-600">{product.summary}</p>
        <div className="mt-3 flex items-center gap-1 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          <span>소요시간 {product.durationLabel}</span>
        </div>

        {/* 핵심 특징 */}
        {product.highlights.length > 0 ? (
          <ul className="mt-6 space-y-2 rounded-xl bg-gray-50 p-5">
            {product.highlights.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* 요금 안내 — 전세 정액(charterPricing) 우선, 없으면 시간당(vehicleTiers) */}
        {product.charterPricing.length > 0 ? (
          <Section icon={Car} title="요금 안내 (전세)">
            <div className="overflow-hidden rounded-xl border border-gray-200">
              {product.charterPricing.map((tier, idx) => (
                <div
                  key={tier.durationLabel}
                  className={`flex items-center justify-between px-5 py-4 ${
                    idx > 0 ? 'border-t border-gray-100' : ''
                  }`}
                >
                  <div>
                    <p className="font-semibold text-gray-900">{tier.durationLabel}</p>
                    {tier.note ? <p className="mt-0.5 text-xs text-gray-500">{tier.note}</p> : null}
                  </div>
                  <span className="text-xl font-bold text-gray-900">{yen(tier.priceJpy)}</span>
                </div>
              ))}
            </div>
            {product.jumboNote ? (
              <p className="mt-3 text-xs text-gray-500">{product.jumboNote}</p>
            ) : null}
          </Section>
        ) : null}

        {/* 요금 안내 (시간당) */}
        {product.vehicleTiers.length > 0 ? (
          <Section icon={Car} title="요금 안내 (시간당)">
          <div className="grid gap-4 sm:grid-cols-2">
            {product.vehicleTiers.map((tier) => (
              <div key={tier.name} className="rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-medium text-yellow-600">{tier.capacity}</p>
                <p className="mt-1 font-semibold text-gray-900">{tier.name}</p>
                <div className="mt-3 flex items-baseline gap-2">
                  {tier.salePerHourJpy ? (
                    <>
                      <span className="text-sm text-gray-400 line-through">
                        {yen(tier.regularPerHourJpy)}
                      </span>
                      <span className="text-xl font-bold text-gray-900">
                        {yen(tier.salePerHourJpy)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xl font-bold text-gray-900">
                      {yen(tier.regularPerHourJpy)}
                    </span>
                  )}
                </div>
                {tier.note ? <p className="mt-2 text-xs text-gray-500">{tier.note}</p> : null}
              </div>
            ))}
          </div>
          </Section>
        ) : null}

        {/* 예약 수수료 */}
        {product.reservationFees.length > 0 ? (
          <Section icon={CreditCard} title="예약 수수료">
            <div className="grid gap-4 sm:grid-cols-2">
              {product.reservationFees.map((fee) => (
                <div key={fee.label} className="rounded-xl border border-gray-200 p-5">
                  <p className="font-semibold text-gray-900">{fee.label}</p>
                  <p className="mt-1 text-xl font-bold text-yellow-600">{won(fee.krw)}</p>
                  <p className="mt-1 text-xs text-gray-500">{fee.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              예약 수수료는 일자 변경, 코스 변경, 취소 등 모든 서비스를 포함한 금액입니다. 예약 진행이 안 될 경우 전액 환불해 드립니다.
            </p>
          </Section>
        ) : null}

        {/* 추천 코스 */}
        {product.courseSpots.length > 0 ? (
          <Section icon={MapPin} title="추천 코스 후보">
            <div className="flex flex-wrap gap-2">
              {product.courseSpots.map((spot) => (
                <span
                  key={spot}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700"
                >
                  {spot}
                </span>
              ))}
            </div>
          </Section>
        ) : null}

        {/* 예약 진행 단계 */}
        {product.reservationSteps.length > 0 ? (
          <Section title="예약 진행 방법">
            <ol className="space-y-5">
              {product.reservationSteps.map((step) => (
                <li key={step.title}>
                  <p className="font-semibold text-gray-900">{step.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{step.body}</p>
                  {step.points && step.points.length > 0 ? (
                    <ul className="mt-2 space-y-1 pl-4">
                      {step.points.map((point) => (
                        <li key={point} className="list-disc text-sm text-gray-600">{point}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </Section>
        ) : null}

        {/* 출발/도착 규정 */}
        {product.routeRules.length > 0 ? (
          <Section title="출발지 및 도착지 안내">
            <ul className="space-y-2">
              {product.routeRules.map((rule) => (
                <li key={rule} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* 변경/취소/환불/노쇼 규정 */}
        {product.policies.length > 0 ? (
          <Section title="변경 / 취소 / 환불 / 노쇼 규정">
            <ul className="space-y-2">
              {product.policies.map((policy) => (
                <li key={policy} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                  <span>{policy}</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* FAQ */}
        {product.faq.length > 0 ? (
          <Section title="자주 묻는 질문">
            <dl className="space-y-4">
              {product.faq.map((item) => (
                <div key={item.q} className="rounded-xl bg-gray-50 p-4">
                  <dt className="font-semibold text-gray-900">Q. {item.q}</dt>
                  <dd className="mt-1 text-sm text-gray-600">A. {item.a}</dd>
                </div>
              ))}
            </dl>
          </Section>
        ) : null}

        {/* 리뷰 이벤트 */}
        {product.reviewEvent ? (
          <Section icon={Gift} title={product.reviewEvent.title}>
            <p className="text-sm text-gray-700">{product.reviewEvent.body}</p>
          </Section>
        ) : null}
      </div>

      {/* 하단 고정 CTA */}
      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {product.cta.kakaoUrl ? (
            <a
              href={product.cta.kakaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-800"
            >
              <MessageCircle className="h-4 w-4" />
              카카오톡 문의
            </a>
          ) : null}
          <Button onClick={startBookingFlow} className="flex-1 py-6 text-base font-semibold">
            예약 신청하기
          </Button>
        </div>
      </div>
    </div>
  )
}
