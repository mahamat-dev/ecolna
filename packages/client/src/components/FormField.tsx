import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  children: ReactNode;
  error?: string;
  required?: boolean;
  description?: string;
}

export function FormField({
  label,
  children,
  error,
  required = false,
  description
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
      </label>
      {description && (
        <p className="text-xs text-gray-600 dark:text-gray-400">{description}</p>
      )}
      {children}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

// Common input component with consistent styling
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error, className = '', ...props }: InputProps) {
  const baseClass = 'w-full px-4 py-2.5 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors duration-200';
  const errorClass = error
    ? 'border-red-300 dark:border-red-600 focus:ring-red-500 dark:focus:ring-red-400 focus:border-red-500 dark:focus:border-red-400'
    : 'border-gray-300 dark:border-gray-600 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400';
  
  return (
    <input
      className={`${baseClass} ${errorClass} ${className}`}
      {...props}
    />
  );
}

// Common select component
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  children: ReactNode;
}

export function Select({ error, className = '', children, ...props }: SelectProps) {
  const baseClass = 'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2';
  const errorClass = error
    ? 'border-red-300 focus:ring-red-500'
    : 'border-gray-300 focus:ring-blue-500';
  
  return (
    <select
      className={`${baseClass} ${errorClass} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

// Common textarea component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({ error, className = '', ...props }: TextareaProps) {
  const baseClass = 'w-full px-4 py-2.5 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors duration-200 resize-vertical';
  const errorClass = error
    ? 'border-red-300 dark:border-red-600 focus:ring-red-500 dark:focus:ring-red-400 focus:border-red-500 dark:focus:border-red-400'
    : 'border-gray-300 dark:border-gray-600 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400';
  
  return (
    <textarea
      className={`${baseClass} ${errorClass} ${className}`}
      {...props}
    />
  );
}