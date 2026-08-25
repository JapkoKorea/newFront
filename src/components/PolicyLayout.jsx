import { POLICY_REVISION_DATE } from '@/data/company.js'

/** 약관/정책 문서 공통 레이아웃. 본문은 children으로 받는다. */
export default function PolicyLayout({ title, description, children }) {
  return (
    <div className="min-h-screen bg-white px-4 pt-20 pb-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description ? <p className="mt-2 text-sm text-gray-600">{description}</p> : null}
        <p className="mt-2 text-xs text-gray-500">시행일 {POLICY_REVISION_DATE}</p>
        <div className="mt-8 space-y-8">{children}</div>
      </div>
    </div>
  )
}

/** 조항 한 개. 제목 + 본문 문단들. */
export function Article({ title, children }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  )
}

/** 번호 없는 항목 목록. */
export function Bullets({ items }) {
  return (
    <ul className="ml-4 list-disc space-y-1.5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

/** 표. columns는 헤더 문자열 배열, rows는 문자열 배열의 배열. */
export function PolicyTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="mt-2 w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="border-y border-gray-200 bg-gray-50">
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 text-left font-semibold text-gray-800">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-gray-100">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 align-top text-gray-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
