'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markSchoolLive } from '@/app/actions/go-live'

export default function GoLiveButton({ ready }: { ready: boolean }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const router = useRouter()
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-[13px] text-gray-600 mb-3">
        Going live lets you send invitations to pupils and open parent registration. It does not send anything by itself.
      </p>
      <button
        disabled={!ready || pending}
        onClick={() => start(async () => {
          setError('')
          try { await markSchoolLive(); router.refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong') }
        })}
        className="px-5 py-2.5 rounded-lg bg-gray-900 text-white text-[13px] font-semibold disabled:opacity-40"
      >
        {pending ? 'Saving…' : 'Go live'}
      </button>
      {!ready && <p className="text-[12px] text-gray-500 mt-2">Finish the essential steps above first.</p>}
      {error && <p className="text-[12px] text-red-700 mt-2">{error}</p>}
    </div>
  )
}
