import type { AuditLogRow } from '@/app/actions/platform-admin'

const ACTION_COLOURS: Record<string, string> = {
  'school.created':     'bg-green-100 text-green-700',
  'school.activated':   'bg-blue-100 text-blue-700',
  'school.deactivated': 'bg-red-100 text-red-700',
  'flag.toggled':       'bg-purple-100 text-purple-700',
}

export default function PlatformAuditLogTable({ logs }: { logs: AuditLogRow[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <h2 className="text-[14px] font-semibold text-gray-800">Platform Audit Log</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Time</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Actor</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Action</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Target</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString('en-GB', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                <td className="px-3 py-2.5 text-gray-700 font-medium whitespace-nowrap">{log.actorName}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ACTION_COLOURS[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-gray-400 font-mono text-[10px] truncate max-w-[120px]">
                  {log.target ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-gray-400 max-w-[180px] truncate">
                  {log.metadata ? JSON.stringify(log.metadata) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <p className="text-center py-8 text-[13px] text-gray-400">No audit log entries yet.</p>
        )}
      </div>
    </div>
  )
}
