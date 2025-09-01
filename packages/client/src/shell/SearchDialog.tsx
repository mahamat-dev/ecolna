import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { UsersIcon, BookOpenIcon } from '@/icons';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface User {
  id: string;
  email?: string;
  loginId?: string;
  profile?: {
    firstName: string;
    lastName: string;
  };
}

interface Section {
  id: string;
  name: string;
  gradeLevel?: {
    name: string;
  };
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Assignment {
  id: string;
  teacherProfileId: string;
  classSectionId: string;
  subjectId: string;
  teacher?: {
    firstName: string;
    lastName: string;
  };
  classSection?: {
    name: string;
  };
  subject?: {
    name: string;
  };
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const { data: users } = useQuery({
    queryKey: ['search-users'],
    queryFn: () => get<User[]>('admin/users'),
    enabled: open,
  });

  const { data: sections } = useQuery({
    queryKey: ['search-sections'],
    queryFn: () => get<Section[]>('academics/class-sections'),
    enabled: open,
  });

  const { data: subjects } = useQuery({
    queryKey: ['search-subjects'],
    queryFn: () => get<Subject[]>('academics/subjects'),
    enabled: open,
  });

  const { data: assignments } = useQuery({
    queryKey: ['search-assignments'],
    queryFn: () => get<Assignment[]>('teaching/assignments'),
    enabled: open,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(true);
      }
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange]);

  const filteredUsers = users?.filter(user => {
    if (!query) return false;
    const searchTerm = query.toLowerCase();
    const fullName = `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.toLowerCase();
    return fullName.includes(searchTerm) || 
           user.email?.toLowerCase().includes(searchTerm) ||
           user.loginId?.toLowerCase().includes(searchTerm);
  }) || [];

  const filteredSections = sections?.filter(section => {
    if (!query) return false;
    const searchTerm = query.toLowerCase();
    return section.name.toLowerCase().includes(searchTerm) ||
           section.gradeLevel?.name.toLowerCase().includes(searchTerm);
  }) || [];

  const filteredSubjects = subjects?.filter(subject => {
    if (!query) return false;
    const searchTerm = query.toLowerCase();
    return subject.name.toLowerCase().includes(searchTerm) ||
           subject.code.toLowerCase().includes(searchTerm);
  }) || [];

  const filteredAssignments = assignments?.filter(assignment => {
    if (!query) return false;
    const searchTerm = query.toLowerCase();
    const teacherName = `${assignment.teacher?.firstName || ''} ${assignment.teacher?.lastName || ''}`.toLowerCase();
    return teacherName.includes(searchTerm) ||
           assignment.classSection?.name.toLowerCase().includes(searchTerm) ||
           assignment.subject?.name.toLowerCase().includes(searchTerm);
  }) || [];

  const handleUserClick = (user: User) => {
    navigate(`/identity/users/${user.id}`);
    onOpenChange(false);
    setQuery('');
  };

  const handleSectionClick = (section: Section) => {
    navigate(`/academics/sections/${section.id}`);
    onOpenChange(false);
    setQuery('');
  };

  const handleSubjectClick = () => {
    navigate(`/academics/subjects`);
    onOpenChange(false);
    setQuery('');
  };

  const handleAssignmentClick = () => {
    navigate(`/teaching/assignments`);
    onOpenChange(false);
    setQuery('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[20vh]">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-lg mx-4">
        <div className="p-6">
          <input
            type="text"
            placeholder={`${t('common.search')}... (⌘K)`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:focus:ring-brand-400 dark:focus:border-brand-400 transition-colors"
            autoFocus
          />
        </div>
        
        {query && (
          <div className="max-h-96 overflow-y-auto">
            {filteredUsers.length > 0 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <UsersIcon />
                  {t('menu.users')}
                </h3>
                <div className="space-y-1">
                  {filteredUsers.slice(0, 5).map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleUserClick(user)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none transition-colors"
                    >
                      <div className="font-medium text-gray-900 dark:text-white">
                        {user.profile?.firstName} {user.profile?.lastName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {user.email || user.loginId}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {filteredSections.length > 0 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <BookOpenIcon />
                  {t('menu.sections')}
                </h3>
                <div className="space-y-1">
                  {filteredSections.slice(0, 5).map(section => (
                    <button
                      key={section.id}
                      onClick={() => handleSectionClick(section)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none transition-colors"
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{section.name}</div>
                      {section.gradeLevel && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {section.gradeLevel.name}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredSubjects.length > 0 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <BookOpenIcon />
                  {t('menu.subjects')}
                </h3>
                <div className="space-y-1">
                  {filteredSubjects.slice(0, 3).map(subject => (
                    <button
                       key={subject.id}
                       onClick={handleSubjectClick}
                       className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none transition-colors"
                     >
                      <div className="font-medium text-gray-900 dark:text-white">{subject.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Code: {subject.code}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredAssignments.length > 0 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <UsersIcon />
                  Affectations
                </h3>
                <div className="space-y-1">
                  {filteredAssignments.slice(0, 3).map(assignment => (
                    <button
                       key={assignment.id}
                       onClick={handleAssignmentClick}
                       className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none transition-colors"
                     >
                      <div className="font-medium text-gray-900 dark:text-white">
                        {assignment.teacher?.firstName} {assignment.teacher?.lastName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {assignment.subject?.name} - {assignment.classSection?.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {filteredUsers.length === 0 && filteredSections.length === 0 && filteredSubjects.length === 0 && filteredAssignments.length === 0 && query && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {t('common.noResults')}
                </p>
              </div>
            )}
          </div>
        )}
        
        {!query && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {t('common.searchPlaceholder')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}