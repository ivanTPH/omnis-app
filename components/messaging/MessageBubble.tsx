import StudentAvatar from '@/components/StudentAvatar'
import type { MessageRow } from '@/app/actions/messaging'

function timeStr(date: Date): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000)   return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function MessageBubble({
  message,
  isOwn,
}: {
  message: MessageRow
  isOwn: boolean
}) {
  if (message.isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[11px] italic text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
          {message.body}
        </span>
      </div>
    )
  }

  const [firstName, ...rest] = message.senderName.split(' ')
  const lastName = rest.join(' ')

  return (
    <div className={`flex gap-2.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'} mb-3`}>
      <div className="shrink-0 mt-0.5">
        <StudentAvatar
          firstName={firstName}
          lastName={lastName}
          avatarUrl={message.senderAvatar}
          size="xs"
        />
      </div>
      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        <div className={`flex items-center gap-1.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span className="text-[11px] font-medium text-gray-600">{message.senderName}</span>
          <span className="text-[10px] text-gray-400">{timeStr(message.sentAt)}</span>
          {message.editedAt && <span className="text-[10px] text-gray-300">(edited)</span>}
        </div>
        <div className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
          isOwn
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-gray-100 text-gray-900 rounded-tl-sm'
        }`}>
          {message.body}
        </div>
      </div>
    </div>
  )
}
