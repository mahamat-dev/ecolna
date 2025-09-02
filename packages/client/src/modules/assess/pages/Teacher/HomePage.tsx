import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function TeacherAssessHomePage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('menu.assessTeacher')}</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Link to="/teacher/assess/quizzes/new" className="rounded border p-4 hover:bg-gray-50">
          {t('menu.quizzes')} — {t('common.create') ?? 'Create'}
        </Link>
        <Link to="/teacher/assess/questions" className="rounded border p-4 hover:bg-gray-50">
          {t('menu.questionBank')}
        </Link>
        <Link to="/teacher/assess/quizzes/123/submissions" className="rounded border p-4 hover:bg-gray-50">
          {t('menu.submissions')}
        </Link>
      </div>
    </div>
  );
}