import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export type Locale = 'fr'|'en'|'ar';
export function getLocale(): Locale { return (localStorage.getItem('locale') as Locale) || 'fr'; }
export function isRTL(loc: Locale) { return loc === 'ar'; }

const resources = {
  fr: {
    translation: {
      app: { title: 'Ecolna Admin' },
      auth: {
        signIn: 'Se connecter',
        email: 'Email',
        password: 'Mot de passe',
        submit: 'Connexion',
        logout: 'Se déconnecter',
      },
      common: {
        loading: 'Chargement...',
        error: "Une erreur s'est produite",
        search: 'Rechercher',
        searchPlaceholder: 'Tapez pour rechercher des utilisateurs, classes...',
        noResults: 'Aucun résultat trouvé',
        export: 'Exporter',
        retry: 'Réessayer',
        starting: 'Démarrage...',
        save: 'Enregistrer',
        submit: 'Soumettre'
      },
      menu: {
        dashboard: 'Tableau de bord',
        profile: 'Mon Profil',
        users: 'Utilisateurs',
        stages: 'Étapes',
        gradeLevels: 'Niveaux',
        yearsTerms: 'Années & Trimestres',
        subjects: 'Matières',
        sections: 'Classes',
        enrollment: 'Inscriptions',
        guardians: 'Parents/Tuteurs',
        assignments: 'Affectations',
        attendance: 'Présences',
        takeAttendance: 'Prendre la présence',
        content: 'Contenus',
        notes: 'Notes',
        audit: 'Historique',
        assess: 'Évaluations',
        assessStudent: 'Mes évaluations',
        assessTeacher: 'Évaluations (enseignant)',
        questionBank: 'Banque de questions',
        quizzes: 'Quiz',
        submissions: 'Soumissions',
      },
      assess: {
        noneAvailable: 'Aucun quiz disponible pour le moment.',
        untitledQuiz: 'Quiz sans titre',
        noTimeLimit: 'Pas de limite de temps',
        attemptsRemaining: 'tentative(s) restante(s)',
        preview: 'Aperçu',
        start: 'Commencer'
      },
      users: { title: 'Utilisateurs' },
    },
  },
  en: {
    translation: {
      app: { title: 'Ecolna Admin' },
      auth: {
        signIn: 'Sign In',
        email: 'Email',
        password: 'Password',
        submit: 'Sign In',
        logout: 'Logout',
      },
      common: {
        loading: 'Loading...',
        error: 'An error occurred',
        search: 'Search',
        searchPlaceholder: 'Type to search users, classes...',
        noResults: 'No results found',
        export: 'Export',
        retry: 'Retry',
        starting: 'Starting...',
        save: 'Save',
        submit: 'Submit'
      },
      menu: {
        dashboard: 'Dashboard',
        profile: 'My Profile',
        users: 'Users',
        stages: 'Stages',
        gradeLevels: 'Grade Levels',
        yearsTerms: 'Years & Terms',
        subjects: 'Subjects',
        sections: 'Sections',
        enrollment: 'Enrollment',
        guardians: 'Guardians',
        assignments: 'Assignments',
        attendance: 'Attendance',
        takeAttendance: 'Take Attendance',
        content: 'Content',
        notes: 'Notes',
        audit: 'Audit',
        assess: 'Assessments',
        assessStudent: 'My Assessments',
        assessTeacher: 'Assessments (Teacher)',
        questionBank: 'Question Bank',
        quizzes: 'Quizzes',
        submissions: 'Submissions',
      },
      assess: {
        noneAvailable: 'No quizzes available at the moment.',
        untitledQuiz: 'Untitled quiz',
        noTimeLimit: 'No time limit',
        attemptsRemaining: 'attempt(s) remaining',
        preview: 'Preview',
        start: 'Start'
      },
      users: { title: 'Users' },
    },
  },
  ar: {
    translation: {
      app: { title: 'إدارة إيكولنا' },
      auth: {
        signIn: 'تسجيل الدخول',
        email: 'البريد الإلكتروني',
        password: 'كلمة المرور',
        submit: 'دخول',
        logout: 'تسجيل الخروج',
      },
      common: {
        loading: 'جاري التحميل...',
        error: 'حدث خطأ',
        search: 'بحث',
        searchPlaceholder: 'اكتب للبحث عن المستخدمين، الفصول...',
        noResults: 'لا توجد نتائج',
        export: 'تصدير',
        retry: 'إعادة المحاولة',
        starting: 'بدء التشغيل...',
        save: 'حفظ',
        submit: 'إرسال'
      },
      menu: {
        dashboard: 'لوحة التحكم',
        profile: 'ملفي الشخصي',
        users: 'المستخدمون',
        stages: 'المراحل',
        gradeLevels: 'المستويات',
        yearsTerms: 'السنوات والفصول',
        subjects: 'المواد',
        sections: 'الفصول',
        enrollment: 'التسجيل',
        guardians: 'أولياء الأمور',
        assignments: 'المهام',
        attendance: 'الحضور',
        takeAttendance: 'أخذ الحضور',
        content: 'المحتوى',
        notes: 'الملاحظات',
        audit: 'السجل',
        assess: 'التقييمات',
        assessStudent: 'تقييماتي',
        assessTeacher: 'التقييمات (المعلم)',
        questionBank: 'بنك الأسئلة',
        quizzes: 'الاختبارات',
        submissions: 'المرسلات',
      },
      assess: {
        noneAvailable: 'لا توجد اختبارات متاحة في الوقت الحالي.',
        untitledQuiz: 'اختبار بدون عنوان',
        noTimeLimit: 'لا يوجد حد زمني',
        attemptsRemaining: 'محاولة متبقية',
        preview: 'معاينة',
        start: 'بدء'
      },
      users: { title: 'المستخدمون' },
    },
  },
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: 'fr',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;