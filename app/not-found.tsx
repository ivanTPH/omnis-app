import Link from 'next/link'
import Icon from '@/components/ui/Icon'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-6">
          <Icon name="construction" size="lg" className="text-blue-700" />
        </div>
        <h1 className="text-page-title mb-2">Page not found</h1>
        <p className="text-gray-500 mb-6">This page doesn&apos;t exist or you don&apos;t have access to it.</p>
        <Link href="/" className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
