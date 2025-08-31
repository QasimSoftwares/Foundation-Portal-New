'use client';

import { useEffect, useState } from 'react';
import { getPasswordStrength, getPasswordStrengthLabel } from '@/lib/security/passwordUtils';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export function PasswordStrengthIndicator({ password, className = '' }: PasswordStrengthIndicatorProps) {
  const [strength, setStrength] = useState(0);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('bg-gray-200');
  const [width, setWidth] = useState('0%');

  useEffect(() => {
    if (!password) {
      setStrength(0);
      setLabel('');
      setColor('bg-gray-200');
      setWidth('0%');
      return;
    }

    const newStrength = getPasswordStrength(password);
    const newLabel = getPasswordStrengthLabel(newStrength);
    
    // Update strength and label
    setStrength(newStrength);
    setLabel(newLabel);

    // Update progress bar color and width
    let newColor = 'bg-red-500';
    if (newStrength >= 4) newColor = 'bg-green-500';
    else if (newStrength >= 3) newColor = 'bg-blue-500';
    else if (newStrength >= 2) newColor = 'bg-yellow-500';
    
    setColor(newColor);
    setWidth(`${(newStrength / 5) * 100}%`);
  }, [password]);

  if (!password) return null;

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Password Strength: <span className="font-medium">{label}</span></span>
        <span>{strength}/5</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div 
          className={`h-1.5 rounded-full transition-all duration-300 ${color}`}
          style={{ width }}
        />
      </div>
      <div className="mt-2 text-xs text-gray-500">
        {password.length < 12 && (
          <p>• Use at least 12 characters</p>
        )}
        {!/[a-z]/.test(password) && (
          <p>• Include a lowercase letter</p>
        )}
        {!/[A-Z]/.test(password) && (
          <p>• Include an uppercase letter</p>
        )}
        {!/[0-9]/.test(password) && (
          <p>• Include a number</p>
        )}
        {!/[^a-zA-Z0-9]/.test(password) && (
          <p>• Include a special character</p>
        )}
      </div>
    </div>
  );
}
