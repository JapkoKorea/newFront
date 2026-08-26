'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
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
  Heart,
  Share2,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { saveTourBookingPrefill } from '@/lib/bookingPrefill.js'
import { formatDeposit, readWishlist, toggleWishlist } from '@/lib/product.js'
import { tourCourses } from '@/data/tourCourses.js'

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
  const [wished, setWished] = useState(false)

  useEffect(() => {
    setWished(readWishlist().includes(product.slug))
  }, [product.slug])

  const onToggleWish = () => {
    const next = toggleWishlist(product.slug)
    const active = next.includes(product.slug)
    setWished(active)
    toast(active ? '찜 목록에 담았습니다.' : '찜을 해제했습니다.')
  }

  const onShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const shareData = { title: product.name, text: product.summary, url }
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData)
        return
      }
      await navigator.clipboard.writeText(url)
      toast('링크를 복사했습니다.')
    } catch {
      // 사용자가 공유를 취소한 경우 등은 무시
    }
  }

  const depositLabel = formatDeposit(product)

  // 이 상품에 속한 코스 목록. 상품 파일의 courseIds 순서를 유지한다.
  const productCourses = (product.courseIds || [])
    .map((id) => tourCourses.find((course) => course.id === id))
    .filter(Boolean)

  const startCourseBooking = (course) => {
    saveTourBookingPrefill({
      departure: course.departure,
      destination: course.destination,
      selectedSpots: course.spots,
      startStep: 2,
      courseName: course.name,
      courseId: course.id,
    })
    router.push('/booking?from=product')
  }

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
        <div className="mb-6 flex items-center justify-between">
          <nav className="flex items-center gap-1 text-sm text-gray-500">
            <Link href="/" className="hover:text-yellow-500">홈</Link>
            <ChevronRight className="h-4 w-4" />
            <Link href="/products" className="hover:text-yellow-500">투어 상품</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-gray-900">{product.name}</span>
          </nav>
          <button
            type="button"
            onClick={onShare}
            aria-label="공유하기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        {/* 히어로 */}
        <div className="relative overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.heroImage}
            alt={product.heroImageAlt}
            className="h-56 w-full object-cover sm:h-72"
          />
          <button
            type="button"
            onClick={onToggleWish}
            aria-label={wished ? '찜 해제' : '찜하기'}
            aria-pressed={wished}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm transition hover:bg-white"
          >
            <Heart className={`h-5 w-5 ${wished ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
          </button>
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
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            소요시간 {product.durationLabel}
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-4 w-4" />
            후기 준비중
          </span>
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

        {/* 코스 선택 */}
        {productCourses.length > 0 ? (
          <Section icon={MapPin} title="코스 선택">
            <p className="mb-4 text-sm text-gray-600">
              원하는 코스를 고르면 출발지·도착지와 방문지가 채워진 상태로 예약을 시작합니다.
              코스는 예약 중에도 바꿀 수 있습니다.
            </p>
            <div className="space-y-3">
              {productCourses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-xl border border-gray-200 p-4 transition hover:border-yellow-400"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{course.name}</p>
                      <p className="mt-1 text-sm text-gray-600">{course.description}</p>
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      {course.duration}
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-gray-500">
                    {course.departure} 출발 · {course.destination} 도착
                  </p>

                  {course.spots.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {course.spots.map((spot) => (
                        <span
                          key={spot}
                          className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-700"
                        >
                          {spot}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-yellow-500 hover:bg-yellow-600"
                      onClick={() => startCourseBooking(course)}
                    >
                      이 코스로 예약
                    </Button>
                    <Link href={`/tours/${course.id}`}>
                      <Button size="sm" variant="outline">경로 보기</Button>
                    </Link>
                  </div>
                </div>
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

        {/* 후기 (준비중 placeholder — 실제 후기 시스템 연동 예정) */}
        <Section icon={Star} title="이용 후기">
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
            <Star className="mx-auto h-6 w-6 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-700">후기 기능을 준비하고 있습니다.</p>
            <p className="mt-1 text-xs text-gray-500">
              투어 후 포토 리뷰를 남기면 이곳에 표시됩니다.
            </p>
          </div>
        </Section>
      </div>

      {/* 하단 고정 CTA */}
      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {depositLabel ? (
            <p className="hidden shrink-0 font-bold text-gray-900 sm:block">{depositLabel}</p>
          ) : null}
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
