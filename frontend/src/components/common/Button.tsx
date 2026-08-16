import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: React.ReactNode;
  label: string;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'secondary', icon, label, ...props }) => {
  const baseStyles = "flex flex-col items-center justify-center p-2 rounded-xl transition text-xs font-medium";
  
  const variants = {
    primary: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100",
    secondary: "bg-gray-50 text-gray-600 hover:bg-gray-100",
    outline: "border border-gray-200 hover:bg-gray-50 text-gray-700"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]}`} {...props}>
      {icon && <span className="mb-1">{icon}</span>}
      <span>{label}</span>
    </button>
  );
};