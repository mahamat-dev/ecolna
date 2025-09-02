import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Providers } from '@/providers';
import { SignIn } from '@/pages/auth/SignIn';
import Dashboard from '@/pages/Dashboard';
import { UsersList } from '@/pages/identity/UsersList';
import { UserCreate } from '@/pages/identity/UserCreate';
import { UserDetail } from '@/pages/identity/UserDetail';
import { Stages } from '@/pages/academics/Stages';
import { GradeLevels } from '@/pages/academics/GradeLevels';
import { Subjects } from '@/pages/academics/Subjects';
import { Sections } from '@/pages/academics/Sections';
import { Enrollments } from '@/pages/enrollment/Enrollments';
import { GuardianLinks } from '@/pages/enrollment/GuardianLinks';
import { Assignments } from '@/pages/teaching/Assignments';
import { Sessions } from '@/pages/attendance/Sessions';
import { TakeAttendance } from '@/pages/attendance/TakeAttendance';
import { AuditTimeline } from '@/pages/audit/AuditTimeline';
import { Profile } from '@/pages/Profile';
import NotesListPage from '@/modules/content/pages/NotesListPage';
import NoteCreatePage from '@/modules/content/pages/NoteCreatePage';
import NoteDetailPage from '@/modules/content/pages/NoteDetailPage';
import { AuthGuard, RoleGuard } from '@/guards';
import { AppShell } from '@/shell/AppShell';
import AssessListPage from '@/modules/assess/pages/AssessListPage';
import AttemptPage from '@/modules/assess/pages/AttemptPage';
import TeacherAssessHomePage from '@/modules/assess/pages/Teacher/HomePage';
import QuizCreatePage from '@/modules/assess/pages/Teacher/QuizCreatePage';
import SubmissionsPage from '@/modules/assess/pages/Teacher/SubmissionsPage';
import QuestionBankPage from '@/modules/assess/pages/Teacher/QuestionBankPage';
import StudentHomePage from '@/modules/student/pages/StudentHomePage';
import StudentNotesPage from '@/modules/student/pages/StudentNotesPage';
import StudentNoteDetailPage from '@/modules/student/pages/StudentNoteDetailPage';
import StudentAttendancePage from '@/modules/student/pages/StudentAttendancePage';
import StudentAssessPage from '@/modules/student/pages/StudentAssessPage';
import GuardianHomePage from '@/modules/guardian/pages/GuardianHomePage';
import GuardianAttendancePage from '@/modules/guardian/pages/GuardianAttendancePage';
import StaffHomePage from '@/modules/staff/pages/StaffHomePage';
import StaffEnrollmentPage from '@/modules/staff/pages/StaffEnrollmentPage';
import StaffAttendanceEditPage from '@/modules/staff/pages/StaffAttendanceEditPage';
import TeacherHomePage from '@/modules/teacher/pages/TeacherHomePage';

