import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { History, User, Calendar, Info } from 'lucide-react';

interface AuditEvent extends Record<string, unknown> {
  id: string;
  at: string;
  actorUserId: string | null;
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  actorRoles?: string[] | null;
  ip?: string | null;
}

export function AuditTimeline() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit', { limit: 200 }],
    queryFn: () =>
      get<{
        items: AuditEvent[];
        nextCursor: { cursorAt: string | null; cursorId: string | null } | null;
      }>('admin/audit?limit=200'),
  });

  const events: AuditEvent[] = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-2 w-2 bg-gray-200 rounded-full mt-2"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <Info className="h-5 w-5" />
            <h3 className="font-medium">Audit non disponible</h3>
          </div>
          <p className="text-yellow-700 mt-2">
            Le système d'audit n'est pas encore configuré sur le serveur. Cette fonctionnalité sera disponible prochainement.
          </p>
        </div>
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <History className="h-8 w-8 text-gray-400" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Historique d'audit</h1>
            <p className="text-gray-600 mt-1">Suivi des activités du système</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun événement d'audit</h3>
          <p className="text-gray-600">
            Les activités du système apparaîtront ici une fois qu'elles commenceront à être enregistrées.
          </p>
        </div>
      </div>
    );
  }

  // Group events by date
  const groupedEvents = events.reduce((groups, event) => {
    const date = new Date(event.at).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
    return groups;
  }, {} as Record<string, AuditEvent[]>);

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-green-100 text-green-800';
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'bg-blue-100 text-blue-800';
    if (action.includes('DELETE') || action.includes('REMOVE')) return 'bg-red-100 text-red-800';
    if (action.includes('LOGIN') || action.includes('AUTH')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getActionIcon = (action: string) => {
    if (action.includes('CREATE')) return '+';
    if (action.includes('UPDATE') || action.includes('EDIT')) return '✏️';
    if (action.includes('DELETE') || action.includes('REMOVE')) return '🗑️';
    if (action.includes('LOGIN') || action.includes('AUTH')) return '🔐';
    return '📝';
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <History className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Historique d'audit</h1>
          <p className="text-gray-600 mt-1">Suivi des activités du système ({events.length} événements)</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="space-y-8">
            {Object.entries(groupedEvents).map(([date, dayEvents]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <h2 className="text-lg font-semibold text-gray-900">{date}</h2>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                    {dayEvents.length} événement{dayEvents.length > 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="space-y-4 ml-8">
                  {dayEvents.map((event) => (
                    <div key={event.id} className="flex gap-4 pb-4 border-b border-gray-100 last:border-b-0">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
                          {getActionIcon(event.action)}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${getActionColor(event.action)}`}>
                            {event.action}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(event.at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        
                        <p className="text-gray-900 font-medium mb-1">{event.summary}</p>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>Utilisateur: {event.actorUserId ?? '—'}</span>
                          </div>
                          {event.entityType && (
                            <span>Type: {event.entityType}</span>
                          )}
                          {event.entityId && (
                            <span>ID: {event.entityId}</span>
                          )}
                        </div>
                        
                        {event.meta && Object.keys(event.meta).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800">
                              Voir les détails
                            </summary>
                            <pre className="mt-2 p-3 bg-gray-50 rounded text-xs text-gray-700 overflow-x-auto">
                              {JSON.stringify(event.meta, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}