'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  ChevronDown,
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
import { formatDeposit, formatPrimaryPrice, readWishlist, toggleWishlist } from '@/lib/product.js'
import { tourCourses } from '@/data/tourCourses.js'
import CourseSelectModal from '@/components/CourseSelectModal.jsx'
import ReviewList from '@/components/ReviewList.jsx'
import { useAppShell, useDeclareBottomBar } from '@/lib/appShell.jsx'

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

/**
 * 상세 페이지의 한 블록.
 *
 * collapsible 을 주면 접힌 상태로 시작한다. 안내·규정·FAQ 처럼 필요할 때만 펼쳐
 * 보는 블록이 펼쳐진 채 쌓여 있으면 페이지가 모바일에서 8화면을 넘어간다.
 */
function Section({ icon: Icon, title, children, collapsible = false }) {
  if (collapsible) {
    return (
      <details className="group border-t border-gray-100">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-lg font-bold text-gray-900 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            {Icon ? <Icon className="h-5 w-5 text-yellow-500" aria-hidden="true" /> : null}
            {title}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div className="pb-8 pt-1">{children}</div>
      </details>
    )
  }

  return (
    <section className="border-t border-gray-100 py-8">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
        {Icon ? <Icon className="h-5 w-5 text-yellow-500" aria-hidden="true" /> : null}
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function ProductDetailClient({ product }) {
  // 하단 고정 액션 바를 쓰는 화면이라 플로팅 버튼을 접게 한다.
  useDeclareBottomBar()
  const { openChat } = useAppShell()

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
  const priceLabel = formatPrimaryPrice(product)

  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false)
  const [reviewSummary, setReviewSummary] = useState(null)

  // 이 상품에 속한 코스 목록. 상품 파일의 courseIds 순서를 유지한다.
  const productCourses = (product.courseIds || [])
    .map((id) => tourCourses.find((course) => course.id === id))
    .filter(Boolean)

  const startCourseBooking = (course) => {
    setIsCourseModalOpen(false)
    saveTourBookingPrefill({
      departure: course.departure,
      destination: course.destination,
      selectedSpots: course.spots,
      startStep: 2,
      courseName: course.name,
      courseId: course.id,
      productSlug: product.slug,
    })
    router.push('/booking?from=product')
  }

  const startBookingFlow = () => {
    // 코스가 있는 상품은 먼저 코스를 고르게 한다.
    if (productCourses.length > 0) {
      setIsCourseModalOpen(true)
      return
    }

    saveTourBookingPrefill({
      selectedSpots: product.courseSpots,
      startStep: 1,
      courseName: product.name,
      courseId: product.cta.courseId,
      productSlug: product.slug,
    })
    router.push(product.cta.bookingHref)
  }

  return (
    <div className="pb-safe-bar min-h-screen bg-white px-4 pt-20">
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* 히어로 */}
        <div className="relative overflow-hidden rounded-2xl">
          {product.heroImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.heroImage}
              alt={product.heroImageAlt}
              className="h-56 w-full object-cover sm:h-72"
            />
          ) : (
            <div className="flex h-56 w-full items-center justify-center bg-gradient-to-br from-yellow-50 to-amber-100 sm:h-72">
              <span className="text-base font-semibold text-amber-800">{product.name}</span>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleWish}
            aria-label={wished ? '찜 해제' : '찜하기'}
            aria-pressed={wished}
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm transition hover:bg-white">
              <Heart
                aria-hidden="true"
                className={`h-5 w-5 ${wished ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
              />
            </span>
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
        {priceLabel || depositLabel ? (
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {priceLabel ? (
              <span className="text-xl font-bold text-gray-900">{priceLabel}</span>
            ) : null}
            {depositLabel ? <span className="text-sm text-gray-600">{depositLabel}</span> : null}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" aria-hidden="true" />
            소요시간 {product.durationLabel}
          </span>
          {reviewSummary?.count > 0 ? (
            <a href="#reviews" className="flex min-h-11 items-center gap-1 hover:text-gray-700">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" aria-hidden="true" />
              <span className="font-medium text-gray-900">{reviewSummary.average.toFixed(1)}</span>
              후기 {reviewSummary.count}건
            </a>
          ) : null}
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

        {/* 코스 선택 */}
        {productCourses.length > 0 ? (
          <Section icon={MapPin} title="코스 선택">
            <p className="mb-4 text-sm text-gray-600">
              코스를 고르면 출발지·도착지와 방문지가 채워진 상태로 예약이 시작됩니다.
            </p>
            <ul className="space-y-2">
              {productCourses.map((course) => (
                <li key={course.id}>
                  <button
                    type="button"
                    onClick={() => startCourseBooking(course)}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-4 text-left transition hover:border-yellow-300 hover:bg-yellow-50/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold text-gray-900">{course.name}</span>
                        <span className="text-xs text-gray-500">{course.duration}</span>
                      </span>
                      <span className="mt-1 block truncate text-sm text-gray-600">
                        {course.spots.length > 0
                          ? course.spots.slice(0, 3).join(' · ')
                          : `${course.departure} 출발 · ${course.destination} 도착`}
                        {course.spots.length > 3 ? ` 외 ${course.spots.length - 3}곳` : ''}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* 요금 안내 — 전세 정액(charterPricing) 우선, 없으면 시간당(vehicleTiers) */}
        {product.charterPricing.length > 0 ? (
          <Section icon={Car} title="요금 안내 (전세)" collapsible>
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
          <Section icon={Car} title="요금 안내 (시간당)" collapsible>
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
          <Section icon={CreditCard} title="예약 수수료" collapsible>
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

        {/* 예약 진행 단계 */}
        {product.reservationSteps.length > 0 ? (
          <Section title="예약 진행 방법" collapsible>
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
          <Section title="출발지 및 도착지 안내" collapsible>
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
          <Section title="변경 / 취소 / 환불 / 노쇼 규정" collapsible>
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
          <Section title="자주 묻는 질문" collapsible>
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

        {/* 이용 후기 — 실제 이용을 마친 예약자만 작성할 수 있다 */}
        <div id="reviews" className="scroll-mt-20">
          <Section icon={Star} title="이용 후기">
            <ReviewList productSlug={product.slug} onSummary={setReviewSummary} />
          </Section>
        </div>
      </div>

      {/*
        하단 고정 액션 바.
        플로팅 채팅/FAQ 버튼은 useDeclareBottomBar 로 접히므로, 상담 진입점을 여기에 둔다.
      */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          {product.cta.kakaoUrl ? (
            <a
              href={product.cta.kakaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="카카오톡으로 문의하기"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-300 text-gray-700"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </a>
          ) : (
            <button
              type="button"
              onClick={openChat}
              aria-label="채팅 상담"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-300 text-gray-700"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          {depositLabel ? (
            <p className="hidden shrink-0 px-1 font-bold text-gray-900 sm:block">{depositLabel}</p>
          ) : null}
          <Button onClick={startBookingFlow} className="h-12 flex-1 text-base font-semibold">
            예약 신청하기
          </Button>
        </div>
      </div>

      <CourseSelectModal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        productName={product.name}
        courses={productCourses}
        onSelect={startCourseBooking}
      />
    </div>
  )
}
