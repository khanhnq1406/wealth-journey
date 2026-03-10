export interface TopicTag {
  value: string;
  label: string;
  color: string;
}

export const TOPIC_TAGS: TopicTag[] = [
  { value: "Chứng khoán VN", label: "Chứng khoán VN", color: "bg-red-50 text-red-700" },
  { value: "Giao dịch Crypto", label: "Giao dịch Crypto", color: "bg-orange-50 text-orange-700" },
  { value: "Vàng & Bạc", label: "Vàng & Bạc", color: "bg-yellow-50 text-yellow-700" },
  { value: "Ngân sách", label: "Ngân sách", color: "bg-blue-50 text-blue-700" },
  { value: "Tiết kiệm", label: "Tiết kiệm", color: "bg-green-50 text-green-700" },
  { value: "Bất động sản", label: "Bất động sản", color: "bg-purple-50 text-purple-700" },
  { value: "Bảo hiểm", label: "Bảo hiểm", color: "bg-pink-50 text-pink-700" },
  { value: "Tổng hợp", label: "Tổng hợp", color: "bg-stone-100 text-stone-700" },
];

export function getTopicTagColor(value: string): string {
  return TOPIC_TAGS.find((t) => t.value === value)?.color ?? "bg-stone-100 text-stone-700";
}
