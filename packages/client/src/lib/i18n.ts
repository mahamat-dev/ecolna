import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

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
      },
      users: { title: 'Users' },
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