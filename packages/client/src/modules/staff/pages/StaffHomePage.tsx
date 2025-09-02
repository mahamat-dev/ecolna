import { Link } from 'react-router-dom';

export default function StaffHomePage() {
  const quickLinks = [
    { to: '/staff/enrollment', label: 'Inscription / Affectations' },
    { to: '/staff/attendance', label: 'Présences (édition)' },
    { to: '/enrollment/guardians', label: 'Liens Parents' },
    { to: '/content/notes', label: 'Rapports' },
  ];

  return (
    <div className="space-y-6">
      <section className="border rounded-2xl p-4">
        <h2 className="text-lg font-semibold">Staff Dashboard</h2>
        <p className="text-sm opacity-70">Quick access</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {quickLinks.map((q) => (
            <Link key={q.to} to={q.to} className="border rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
              <span className="font-medium">{q.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}