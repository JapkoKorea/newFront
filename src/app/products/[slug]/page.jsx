import { notFound } from 'next/navigation'
import { getProduct, publishedProducts } from '@/products/registry.js'
import ProductDetailClient from '@/components/ProductDetailClient.jsx'
import { buildFaqSchema, buildBreadcrumbSchema } from '@/components/JsonLd.jsx'

// 정적 데이터 기반이므로 SSG. 등록된 published 상품만큼 페이지가 생성된다.
export function generateStaticParams() {
  return publishedProducts.map((product) => ({ slug: product.slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const product = getProduct(slug)
  if (!product) return {}
  return {
    title: `${product.name}`,
    description: product.summary,
    openGraph: {
      title: `${product.name}`,
      description: product.summary,
      images: product.heroImage ? [{ url: product.heroImage }] : undefined,
    },
  }
}

export default async function ProductDetailPage({ params }) {
  const { slug } = await params
  const product = getProduct(slug)
  if (!product) notFound()

  const lowestPerHour = Math.min(
    ...product.vehicleTiers.map((t) => t.salePerHourJpy || t.regularPerHourJpy),
  )

  // 화면에 실제로 보이는 문답만 구조화한다.
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.summary,
      image: product.heroImage || undefined,
      brand: { '@type': 'Organization', name: '잽코 택시투어' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'JPY',
        price: lowestPerHour,
        availability: 'https://schema.org/InStock',
      },
    },
    buildBreadcrumbSchema([
      { name: '홈', url: '/' },
      { name: '투어 상품', url: '/products' },
      { name: product.name, url: `/products/${product.slug}` },
    ]),
  ]

  if (product.faq.length > 0) {
    schemas.push(buildFaqSchema(product.faq))
  }

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <ProductDetailClient product={product} />
    </>
  )
}
