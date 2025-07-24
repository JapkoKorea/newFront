import { useState } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { ChevronDown, ChevronUp, X, HelpCircle, Clock, CreditCard, MapPin, Phone } from 'lucide-react'

const FAQ = ({ isOpen, onClose }) => {
  const [openItems, setOpenItems] = useState({})

  const faqData = [
    {
      category: '예약 관련',
      icon: <CreditCard className="h-5 w-5" />,
      items: [
        {
          question: '예약은 어떻게 하나요?',
          answer: '웹사이트의 "택시투어 예약하기" 버튼을 클릭하여 온라인으로 예약하거나, 채팅 상담을 통해 예약할 수 있습니다. 예약 시 투어 코스, 날짜, 시간, 인원수를 선택해주세요.'
        },
        {
          question: '예약 취소나 변경이 가능한가요?',
          answer: '투어 시작 24시간 전까지는 무료로 취소 및 변경이 가능합니다. 24시간 이내 취소 시에는 50%의 취소 수수료가 발생하며, 당일 취소는 100% 수수료가 부과됩니다.'
        },
        {
          question: '결제는 어떻게 하나요?',
          answer: '현금, 신용카드, 페이팔 결제가 가능합니다. 온라인 예약 시 카드 결제를 하거나, 투어 당일 현금으로 결제할 수 있습니다.'
        },
        {
          question: '예약 확인은 어떻게 받나요?',
          answer: '예약 완료 후 이메일과 문자메시지로 예약 확인서를 발송해드립니다. 투어 전날에는 최종 안내 메시지를 보내드립니다.'
        }
      ]
    },
    {
      category: '투어 관련',
      icon: <MapPin className="h-5 w-5" />,
      items: [
        {
          question: '투어 시간은 얼마나 걸리나요?',
          answer: '기본 코스는 3시간, 프리미엄 코스는 5시간, 풀데이 코스는 8시간 소요됩니다. 맞춤 코스의 경우 원하시는 시간에 맞춰 조정 가능합니다.'
        },
        {
          question: '어떤 장소들을 방문하나요?',
          answer: '비에이의 대표 관광지인 크리스마스 트리, 푸른 연못, 시라스가 폭포, 팜 토미타, 젠트 힐, 패치워크 로드 등을 방문합니다. 계절에 따라 최적의 코스를 제안해드립니다.'
        },
        {
          question: '가이드는 한국어가 가능한가요?',
          answer: '네, 모든 가이드는 한국어가 가능합니다. 현지 문화와 역사에 대한 전문 지식을 갖춘 한국어 가이드가 동행합니다.'
        },
        {
          question: '몇 명까지 탑승 가능한가요?',
          answer: '일반 택시는 최대 4명, 대형 택시는 최대 8명까지 탑승 가능합니다. 인원수에 따라 적절한 차량을 배정해드립니다.'
        }
      ]
    },
    {
      category: '서비스 관련',
      icon: <Clock className="h-5 w-5" />,
      items: [
        {
          question: '픽업 서비스가 있나요?',
          answer: '네, 삿포로 시내 주요 호텔과 신치토세 공항에서 픽업 서비스를 제공합니다. 예약 시 픽업 장소를 알려주시면 됩니다.'
        },
        {
          question: '날씨가 나쁘면 어떻게 되나요?',
          answer: '안전상의 이유로 투어가 불가능한 경우 전액 환불해드립니다. 경미한 날씨 변화의 경우 실내 관광지로 코스를 변경하여 진행합니다.'
        },
        {
          question: '식사는 포함되나요?',
          answer: '풀데이 코스에는 현지 맛집에서의 점심이 포함됩니다. 다른 코스의 경우 추가 요금으로 식사를 포함할 수 있습니다.'
        },
        {
          question: '아이와 함께 투어가 가능한가요?',
          answer: '네, 아이와 함께 투어가 가능합니다. 카시트가 필요한 경우 미리 알려주시면 준비해드립니다. 아이 친화적인 코스로 조정도 가능합니다.'
        }
      ]
    },
    {
      category: '기타',
      icon: <Phone className="h-5 w-5" />,
      items: [
        {
          question: '긴급 상황 시 연락처는?',
          answer: '투어 중 긴급 상황 발생 시 24시간 운영되는 고객센터(+81-80-1234-5678)로 연락주시기 바랍니다.'
        },
        {
          question: '보험은 가입되어 있나요?',
          answer: '네, 모든 차량과 승객에 대한 종합보험에 가입되어 있습니다. 안전한 투어를 위해 최선을 다하고 있습니다.'
        },
        {
          question: '팁은 어떻게 하나요?',
          answer: '팁은 의무사항이 아니지만, 만족스러운 서비스를 받으셨다면 가이드에게 소정의 팁을 주셔도 됩니다.'
        },
        {
          question: '사진 촬영 서비스가 있나요?',
          answer: '네, 가이드가 여행 중 기념사진을 촬영해드립니다. 전문 사진 촬영 서비스를 원하시면 추가 요금으로 이용 가능합니다.'
        }
      ]
    }
  ]

  const toggleItem = (categoryIndex, itemIndex) => {
    const key = `${categoryIndex}-${itemIndex}`
    setOpenItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-6 w-6 text-yellow-500" />
            <h2 className="text-2xl font-bold text-gray-900">자주 묻는 질문</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            {faqData.map((category, categoryIndex) => (
              <Card key={categoryIndex} className="border-l-4 border-l-yellow-500">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {category.icon}
                    {category.category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {category.items.map((item, itemIndex) => {
                    const key = `${categoryIndex}-${itemIndex}`
                    const isOpen = openItems[key]
                    
                    return (
                      <div key={itemIndex} className="border rounded-lg">
                        <button
                          className="w-full p-4 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
                          onClick={() => toggleItem(categoryIndex, itemIndex)}
                        >
                          <span className="font-medium text-gray-900">{item.question}</span>
                          {isOpen ? (
                            <ChevronUp className="h-5 w-5 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-500" />
                          )}
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 text-gray-600 leading-relaxed">
                            {item.answer}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 p-6 bg-yellow-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">더 궁금한 점이 있으신가요?</h3>
            <p className="text-gray-600 mb-4">
              위에서 답을 찾지 못하셨다면 언제든지 채팅 상담을 통해 문의해주세요. 
              전문 상담원이 친절하게 답변해드립니다.
            </p>
            <Button className="bg-green-500 hover:bg-green-600 text-white">
              채팅 상담 시작하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FAQ