const router = createBrowserRouter([
  { path: '/sign-in', element: <SignIn /> },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'profile', element: <Profile /> },
      // Student portal routes
      {
        path: 'student',
        element: (
          <RoleGuard roles={["STUDENT", "ADMIN", "STAFF", "TEACHER"]}>
            <StudentHomePage />
          </RoleGuard>
        ),
      },
      {
        path: 'student/notes',
        element: (
          <RoleGuard roles={["STUDENT", "ADMIN", "STAFF", "TEACHER"]}>
            <StudentNotesPage />
          </RoleGuard>
        ),
      },
      {
        path: 'student/notes/:id',
        element: (
          <RoleGuard roles={["STUDENT", "ADMIN", "STAFF", "TEACHER"]}>
            <StudentNoteDetailPage />
          </RoleGuard>
        ),
      },
      {
        path: 'student/attendance',
        element: (
          <RoleGuard roles={["STUDENT", "ADMIN", "STAFF", "TEACHER"]}>
            <StudentAttendancePage />
          </RoleGuard>
        ),
      },
      {
        path: 'student/assess',
        element: (
          <RoleGuard roles={["STUDENT", "ADMIN", "STAFF", "TEACHER"]}>
            <StudentAssessPage />
          </RoleGuard>
        ),
      },
      {
        path: 'student/assess/attempt/:attemptId',
        element: (
          <RoleGuard roles={["STUDENT", "ADMIN", "STAFF", "TEACHER"]}>
            <AttemptPage />
          </RoleGuard>
        ),
      },
      // Guardian portal routes
      {
        path: 'guardian',
        element: (
          <RoleGuard roles={["GUARDIAN", "ADMIN", "STAFF"]}>
            <GuardianHomePage />
          </RoleGuard>
        ),
      },
      {
        path: 'guardian/attendance',
        element: (
          <RoleGuard roles={["GUARDIAN", "ADMIN", "STAFF"]}>
            <GuardianAttendancePage />
          </RoleGuard>
        ),
      },
      {
        path: 'guardian/notes',
        element: (
          <RoleGuard roles={["GUARDIAN", "ADMIN", "STAFF"]}>
            <StudentNotesPage />
          </RoleGuard>
        ),
      },
      {
        path: 'guardian/notes/:id',
        element: (
          <RoleGuard roles={["GUARDIAN", "ADMIN", "STAFF"]}>
            <StudentNoteDetailPage />
          </RoleGuard>
        ),
      },
      {
        path: 'identity/users',
        element: (
          <RoleGuard roles={["ADMIN"]}>
            <UsersList />
          </RoleGuard>
        ),
      },
      {
         path: 'identity/users/create',
         element: (
           <RoleGuard roles={["ADMIN"]}>
             <UserCreate />
           </RoleGuard>
         ),
       },
       {
          path: 'identity/users/:id',
          element: (
            <RoleGuard roles={["ADMIN"]}>
              <UserDetail />
            </RoleGuard>
          ),
        },
        // Academics routes
        {
          path: 'academics/stages',
          element: (
            <RoleGuard roles={["ADMIN"]}>
              <Stages />
            </RoleGuard>
          ),
        },
        {
          path: 'academics/grade-levels',
          element: (
            <RoleGuard roles={["ADMIN"]}>
              <GradeLevels />
            </RoleGuard>
          ),
        },
        {
          path: 'academics/subjects',
          element: (
            <RoleGuard roles={["ADMIN"]}>
              <Subjects />
            </RoleGuard>
          ),
        },
        {
           path: 'academics/sections',
           element: (
             <RoleGuard roles={["ADMIN"]}>
               <Sections />
             </RoleGuard>
           ),
         },
         // Enrollment routes
         {
           path: 'enrollment',
           element: (
             <RoleGuard roles={["ADMIN", "STAFF"]}>
               <Enrollments />
             </RoleGuard>
           ),
         },
         {
           path: 'enrollment/guardians',
           element: (
             <RoleGuard roles={["ADMIN", "STAFF"]}>
               <GuardianLinks />
             </RoleGuard>
           ),
         },
         // Teaching routes
         {
           path: 'teaching/assignments',
           element: (
             <RoleGuard roles={["ADMIN"]}>
               <Assignments />
             </RoleGuard>
           ),
         },
         // Teacher dashboard
         {
           path: 'teacher',
           element: (
             <RoleGuard roles={["ADMIN", "TEACHER"]}>
               <TeacherHomePage />
             </RoleGuard>
           ),
         },
         // Attendance routes
         {
           path: 'attendance/sessions',
           element: (
             <RoleGuard roles={["ADMIN", "STAFF"]}>
               <Sessions />
             </RoleGuard>
           ),
         },
         {
           path: 'attendance/take',
           element: (
             <RoleGuard roles={["ADMIN", "STAFF"]}>
               <TakeAttendance />
             </RoleGuard>
           ),
         },
         // Content routes
         {
           path: 'content/notes',
           element: <NotesListPage />,
         },
         {
           path: 'content/notes/new',
           element: (
             <RoleGuard roles={["ADMIN", "STAFF", "TEACHER"]}>
               <NoteCreatePage />
             </RoleGuard>
           ),
         },
         {
           path: 'content/notes/:id',
           element: <NoteDetailPage />,
         },
         // Audit route
         {
           path: 'audit',
           element: (
             <RoleGuard roles={["ADMIN"]}>
               <AuditTimeline />
             </RoleGuard>
           ),
         },
         // Assessments — Student
         {
           path: 'assess',
           element: (
             <RoleGuard roles={["STUDENT"]}>
               <AssessListPage />
             </RoleGuard>
           ),
         },
         {
           path: 'assess/attempt/:attemptId',
           element: (
             <RoleGuard roles={["STUDENT"]}>
               <AttemptPage />
             </RoleGuard>
           ),
         },
         // Assessments — Teacher/Admin
         {
           path: 'teacher/assess',
           element: (
             <RoleGuard roles={["ADMIN", "TEACHER"]}>
               <TeacherAssessHomePage />
             </RoleGuard>
           ),
         },
         {
           path: 'teacher/assess/quizzes/new',
           element: (
             <RoleGuard roles={["ADMIN", "TEACHER"]}>
               <QuizCreatePage />
             </RoleGuard>
           ),
         },
         {
           path: 'teacher/assess/quizzes/:quizId/submissions',
           element: (
             <RoleGuard roles={["ADMIN", "TEACHER"]}>
               <SubmissionsPage />
             </RoleGuard>
           ),
         },
         {
           path: 'teacher/assess/questions',
           element: (
             <RoleGuard roles={["ADMIN", "TEACHER"]}>
               <QuestionBankPage />
             </RoleGuard>
           ),
         },
         // Staff portal route (optional quick links)
         {
            path: 'staff',
            element: (
              <RoleGuard roles={["STAFF", "ADMIN"]}>
                <StaffHomePage />
              </RoleGuard>
            ),
          },
          {
            path: 'staff/enrollment',
            element: (
              <RoleGuard roles={["STAFF", "ADMIN"]}>
                <StaffEnrollmentPage />
              </RoleGuard>
            ),
          },
          {
            path: 'staff/attendance',
            element: (
              <RoleGuard roles={["STAFF", "ADMIN"]}>
                <StaffAttendanceEditPage />
              </RoleGuard>
            ),
          },
    ],
  },
]);

export function AppRouter() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}